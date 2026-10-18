import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { buildMacInstaller, verifyMacInstaller } from "./macos-installer.mjs";
import { verifyMacBundle } from "./macos-verification.mjs";

const desktop = fileURLToPath(new URL("../", import.meta.url));
const root = path.dirname(desktop);
function command(program, args, capture = false) {
  const result = spawnSync(program, args, {
    cwd: desktop,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${program} failed (${result.status}): ${capture ? result.stderr.trim() : "see output above"}`,
    );
  return capture ? result.stdout.trim() : "";
}
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}
async function exists(file) {
  try {
    await access(file);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
async function main() {
  if (process.platform !== "darwin")
    throw new Error("Run macOS packaging on a Mac.");
  if (process.argv.length !== 2)
    throw new Error("Usage: npm run package:macos");
  const config = JSON.parse(
    await readFile(path.join(desktop, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const { productName, version, identifier } = config;
  if (
    typeof productName !== "string" ||
    !/^[A-Za-z0-9 -]+$/.test(productName) ||
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)
  )
    throw new Error("Invalid product name or version.");
  command("npm", ["run", "icons"]);
  command("npm", ["run", "build"]);
  const metadata = JSON.parse(
    command(
      "cargo",
      [
        "metadata",
        "--no-deps",
        "--format-version",
        "1",
        "--manifest-path",
        path.join(root, "Cargo.toml"),
      ],
      true,
    ),
  );
  const app = path.join(
    metadata.target_directory,
    "release/bundle/macos",
    `${productName}.app`,
  );
  const plist = path.join(app, "Contents/Info.plist");
  const field = (key) =>
    command("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, plist], true);
  for (const [key, expected] of Object.entries({
    CFBundleName: productName,
    CFBundleShortVersionString: version,
    CFBundleIdentifier: identifier,
  })) {
    if (field(key) !== expected)
      throw new Error(`Built application ${key} does not match configuration.`);
  }
  const executable = field("CFBundleExecutable");
  if (path.basename(executable) !== executable)
    throw new Error("Invalid bundle executable.");
  const architectures = command(
    "/usr/bin/lipo",
    ["-archs", path.join(app, "Contents/MacOS", executable)],
    true,
  )
    .split(/\s+/)
    .sort();
  const architecture =
    architectures.length === 2 &&
    architectures.includes("arm64") &&
    architectures.includes("x86_64")
      ? "universal"
      : architectures.length === 1 &&
          ["arm64", "x86_64"].includes(architectures[0])
        ? architectures[0]
        : null;
  if (architecture == null)
    throw new Error(`Unsupported architectures: ${architectures.join(", ")}`);
  // Fail at the producer boundary: container integrity alone is insufficient.
  const signing = verifyMacBundle(app, identifier);
  const parent = path.join(desktop, "releases", version);
  const output = path.join(parent, `macos-${architecture}`);
  if (await exists(output))
    throw new Error(
      `Release output already exists: ${output}. Preserve it or change the configured version before packaging again.`,
    );
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(
    path.join(parent, `.packaging-${randomUUID()}-`),
  );
  let mounted = false;
  try {
    const filename = `${productName.replaceAll(" ", "-")}-${version}-macos-${architecture}`;
    const zip = path.join(temporary, `${filename}.zip`);
    const dmg = path.join(temporary, `${filename}.dmg`);
    const installer = path.join(temporary, ".installer");
    await mkdir(installer);
    const copiedApp = path.join(installer, `${productName}.app`);
    command("/usr/bin/ditto", [app, copiedApp]);
    verifyMacBundle(copiedApp, identifier);
    await copyFile(
      path.join(desktop, "scripts/diagnose-macos.command"),
      path.join(installer, "Diagnose-Codex-Monitor.command"),
    );
    const installerPackage = await buildMacInstaller({
      app: copiedApp,
      output: path.join(installer, "설치하기.pkg"),
      temporary,
      config,
      architecture,
    });
    await symlink("/Applications", path.join(installer, "Applications"));
    await writeFile(
      path.join(installer, "Installation.txt"),
      `${productName} ${version}\n\n설치 진행률 보기: 설치하기.pkg를 더블클릭하세요. macOS 설치 프로그램에서 진행 막대와 완료 화면을 보여줍니다.\n드래그 설치: 앱을 Applications 폴더로 드래그할 수도 있습니다. 복사 진행 표시는 Finder가 관리합니다.\n기존 앱이 실행 중이면 종료한 후 교체하세요.\n앱 교체 후에도 기존 계정과 모니터링 데이터는 유지됩니다.\n\nInstall with progress: open 설치하기.pkg in macOS Installer. The package is unsigned; the app is ad-hoc signed.\nAlternatively drag the app to Applications (Finder controls copy progress). Quit the running app before replacing it.\nRequires macOS ${config.bundle.macOS.minimumSystemVersion} or later.\nArchitecture: ${architecture}. Intel Macs require an x86_64 or universal build.\n\nSigning: ${signing.kind}; Gatekeeper: ${signing.gatekeeper.status}; stapled notarization ticket: ${signing.notarizationTicket.status}.\nAd-hoc signing does not establish developer identity or Apple notarization.\nIf installation fails, run: bash Diagnose-Codex-Monitor.command "/Applications/${productName}.app"\nThe diagnostic only reads app/OS metadata and does not change security settings or access accounts.\n`,
    );
    command("/usr/bin/ditto", [
      "-c",
      "-k",
      "--sequesterRsrc",
      "--keepParent",
      copiedApp,
      zip,
    ]);
    command("/usr/bin/hdiutil", [
      "create",
      "-quiet",
      "-format",
      "UDZO",
      "-volname",
      productName,
      "-srcfolder",
      installer,
      dmg,
    ]);
    command("/usr/bin/hdiutil", ["verify", "-quiet", dmg]);
    const unpacked = path.join(temporary, ".zip-verification");
    command("/usr/bin/ditto", ["-x", "-k", zip, unpacked]);
    verifyMacBundle(path.join(unpacked, `${productName}.app`), identifier);
    await rm(unpacked, { recursive: true });
    const mount = path.join(temporary, ".mounted-dmg");
    await mkdir(mount);
    mounted = true; // Retain staging if an attach attempt has an uncertain outcome.
    command("/usr/bin/hdiutil", [
      "attach",
      "-readonly",
      "-nobrowse",
      "-noautoopen",
      "-mountpoint",
      mount,
      dmg,
    ]);
    try {
      verifyMacBundle(path.join(mount, `${productName}.app`), identifier);
      const mountedPackage = path.join(mount, "설치하기.pkg");
      if (
        (await sha256(mountedPackage)) !==
        (await sha256(path.join(installer, "설치하기.pkg")))
      )
        throw new Error("Mounted installer package mismatch");
      const expandedPackage = path.join(temporary, ".pkg-verification");
      await verifyMacInstaller(
        mountedPackage,
        config,
        architecture,
        expandedPackage,
      );
      await rm(expandedPackage, { recursive: true });
    } finally {
      // A failed detach must keep the mount location and staging files intact.
      command("/usr/sbin/diskutil", ["eject", mount]);
      mounted = false;
    }
    await rm(mount, { recursive: true });
    const artifacts = [];
    for (const file of [dmg, zip])
      artifacts.push({
        file: path.basename(file),
        sha256: await sha256(file),
        bytes: (await stat(file)).size,
      });
    await writeFile(
      path.join(temporary, "SHA256SUMS.txt"),
      artifacts.map((a) => `${a.sha256}  ${a.file}\n`).join(""),
    );
    await writeFile(
      path.join(temporary, "release.json"),
      JSON.stringify(
        {
          productName,
          version,
          identifier,
          architecture,
          minimumMacOS: config.bundle.macOS.minimumSystemVersion,
          signing,
          installer: installerPackage,
          verifiedContainers: ["app-copy", "zip-round-trip", "read-only-dmg"],
          artifacts,
        },
        null,
        2,
      ) + "\n",
    );
    await rm(installer, { recursive: true });
    await rename(temporary, output);
    // Verified archives now preserve the build. Do not leave another launchable
    // copy for macOS app discovery; explicit `npm run build` still retains one.
    await rm(app, { recursive: true });
    console.log(`\nRelease artifacts: ${output}`);
  } catch (error) {
    if (mounted)
      throw new Error(`DMG cleanup failed; staging retained at ${temporary}`, {
        cause: error,
      });
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
