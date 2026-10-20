"use client";

// The patient page's summary section: the flight header with its mode pill, figures, legal and stay
// facts and the stage strip. Split out of `patient-now-screen.tsx`, which renders it with the values
// it has already derived.
import { isTierOverdue, tierOverdueAfterMinutes } from "../ward-shared-figures";
import Link from "next/link";
import { BedDouble, Check, Clock, Copy, FileText, Scale } from "lucide-react";
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
  JourneyStrip,
  LiveChip,
  type JourneyStage,
  StatusGlyph,
  buttonClass,
} from "@/components/wf";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";
import { PhoneClearFact, getStageBedflowDetail } from "./patient-now-screen-helpers";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { CommunityTreatmentOrder } from "@/components/ward-management/ward-patients";
import type { Dispatch, JSX, RefObject, SetStateAction } from "react";
import type { FormTimeLeft } from "@/components/ward-management/legal-forms/legal-form-time-left";
import type { LeaveBed, Movement } from "@/components/ward-management/ward-model";
import type { PatientMode } from "./patient-mode";
import type { ResolvedPatientNow } from "./patient-now-adapter";
import type { StagePresentationDetail } from "./patient-now-screen-helpers";
import type { WfTone } from "@/components/wf";

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
  phoneLegal: { tone?: "danger" | "warning" | undefined; value: string; label: string };
  phoneMovement: boolean;
  phoneStayStages: JourneyStage[] | undefined;
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
};

export function PatientNowSummary(props: PatientNowSummaryProps) {
  // Opted out of the React Compiler to keep the patient page's phone download within
  // script-budget.json after the 18 Oct 2026 file split. Before the split this code was memoised as
  // part of PatientNowScreen; nothing it renders runs an effect, so plain re-rendering looks the same.
  "use no memo";
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
    phoneLegal,
    phoneMovement,
    phoneStayStages,
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
    tierTone,
    urgencyTier,
    voluntaryNow,
    waitedStr,
    where,
  } = props;
  return (
    <section className={styles.v6Summary} id="pnSubject" aria-label="Patient summary">
      <PatientFlightHeader
        displayName={displayName}
        preferredName={preferredName}
        patient={livePatient}
        displayToday={displayToday}
        isLiveBedflow={isLiveBedflow}
        quiet={modeMeta.quiet && !isPhone}
        statePill={
          <span className={styles.gbPill} data-testid="ward-patient-mode-pill">
            <StatusGlyph tone={modeMeta.tone} size={10} />
            {modeMeta.pill}
          </span>
        }
        phoneEyebrow={
          phoneMovement ? (
            // A3-20: the phone hero keeps the desktop's tier, bed type and specialling. F-05 (phone
            // review, Oct 2026): the observation level is its own chip, and the line may wrap to a
            // second line rather than cut it off.
            <span className={styles.phMoveEyebrow}>
              {`Movement · Tier ${urgencyTier ?? "not recorded"} · ${(liveMovement?.security ?? "not recorded").toLowerCase()}`}
              {liveMovement?.specialling ? <span className={styles.phObsChip}>1:1 specialling</span> : null}
            </span>
          ) : (
            <span className={styles.phEyebrow}>
              <StatusGlyph tone={modeMeta.tone} size={10} />
              {modeMeta.pill}
            </span>
          )
        }
        phoneFootKind="actions"
        phoneFoot={
          phoneMovement ? (
            <div className={styles.phHeroActions}>
              <Button variant="onHero" icon={Copy} onClick={handleCopySummary}>
                {copied ? "Copied" : "Copy handover"}
              </Button>
            </div>
          ) : undefined
        }
        location={where}
        statusDetail={
          isLiveBedflow
            ? `Stage ${currentStageIndex + 1} / 7 · ${STAGES[currentStageIndex].label}`
            : liveMovement?.closure && liveMovement.stage !== "arrived"
              ? "Referral closed · no active transfer"
              : liveMovement?.stage === "arrived"
                ? "Arrived · transfer complete"
                : modeMeta.label
        }
        facts={
          phoneMovement ? (
            <span className={styles.v6HeroFacts} data-testid="ward-patient-phone-figures">
              <span className={styles.v6HeroFact}>
                <strong className={styles.v6HeroWait}>{waitedStr}</strong>
                <span>Since opened</span>
              </span>
              <span className={styles.v6HeroFact}>
                <strong className={styles.v6HeroWait}>
                  {currentStageIndex + 1} of {STAGES.length}
                </strong>
                <span>Stage</span>
              </span>
              <PhoneClearFact mode={mode} context={statusContext} />
              {movementTimeLeft ? (
                <span className={styles.v6HeroFact} data-testid="ward-patient-hero-form-left">
                  <strong className={styles.v6HeroWait}>{movementTimeLeft.text}</strong>
                  <span className={styles.phFigLabel}>
                    {movementTimeLeft.standing !== "later" ? (
                      <StatusGlyph tone={movementTimeLeft.tone} size={9} />
                    ) : null}
                    {movementTimeLeft.code}
                  </span>
                </span>
              ) : null}
            </span>
          ) : isPhone && !isLiveBedflow ? (
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
                      now > stayLeaveBed.expectedReturn
                        ? { key: "from", value: dur(now - stayLeaveBed.expectedReturn), label: "Overdue" }
                        : { key: "from", value: dur(stayLeaveBed.expectedReturn - now), label: "From now" },
                      { key: "legal", ...phoneLegal },
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
                        { key: "legal", ...phoneLegal },
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
                          { key: "legal", ...phoneLegal },
                        ]
                      : [
                          {
                            key: "day",
                            value: stayDay !== undefined ? `Day ${stayDay}` : "Day not recorded",
                            label: "On ward",
                            tone: "success" as const,
                          },
                          { key: "legal", ...phoneLegal },
                          {
                            key: "out",
                            value:
                              typeof resolved.liveAdmission?.expectedDischargeAt === "number"
                                ? dayLabel(resolved.liveAdmission.expectedDischargeAt, dayZero).replace(",", "")
                                : "None",
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
          ) : isLiveBedflow && liveMovement ? (
            <span className={styles.v6HeroFacts}>
              <span className={styles.v6HeroFact}>
                <StatusGlyph tone={tierTone} size={9} />
                Tier {urgencyTier ?? "not recorded"} · {(liveMovement.security ?? "not recorded").toLowerCase()}
              </span>
              {isTierOverdue(urgencyTier, now - liveMovement.openedAt) ? (
                <span className={styles.v6HeroFact}>
                  <StatusGlyph tone="danger" size={9} />
                  {/* The wait itself is the "since opened" chip beside it, so this names the tier's limit. */}
                  Overdue · {tierOverdueAfterMinutes(urgencyTier) / 60}h limit
                </span>
              ) : null}
              {liveMovement.specialling ? (
                <span className={styles.v6HeroFact}>
                  <StatusGlyph tone="warning" size={9} />
                  1:1 specialling
                </span>
              ) : null}
              <span className={styles.v6HeroFact}>
                <Clock size={14} aria-hidden="true" />
                <strong className={styles.v6HeroWait}>{waitedStr}</strong>
                since opened
              </span>
              {movementTimeLeft ? (
                <span className={styles.v6HeroFact} data-testid="ward-patient-hero-form-left">
                  {movementTimeLeft.standing !== "later" ? (
                    <StatusGlyph tone={movementTimeLeft.tone} size={9} />
                  ) : (
                    <Scale size={14} aria-hidden="true" />
                  )}
                  {movementTimeLeft.code} · <strong className={styles.v6HeroWait}>{movementTimeLeft.text}</strong>
                </span>
              ) : null}
            </span>
          ) : (
            <span className={styles.v6HeroFacts}>
              <span className={styles.v6HeroFact}>
                <Scale size={14} aria-hidden="true" />
                {/* Not active: the patient record's own status, not a closed movement's. */}
                {mode === "cto"
                  ? "Community treatment order, Form 5A"
                  : ((mode === "idle"
                      ? livePatient?.legalStatus
                      : (liveMovement?.legalStatus ?? livePatient?.legalStatus)) ?? "Legal status not recorded")}
              </span>
              {(mode === "leave" || mode === "awol" || mode === "ed") && (
                <span className={styles.v6HeroFact}>
                  <BedDouble size={14} aria-hidden="true" />
                  Bed held
                </span>
              )}
              {mode === "awol" && stayLeaveBed?.absentWithoutLeave ? (
                <span className={styles.v6HeroFact}>
                  <Clock size={14} aria-hidden="true" />
                  <strong className={styles.v6HeroWait}>
                    {dur(Math.max(0, now - stayLeaveBed.absentWithoutLeave.since))}
                  </strong>
                  absent since {clock(stayLeaveBed.absentWithoutLeave.since)}
                </span>
              ) : null}
              {(mode === "ward" || mode === "leave" || mode === "ed") && stayDay !== undefined ? (
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
                      <strong>None</strong>
                      discharge date yet
                    </>
                  )}
                </span>
              ) : null}
            </span>
          )
        }
        journey={
          phoneStayStages ? (
            <JourneyStrip
              surface="hero"
              label="This record's last stay"
              stages={phoneStayStages}
              formatDuration={(minutes) =>
                minutes >= 1440 ? `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h` : dur(minutes)
              }
              note={false}
              className={`${styles.v6Journey} ${styles.phStayStrip}`}
            />
          ) : undefined
        }
        steps={
          phoneMovement ? (
            <div className={styles.phDots}>
              <span className={styles.phDotRow} aria-hidden="true">
                {STAGES.map((stage, i) => (
                  <span
                    key={stage.id}
                    className={styles.phDot}
                    data-s={i < currentStageIndex ? "done" : i === currentStageIndex ? "now" : "next"}
                  />
                ))}
              </span>
              <span>
                <span className="sr-only">
                  Stage {currentStageIndex + 1} of {STAGES.length}:{" "}
                </span>
                {STAGES[currentStageIndex].label}
              </span>
            </div>
          ) : isLiveBedflow ? (
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
          ) : null
        }
        tabs={recordTabs}
        actions={
          <>
            {modeMeta.quiet ? null : (
              // v10 phone: the movement page reads "Live HH:MM", the patient page a plain "Live".
              <LiveChip state="live" age={phoneMovement ? undefined : null} onHero />
            )}
            {isPhone ? null : (
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
            {(mode === "idle" || mode === "cto") && !isPhone ? (
              <Link
                href={livePatient ? raiseReferralHref({ patientId: livePatient.id }) : "/ward-flow/referrals/new"}
                className={buttonClass({ variant: modeMeta.quiet ? "pri" : "light", size: "sm" })}
                data-testid="ward-person-refer-outpatient"
              >
                <FileText size={14} aria-hidden="true" />
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
