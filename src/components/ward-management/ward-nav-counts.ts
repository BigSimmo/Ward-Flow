import { BED_RELEASE_BLOCKED_FIGURE_LABEL, isOpen } from "@/components/ward-management/ward-derivations";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { serviceRollup } from "@/components/ward-management/ward-morning-rollup";
import { isAwaitingAnswer, referralState } from "@/components/ward-management/ward-referrals";
import type { DueSoonThresholds, Instant } from "@/components/ward-management/ward-clock";
import { rememberLastCall } from "@/components/ward-management/ward-last-call";
import type {
  BedRelease,
  HealthService,
  LeaveBed,
  Movement,
  Referral,
  Site,
  Unit,
} from "@/components/ward-management/ward-model";
import type { WardMode, WardNavId } from "@/components/ward-management/ward-nav";
import { movementBelongsToService } from "@/components/ward-management/ward-service-scope";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { totalReadyBedsNow } from "@/components/ward-management/ward-bed-states";
import type { Admission } from "@/components/ward-management/ward-admissions";

/**
 * **THE NUMBERS BESIDE THE SIDEBAR'S DESTINATIONS — owner's approved header/sidebar, 2026-09-06.**
 *
 * 🔴 **A COUNT AND NO COUNT ARE DIFFERENT STATEMENTS, WHICH IS WHY MOST DESTINATIONS GET NEITHER.**
 * A destination with no honest derivation gets nothing at all rather than a zero: a `0` beside
 * "Governance" asserts that the screen is empty, and nobody measured that. Every entry below names
 * the derivation it reads and none is computed here — the sidebar is the last place a clinical
 * figure should be authored.
 *
 * 🔴 **A BADGE SHOWS THE NUMBER ITS SCREEN LEADS WITH, IN THE SAME WORDS** (overall review,
 * 20 Oct 2026, idea A2). The Waiting badge used to count the three severe delay causes ("2 at a
 * time limit or with nowhere to go") while the Waiting screen led with "70 people waiting", so the
 * menu and the page disagreed on sight. Waiting now leads with the one "waiting" figure,
 * `waitingInEds` (people physically in a department awaiting a bed), and so does its badge. That is
 * still never Movements' figure: Movements counts every open journey, including people already on
 * the road ("still open"), so the two numbers differ whenever anybody is in transit and each says
 * what it counts. The severe count lives on as `need`, for the phone menu's Needs you row, which
 * opens Waiting filtered to exactly those people.
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
  /**
   * A narrower figure from the same screen that somebody must act on, for the phone menu's Needs you
   * row (overall review, 20 Oct 2026). The badge itself always shows the figure its screen leads
   * with, in the same words (rule A2, "badges mean what the screen means"); a severe subset that the
   * screen does not lead with travels here, under its own noun, never in the badge.
   */
  need?: { value: number; noun: string };
};

/**
 * Counts keyed by the id the sidebar already renders, so a destination and its number are joined
 * by the id in `ward-nav.ts` rather than by a second hand-written list of labels.
 */
export type WardNavCounts = Partial<Record<WardMode | WardNavId, WardNavCount>>;

export type WardNavCountInput = {
  movements: Movement[];
  units: Unit[];
  /** The scenario's network (`useWardNetwork().sites`). */
  sites: readonly Site[];
  referrals: Referral[];
  bedReleases: readonly BedRelease[];
  leaveBeds: readonly LeaveBed[];
  /**
   * Read so "beds ready now" leaves out a bed pulled for an incoming patient (`readyBedsNow`).
   * Optional only while every caller is brought across; omitted, no pull is left out.
   */
  admissions?: readonly Admission[];
  now: Instant;
  thresholds: DueSoonThresholds;
  /** The service chosen in the header (`useServiceScope`); Waiting's badge follows it as its title does. */
  service?: HealthService | null;
};

/**
 * The rail, the phone dock and menu and the sidebar all ask for these counts on every render, and
 * the delay groups behind them are costly, so the answer is shared until a record or the clock
 * minute changes (`ward-last-call.ts`).
 */
export const wardNavCounts = rememberLastCall(deriveWardNavCounts, (input: WardNavCountInput) => [
  input.movements,
  input.units,
  input.sites,
  input.referrals,
  input.bedReleases,
  input.leaveBeds,
  input.admissions,
  input.now,
  input.thresholds,
  input.service,
]);

function deriveWardNavCounts(input: WardNavCountInput): WardNavCounts {
  const { movements, units, sites, referrals, bedReleases, leaveBeds, admissions, now, thresholds, service } = input;
  // Waiting's screen filters to the chosen service before titling itself, so its badge counts the same people.
  const waitingMovements = service
    ? movements.filter((movement) => movementBelongsToService(movement, service, units))
    : movements;

  const open = movements.filter(isOpen);
  const rollup = serviceRollup(sites, units, [...bedReleases], [...leaveBeds], now);

  /*
   * `SEVERE_CAUSES` is `delays-derivations.ts`'s own list — a breached statutory deadline, one
   * expiring inside the hour, and a patient with nowhere lawful to go. Read from there rather than
   * restated here, so a cause the owner later promotes or demotes moves this figure with it.
   */
  const severe = delayGroups(movements, units, now, thresholds)
    .filter((group) => SEVERE_CAUSES.includes(group.cause))
    .reduce((total, group) => total + group.movements.length, 0);

  const counts: WardNavCounts = {
    // Audit 6 (Josh, 20 Oct 2026): the one ready figure, which leaves out beds pulled for an incoming patient.
    capacity: { value: totalReadyBedsNow(units, admissions ?? [], bedReleases), noun: "beds ready now", urgent: false },
    movements: { value: open.length, noun: "still open", urgent: false },
    // Overall review, 20 Oct 2026: the badge is Waiting's own title figure, in its words. The severe
    // causes (Josh, 25 Sept 2026) stay as the Needs you figure, which opens Waiting filtered to them.
    delays: {
      value: waitingInEds(waitingMovements, now).total,
      noun: "waiting in ED",
      urgent: false,
      need: { value: severe, noun: "at a time limit or with nowhere to go" },
    },
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
       * ⚠️ `referralState` alone is not enough — it stays "queued" for a referral whose only
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
