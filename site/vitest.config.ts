import { defineConfig, mergeConfig } from "vitest/config";
import site from "./vite.config.ts";

export default mergeConfig(
  site,
  defineConfig({
    test: {
      include: ["src/**/*.test.ts"],
    },
  }),
);
