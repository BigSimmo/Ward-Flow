import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { formExpiryLine } from "../src/components/ward-management/ed/ed-screen-model";
import { formTimeLeft } from "../src/components/ward-management/legal-forms/legal-form-time-left";
import { legalDeadlineText } from "../src/components/ward-management/legal-forms/legal-forms-derivations";
import {
  formTimeAsTyped,
  typedTimeLine,
  typedTimePhrase,
} from "../src/components/ward-management/legal-forms/legal-time-as-typed";
import { legalFormReadinessLine } from "../src/components/ward-management/movements/movement-workspace-derivations";
import { DEFAULT_DUE_SOON_THRESHOLDS } from "../src/components/ward-management/ward-clock";
import { buildActionInbox } from "../src/components/ward-management/ward-derivations";
import { seedWardFlowState } from "../src/components/ward-management/ward-flow-reducer";
import { currentLegalDueAt } from "../src/components/ward-management/legal-forms/legal-form-progression";
import type { Movement } from "../src/components/ward-management/ward-model";
import { FORM_TIMING_FACTOR_LABEL, waitFactors } from "../src/components/ward-management/ward-priority";

/**
 * LEGAL FORM TIMES ONLY AS TYPED (Josh, 31 Oct 2026, D-93; replaces D-71 item 5; D5 and D-70 hold).
 *
 * A legal form's time shows only as the clock time a person typed from the form ("Ends 15:42 as
 * typed"), never as a running figure worked out from it ("3h 20m left", "passed 1h 05m ago",
 * "1h 15m overdue"). The build plan listed 11 places that still counted down; a full search found
 * about 30 across 13 screens, so this guard watches the whole ward directory, not a list.
 *
 * Part 1 reads the source: no duration formatter may take a legal time, and the old countdown
 * helpers and phrases may not come back. Part 2 renders the shared wording from synthetic seed
 * data and checks it carries no count. Bed pull limits, transport waits and decision targets are
 * not legal times and are not checked here.
 */

const WARD_DIR = "src/components/ward-management";

/** Every formatter that turns minutes into "1h 05m", "2d 3h" or "58m". */
const DURATION_CALL = /\b(?:formatRemaining|splitDuration|durText|durMinutes|minutesText|formatElapsed)\s*\(/;
/** Names that hold a legal form's typed time, or minutes worked out from it. */
const LEGAL_TIME = /legalForm|legalDue|LegalDue|deadline|Deadline|\bdueIn\b|formDue/;
/** Helpers and wording that only ever existed to count down to a legal time. */
const RETIRED = [
  /\bleftText\s*\(/,
  /\belapsedFraction\s*\(/,
  /passed its deadline/,
  /left \(as written\)/,
  /Form expires in/,
  /Form expiry passed \$\{/,
  /recorded expiry (?:in|passed)/,
  /(?:until|since) the typed expiry/,
  /The deadline (?:passed|is) \$\{/,
];

/** A rendered legal time that carries a count: "1h 05m", "58m", "2d", "left", "ago", "overdue". */
const COUNT_IN_TEXT = /\b\d+\s*[dhm]\b|\bleft\b|\bago\b|\boverdue\b|\bdue in\b|\baway\b/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** Code lines only: comment lines and JSDoc may name the old wording to explain why it went. */
function codeLines(text: string): { line: number; code: string }[] {
  return text
    .split("\n")
    .map((code, index) => ({ line: index + 1, code }))
    .filter(({ code }) => !/^\s*(?:\/\/|\/?\*|\{\s*\/\*)/.test(code));
}

/** Lines that format a legal time as a duration, or bring back retired countdown wording. */
function offendingLines(text: string): string[] {
  return codeLines(text)
    .filter(
      ({ code }) =>
        (DURATION_CALL.test(code) && LEGAL_TIME.test(code)) || RETIRED.some((pattern) => pattern.test(code)),
    )
    .map(({ line, code }) => `${line}: ${code.trim()}`);
}

describe("legal form times only as typed: source", () => {
  const files = walk(WARD_DIR);

  it("walks the whole ward directory, including the screens that used to count down", () => {
    const seen = files.map((file) => relative(WARD_DIR, file).replace(/\\/g, "/"));
    for (const expected of [
      "legal-forms/legal-forms-screen.tsx",
      "delays/delays-board-rows.tsx",
      "ed/ed-screen-lists.tsx",
      "movements/movement-workspace-cockpit.tsx",
      "alerts/alerts-queue.tsx",
      "coordinator/shortlist-panel.tsx",
    ]) {
      expect(seen).toContain(expected);
    }
  });

  it("flags the countdowns it exists to stop (non-vacuity)", () => {
    for (const offender of [
      "      text: `Form ${row.movement.legalForm.code} due as written, ${splitDuration(due)} left`,",
      "  const left = row.dueIn < 0 ? `${splitDuration(-row.dueIn)} overdue` : `${splitDuration(row.dueIn)} left`;",
      "                value={formatRemaining(minutesUntil(deadline, now))}",
      '    return { value: durMinutes(now - movement.legalForm.dueAt), state: "Overdue" };',
      "    ? `${formCode} passed its deadline ${splitDuration(Math.abs(remaining))} ago`",
      "              <span className={styles.clockBig}>{leftText(movement, now)}</span>",
    ]) {
      expect(offendingLines(offender), offender).toHaveLength(1);
    }
    // Times that are not legal keep their counts.
    expect(offendingLines("  return formatRemaining(minutesUntil(pullExpiresAt, now));")).toEqual([]);
    expect(offendingLines("      when: `waiting ${splitDuration(Math.max(now - m.openedAt, 0))}`,")).toEqual([]);
  });

  it("formats no legal time as a duration anywhere under the ward directory", () => {
    const found = files.flatMap((file) =>
      offendingLines(readFileSync(file, "utf8")).map((hit) => `${relative(WARD_DIR, file)}:${hit}`),
    );
    expect(found).toEqual([]);
  });

  it("draws no countdown timer on the legal forms screens", () => {
    const legalFiles = files.filter((file) => file.includes("legal-forms"));
    const timers = legalFiles.filter((file) => /direction="(?:left|in)"/.test(readFileSync(file, "utf8")));
    expect(timers).toEqual([]);
  });
});

describe("legal form times only as typed: what screens show", () => {
  const state = seedWardFlowState();
  const typed = state.movements.find(
    (movement): movement is Movement & { legalForm: NonNullable<Movement["legalForm"]> } =>
      currentLegalDueAt(movement) !== undefined && movement.closure === undefined,
  );
  if (!typed) throw new Error("the seed holds no open movement with a typed legal form time");
  const dueAt = typed.legalForm.dueAt!;
  const before = dueAt - 75;
  const after = dueAt + 75;

  it("words the typed time with no count, before and after it", () => {
    expect(typedTimeLine(dueAt, before)).toMatch(/^Ends \S+.* as typed$/);
    expect(typedTimeLine(dueAt, after)).toMatch(/^Ended \S+.* as typed$/);
    expect(typedTimePhrase(dueAt, after)).toMatch(/^ended /);
    expect(formTimeAsTyped(typed.legalForm, before)).toMatch(new RegExp(`^Form ${typed.legalForm.code}\\b.* · ends `));
    expect(formTimeAsTyped({ ...typed.legalForm, dueAt: undefined }, before)).toMatch(/no expiry recorded/);
  });

  it("shows the typed time, not a count, on every shared surface", () => {
    for (const now of [before, after]) {
      const surfaces: Record<string, string | undefined> = {
        "Patient page and Forms (formTimeLeft)": formTimeLeft(typed, now, DEFAULT_DUE_SOON_THRESHOLDS)?.text,
        "Forms focus panel (legalDeadlineText)": legalDeadlineText(typed, now),
        "ED board (formExpiryLine)": formExpiryLine(typed.legalForm, now),
        "Movement readiness (legalFormReadinessLine)": legalFormReadinessLine(typed.legalForm, now),
        "Home queue (waitFactors)": waitFactors(typed, now, DEFAULT_DUE_SOON_THRESHOLDS).find(
          (factor) => factor.label === FORM_TIMING_FACTOR_LABEL,
        )?.detail,
      };
      for (const [surface, text] of Object.entries(surfaces)) {
        if (text === undefined) continue;
        expect(text, surface).toMatch(/as typed/);
        expect(text, surface).not.toMatch(COUNT_IN_TEXT);
      }
    }
  });

  it('words the "Legal due time passed" alert as typed, with no overdue count', () => {
    const items = buildActionInbox(state.movements, after, state.units).filter(
      (item) => item.movementId === typed.id && item.title === "Legal due time passed",
    );
    expect(items).toHaveLength(1);
    expect(items[0].detail).toMatch(/ended .* as typed$/);
    expect(items[0].detail).not.toMatch(/\boverdue\b|\bago\b/);
  });
});
