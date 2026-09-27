import { BED_RELEASE_BLOCKED_FIGURE_LABEL, isOpen } from "@/components/ward-management/ward-derivations";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import { wardSites } from "@/components/ward-management/ward-sites";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import type { WardMode, WardNavId } from "@/components/ward-management/ward-nav";

/**
 * **THE NUMBERS BESIDE THE SIDEBAR'S DESTINATIONS — owner's approved header/sidebar, 2026-09-06.**
 *
 * 🔴 **A COUNT AND NO COUNT ARE DIFFERENT STATEMENTS, WHICH IS WHY MOST DESTINATIONS GET NEITHER.**
 * A destination with no honest derivation gets nothing at all rather than a zero: a `0` beside
 * "Governance" asserts that the screen is empty, and nobody measured that. Every entry below names
 * the derivation it reads and none is computed here — the sidebar is the last place a clinical
 * figure should be authored.
 *
 * 🔴 **AND EVERY COUNT MUST MEAN SOMETHING DIFFERENT FROM ITS NEIGHBOURS.** The obvious count for
 * Delays is "how many rows are on the Delays screen", and it was rejected: `delayGroups` sorts
 * EVERY open movement into a cause (`awaiting_coordinator` is its fallback), so that figure is the
 * open-movement count by construction — identical to Movements' count, forever, with two different
 * labels over it. Two figures that agree look like confirmation. This counts the three severe
 * causes instead, which is the number somebody acts on and can never coincide with Movements'.
 *
 * ⚠️ **THE NOUN TRAVELS WITH THE NUMBER.** A bare numeral in a chip is read as "new since you last
 * looked" — the same misreading the header's Tasks control carries words to prevent. Each count
 * states what it counts, and `wardNavCountLabel` composes that into the link's accessible name so a
 * screen-reader user hears the meaning rather than a digit adrift from its label.
 */
export type WardNavCount = {
  value: number;
  /** What the number counts, in words. Becomes part of the link's accessible name. */
  noun: string;
  /**
   * True when the figure is something somebody must act on today.
   *
   * ⚠️ Consumed as ONE INPUT to the styling, never as the only one — see the stylesheet. Colour
   * alone cannot carry this: a forced-colours or colour-blind reader would lose it entirely.
   */
  urgent: boolean;
};

/**
 * Counts keyed by the id the sidebar already renders, so a destination and its number are joined
 * by the id in `ward-nav.ts` rather than by a second hand-written list of labels.
 */
export type WardNavCounts = Partial<Record<WardMode | WardNavId, WardNavCount>>;

export type WardNavCountInput = {
  movements: Movement[];
  units: Unit[];
  referrals: Referral[];
  bedReleases: readonly BedRelease[];
  leaveBeds: readonly LeaveBed[];
  now: Instant;
};

export function wardNavCounts(input: WardNavCountInput): WardNavCounts {
  const { movements, units, referrals, bedReleases, leaveBeds, now } = input;

  const open = movements.filter(isOpen);
  const rollup = serviceRollup(wardSites, units, [...bedReleases], [...leaveBeds], now);

  /*
   * `SEVERE_CAUSES` is `delays-derivations.ts`'s own list — a breached statutory deadline, one
   * expiring inside the hour, and a patient with nowhere lawful to go. Read from there rather than
   * restated here, so a cause the owner later promotes or demotes moves this figure with it.
   */
  const severe = delayGroups(movements, units, now)
    .filter((group) => SEVERE_CAUSES.includes(group.cause))
    .reduce((total, group) => total + group.movements.length, 0);

  const counts: WardNavCounts = {
    capacity: { value: rollup.service.availableNow, noun: "beds ready now", urgent: false },
    movements: { value: open.length, noun: "still open", urgent: false },
    // Josh, 25 Sept 2026: say what this counts (severe causes only; the Delays screen's Attention
    // tab also counts urgent patients outside the service, so the two figures can differ).
    delays: { value: severe, noun: "at a time limit or with nowhere to go", urgent: severe > 0 },
    discharges: {
      value: rollup.service.blockedToday,
      noun: BED_RELEASE_BLOCKED_FIGURE_LABEL.toLowerCase(),
      urgent: rollup.service.blockedToday > 0,
    },
    referrals: {
      /*
       * `queued` is `referralState`'s word for "no destination has accepted and they have not all
       * declined" — a referral still waiting on somebody. An accepted or fully-declined referral is
       * finished with and is not work.
       *
       * ⚠️ WF-13: `referralState` alone is not enough — it stays "queued" for a referral whose only
       * destination has been withdrawn, because `RECORD_REFERRER_WITHDRAWAL` never touches `state`
       * (O-17.11). The added `some(isAwaitingAnswer)` excludes a referral with nothing left
       * genuinely awaiting an answer, the same rule `referralQueueOrder` (`ward-referrals.ts`) now
       * applies.
       */
      value: referrals.filter(
        (referral) => referralState(referral) === "queued" && referral.destinations.some(isAwaitingAnswer),
      ).length,
      noun: "awaiting a decision",
      urgent: false,
    },
  };

  return counts;
}

/**
 * The link's accessible name: the label, then the number and what it counts.
 *
 * Mirrors `mobileSectionItemLabel` in `clinical-dashboard/dashboard-nav.tsx`, which composes the
 * same shape for the same reason. **The visible chip shows only the digit** — the words are what a
 * screen reader gets, and what stops "Delays 2" being heard as "Delays, two".
 */
export function wardNavCountLabel(label: string, count: WardNavCount | undefined): string {
  if (count === undefined) return label;
  return `${label}, ${count.value} ${count.noun}`;
}
