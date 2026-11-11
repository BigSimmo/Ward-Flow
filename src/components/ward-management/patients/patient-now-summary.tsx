"use client";

// The patient page's summary section: the flight header with its mode pill, figures, legal and stay
// facts and the stage strip. Split out of `patient-now-screen.tsx`, which renders it with the values
// it has already derived.
import { isTierOverdue, tierOverdueAfterMinutes } from "../ward-shared-figures";
import { TIER_QUALIFIER } from "../ward-priority";
import { securityWord, type Security } from "../ward-model-vocabulary";

/*
 * UX audit (21 Oct 2026): the hero used to say "Tier 1 · open", which read as an open tier. The tier
 * uses the tier key's words ("T1 most urgent") and the bed type is its own chip.
 */
function tierChipText(tier: 1 | 2 | 3 | undefined): string {
  return tier === undefined ? "Tier not recorded" : `T${tier} ${TIER_QUALIFIER[tier]}`;
}

function bedTypeChipText(security: Security | undefined): string {
  return security === undefined ? "Bed type not recorded" : `${securityWord(security)} bed`;
}
import Link from "next/link";
import { BedSingle, Check, ClipboardList, Clock, Copy, FileText } from "lucide-react";
import { PatientFlightHeader } from "./patient-flight-header";
import { absenceStepsFor } from "@/components/ward-management/ward-model";
import { type Patient } from "@/components/ward-management/ward-patients";
import { dayLabel, type PatientStatusContext } from "./patient-status-card";
import { type PatientNowRecord, STAGES, clock, dur } from "./patient-now-records";
import styles from "./patient-now.module.css";
import {
  Badge,
  Button,
  Card,
  CardHead,
  HeroFigures,
  HeroQuickChips,
  LiveChip,
  StatusGlyph,
  buttonClass,
} from "@/components/wf";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { clearToMove, getStageBedflowDetail } from "./patient-now-screen-helpers";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { CommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import { useState, type Dispatch, type JSX, type RefObject, type SetStateAction } from "react";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import type { CareStep } from "./patient-care-journey";
import { PatientCareJourneyStrip, journeyToggleClass } from "./patient-care-journey-strip";
import type { FormTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import type { LeaveBed, Movement } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { ResolvedPatientNow } from "./patient-now-adapter";
import type { StagePresentationDetail } from "./patient-now-screen-helpers";
import { PatientPinButton, usePatientPinChip } from "./patient-pin-button";
import type { WfTone } from "@/components/wf";
import { isConstantObservation, observationSummary } from "@/components/ward-management/ward-observation";

/** The values `PatientNowScreen` has derived that its summary section reads. */
export type PatientNowSummaryProps = {
  awaySince: number | undefined;
  copied: boolean;
  ctoInForce: CommunityTreatmentOrder | undefined;
  currentStageIndex: number;
  dayZero: Date;
  displayName: string;
  displayToday: Date;
  expandedStage:
    | { readonly id: "placement_requested"; readonly label: "Placement requested" }
    | { readonly id: "destination_review"; readonly label: "Destination review" }
    | { readonly id: "accepted_awaiting_bed"; readonly label: "Accepted, awaiting bed" }
    | { readonly id: "pulled"; readonly label: "Bed pulled" }
    | { readonly id: "handover_ready"; readonly label: "Handover ready" }
    | { readonly id: "moving"; readonly label: "Moving" }
    | { readonly id: "arrived"; readonly label: "Arrived" }
    | undefined;
  expandedStageDetail: StagePresentationDetail | undefined;
  expandedStageIndex: number | null;
  focusedStageIndex: number;
  handleCopySummary: () => void;
  /** Item 27: the transfer as text for the notes; absent until a ward has accepted. */
  transferNotes?: () => string | undefined;
  isLiveBedflow: boolean;
  isPhone: boolean;
  lastStay: Admission | undefined;
  liveMovement: Movement | undefined;
  livePatient: (Patient & { confidential?: boolean }) | undefined;
  mode: PatientMode;
  modeMeta: { label: string; pill: string; tone: WfTone; placing: boolean; quiet: boolean };
  movementTimeLeft: FormTimeLeft | undefined;
  now: number;
  openOperations: () => void;
  phoneMovement: boolean;
  preferredName: string | undefined;
  record: PatientNowRecord;
  recordTabs: JSX.Element;
  resolved: ResolvedPatientNow;
  setExpandedStageIndex: Dispatch<SetStateAction<number | null>>;
  setFocusedStageIndex: Dispatch<SetStateAction<number>>;
  stageButtonRefs: RefObject<(HTMLButtonElement | null)[]>;
  statusContext: PatientStatusContext;
  stayCurrent: boolean;
  stayDay: number | undefined;
  stayLeaveBed: LeaveBed | undefined;
  tierTone: "danger" | "warning" | "neutral";
  urgencyTier: 2 | 1 | 3 | undefined;
  voluntaryNow: boolean;
  waitedStr: string;
  where: string | undefined;
  /** PT1: the band's first-screen facts (legal, observation, risk, community, GP, alerts). */
  glance?: JSX.Element;
  /** PT1: one of the five state tags, with the glyph tone. */
  stateTag?: { tag: string; tone: WfTone };
  /** PT1 round 3: the patient's journey, six steps from ED to community care. */
  careSteps: CareStep[];
  onOpenHistory?: () => void;
  /** Page tops (9 Nov 2026): the Forms chip opens the Documents tab. */
  onOpenForms?: () => void;
  /** The chosen record tab (the folder tab follows it). */
  tabValue: string;
};

export function PatientNowSummary(props: PatientNowSummaryProps) {
  // Opted out of the React Compiler to keep the patient page's phone download within
  // script-budget.json after the 18 Oct 2026 file split. Before the split this code was memoised as
  // part of PatientNowScreen; nothing it renders runs an effect, so plain re-rendering looks the same.
  "use no memo";
  // Access audit (31 Oct 2026): New referral shows only where this desk can open the referral form.
  const canOpenHref = useCanOpenHref();
  const {
    awaySince,
    copied,
    ctoInForce,
    currentStageIndex,
    dayZero,
    displayName,
    displayToday,
    expandedStage,
    expandedStageDetail,
    expandedStageIndex,
    focusedStageIndex,
    handleCopySummary,
    transferNotes,
    isLiveBedflow,
    isPhone,
    lastStay,
    liveMovement,
    livePatient,
    mode,
    modeMeta,
    movementTimeLeft,
    now,
    openOperations,
    phoneMovement,
    preferredName,
    record,
    recordTabs,
    resolved,
    setExpandedStageIndex,
    setFocusedStageIndex,
    stageButtonRefs,
    statusContext,
    stayCurrent,
    stayDay,
    stayLeaveBed,
    urgencyTier,
    voluntaryNow,
    waitedStr,
    where,
    glance,
    stateTag,
    careSteps,
    onOpenHistory,
    onOpenForms,
    tabValue,
  } = props;
  // The placement's seven stages stay one tap away behind the journey (Josh chose the slim band).
  const [stagesOpen, setStagesOpen] = useState(false);
  // PT1: the state tag leads ("Inpatient"); the mode's own words follow when they say more
  // ("Inpatient · On leave"). One dark band for every state, Not active included.
  const tagText = stateTag
    ? stateTag.tag === "Inpatient" && modeMeta.pill !== "On ward"
      ? `${stateTag.tag} · ${modeMeta.pill}`
      : stateTag.tag
    : modeMeta.pill;
  const tagTone = stateTag?.tone ?? modeMeta.tone;
  const STEPPER = isLiveBedflow ? (
    <ol
      className={styles.v6Steps}
      aria-label={`The seven stages. Stage ${currentStageIndex + 1} of ${STAGES.length}, ${STAGES[currentStageIndex].label}, is current`}
    >
      {STAGES.map((s, i) => {
        const recordedTransition = liveMovement?.stageChanges.find((change) => change.to === s.id);
        const stateAttr = liveMovement?.stage === s.id ? "now" : recordedTransition ? "recorded" : "todo";
        const isExpanded = expandedStageIndex === i;
        const detail = getStageBedflowDetail(s.id, liveMovement);
        const firstTime = detail.milestones.find((m) => m.time)?.time;
        const whenText =
          stateAttr === "recorded"
            ? `Recorded ${firstTime ?? ""}`.trim()
            : stateAttr === "now"
              ? `${waitedStr} since opened`
              : // An earlier stage is never marked complete without a recorded change.
                i < currentStageIndex
                ? "Before the current stage, no time recorded"
                : "Not reached yet";
        return (
          <li key={s.id} className={styles.v6Step} data-s={stateAttr}>
            <button
              type="button"
              id={`stage-header-${s.id}`}
              ref={(el) => {
                stageButtonRefs.current[i] = el;
              }}
              tabIndex={focusedStageIndex === i ? 0 : -1}
              aria-current={stateAttr === "now" ? "step" : undefined}
              className={styles.v6StepBtn}
              aria-expanded={isExpanded}
              aria-controls={`stage-panel-${s.id}`}
              data-testid={`ward-patient-stage-btn-${s.id}`}
              onClick={() => {
                setFocusedStageIndex(i);
                setExpandedStageIndex(isExpanded ? null : i);
              }}
              onKeyDown={(e) => {
                let nextIndex: number | null = null;
                if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                  e.preventDefault();
                  nextIndex = (i + 1) % STAGES.length;
                } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  nextIndex = (i - 1 + STAGES.length) % STAGES.length;
                } else if (e.key === "Home") {
                  e.preventDefault();
                  nextIndex = 0;
                } else if (e.key === "End") {
                  e.preventDefault();
                  nextIndex = STAGES.length - 1;
                } else if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setExpandedStageIndex(isExpanded ? null : i);
                }
                if (nextIndex !== null) {
                  setFocusedStageIndex(nextIndex);
                  stageButtonRefs.current[nextIndex]?.focus();
                }
              }}
            >
              <span className={styles.v6StepMark} aria-hidden="true">
                {stateAttr === "recorded" ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : i + 1}
              </span>
              <span className={styles.v6StepLabel}>{s.label}</span>
              <span className="sr-only">, {whenText}</span>
            </button>
          </li>
        );
      })}
    </ol>
  ) : null;
  /* Page tops (Josh, 9 Nov 2026): a live movement's band leads with two figures, the wait (amber
     past the tier's target, in the page's words) and how many move conditions are clear, the
     status card's count. Tier, bed type and constant observation become small tags on the
     identity line; Copy handover and Forms are the band's chips. Nothing here is new: every
     figure is one the page already showed. */
  const movementTop = isLiveBedflow && liveMovement ? liveMovement : undefined;
  const overTarget = movementTop ? isTierOverdue(urgencyTier, now - movementTop.openedAt) : false;
  const targetWords = `over T${urgencyTier} target (${tierOverdueAfterMinutes(urgencyTier) / 60}h)`;
  const clear = movementTop ? clearToMove(mode, statusContext) : undefined;
  const movementFigures =
    movementTop && clear ? (
      <span data-testid={isPhone ? "ward-patient-phone-figures" : undefined} className={styles.ptFigures}>
        <HeroFigures
          label="This movement"
          items={[
            {
              id: "wait",
              value: waitedStr,
              /* "Target", not "limit", so it never reads as an Act limit. */
              label: overTarget ? (isPhone ? targetWords : `since opened · ${targetWords}`) : "since opened",
              tone: overTarget ? "warning" : undefined,
            },
            { id: "clear", value: clear.clear, unit: ` of ${clear.of}`, label: "clear to move" },
            ...(movementTimeLeft && (isPhone || !glance)
              ? [
                  {
                    id: "form",
                    value: movementTimeLeft.text,
                    label: `${movementTimeLeft.code} left`,
                    tone: movementTimeLeft.standing === "later" ? undefined : ("warning" as const),
                    testId: "ward-patient-hero-form-left",
                  },
                ]
              : []),
          ]}
        />
      </span>
    ) : undefined;
  // Feature 31: Pin (to Home) is a quick chip in the top; a record with no live movement shows it
  // alone on a phone, and beside Copy summary on a desktop.
  const pinChip = usePatientPinChip(livePatient?.id, displayName);
  const [notesCopied, setNotesCopied] = useState(false);
  const copyTransferNotes = () => {
    const text = transferNotes?.();
    if (!text) return;
    void copyTextToClipboard(text).then(
      () => {
        setNotesCopied(true);
        announceToWardShell("Copied for the notes");
        setTimeout(() => setNotesCopied(false), 2000);
      },
      // The same words as CopyNotesButton, so a refused copy never reads as done.
      () => announceToWardShell("Copy unavailable in this browser"),
    );
  };
  const movementChips = movementTop ? (
    <HeroQuickChips
      label="Patient actions"
      items={[
        {
          id: "copy",
          label: copied ? "Copied" : "Copy handover",
          icon: <ClipboardList size={16} strokeWidth={1.75} aria-hidden="true" />,
          onClick: handleCopySummary,
          testId: "ward-patient-copy-handover",
        },
        ...(transferNotes
          ? [
              {
                id: "copy-notes",
                label: notesCopied ? "Copied" : "Copy to notes",
                icon: <Copy size={16} strokeWidth={1.75} aria-hidden="true" />,
                onClick: copyTransferNotes,
                testId: "ward-patient-copy-transfer-notes",
              },
            ]
          : []),
        ...(pinChip ? [pinChip] : []),
        ...(onOpenForms
          ? [
              {
                id: "forms",
                label: "Forms",
                icon: <FileText size={16} strokeWidth={1.75} aria-hidden="true" />,
                onClick: onOpenForms,
                testId: "ward-patient-forms-chip",
              },
            ]
          : []),
      ]}
    />
  ) : undefined;
  const movementTags = movementTop ? (
    <>
      <span className={styles.ptTag}>{tierChipText(urgencyTier)}</span>
      {isPhone ? null : <span className={styles.ptTag}>{bedTypeChipText(movementTop.security)}</span>}
      {isConstantObservation(movementTop.observation) ? (
        <span className={styles.ptTag}>{observationSummary(movementTop.observation)}</span>
      ) : null}
    </>
  ) : undefined;
  const newReferralHref = livePatient ? raiseReferralHref({ patientId: livePatient.id }) : "/ward-flow/referrals/new";
  return (
    <section className={styles.v6Summary} id="pnSubject" aria-label="Patient summary">
      <PatientFlightHeader
        displayName={displayName}
        preferredName={preferredName}
        patient={livePatient}
        displayToday={displayToday}
        isLiveBedflow={isLiveBedflow}
        glance={glance}
        statePill={
          <span className={styles.gbPill} data-testid="ward-patient-mode-pill">
            <StatusGlyph tone={tagTone} size={10} />
            {tagText}
          </span>
        }
        tags={movementTags}
        figures={movementFigures}
        chips={
          movementChips ??
          (isPhone && pinChip ? <HeroQuickChips label="Patient actions" items={[pinChip]} /> : undefined)
        }
        phoneEyebrow={
          phoneMovement ? undefined : (
            <span className={styles.phEyebrow}>
              <StatusGlyph tone={tagTone} size={10} />
              {tagText}
            </span>
          )
        }
        location={where}
        // Redesign: "Patient record · On ward" only repeated the pill beside the name, so it is
        // spoken, not shown, unless it says more (a closed referral, an arrival, a CTO).
        statusShown={
          Boolean(liveMovement?.closure && liveMovement.stage !== "arrived") ||
          liveMovement?.stage === "arrived" ||
          modeMeta.label !== modeMeta.pill
        }
        statusDetail={
          isLiveBedflow
            ? `Stage ${currentStageIndex + 1} / 7 · ${STAGES[currentStageIndex].label}`
            : liveMovement?.closure && liveMovement.stage !== "arrived"
              ? "Referral closed · no active transfer"
              : liveMovement?.stage === "arrived"
                ? "Arrived · transfer complete"
                : modeMeta.label
        }
        // Redesign (Josh, 30 Oct): one place per fact. Legal status lives in Legal now (or the Not
        // active card's Legal status row); on the ward the day count and discharge date live in the
        // On ward card. With nothing left to add, the ward, Not active and CTO heroes carry no chips.
        facts={
          movementTop ? undefined : isPhone && !isLiveBedflow && mode === "ward" ? undefined : isPhone &&
            !isLiveBedflow ? (
            /* v10 Patient, phone: three figures, the value over its label, from the record. */
            <span className={styles.v6HeroFacts} data-testid="ward-patient-phone-figures">
              {(mode === "idle" || mode === "cto"
                ? [
                    // shell-24 (13 Oct 2026): no Discharged figure for someone never admitted.
                    ...(lastStay == null
                      ? []
                      : [
                          {
                            key: "discharged",
                            value:
                              lastStay?.leftAt != null
                                ? now - lastStay.leftAt < 6 * 1440
                                  ? dayLabel(lastStay.leftAt, dayZero).replace(",", "").split(" ")[0]
                                  : dayLabel(lastStay.leftAt, dayZero).replace(",", "").split(" ").slice(1).join(" ")
                                : "None",
                            label: "Discharged",
                          },
                        ]),
                    { key: "orders", value: ctoInForce ? "1" : "0", label: "Orders" },
                    { key: "presentations", value: String(record.presentations.length), label: "Presentations" },
                  ]
                : mode === "leave" && stayLeaveBed
                  ? [
                      {
                        key: "due",
                        value: clock(stayLeaveBed.expectedReturn),
                        label: "Due back",
                        tone: "neutral" as const,
                      },
                      // D-139: leave follows D-93, so no worked-out "Overdue 2h" or "From now 3h" figure.
                      now > stayLeaveBed.expectedReturn
                        ? { key: "from", value: "Passed", label: "Typed time", tone: "warning" as const }
                        : { key: "from", value: "Not yet", label: "Typed time" },
                    ]
                  : mode === "awol" && stayLeaveBed?.absentWithoutLeave
                    ? [
                        {
                          key: "absent",
                          value: dur(Math.max(0, now - stayLeaveBed.absentWithoutLeave.since)),
                          label: "Absent",
                          tone: "danger" as const,
                        },
                        {
                          key: "steps",
                          // A3-13: the same step list the status card counts.
                          value: `${absenceStepsFor(voluntaryNow).filter((step) => stayLeaveBed.absentWithoutLeave!.steps.some((done) => done.step === step)).length}/${absenceStepsFor(voluntaryNow).length}`,
                          label: "Steps done",
                        },
                      ]
                    : mode === "ed" && awaySince !== undefined
                      ? [
                          {
                            key: "away",
                            value: dur(Math.max(0, now - awaySince)),
                            label: "At ED",
                            tone: "warning" as const,
                          },
                          {
                            key: "bed",
                            value:
                              resolved.liveAdmission?.bedNumber !== undefined
                                ? `Bed ${String(resolved.liveAdmission.bedNumber).padStart(2, "0")}`
                                : "Bed",
                            label: "Held",
                          },
                        ]
                      : [
                          {
                            key: "day",
                            value: stayDay !== undefined ? `Day ${stayDay}` : "Day not recorded",
                            label: "On ward",
                            tone: "success" as const,
                          },
                          {
                            key: "out",
                            value:
                              typeof resolved.liveAdmission?.expectedDischargeAt === "number"
                                ? dayLabel(resolved.liveAdmission.expectedDischargeAt, dayZero).replace(",", "")
                                : // Audit CS3-20: no date recorded is not the same as none expected.
                                  "Not recorded",
                            label: "Expected out",
                          },
                        ]
              ).map(
                (fig: {
                  key: string;
                  value: string;
                  label: string;
                  tone?: "success" | "warning" | "danger" | "neutral";
                }) => (
                  <span key={fig.key} className={styles.v6HeroFact}>
                    <strong className={styles.v6HeroWait}>{fig.value}</strong>
                    <span className={styles.phFigLabel}>
                      {fig.tone ? <StatusGlyph tone={fig.tone} size={9} /> : null}
                      {fig.label}
                    </span>
                  </span>
                ),
              )}
            </span>
          ) : mode === "ward" || mode === "idle" || mode === "cto" ? undefined : (
            <span className={styles.v6HeroFacts}>
              {(mode === "leave" || mode === "awol" || mode === "ed") && (
                <span className={styles.v6HeroFact}>
                  <BedSingle size={14} aria-hidden="true" />
                  Bed held
                </span>
              )}
              {mode === "awol" && stayLeaveBed?.absentWithoutLeave ? (
                <span className={styles.v6HeroFact}>
                  <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                  <strong className={styles.v6HeroWait}>
                    {dur(Math.max(0, now - stayLeaveBed.absentWithoutLeave.since))}
                  </strong>
                  absent since {clock(stayLeaveBed.absentWithoutLeave.since)}
                </span>
              ) : null}
              {(mode === "leave" || mode === "ed") && stayDay !== undefined ? (
                <span className={styles.v6HeroFact}>
                  <strong className={styles.v6HeroWait}>Day {stayDay}</strong>
                  on the ward
                </span>
              ) : null}
              {stayCurrent && resolved.liveAdmission ? (
                <span className={styles.v6HeroFact} data-testid="ward-patient-hero-discharge">
                  {typeof resolved.liveAdmission.expectedDischargeAt === "number" ? (
                    <>
                      <strong>{dayLabel(resolved.liveAdmission.expectedDischargeAt, dayZero).replace(",", "")}</strong>
                      discharge date
                    </>
                  ) : (
                    <>
                      <strong>No</strong>
                      discharge date yet
                    </>
                  )}
                </span>
              ) : null}
            </span>
          )
        }
        steps={
          // Note 5 (Josh, 9 Nov 2026): a strip with no step reached (nothing open) is empty dots, and
          // a one-step strip ("Community") only repeats the card below, so either leaves the band to
          // keep it short. A live placement always keeps it for its steps toggle.
          !isLiveBedflow && (careSteps.length < 2 || !careSteps.some((step) => step.state !== "next")) ? undefined : (
            <>
              <PatientCareJourneyStrip
                steps={careSteps}
                onOpenHistory={onOpenHistory}
                extra={
                  isLiveBedflow && !isPhone ? (
                    <button
                      type="button"
                      className={journeyToggleClass}
                      aria-expanded={stagesOpen}
                      onClick={() => setStagesOpen((open) => !open)}
                      data-testid="ward-patient-stages-toggle"
                    >
                      {stagesOpen ? "Hide placement steps" : "Placement steps"}
                    </button>
                  ) : undefined
                }
              />
              {isLiveBedflow && !isPhone && stagesOpen ? STEPPER : null}
            </>
          )
        }
        tabs={recordTabs}
        tabValue={tabValue}
        actions={
          <>
            {modeMeta.quiet ? null : (
              // v10 phone: the movement page reads "Live HH:MM", the patient page a plain "Live".
              <LiveChip state="live" age={phoneMovement ? undefined : null} onHero />
            )}
            {isPhone || movementTop ? null : <PatientPinButton patientId={livePatient?.id} name={displayName} />}
            {isPhone || movementTop ? null : (
              <Button variant="onHero" size="sm" icon={Copy} onClick={handleCopySummary}>
                {copied
                  ? "Copied"
                  : isLiveBedflow
                    ? "Copy handover"
                    : mode === "awol"
                      ? "Copy missing person summary"
                      : "Copy summary"}
              </Button>
            )}
            {(mode === "idle" || mode === "cto") && !isPhone && canOpenHref(newReferralHref) ? (
              <Link
                href={newReferralHref}
                className={buttonClass({ variant: "light", size: "sm" })}
                data-testid="ward-person-refer-outpatient"
              >
                <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
                New referral
              </Link>
            ) : null}
          </>
        }
      />

      {expandedStage && expandedStageDetail ? (
        <Card
          className={styles.v6StagePanel}
          id={`stage-panel-${expandedStage.id}`}
          role="region"
          aria-labelledby={`stage-header-${expandedStage.id}`}
          data-testid={`ward-patient-stage-panel-${expandedStage.id}`}
        >
          <CardHead
            title={expandedStage.label}
            aside={
              <Badge tone={expandedStageDetail.badgeTone === "accent" ? "info" : "neutral"}>
                {expandedStageDetail.statusText}
              </Badge>
            }
          />
          <div className={styles.v6StagePanelBody}>
            <p>{expandedStageDetail.summary}</p>
            {expandedStageDetail.milestones.length > 0 && (
              <ul className={styles.v6Milestones}>
                {expandedStageDetail.milestones.map((m, mi) => (
                  <li key={mi}>
                    {m.time && <span className={styles.v6Mono}>{m.time}</span>}
                    <span>
                      {m.label}. {m.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" onClick={openOperations}>
              Review stage actions
            </Button>
          </div>
        </Card>
      ) : null}
    </section>
  );
}
