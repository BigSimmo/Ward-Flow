import { build } from "esbuild";
import { fileURLToPath } from "node:url";
await build({
  entryPoints: [fileURLToPath(new URL("./engine.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("./dist/engine.mjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: fileURLToPath(new URL("../../tsconfig.json", import.meta.url)),
});
console.log("Ward Flow shared engine bundled");
