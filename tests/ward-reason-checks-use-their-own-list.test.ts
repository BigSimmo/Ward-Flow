import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * ═══ EVERY REASON CHECK VALIDATES AGAINST ITS OWN EVENT'S LIST ═══
 *
 * 🔴 **A CHECK AGAINST THE WRONG LIST LOOKS EXACTLY LIKE A WORKING CHECK.** It is present, it
 * refuses things, it has a message naming a real constant — and it accepts reasons the event may
 * never carry while refusing ones it must. Nothing about reading the line tells you which list it
 * should have named; you have to compare it against the event.
 *
 * ⚠️ **AND TWO EVENTS SHARING ONE LIST IS LEGITIMATE HERE, WHICH IS WHAT MAKES THE EYEBALL CHECK
 * UNRELIABLE.** `STEP_BACK_REASONS` is validated twice — by `STEP_BACK_STAGE` and by
 * `WITHDRAW_ACCEPTANCE`, which reuses it by owner ruling 1 of 2026-09-04 rather than having a list
 * of its own. So "the same constant appears on two different events" is CORRECT here and would be a
 * defect elsewhere. A reader scanning for duplicates finds a true positive that is not a bug.
 *
 * ⚠️ **THE EXPECTATION IS DERIVED FROM THE EVENT'S OWN TYPE, NEVER HAND-LISTED.** Each event
 * declares `reason: SomeReason`, and each reason type has exactly one runtime list. A sixth event
 * added tomorrow with a check against the wrong list fails here without anybody updating a table —
 * which a hand-written pairing would not do, because the person adding the event would update it.
 *
 * ⚠️ **THIS FILE READS SOURCE AS TEXT**, so `npm run test:focused` cannot select it from an import
 * graph. It runs in the full suite.
 */

const REDUCER = "src/components/ward-management/ward-flow-reducer.ts";
const EVENTS = "src/components/ward-management/ward-flow-events.ts";

/**
 * The one runtime list each reason TYPE is spelled by. This is the only hand-written thing here,
 * and it is a naming fact rather than a per-event decision — the pairing that could actually drift
 * (which event checks which list) is derived below.
 */
const LIST_FOR_TYPE: Readonly<Record<string, string>> = {
  ReferralDeclineReason: "REFERRAL_DECLINE_REASONS",
  ReleasePullReason: "RELEASE_PULL_REASONS",
  CancelTransportReason: "CANCEL_TRANSPORT_REASONS",
  StepBackReason: "STEP_BACK_REASONS",
  DeclineReason: "DECLINE_REASONS",
  UrgencyChangeReason: "URGENCY_CHANGE_REASONS",
  LegalStatusChangeReason: "LEGAL_STATUS_CHANGE_REASONS",
  StopTransportReason: "STOP_TRANSPORT_REASONS",
  // Added 2026-09-17 with FLAG_MOVEMENT_URGENT's new `reason` field (item 37) — the same
  // consequential edit every other reason-carrying event required of this file.
  UrgentMarkReason: "URGENT_MARK_REASONS",
  // RA1 (item 18, 2026-09-17): WITHDRAW_WARD_REQUEST's own §2 list.
  WardRequestWithdrawalReason: "WARD_REQUEST_WITHDRAWAL_REASONS",
  // T4 (2026-09-17 build plan): CORRECT_LEGAL_FORM_RECEIPT's own fixed correction reasons.
  LegalFormReceiptCorrectionReason: "LEGAL_FORM_RECEIPT_CORRECTION_REASONS",
  // Wave 4 diversions (T4a): RECORD_DIVERSION's own fixed list.
  DiversionReason: "DIVERSION_REASONS",
};

/** Strips comments so prose naming a constant cannot be read as code naming it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, " ").replace(/\/\/[^\n]*/gu, " ");
}

/** Every `case "X":` in the reducer, with the line it starts on. */
function reducerCases(): Array<{ name: string; line: number }> {
  const lines = stripComments(readFileSync(REDUCER, "utf8")).split("\n");
  const found: Array<{ name: string; line: number }> = [];
  lines.forEach((text, index) => {
    const match = /case "([A-Z][A-Z0-9_]*)":/u.exec(text);
    if (match) found.push({ name: match[1], line: index });
  });
  return found;
}

/** Every membership check on an event reason, attributed to the case it sits inside. */
function reasonChecks(): Array<{ event: string; list: string }> {
  const lines = stripComments(readFileSync(REDUCER, "utf8")).split("\n");
  const cases = reducerCases();
  const checks: Array<{ event: string; list: string }> = [];
  lines.forEach((text, index) => {
    const match = /!([A-Z][A-Z0-9_]*)\.includes\(event\.reason\)/u.exec(text);
    if (!match) return;
    const owning = [...cases].reverse().find((entry) => entry.line < index);
    checks.push({ event: owning?.name ?? "(no enclosing case)", list: match[1] });
  });
  return checks;
}

/** The reason TYPE each event declares, read from the event union itself. */
function reasonTypeOf(eventName: string): string | undefined {
  const source = stripComments(readFileSync(EVENTS, "utf8"));
  const start = source.indexOf(`type: "${eventName}";`);
  if (start < 0) return undefined;
  /*
   * 🔴 **BOUNDED TO THIS UNION MEMBER, AND THE FIRST DRAFT WAS NOT.** It read 2000 characters
   * forward and took the first `reason:` it found — which, for a member that has none, is the NEXT
   * member's field. That reported **39 events** as declaring a reason and lacking a check, in a
   * file with five reason-carrying events. **A scan that runs past its own boundary produces
   * confident, specific, entirely wrong findings**, and the volume is what gave it away.
   *
   * The next `type: "` discriminant is where the next member begins, so it is the boundary.
   */
  const header = `type: "${eventName}";`;
  const after = source.slice(start + header.length);
  const nextMember = after.indexOf('type: "');
  const member = nextMember < 0 ? after : after.slice(0, nextMember);
  // `?` is optional: RECORD_REFERRER_WITHDRAWAL's `reason?: WardRequestWithdrawalReason` (owner
  // ruling 11, 2026-09-17) is the first OPTIONAL reason field with a runtime check behind it — the
  // field is required only when `destinationKind` is given (see that event's own doc comment).
  // Without the `?`, this scan reported it as declaring no reason field at all, which reads
  // identically to a check with nothing to validate against.
  const match = /\breason\??:\s*([A-Za-z]+)\s*;/u.exec(member);
  const type = match?.[1];
  // `reason?: string` (REFER_TO_COMMUNITY_TEAM) is free text, never a closed vocabulary — there is
  // no list for it to be checked against, and none is expected. Excluded here rather than left for
  // `LIST_FOR_TYPE` to reject, because that path is for a NAMED reason type nobody registered yet,
  // not for a field that was never meant to have one. Widening the `?` above (this round) would
  // otherwise have newly counted it as an unchecked reason-carrying event.
  return type === "string" ? undefined : type;
}

describe("reason membership checks", () => {
  it("walks a real reducer, so the checks below are not ranging over nothing", () => {
    /*
     * ⚠️ Floors on the POPULATION. If the scan's pattern stops matching — a reformat putting the
     * check on two lines, a rename of `event.reason` — every assertion below passes over an empty
     * list, which reads exactly like a codebase with no mistakes in it.
     */
    expect(reducerCases().length, "no reducer cases parsed").toBeGreaterThan(40);
    expect(
      reasonChecks().length,
      "no reason checks parsed; the scan pattern has stopped matching",
    ).toBeGreaterThanOrEqual(5);
  });

  it("🔴 checks each event's reason against the list that event's own type names", () => {
    const wrong: string[] = [];
    for (const check of reasonChecks()) {
      const type = reasonTypeOf(check.event);
      if (type === undefined) {
        wrong.push(`${check.event}: a reason check exists but the event declares no reason field`);
        continue;
      }
      const expectedList = LIST_FOR_TYPE[type];
      if (expectedList === undefined) {
        wrong.push(`${check.event}: reason type ${type} has no known runtime list — add it to LIST_FOR_TYPE`);
        continue;
      }
      if (check.list !== expectedList) {
        wrong.push(`${check.event}: declares ${type} but validates against ${check.list}, expected ${expectedList}`);
      }
    }
    expect(
      wrong,
      "a reason check names a list its event does not use. A check against the wrong list refuses " +
        "valid reasons and accepts invalid ones while looking exactly like a working check.",
    ).toEqual([]);
  });

  it("⚠️ leaves no reason-carrying event without a check at all", () => {
    /*
     * 🔴 **THE OTHER DIRECTION, AND THE ONE THAT WAS ACTUALLY BROKEN.** `RELEASE_PULL` had no
     * runtime check until 2026-09-06 — the only one of five without — and accepted a reason that is
     * not a member, silently, with every test green because `vitest run` involves no `tsc`. The
     * test above cannot see that: an absent check has no wrong list to report.
     *
     * Derived from the events file, so a sixth reason-carrying event ships red until it has one.
     */
    const source = stripComments(readFileSync(EVENTS, "utf8"));
    const carryReason = [...source.matchAll(/type: "([A-Z][A-Z0-9_]*)";/gu)]
      .map((match) => match[1])
      .filter((name) => reasonTypeOf(name) !== undefined);
    const checked = new Set(reasonChecks().map((check) => check.event));

    expect(carryReason.length, "no reason-carrying events found, so this checked nothing").toBeGreaterThanOrEqual(5);
    expect(
      carryReason.filter((name) => !checked.has(name)),
      "these events declare a reason and the reducer never checks it is a member of anything. A " +
        "type-only requirement passes `vitest run` with no `tsc` involved.",
    ).toEqual([]);
  });

  it("control: the scan can tell a right pairing from a wrong one", () => {
    /*
     * ⚠️ **WITHOUT THIS, BOTH ASSERTIONS ABOVE PASS AGAINST A SCAN THAT MATCHES NOTHING OR
     * ATTRIBUTES EVERYTHING TO ONE CASE.** Checks the two properties the attribution rests on:
     * every check lands inside a named case, and the checks are spread across several events rather
     * than collapsing onto whichever case happens to be first.
     */
    const checks = reasonChecks();
    expect(checks.every((check) => /^[A-Z][A-Z0-9_]*$/u.test(check.event))).toBe(true);
    expect(new Set(checks.map((check) => check.event)).size, "every check was attributed to one case").toBeGreaterThan(
      3,
    );
    // And a comment naming a constant must not be counted as a check.
    expect(reasonChecks().length).toBe(
      readFileSync(REDUCER, "utf8")
        .split("\n")
        .filter((line) => !line.trim().startsWith("*") && /!([A-Z][A-Z0-9_]*)\.includes\(event\.reason\)/u.test(line))
        .length,
    );
  });
});
