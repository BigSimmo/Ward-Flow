import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import { formTitleForCode } from "@/lib/form-register";

/**
 * T5, "Form labels from the register" (`docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md`).
 *
 * Every form label on a Ward Flow screen must come from the Chief Psychiatrist register
 * (`formTitleForCode`/`legalFormName` in `src/lib/form-register.ts` / `ward-legal-forms.ts`) at
 * render time, never a hand-written string. Two real violations existed until this change:
 *
 *   - `legal-forms-screen.tsx`'s KPI strip read "Form 1A (Exam referral)", "Form 3B/3D
 *     (Inpatient)" and "Form 4A/4C (Transport)" — none of those parenthetical descriptions are
 *     the register's own titles.
 *   - `patient-now-records.ts`'s rendered Documents tab carried "Form 3B, inpatient treatment
 *     order" — the register titles 3B "Continuation of detention"; "Inpatient treatment order"
 *     is Form 6A's title, the exact mislabel `ward-model.ts`'s own `LegalForm.kind` doc comment
 *     records as the reason this model holds no stored form titles at all.
 *
 * This guard scans every string literal, template-literal fragment and JSX text node under
 * `src/components/ward-management` for a `Form <code>` immediately followed by a parenthesised
 * or comma-led description. A description built correctly (`legalFormName`) is computed at
 * runtime by a function call, never written as source text, so ANY such literal match is by
 * construction "not produced by the register helpers" — the guard does not need to also know
 * what the real title is to flag it.
 *
 * WHAT THIS CANNOT SEE: a bare "Form 1A" with no trailing delimiter (correct — the register
 * accessors' own bare-code fallback takes this exact shape), a title assembled from two literal
 * fragments that individually don't match, or a comment (comments are trivia, not AST nodes, so
 * `ts.forEachChild` never visits them — confirmed against `search-filters.ts`'s own doc comment,
 * which quotes two deleted hand-written titles and must never trip this guard).
 */
const WARD_DIR = "src/components/ward-management";

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/** Every string-shaped literal AND every JSX text node in one file — `tests/helpers/ast-string-
 *  literals.ts`'s `literalsIn` deliberately skips JSX text, which is exactly where the KPI-strip
 *  violation this guard exists for lived (`<span>Form 1A (Exam referral)</span>`), so this file
 *  keeps its own extraction rather than widen that shared helper's contract for other callers. */
function formLabelTextsIn(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const texts: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      texts.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return texts;
}

/** A single code, or a slash-joined pair (`3B/3D`), followed by a parenthesised description that
 *  closes within the same literal/JSX-text fragment. Requiring the close-paren in the SAME
 *  fragment is what keeps this from flagging `ward-flow-reducer.ts`'s "...a Form 1A (legal form
 *  ${code}), so..." error message, whose "(" opens in one template fragment and whose ")" only
 *  arrives after a second `${...}` substitution — never both in one fragment. */
const FORM_PAREN_PATTERN = /\bForm\s+(\d+[A-Z]?(?:\s*\/\s*\d+[A-Z]?)*)\s*\(([^)]*)\)/g;

/** A single code followed by a comma-led description on the same line — the shape
 *  `patient-now-records.ts` used ("Form 3B, inpatient treatment order"). */
const FORM_COMMA_PATTERN = /\bForm\s+(\d+[A-Z]?),\s*([a-z][^".]*)/g;

describe("every rendered form label comes from the Chief Psychiatrist register", () => {
  const files = walk(WARD_DIR).filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"));

  it("has no hand-written parenthesised or comma-led form title anywhere under ward-management", () => {
    const offenders: string[] = [];
    for (const file of files) {
      for (const text of formLabelTextsIn(file)) {
        for (const match of text.matchAll(FORM_PAREN_PATTERN)) {
          offenders.push(`${file}: "Form ${match[1]} (${match[2]})"`);
        }
        for (const match of text.matchAll(FORM_COMMA_PATTERN)) {
          offenders.push(`${file}: "Form ${match[1]}, ${match[2]}"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Form 3D's register title is the owner's 'further examination' order and carries no duration", () => {
    // Owner, second round, 17 September 2026 (docs/ward-flow/owner-answers-2026-09-17.md, answer
    // 3): "3D whhich is further examination up to 72 hours" — the register title stands, and D5
    // forbids showing or computing the 72-hour figure itself.
    const title = formTitleForCode("3D");
    expect(title).toBe("Order authorising reception and detention in an authorised hospital for further examination");
    expect(title).not.toMatch(/\d/);
  });
});
