"use client";

import type { WardCommandDispatch } from "../ward-shared-client";

import React, { type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, X } from "lucide-react";
import styles from "./ward-bed-dossier-drawer.module.css";
import { type BedItem } from "./ward-bed-tone";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  LEAVING_DESTINATIONS,
  stayDayNumber,
  type LeavingDestination,
} from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { BlockerEditor, type BlockerSave } from "./ward-bed-blocker-editor";
import { Button, Icon, StatusGlyph, buttonClass, cx, type WfTone } from "@/components/wf";
import type { Observation } from "@/components/ward-management/ward-observation";
import { WardObservationControl } from "./ward-observation-control";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import {
  BedActions,
  FactTile,
  NotLeftNotice,
  Row,
  shortLegal,
  type BedAction,
  type mainActionId,
} from "./ward-bed-dossier-bits";

// Preview copy of the phone bed sheet from `ward/ward-bed-dossier-drawer.tsx`, split out of the
// drawer copy to keep both under the line cap.

const CHIP_LABEL = new Map<WfTone, string>([
  ["danger", "Act now"],
  ["warning", "Needs a look"],
  ["success", "Ready"],
]);

interface PhoneBedSheetProps {
  bedLabel: string;
  bedItem: BedItem | undefined;
  isReady: boolean;
  occupantAlias: string;
  isOccupied: boolean;
  isAwayAtEd: boolean;
  tone: WfTone | null;
  stayDays: number | null;
  observation: string;
  expectedPlan: ReactNode;
  timeline: { at: number; tone: WfTone; label: string }[];
  now: number;
  personHref: string | null;
  selectedBed: number;
  quickBlockerOpen: boolean;
  setQuickBlockerOpen: (open: boolean) => void;
  selectedBlocker: BedReleaseBlocker | "";
  setSelectedBlocker: (blocker: BedReleaseBlocker | "") => void;
  blockerSelectRef: React.RefObject<HTMLSelectElement | null>;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onClose: () => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
  /** The blocker save; its `submit` is absent where this desk may not record one. */
  blockerSave: BlockerSave;
  onSetObservation?: (
    admissionId: string,
    observation: Observation,
    expected?: string,
  ) => ReturnType<WardCommandDispatch>;
  /** The observation editing token, the same one the desktop drawer sends. */
  observationToken?: string;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  onMove?: () => void;
  onOpenBoard?: () => void;
  /** Set only for a bed being made ready (A4-24). */
  onMarkReady?: () => void;
  onRaiseReferral?: () => void;
  fullReferralHref?: string | null;
  roleLockNote?: ReactNode;
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  /** Top 25: extra Plan to leave rows (flagged), built once by the drawer for both layouts. */
  planRows?: ReactNode;
  /** Top 25: a short note under Plan to leave (flagged). */
  planNote?: ReactNode;
  planCriteria?: ReactNode;
  /** D-80: the urgency and legal status controls for the journey this ward sent. */
  sentJourney?: ReactNode;
  /** D-64: the criteria led discharge note beside "Record that they have left". Warns, never blocks. */
  leavingCriteriaNote?: string | null;
  /** Top 25: a short note on a bed being made ready (flagged). */
  readyNote?: ReactNode;
  /** WT-02: the paper an involuntary stay needs first; while shown, "Record that they have left" waits. */
  leavePaper?: ReactNode;
  /** The expected leaving line as plain words, for the not-left notice. */
  notLeftPlan: string;
  /** Redesign: the desktop's Going out and Observation tiles, so both layouts show the same four facts. */
  goingOut: string;
  observationShort: string;
  /** Redesign: the same steps the desktop drawer lists, and which one is filled for this stay. */
  actions: BedAction[];
  mainId: ReturnType<typeof mainActionId>;
}

/**
 * Phone (v10 bed sheet): one scrolling sheet, no tabs. Bed and name lead, then four facts, then
 * This person, Plan to leave and Timeline as plain label rows. Move bed and the blocker sit in the
 * footer; every other action the desktop drawer offers stays in the sheet body.
 */
export function PhoneBedSheet({
  bedLabel,
  bedItem,
  isReady,
  occupantAlias,
  isOccupied,
  tone,
  stayDays,
  observation,
  expectedPlan,
  timeline,
  now,
  personHref,
  quickBlockerOpen,
  selectedBlocker,
  setSelectedBlocker,
  blockerSelectRef,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  onClose,
  blockerSave,
  onSetObservation,
  observationToken,
  onOpenBoard,
  onMarkReady,
  roleLockNote,
  bedDrawerRef,
  onKeyDown,
  planRows,
  planNote,
  planCriteria,
  sentJourney,
  leavingCriteriaNote,
  readyNote,
  leavePaper,
  actions,
  mainId,
  notLeftPlan,
  goingOut,
  observationShort,
}: PhoneBedSheetProps) {
  const chip = tone ? CHIP_LABEL.get(tone) : undefined;
  // Redesign: sex moves up from a fact tile to the line under the name, as on the desktop drawer.
  const sub = [bedItem?.umrn, isReady ? null : bedItem?.sex, bedItem?.podLabel ?? bedItem?.designation]
    .filter(Boolean)
    .join(" · ");
  const admissionId = bedItem?.admissionId;
  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <aside
        ref={bedDrawerRef}
        className={cx(styles.drawer, styles.show, styles.phoneSheet)}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onKeyDown={(event) => {
          onKeyDown(event);
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
      >
        <div className={styles.grab} aria-hidden="true" />
        <header className={styles.phoneHead}>
          <div className={styles.drawerHeading}>
            <h2 id="drawer-bed-title" className={styles.phoneTitle}>
              {bedLabel} ·{" "}
              {isReady ? (bedItem?.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready bed") : occupantAlias}
            </h2>
            {sub ? <p className={styles.drawerKicker}>{sub}</p> : null}
            {chip && tone ? (
              <span className={styles.phoneChip}>
                <StatusGlyph tone={tone} />
                {chip}
              </span>
            ) : null}
          </div>
          {/* Redesign: the kit sheet's close, a 36 px face with a larger invisible tap area. */}
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Close bed drawer"
            className={styles.phoneClose}
            onClick={onClose}
            data-sheet-autofocus="true"
          />
        </header>

        <div className={styles.phoneBody}>
          {isReady ? (
            <>
              <div className={styles.phoneFacts}>
                <FactTile
                  label="Now"
                  value={bedItem?.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
                  tone={bedItem?.preparing ? "neutral" : "success"}
                />
                <FactTile label="Pulled for" value={bedItem?.heldFor ?? "No one"} />
              </div>
              <h3 className={styles.phoneSec}>Placement</h3>
              <dl className={styles.phoneKv}>
                <Row label="Candidate">No patient match is recorded for this bed.</Row>
                {bedItem?.designation ? <Row label="Bed">{bedItem.designation}</Row> : null}
              </dl>
              {readyNote}
            </>
          ) : (
            <>
              <div className={styles.phoneFacts}>
                {/* Redesign: the same four facts as the desktop drawer. */}
                <FactTile label="Stay" value={stayDays === null ? "Not recorded" : `Day ${stayDayNumber(stayDays)}`} />
                <FactTile label="Legal" value={shortLegal(bedItem?.legalStatusLabel)} />
                <FactTile label="Going out" value={goingOut} tone={bedItem?.pastDate ? "danger" : null} />
                <FactTile label="Observation" value={observationShort} />
              </div>
              <NotLeftNotice bedItem={bedItem} expectedPlan={notLeftPlan} isOccupied={isOccupied} />
              <h3 className={styles.phoneSec}>This person</h3>
              <dl className={styles.phoneKv}>
                {bedItem?.preferredName ? <Row label="Known as">{bedItem.preferredName}</Row> : null}
                <Row label="Observation">{observation}</Row>
                <Row label="Community team">{bedItem?.catchmentCommunityTeam ?? "No community team yet"}</Row>
              </dl>
              {bedItem?.observation && admissionId ? (
                <WardObservationControl
                  key={`observation-${admissionId}`}
                  observation={bedItem.observation}
                  now={now}
                  showCurrent={false}
                  editingToken={observationToken}
                  onSave={
                    onSetObservation ? (next, expected) => onSetObservation(admissionId, next, expected) : undefined
                  }
                />
              ) : null}
              <h3 className={styles.phoneSec}>Plan to leave</h3>
              <dl className={styles.phoneKv}>
                <Row label="Expected">{expectedPlan}</Row>
                {planRows}
                {isOccupied && admissionId ? (
                  // The longest destinations do not fit beside the label at 390px, so the select takes its own line.
                  <Row label="Going to" wide>
                    <select
                      id="drawer-leaving-dest"
                      aria-label="Where are they going?"
                      className={styles.select}
                      value={drawerLeavingDestination}
                      onChange={(e) => {
                        setDrawerLeavingDestination(e.target.value as LeavingDestination);
                      }}
                    >
                      {LEAVING_DESTINATIONS.map((destination) => (
                        <option key={destination.id} value={destination.id}>
                          {destination.label}
                        </option>
                      ))}
                    </select>
                  </Row>
                ) : null}
              </dl>
              {planNote}
              <BlockerEditor
                save={blockerSave}
                blockReason={bedItem?.blockReason}
                open={quickBlockerOpen}
                selected={selectedBlocker}
                setSelected={setSelectedBlocker}
                selectRef={blockerSelectRef}
              />
              {planCriteria}
              {sentJourney ? (
                <>
                  <h3 className={styles.phoneSec}>Journey this ward sent</h3>
                  {sentJourney}
                </>
              ) : null}
              <h3 className={styles.phoneSec}>Timeline</h3>
              {timeline.length > 0 ? (
                <ul className={styles.timeline}>
                  {timeline.map((event) => (
                    <li key={`${event.label}-${event.at}`}>
                      <StatusGlyph tone={event.tone} />
                      <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
                      <span className={styles.ell}>{event.label}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.phoneEmpty}>Nothing recorded for this stay yet.</p>
              )}
            </>
          )}

          <div className={styles.phoneMore}>
            {isOccupied && admissionId ? (
              <>
                {/* Audit A1-12: the phone says plainly which destination "Has left" records too. */}
                <p className={styles.footDestination} id="drawer-leaving-summary-phone">
                  Going to{" "}
                  <strong>
                    {LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label}
                  </strong>
                </p>
                {leavingCriteriaNote ? (
                  <p
                    className={styles.footCriteria}
                    id="drawer-leaving-criteria-phone"
                    data-testid="ward-drawer-leaving-criteria"
                  >
                    {leavingCriteriaNote}
                  </p>
                ) : null}
                {leavePaper}
              </>
            ) : null}
            {isReady ? (
              <Link className={buttonClass({ variant: "sec", className: styles.pill })} href="/ward-flow/referrals">
                Review current referrals
              </Link>
            ) : null}
            {roleLockNote}
            {personHref ? (
              <Link className={buttonClass({ variant: "ghost", className: styles.pill })} href={personHref}>
                Patient page
                <Icon icon={ChevronRight} size={14} />
              </Link>
            ) : null}
          </div>
        </div>

        {(isReady && (onOpenBoard || onMarkReady)) || actions.length > 0 ? (
          <footer className={styles.phoneFoot}>
            {isReady && onMarkReady ? (
              <Button variant="pri" size="lg" className={styles.pill} onClick={onMarkReady}>
                Ready
              </Button>
            ) : isReady && onOpenBoard && !bedItem?.preparing ? (
              <Button variant="pri" size="lg" className={styles.pill} onClick={onOpenBoard}>
                Place someone here
              </Button>
            ) : null}
            {actions.length > 0 ? (
              <BedActions
                phone
                mainId={mainId}
                actions={actions.map((action) =>
                  action.id === "leave" && action.describedBy
                    ? {
                        ...action,
                        describedBy: leavingCriteriaNote
                          ? "drawer-leaving-summary-phone drawer-leaving-criteria-phone"
                          : "drawer-leaving-summary-phone",
                      }
                    : action,
                )}
              />
            ) : null}
          </footer>
        ) : null}
      </aside>
    </>
  );
}
