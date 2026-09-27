import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { officialForms } from "@/lib/form-register";

/**
 * LEAVE FROM A WARD IS NEVER AUTHORISED BY A COMMUNITY TREATMENT ORDER.
 *
 * The register is explicit: **Form 7A** is "Grant of leave to involuntary inpatient" and **Form 7D**
 * is "Apprehension and return order", both under "Leave and absence without leave". **Form 5A** is
 * a Community Treatment Order — an order for treatment in the community, held by somebody who has
 * no ward bed to take leave from.
 *
 * ⚠️ **WHY THIS FILE EXISTS, 2026-09-18.** Two movement drawings labelled five leave and return
 * events "Form 5A": a weekend-trial return, a leave return at 20:00, a 14-hour leave bar, a legend
 * entry, and — the tell — **"Reserved Form 5A beds"**. A bed is held because an involuntary
 * inpatient is out on granted leave and is coming back to it. Nobody reserves a ward bed for a
 * person on a community treatment order, because that person does not have one. **The drawings
 * carried their own refutation and it went unread for weeks.** The owner ruled it a muddle rather
 * than a real arrangement, so all five became Form 7A.
 *
 * 🔴 **THIS GUARD EXISTS BECAUSE OF THE ONE BEFORE IT.** `ward-register-inpatient-form-codes.test.ts`
 * was written the same day, after a ruling about Form 5A had been enforced by adding a local guard
 * to each of the three screens somebody had happened to find it on — leaving 26 instances in a
 * fourth file nobody had enumerated. Fixing these five drawings without a guard would have repeated
 * that exact mistake one day later. See `docs/ward-flow-task-ledger.md` §7.19.
 *
 * **What this checks is the pairing, not the code.** A community-order code is perfectly correct in
 * a drawing on its own — a patient whose CTO has been breached, a filter whose option value is the
 * code itself. What is never correct is that code sitting in the same breath as leave or return.
 * Keying on the register's own category means a newly added community form inherits this without
 * anyone remembering it is here.
 *
 * **If a genuine case ever arises** — and the owner ruled in 2026-09-18 that this one was not —
 * it belongs in a patient record describing that person's circumstances, not in a movement label,
 * a legend or a reserved-bed caption. Widening this test to admit one would remove the only thing
 * that can report the next muddle.
 */

const MOCKUPS_DIR = "docs/ward-flow/mockups";
const SOURCE_DIRS = ["src/components/ward-management"];

/**
 * Leave, and the return that ends it — both inpatient acts under the register's Form 7 family.
 *
 * ⚠️ **A BARE LOWERCASE `return` IS DELIBERATELY NOT HERE, AND THE OMISSION COST A DRAFT.** The
 * first version matched it and flagged `record-preview.tsx`, where the only "return" within reach
 * of the form code was JavaScript's own keyword before a JSX block. In a repository whose subject
 * matter is clinical and whose language is TypeScript, `return` is overwhelmingly the keyword.
 * A capitalised `Return` is label text ("Form 7A Return", "Leave Return"), and a lowercase one
 * preceded by leave is caught by the `leave` pattern on the same window.
 *
 * **The cost of that choice, stated rather than hidden:** a lowercase clinical "return" with no
 * "leave" near it slips through. That is a narrower guard than the prose above promises, and it is
 * the honest trade for one that does not cry wolf on every component in the tree.
 */
const LEAVE_PHRASES = [/\bleave\b/iu, /\bReturn(ed|ing)?\b/u, /\bapprehension\b/iu];

const COMMUNITY_ORDER_CODES = officialForms
  .filter((form) => form.category === "Community treatment orders")
  .map((form) => form.code);

/** Every drawing at the top level. `reference/` is excluded: it is a dated snapshot of what another
 *  tool produced, and correcting it would destroy the record of what that tool actually said. */
function drawings(): string[] {
  return readdirSync(MOCKUPS_DIR)
    .filter((name) => name.endsWith(".html"))
    .map((name) => join(MOCKUPS_DIR, name));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/u.test(entry.name) ? [full] : [];
  });
}

/**
 * Each place a community-order code is named, with the text either side of it — the window a human
 * would read to decide what the label is about.
 */
function leaveContextOffences(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const offences: string[] = [];
  for (const code of COMMUNITY_ORDER_CODES) {
    const needle = `Form ${code}`;
    // Scanned by index rather than by regex. A `.{0,60}` prefix around a needle backtracks
    // catastrophically over files this size — the first draft of this guard timed out at 30s
    // instead of reporting, which is the one failure mode a guard must not have.
    for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
      const after = text[at + needle.length] ?? "";
      if (/[0-9A-Za-z]/u.test(after)) continue; // "Form 5A" must not match inside "Form 5AB"
      const window = text.slice(Math.max(0, at - 60), at + needle.length + 60);
      if (LEAVE_PHRASES.some((phrase) => phrase.test(window))) offences.push(`${path}: …${window.trim()}…`);
    }
  }
  return offences;
}

describe("leave is an inpatient act, never a community treatment order", () => {
  const files = [...drawings(), ...SOURCE_DIRS.flatMap(sourceFiles)];

  it("has a non-empty population to search, on both axes", () => {
    // Either list going empty would leave every assertion below passing over nothing.
    expect(COMMUNITY_ORDER_CODES.length, "no community-order codes in the register").toBeGreaterThanOrEqual(4);
    expect(files.length, "no drawings or ward source files found to check").toBeGreaterThanOrEqual(40);
  });

  it("names no community treatment order in a leave or return context", () => {
    const offences = files.flatMap(leaveContextOffences);
    expect(
      offences,
      "a leave or return is labelled with a community treatment order. Leave from a ward is " +
        "Form 7A, 'Grant of leave to involuntary inpatient'; a failure to return is Form 7D, " +
        "'Apprehension and return order'. Somebody on a community order has no ward bed to take " +
        "leave from — which is why a reserved bed beside one of these labels is the tell. Correct " +
        "the label; never widen this guard to accept it.",
    ).toEqual([]);
  });

  it("still labels leave with the Form 7 family, so the correction is present and not merely absent", () => {
    // The assertion above passes just as well if every leave label were deleted. This one does not.
    const withLeaveForm = drawings().filter((path) => /\bForm 7[A-D]\b/u.test(readFileSync(path, "utf8")));
    expect(
      withLeaveForm.length,
      "no drawing names Form 7A/7B/7C/7D at all. The movement drawings depict leave and returns, " +
        "so the total absence of the leave family means those labels were removed rather than corrected.",
    ).toBeGreaterThanOrEqual(2);
  });
});
