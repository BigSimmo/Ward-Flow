import { useMemo, type ReactNode } from "react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Instant } from "@/components/ward-management/ward-clock";
import { shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { useSharedReadyLookup } from "@/components/ward-management/use-shared-ready";
import { ORIGIN_NOT_RECORDED } from "@/components/ward-management/ward-model";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { EligibilityGate } from "@/components/ward-management/ward-eligibility";
import {
  URGENCY_LEVELS,
  type BedRelease,
  type LegalStatus,
  type Movement,
  type Referral,
  type Unit,
} from "@/components/ward-management/ward-model";
import { withSendingTeam } from "@/components/ward-management/referrals/referral-sending-team";
import { isAwaitingAnswer } from "@/components/ward-management/ward-referrals";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { StatusGlyph } from "@/components/wf";

import styles from "./coordinator.module.css";
import shortlistStyles from "./shortlist-panel.module.css";

// Module-level helpers of `shortlist-panel.tsx`, moved unchanged (H-0283).

/** H7 (D-210 (Josh, 14 Nov 2026)): the shortlist, with "bed ready" read from the shared Ready. */
export function useShortlistCandidates(movement: Movement | undefined, units: Unit[], now: Instant) {
  const ready = useSharedReadyLookup();
  return useMemo(
    () => (movement ? shortlistCandidates(movement, units, now, ready) : []),
    [movement, units, now, ready],
  );
}

/** One "Fits, ..." group of the shortlist: a heading with its count, then its rows. Nothing when empty. */
export function FitGroup({ kind, title, children }: { kind: string; title: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <div className={shortlistStyles.fitGroup} data-fit-group={kind}>
      <h5 className={shortlistStyles.fitGroupHead}>
        {title} <span className={shortlistStyles.fitGroupCount}>{children.length}</span>
      </h5>
      <ul className={styles.shortlistCandidateList}>{children}</ul>
    </div>
  );
}
/**
 * Human labels for the eligibility gates. Order here is irrelevant — the rendered list is sorted
 * failures-first from the real `GateResult[]`, never from this map's key order.
 *
 * ⚠️ **EXHAUSTIVE OVER `EligibilityGate`, AND THAT IS THE POINT — IT WAS NOT, AND A CLINICIAN SAW
 * THE CONSEQUENCE.** This was `Record<string, string>` read through `GATE_LABELS[gate.gate] ??
 * gate.gate`. A hand-listed map with a silent identifier fallback cannot fail: it degrades to
 * something that looks almost right, and nothing compared it to the gate list it was labelling.
 * When `sex_designation` was added to the movement path on 2026-09-02 — closing a live defect
 * where a Female Adult movement was returned eligible for the network's Male-only bed — this map
 * had no key for it, and the coordinator's shortlist rendered the raw string `sex_designation`
 * beside eight rows carrying sentences.
 *
 * Keyed on `EligibilityGate` now, so **a new gate is a compile error here rather than an
 * identifier on a clinician's screen.** Do not restore the `??` fallback and do not widen the key
 * back to `string`: both make this map incapable of failing again, which is the whole defect.
 */
export const GATE_LABELS: Record<EligibilityGate, string> = {
  acuity: "Acuity mix",
  age: "Age band",
  allocatable_bed: "Allocatable bed",
  authorisation: "Authorised hospital",
  capacity_freshness: "Capacity freshness",
  cohort: "Ward cohort",
  forensic: "Forensic history",
  legal_status: "Legal status",
  locked_bed_free: "Locked bed free",
  prior_decline: "Prior decline",
  security: "Security level",
  // 🔴 RENAMED FROM `sex_designation`, T10 (item 8, owner answer 17 September 2026): the ward's
  // own designation gate now reads the gender recorded at referral, never sex.
  gender_designation: "Gender designation",
  sex_mix: "Gender mix",
  specialling: "Specialling capacity",
};

/** Every `LegalStatus` value — the same hand-listed shape `ed-screen.tsx`'s own intake picker
 *  keeps, since `ward-model.ts` exports the type but no runtime list of its members. */
export const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

// Phase 7 Task 5: derived from `URGENCY_LEVELS` (`ward-model.ts`) rather than hand-listed —
// see that file's own doc comment on `SEXES` for the defect class this prevents.
export const URGENCY_OPTIONS = URGENCY_LEVELS;

/**
 * P125 (audit 27 Oct 2026): "Pulled" is the D-81/D-85 word and is not swapped. The shortlist says
 * once, in plain words (word-list.md: "A bed kept for one named, accepted incoming patient"), what
 * it means, with a way into the Help glossary. Exact text awaits Josh's confirmation.
 */
export const PULLED_EXPLANATION = "Pulled means a bed kept for one named, accepted incoming patient, for a set time.";
export const GLOSSARY_LINK_TEXT = "Help glossary";

/**
 * Home drawer polish (Josh, 3 Nov 2026): the shortlist keeps the road-distance caveat visible
 * (`ward-reference-distances.ts`: shown wherever a distance is) in one short line, and the full
 * wording moves to the Help glossary's "Road distance" entry beside Pulled.
 */
export const ROAD_DISTANCE_SHORT_CAVEAT = "Road distance only, not a clinical travel time.";

export function capacityLine(
  unit: Unit,
  bedReleases: BedRelease[],
  admissions: readonly Admission[],
  reservations: Parameters<typeof bedStates>[4] = [],
) {
  // WF-FIG-017: the same named holds as the ward detail, so a row never shows more Ready than it.
  const states = bedStates(unit, admissions, bedReleases, [], reservations);
  const pendingPreparation = states.beingMadeReady;
  /*
   * D-179 item 8 (Josh, 13 Nov 2026): Ready leaves out a bed still being made ready, and that bed is
   * counted on its own, in this line's own `Label N` rhythm. A bare count beside "Ready 2" would
   * read as 21; here three labelled figures and a delimiter sit between them. Appended only when
   * there is one: an absence is silence, never "Being made ready 0".
   */
  const line = `Ready ${states.ready} · Pulled ${states.pulled} · Closed ${states.closed} · Occupied ${states.occupied}`;
  return pendingPreparation > 0 ? `${line} · Being made ready ${pendingPreparation}` : line;
}

/** The wards a referral still waits on, as Home's list names them (H9, Josh 3 Nov 2026). */
export function referralAsked(referral: Referral, units: readonly Unit[]): string {
  const names = referral.destinations.filter(isAwaitingAnswer).map((arm) => {
    const destination = arm.destination;
    if (destination.kind !== "psychiatric_ward" || !destination.unitId) return "Any suitable ward";
    const unitId = destination.unitId;
    return units.find((unit) => unit.id === unitId)?.name ?? "Ward not recorded";
  });
  if (names.length === 0) return "No ward asked";
  return names.length === 1 ? names[0]! : `${names[0]} and ${names.length - 1} more`;
}

/** Where a referral came from: the sending site, and its team when one is named. */
export function referralFrom(referral: Referral): string {
  return withSendingTeam(referral.originSiteCode ?? ORIGIN_NOT_RECORDED, referral);
}

/** Phone: brings the first fit row into view and focuses it, so the person picks the ward. */
export function focusFirstCandidate(from: HTMLElement) {
  // From the parent, never the control itself: Refer and Override carry `ward-shortlist-` test ids
  // too, and `closest` matches the element it starts on, which found no ward list (24 Oct 2026).
  // On Home the drawer draws Refer into its pinned foot, outside the panel, so the drawer itself is
  // the scope there (H7, 3 Nov 2026).
  const scope = from.parentElement?.closest("[data-testid^='ward-shortlist-']") ?? from.closest("[role='dialog']");
  const first = scope?.querySelector<HTMLElement>("[data-testid^='ward-shortlist-candidate-'][data-fit]");
  first?.scrollIntoView({ block: "center", behavior: wardScrollBehavior() });
  first?.focus({ preventScroll: true });
}

export function Fact({
  label,
  value,
  testId,
  urgent = false,
}: {
  label: string;
  value: string;
  testId?: string;
  urgent?: boolean;
}) {
  return (
    <div className={shortlistStyles.fact} data-testid={testId} data-urgent={urgent ? "true" : undefined}>
      <dt>{label}</dt>
      <dd className={shortlistStyles.tabularNum} title={value}>
        {urgent ? <StatusGlyph tone="danger" size={9} /> : null}
        {value}
      </dd>
    </div>
  );
}

/**
 * One fact in the desktop details line ("Male · Adult · Open · Form 4C"): the label is kept for
 * assistive technology and the value shows on screen (Home placement redesign, Josh 19 Oct 2026).
 */
export function InlineFact({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className={shortlistStyles.inlineFact} data-testid={testId}>
      <dt className="sr-only">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
