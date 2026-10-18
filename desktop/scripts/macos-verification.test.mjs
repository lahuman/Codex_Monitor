import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { verifyMacBundle } from "./macos-verification.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(
  await readFile(path.join(root, "desktop/src-tauri/tauri.conf.json"), "utf8"),
);
function command(program, args, cwd = root) {
  const result = spawnSync(program, args, { cwd, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.error?.message || `${program} failed`,
    );
  return result.stdout;
}
const release = path.join(
  root,
  "desktop/releases",
  config.version,
  `macos-${process.arch === "x64" ? "x86_64" : process.arch}`,
);
async function extractRelease(temporary) {
  const metadata = JSON.parse(
    await readFile(path.join(release, "release.json"), "utf8"),
  );
  const zip = metadata.artifacts.find((artifact) =>
    artifact.file.endsWith(".zip"),
  );
  assert.ok(zip, "packaged ZIP must exist");
  command("/usr/bin/ditto", [
    "-x",
    "-k",
    path.join(release, zip.file),
    temporary,
  ]);
  return path.join(temporary, `${config.productName}.app`);
}
test(
  "successful macOS packaging retains archives and manifests only",
  { skip: process.platform !== "darwin" },
  async () => {
    const metadata = JSON.parse(
      await readFile(path.join(release, "release.json"), "utf8"),
    );
    assert.deepEqual(
      (await readdir(release)).sort(),
      [
        ...metadata.artifacts.map((artifact) => artifact.file),
        "SHA256SUMS.txt",
        "release.json",
      ].sort(),
    );
    const cargo = JSON.parse(
      command("cargo", ["metadata", "--no-deps", "--format-version", "1"]),
    );
    await assert.rejects(
      access(
        path.join(
          cargo.target_directory,
          "release/bundle/macos",
          `${config.productName}.app`,
        ),
      ),
      { code: "ENOENT" },
    );
    command("/usr/bin/shasum", ["-a", "256", "-c", "SHA256SUMS.txt"], release);
  },
);
test(
  "macOS distribution verification detects changes to the archived app",
  { skip: process.platform !== "darwin" },
  async () => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "codex-monitor-signature-test-"),
    );
    try {
      const app = await extractRelease(temporary);
      const result = verifyMacBundle(app, config.identifier);
      assert.equal(result.strictVerification, "passed");
      assert.throws(
        () => verifyMacBundle(app, "wrong.bundle.identifier"),
        /does not match/,
      );
      await writeFile(
        path.join(app, "Contents/Resources/unsealed-file.txt"),
        "tampered fixture",
      );
      assert.throws(
        () => verifyMacBundle(app, config.identifier),
        /signature verification failed/,
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  },
);
test(
  "recipient diagnostic reports verification without modifying the archived app",
  { skip: process.platform !== "darwin" },
  async () => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "codex-monitor-diagnostic-test-"),
    );
    try {
      const app = await extractRelease(temporary);
      const script = path.join(root, "desktop/scripts/diagnose-macos.command");
      const report = command("/bin/bash", [script, app]);
      assert.match(report, /Machine architecture:/);
      assert.ok(
        report.includes(`CFBundleShortVersionString: ${config.version}`),
      );
      assert.match(report, /codesign exit: 0/);
      assert.match(report, /End of report/);
      assert.equal(
        verifyMacBundle(app, config.identifier).strictVerification,
        "passed",
      );
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  },
);

test(
  "DMG provides a native progress installer with verified app-only payload",
  { skip: process.platform !== "darwin" },
  async () => {
    const { verifyMacInstaller } = await import("./macos-installer.mjs");
    const metadata = JSON.parse(
      await readFile(path.join(release, "release.json"), "utf8"),
    );
    assert.deepEqual(metadata.installer, {
      file: "설치하기.pkg",
      signing: "unsigned",
      destination: "/Applications",
      progress: "macOS Installer",
      payloadVerification: "passed",
    });
    const temporary = await mkdtemp(
      path.join(tmpdir(), "codex-monitor-installer-test-"),
    );
    const mount = path.join(temporary, "mount");
    await mkdir(mount);
    let mounted = true;
    try {
      const dmg = metadata.artifacts.find((a) => a.file.endsWith(".dmg"));
      command("/usr/bin/hdiutil", [
        "attach",
        "-readonly",
        "-nobrowse",
        "-noautoopen",
        "-mountpoint",
        mount,
        path.join(release, dmg.file),
      ]);
      const pkg = path.join(mount, "설치하기.pkg");
      await verifyMacInstaller(
        pkg,
        config,
        metadata.architecture,
        path.join(temporary, "expanded"),
      );
      const {
        installationGuideFile,
        installerGuideResource,
        macInstallationGuide,
      } = await import("./macos-installation-guide.mjs");
      const expectedGuide = macInstallationGuide(config, metadata.signing);
      const dmgGuide = await readFile(
        path.join(mount, installationGuideFile),
        "utf8",
      );
      assert.equal(dmgGuide, expectedGuide.html);
      assert.equal(
        await readFile(
          path.join(temporary, "expanded/Resources", installerGuideResource),
          "utf8",
        ),
        dmgGuide,
      );
      const distribution = path.join(temporary, "expanded/Distribution");
      for (const element of ["welcome", "conclusion"]) {
        assert.equal(
          command("/usr/bin/xmllint", [
            "--xpath",
            `string(/installer-gui-script/${element}/@file)`,
            distribution,
          ]).trim(),
          installerGuideResource,
        );
      }
      assert.match(
        await readFile(path.join(mount, "Installation.txt"), "utf8"),
        /Open Anyway/,
      );
      const choices = command("/usr/sbin/installer", [
        "-showChoicesXML",
        "-pkg",
        pkg,
        "-target",
        "/",
      ]);
      const choiceFile = path.join(temporary, "choices.plist");
      await writeFile(choiceFile, choices);
      const roots = JSON.parse(
        command("/usr/bin/plutil", ["-convert", "json", "-o", "-", choiceFile]),
      );
      const flatten = (items) =>
        items.flatMap((item) => [item, ...flatten(item.childItems ?? [])]);
      const selected = flatten(roots).find(
        (item) => item.choiceIdentifier === `${config.identifier}.installer`,
      );
      assert.ok(selected?.choiceIsSelected && selected.choiceIsEnabled);
      assert.equal(selected.choiceTitle, config.productName);
      assert.ok(selected.choiceSizeInKilobytes > 0);
      const signature = spawnSync(
        "/usr/sbin/pkgutil",
        ["--check-signature", pkg],
        { encoding: "utf8" },
      );
      assert.match(
        `${signature.stdout}\n${signature.stderr}`,
        /Status: no signature/,
      );
      await assert.rejects(
        verifyMacInstaller(
          pkg,
          { ...config, version: "0.0.0" },
          metadata.architecture,
          path.join(temporary, "wrong-version"),
        ),
        /Invalid installer contract/,
      );
    } finally {
      try {
        command("/usr/sbin/diskutil", ["eject", mount]);
        mounted = false;
      } finally {
        if (!mounted) await rm(temporary, { recursive: true, force: true });
      }
    }
  },
);
