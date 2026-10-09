import { fileURLToPath } from "node:url";
import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

// Performance benchmarks only (`npm run bench`). Kept apart from vitest.config.mts so the unit
// suite, its projects and coverage floors are untouched. The CodSpeed plugin is inert outside a
// CodSpeed run, so `npm run bench` also works as a plain local `vitest bench`.
export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    environment: "node",
    benchmark: {
      include: ["bench/**/*.bench.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
});
