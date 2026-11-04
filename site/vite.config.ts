import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { siteShell } from "@mark1russell7/site-pages/vite";
import { defineConfig, type Plugin } from "vite";

const source = fileURLToPath(new URL("../src", import.meta.url));

/**
 * The source of the package imports its modules as `./types.js`, and only `.ts` files exist before a build. This plugin
 * gives each such import its `.ts` file, for the files in `src/` only.
 */
const packageSource: Plugin = {
  name: "logger-package-source",
  enforce: "pre",
  resolveId(id, importer) {
    if (importer === undefined || !id.startsWith("./") || !id.endsWith(".js")) return undefined;
    const from = dirname(importer.split("?")[0] ?? importer);
    return resolve(from) === resolve(source) ? resolve(source, `${id.slice(0, -".js".length)}.ts`) : undefined;
  },
};

// The site has one page: the live console, how it works, the API and the install. The deploy adds `status/` and `releases/`.
// The name of the package resolves to its source, so the page runs the code of `src/`, with no build of the package first.
export default defineConfig({
  plugins: [siteShell({ themeKey: "logger-theme" }), packageSource],
  resolve: { alias: { "@mark1russell7/logger": resolve(source, "index.ts") } },
});
