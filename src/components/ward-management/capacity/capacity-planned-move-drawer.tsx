"use client";

import Link from "next/link";
import { BedSingle, CalendarCheck, FileText, Pencil, X } from "lucide-react";

import {
  Button,
  DrawerFacts,
  DrawerFootRow,
  PanelDrawer,
  StatusGlyph,
  StatusPill,
  buttonClass,
  cx,
  durMinutes,
} from "@/components/wf";
import { SpelledCodes } from "@/components/ward-management/ward-abbreviations";
import {
  PLANNED_ADMISSION_REASON_LABELS,
  plannedAdmissionIsOverdue,
  type PlannedAdmission,
} from "@/components/ward-management/ward-admissions";
import { dayOf, formatInstant, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import type { StepDownBoardRow } from "@/components/ward-management/ward-step-down";

import type { PlannedListApi } from "./planned-admissions-panel";
import { StepDownRowDetail, type StepDownReferKit } from "./step-down-board";
import styles from "./capacity-page.module.css";

/**
 * Capacity issue 6 (Josh, 3 Nov 2026): a planned move's pop-up, modelled on the Movements one.
 * Who and when at the top with a bar to the expected time, the steps it passes through, where it
 * is going and the recorded facts, then the next step and every action in a band pinned to the
 * foot. Nothing here writes on its own: each button opens the planned admissions form it names.
 */
export function PlannedMoveDrawer({
  planned,
  now,
  api,
  ready,
  preparing,
  onClose,
}: {
  planned: PlannedAdmission | null;
  now: Instant;
  api: PlannedListApi;
  /** Ready beds on the booked ward now, when the page holds its row. */
  ready: number | undefined;
  /** Of those, beds still being made ready (the figure never drops for them). */
  preparing: number;
  onClose: () => void;
}) {
  const { units } = useWardFlowSelect("units");
  const canOpen = useCanOpenHref();
  const patientOf = usePatientOf();
  if (!planned) return null;
  const late = plannedAdmissionIsOverdue(planned, now);
  const dueToday = dayOf(planned.expectedArrivalAt) <= dayOf(now);
  const unit = units.find((candidate) => candidate.id === planned.unitId);
  const site = unit ? siteByCode(unit.siteCode) : undefined;
  const span = Math.max(1, planned.expectedArrivalAt - planned.bookedAt);
  const progress = Math.min(1, Math.max(0, (now - planned.bookedAt) / span));
  const ward = api.unitName(planned.unitId);
  const linked = patientOf(planned).patient;
  const recordHref = linked ? patientHref(linked.id) : null;
  const boardHref = wardBoardHref(planned.unitId);
  const step = dueToday ? 1 : 0;
  const run = (action: ((target: PlannedAdmission) => void) | undefined) =>
    action
      ? () => {
          onClose();
          action(planned);
        }
      : undefined;
  const arrived = run(api.arrived);
  const change = run(api.change);
  const cancel = run(api.cancel);
  // One filled action in the foot: Record arrival when it is due, otherwise the first page link.
  const lead =
    arrived && dueToday
      ? "arrival"
      : recordHref && canOpen(recordHref)
        ? "record"
        : canOpen(boardHref)
          ? "board"
          : null;

  return (
    <PanelDrawer
      open
      onClose={onClose}
      eyebrow="Planned admission"
      title={api.whoText(planned)}
      subtitle={`${PLANNED_ADMISSION_REASON_LABELS[planned.reason]} · ${planned.ageBand}`}
      tag={<StatusPill>Planned</StatusPill>}
      testId="capacity-planned-detail"
      foot={
        <>
          {arrived && dueToday ? (
            <Button variant="pri" className={styles.pmFootWide} icon={CalendarCheck} onClick={arrived}>
              Record arrival on {ward}
            </Button>
          ) : (
            <p className={styles.pmFootNext}>
              <StatusGlyph tone="neutral" size={9} />
              <span>
                Next: <strong>Arrival</strong>, expected {formatInstantWithDay(planned.expectedArrivalAt, now)}
              </span>
            </p>
          )}
          <DrawerFootRow>
            {recordHref && canOpen(recordHref) ? (
              <Link href={recordHref} className={buttonClass({ variant: lead === "record" ? "pri" : "sec" })}>
                <FileText strokeWidth={1.75} size={14} aria-hidden="true" />
                Patient record
              </Link>
            ) : null}
            {canOpen(boardHref) ? (
              <Link href={boardHref} className={buttonClass({ variant: lead === "board" ? "pri" : "sec" })}>
                <BedSingle strokeWidth={1.75} size={14} aria-hidden="true" />
                Ward board
              </Link>
            ) : null}
            {change ? (
              <Button variant="sec" icon={Pencil} onClick={change}>
                Change booking
              </Button>
            ) : null}
            {cancel ? (
              <Button variant="sec" icon={X} onClick={cancel}>
                Cancel booking
              </Button>
            ) : null}
          </DrawerFootRow>
        </>
      }
    >
      <div className={styles.pmDrawer}>
        <section className={cx(styles.pmHero, late && styles.pmHeroLate)} aria-label="When">
          <div className={styles.pmHeroTop}>
            <span className={styles.pmHeroWhen}>
              <span className={styles.pmHeroTime}>{formatInstant(planned.expectedArrivalAt)}</span>
              <span className={styles.pmHeroDay}>{dayLabel(planned.expectedArrivalAt, now)}</span>
            </span>
            <span className={styles.pmPill} data-tone={late ? "warning" : "neutral"}>
              {late
                ? `${durMinutes(Math.max(0, now - planned.expectedArrivalAt))} late`
                : `${durMinutes(Math.max(0, planned.expectedArrivalAt - now))} to go`}
            </span>
          </div>
          <span className={styles.pmBar} aria-hidden="true">
            <span className={cx(styles.pmBarFill, late && styles.pmBarLate)} style={{ width: `${progress * 100}%` }} />
          </span>
          <div className={styles.pmTimeFoot}>
            <span>
              Booked {formatInstantWithDay(planned.bookedAt, now)} by {planned.bookedBy}
            </span>
            <span>Due {formatInstant(planned.expectedArrivalAt)}</span>
          </div>
        </section>

        <Steps steps={["Booked", "Due", "Arrived"]} current={step} />

        <section className={styles.pmJourney} aria-label="Where to">
          <h3 className={styles.pmSectionHead}>Movement</h3>
          <div className={styles.pmStops}>
            <p className={styles.pmLeg}>
              <span className={styles.pmLegDot} data-kind="from" aria-hidden="true" />
              <span className={styles.pmLegText}>
                <b>
                  <SpelledCodes text={PLANNED_ADMISSION_REASON_LABELS[planned.reason]} />
                </b>
                <span className={styles.pmLegMeta}>Booked for {planned.expectedStayDays} days</span>
              </span>
            </p>
            <p className={styles.pmLeg}>
              <span className={styles.pmLegDot} data-kind="to" aria-hidden="true" />
              <span className={styles.pmLegText}>
                <b>
                  <SpelledCodes text={ward} />
                </b>
                <span className={styles.pmLegMeta}>
                  {unit ? siteLabel(unit.siteCode, site?.name) : "Site not recorded"}
                  {preparing > 0 ? ` · ${preparing} being made ready` : ""}
                </span>
              </span>
              {ready !== undefined ? (
                <span className={styles.pmPill} data-tone={ready > 0 ? "success" : "neutral"}>
                  {ready} ready now
                </span>
              ) : null}
            </p>
          </div>
        </section>

        {late ? (
          <p className={cx(styles.pmNote, styles.warnInk)}>
            <StatusGlyph tone="warning" size={9} /> Not arrived. Record the arrival, change the time or cancel.
          </p>
        ) : null}

        <h3 className={styles.pmSectionHead}>Booking</h3>
      </div>
      <DrawerFacts
        items={[
          { label: "Legal status", value: planned.legalStatus },
          { label: "Expected stay", value: `${planned.expectedStayDays} days` },
          { label: "Age group", value: planned.ageBand },
          { label: "Recorded sex", value: planned.sex },
          {
            label: "Changes",
            value:
              planned.changeCount === 0
                ? "Not changed"
                : `${planned.changeCount} ${planned.changeCount === 1 ? "change" : "changes"}`,
          },
          { label: "Service", value: site?.service ?? "Not recorded" },
        ]}
      />
    </PanelDrawer>
  );
}

/** A step-down candidate's pop-up: the same frame, with the wards that fit and the refer step. */
export function StepDownDrawer({
  row,
  now,
  kit,
  onClose,
}: {
  row: StepDownBoardRow | null;
  now: Instant;
  kit: StepDownReferKit;
  onClose: () => void;
}) {
  const patientOf = usePatientOf();
  const canOpen = useCanOpenHref();
  if (!row) return null;
  const who = patientOf(row.admission);
  const movement = row.transferMovement;
  const referred = movement?.referredUnitIds.length ?? 0;
  const step =
    movement?.stage === "arrived"
      ? 3
      : movement && ["accepted_awaiting_bed", "pulled", "handover_ready", "moving"].includes(movement.stage)
        ? 2
        : referred > 0
          ? 1
          : 0;
  const since = row.admission.arrivedAt;
  const recordHref = who.patient ? patientHref(who.patient.id) : null;
  const boardHref = wardBoardHref(row.fromUnit.id);
  const site = siteByCode(row.fromUnit.siteCode);

  return (
    <PanelDrawer
      open
      onClose={onClose}
      title={who.formalName}
      subtitle={`${who.umrn} · marked for step down`}
      tag={<StatusPill>Step down</StatusPill>}
      testId="capacity-step-down-detail"
      foot={
        <>
          <p className={styles.pmFootNext}>
            <StatusGlyph tone="neutral" size={9} />
            <span>
              {row.wards.length > 0 ? (
                <>
                  Next: <strong>{referred > 0 ? "Wait for a reply" : "Refer"}</strong>
                  {referred > 0 ? `, ${referred} ${referred === 1 ? "ward" : "wards"} asked` : " to a ward that fits"}
                </>
              ) : (
                <>
                  Next: <strong>Wait</strong> for a ready bed that fits
                </>
              )}
            </span>
          </p>
          <DrawerFootRow>
            {recordHref && canOpen(recordHref) ? (
              <Link href={recordHref} className={buttonClass({ variant: "pri" })}>
                <FileText strokeWidth={1.75} size={14} aria-hidden="true" />
                Patient record
              </Link>
            ) : null}
            {canOpen(boardHref) ? (
              <Link
                href={boardHref}
                className={buttonClass({ variant: recordHref && canOpen(recordHref) ? "sec" : "pri" })}
              >
                <BedSingle strokeWidth={1.75} size={14} aria-hidden="true" />
                Ward board
              </Link>
            ) : null}
          </DrawerFootRow>
        </>
      }
    >
      <div className={styles.pmDrawer}>
        <section className={styles.pmHero} aria-label="On the ward">
          <div className={styles.pmHeroTop}>
            <span className={styles.pmHeroWhen}>
              <span className={styles.pmHeroWard}>
                <SpelledCodes text={row.fromUnit.name} />
              </span>
              <span className={styles.pmHeroDay}>{site ? siteLabel(row.fromUnit.siteCode, site.name) : ""}</span>
            </span>
            <span className={styles.pmPill} data-tone="neutral">
              {since ? `${durMinutes(Math.max(0, now - since))} on the ward` : "Stay not recorded"}
            </span>
          </div>
          <div className={styles.pmTimeFoot}>
            <span>
              {row.admission.expectedDischargeAt
                ? `Discharge expected ${formatInstantWithDay(row.admission.expectedDischargeAt, now)}`
                : "No expected date set"}
            </span>
            <span>{row.fromUnitHasFreeBed ? "A ready bed on this ward" : "No ready bed on this ward"}</span>
          </div>
        </section>

        <Steps steps={["Marked", "Referred", "Accepted", "Moved"]} current={step} />

        <section className={styles.pmStepDown} aria-label="Wards that fit">
          <h3 className={styles.pmSectionHead}>
            Wards that fit with a ready bed <span className={styles.pmGroupCount}>{row.wards.length}</span>
          </h3>
          <StepDownRowDetail row={row} kit={kit} hideWho />
        </section>
      </div>
    </PanelDrawer>
  );
}

/** The Movements pop-up's step track, for a planned move's own steps. */
function Steps({ steps, current }: { steps: readonly string[]; current: number }) {
  return (
    <ol className={styles.pmSteps} aria-label="Steps">
      {steps.map((label, index) => (
        <li
          key={label}
          data-state={index < current ? "done" : index === current ? "now" : "next"}
          aria-current={index === current ? "step" : undefined}
        >
          <span className={styles.pmStepDot} aria-hidden="true" />
          <span className={styles.pmStepLabel}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** "Today", "Tomorrow" or the clock's own day words, under the big expected time. */
function dayLabel(at: Instant, now: Instant): string {
  const days = dayOf(at) - dayOf(now);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days < 0) return "Overdue";
  return formatInstantWithDay(at, now)
    .replace(/^\d{1,2}:\d{2},?\s*/u, "")
    .replace(/^in /u, "In ");
}
