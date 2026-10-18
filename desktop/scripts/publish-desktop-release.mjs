import {
  projectWebsite,
  projectMacGuide,
  projectWindowsGuide,
} from "./project-links.mjs";
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

async function platformReleaseAssets(directory, config, platform) {
  const metadata = JSON.parse(
    await readFile(path.join(directory, "release.json"), "utf8"),
  );
  const { version, productName, identifier } = config;
  const mac = platform === "macos-arm64";
  const names = mac
    ? [
        `Codex-Monitor-${version}-macos-arm64.dmg`,
        `Codex-Monitor-${version}-macos-arm64.zip`,
      ]
    : [`Codex-Monitor-${version}-windows-x64-setup.exe`];
  if (
    !metadata ||
    metadata.version !== version ||
    metadata.productName !== productName ||
    metadata.identifier !== identifier ||
    metadata.architecture !== (mac ? "arm64" : "x64") ||
    !Array.isArray(metadata.artifacts) ||
    metadata.artifacts.length !== names.length
  )
    throw new Error(`${platform} release manifest does not match this build`);
  if (mac) {
    if (
      metadata.signing?.strictVerification !== "passed" ||
      !["ad-hoc", "developer-id", "other"].includes(metadata.signing.kind) ||
      !["validated", "absent", "unverified"].includes(
        metadata.signing.notarizationTicket?.status,
      ) ||
      !["accepted", "rejected", "unverified"].includes(
        metadata.signing.gatekeeper?.status,
      ) ||
      metadata.installer?.payloadVerification !== "passed" ||
      metadata.installer.signing !== "unsigned" ||
      !["app-copy", "zip-round-trip", "read-only-dmg"].every((v) =>
        metadata.verifiedContainers?.includes(v),
      )
    )
      throw new Error("macOS verification/signing facts missing");
  } else if (
    metadata.target !== "x86_64-pc-windows-msvc" ||
    typeof metadata.codeSigning !== "string"
  ) {
    throw new Error("Windows target/signing facts missing");
  }
  const files = (await readdir(directory)).sort();
  if (
    JSON.stringify(files) !==
    JSON.stringify([...names, "SHA256SUMS.txt", "release.json"].sort())
  )
    throw new Error(`Unexpected ${platform} release artifact contents`);
  const assets = [],
    seen = new Set();
  for (const artifact of metadata.artifacts) {
    if (
      !names.includes(artifact.file) ||
      seen.has(artifact.file) ||
      !/^[a-f0-9]{64}$/.test(artifact.sha256) ||
      !Number.isSafeInteger(artifact.bytes) ||
      artifact.bytes <= 0
    )
      throw new Error(`Invalid ${platform} artifact metadata`);
    seen.add(artifact.file);
    const data = await readFile(path.join(directory, artifact.file));
    if (data.length !== artifact.bytes || sha256(data) !== artifact.sha256)
      throw new Error(`${platform} artifact checksum/size mismatch`);
    assets.push({ name: artifact.file, data });
  }
  const checksums = await readFile(path.join(directory, "SHA256SUMS.txt"));
  const expectedChecksums = metadata.artifacts
    .map((a) => `${a.sha256}  ${a.file}\n`)
    .join("");
  if (checksums.toString("utf8") !== expectedChecksums)
    throw new Error(`${platform} checksum manifest mismatch`);
  assets.push(
    { name: `SHA256SUMS-${platform}.txt`, data: checksums },
    {
      name: `release-${platform}.json`,
      data: await readFile(path.join(directory, "release.json")),
    },
  );
  return { assets, metadata };
}
export async function desktopReleaseAssets(
  { windowsDirectory, macosDirectory },
  config,
) {
  if (
    !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(config.version) ||
    config.productName !== "Codex Monitor" ||
    config.identifier !== "local.codex-lb.desktop.preview"
  )
    throw new Error("Invalid desktop release configuration");
  // Validate every platform before the publisher is allowed any remote mutation.
  const windows = await platformReleaseAssets(
    windowsDirectory,
    config,
    "windows-x64",
  );
  const macos = await platformReleaseAssets(
    macosDirectory,
    config,
    "macos-arm64",
  );
  return {
    assets: [...windows.assets, ...macos.assets],
    windowsSigning: windows.metadata.codeSigning,
    macosSigning: macos.metadata.signing,
  };
}

// Publication is isolated from building. No asset replacement, tag movement or deletion.
export async function publishDesktopRelease({
  github,
  context,
  core,
  windowsDirectory,
  macosDirectory,
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
      "Only the project main push/manual build may publish desktop releases",
    );
  const config = JSON.parse(await readFile(configPath, "utf8"));
  const { assets, windowsSigning, macosSigning } = await desktopReleaseAssets(
    { windowsDirectory, macosDirectory },
    config,
  );
  const api = github.rest,
    base = { owner, repo };
  const branch = (await api.repos.getBranch({ ...base, branch: "main" })).data;
  if (branch.commit.sha !== context.sha)
    throw new Error(
      "Main advanced; publish its newer successful build instead",
    );
  const tag = `desktop-v${config.version}`;
  const marker = `<!-- codex-monitor-desktop-release:${context.sha} -->`;
  const downloads = `${context.serverUrl}/${owner}/${repo}/releases/download/${tag}`;
  const downloadTable = `| Platform | Download |\n| --- | --- |\n| macOS Apple Silicon | [DMG](${downloads}/Codex-Monitor-${config.version}-macos-arm64.dmg) · [ZIP](${downloads}/Codex-Monitor-${config.version}-macos-arm64.zip) |\n| Windows x64 | [Installer](${downloads}/Codex-Monitor-${config.version}-windows-x64-setup.exe) |`;

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
        name: `Codex Monitor ${config.version} — macOS & Windows`,
        draft: true,
        prerelease: true,
        body: `${marker}\n[프로젝트 / Website](${projectWebsite}) · [Mac 설치 안내](${projectMacGuide}) · [Windows 설치 안내](${projectWindowsGuide})\n\n${downloadTable}\n\nWindows x64 and macOS Apple Silicon (arm64) builds from ${context.sha}.\n\nBoth platforms passed automated tests and native packaging checks. Real-machine installation/upgrade testing remains required.\n\nWindows code signing: ${windowsSigning}. SmartScreen may warn.\nmacOS app signing: ${macosSigning.kind}; notarization ticket: ${macosSigning.notarizationTicket.status}; Gatekeeper: ${macosSigning.gatekeeper.status}. The installer is unsigned. See the DMG installation guide before first launch.\n\nBuild: ${context.serverUrl}/${owner}/${repo}/actions/runs/${context.runId}`,
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
  core.info(`Published desktop prerelease: ${published.html_url}`);
  return published.html_url;
}
