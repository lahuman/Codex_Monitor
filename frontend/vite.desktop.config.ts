import { fileURLToPath } from "node:url";
import { mergeConfig } from "vite";
import base from "./vite.config.ts";
export default mergeConfig(base, {
  root: fileURLToPath(new URL("./desktop", import.meta.url)),
  publicDir: fileURLToPath(new URL("./public", import.meta.url)),
  build: {
    outDir: fileURLToPath(
      new URL("../desktop/dashboard-dist", import.meta.url),
    ),
    emptyOutDir: true,
  },
});
