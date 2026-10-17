import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  access,
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
  try {
    const filename = `${productName.replaceAll(" ", "-")}-${version}-macos-${architecture}`;
    const zip = path.join(temporary, `${filename}.zip`);
    const dmg = path.join(temporary, `${filename}.dmg`);
    const installer = path.join(temporary, ".installer");
    await mkdir(installer);
    const copiedApp = path.join(installer, `${productName}.app`);
    command("/usr/bin/ditto", [app, copiedApp]);
    await symlink("/Applications", path.join(installer, "Applications"));
    await writeFile(
      path.join(installer, "Installation.txt"),
      `${productName} ${version}\n\n설치: 앱을 Applications 폴더로 드래그하세요.\n기존 앱이 실행 중이면 종료한 후 교체하세요.\n앱 교체 후에도 기존 계정과 모니터링 데이터는 유지됩니다.\n\nInstall: drag the app to Applications. Quit the running app before replacing it.\nRequires macOS ${config.bundle.macOS.minimumSystemVersion} or later.\n`,
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
          artifacts,
        },
        null,
        2,
      ) + "\n",
    );
    await rename(copiedApp, path.join(temporary, `${productName}.app`));
    await rm(installer, { recursive: true });
    await rename(temporary, output);
    console.log(`\nRelease artifacts: ${output}`);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
