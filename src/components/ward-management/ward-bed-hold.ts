import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { DUE_SOON_URGENT_MINUTES } from "@/components/ward-management/ward-operational-defaults";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * ONE BED-HOLD RULE for every page that shows a pulled bed (audit A4-4, A4-1, A1-3, A1-4, A4-3;
 * 13 Oct 2026). Movement detail, ED, Handover, the Ward page and the Home patient sheet each used
 * to word a hold their own way, so one patient could read "4h hold clock active" on one page and
 * "expired 10m ago" on another. They all read this instead.
 *
 * Read from the stored `Movement.pullExpiresAt` only, never an invented hold length:
 * - `lapsed`: the hold time has passed. Act now: the coral overdue marker, and the ward's Act now.
 * - `at-risk`: under `BED_HOLD_AT_RISK_MINUTES` left. The round amber dot only, never Act now, so
 *   Act now keeps to what genuinely needs doing now (alarm fatigue).
 * - `held`: more time than that left. Plain.
 */
/** Josh's one-hour warning default, the same one the legal clocks use. */
export const BED_HOLD_AT_RISK_MINUTES = DUE_SOON_URGENT_MINUTES;

type BedHoldState = "held" | "at-risk" | "lapsed";

export type BedHold = {
  state: BedHoldState;
  expiresAt: Instant;
  /** Minutes left (held, at risk) or minutes since it lapsed (lapsed). Never negative. */
  minutes: number;
  /** The sentence: "Pull expired 10m ago", "Pull 27m left". Screens say pull, never hold (Task 7). */
  label: string;
  /** The same without the noun, for a row already about the hold: "Expired 10m ago", "27m left". */
  short: string;
  /** The next step the hold asks for. */
  nextStep: string;
};

export function bedHold(pullExpiresAt: Instant | undefined, now: Instant): BedHold | null {
  if (pullExpiresAt === undefined || !Number.isFinite(pullExpiresAt)) return null;
  const left = pullExpiresAt - now;
  if (left <= 0) {
    const over = splitDuration(Math.max(0, -left));
    return {
      state: "lapsed",
      expiresAt: pullExpiresAt,
      minutes: Math.max(0, -left),
      label: `Pull expired ${over} ago`,
      short: `Expired ${over} ago`,
      nextStep: "Move or release",
    };
  }
  const remaining = splitDuration(left);
  return {
    state: left < BED_HOLD_AT_RISK_MINUTES ? "at-risk" : "held",
    expiresAt: pullExpiresAt,
    minutes: left,
    label: `Pull ${remaining} left`,
    short: `${remaining} left`,
    nextStep: "Book transport",
  };
}

/**
 * D-187 (F-46, Q34, Josh 13 Nov 2026): a pulled bed with no `pullExpiresAt` says so, never nothing
 * and never the configured default. A pull past its limit keeps the display above and stays pulled
 * until a person releases it: nothing releases a pull on its own (only a person's `RELEASE_PULL`).
 */
export const PULL_NO_LIMIT_RECORDED = "No limit recorded";

/** D-187 (F-46): a pulled bed's status line when no limit is recorded; undefined otherwise. */
export function pulledWithoutLimitLabel(movement: Pick<Movement, "stage" | "pullExpiresAt">): string | undefined {
  return movement.stage === "pulled" && movement.pullExpiresAt === undefined
    ? `Bed pulled · ${PULL_NO_LIMIT_RECORDED}`
    : undefined;
}

/** True when the hold has lapsed: the one bed-hold condition that belongs in Act now. */
export function bedHoldLapsed(pullExpiresAt: Instant | undefined, now: Instant): boolean {
  return bedHold(pullExpiresAt, now)?.state === "lapsed";
}

/**
 * RC 2.5 (F-35, 13 Nov 2026): a pull time limit's length, "4h" or "4h 30m", the one way Ward, ED
 * and the coordinator queue say it. Ward used `durMinutes` and ED a hand check on whole hours, so
 * the same setting could read two ways. The look is unchanged ("5h" vs "5h 00m" is the design
 * thread's call, F-35 question 10).
 */
export function pullHoldText(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60}h` : splitDuration(minutes);
}
