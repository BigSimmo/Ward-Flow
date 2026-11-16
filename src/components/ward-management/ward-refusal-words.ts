/**
 * H-0839 (wording audit WL-47): what a person reads when the workflow refuses a change.
 *
 * The reducer's reasons and the event types it records stay exactly as they are: tests, the audit
 * trail and the engine read them. Some of them are written for developers ("RECORD_REPATRIATION
 * mode must be chosen from REPATRIATION_MODES", "CONFIRM_CAPACITY on unit X is stale: expected
 * revision 4, current 5"). Screens pass a reason and an event type through these two functions, so
 * no event code, field name or revision number reaches the screen.
 */

import { bedCountAgeWords } from "@/components/ward-management/ward-clock";

/** An event type or a constant's name, such as `CONFIRM_CAPACITY` or `REPATRIATION_MODES`. */
const CODE_NAME = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/;
/** A field name, such as `homeHospital` or `inboxItemId`. */
const FIELD_NAME = /\b[a-z]+[A-Z][A-Za-z0-9]*\b/;
/** The event type the engine puts at the start of many reasons. */
const LEADING_CODE = /^\s*[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b[\s:]*/;
/** A save that lost a race: "is stale: expected revision 4, current 5". */
const STALE = /\bis stale\b|\bexpected revision\b/i;

/** Said in place of a reason that someone else's change overtook. */
export const REFUSAL_CHANGED_FIRST = "Someone else changed this first. Check the board and try again";
/** Said in place of a reason written for developers. */
export const REFUSAL_NOT_RECORDABLE = "BedChart could not record this change. Check the board and try again";

/**
 * R-STYLE-17 (Josh, 14 Nov 2026): a refusal is one short line saying why, then what to do next.
 * `refusalLine("Transport is booked", "Cancel the transport booking first, then undo the pull")`
 * reads "Transport is booked. Cancel the transport booking first, then undo the pull."
 */
export function refusalLine(why: string, next: string): string {
  const sentence = (text: string) => {
    const trimmed = capitalised(text.trim().replace(/[\s.]+$/u, ""));
    return trimmed ? `${trimmed}.` : "";
  };
  return [sentence(why), sentence(next)].filter(Boolean).join(" ");
}

/**
 * Engine reasons that have their own line, matched before the generic rules, so a reason that
 * names an action code still reads as a specific next step (B2d-Q-1) and never falls back to
 * "could not record this change". Add a pattern here when a desk can meet the refusal.
 */
const SPECIFIC_REFUSALS: ReadonlyArray<readonly [RegExp, string]> = [
  [
    /transport job booked; cancel it \(CANCEL_TRANSPORT\) before releasing the pull/u,
    refusalLine("Transport is booked", "Cancel the transport booking first, then undo the pull"),
  ],
  [
    /transport job booked; cancel it \(CANCEL_TRANSPORT\) before releasing and reopening the search/u,
    refusalLine("Transport is booked", "Cancel the transport booking first, then release the bed"),
  ],
  [
    /transport job booked; cancel it \(CANCEL_TRANSPORT\) before withdrawing the acceptance/u,
    refusalLine("Transport is booked", "Cancel the transport booking first, then withdraw the acceptance"),
  ],
];

/** The engine's front-door refusal: "<ward> ... — failed gate <key>: <detail>. <what a reason can do>". */
const GATE_REFUSAL =
  /^(.+?) (?:is not eligible for [^—]*|does not accept referral \S+|cannot accept referral \S+) — failed gate ([a-z_]+): (.*)$/su;

/**
 * R-BEDS-14: a gate refusal ("failed gate capacity_freshness: Last confirmed 25678 min ago") as one
 * line saying why and what to do next. No gate name or raw minutes reach the screen.
 */
function gateRefusalText(reason: string): string | undefined {
  const match = GATE_REFUSAL.exec(reason);
  if (!match) return undefined;
  const [, ward, gate, detail] = match;
  if (gate === "capacity_freshness") {
    const minutes = /(\d+) min/u.exec(detail)?.[1];
    return refusalLine(
      minutes === undefined
        ? `${ward}'s bed count is out of date`
        : `Bed count ${bedCountAgeWords(Number(minutes))} old`,
      // A placement can still go ahead with a recorded reason, so the line names that route too. A
      // planned admission's booking has no reason field yet (X2-4), so it is not offered there.
      /This placement needs a recorded override reason/u.test(reason)
        ? "Add an override reason, or ask the ward to confirm its count"
        : "Ask the ward to confirm its count, then try again",
    );
  }
  if (gate === "allocatable_bed") {
    return refusalLine(`${ward} has no Ready bed now`, "Ask the ward to confirm its count, or choose another ward");
  }
  if (/not something a recorded reason can override/u.test(reason)) {
    return refusalLine(`${ward} cannot take this patient`, "Choose another ward");
  }
  if (/needs a recorded override reason/u.test(reason)) {
    return refusalLine(`${ward} needs a recorded reason for this placement`, "Add a reason, or choose another ward");
  }
  return refusalLine(`${ward} does not fit this patient`, "Choose another ward");
}

/** The specific line for a known engine reason, or undefined when there is none. */
export function specificRefusalText(reason: string): string | undefined {
  return SPECIFIC_REFUSALS.find(([pattern]) => pattern.test(reason))?.[1] ?? gateRefusalText(reason);
}

function capitalised(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A refusal reason with no event code, field name or revision number. A plain reason keeps its own
 * words and case; a screen that starts a sentence with it capitalises it there.
 */
export function refusalReasonText(reason: string): string {
  const specific = specificRefusalText(reason);
  if (specific) return specific;
  if (STALE.test(reason)) return REFUSAL_CHANGED_FIRST;
  const rest = reason.replace(LEADING_CODE, "");
  if (rest.trim() === "" || CODE_NAME.test(rest) || FIELD_NAME.test(rest)) return REFUSAL_NOT_RECORDABLE;
  return rest;
}

/** The refused action in words: `CONFIRM_CAPACITY` reads "Confirm capacity". */
export function refusedActionText(attempted: string): string {
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(attempted)) return attempted;
  return capitalised(attempted.toLowerCase().split("_").join(" "));
}
