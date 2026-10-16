#!/usr/bin/env node
/**
 * AUD-A11Y-02 / TASK-L6-07: Static Regression Guard for Explanatory Disabled Buttons.
 *
 * Ensures no `<button>` element in Ward Flow combines a native `disabled` attribute with
 * `aria-describedby`.
 *
 * Why this matters:
 * - A native HTML `disabled` attribute removes the button from the keyboard Tab order (`tabIndex`
 *   becomes unreachable), so screen-reader and keyboard-only clinicians can never focus the
 *   button to hear the `aria-describedby` explanation of why the action is unavailable.
 * - Ward Flow's accessibility contract (PR #299) requires unavailable buttons that carry an
 *   explanatory description (`aria-describedby`) to remain focusable via `aria-disabled="true"`
 *   paired with `ignoreUnavailableActivation` (from `@/components/ui-primitives`) or an explicit
 *   click guard.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SCAN_ROOTS = ["src/components/ward-management", "src/app/mockups/ward-flow"];

/**
 * Strips line and block comments while preserving string literals and newline offsets so that
 * URLs like `"https://..."` inside attributes are not mistaken for line comments and reported
 * line numbers remain exact.
 */
function stripCommentsPreservingLines(source) {
  let out = "";
  let i = 0;
  let quote = null;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (quote !== null) {
      out += ch;
      if (ch === "\\" && i + 1 < source.length) {
        out += source[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }

    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) {
        out += source[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < source.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }

    out += ch;
    i += 1;
  }

  return out;
}

/**
 * Masks the contents of `{...}` JSX expressions and quoted attribute values inside a `<button ...>`
 * opening tag so that JavaScript identifiers like `aria-disabled={ disabled }` or
 * `className={clsx(styles.btn, disabled && styles.off)}` are never mistaken for a top-level native
 * `disabled` attribute on `<button>`.
 */
function maskAttrValueBodies(tagText) {
  let masked = "";
  let i = 0;
  let braceDepth = 0;
  let quote = null;

  while (i < tagText.length) {
    const ch = tagText[i];

    if (quote !== null) {
      if (ch === "\\" && i + 1 < tagText.length) {
        masked += "  ";
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        masked += ch;
      } else {
        masked += ch === "\n" ? "\n" : " ";
      }
      i += 1;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      masked += braceDepth > 0 ? " " : ch;
      i += 1;
      continue;
    }

    if (ch === "{") {
      if (braceDepth === 0) masked += "{";
      else masked += " ";
      braceDepth += 1;
      i += 1;
      continue;
    }

    if (ch === "}") {
      if (braceDepth > 0) braceDepth -= 1;
      if (braceDepth === 0) masked += "}";
      else masked += " ";
      i += 1;
      continue;
    }

    if (braceDepth > 0) {
      masked += ch === "\n" ? "\n" : " ";
    } else {
      masked += ch;
    }
    i += 1;
  }

  return masked;
}

/**
 * Explicit allowlist for shared-workspace demo-off controls (PR #342, pinned by
 * `tests/ward-demo-controls-shared-off.dom.test.tsx` with `.toBeDisabled()`) where the
 * `DEMO_CONTROLS_OFF` notice is rendered as an always-visible section `<p>` banner directly
 * above the button group rather than a hidden `.sr-only` tooltip.
 */
const VISIBLE_BANNER_ALLOWLIST = [
  {
    file: "src/components/ward-management/demo-reset/ward-demo-reset.tsx",
    testIdPattern: /data-testid=\{`ward-demo-reset-\$\{choice\}`\}/,
  },
  {
    file: "src/components/ward-management/ward-global-search.tsx",
    testIdPattern: /data-testid="ward-global-search-cmd-advance-clock"/,
  },
];

/**
 * Extracts JSX `<button ...>` opening tags (handling nested `{...}` expressions inside props)
 * and checks whether any tag combines a native `disabled` attribute with `aria-describedby`.
 *
 * @param {string} source
 * @param {string} [filePath="<inline>"]
 * @returns {Array<{ file: string; line: number; snippet: string }>}
 */
export function findExplanatoryDisabledButtonViolations(source, filePath = "<inline>") {
  const cleaned = stripCommentsPreservingLines(source);
  const violations = [];
  const tagStartRegex = /<button\b/g;
  let match;

  while ((match = tagStartRegex.exec(cleaned)) !== null) {
    const startIdx = match.index;
    let idx = startIdx + "<button".length;
    let braceDepth = 0;
    let quoteChar = null;
    let endIdx = -1;

    while (idx < cleaned.length) {
      const ch = cleaned[idx];
      const prev = idx > 0 ? cleaned[idx - 1] : "";

      if (quoteChar !== null) {
        if (ch === quoteChar && prev !== "\\") {
          quoteChar = null;
        }
      } else if (ch === '"' || ch === "'" || ch === "`") {
        quoteChar = ch;
      } else if (ch === "{") {
        braceDepth += 1;
      } else if (ch === "}") {
        if (braceDepth > 0) braceDepth -= 1;
      } else if (ch === ">" && braceDepth === 0) {
        endIdx = idx + 1;
        break;
      }
      idx += 1;
    }

    if (endIdx === -1) continue;

    const tagText = cleaned.slice(startIdx, endIdx);
    const rawTag = source.slice(startIdx, endIdx);
    const isAllowlisted = VISIBLE_BANNER_ALLOWLIST.some(
      (entry) => entry.file === filePath && entry.testIdPattern.test(rawTag),
    );
    if (isAllowlisted) continue;

    const topLevelTag = maskAttrValueBodies(tagText);
    const hasAriaDescribedBy = /(?:^|[\s\n])aria-describedby\s*=/m.test(topLevelTag);
    // Match standalone top-level `disabled` or `disabled={...}`, never `aria-disabled` or `data-disabled`
    // or a `disabled` variable inside `{...}`.
    const hasNativeDisabled = /(?:^|[\s\n])disabled(?:\s*=|\s*[\s/>])/m.test(topLevelTag);

    if (hasAriaDescribedBy && hasNativeDisabled) {
      const line = cleaned.slice(0, startIdx).split("\n").length;
      const snippet = rawTag.replace(/\s+/g, " ").trim();
      violations.push({
        file: filePath,
        line,
        snippet,
      });
    }
  }

  return violations;
}

function walkTsxFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      walkTsxFiles(full, out);
    } else if (extname(entry) === ".tsx") {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scans all `.tsx` files under the Ward Flow roots for explanatory disabled button violations.
 *
 * @param {string} [repoRoot=process.cwd()]
 * @param {string[]} [scanRoots=DEFAULT_SCAN_ROOTS]
 */
export function scanWardExplanatoryButtons(repoRoot = process.cwd(), scanRoots = DEFAULT_SCAN_ROOTS) {
  const files = [];
  for (const root of scanRoots) {
    walkTsxFiles(join(repoRoot, root), files);
  }

  const violations = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");
    violations.push(...findExplanatoryDisabledButtonViolations(content, rel));
  }

  return {
    scannedFiles: files.length,
    violations,
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const { scannedFiles, violations } = scanWardExplanatoryButtons();
  console.log(
    `Scanned ${scannedFiles} Ward Flow .tsx files for <button disabled aria-describedby=...> regressions (AUD-A11Y-02).`,
  );
  if (violations.length > 0) {
    console.error("\nExplanatory disabled button violation(s) found:");
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line} -> ${v.snippet}`);
    }
    console.error(
      "\nUse aria-disabled={...} with ignoreUnavailableActivation instead of native disabled when aria-describedby is present so keyboard users can focus the button to read the explanation.",
    );
    process.exit(1);
  }
  console.log("0 explanatory disabled button violations found.");
}
