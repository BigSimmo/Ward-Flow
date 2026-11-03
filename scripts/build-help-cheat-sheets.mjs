#!/usr/bin/env node
/** P11: deterministic printable guides generated from the in-app Help source. */
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/** Load the app's typed content with the project's existing build tool, without a browser or provider. */
export async function readCheatSheets() {
  const { tsImport } = await import("tsx/esm/api");
  const contentModule = await tsImport(
    pathToFileURL(path.join(root, "src/components/ward-management/help-content/ward-help-print.ts")).href,
    {
      parentURL: import.meta.url,
      tsconfig: path.join(root, "tsconfig.json"),
    },
  );
  return contentModule.printHelpGuides();
}

/** The one-page screen guides (2 Nov 2026), from the same source as Show me around. */
export async function readScreenGuides() {
  const { tsImport } = await import("tsx/esm/api");
  const contentModule = await tsImport(
    path.join(root, "src/components/ward-management/help-content/ward-help-print.ts"),
    {
      parentURL: import.meta.url,
      tsconfig: path.join(root, "tsconfig.json"),
    },
  );
  return contentModule.printScreenGuides();
}

export function screenGuideMarkdown(guide) {
  return [
    `# ${guide.title}`,
    "",
    `<!-- Generated from ${guide.source}; do not edit by hand. -->`,
    "",
    guide.purpose,
    "",
    "## What is on the screen",
    "",
    ...guide.parts.map((text, index) => `${index + 1}. ${text}`),
    "",
    ...(guide.onPhone.length ? ["## On a phone", "", ...guide.onPhone.map((text) => `- ${text}`), ""] : []),
    ...(guide.jobs.length ? ["## Jobs done here", "", ...guide.jobs.map((text) => `- ${text}`), ""] : []),
    "In Ward Flow, open Help and choose Show me around this screen to see each part lit in turn.",
    "",
    "_Prototype on synthetic data. Not for real patients._",
    "",
  ].join("\n");
}

export function cheatSheetMarkdown(sheet) {
  return [
    `# ${sheet.title}`,
    "",
    `<!-- Generated from ${sheet.source}; do not edit by hand. -->`,
    "",
    "## Where you start",
    "",
    sheet.homeName,
    "",
    "## Jobs you do most",
    "",
    ...sheet.jobs.map((text, index) => `${index + 1}. ${text}`),
    "",
    "## What you cannot do",
    "",
    ...sheet.limits.map((text) => `- ${text}`),
    "",
    "## Colour code",
    "",
    ...sheet.legend.map((text) => `- ${text}`),
    "",
    "## Keyboard shortcuts",
    "",
    ...sheet.shortcuts.map((text) => `- ${text}`),
    "",
    "_Prototype on synthetic data. Not for real patients._",
    "",
  ].join("\n");
}

const escapeHtml = (text) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function cheatSheetHtml(sheet) {
  const list = (items, numbered = false) =>
    `<${numbered ? "ol" : "ul"}>${items.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</${numbered ? "ol" : "ul"}>`;
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(sheet.title)} — Ward Flow</title>
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:11pt/1.35 Arial,sans-serif;color:CanvasText;background:Canvas}main{max-width:182mm;margin:auto}h1{font-size:21pt;margin:0 0 3mm}h2{font-size:12pt;margin:5mm 0 2mm}header{border-bottom:1pt solid;padding-bottom:3mm}header p,footer p{margin:0}li{margin-bottom:2.5mm}ul,ol{padding-left:5mm;margin:0}.columns{display:grid;grid-template-columns:1.35fr 1fr;gap:9mm}section,li{break-inside:avoid}footer{border-top:.5pt solid;margin-top:5mm;padding-top:3mm;font-size:10pt}.draft{font-size:10pt}@media screen{body{padding:5mm}.draft{padding:2mm 0}}@media screen and (max-width:600px){.columns{grid-template-columns:1fr}}@media print{.draft{display:none}}</style></head>
<body><main><header><h1>${escapeHtml(sheet.title)}</h1><p>Ward Flow · ${escapeHtml(sheet.homeName)}</p></header><p class="draft">Print on A4 at 100%. Use your browser’s Print command.</p><div class="columns"><div><section><h2>Jobs you do most</h2>${list(sheet.jobs, true)}</section><section><h2>What you cannot do</h2>${list(sheet.limits)}</section></div><div><section><h2>Colour code</h2>${list(sheet.legend)}</section><section><h2>Keyboard shortcuts</h2>${list(sheet.shortcuts)}</section></div></div><footer>
<p>Prototype on synthetic data. Not for real patients.</p>
</footer></main></body></html>`;
}

export function screenGuideHtml(guide) {
  const list = (items, numbered = false) =>
    `<${numbered ? "ol" : "ul"}>${items.map((text) => `<li>${escapeHtml(text)}</li>`).join("")}</${numbered ? "ol" : "ul"}>`;
  const section = (title, items, numbered) =>
    items.length ? `<section><h2>${escapeHtml(title)}</h2>${list(items, numbered)}</section>` : "";
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(guide.title)} screen — Ward Flow</title>
<style>@page{size:A4;margin:14mm}*{box-sizing:border-box}body{margin:0;font:11pt/1.35 Arial,sans-serif;color:CanvasText;background:Canvas}main{max-width:182mm;margin:auto}h1{font-size:21pt;margin:0 0 3mm}h2{font-size:12pt;margin:5mm 0 2mm}header{border-bottom:1pt solid;padding-bottom:3mm}header p,footer p{margin:0}li{margin-bottom:2.5mm}ul,ol{padding-left:5mm;margin:0}section,li{break-inside:avoid}footer{border-top:.5pt solid;margin-top:5mm;padding-top:3mm;font-size:10pt}.draft{font-size:10pt}@media screen{body{padding:5mm}.draft{padding:2mm 0}}@media print{.draft{display:none}}</style></head>
<body><main><header><h1>${escapeHtml(guide.title)}</h1><p>Ward Flow · ${escapeHtml(guide.purpose)}</p></header><p class="draft">Print on A4 at 100%. Use your browser’s Print command.</p>${section("What is on the screen", guide.parts, true)}${section("On a phone", guide.onPhone)}${section("Jobs done here", guide.jobs)}<footer>
<p>In Ward Flow, open Help and choose Show me around this screen to see each part lit in turn.</p>
<p>Prototype on synthetic data. Not for real patients.</p>
</footer></main></body></html>`;
}

/** Writes the screen guides to `output` (their own folder and manifest), or checks them. */
export async function writeScreenGuides(output, guides, check = false) {
  return writeDocuments(output, guides, check, "wardflow-help-screen-guides-v1", (guide) => [
    [`${guide.id}.md`, screenGuideMarkdown(guide)],
    [`${guide.id}.html`, screenGuideHtml(guide)],
  ]);
}

export async function writeCheatSheets(output, sheets, check = false) {
  return writeDocuments(output, sheets, check, "wardflow-help-guides-v1", (sheet) => [
    [`${sheet.id}.md`, cheatSheetMarkdown(sheet)],
    [`${sheet.id}.html`, cheatSheetHtml(sheet)],
  ]);
}

async function writeDocuments(output, sheets, check, formatName, render) {
  const { format, resolveConfig } = await import("prettier");
  const options = await resolveConfig(path.join(root, "package.json"));
  const manifestPath = path.join(output, ".ward-help-guides.json");
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
  if (
    existsSync(output) &&
    // The screen guides' own folder sits inside the desk guides' folder; anything else counts.
    readdirSync(output).some((name) => !(name === "screens" && lstatSync(path.join(output, name)).isDirectory())) &&
    previous?.format !== formatName
  )
    throw new Error("Output directory contains files not owned by this guide builder; choose an empty directory.");
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const rawDocuments = sheets.flatMap(render);
  const documents = await Promise.all(
    rawDocuments.map(async ([name, content]) => [
      name,
      await format(content, { ...options, parser: name.endsWith(".html") ? "html" : "markdown" }),
    ]),
  );
  for (const [name] of documents) {
    const file = path.join(output, name);
    if (existsSync(file) && (!previous?.files?.[name] || hash(readFileSync(file)) !== previous.files[name]))
      throw new Error(`Preserving a changed or unowned output: ${name}`);
  }
  if (check) {
    for (const [name, content] of documents)
      if (!existsSync(path.join(output, name)) || readFileSync(path.join(output, name), "utf8") !== content)
        throw new Error(`Regenerate printable Help guide: ${name}`);
    return sheets.length;
  }
  mkdirSync(output, { recursive: true });
  for (const [name, content] of documents) writeFileSync(path.join(output, name), content);
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        format: formatName,
        files: Object.fromEntries(documents.map(([name, content]) => [name, hash(content)])),
      },
      null,
      2,
    ) + "\n",
  );
  return sheets.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , flag, output, ...extra] = process.argv;
  const check = extra.length === 1 && extra[0] === "--check";
  if (flag !== "--output" || !output || (extra.length && !check)) {
    console.error("Usage: node scripts/build-help-cheat-sheets.mjs --output <directory> [--check]");
    process.exitCode = 1;
  } else {
    console.log(
      `${check ? "Checked" : "Generated"} ${await writeCheatSheets(path.resolve(output), await readCheatSheets(), check)} role guides in ${path.resolve(output)}.`,
    );
    const screens = path.join(path.resolve(output), "screens");
    console.log(
      `${check ? "Checked" : "Generated"} ${await writeScreenGuides(screens, await readScreenGuides(), check)} screen guides in ${screens}.`,
    );
  }
}
