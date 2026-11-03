import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

// The Pages workflow sets SITE_BASE to "/Logger". A local build uses the root.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const base = env["SITE_BASE"] ? `${env["SITE_BASE"].replace(/\/$/, "")}/` : "/";
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")) as { version: string };

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
  base,
  build: { target: "es2022" },
  plugins: [packageSource],
  resolve: { alias: { "@mark1russell7/logger": resolve(source, "index.ts") } },
  define: {
    __BUILD__: JSON.stringify({ sha: (env["GITHUB_SHA"] ?? "local").slice(0, 7), date: new Date().toISOString().slice(0, 10), version: pkg.version }),
  },
});
