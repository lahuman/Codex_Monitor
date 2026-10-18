import { readFile } from "node:fs/promises";
import {
  projectWebsite,
  projectRepository,
  projectReleases,
  projectMacGuide,
} from "./project-links.mjs";
import assert from "node:assert/strict";
import test from "node:test";
import { macInstallationGuide } from "./macos-installation-guide.mjs";

test("offline guide preserves trust facts and conditions without active content", () => {
  for (const [kind, ticket, gatekeeper] of [
    ["ad-hoc", "absent", "rejected"],
    ["developer-id", "validated", "accepted"],
    ["other", "unverified", "unverified"],
  ]) {
    const { html, text } = macInstallationGuide(
      { productName: 'Codex <Monitor> & "Test"', version: "0.1.10" },
      {
        kind,
        notarizationTicket: { status: ticket },
        gatekeeper: { status: gatekeeper },
      },
    );
    for (const value of [
      kind,
      ticket,
      gatekeeper,
      "0.1.10",
      "미서명",
      "Open Anyway",
      "개인정보 보호 및 보안",
      "악성코드 탐지 확정과 다릅니다",
      "진행을 중단",
      "https://support.apple.com/ko-kr/102445",
      projectWebsite,
      projectReleases,
      projectMacGuide,
    ]) {
      assert.ok(html.includes(value), value);
      assert.ok(text.includes(value), value);
    }
    assert.ok(html.includes("Codex &lt;Monitor&gt; &amp; &quot;Test&quot;"));
    assert.doesNotMatch(
      html,
      /<script|<iframe|<form|javascript:|<img|<link\b/i,
    );
    assert.doesNotMatch(html, /spctl\s+--|xattr\s+-/);
  }
});

test("canonical Pages identity reaches site metadata and Windows installer assets", async () => {
  assert.equal(projectWebsite, "https://lahuman.github.io/Codex_Monitor/");
  assert.equal(projectRepository, "https://github.com/lahuman/Codex_Monitor");
  const config = JSON.parse(
    await readFile(
      new URL("../src-tauri/tauri.conf.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(config.bundle.homepage, projectWebsite);
  const mkdocs = await readFile(
    new URL("../../mkdocs.yml", import.meta.url),
    "utf8",
  );
  assert.ok(mkdocs.includes(`site_url: ${projectWebsite}docs/`));
  for (const [key, width, height] of [
    ["headerImage", 150, 57],
    ["sidebarImage", 164, 314],
  ]) {
    const bmp = await readFile(
      new URL(
        config.bundle.windows.nsis[key],
        new URL("../src-tauri/", import.meta.url),
      ),
    );
    assert.equal(bmp.toString("ascii", 0, 2), "BM");
    assert.equal(bmp.readInt32LE(18), width);
    assert.equal(bmp.readInt32LE(22), height);
    assert.equal(bmp.readUInt16LE(28), 24);
  }
});
