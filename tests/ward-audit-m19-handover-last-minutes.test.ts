import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  defaultHandoverShift,
  JUST_HELD_HANDOVER_MINUTES,
  openingHandoverShift,
  groupRows,
  HANDOVER_CHIPS,
  handoverAt,
  heldHandoverCutoff,
  heldHandoverNewSince,
  holdHandover,
  pillTest,
  toHandoverRow,
  type HandoverGrouping,
  type HandoverPill,
  type HandoverRow,
  type HandoverShiftId,
  type HandoverSort,
} from "@/components/ward-management/handover/handover-model";
import { handoverSinceItems } from "@/components/ward-management/handover/handover-since-items";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

/**
 * Master audit M19 (10 Nov 2026): handover accountability. A note written in the last minutes of
 * a shift (here a bed request opened at 06:58 or 14:58 Perth) reaches the next shift, nothing is
 * hidden by filters or paging, and sign-off is never worded as an accepted transfer of care.
 *
 * Instants are Perth minutes from day 0's midnight (`ward-clock.ts`). Day 1 is used so every seed
 * record is older than the note. The page's own rules are read through the same functions
 * `handover-page.tsx` calls: the held handover, its cutoff and its "new since".
 */
const DAY = 24 * 60;
const at = (hour: number, minute: number) => DAY + hour * 60 + minute;
const GROUPINGS: readonly HandoverGrouping[] = ["meet", "ed", "ward", "owner", "none"];
const SORTS: readonly HandoverSort[] = ["wait", "tier", "due"];
const PILLS: readonly HandoverPill[] = ["act", "urg", "due", "bed", "mov", "new"];

const state = seedWardFlowState();
const open = state.movements.filter(isOpen);

function sheet(noteAt: number): { rows: HandoverRow[]; note: HandoverRow } {
  const rows = open.map((movement, index) =>
    toHandoverRow(
      index === 0 ? { ...movement, openedAt: noteAt } : movement,
      state.units,
      state.patients,
      state.referrals,
      state.admissions,
    ),
  );
  return { rows, note: rows[0]! };
}

/** What the incoming shift's page holds when it opens (`openingHandoverShift`, as handover-page.tsx). */
function incomingView(readAt: number) {
  const held = holdHandover(openingHandoverShift(readAt), readAt);
  return { cutoff: heldHandoverCutoff(held.at, readAt), newSince: heldHandoverNewSince(held.at, readAt) };
}

/** The handover the incoming shift is receiving: the one that has just started. */
function receivedView(id: HandoverShiftId, readAt: number) {
  const held = holdHandover(id, readAt);
  return { cutoff: heldHandoverCutoff(held.at, readAt), newSince: heldHandoverNewSince(held.at, readAt) };
}

const CASES = [
  { label: "night to day", noteAt: at(6, 58), readAt: at(7, 1), received: "am" as const },
  { label: "day to evening", noteAt: at(14, 58), readAt: at(15, 1), received: "pm" as const },
  { label: "evening to night", noteAt: at(22, 58), readAt: at(23, 1), received: "ev" as const },
];

describe("M19: a note in the last minutes of a shift reaches the next shift", () => {
  for (const { label, noteAt, readAt, received } of CASES) {
    describe(`${label}: written ${noteAt % DAY} minutes into the day, read three minutes after`, () => {
      it("is on the sheet under every grouping and sort: grouping never drops a row", () => {
        const { rows, note } = sheet(noteAt);
        const { cutoff } = incomingView(readAt);
        for (const grouping of GROUPINGS)
          for (const sort of SORTS) {
            const shown = groupRows(rows, grouping, sort, readAt, cutoff).flatMap((group) => group.rows);
            expect(shown, `${grouping}/${sort}`).toHaveLength(rows.length);
            expect(shown.map((row) => row.id)).toContain(note.id);
          }
      });

      it("filters only highlight: every pill and chip is a test on a row, never a list it removes rows from", () => {
        // The page renders `groupRows(rows, …)` and marks rows with `data-highlighted`; a pill or
        // chip never filters `rows` (handover-page.tsx "highlight, never hide").
        const page = readFileSync(
          join(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"),
          "utf8",
        );
        expect(page).toMatch(/groupRows\(rows, grouping, sort, now, cutoff\)/);
        expect(page).toMatch(/data-highlighted=\{isHighlighted\(row\) \? "true" : undefined\}/);
        const { rows, note } = sheet(noteAt);
        const { cutoff, newSince } = incomingView(readAt);
        for (const pill of PILLS) expect(typeof pillTest(pill, note, readAt, cutoff, newSince)).toBe("boolean");
        for (const chip of HANDOVER_CHIPS) expect(typeof chip.test(note, readAt)).toBe("boolean");
        expect(rows).toContain(note);
      });

      it("is counted new on the handover being received, and in its Since line", () => {
        const { rows, note } = sheet(noteAt);
        const { newSince } = receivedView(received, readAt);
        expect(handoverAt(received, readAt)).toBeLessThanOrEqual(readAt);
        expect(pillTest("new", note, readAt, readAt, newSince)).toBe(true);
        const since = handoverSinceItems({
          admissions: state.admissions,
          wards: state.units,
          units: state.units,
          rows,
          scopeKind: "network",
          newSince,
          now: readAt,
          edDesk: false,
        });
        expect(since.find((item) => item.id === "opened")!.value).toBeGreaterThanOrEqual(1);
      });

      // Fixed (master audit M19, D-129): for the first 30 minutes after a handover the page opens on
      // the handover just held, so the note is New and in its Since line on the default view.
      it("is counted New on the incoming shift's default view (opens on the handover just held)", () => {
        const { rows, note } = sheet(noteAt);
        expect(openingHandoverShift(readAt)).toBe(received);
        const { cutoff, newSince } = incomingView(readAt);
        expect(pillTest("new", note, readAt, cutoff, newSince)).toBe(true);
        const since = handoverSinceItems({
          admissions: state.admissions,
          wards: state.units,
          units: state.units,
          rows,
          scopeKind: "network",
          newSince,
          now: readAt,
          edDesk: false,
        });
        expect(since.find((item) => item.id === "opened")!.value).toBeGreaterThanOrEqual(1);
      });

      it("opens on the next handover again once the first 30 minutes have passed", () => {
        const heldAt = handoverAt(received, readAt);
        expect(openingHandoverShift(heldAt)).toBe(received);
        expect(openingHandoverShift(heldAt + JUST_HELD_HANDOVER_MINUTES - 1)).toBe(received);
        const after = heldAt + JUST_HELD_HANDOVER_MINUTES;
        expect(openingHandoverShift(after)).toBe(defaultHandoverShift(after));
        expect(openingHandoverShift(after)).not.toBe(received);
      });
    });
  }

  it("paging never hides silently: Due by shows a count of the rows behind Show more", () => {
    const page = readFileSync(join(process.cwd(), "src/components/ward-management/handover/handover-page.tsx"), "utf8");
    expect(page).toMatch(/hidden=\{group\.rows\.length - DUE_FIRST\}/);
  });
});

// Words that would claim a sign-off or a read accepts the patient's care. Sign-off records that
// the sheet was handed over; it is not a transfer of clinical responsibility.
const ACCEPTANCE_WORDING =
  /transfer(?:red)? of care|care (?:is |was )?(?:accepted|transferred|handed over)|accept(?:s|ed)? (?:the )?(?:care|responsibility|handover)|responsibility (?:accepted|transferred)|handover (?:accepted|received and accepted)|handover read\b|takes? over (?:care|responsibility)/i;

function visibleStrings(path: string): string[] {
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isJsxText(node))
      found.push(node.text);
    else if (ts.isTemplateExpression(node))
      found.push([node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" "));
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe("M19: sign-off is never worded as an accepted transfer of care", () => {
  const folders = ["handover", "site-sign-off"].map((folder) =>
    join(process.cwd(), "src/components/ward-management", folder),
  );
  const files = folders.flatMap((folder) =>
    readdirSync(folder)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => join(folder, name)),
  );

  it("scans the handover and site sign-off screens", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no user-facing string there claims acceptance of care", () => {
    const hits = files.flatMap((file) =>
      visibleStrings(file)
        .filter((value) => ACCEPTANCE_WORDING.test(value))
        .map((value) => `${file.split("ward-management/")[1]}: ${value}`),
    );
    expect(hits).toEqual([]);
  });

  it("the guard catches the wording it is for", () => {
    for (const bad of ["Handover accepted", "Transfer of care complete", "Handover read", "Care accepted by Ward 4"])
      expect(ACCEPTANCE_WORDING.test(bad), bad).toBe(true);
    for (const fine of ["Sign off 07:00 handover", "Signed off 06:52", "Sign-off undone."])
      expect(ACCEPTANCE_WORDING.test(fine), fine).toBe(false);
  });
});
