#!/usr/bin/env node
/** Offline local-link checks. Default Ward tree includes history. Explicit --file
 * selections exclude paired historical sections. --anchors checks supported
 * Markdown headings. No web/provider access; imports never scan the checkout. */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripHistoricalSections } from "../check-docs-script-refs.mjs";

const PROJECT_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const EXTERNAL_BY_DESIGN = new Set(["../../../development-system.md", "../../../../.claude/worktree-ownership.md"]);

function within(root, file) {
  const rel = relative(root, file);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}

/** Preserve line positions while excluding fenced/inline examples. */
export function withoutCode(source, inline = true) {
  let fence = null;
  const unfenced = source
    .split("\n")
    .map((line) => {
      const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (fence) {
        if (
          marker &&
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length &&
          /^\s*$/.test(line.slice(marker[0].length))
        )
          fence = null;
        return " ".repeat(line.length);
      }
      if (marker) {
        fence = marker[1];
        return " ".repeat(line.length);
      }
      return line;
    })
    .join("\n");
  if (!inline) return unfenced;
  const runs = [...unfenced.matchAll(/`+/g)];
  // Code spans may cross LF boundaries; only an equal-length backtick run closes one.
  // Use UTF-16 offsets, matching regex indices, and retain newlines for diagnostics.
  const masked = unfenced.split("");
  for (let i = 0; i < runs.length; i++) {
    const close = runs.findIndex((run, index) => index > i && run[0].length === runs[i][0].length);
    if (close < 0) continue;
    for (let position = runs[i].index; position < runs[close].index + runs[close][0].length; position++) {
      if (masked[position] !== "\n") masked[position] = " ";
    }
    i = close;
  }
  return masked.join("");
}

/** Supported ATX/setext headings and explicit HTML anchor/heading IDs. */
export function headingIds(source) {
  const ids = new Set();
  const counts = new Map();
  const lines = withoutCode(source, false).split("\n");
  const htmlLines = withoutCode(source).split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const match of htmlLines[i].matchAll(/<(?:a|[hH][1-6])\b[^>]*\bid=["']([^"']+)["'][^>]*>/g)) ids.add(match[1]);
    const atx = lines[i].match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    const setext = i + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/.test(lines[i + 1]) && lines[i].trim();
    if (!atx && !setext) continue;
    const text = (atx ? atx[1] : lines[i].trim())
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<[^>]*>/g, "")
      .replace(/[`*~]/g, "")
      .replace(/\\([\\!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~])/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, "")
      .replace(/\s/g, "-");
    let slug = text;
    let count = counts.get(text) ?? 0;
    while (ids.has(slug)) slug = `${text}-${++count}`;
    counts.set(text, count);
    ids.add(slug);
    if (setext && !atx) i++;
  }
  return ids;
}

/** Inline destinations with angle paths, quoted titles and balanced parentheses. */
export function inlineLinks(source) {
  const text = withoutCode(source);
  const links = [];
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== "[" || text[start - 1] === "\\") continue;
    let depth = 1;
    let end = start + 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === "\\") {
        end++;
        continue;
      }
      if (text[end] === "[") depth++;
      if (text[end] === "]") depth--;
    }
    if (depth || text[end] !== "(") continue;
    let i = end + 1;
    while (i < text.length && /\s/.test(text[i])) i++;
    let raw = "";
    if (text[i] === "<") {
      const end = text.indexOf(">", i + 1);
      if (end === -1) continue;
      raw = text.slice(i + 1, end);
      i = end + 1;
    } else {
      let pathDepth = 0;
      for (; i < text.length; i++) {
        const char = text[i];
        if (char === "\\" && i + 1 < text.length) {
          raw += text[++i];
          continue;
        }
        if (char === "(") pathDepth++;
        if (char === ")") {
          if (!pathDepth) break;
          pathDepth--;
        }
        if (/\s/.test(char) && !pathDepth) break;
        raw += char;
      }
    }
    if (raw && /^\s*(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\))?\s*\)/.test(text.slice(i)))
      links.push({ raw, line: text.slice(0, start).split("\n").length });
    start = end;
  }
  return links;
}

export function checkLinksIn(file, source, { anchors = false, root = PROJECT_ROOT } = {}) {
  const broken = [];
  const advisory = [];
  for (const { raw, line } of inlineLinks(source)) {
    if (/^file:/i.test(raw)) {
      advisory.push({ file, line, target: raw, reason: "nonportable file evidence" });
      continue;
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(raw) || raw.startsWith("//")) continue;
    if (
      relative(root, file).replaceAll("\\", "/") === "docs/ward-flow/lessons/MEMORY.md" &&
      EXTERNAL_BY_DESIGN.has(raw)
    )
      continue;
    let target;
    let fragment;
    try {
      const split = raw.indexOf("#");
      target = decodeURIComponent((split < 0 ? raw : raw.slice(0, split)).split("?")[0]);
      fragment = split < 0 ? "" : decodeURIComponent(raw.slice(split + 1));
    } catch {
      broken.push({ file, line, target: raw, reason: "invalid URI encoding" });
      continue;
    }
    const resolved = target ? resolve(dirname(file), target) : file;
    if (!within(root, resolved) || !existsSync(resolved)) {
      broken.push({ file, line, target: raw, reason: within(root, resolved) ? "missing path" : "outside repository" });
      continue;
    }
    if (!within(realpathSync(root), realpathSync(resolved))) {
      broken.push({ file, line, target: raw, reason: "outside repository" });
      continue;
    }
    if (!anchors || !fragment) continue;
    if (extname(resolved).toLowerCase() !== ".md") {
      advisory.push({
        file,
        line,
        target: raw,
        reason: /^L\d+(?:-L?\d+)?$/.test(fragment)
          ? "code line reference (bounds not checked)"
          : "non-Markdown anchor not checked",
      });
      continue;
    }
    const contents = resolved === file ? source : readFileSync(resolved, "utf8");
    if (!headingIds(contents).has(fragment))
      broken.push({ file, line, target: raw, reason: "missing supported heading/ID" });
  }
  return { broken, advisory };
}

export function brokenLinksIn(file, source) {
  return checkLinksIn(file, source).broken;
}

function markdownFiles(dir, root, out = []) {
  if (!within(realpathSync(root), realpathSync(dir)))
    throw new Error(`Selected documentation directory is outside repository: ${dir}`);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in selected documentation tree: ${file}`);
    if (entry.isDirectory()) markdownFiles(file, root, out);
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      if (!within(realpathSync(root), realpathSync(file)))
        throw new Error(`Selected documentation file is outside repository: ${file}`);
      out.push(file);
    }
  }
  return out;
}

export function selectFiles(args, root = PROJECT_ROOT) {
  const selected = [];
  let anchors = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--anchors") {
      anchors = true;
      continue;
    }
    if (args[i] !== "--file" || !args[i + 1])
      throw new Error("Usage: check-doc-links.mjs [--anchors] [--file <repo-relative.md> ...]");
    const name = args[++i];
    const file = resolve(root, name);
    if (isAbsolute(name) || !within(root, file) || extname(file).toLowerCase() !== ".md")
      throw new Error(`Invalid selected Markdown path: ${name}`);
    if (!within(realpathSync(root), realpathSync(file)) || !statSync(file).isFile())
      throw new Error(`Selected path is not a repository file: ${name}`);
    selected.push(file);
  }
  return {
    files: selected.length ? [...new Set(selected)] : markdownFiles(join(root, "docs/ward-flow"), root),
    explicit: selected.length > 0,
    anchors,
  };
}

export function main(args = process.argv.slice(2), root = PROJECT_ROOT) {
  const selection = selectFiles(args, root);
  const broken = [];
  const advisory = [];
  for (const file of selection.files) {
    const original = readFileSync(file, "utf8");
    const source = selection.explicit ? stripHistoricalSections(original) : original;
    const result = checkLinksIn(file, source, { root, anchors: selection.anchors });
    broken.push(...result.broken);
    advisory.push(...result.advisory);
  }
  console.log(
    `Scanned ${selection.files.length} Markdown file(s): ${selection.explicit ? "explicit maintained files (historical sections excluded)" : "docs/ward-flow tree (including history)"}; anchors ${selection.anchors ? "enabled" : "disabled"}.`,
  );
  for (const item of broken)
    console.error(`${relative(root, item.file).replaceAll("\\", "/")}:${item.line} -> ${item.target} (${item.reason})`);
  for (const item of advisory)
    console.log(
      `ADVISORY ${relative(root, item.file).replaceAll("\\", "/")}:${item.line} -> ${item.target} (${item.reason})`,
    );
  console.log(
    `${broken.length} broken local link(s); ${advisory.length} advisory reference(s). Web URLs, reference-style links and renderer extensions are not validated; headings support ATX/setext and explicit HTML IDs. A pass does not establish semantic freshness.`,
  );
  return broken.length ? 1 : 0;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`doc-link check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
