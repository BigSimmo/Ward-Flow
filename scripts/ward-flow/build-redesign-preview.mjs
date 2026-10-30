#!/usr/bin/env node
/**
 * Builds the shareable copy of the redesign mock-ups (`/mockups/ward-flow-redesign`) from the same
 * React components, so the link Josh shares shows exactly what the route shows.
 *
 *     node scripts/ward-flow/build-redesign-preview.mjs [--out <dir>]
 *
 * Writes `index.html` (the viewer), `frame.html` (one page), `preview.js`, `preview.css` and the two
 * Geist fonts to `<dir>` (default `output/redesign-preview/`, git-ignored). Offline: no network, no
 * provider. The app's global stylesheet is compiled with the repository's own Tailwind and
 * PostCSS, and Next's routing parts are swapped for small stand-ins in
 * `scripts/ward-flow/redesign-preview/`.
 */
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = process.cwd();
const outIndex = process.argv.indexOf("--out");
const out = path.resolve(root, outIndex > 0 ? process.argv[outIndex + 1] : "output/redesign-preview");
const shims = path.join(root, "scripts/ward-flow/redesign-preview");

await mkdir(out, { recursive: true });

const result = await build({
  entryPoints: [path.join(shims, "static-entry.tsx")],
  bundle: true,
  outfile: path.join(out, "preview.js"),
  format: "esm",
  platform: "browser",
  target: "es2022",
  jsx: "automatic",
  // Readable CSS module class names (file_class), so the mock-ups' scoped stylesheets, which match
  // classes by name, apply in the shareable copy as they do in the dev server.
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  splitting: false,
  sourcemap: false,
  tsconfig: path.join(root, "tsconfig.json"),
  loader: { ".module.css": "local-css", ".css": "css", ".woff2": "file", ".svg": "file", ".png": "file" },
  alias: {
    "next/navigation": path.join(shims, "next-navigation.ts"),
    "next/link": path.join(shims, "next-link.tsx"),
    "next/dynamic": path.join(shims, "next-dynamic.tsx"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED": '"false"',
  },
  banner: { js: "globalThis.process = globalThis.process || { env: {} };" },
  logLevel: "warning",
  logOverride: { "undefined-composes-from": "silent" },
  metafile: true,
});

const globalCss = await postcss([tailwind({ base: root })]).process(
  `${await readFile(path.join(root, "src/app/globals.css"), "utf8")}\n${await readFile(
    path.join(root, "src/app/ward-flow-v9-tokens.css"),
    "utf8",
  )}`,
  { from: path.join(root, "src/app/globals.css") },
);
const fonts = `
@font-face { font-family: "Geist"; src: url("geist-latin.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
@font-face { font-family: "Geist Mono"; src: url("geist-mono-latin.woff2") format("woff2"); font-weight: 100 900; font-display: swap; }
html[class] { --font-geist-sans: "Geist"; --font-geist-mono: "Geist Mono"; }
`;
await writeFile(path.join(out, "global.css"), `${globalCss.css}\n${fonts}`);
await copyFile(path.join(root, "src/fonts/geist-latin.woff2"), path.join(out, "geist-latin.woff2"));
await copyFile(path.join(root, "src/fonts/geist-mono-latin.woff2"), path.join(out, "geist-mono-latin.woff2"));

const page = (title) => `<!doctype html>
<html lang="en-AU" class="h-full antialiased ckb-v2">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${title}</title>
<link rel="stylesheet" href="global.css">
<link rel="stylesheet" href="preview.css">
</head>
<body class="min-h-full flex flex-col">
<div id="root"></div>
<script type="module" src="preview.js"></script>
</body>
</html>
`;
await writeFile(path.join(out, "index.html"), page("Ward Flow Redesign"));
await writeFile(path.join(out, "frame.html"), page("Ward Flow Redesign Page"));

const bytes = Object.values(result.metafile.outputs).reduce((sum, output) => sum + output.bytes, 0);
console.log(
  `Redesign preview written to ${path.relative(root, out)} (${Math.round(bytes / 1024)} KB of script and styles).`,
);
