"use client";

import { useState } from "react";
import Link from "next/link";

import { ignoreUnavailableActivation } from "@/components/ui-primitives";
import { Sheet } from "@/components/ui/sheet";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { isOpen, referralForMovement, stageCopy } from "@/components/ward-management/ward-derivations";
import { legalFormName } from "@/components/ward-management/ward-legal-forms";
import { patientDisplayName, type Patient } from "@/components/ward-management/ward-patients";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
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

function getStageIndex(stage: Movement["stage"]): number {
  switch (stage) {
    case "placement_requested":
      return 0;
    case "destination_review":
      return 1;
    case "accepted_awaiting_bed":
      return 2;
    case "pulled":
      return 3;
    case "handover_ready":
      return 4;
    case "moving":
      return 5;
    case "arrived":
      return 6;
  }
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

function getWhereaboutsText(movement: Movement, originEdName: string, acceptedUnitName: string | undefined): string {
  if (movement.stage === "moving") {
    const provider = movement.transport?.provider ?? "Transport Service";
    const escort = movement.transport?.escortRequired ? "Escort onboard." : "No escort required.";
    return `En route on Highway transfer corridor via ${provider}. ${escort} Departed ${originEdName}.`;
  }
  if (movement.stage === "handover_ready") {
    const transportStatus = movement.transport
      ? `awaiting ${movement.transport.provider} collection.`
      : "awaiting transport booking.";
    return `Physically present in ${originEdName}. Clinical handover complete; ${transportStatus}`;
  }
  if (movement.stage === "arrived") {
    return `Arrived and admitted to ${acceptedUnitName ?? "destination ward"}.`;
  }
  if (movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled") {
    return `At ${originEdName}. Bed allocated at ${acceptedUnitName ?? "destination ward"}; preparing transfer packet.`;
  }
  return `In ${originEdName} undergoing destination placement review. Awaiting receiving ward agreement.`;
}

export function MovementDrawer({
  movement,
  now,
  units,
  referrals,
  patients,
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

  const sIndex = getStageIndex(movement.stage);
  const originFullName = departmentLabel(movement.originEdId, originEd?.name);
  const originShort = originEd?.name ?? movement.originEdId;
  const isNoBlocker =
    !movement.blocker ||
    movement.blocker === "No blocker" ||
    movement.blocker.startsWith("None —") ||
    movement.blocker.startsWith("None -");
  const blockerAlertClass = isNoBlocker ? styles.blockerAlertGood : styles.blockerAlert;

  const intakeDone = sIndex >= 0;
  const intakeTime = formatInstantWithDay(movement.openedAt, now);

  const allocationDone = sIndex >= 2;
  const allocationActive = sIndex === 1;
  const allocationStatus = allocationDone ? "✓ Accepted" : allocationActive ? "● In Review" : "—";
  const allocationTime = movement.acceptedAt
    ? formatInstantWithDay(movement.acceptedAt, now)
    : allocationActive
      ? "In Review"
      : "—";

  const handoverDone = sIndex >= 4;
  const handoverActive = sIndex === 3;
  const handoverStatus = handoverDone ? "✓ Ready" : handoverActive ? "● Pulled" : "—";
  const handoverTime = handoverDone ? "Handover Ready" : handoverActive ? "Bed Pulled" : "—";

  const transportDone = sIndex >= 6;
  const transportActive = sIndex === 5;
  const transportBooked = sIndex === 4 && movement.transport !== undefined;
  const transportStatus = transportActive ? "● Driving" : transportBooked ? "Booked" : transportDone ? "✓ Done" : "—";
  const transportTime = movement.transport?.cadNumber ?? (movement.transport?.provider ? "Booked" : "—");

  const admissionDone = sIndex >= 6;
  const admissionStatus = admissionDone ? "✓ Arrived" : "Pending";
  const admissionTime = accepted ? accepted.name : "Pending Bed";

  return (
    <Sheet open onClose={onClose} title={`${subjectPatient.formalName} — what is recorded`}>
      {/* 🚀 Visual Hero: Spatial Horizon Corridor */}
      <div className={styles.corridorCard}>
        <div className={styles.corridorHeroHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className={styles.patientMonogram}>{subjectPatient.formalName.charAt(0)}</div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <strong style={{ fontSize: "1rem", color: "var(--ward-heading, var(--ink))" }}>
                  {subjectPatient.formalName}
                </strong>
                {subjectPatient.umrn ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "0.75rem",
                      padding: "1px 5px",
                      background: "var(--surface-2, #f1f5f9)",
                      borderRadius: "4px",
                      fontWeight: 600,
                    }}
                  >
                    {subjectPatient.umrn}
                  </span>
                ) : null}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--ward-muted, #64748b)", marginTop: "2px" }}>
                {movement.cohort} · {movement.sex} · {movement.security === "Secure" ? "Needs locked bed" : "Open ward"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
            <span
              className={styles.corridorTag}
              style={{
                background: movement.flaggedUrgent ? "var(--ward-danger-soft, #fee2e2)" : "var(--accent-soft, #eff6ff)",
                color: movement.flaggedUrgent ? "var(--ward-danger, #dc2626)" : "var(--accent-ink, #1d4ed8)",
                border: `1px solid ${movement.flaggedUrgent ? "var(--ward-danger-border, #fca5a5)" : "var(--accent-border, #bfdbfe)"}`,
              }}
            >
              {movement.flaggedUrgent ? "● URGENT FLAG" : stageCopy[movement.stage].label}
            </span>
            <span style={{ fontSize: "0.6875rem", color: "var(--ward-muted, #64748b)" }}>
              Urgency {movement.urgency} of 3
            </span>
          </div>
        </div>

        {/* Dual Hub Spatial Corridor */}
        <div className={styles.corridorGrid}>
          {/* Origin Hub */}
          <div className={styles.corridorHub}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--ward-muted, #64748b)",
              }}
            >
              Departure Origin
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 800,
                color: "var(--ward-heading, var(--ink))",
                marginTop: "2px",
              }}
            >
              {originShort}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--ward-muted, #64748b)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {originFullName}
            </div>
            <div
              style={{
                marginTop: "6px",
                paddingTop: "4px",
                borderTop: "1px solid var(--ward-divider, #e2e8f0)",
                fontSize: "0.6875rem",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "var(--ward-muted, #64748b)" }}>Department:</span>
              <strong style={{ color: "var(--ward-heading, var(--ink))" }}>Emergency</strong>
            </div>
          </div>

          {/* Transit Vector / Highway */}
          <div className={styles.corridorHighway}>
            <span
              style={{
                background: "var(--accent-soft, #dbeafe)",
                color: "var(--accent-ink, #1e40af)",
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                padding: "2px 8px",
                borderRadius: "9999px",
                marginBottom: "4px",
              }}
            >
              {movement.transport?.provider ??
                (movement.transportNeed?.needed === false ? "Walking Transfer" : "Transport Leg")}
            </span>
            <div className={styles.corridorTrack}>
              <div className={styles.corridorFlowTrack} style={{ position: "absolute", inset: 0 }} />
              <div className={styles.corridorProgress} style={{ width: getProgressPercent(movement.stage) }} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono, monospace)",
                fontWeight: 700,
                fontSize: "0.75rem",
                color: "var(--ward-heading, var(--ink))",
                marginTop: "4px",
              }}
            >
              {movement.transport?.cadNumber ?? "—"}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--ward-muted, #64748b)" }}>
              {stageCopy[movement.stage].label}
            </div>
          </div>

          {/* Destination Hub */}
          <div className={accepted ? styles.corridorHubAccepted : styles.corridorHub}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: accepted ? "var(--accent-ink, #1d4ed8)" : "var(--ward-muted, #64748b)",
              }}
            >
              {accepted ? "Accepted Destination" : "Pending Acceptance"}
            </div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 800,
                color: "var(--ward-heading, var(--ink))",
                marginTop: "2px",
              }}
            >
              {accepted ? accepted.name : "Awaiting Ward"}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--ward-muted, #64748b)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {accepted ? (siteByCode(accepted.siteCode)?.name ?? accepted.name) : "Statewide mental health bed pool"}
            </div>
            {accepted ? (
              <div
                style={{
                  marginTop: "6px",
                  paddingTop: "4px",
                  borderTop: "1px solid var(--accent-border, #bfdbfe)",
                  fontSize: "0.6875rem",
                }}
              >
                <Link
                  href={`/mockups/ward-flow/board/${accepted.id}`}
                  className={styles.jumpToWardLink}
                  title={`Open ${accepted.name} Bed Board`}
                >
                  Open on Ward Board →
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        {/* Where is Patient Right Now? Live Beacon Card */}
        <div className={`${styles.beaconCard} ${styles.pulseBeacon}`}>
          <div className={styles.beaconDot}>📍</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  color: "var(--accent-ink, #1d4ed8)",
                  letterSpacing: "0.05em",
                }}
              >
                Where is {subjectPatient.formalName.split(",")[1]?.trim() || subjectPatient.formalName} right now?
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.6875rem",
                  color: "var(--ward-muted, #64748b)",
                }}
              >
                Live Movement Status
              </span>
            </div>
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--ward-heading, var(--ink))",
                lineHeight: 1.4,
              }}
            >
              {getWhereaboutsText(movement, originFullName, accepted?.name)}
            </p>
          </div>
        </div>

        {/* 5-Waypoint Journey Track Stepper */}
        <div style={{ marginTop: "12px" }}>
          <div
            style={{
              fontSize: "0.6875rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--ward-muted, #64748b)",
              marginBottom: "4px",
            }}
          >
            5-Waypoint Movement Vector
          </div>
          <div className={styles.waypointStepper}>
            <div className={`${styles.waypointItem} ${intakeDone ? styles.waypointDone : ""}`}>
              <div style={{ fontWeight: 700 }}>1. INTAKE</div>
              <div style={{ fontWeight: 600, marginTop: "2px" }}>✓ Opened</div>
              <div style={{ color: "var(--ward-muted, #64748b)" }}>{intakeTime}</div>
            </div>
            <div
              className={`${styles.waypointItem} ${allocationDone ? styles.waypointDone : allocationActive ? styles.waypointActive : ""}`}
            >
              <div style={{ fontWeight: 700 }}>2. ALLOCATE</div>
              <div style={{ fontWeight: 600, marginTop: "2px" }}>{allocationStatus}</div>
              <div style={{ color: "var(--ward-muted, #64748b)" }}>{allocationTime}</div>
            </div>
            <div
              className={`${styles.waypointItem} ${handoverDone ? styles.waypointDone : handoverActive ? styles.waypointActive : ""}`}
            >
              <div style={{ fontWeight: 700 }}>3. HANDOVER</div>
              <div style={{ fontWeight: 600, marginTop: "2px" }}>{handoverStatus}</div>
              <div style={{ color: "var(--ward-muted, #64748b)" }}>{handoverTime}</div>
            </div>
            <div
              className={`${styles.waypointItem} ${transportDone ? styles.waypointDone : transportActive ? styles.waypointActive : ""}`}
            >
              <div style={{ fontWeight: 700 }}>4. TRANSPORT</div>
              <div style={{ fontWeight: 600, marginTop: "2px" }}>{transportStatus}</div>
              <div style={{ color: "var(--ward-muted, #64748b)" }}>{transportTime}</div>
            </div>
            <div className={`${styles.waypointItem} ${admissionDone ? styles.waypointDone : ""}`}>
              <div style={{ fontWeight: 700 }}>5. ADMISSION</div>
              <div style={{ fontWeight: 600, marginTop: "2px" }}>{admissionStatus}</div>
              <div style={{ color: "var(--ward-muted, #64748b)" }}>{admissionTime}</div>
            </div>
          </div>
        </div>

        {/* Active Blocker Alert & Dispatch Telemetry */}
        <div className={styles.telemetryGrid}>
          <div className={blockerAlertClass}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: isNoBlocker ? "var(--ward-success, #15803d)" : "var(--ward-warning, #b45309)",
                marginBottom: "2px",
              }}
            >
              Active Movement Barrier
            </div>
            <div style={{ fontSize: "0.8125rem", fontWeight: 700, color: "var(--ward-heading, var(--ink))" }}>
              {movement.blocker}
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--ward-muted, #64748b)", marginTop: "2px" }}>
              {isNoBlocker ? "No clinical or dispatch impediment." : "Identified operational delay factor."}
            </div>
          </div>

          <div className={styles.telemetryCard}>
            <div
              style={{
                fontSize: "0.6875rem",
                fontWeight: 700,
                textTransform: "uppercase",
                color: "var(--ward-muted, #64748b)",
                marginBottom: "6px",
              }}
            >
              Dispatch & Legal Telemetry
            </div>
            <div className={styles.telemetryRow}>
              <span style={{ color: "var(--ward-muted, #64748b)" }}>Carrier:</span>
              <strong style={{ color: "var(--ward-heading, var(--ink))" }}>
                {movement.transport?.provider ?? "None booked"}
              </strong>
            </div>
            <div className={styles.telemetryRow}>
              <span style={{ color: "var(--ward-muted, #64748b)" }}>Escort:</span>
              <strong
                style={{
                  color: movement.transport?.escortRequired
                    ? "var(--ward-danger, #dc2626)"
                    : "var(--ward-heading, var(--ink))",
                }}
              >
                {movement.transport?.escortRequired ? "Escort Required" : "Not Required"}
              </strong>
            </div>
            {movement.legalForm ? (
              <div
                className={styles.telemetryRow}
                style={{ paddingTop: "4px", borderTop: "1px solid var(--ward-divider, #e2e8f0)", marginBottom: 0 }}
              >
                <span style={{ color: "var(--ward-muted, #64748b)" }}>Legal Authority:</span>
                <strong style={{ color: "var(--accent-ink, #1d4ed8)" }}>{legalFormName(movement.legalForm)}</strong>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
                {change.from === undefined ? "Opened" : stageCopy[change.from].label} → {stageCopy[change.to].label} ·{" "}
                {formatInstantWithDay(change.at, now)} · {change.by}
                {change.reason === undefined ? "" : ` · ${change.reason}`}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/*
        ⚠️ **ASKED, ACCEPTED and REFUSED are three states and a coordinator acts on the difference.**
        Collapsing them into one "wards involved" list would lose the only fact that matters —
        whether anybody said no, and why. `referredUnitIds` names who was asked at all; `declines`
        names who answered and with what reason.
      */}
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

      {/*
        **WHAT YOU CAN DO — M7, and it is one action rather than four.**

        🔴 **THE STATE IS SAID IN WORDS, NEVER LEFT TO THE BUTTON'S LABEL.** There is no urgent badge
        in this drawer — the badge lives on the coordinator queue — so a reader here has only this
        sentence to tell them that a flagged patient outranks every tier, including tier 1. A button
        reading "Remove the urgent flag" is not a statement that the patient currently leads the
        queue; it is an instruction, and the two are not the same thing to somebody scanning.

        ⚠️ **A CLOSED MOVEMENT IS OFF THE QUEUE ENTIRELY**, so the reducer refuses to flag one. The
        control is not silently hidden and the refusal is not discovered by pressing: the sentence
        says the flag would order nothing, and the button is only withheld in the one case where it
        could do nothing at all (closed AND unflagged). Clearing an existing flag stays available on
        a closed movement — the reducer permits it, and a flag nobody can remove is the permanent
        state this pair exists to prevent.

        ⚠️ **A REASON IS NOW ASKED FOR, on raising the flag only — item 37, 2026-09-17.** Chosen
        from `URGENT_MARK_REASONS`, the same fixed list the console's own control offers. Clearing
        still asks for nothing: taking a flag back down cannot promote anybody.
      */}
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
        {!open && !movement.flaggedUrgent ? null : movement.flaggedUrgent ? (
          <button
            type="button"
            className={styles.action}
            data-testid="ward-movement-drawer-urgent-toggle"
            onClick={() =>
              dispatch({
                /* Dispatched as the coordinator because this is the statewide movements board. The
                   event also permits `ed`, so a referring department can flag from its own screen —
                   that control is not this one and must not be implied by it. */
                type: "CLEAR_MOVEMENT_URGENT_FLAG",
                role: "coordinator",
                now,
                movementId: movement.id,
              })
            }
          >
            Remove the urgent flag
          </button>
        ) : (
          <div className={styles.drawerReasonRow}>
            <label className={styles.drawerReasonLabel} htmlFor="ward-movement-drawer-urgent-reason">
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
              <option value="">Choose a reason…</option>
              {URGENT_MARK_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {changeReasonLabels[reason]}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={styles.action}
              data-testid="ward-movement-drawer-urgent-toggle"
              aria-disabled={urgentFlagReason === undefined ? "true" : undefined}
              aria-describedby={urgentFlagReason === undefined ? "ward-movement-drawer-urgent-blocked" : undefined}
              title={urgentFlagReason === undefined ? URGENT_FLAG_UNCHOSEN : undefined}
              onClick={
                urgentFlagReason === undefined
                  ? ignoreUnavailableActivation
                  : () => {
                      dispatch({
                        /* Dispatched as the coordinator, for the reason given above. */
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
              Flag this patient as urgent
            </button>
            {urgentFlagReason === undefined ? (
              <span id="ward-movement-drawer-urgent-blocked" className="sr-only">
                {URGENT_FLAG_UNCHOSEN}
              </span>
            ) : null}
          </div>
        )}
        <p className={styles.drawerAbsent}>
          This is the only thing this drawer changes. Everything else about this movement is done in the full workspace.
        </p>
      </Section>

      <p className={styles.drawerFoot}>
        <strong>One section the drawing carries is not built</strong> — <em>Watch and flag</em>. Nothing in this system
        records that somebody is watching a movement, so there is no state for it to show;{" "}
        <Link className={styles.action} href={`/mockups/ward-flow/movements/${movement.id}`}>
          the full workspace
        </Link>{" "}
        is where this movement is worked on.
      </p>
    </Sheet>
  );
}
