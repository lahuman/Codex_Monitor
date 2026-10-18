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
