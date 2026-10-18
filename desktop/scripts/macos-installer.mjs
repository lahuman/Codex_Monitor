import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMacBundle } from "./macos-verification.mjs";
function command(program, args) {
  const result = spawnSync(program, args, { encoding: "utf8" });
  if (result.error || result.status !== 0)
    throw new Error(
      `${program}: ${result.error?.message || result.stderr || result.stdout}`,
    );
  return result.stdout.trim();
}
async function plist(file, value) {
  await writeFile(file, JSON.stringify(value));
  command("/usr/bin/plutil", ["-convert", "xml1", file]);
}
function xpath(file, expression) {
  return command("/usr/bin/xmllint", ["--xpath", expression, file]);
}
export async function buildMacInstaller({
  app,
  output,
  temporary,
  config,
  architecture,
}) {
  const work = await mkdtemp(path.join(temporary, ".pkg-build-"));
  try {
    const payload = path.join(work, "payload");
    await mkdir(payload);
    command("/usr/bin/ditto", [
      app,
      path.join(payload, `${config.productName}.app`),
    ]);
    const components = path.join(work, "components.plist");
    command("/usr/bin/pkgbuild", ["--analyze", "--root", payload, components]);
    const items = JSON.parse(
      command("/usr/bin/plutil", ["-convert", "json", "-o", "-", components]),
    );
    if (
      items.length !== 1 ||
      items[0].RootRelativeBundlePath !== `${config.productName}.app`
    )
      throw new Error("Unexpected installer payload bundles");
    Object.assign(items[0], {
      BundleIsRelocatable: false,
      BundleIsVersionChecked: true,
      BundleHasStrictIdentifier: true,
      BundleOverwriteAction: "upgrade",
    });
    await plist(components, items);
    const component = path.join(work, `${config.productName}.pkg`);
    const identifier = `${config.identifier}.installer`;
    command("/usr/bin/pkgbuild", [
      "--root",
      payload,
      "--component-plist",
      components,
      "--identifier",
      identifier,
      "--version",
      config.version,
      "--install-location",
      "/Applications",
      component,
    ]);
    const requirements = path.join(work, "requirements.plist");
    const arches =
      architecture === "universal" ? ["arm64", "x86_64"] : [architecture];
    await plist(requirements, {
      os: [config.bundle.macOS.minimumSystemVersion],
      arch: arches,
      home: false,
    });
    const distribution = path.join(work, "Distribution");
    command("/usr/bin/productbuild", [
      "--synthesize",
      "--product",
      requirements,
      "--package",
      component,
      distribution,
    ]);
    const titledDistribution = path.join(work, "Distribution.titled");
    command("/usr/bin/xsltproc", [
      "--nonet",
      "--stringparam",
      "product",
      config.productName,
      "--output",
      titledDistribution,
      fileURLToPath(new URL("./installer-title.xsl", import.meta.url)),
      distribution,
    ]);
    command("/usr/bin/productbuild", [
      "--distribution",
      titledDistribution,
      "--package-path",
      work,
      output,
    ]);
    const restored = await verifyMacInstaller(
      output,
      config,
      architecture,
      path.join(work, "expanded"),
    );
    command("/usr/bin/diff", ["-qr", app, restored]);
    return {
      file: path.basename(output),
      signing: "unsigned",
      destination: "/Applications",
      progress: "macOS Installer",
      payloadVerification: "passed",
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
export async function verifyMacInstaller(file, config, architecture, expanded) {
  command("/usr/sbin/pkgutil", ["--expand-full", file, expanded]);
  const entries = await readdir(expanded, { withFileTypes: true });
  const components = entries.filter(
    (e) => e.isDirectory() && e.name.endsWith(".pkg"),
  );
  if (components.length !== 1)
    throw new Error("Installer must contain exactly one component");
  const component = path.join(expanded, components[0].name),
    info = path.join(component, "PackageInfo"),
    distribution = path.join(expanded, "Distribution");
  const checks = [
    [distribution, "string(/installer-gui-script/title)", config.productName],
    [info, "string(/pkg-info/@identifier)", `${config.identifier}.installer`],
    [info, "string(/pkg-info/@version)", config.version],
    [info, "string(/pkg-info/@install-location)", "/Applications"],
    [info, "count(/pkg-info/scripts/*)", "0"],
    [info, "count(/pkg-info/relocate/*)", "0"],
    [info, "string(/pkg-info/bundle-version/bundle/@id)", config.identifier],
  ];
  for (const [xml, query, expected] of checks)
    if (xpath(xml, query) !== expected)
      throw new Error(`Invalid installer contract: ${query}`);
  const arches = xpath(
    distribution,
    "string(/installer-gui-script/options/@hostArchitectures)",
  )
    .split(",")
    .sort();
  const expectedArches =
    architecture === "universal" ? ["arm64", "x86_64"] : [architecture];
  if (JSON.stringify(arches) !== JSON.stringify(expectedArches))
    throw new Error("Installer architecture requirements mismatch");
  if (
    xpath(
      distribution,
      "string(/installer-gui-script/volume-check/allowed-os-versions/os-version/@min)",
    ) !== config.bundle.macOS.minimumSystemVersion
  )
    throw new Error("Installer minimum OS mismatch");
  const payload = path.join(component, "Payload"),
    files = await readdir(payload);
  if (JSON.stringify(files) !== JSON.stringify([`${config.productName}.app`]))
    throw new Error("Unexpected installer files");
  const app = path.join(payload, `${config.productName}.app`);
  verifyMacBundle(app, config.identifier);
  const version = command("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleShortVersionString",
    path.join(app, "Contents/Info.plist"),
  ]);
  if (version !== config.version)
    throw new Error("Installer app version mismatch");
  const minOS = command("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :LSMinimumSystemVersion",
    path.join(app, "Contents/Info.plist"),
  ]);
  if (minOS !== config.bundle.macOS.minimumSystemVersion)
    throw new Error("Installer app minimum OS mismatch");
  const executable = command("/usr/libexec/PlistBuddy", [
    "-c",
    "Print :CFBundleExecutable",
    path.join(app, "Contents/Info.plist"),
  ]);
  if (path.basename(executable) !== executable)
    throw new Error("Invalid installer executable");
  const actualArches = command("/usr/bin/lipo", [
    "-archs",
    path.join(app, "Contents/MacOS", executable),
  ])
    .split(/\s+/)
    .sort();
  if (JSON.stringify(actualArches) !== JSON.stringify(expectedArches))
    throw new Error("Installer executable architecture mismatch");
  return app;
}
