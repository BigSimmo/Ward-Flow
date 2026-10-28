#!/usr/bin/env node
/** Docs-only preparation for P11. Output is explicit and remains a draft until app-source adoption. */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const guideRoot = path.join(root, "docs/ward-flow/desk-guides");
const CHEAT_SHEET_DOCS = {
  coordinator: ["flow-coordinator.md", "Bed coordinator"],
  bed_manager: ["site-bed-manager.md", "Bed manager"],
  ward: ["ward.md", "Ward"],
  ed: ["emergency-department.md", "ED mental health clinician"],
  community: ["community-team.md", "Community clinician"],
  officer: ["transport-officer.md", "Transport officer"],
  executive: ["executive.md", "Executive"],
  admin: ["access-admin.md", "Access admin"],
  tv: ["tv-board.md", "TV board"],
};

function plain(text) {
  return text.replaceAll("**", "").replaceAll("`", "").replace(/\s+/gu, " ").trim();
}

/** Continuation lines belong to their list item; a following heading never does. */
export function guideSection(markdown, heading) {
  const sections = markdown.split(/^## /mu).slice(1);
  return (
    sections
      .find((section) => section.split("\n")[0] === heading)
      ?.split("\n")
      .slice(1)
      .join("\n")
      .trim() ?? ""
  );
}

export function guideList(section) {
  const items = [];
  for (const line of section.split("\n")) {
    const item = /^(?:\d+\.|-)\s+(.+)$/u.exec(line);
    if (item) items.push(plain(item[1]));
    else if (/^\s+\S/u.test(line) && items.length) items[items.length - 1] += ` ${plain(line)}`;
  }
  return items;
}

export function readDraftCheatSheets(directory = guideRoot) {
  const directoryIndex = readFileSync(path.join(directory, "README.md"), "utf8");
  const accessibility = readFileSync(path.join(directory, "accessibility.md"), "utf8");
  const legend = guideList(guideSection(accessibility, "The colour code works without colour"));
  const interactions = readFileSync(path.join(directory, "interactions.md"), "utf8");
  const shortcuts = interactions
    .split("\n")
    .filter((line) => /^\|/u.test(line))
    .slice(2)
    .map((line) => {
      const [, key, action] = line.split("|");
      return `${plain(key)}: ${plain(action)}`;
    });
  if (legend.length !== 6 || shortcuts.length !== 8)
    throw new Error("The shared legend or shortcut table changed; review the draft builder.");
  return Object.entries(CHEAT_SHEET_DOCS).map(([id, [file, title]]) => {
    const directoryRow = directoryIndex.split("\n").find((line) => line.includes(`](${file})`));
    const homeName = directoryRow?.split("|")[3]?.trim();
    if (!homeName) throw new Error(`Missing home screen for ${file}`);
    const markdown = readFileSync(path.join(directory, file), "utf8");
    const jobs = guideList(guideSection(markdown, id === "tv" ? "Running the meeting" : "Jobs you do most")).slice(
      0,
      3,
    );
    const limits = guideList(guideSection(markdown, id === "tv" ? "What it cannot do" : "What you cannot do"));
    if (!jobs.length || !limits.length) throw new Error(`Missing jobs or limits in ${file}`);
    return { id, title, homeName, source: file, jobs, limits, legend, shortcuts };
  });
}

export function cheatSheetMarkdown(sheet) {
  return [
    `# ${sheet.title}`,
    "",
    `<!-- Draft from ${sheet.source}; app-source adoption pending. -->`,
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
<body><main><header><h1>${escapeHtml(sheet.title)}</h1><p>Ward Flow · ${escapeHtml(sheet.homeName)}</p></header><p class="draft">Draft from the desk guide; app-source adoption pending. Print on A4 at 100%.</p><div class="columns"><div><section><h2>Jobs you do most</h2>${list(sheet.jobs, true)}</section><section><h2>What you cannot do</h2>${list(sheet.limits)}</section></div><div><section><h2>Colour code</h2>${list(sheet.legend)}</section><section><h2>Keyboard shortcuts</h2>${list(sheet.shortcuts)}</section></div></div><footer><p>Prototype on synthetic data. Not for real patients.</p></footer></main></body></html>`;
}

export function writeDraftCheatSheets(output, directory = guideRoot) {
  const sheets = readDraftCheatSheets(directory);
  const manifestPath = path.join(output, ".ward-help-drafts.json");
  const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : undefined;
  if (existsSync(output) && readdirSync(output).length && previous?.format !== "wardflow-help-drafts-v1")
    throw new Error("Output directory contains files not owned by this draft builder; choose an empty directory.");
  const hash = (text) => createHash("sha256").update(text).digest("hex");
  const documents = sheets.flatMap((sheet) => [
    [`${sheet.id}.md`, cheatSheetMarkdown(sheet)],
    [`${sheet.id}.html`, cheatSheetHtml(sheet)],
  ]);
  for (const [name] of documents) {
    const file = path.join(output, name);
    if (existsSync(file) && (!previous?.files?.[name] || hash(readFileSync(file)) !== previous.files[name]))
      throw new Error(`Preserving a changed or unowned output: ${name}`);
  }
  mkdirSync(output, { recursive: true });
  for (const [name, content] of documents) writeFileSync(path.join(output, name), content);
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        format: "wardflow-help-drafts-v1",
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
  if (flag !== "--output" || !output || extra.length) {
    console.error("Usage: node scripts/build-help-cheat-sheets.mjs --output <draft-directory>");
    process.exitCode = 1;
  } else
    console.log(
      `Prepared ${writeDraftCheatSheets(path.resolve(output))} draft role guides in ${path.resolve(output)}.`,
    );
}
