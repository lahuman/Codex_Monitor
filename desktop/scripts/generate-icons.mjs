import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const desktop = fileURLToPath(new URL("../", import.meta.url));
const temporary = await mkdtemp(path.join(tmpdir(), "codex-monitor-icons-"));
try {
  execFileSync(
    process.execPath,
    [
      path.join(desktop, "node_modules/@tauri-apps/cli/tauri.js"),
      "icon",
      path.join(desktop, "branding/icon.svg"),
      "--output",
      temporary,
    ],
    { stdio: "inherit" },
  );
  // Tauri emits ICNS chunks in arbitrary order; retain identical image data
  // with a canonical order so regeneration does not dirty the repository.
  const nativePath = path.join(temporary, "icon.icns");
  const native = await readFile(nativePath);
  if (
    native.toString("ascii", 0, 4) !== "icns" ||
    native.readUInt32BE(4) !== native.length
  )
    throw new Error("Invalid generated ICNS header.");
  const chunks = [];
  for (let offset = 8; offset < native.length; ) {
    if (offset + 8 > native.length) throw new Error("Truncated ICNS chunk.");
    const length = native.readUInt32BE(offset + 4);
    if (length < 8 || offset + length > native.length)
      throw new Error("Invalid ICNS chunk length.");
    chunks.push(native.subarray(offset, offset + length));
    offset += length;
  }
  chunks.sort((a, b) => Buffer.compare(a.subarray(0, 4), b.subarray(0, 4)));
  await writeFile(
    nativePath,
    Buffer.concat([native.subarray(0, 8), ...chunks]),
  );
  const output = path.join(desktop, "src-tauri/icons");
  await mkdir(output, { recursive: true });
  for (const name of [
    "32x32.png",
    "64x64.png",
    "128x128.png",
    "128x128@2x.png",
    "icon.png",
    "icon.icns",
    "icon.ico",
  ])
    await copyFile(path.join(temporary, name), path.join(output, name));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
