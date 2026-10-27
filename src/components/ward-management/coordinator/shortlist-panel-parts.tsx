import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { EligibilityGate } from "@/components/ward-management/ward-eligibility";
import { URGENCY_LEVELS, type BedRelease, type LegalStatus, type Unit } from "@/components/ward-management/ward-model";
import { wardScrollBehavior } from "@/components/ward-management/ward-scroll";
import { StatusGlyph } from "@/components/wf";

import shortlistStyles from "./shortlist-panel.module.css";

// Module-level helpers of `shortlist-panel.tsx`, moved unchanged (H-0283).
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

export function capacityLine(unit: Unit, bedReleases: BedRelease[], admissions: readonly Admission[]) {
  const states = bedStates(unit, admissions, bedReleases, []);
  const pendingPreparation = states.beingMadeReady;
  /*
   * 🔴 THE READY FIGURE IS CORRECT AND MUST NOT CHANGE. Nothing is subtracted from it for a
   * preparation note — asked whether a bed being cleaned should drop the ward's number or merely
   * refuse the pull, the owner chose the refusal, because the ward has not changed what it can
   * staff and its figures must not lurch as cleaning starts and stops. This line was missing the
   * qualifier, not the arithmetic: the reducer refuses PULL_PATIENT with "every free bed at X is
   * still being made ready", and this panel is where a coordinator picks a destination.
   *
   * ⚠️ SAID IN THIS LINE'S OWN RHYTHM RATHER THAN AS A SENTENCE, and that is deliberate. Every
   * other screen states it as prose beneath the figure, because a bare count beside "Ready 2" reads
   * as 21. Here the established shape is already `Label N · Label N`, so the count is separated from
   * the Ready figure by three other labelled figures and a delimiter — the misparse the sentence
   * form exists to prevent cannot occur. A shortlist is scanned, not read, and a paragraph here
   * would be skipped; this stays one scannable line.
   *
   * Appended only when there is one. An absence is silence, never "Being made ready 0".
   */
  const line = `Ready ${states.ready} · Pulled ${states.pulled} · Closed ${states.closed} · Occupied ${states.occupied}`;
  return pendingPreparation > 0 ? `${line} · Being made ready ${pendingPreparation}` : line;
}

/** Phone: brings the first fit row into view and focuses it, so the person picks the ward. */
export function focusFirstCandidate(from: HTMLElement) {
  // From the parent, never the control itself: Refer and Override carry `ward-shortlist-` test ids
  // too, and `closest` matches the element it starts on, which found no ward list (24 Oct 2026).
  const first = from.parentElement
    ?.closest("[data-testid^='ward-shortlist-']")
    ?.querySelector<HTMLElement>("[data-testid^='ward-shortlist-candidate-'][data-fit]");
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
