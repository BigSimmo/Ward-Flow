import { build } from "esbuild";
await build({
  entryPoints: [new URL("./engine.ts", import.meta.url).pathname],
  outfile: new URL("./dist/engine.mjs", import.meta.url).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: new URL("../../tsconfig.json", import.meta.url).pathname,
});
console.log("Ward Flow shared engine bundled");
