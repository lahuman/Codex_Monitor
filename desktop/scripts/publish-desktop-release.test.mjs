import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { publishDesktopRelease } from "./publish-desktop-release.mjs";
const sha = "a".repeat(40),
  tag = "desktop-v0.1.10";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const context = {
  repo: { owner: "lahuman", repo: "Codex_Monitor" },
  ref: "refs/heads/main",
  eventName: "push",
  sha,
  serverUrl: "https://github.com",
  runId: 1,
};
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "desktop-release-contract-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const config = {
    productName: "Codex Monitor",
    version: "0.1.10",
    identifier: "local.codex-lb.desktop.preview",
  };
  const configPath = path.join(root, "config.json");
  const directory = path.join(root, "artifact");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(directory);
  await writeFile(configPath, JSON.stringify(config));
  const data = Buffer.from(
    "MZ publication-boundary fixture, not a native installer",
  );
  const file = "Codex-Monitor-0.1.10-windows-x64-setup.exe";
  await writeFile(path.join(directory, file), data);
  await writeFile(
    path.join(directory, "SHA256SUMS.txt"),
    `${hash(data)}  ${file}\n`,
  );
  const metadata = {
    ...config,
    architecture: "x64",
    target: "x86_64-pc-windows-msvc",
    codeSigning: "not-configured",
    artifacts: [{ file, bytes: data.length, sha256: hash(data) }],
  };
  await writeFile(
    path.join(directory, "release.json"),
    JSON.stringify(metadata),
  );
  const macosDirectory = path.join(root, "macos");
  await mkdir(macosDirectory);
  const macArtifacts = [];
  for (const extension of ["dmg", "zip"]) {
    const file = `Codex-Monitor-0.1.10-macos-arm64.${extension}`;
    const data = Buffer.from(
      `macOS ${extension} publication-boundary fixture, not a native archive`,
    );
    await writeFile(path.join(macosDirectory, file), data);
    macArtifacts.push({ file, bytes: data.length, sha256: hash(data) });
  }
  const macMetadata = {
    ...config,
    architecture: "arm64",
    signing: {
      strictVerification: "passed",
      kind: "ad-hoc",
      notarizationTicket: { status: "absent" },
      gatekeeper: { status: "rejected" },
    },
    installer: { payloadVerification: "passed", signing: "unsigned" },
    verifiedContainers: ["app-copy", "zip-round-trip", "read-only-dmg"],
    artifacts: macArtifacts,
  };
  await writeFile(
    path.join(macosDirectory, "release.json"),
    JSON.stringify(macMetadata),
  );
  await writeFile(
    path.join(macosDirectory, "SHA256SUMS.txt"),
    macArtifacts.map((a) => `${a.sha256}  ${a.file}\n`).join(""),
  );
  const state = {
    mutations: [],
    ref: null,
    release: null,
    assets: [],
    branchSHA: sha,
    failUpload: null,
    uploadCount: 0,
    omitDigest: false,
    downloads: 0,
  };
  const missing = () => {
    throw Object.assign(new Error("not found"), { status: 404 });
  };
  const repos = {
    getBranch: async () => ({ data: { commit: { sha: state.branchSHA } } }),
    getReleaseByTag: async () =>
      state.release ? { data: { ...state.release } } : missing(),
    listReleaseAssets: async () => ({
      data: state.assets.map((x) => ({ ...x })),
    }),
    createRelease: async (p) => {
      state.mutations.push("create-draft");
      assert.equal(p.draft, true);
      assert.equal(p.target_commitish, sha);
      state.release = { ...p, id: 1, html_url: "https://example.test/release" };
      return { data: { ...state.release } };
    },
    uploadReleaseAsset: async (p) => {
      state.uploadCount++;
      if (state.uploadCount === state.failUpload)
        throw new Error("upload interrupted");
      state.mutations.push(`upload:${p.name}`);
      const asset = {
        id: state.assets.length + 1,
        name: p.name,
        size: p.data.length,
        state: "uploaded",
        digest: state.omitDigest ? null : `sha256:${hash(p.data)}`,
        data: Buffer.from(p.data),
      };
      state.assets.push(asset);
      return { data: { ...asset } };
    },
    getReleaseAsset: async (p) => {
      state.downloads++;
      assert.equal(p.headers.accept, "application/octet-stream");
      return { data: state.assets.find((x) => x.id === p.asset_id).data };
    },
    updateRelease: async (p) => {
      assert.equal(state.assets.length, 7);
      assert.equal(p.prerelease, true);
      assert.equal(p.make_latest, "false");
      state.mutations.push("publish");
      state.release.draft = false;
      return { data: { ...state.release } };
    },
  };
  const github = {
    rest: {
      repos,
      git: {
        getRef: async () => (state.ref ? { data: state.ref } : missing()),
        createRef: async (p) => {
          state.mutations.push("create-tag");
          assert.equal(p.ref, `refs/tags/${tag}`);
          state.ref = { object: { type: "commit", sha: p.sha } };
          return { data: state.ref };
        },
      },
    },
    paginate: async (fn, params) => (await fn(params)).data,
  };
  const run = (override = {}) =>
    publishDesktopRelease({
      github,
      context,
      core: { info() {} },
      windowsDirectory: directory,
      macosDirectory,
      configPath,
      ...override,
    });
  return {
    root,
    directory,
    macosDirectory,
    metadata,
    macMetadata,
    file,
    state,
    run,
  };
}

test("publishes only after tag, draft and seven verified assets; a same-commit retry is a no-op", async (t) => {
  const f = await fixture(t);
  await f.run();
  assert.deepEqual(f.state.mutations, [
    "create-tag",
    "create-draft",
    `upload:${f.file}`,
    "upload:SHA256SUMS-windows-x64.txt",
    "upload:release-windows-x64.json",
    "upload:Codex-Monitor-0.1.10-macos-arm64.dmg",
    "upload:Codex-Monitor-0.1.10-macos-arm64.zip",
    "upload:SHA256SUMS-macos-arm64.txt",
    "upload:release-macos-arm64.json",
    "publish",
  ]);
  assert.equal(f.state.release.prerelease, true);
  assert.match(f.state.release.name, /macOS & Windows/);
  assert.ok(
    f.state.release.body.includes(
      `releases/download/${tag}/Codex-Monitor-0.1.10-macos-arm64.dmg`,
    ),
  );
  assert.ok(
    f.state.release.body.includes(
      `releases/download/${tag}/Codex-Monitor-0.1.10-windows-x64-setup.exe`,
    ),
  );
  assert.match(f.state.release.body, /notarization ticket: absent/);
  assert.ok(
    f.state.release.body.includes("https://lahuman.github.io/Codex_Monitor/"),
  );
  assert.ok(f.state.release.body.includes("docs/monitor/windows/"));
  assert.ok(f.state.release.body.includes("docs/monitor/macos-installation/"));
  assert.equal(f.state.release.draft, false);
  f.state.mutations = [];
  await f.run();
  assert.deepEqual(f.state.mutations, []);
});
test("partial draft retry reuses assets before or during macOS upload, including missing digests", async (t) => {
  for (const stop of [2, 6]) {
    const f = await fixture(t);
    f.state.omitDigest = true;
    f.state.failUpload = stop;
    await assert.rejects(f.run(), /upload interrupted/);
    assert.equal(f.state.release.draft, true);
    assert.equal(f.state.assets.length, stop - 1);
    assert.ok(!f.state.mutations.includes("publish"));
    f.state.failUpload = null;
    await f.run();
    assert.equal(f.state.assets.length, 7);
    assert.equal(f.state.release.draft, false);
    assert.ok(f.state.downloads >= 8);
  }
});

test("refuses another tag commit, unowned releases and an advanced main without mutations", async (t) => {
  for (const kind of ["tag", "unowned", "advanced", "annotated"]) {
    const f = await fixture(t);
    if (kind === "tag")
      f.state.ref = { object: { type: "commit", sha: "b".repeat(40) } };
    if (kind === "annotated") f.state.ref = { object: { type: "tag", sha } };
    if (kind === "unowned")
      f.state.release = { tag_name: tag, body: "manual release", draft: true };
    if (kind === "advanced") f.state.branchSHA = "b".repeat(40);
    await assert.rejects(f.run());
    assert.deepEqual(f.state.mutations, [], kind);
  }
});
test("refuses corrupt files/manifests and ineligible contexts before mutations", async (t) => {
  for (const kind of [
    "checksum",
    "version",
    "traversal",
    "manifest",
    "extra",
    "pull_request",
    "branch",
    "fork",
  ]) {
    const f = await fixture(t);
    let ctx = context;
    if (kind === "checksum")
      await writeFile(path.join(f.directory, f.file), "modified");
    if (kind === "version") {
      f.metadata.version = "0.0.0";
      await writeFile(
        path.join(f.directory, "release.json"),
        JSON.stringify(f.metadata),
      );
    }
    if (kind === "traversal") {
      f.metadata.artifacts[0].file = "../outside.exe";
      await writeFile(
        path.join(f.directory, "release.json"),
        JSON.stringify(f.metadata),
      );
    }
    if (kind === "manifest")
      await writeFile(path.join(f.directory, "SHA256SUMS.txt"), "incorrect");
    if (kind === "extra")
      await writeFile(path.join(f.directory, "unexpected"), "x");
    if (kind === "pull_request")
      ctx = { ...context, eventName: "pull_request" };
    if (kind === "branch") ctx = { ...context, ref: "refs/heads/feature" };
    if (kind === "fork")
      ctx = { ...context, repo: { owner: "unrelated", repo: "Codex_Monitor" } };
    await assert.rejects(f.run({ context: ctx }));
    assert.deepEqual(f.state.mutations, [], kind);
  }
});
test("never replaces conflicting public assets or fills an incomplete published release", async (t) => {
  for (const kind of ["digest", "download", "missing"]) {
    const f = await fixture(t);
    await f.run();
    f.state.mutations = [];
    if (kind === "digest")
      f.state.assets[0].digest = `sha256:${"0".repeat(64)}`;
    else if (kind === "download") {
      f.state.assets[0].digest = null;
      f.state.assets[0].data = Buffer.from("corrupt download");
    } else f.state.assets.pop();
    await assert.rejects(f.run());
    assert.deepEqual(f.state.mutations, [], kind);
  }
});

test("rejects missing, mismatched or unverified macOS artifacts before any publication", async (t) => {
  for (const kind of [
    "missing",
    "version",
    "architecture",
    "signature",
    "container",
    "installer",
    "corrupt",
    "checksum",
    "duplicate",
  ]) {
    const f = await fixture(t);
    if (kind === "missing") await rm(f.macosDirectory, { recursive: true });
    if (kind === "version") f.macMetadata.version = "0.0.0";
    if (kind === "architecture") f.macMetadata.architecture = "x86_64";
    if (kind === "signature")
      f.macMetadata.signing.strictVerification = "failed";
    if (kind === "container") f.macMetadata.verifiedContainers.pop();
    if (kind === "installer")
      f.macMetadata.installer.payloadVerification = "failed";
    if (kind === "duplicate")
      f.macMetadata.artifacts[1] = { ...f.macMetadata.artifacts[0] };
    if (kind !== "missing")
      await writeFile(
        path.join(f.macosDirectory, "release.json"),
        JSON.stringify(f.macMetadata),
      );
    if (kind === "corrupt")
      await writeFile(
        path.join(f.macosDirectory, f.macMetadata.artifacts[0].file),
        "modified",
      );
    if (kind === "checksum")
      await writeFile(
        path.join(f.macosDirectory, "SHA256SUMS.txt"),
        "incorrect",
      );
    await assert.rejects(f.run());
    assert.deepEqual(f.state.mutations, [], kind);
  }
});
