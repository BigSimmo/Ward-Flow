"use client";

import { useState } from "react";
import Link from "next/link";
import {
  MapPin,
  ShieldCheck,
  TriangleAlert,
  PhoneCall,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Route,
  Building2,
  BedSingle,
  Truck,
  Clock,
} from "lucide-react";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatInstantWithDay, splitDuration, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, referralForMovement, stageCopy } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, edShortName, siteByCode } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { departmentLabel, wardLabel } from "@/components/ward-management/ward-absence-labels";
import {
  URGENT_MARK_REASONS,
  changeReasonLabels,
  type UrgentMarkReason,
} from "@/components/ward-management/ward-change-reasons";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";

import styles from "./movements.module.css";

/**
 * Review fix-forward item 10 (2026-09-17): the same accessible-reason discipline
 * `ward-management-console.tsx`'s own `URGENT_FLAG_UNCHOSEN` already holds to — an `aria-disabled`
 * button with no further explanation tells an assistive-technology reader the button exists and
 * nothing about why it does not respond, the same shape `CANCEL_TRANSPORT_UNCHOSEN` fixed on the
 * console page first.
 */
const URGENT_FLAG_UNCHOSEN = "Choose why this patient is being flagged urgent first.";

/**
 * **TASK M6 — the per-movement detail drawer.**
 *
 * **SIX of the drawing's seven sections ship here.** *Watch and flag* is still held: nothing in this
 * model records that somebody is watching a movement, so the section has no state to read. 🔴 **It
 * is not stubbed** — a section heading over nothing reads as a category that exists and happens to
 * be empty, which is the opposite of what is true. **It is named in the footer instead, so a reader
 * comparing this against the drawing does not have to guess whether it was dropped, forgotten, or
 * refused.**
 *
 * **M7 ships *What you can do*, and it carries ONE action out of the drawing's four — OWNER RULING
 * 2026-09-12.** He accepted the recommendation on all three that had one:
 *
 *   - ✅ **Flag as urgent** — built below. The field, the event and the ranking rule already existed.
 *   - ❌ **Chase the ward** — declined. It is probably the same act as escalating, in softer words,
 *     and two controls for one act teach a coordinator that one of them does something else.
 *   - ❌ **Add to a shortlist** — declined. A stored list can disagree with the derived one the
 *     engine trusts, and then a coordinator is holding two answers to the same question.
 *   - ❌ **Record an override** — DECLINED, and it needed a second round to get there. The owner's
 *     blanket "yes to all your recommendations" covered the three above, which were recommendations;
 *     **this one was a QUESTION back to him, and a yes does not answer a question.** It was put to
 *     him again on its own and he ruled *"drop it as you recommend"*, 2026-09-12.
 *
 *     🔴 **The reason, because it is the part that could change — and it was stated WRONG first
 *     time.** This said an override is attached to *a placement*. **There is no placement in this
 *     model.** `Override` hangs off a `Movement`, and its keyed field is `unitIds` — the model's own
 *     words, *"the units referred to despite a failing gate — THE PARTIES OVERRIDDEN"*. **So an
 *     override records a REFERRAL made against a failing gate, and names the wards it was made to.**
 *     ⚠️ **Corrected after an adversarial review, which is the right outcome for a reason stated as
 *     "the part that can change": it is the part that most needs to be right.**
 *
 *     **The conclusion survives the correction intact** — a standalone control still has nothing to
 *     attach to. It would record that somebody overrode something, without the something. ⚠️ **And this system cannot yet say WHICH
 *     check was overridden even when one happens properly** — the Alerts screen renders that gap by
 *     name. A way to create overrides pointing at nothing would widen it.
 *
 *     ✅ **So this is worth revisiting on one trigger and no other: the day an override records the
 *     gate it overrode.** Until then the answer stays no.
 *
 * ⚠️ **THE DRAWER DOES NOT REPLACE THE WORKSPACE ROUTE, IT LINKS TO IT** (Q-4). The row keeps its
 * existing "Review patient" link unchanged; this is a second, faster face on the same record. **The
 * urgent flag is now the one thing it can change** — it was true until M7 that this drawer recorded
 * nothing at all, and that sentence has been removed from the footer rather than left to age.
 */

/**
 * 🔴 **THE PERSON SECTION NAMES THE PATIENT — OWNER RULING O-16.3, 2026-09-11: *"Yes show the
 * patient name."*** **It did not, until he ruled.**
 *
 * **What happened, because the sequence is the point:** the drawer originally read
 * `Referral.patientId` and `tests/ward-patient-link-default-deny.test.ts` refused it — *"a ward
 * learning where else a patient has been is exactly what this guard exists to stop. Hand this back
 * to Ward Lead rather than deciding it is fine and widening the allowlist yourself."* ✅ **The read
 * was removed, the conflict was put to the owner, and he decided.** 🔴 **The allowlist entry exists
 * because he overruled the recommendation to keep it denied — not because the guard was found
 * inconvenient.**
 *
 * **So ruling ② — a coordinator sees who the patient is wherever they are SELECTING or ACTING ON
 * that person — wins over D-14's default-deny ON THIS SCREEN, and on no other by implication.**
 *
 * ⚠️ **THE GRANULARITY IS THE BOUND THAT KEEPS THIS COMPATIBLE WITH FD-23:** one movement's OWN
 * linked referral and the person it names. **Never a list of a person's referrals, never where else
 * they have been referred, never a count.** FD-23 protects disclosure of WHERE; this discloses no
 * place, no ward and no other episode.
 *
 * 🔴 **AND THIS IS NOT GRANDFATHERED PAST THE SEED. EVERY PATIENT IN THIS APP TODAY IS INVENTED.**
 * ⚠️ **The moment real data reaches it, rendering a name on a coordinator's board is a live privacy
 * decision that needs its own review. This ruling was made about synthetic data and says nothing
 * about real data.** **It will stop being obvious that these are not real people, and this comment
 * is where somebody should find that out.**
 *
 * **The three absences stay, and they are still three different facts.** A movement with no
 * referral, a referral that names nobody, and a referral naming somebody this system does not hold
 * are not the same situation, and a coordinator can act on the difference. **None is a blank and
 * none is the word "unknown".**
 *
 * ⚠️ **Measured on this seed: 24 referrals, 2 carrying a `patientId`, 2 movements carrying a
 * `referralId`, 0 reaching a person** — the two linked referrals are not the two pointed at. **So
 * the NAMED branch is unreachable from the seed and is tested with a hand-built fixture;
 * `RAISE_REFERRAL` links one raised live, so it is unreachable-from-the-seed, not dead.**
 */
export function personLine(movement: Movement, referrals: Referral[], patients: readonly Patient[]): string {
  const referral = referralForMovement(movement, referrals);
  if (referral === undefined) {
    return "No referral is recorded against this movement, so there is no person to name.";
  }
  if (referral.patientId === undefined) {
    return `Referral ${referral.id} raised this movement and names no person, so nobody can be identified from it.`;
  }
  const patient = patients.find((candidate) => candidate.id === referral.patientId);
  if (patient === undefined) {
    return `Referral ${referral.id} names ${referral.patientId}, and this system holds no record under that.`;
  }
  return patient.umrn ? `${patientDisplayName(patient)} · UMRN: ${patient.umrn}` : patientDisplayName(patient);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={styles.drawerSection}>
      <h3 className={styles.drawerSectionTitle}>{title}</h3>
      {children}
    </section>
  );
}

function getProgressPercent(stage: Movement["stage"]): string {
  switch (stage) {
    case "placement_requested":
      return "15%";
    case "destination_review":
      return "30%";
    case "accepted_awaiting_bed":
      return "45%";
    case "pulled":
      return "60%";
    case "handover_ready":
      return "75%";
    case "moving":
      return "88%";
    case "arrived":
      return "100%";
  }
}

function getWhereaboutsText(
  movement: Movement,
  originFullName: string,
  originShort: string,
  acceptedUnitName: string | undefined,
  siteName: string | undefined,
): string {
  const dest = acceptedUnitName ? `${acceptedUnitName}${siteName ? ` (${siteName})` : ""}` : "destination unit";
  if (movement.stage === "moving") {
    const provider = movement.transport?.provider ?? "Transport Service";
    const cad = movement.transport?.cadNumber ? ` (${movement.transport.cadNumber})` : "";
    const escort = movement.transport?.escortRequired ? "Clinical escort onboard." : "Standard transit crew.";
    return `In transit via ${provider}${cad}. ${escort} Departed ${originShort} heading to ${dest}.`;
  }
  if (movement.stage === "handover_ready") {
    const transportStatus = movement.transport
      ? `in departure bay awaiting ${movement.transport.provider} collection.`
      : "awaiting transport booking.";
    return `At ${originShort}. Clinical handover complete; ${transportStatus}`;
  }
  if (movement.stage === "arrived") {
    return `Arrived at ${dest}. Inpatient admission complete.`;
  }
  if (movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled") {
    return `At ${originShort}. Bed allocated at ${dest}; assembling handover and transport booking.`;
  }
  return `At ${originFullName} undergoing destination review. Awaiting receiving ward agreement.`;
}

export function MovementDrawer({
  movement,
  now,
  units,
  referrals,
  patients,
  edAccessTargetMinutes,
  dispatch,
  onClose,
}: {
  movement: Movement | undefined;
  now: Instant;
  /** Threaded from the screen for the same reason `units` is — one provider reader per screen. */
  referrals: Referral[];
  patients: readonly Patient[];
  /**
   * The LIVE units, threaded from the screen rather than read from the fixture here.
   *
   * The one-source-of-truth guard reddened on this file the moment M6 met the fold. It was right
   * to: `unitById` reads the module fixture, and a drawer that names a ward from the fixture while
   * the board behind it names the same ward from reducer state will disagree with itself the first
   * time a unit changes - with every other gate green, because both calls return a `Unit`.
   *
   * Threaded as a prop rather than pulled with `useWardFlow` here, matching `TransportRow` on the
   * screen that owns this drawer: the parent already holds the live array, and one reader of the
   * provider per screen keeps the source obvious.
   */
  units: Unit[];
  /**
   * Coordinator-configured ED access target, threaded from the screen's `configuration` rather
   * than the module default. Reading the default constant here would ignore a saved settings
   * change (`tests/ward-configuration-read-sites.test.ts`).
   */
  edAccessTargetMinutes: number;
  /**
   * Threaded from the screen for the same reason `units` and `referrals` are — one provider reader
   * per screen, so the thing this drawer writes to is visibly the same store the board behind it
   * reads from.
   */
  dispatch: (event: WardFlowEvent) => void;
  onClose: () => void;
}) {
  // Item 37 (2026-09-17): the flag now needs a reason chosen from URGENT_MARK_REASONS, same
  // draft-until-dispatched discipline as every other reason picker in this codebase. Declared
  // before the early return below so hook order never depends on whether `movement` resolves.
  const [urgentFlagReason, setUrgentFlagReason] = useState<UrgentMarkReason | undefined>(undefined);

  if (movement === undefined) return null;

  const open = isOpen(movement);
  const originEd = edById(movement.originEdId);
  const accepted =
    movement.acceptedUnitId === undefined
      ? undefined
      : units.find((candidate) => candidate.id === movement.acceptedUnitId);

  // Owner, 26 Sept 2026: the patient's name, not the WF journey number.
  const subjectPatient = resolveSubjectPatient(movement, { patients, referrals });

  const originFullName = departmentLabel(movement.originEdId, originEd?.name);
  const originShort = originEd ? edShortName(originEd) : movement.originEdId;
  const originSite = originEd?.siteCode ? siteByCode(originEd.siteCode) : undefined;
  const originHospitalName =
    originSite?.name ?? (originEd?.name ? originEd.name.replace(/ Emergency Department$/i, "") : undefined);
  const originDeptName = originEd ? "Emergency Department" : originFullName;
  const destSiteName = accepted ? siteByCode(accepted.siteCode)?.name : undefined;

  const isNoBlocker =
    !movement.blocker ||
    movement.blocker === "No blocker" ||
    movement.blocker.startsWith("None —") ||
    movement.blocker.startsWith("None -");

  const waitMinutes = Math.max(now - movement.openedAt, 0);
  const totalWaitFormatted = splitDuration(waitMinutes);
  const pastAccessTarget = waitMinutes > edAccessTargetMinutes;

  const progressPct = getProgressPercent(movement.stage);

  const stageTagClass = movement.flaggedUrgent
    ? styles.tagRed
    : movement.stage === "moving"
      ? styles.tagBlue
      : movement.stage === "handover_ready" || movement.stage === "arrived"
        ? styles.tagGreen
        : styles.tagAmber;

  const patientFirstName =
    subjectPatient.formalName.split(",")[1]?.trim() ||
    subjectPatient.formalName.split(" ")[0] ||
    subjectPatient.formalName;

  return (
    <Sheet
      open
      onClose={onClose}
      contentClassName={styles.drawerSheetContent}
      bodyClassName={styles.drawerSheetBody}
      title={`${subjectPatient.formalName} — what is recorded`}
      headerLeading={<div className={styles.drawerAvatarMonogram}>{subjectPatient.formalName.charAt(0)}</div>}
      descriptionContent={
        <div className={styles.drawerSubline}>
          {subjectPatient.umrn ? <span className={styles.drawerUmrnBadge}>UMRN: {subjectPatient.umrn}</span> : null}
          <span>
            {movement.cohort} · {movement.sex} · {movement.security === "Secure" ? "Needs locked bed" : "Open ward"}
          </span>
          {movement.legalForm ? (
            <span className={styles.drawerLegalTag}>{legalFormName(movement.legalForm)}</span>
          ) : null}
        </div>
      }
      headerActions={
        <div className={styles.drawerHeaderStatusWrap}>
          <span className={`${styles.corridorStatusTag} ${stageTagClass}`}>
            <span className={styles.statusDot} />
            {movement.flaggedUrgent ? "URGENT FLAG" : stageCopy[movement.stage].label.toUpperCase()}
          </span>
          <span className={styles.drawerUrgencyText}>Urgency {movement.urgency} of 3</span>
        </div>
      }
    >
      {/* 🚀 Visual Hero: Current Movement (Simplified & Project Aligned) */}
      <div className={styles.corridorCard}>
        <div className={styles.corridorTitleRow}>
          <span className={styles.corridorSectionTitle}>
            <Route className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Current movement</span>
          </span>
          <span className={`${styles.corridorStatusTag} ${stageTagClass}`}>
            <span className={styles.statusDot} />
            {movement.flaggedUrgent ? "URGENT" : stageCopy[movement.stage].label.toUpperCase()}
          </span>
        </div>

        {/* 2-Hub Physical Highway */}
        <div className={styles.corridorGrid}>
          {/* Origin Hub */}
          <div className={styles.corridorHub}>
            <div className={styles.hubRole}>
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Departing from</span>
            </div>
            <div className={styles.hubName}>{originDeptName}</div>
            <div className={styles.hubMeta}>{originHospitalName ?? originFullName}</div>
            <div className={styles.hubFoot}>
              <span>
                {movement.stage === "moving" || movement.stage === "arrived" ? "Departed:" : "Opened:"}{" "}
                <strong>{formatInstantWithDay(movement.openedAt, now)}</strong>
              </span>
            </div>
          </div>

          {/* Highway Vector */}
          <div className={styles.corridorHighway}>
            <span className={styles.transitBadge}>
              <Truck className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span>
                {movement.transport?.provider ??
                  (movement.transportNeed?.needed === false ? "Walking Transfer" : "Transport Leg")}
              </span>
            </span>
            <div className={styles.transitTrack}>
              <div className={styles.transitFill} style={{ width: progressPct }} />
            </div>
            <div className={styles.transitVehicle}>
              {movement.transport?.cadNumber ? `CAD #${movement.transport.cadNumber}` : "Dispatch Pending"}
            </div>
            <div className={styles.transitEta}>{stageCopy[movement.stage].label}</div>
          </div>

          {/* Target Hub */}
          <div className={accepted ? styles.corridorHubAccepted : styles.corridorHub}>
            <div className={styles.hubRole}>
              <BedSingle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{accepted ? "Destination ward" : "Awaiting ward"}</span>
            </div>
            <div className={styles.hubName}>{accepted ? accepted.name : "Awaiting Ward"}</div>
            <div className={styles.hubMeta}>
              {accepted ? (destSiteName ?? "Specialist Inpatient Unit") : "Statewide bed pool"}
            </div>
            <div className={styles.hubFoot}>
              <span>
                Status:{" "}
                <strong>{accepted ? (movement.stage === "arrived" ? "Admitted" : "Bed Prepared") : "In Review"}</strong>
              </span>
              {accepted ? (
                <Link
                  href={`/mockups/ward-flow/board/${accepted.id}`}
                  className={styles.corridorWardLink}
                  title={`Open ${accepted.name} Bed Board`}
                >
                  <span>Board</span>
                  <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        {/* Whereabouts Beacon */}
        <div className={styles.whereaboutsBanner}>
          <div className={styles.whereaboutsIconBox}>
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className={styles.whereaboutsContent}>
            <div className={styles.whereaboutsHeading}>Where is {patientFirstName} right now?</div>
            <p className={styles.whereaboutsText}>
              {getWhereaboutsText(movement, originFullName, originShort, accepted?.name, destSiteName)}
            </p>
          </div>
        </div>
      </div>

      {/* Dual Detail Deck: Transport & Escort + Wait Time & Target */}
      <div className={styles.telemetryDeck}>
        <div className={styles.telemetryBox}>
          <div className={styles.telemetryTitle}>
            <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Transport &amp; escort</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>Carrier:</span>
            <strong>
              {movement.transport?.provider ??
                (movement.transportNeed?.needed === false ? "Walking transfer" : "Not yet booked")}
            </strong>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>CAD booking #:</span>
            <strong className={styles.telemetryMono}>{movement.transport?.cadNumber ?? "—"}</strong>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>Clinical escort:</span>
            <strong className={movement.transport?.escortRequired ? styles.textDanger : undefined}>
              {movement.transport?.escortRequired ? "Escort required (Nurse + Security)" : "None needed"}
            </strong>
          </div>
          {movement.legalForm ? (
            <div className={styles.telemetryItem}>
              <span className={styles.telemetryLabel}>Legal form:</span>
              <strong className={styles.textAccent}>{legalFormName(movement.legalForm)}</strong>
            </div>
          ) : null}
        </div>

        <div className={styles.telemetryBox}>
          <div className={styles.telemetryTitle}>
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Wait time &amp; transfer target</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>Time waiting:</span>
            <strong className={styles.telemetryMono}>{totalWaitFormatted}</strong>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>ED access target:</span>
            <span className={styles.telemetryMono}>{splitDuration(edAccessTargetMinutes)}</span>
          </div>
          <div className={styles.telemetryItem}>
            <span className={styles.telemetryLabel}>Target status:</span>
            <strong className={pastAccessTarget ? styles.textDanger : styles.textGood}>
              {pastAccessTarget
                ? `Past access target by ${splitDuration(waitMinutes - edAccessTargetMinutes)}`
                : `Within access target (${splitDuration(edAccessTargetMinutes - waitMinutes)} left)`}
            </strong>
          </div>
        </div>
      </div>

      {/* Delay Barrier / Transfer Status Banner */}
      <div className={`${styles.flowCheckBanner} ${isNoBlocker ? styles.flowCheckGood : styles.flowCheckBlocked}`}>
        {isNoBlocker ? (
          <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
        )}
        <div>
          <strong>{isNoBlocker ? "Transfer status:" : "Delay barrier:"}</strong>{" "}
          {isNoBlocker
            ? `All checks clear. Bed allocated at ${
                accepted ? accepted.name : "receiving ward"
              }. Transport and handover ready.`
            : movement.blocker}
        </div>
      </div>

      {/* Modal Action Bar */}
      <div className={styles.drawerActionBar}>
        <div className={styles.actionGroupLeft}>
          {movement.flaggedUrgent ? (
            <button
              type="button"
              className={styles.actionUrgentRemove}
              data-testid="ward-movement-drawer-urgent-toggle"
              onClick={() =>
                dispatch({
                  type: "CLEAR_MOVEMENT_URGENT_FLAG",
                  role: "coordinator",
                  now,
                  movementId: movement.id,
                })
              }
            >
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Remove the urgent flag</span>
            </button>
          ) : open ? (
            <div className={styles.drawerReasonRow} style={{ marginTop: 0 }}>
              <label className="sr-only" htmlFor="ward-movement-drawer-urgent-reason">
                Why is this urgent?
              </label>
              <select
                id="ward-movement-drawer-urgent-reason"
                className={styles.drawerReasonSelect}
                data-testid="ward-movement-drawer-urgent-reason"
                value={urgentFlagReason ?? ""}
                onChange={(chosen) => {
                  const value = chosen.target.value;
                  setUrgentFlagReason(
                    URGENT_MARK_REASONS.includes(value as UrgentMarkReason) ? (value as UrgentMarkReason) : undefined,
                  );
                }}
              >
                <option value="">Choose why this is urgent…</option>
                {URGENT_MARK_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {changeReasonLabels[reason]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.actionUrgentBtn}
                data-testid="ward-movement-drawer-urgent-toggle"
                aria-disabled={urgentFlagReason === undefined ? "true" : undefined}
                aria-describedby={urgentFlagReason === undefined ? "ward-movement-drawer-urgent-blocked" : undefined}
                title={urgentFlagReason === undefined ? URGENT_FLAG_UNCHOSEN : undefined}
                onClick={
                  urgentFlagReason === undefined
                    ? ignoreUnavailableActivation
                    : () => {
                        dispatch({
                          type: "FLAG_MOVEMENT_URGENT",
                          role: "coordinator",
                          now,
                          movementId: movement.id,
                          reason: urgentFlagReason,
                        });
                        setUrgentFlagReason(undefined);
                      }
                }
              >
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Flag this patient as urgent</span>
              </button>
              {urgentFlagReason === undefined ? (
                <span id="ward-movement-drawer-urgent-blocked" className="sr-only">
                  {URGENT_FLAG_UNCHOSEN}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className={styles.actionGroupRight}>
          <button
            type="button"
            className={styles.actionBtnSecondary}
            title="Call ward desk"
            onClick={() => {
              window.location.href = "tel:0894313333";
            }}
          >
            <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Call Ward Desk</span>
          </button>

          {accepted ? (
            <Link
              href={`/mockups/ward-flow/board/${accepted.id}`}
              className={styles.actionBtnPrimary}
              title={`Open ${accepted.name} Bed Board`}
            >
              <span>Open {accepted.name}</span>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          ) : null}

          <Link
            href={`/mockups/ward-flow/movements/${movement.id}`}
            className={styles.actionBtnSecondary}
            title="Open movement in full workspace"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Workspace</span>
          </Link>

          <button type="button" className={styles.actionBtnSecondary} onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>

      {/* Statutory & Clinical Audit Register (5 Sections) */}
      <details className={styles.auditAccordion}>
        <summary className={styles.auditSummary}>
          <div className={styles.auditSummaryLabel}>
            <strong>Statutory &amp; Clinical Audit Register</strong>
            <span className={styles.auditSummaryBadge}>5 Sections</span>
          </div>
          <ChevronDown className={styles.auditSummaryChevron} aria-hidden="true" />
        </summary>
        <div className={styles.auditBody}>
          <Section title="Person">
            <p className={styles.drawerLine}>{personLine(movement, referrals, patients)}</p>
            <ul className={styles.drawerList}>
              <li>Sex recorded as {movement.sex}</li>
              <li>
                {movement.cohort} · {movement.security === "Secure" ? "needs a locked bed" : "open ward"}
              </li>
              <li>Urgency {movement.urgency} of 3</li>
              <li>Owned by {movement.owner}</li>
            </ul>
            <p className={styles.drawerAbsent}>
              Every person in this prototype is invented. Nobody named here is a real patient.
            </p>
          </Section>

          <Section title="Journey">
            <p className={styles.drawerLine}>
              {stageCopy[movement.stage].label} · opened {formatInstantWithDay(movement.openedAt, now)} · from{" "}
              {departmentLabel(movement.originEdId, originEd?.name)}
            </p>
            {movement.stageChanges.length === 0 ? (
              <p className={styles.drawerAbsent}>
                No stage change has been recorded, so this movement has not moved since it opened.
              </p>
            ) : (
              <ul className={styles.drawerList}>
                {movement.stageChanges.map((change) => (
                  <li key={`${change.at} ${change.to}`}>
                    {change.from === undefined ? "Opened" : stageCopy[change.from].label} → {stageCopy[change.to].label}{" "}
                    · {formatInstantWithDay(change.at, now)} · {change.by}
                    {change.reason === undefined ? "" : ` · ${change.reason}`}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Which wards were asked">
            {movement.referredUnitIds.length === 0 ? (
              <p className={styles.drawerAbsent}>No ward has been asked yet.</p>
            ) : (
              <ul className={styles.drawerList}>
                {movement.referredUnitIds.map((unitId) => {
                  const unit = units.find((candidate) => candidate.id === unitId);
                  const decline = movement.declines.find((entry) => entry.unitId === unitId);
                  return (
                    <li key={unitId}>
                      {wardLabel(unitId, unit?.name)}
                      {movement.acceptedUnitId === unitId
                        ? " · accepted"
                        : decline
                          ? ` · refused — ${decline.reason}`
                          : " · no answer yet"}
                    </li>
                  );
                })}
              </ul>
            )}
            {accepted === undefined ? null : (
              <p className={styles.drawerLine}>
                Accepted destination: {accepted.name}{" "}
                <Link
                  href={`/mockups/ward-flow/board/${accepted.id}`}
                  className={styles.jumpToWardLink}
                  title={`Open ${accepted.name} Bed Board`}
                >
                  Open on Ward Board →
                </Link>
              </p>
            )}
          </Section>

          <Section title="Escalation">
            {movement.escalation === undefined ? (
              <p className={styles.drawerAbsent}>
                Nothing has been escalated on this movement. That is a record, not a gap.
              </p>
            ) : (
              <p className={styles.drawerLine}>
                Escalated to {movement.escalation.contact} on {formatInstantWithDay(movement.escalation.at, now)}, after{" "}
                {movement.escalation.triedUnitIds.length}{" "}
                {movement.escalation.triedUnitIds.length === 1 ? "ward was" : "wards were"} tried.
              </p>
            )}
          </Section>

          <Section title="Transport leg">
            {movement.transport === undefined ? (
              <p className={styles.drawerAbsent}>
                No transport leg has been booked, so there is nothing to say about a vehicle.
              </p>
            ) : (
              <p className={styles.drawerLine}>
                {movement.transport.provider}
                {movement.transport.escortRequired ? " · escort required" : ""}
                {movement.transport.formRequired ? " · a form is required" : ""}
                {movement.transport.acceptedAt === undefined
                  ? ""
                  : ` · accepted ${formatInstantWithDay(movement.transport.acceptedAt, now)}`}
              </p>
            )}
            {movement.legalForm === undefined ? null : (
              <p className={styles.drawerLine}>Legal authority: {legalFormName(movement.legalForm)}</p>
            )}
          </Section>

          <Section title="What you can do">
            <p className={styles.drawerLine}>
              {movement.flaggedUrgent
                ? open
                  ? "Flagged urgent. This patient leads the queue ahead of every urgency tier, including tier 1."
                  : "Flagged urgent. This movement is no longer in the queue, so the flag orders nothing now — removing it changes only the record."
                : open
                  ? "Not flagged. This patient is ordered by urgency tier and waiting time, like everybody else."
                  : "Not flagged — and this movement is no longer running, so it is not in the queue at all. Flagging it would change nothing."}
            </p>
            <p className={styles.drawerAbsent}>
              This is the only thing this drawer changes. Everything else about this movement is done in the full
              workspace.
            </p>
          </Section>

          <p className={styles.drawerFoot}>
            <strong>One section the drawing carries is not built</strong> — <em>Watch and flag</em>. Nothing in this
            system records that somebody is watching a movement, so there is no state for it to show;{" "}
            <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
              the full workspace
            </Link>{" "}
            is where this movement is worked on.
          </p>
        </div>
      </details>

      <div className={styles.syntheticFootnote}>
        Invented synthetic demonstration data for WA Health psychiatric bed flow evaluation. Zero real patient
        information.
      </div>
    </Sheet>
  );
}
