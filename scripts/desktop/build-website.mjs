import {
  projectRepository,
  projectWebsite,
} from "../../desktop/scripts/project-links.mjs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../", import.meta.url));
if (process.argv.length > 3)
  throw new Error(
    "Usage: node scripts/desktop/build-website.mjs [output-directory]",
  );
const output = path.resolve(process.argv[2] ?? path.join(root, "site"));
const config = JSON.parse(
  await readFile(path.join(root, "desktop/src-tauri/tauri.conf.json"), "utf8"),
);
const template = await readFile(path.join(root, "website/index.html"), "utf8");
if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(config.version))
  throw new Error("Invalid website version");
const html = template
  .replaceAll("{{VERSION}}", config.version)
  .replaceAll("{{REPO}}", projectRepository)
  .replaceAll("{{SITE}}", projectWebsite);
if (/\{\{[A-Z_]+\}\}/.test(html))
  throw new Error("Unresolved website template value");
await mkdir(output, { recursive: true });
await cp(path.join(root, "website/assets"), path.join(output, "assets"), {
  recursive: true,
});
await cp(
  path.join(root, "desktop/branding/icon.svg"),
  path.join(output, "assets/icon.svg"),
);
await writeFile(path.join(output, "index.html"), html);
await writeFile(path.join(output, ".nojekyll"), "");
console.log(`Project website: ${output}`);
