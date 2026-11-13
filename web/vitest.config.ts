import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // PGlite boots a WASM Postgres; the first boot in a worker can take a few seconds.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
