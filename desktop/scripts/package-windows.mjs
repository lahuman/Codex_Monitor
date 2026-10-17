import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { executableArchitecture } from "./pe.mjs";
const desktop = fileURLToPath(new URL("../", import.meta.url));
const root = path.dirname(desktop);
const target = "x86_64-pc-windows-msvc";
function command(program, args, capture = false) {
  const result = spawnSync(program, args, { cwd: desktop, encoding: "utf8", stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${program} failed (${result.status}): ${capture ? result.stderr.trim() : "see output above"}`);
  return capture ? result.stdout.trim() : "";
}
async function exists(file) {
  try { await access(file); return true; }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}
async function sha256(file) {
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest("hex");
}
async function main() {
  if (process.platform !== "win32" || process.arch !== "x64")
    throw new Error("Run Windows x64 packaging on a Windows x64 machine.");
  if (process.argv.length !== 2) throw new Error("Usage: npm run package:windows");
  const config = JSON.parse(await readFile(path.join(desktop, "src-tauri/tauri.conf.json"), "utf8"));
  const { productName, version, identifier } = config;
  if (!/^[A-Za-z0-9 -]+$/.test(productName) || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))
    throw new Error("Invalid product name or version.");
  const parent = path.join(desktop, "releases", version);
  const output = path.join(parent, "windows-x64");
  if (await exists(output)) throw new Error(`Release output already exists: ${output}. Preserve it or change the version before packaging again.`);
  command(process.execPath, [path.join(desktop, "scripts/generate-icons.mjs")]);
  command(process.execPath, [path.join(desktop, "node_modules/@tauri-apps/cli/tauri.js"), "build", "--target", target, "--bundles", "nsis", "--ci", "--", "--locked"]);
  const metadata = JSON.parse(command("cargo", ["metadata", "--no-deps", "--format-version", "1", "--manifest-path", path.join(root, "Cargo.toml")], true));
  const release = path.join(metadata.target_directory, target, "release");
  const architecture = executableArchitecture(await readFile(path.join(release, "codex-lb-desktop.exe")));
  const installer = path.join(release, "bundle/nsis", `${productName}_${version}_x64-setup.exe`);
  if (!(await stat(installer)).isFile()) throw new Error("NSIS installer was not produced.");
  await mkdir(parent, { recursive: true });
  const temporary = await mkdtemp(path.join(parent, ".packaging-windows-"));
  try {
    const filename = `${productName.replaceAll(" ", "-")}-${version}-windows-${architecture}-setup.exe`;
    const copied = path.join(temporary, filename);
    await copyFile(installer, copied);
    const artifact = { file: filename, sha256: await sha256(copied), bytes: (await stat(copied)).size };
    await writeFile(path.join(temporary, "SHA256SUMS.txt"), `${artifact.sha256}  ${filename}\n`);
    await writeFile(path.join(temporary, "release.json"), JSON.stringify({ productName, version, identifier, architecture, target, minimumWindows: "Windows 10", webview2: "downloadBootstrapper", codeSigning: "not-configured", artifacts: [artifact] }, null, 2) + "\n");
    await rename(temporary, output);
    console.log(`\nRelease artifacts: ${output}`);
  } catch (error) { await rm(temporary, { recursive: true, force: true }); throw error; }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
