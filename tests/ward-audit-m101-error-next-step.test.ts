// M101 (master audit list, 10 Nov 2026): error messages say what to do.
//
// The checked-in inventory is `docs/ward-flow/evidence/error-message-inventory-2026-11-10.md`. It lists
// every failure message on screen: a full sentence that says something could not be done ("could not",
// "cannot", "failed", "not saved", "unavailable" and so on), with whether it names a next step. This
// test keeps source and inventory equal, and fails when a message with no next step is added.
//
// - A new failure message must be added to the inventory, so a person reads it (the review step).
// - A message with no next step can only be added in place of one that is fixed: the "No" rows are a
//   ratchet capped at NO_NEXT_STEP_BASELINE. Never raise the number to make this pass.
// - Seed narratives and Help content are left out: they describe a patient or explain a limit, and
//   are not failure messages.
//
// Refresh the inventory after a reviewed change with:
//   WARD_WRITE_ERROR_INVENTORY=1 npx vitest run tests/ward-audit-m101-error-next-step.test.ts
// then read the diff. Reads source with `readFileSync`; run it by name.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const INVENTORY = "docs/ward-flow/evidence/error-message-inventory-2026-11-10.md";
/** "No" rows on 10 Nov 2026 (107 once save-problem pairs were read whole). Exact: lower it when one is fixed; never raise it. */
const NO_NEXT_STEP_BASELINE = 107;

const ROOTS = ["src/app", "src/components/wf", "src/components/ward-management"];
/** Not failure messages: seed narratives, Help and tour text, and approved mock-up copies (D-91). */
const LEFT_OUT = /mockups|ward-redesign|\/help\/|-seed\.ts$|ward-movements-referrals\.ts$/;

const FAILURE =
  /\b(could not|couldn['’]t|cannot|can['’]t|failed|did not save|was not saved|not saved|went wrong|is unavailable|are unavailable|was not confirmed|not sent)\b/i;

/**
 * A next step: a sentence or clause that opens with something a person can do. Kept deliberately
 * plain; a message that only says what went wrong ("Rule change not saved.") does not pass.
 */
const NEXT_STEP =
  /(?:^|[.:;!?—–,]\s*|\b(?:then|and|or|so)\s+)(?:please\s+|(?:you\s+|they\s+)?(?:have|need) to\s+)?(?:try|ask|reload|wait|reconnect|sign|contact|check|press|use|choose|enter|open|close|return|select|type|tick|record|review|refresh|go|call|ring|pick|copy|keep|add|remove|start|save|send|confirm|fix|make|clear|turn|allow|move|set|look|undo|finish|change|connect|retry|tap|give|reopen|unlock|put|cancel|restore|switch|continue|see|find|update|upload|print|correct|complete|book|mark|tell|reset|follow|come back)\b/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name).split("\\").join("/");
    if (LEFT_OUT.test(path)) return [];
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [path] : [];
  });
}

/** Visible text as the word-list test reads it: literals, template text and JSX text, never comments. */
function texts(path: string): string[] {
  const kind = path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, false, kind);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    // A save problem is a [what happened, what to do now] pair of sentences shown joined
    // (ward-save-failure.ts `saveProblem`), so the pair is read as the one message it is.
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 2) {
      const [happened, doNow] = node.elements.map((element) =>
        ts.isStringLiteral(element) || ts.isNoSubstitutionTemplateLiteral(element) ? element.text : undefined,
      );
      if (happened && doNow && /[.!]$/.test(happened) && /^[A-Z]/.test(doNow)) {
        found.push(`${happened} ${doNow}`);
        return;
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
      found.push(node.text);
    else if (ts.isTemplateExpression(node))
      found.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("…"));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isFailureMessage(text: string): boolean {
  return /^[A-Z…]/.test(text) && text.includes(" ") && /[.!]$/.test(text) && FAILURE.test(text);
}

function namesNextStep(text: string): boolean {
  return NEXT_STEP.test(text);
}

type Entry = { message: string; nextStep: boolean; files: string[] };

function scan(): Entry[] {
  const byMessage = new Map<string, Set<string>>();
  for (const root of ROOTS)
    for (const path of sourceFiles(root))
      for (const raw of texts(path)) {
        const message = raw.replace(/\s+/g, " ").trim();
        if (!isFailureMessage(message)) continue;
        byMessage.set(message, (byMessage.get(message) ?? new Set()).add(path));
      }
  return [...byMessage]
    .map(([message, files]) => ({ message, nextStep: namesNextStep(message), files: [...files].toSorted() }))
    .toSorted((a, b) => Number(a.nextStep) - Number(b.nextStep) || a.message.localeCompare(b.message));
}

const cell = (text: string) => text.replaceAll("|", "\\|");

function render(entries: Entry[]): string {
  const without = entries.filter((entry) => !entry.nextStep).length;
  return [
    "# Error message inventory, 10 November 2026",
    "",
    "**Audience:** Josh and builders. **Status:** draft for review; generated, then read by a person. **Owner:** Documentation.",
    "",
    "M101 of the master audit list: every failure message on screen, and whether it tells the person what to do next.",
    "`tests/ward-audit-m101-error-next-step.test.ts` keeps this list equal to the source and fails when a message",
    "with no next step is added. Seed narratives, Help and tour text and the approved mock-up copies are left out.",
    "",
    "**Still to do (a person):** read the rows marked No and decide, message by message, which need a next step.",
    "Wording that touches a clinical term is Josh's to approve. The next-step check is a plain word match, so a Yes",
    "is a lead, not proof the step is clear.",
    "",
    `${entries.length} messages; ${without} with no next step found.`,
    "",
    "| Next step | Message | Where |",
    "| --------- | ------- | ----- |",
    ...entries.map(
      (entry) =>
        `| ${entry.nextStep ? "Yes" : "No"} | ${cell(entry.message)} | ${entry.files.map((file) => `\`${file}\``).join(", ")} |`,
    ),
    "",
  ].join("\n");
}

function parseInventory(markdown: string): Entry[] {
  return markdown
    .split("\n")
    .filter((line) => /^\|\s*(?:Yes|No)\s*\|/.test(line))
    .map((line) => {
      // Cells split at pipes that are not escaped; Prettier pads them, so each is trimmed.
      const cells = line
        .trim()
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((part) => part.replaceAll("\\|", "|").trim());
      return {
        nextStep: cells[0] === "Yes",
        message: cells[1]!,
        files: [...cells[2]!.matchAll(/`([^`]+)`/g)].map((match) => match[1]!),
      };
    });
}

describe("M101: error messages say what to do", () => {
  it("tells a next step from a bare failure", () => {
    expect(namesNextStep("This file could not be read. Select it again.")).toBe(true);
    expect(namesNextStep("Could not copy. Check clipboard access and try again.")).toBe(true);
    expect(namesNextStep("Your last change was not confirmed. The board is up to date. Press Retry to send it.")).toBe(
      true,
    );
    expect(namesNextStep("Rule change not saved.")).toBe(false);
    expect(namesNextStep("The link could not be sent.")).toBe(false);
    expect(isFailureMessage("Rule change not saved.")).toBe(true);
    expect(isFailureMessage("Not confirmed")).toBe(false);
  });

  const entries = scan();
  if (process.env.WARD_WRITE_ERROR_INVENTORY === "1") writeFileSync(INVENTORY, render(entries));

  it("finds failure messages in the source (positive control)", () => {
    expect(entries.length).toBeGreaterThan(50);
    expect(entries.some((entry) => entry.message === "This file could not be read. Select it again.")).toBe(true);
  });

  it("keeps the checked-in inventory equal to the source", () => {
    const listed = parseInventory(readFileSync(INVENTORY, "utf8"));
    expect(
      listed,
      `a failure message was added, changed or removed: refresh ${INVENTORY} (see the header) and read the diff`,
    ).toEqual(entries);
  });

  it("adds no new message without a next step", () => {
    const without = entries.filter((entry) => !entry.nextStep);
    expect(
      without.length,
      "a failure message with no next step was added (say what to do: try again, ask, choose, wait ...), or one was fixed (lower NO_NEXT_STEP_BASELINE)",
    ).toBe(NO_NEXT_STEP_BASELINE);
  });
});
