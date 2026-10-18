import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
async function optional(call) {
  try {
    return (await call()).data;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function windowsReleaseAssets(directory, config) {
  const metadata = JSON.parse(
    await readFile(path.join(directory, "release.json"), "utf8"),
  );
  const { version, productName, identifier } = config;
  if (
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) ||
    productName !== "Codex Monitor" ||
    identifier !== "local.codex-lb.desktop.preview"
  )
    throw new Error("Invalid Windows release configuration");
  if (
    !metadata ||
    typeof metadata !== "object" ||
    metadata.version !== version ||
    metadata.productName !== productName ||
    metadata.identifier !== identifier ||
    metadata.architecture !== "x64" ||
    metadata.target !== "x86_64-pc-windows-msvc" ||
    metadata.artifacts?.length !== 1
  )
    throw new Error("Windows release manifest does not match this build");
  const artifact = metadata.artifacts[0];
  const expected = `Codex-Monitor-${version}-windows-x64-setup.exe`;
  if (
    artifact.file !== expected ||
    !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
    !Number.isSafeInteger(artifact.bytes) ||
    artifact.bytes <= 0
  )
    throw new Error("Invalid Windows installer metadata");
  const files = (await readdir(directory)).sort();
  if (
    JSON.stringify(files) !==
    JSON.stringify([expected, "SHA256SUMS.txt", "release.json"].sort())
  )
    throw new Error("Unexpected Windows release artifact contents");
  const installer = await readFile(path.join(directory, expected));
  if (
    installer.length !== artifact.bytes ||
    sha256(installer) !== artifact.sha256
  )
    throw new Error("Windows installer checksum/size mismatch");
  const checksums = await readFile(path.join(directory, "SHA256SUMS.txt"));
  if (checksums.toString("utf8") !== `${artifact.sha256}  ${expected}\n`)
    throw new Error("Windows checksum manifest mismatch");
  return [
    { name: expected, data: installer },
    { name: "SHA256SUMS-windows-x64.txt", data: checksums },
    {
      name: "release-windows-x64.json",
      data: await readFile(path.join(directory, "release.json")),
    },
  ];
}

// Publication is isolated from building. No asset replacement, tag movement or deletion.
export async function publishWindowsRelease({
  github,
  context,
  core,
  artifactDirectory,
  configPath = new URL("../src-tauri/tauri.conf.json", import.meta.url),
}) {
  const { owner, repo } = context.repo;
  if (
    owner.toLowerCase() !== "lahuman" ||
    repo.toLowerCase() !== "codex_monitor" ||
    context.ref !== "refs/heads/main" ||
    !["push", "workflow_dispatch"].includes(context.eventName) ||
    !/^[a-f0-9]{40}$/.test(context.sha)
  )
    throw new Error(
      "Only the project main push/manual build may publish Windows releases",
    );
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const assets = await windowsReleaseAssets(artifactDirectory, config);
  const api = github.rest,
    base = { owner, repo };
  const branch = (await api.repos.getBranch({ ...base, branch: "main" })).data;
  if (branch.commit.sha !== context.sha)
    throw new Error(
      "Main advanced; publish its newer successful build instead",
    );
  const tag = `desktop-v${config.version}-windows-x64`;
  const marker = `<!-- codex-monitor-windows-release:${context.sha} -->`;
  const ref = await optional(() =>
    api.git.getRef({ ...base, ref: `tags/${tag}` }),
  );
  let release = await optional(() =>
    api.repos.getReleaseByTag({ ...base, tag }),
  );
  if (ref && (ref.object.type !== "commit" || ref.object.sha !== context.sha))
    throw new Error(
      `Tag ${tag} belongs to another commit. Bump the desktop version; existing releases are preserved.`,
    );
  if (release && (release.tag_name !== tag || !release.body?.includes(marker)))
    throw new Error(
      `Release ${tag} is not owned by this build; refusing to modify it`,
    );

  const existing = release
    ? await github.paginate(api.repos.listReleaseAssets, {
        ...base,
        release_id: release.id,
      })
    : [];
  const missing = [];
  async function verifyAsset(asset, expected) {
    if (
      asset.name !== expected.name ||
      asset.size !== expected.data.length ||
      asset.state !== "uploaded"
    )
      throw new Error(`Release asset metadata mismatch: ${expected.name}`);
    let digest = asset.digest;
    if (digest == null) {
      const downloaded = (
        await api.repos.getReleaseAsset({
          ...base,
          asset_id: asset.id,
          headers: { accept: "application/octet-stream" },
        })
      ).data;
      if (
        !Buffer.isBuffer(downloaded) &&
        !(downloaded instanceof ArrayBuffer) &&
        !ArrayBuffer.isView(downloaded)
      )
        throw new Error(
          `Cannot verify downloaded release asset: ${expected.name}`,
        );
      const bytes = ArrayBuffer.isView(downloaded)
        ? Buffer.from(
            downloaded.buffer,
            downloaded.byteOffset,
            downloaded.byteLength,
          )
        : Buffer.from(downloaded);
      digest = `sha256:${sha256(bytes)}`;
    }
    if (digest !== `sha256:${sha256(expected.data)}`)
      throw new Error(
        `Release asset checksum mismatch: ${expected.name}; no existing asset was replaced`,
      );
  }
  for (const asset of assets) {
    const found = existing.filter((x) => x.name === asset.name);
    if (found.length > 1)
      throw new Error(`Duplicate release assets: ${asset.name}`);
    if (found.length) await verifyAsset(found[0], asset);
    else missing.push(asset);
  }
  if (release && !release.draft) {
    if (missing.length)
      throw new Error(
        "Published release is incomplete; refusing to mutate public assets",
      );
    core.info(`Verified existing release: ${release.html_url}`);
    return release.html_url;
  }
  if (!ref)
    await api.git.createRef({
      ...base,
      ref: `refs/tags/${tag}`,
      sha: context.sha,
    });
  if (!release) {
    release = (
      await api.repos.createRelease({
        ...base,
        tag_name: tag,
        target_commitish: context.sha,
        name: `Codex Monitor ${config.version} — Windows x64`,
        draft: true,
        prerelease: true,
        body: `${marker}\nWindows x64 installer built from ${context.sha}.\n\nAutomated tests and packaging passed. Code signing is not configured; SmartScreen may warn. Real-PC installation and upgrade testing is still required.\n\nBuild: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
      })
    ).data;
  }
  for (const asset of missing) {
    const uploaded = (
      await api.repos.uploadReleaseAsset({
        ...base,
        release_id: release.id,
        name: asset.name,
        data: asset.data,
        headers: {
          "content-type": "application/octet-stream",
          "content-length": asset.data.length,
        },
      })
    ).data;
    await verifyAsset(uploaded, asset);
  }
  const published = (
    await api.repos.updateRelease({
      ...base,
      release_id: release.id,
      draft: false,
      prerelease: true,
      make_latest: "false",
    })
  ).data;
  core.info(`Published Windows prerelease: ${published.html_url}`);
  return published.html_url;
}
