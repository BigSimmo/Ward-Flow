import { splitDuration, type Instant } from "@/components/ward-management/ward-clock";

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
export const BED_HOLD_AT_RISK_MINUTES = 60;

export type BedHoldState = "held" | "at-risk" | "lapsed";

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

/** True when the hold has lapsed: the one bed-hold condition that belongs in Act now. */
export function bedHoldLapsed(pullExpiresAt: Instant | undefined, now: Instant): boolean {
  return bedHold(pullExpiresAt, now)?.state === "lapsed";
}
