import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { edExportLines, ED_EXPORT_HEADER } from "@/components/ward-management/ed/ed-export";
import { formExpiryLine } from "@/components/ward-management/ed/ed-screen-model";
import {
  currentLegalDueAt,
  currentLegalPosition,
  FORM_RECORDED_ENDED,
  formProgression,
  formProgressionPhrase,
  legalFormNowWords,
  NEXT_FORM_TO_RECORD,
} from "@/components/ward-management/legal-forms/legal-form-progression";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { legalStatusShort } from "@/components/ward-management/ward-legal-forms";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { legalNowText } from "@/components/ward-management/ward-transport-checks";

/**
 * Package D, items 1 and 2 (1.1, A1 and D-170 item 1, Josh 13 Nov 2026).
 *
 * ONE current legal position. Every screen in 1.1 reads the form, its end and its typed expiry from
 * `currentLegalPosition` (or `legalFormNowWords` / `currentLegalDueAt`, which are built on it), so no
 * two screens can disagree about whether a form is still the authority. A1 settled the rule: a form
 * shows as recorded until a person records that it ended. The old inference that a form ended at the
 * examination, or at arrival, is gone.
 *
 * The source check copies the pattern of `ward-legal-as-typed-guard.test.ts`: code lines only, so a
 * comment may still explain the history.
 */

const WARD_DIR = "src/components/ward-management";

/** The 1.1 display surfaces. Each one must read the form through the shared position. */
const ROUTED_SCREENS = [
  "ed/ed-screen-desktop.tsx",
  "ed/ed-screen-row-facts.tsx",
  "ed/ed-screen-patient-dialog.tsx",
  "ed/ed-screen-phone.tsx",
  "ed/ed-screen-lists.tsx",
  "ed/ed-lists-desktop.tsx",
  "ed/ed-preview.tsx",
  "ed/ed-screen-person-sheet.tsx",
  "ed/ed-screen-derivations.ts",
  "ed/ed-screen-timeline.tsx",
  "ed/ed-screen-row-menu.tsx",
  "ed/ed-export.ts",
  "ward-transport-checks.ts",
  "search/patient-search.tsx",
  "search/search-filters.ts",
  "search/record-preview.tsx",
  "search/global-search-preview.tsx",
  "search/patient-census.ts",
  "ward/ward-wait-list.tsx",
  "ward/ward-arrivals-corridor.tsx",
  "alerts/alerts-checks.ts",
  "alerts/alert-detail.tsx",
  "ward-tasks-drawer.tsx",
  "statistics/executive-statistics-derivations.ts",
  "reports/downtime-pack.ts",
  "movements/movements-stage-row.tsx",
  "patients/patient-details-tab.tsx",
  "handover/handover-model.ts",
  "bed-meeting/tv-clinical-derivations.ts",
] as const;

/** Reading the stored form's code, typed end or recorded end straight off the record. */
const DIRECT_READ = /legalForm\??\.(?:code|dueAt|endedBy)\b/u;
/** Any of the shared readers, so a file in the list cannot pass by naming no form at all. */
const SHARED_READER = /\b(?:currentLegalPosition|legalFormNowWords|currentLegalDueAt|legalStatusShort|legalNowText)\b/u;

function codeLines(text: string): { line: number; code: string }[] {
  return text
    .split("\n")
    .map((code, index) => ({ line: index + 1, code }))
    .filter(({ code }) => !/^\s*(?:\/\/|\/?\*|\{\s*\/\*)/.test(code));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("one current legal position: source", () => {
  it("still finds every listed screen, so a rename cannot empty this guard", () => {
    const missing = ROUTED_SCREENS.filter((file) => !existsSync(join(WARD_DIR, file)));
    expect(missing, "a listed screen moved: update this list in the same change").toEqual([]);
  });

  it("each listed screen reads the form through the shared position", () => {
    const notRouted = ROUTED_SCREENS.filter((file) => !SHARED_READER.test(readFileSync(join(WARD_DIR, file), "utf8")));
    expect(notRouted).toEqual([]);
  });

  it("no listed screen reads the stored form's code, typed end or recorded end directly", () => {
    const offenders = ROUTED_SCREENS.flatMap((file) =>
      codeLines(readFileSync(join(WARD_DIR, file), "utf8"))
        .filter(({ code }) => DIRECT_READ.test(code))
        .map(({ line, code }) => `${file}:${line}: ${code.trim()}`),
    );
    expect(offenders, "read it through currentLegalPosition (ward-legal-form-progression.ts)").toEqual([]);
  });

  it("no screen names a form number as the next form to record (item 2)", () => {
    const files = walk(WARD_DIR);
    expect(files.length).toBeGreaterThan(200);
    const offenders = files.flatMap((file) =>
      codeLines(readFileSync(file, "utf8"))
        .filter(({ code }) => /Form 6[ABC] to record|Record Form 6[ABC]|\bnextCode\b/u.test(code))
        .map(({ line, code }) => `${file}:${line}: ${code.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});

/** A Keira-like journey: Form 3B, examined with an inpatient order, nothing recorded as ended. */
function examined(overrides: Partial<Movement> = {}): Movement {
  const base = seedWardFlowState().movements.find((movement) => movement.id === "WF-003")!;
  return {
    ...base,
    legalForm: { code: "3B", kind: "detention", dueAt: NOW_ANCHOR + 120 },
    examination: { at: NOW_ANCHOR - 60, outcome: "inpatient_order" },
    ...overrides,
  };
}

describe("one current legal position: behaviour", () => {
  it("keeps Keira's seeded Form 3B in force after the examination, and prompts the next form without a number", () => {
    const keira = seedWardFlowState().movements.find((movement) => movement.id === "WF-003")!;
    expect(keira.legalForm?.code).toBe("3B");
    const position = currentLegalPosition(keira);
    expect(position.ended).toBe(false);
    expect(position.form?.code).toBe("3B");
    expect(position.formWords).toBe("Form 3B");
    expect(position.nextForm).toEqual({ formCode: "3B", when: "at the examination" });
    expect(formProgressionPhrase(position.nextForm!)).toBe("On Form 3B at the examination");
    expect(NEXT_FORM_TO_RECORD).toBe("Next form to record");
    expect(legalStatusShort(keira)).not.toMatch(/ended/iu);
  });

  it("shows the typed expiry until a person records the end, on every reader", () => {
    const live = examined();
    expect(currentLegalDueAt(live)).toBe(NOW_ANCHOR + 120);
    expect(currentLegalPosition(live).dueAt).toBe(NOW_ANCHOR + 120);
    expect(legalFormNowWords(live)).toBe("Form 3B");
    expect(legalNowText(live)).toBe(`${live.legalStatus}, Form 3B`);
    expect(formExpiryLine(live.legalForm!, NOW_ANCHOR)).not.toContain(FORM_RECORDED_ENDED);

    const ended = examined({
      legalForm: { code: "3B", kind: "detention", dueAt: NOW_ANCHOR + 120, endedBy: "revoked" },
    });
    const position = currentLegalPosition(ended);
    expect(position.ended).toBe(true);
    expect(position.dueAt).toBeUndefined();
    expect(position.nextForm).toBeUndefined();
    expect(formProgression(ended)).toBeUndefined();
    expect(currentLegalDueAt(ended)).toBeUndefined();
    expect(legalFormNowWords(ended)).toBe("Form 3B ended");
    expect(legalNowText(ended)).toBe(`${ended.legalStatus}, Form 3B ended`);
    expect(legalStatusShort(ended)).toMatch(/Form 3B ended/u);
    expect(formExpiryLine(ended.legalForm!, NOW_ANCHOR)).toBe(`${FORM_RECORDED_ENDED}.`);
  });

  it("never infers an end from an arrival either", () => {
    const arrived = examined({
      examination: undefined,
      closure: { outcome: "arrived", at: NOW_ANCHOR - 5, reason: "Arrived" },
    });
    expect(currentLegalPosition(arrived).ended).toBe(false);
    expect(currentLegalPosition(arrived).nextForm).toEqual({ formCode: "3B", when: "at arrival" });
    expect(currentLegalDueAt(arrived)).toBe(NOW_ANCHOR + 120);
  });

  it("writes the same position into the ED list download (1.6)", () => {
    const at = (instant: number) => `T${instant}`;
    const ctx = {
      department: "Synthetic ED",
      umrnOf: () => "UM000001",
      bayOf: () => "Bay 01",
      stageOf: () => "x",
      minutesOf: () => 0,
      at,
    };
    const formColumn = ED_EXPORT_HEADER.indexOf("Form");
    const endColumn = ED_EXPORT_HEADER.indexOf("Form end");
    expect(endColumn).toBe(formColumn + 1);
    const live = edExportLines([examined()], ctx)[1]!;
    expect(live[formColumn]).toBe("Form 3B");
    expect(live[endColumn]).toBe(`T${NOW_ANCHOR + 120} as typed`);
    const ended = edExportLines(
      [examined({ legalForm: { code: "3B", kind: "detention", dueAt: NOW_ANCHOR + 120, endedBy: "form_3e" } })],
      ctx,
    )[1]!;
    expect(ended[formColumn]).toBe("Form 3B");
    expect(ended[endColumn]).toBe(FORM_RECORDED_ENDED);
  });
});
