"use client";

import type { WardCommandDispatch } from "../ward-shared-client";

import React, { type ReactNode } from "react";
import styles from "./ward-bed-dossier-drawer.module.css";
import { type BedItem } from "./ward-bed-tone";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { BlockerEditor, type BlockerSave } from "./ward-bed-blocker-editor";
import { StatusGlyph, type WfTone } from "@/components/wf";
import type { Observation } from "@/components/ward-management/ward-observation";
import type { BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { ChoiceChips, FactTile, NotLeftNotice, Row, shortLegal } from "./ward-bed-dossier-bits";

// The phone bed record's body, split out of `ward/ward-bed-dossier-drawer.tsx` to keep both under the
// line cap. Audit four #98: the phone opens the same kit PanelDrawer as tablet and desktop, so this
// draws the body only; the head, the foot, focus, Escape and the return of focus are the kit's.

const LEAVING_CHOICES = LEAVING_DESTINATIONS.map(({ id, label }) => ({ id, label }));

const CHIP_LABEL = new Map<WfTone, string>([
  ["danger", "Act now"],
  ["warning", "Needs a look"],
]);

/**
 * The status chip the phone head showed beside the bed pill ("Act now", "Needs a look"), in the
 * desktop hero's soft pill. Audit four #98: it now follows the bed pill on the kit head's line two.
 * A ready bed draws none: its title already reads "Ready bed".
 */
export function PhoneBedChip({ tone }: { tone: WfTone | null }) {
  const chip = tone ? CHIP_LABEL.get(tone) : undefined;
  if (!chip || !tone) return null;
  return (
    <span className={styles.heroPill} data-tone={tone} data-testid="bed-record-phone-chip">
      {chip}
    </span>
  );
}

interface PhoneBedSheetProps {
  bedItem: BedItem | undefined;
  isReady: boolean;
  /** C03: a closed bed with nobody in it, in the bed list's words, or null. */
  closedEmpty: { state: string; reason: string } | null;
  isOccupied: boolean;
  /** Which day of the stay today is (Perth calendar days, arrival day = Day 1), or null. */
  stayDay: number | null;
  expectedPlan: ReactNode;
  timeline: { at: number; tone: WfTone; label: string }[];
  now: number;
  quickBlockerOpen: boolean;
  selectedBlocker: BedReleaseBlocker | "";
  setSelectedBlocker: (blocker: BedReleaseBlocker | "") => void;
  blockerSelectRef: React.RefObject<HTMLDivElement | null>;
  drawerLeavingDestination: LeavingDestination | "";
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  /** The blocker save; its `submit` is absent where this desk may not record one. */
  blockerSave: BlockerSave;
  onSetObservation?: (
    admissionId: string,
    observation: Observation,
    expected?: string,
  ) => ReturnType<WardCommandDispatch>;
  /** The observation editing token, the same one the desktop drawer sends. */
  observationToken?: string;
  /** Top 25: extra Plan to leave rows (flagged), built once by the drawer for both layouts. */
  planRows?: ReactNode;
  /** Top 25: a short note under Plan to leave (flagged). */
  planNote?: ReactNode;
  planCriteria?: ReactNode;
  /** D-80: the urgency and legal status controls for the journey this ward sent. */
  sentJourney?: ReactNode;
  /** Top 25: a short note on a bed being made ready (flagged). */
  readyNote?: ReactNode;
  /** Feature item 4: the under 18 on an adult ward notice, under the four facts. */
  safetyNote?: ReactNode;
  /** WT-02: the paper an involuntary stay needs first; while shown, "Record discharge" waits. */
  leavePaper?: ReactNode;
  /** The expected leaving line as plain words, for the not-left notice. */
  notLeftPlan: string;
  /** Redesign: the desktop's Going out and Observation tiles, so both layouts show the same four facts. */
  goingOut: string;
  observationShort: string;
  /** Audit two #30: the change level control, under the Observation fact. */
  observationControl?: ReactNode;
  /** Audit two B5: the drawer's own rows, so both layouts list the same facts in the same order. */
  shiftRows?: ReactNode;
  whyRows: ReactNode;
  diagnosisTool?: ReactNode;
  personRows?: ReactNode;
  confirmation: string;
  dateMoves?: string | null;
  readyTool?: ReactNode;
}

/**
 * Phone (v10 bed sheet) body: one scroll, no tabs. Four facts, then This person, Leaving and History
 * as plain label rows, the words the desktop drawer uses. Audit four #98: the bed and name are in
 * the kit head, and Patient page, Review current referrals, the steps and the closure controls are
 * in the kit foot, exactly as on tablet and desktop.
 */
export function PhoneBedSheet({
  bedItem,
  isReady,
  closedEmpty,
  isOccupied,
  stayDay,
  expectedPlan,
  timeline,
  now,
  quickBlockerOpen,
  selectedBlocker,
  setSelectedBlocker,
  blockerSelectRef,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  blockerSave,
  planRows,
  planNote,
  planCriteria,
  sentJourney,
  readyNote,
  safetyNote,
  leavePaper,
  notLeftPlan,
  goingOut,
  observationShort,
  observationControl,
  shiftRows,
  whyRows,
  diagnosisTool,
  personRows,
  confirmation,
  dateMoves,
  readyTool,
}: PhoneBedSheetProps) {
  const admissionId = bedItem?.admissionId;
  const timelineList = (
    <ul className={styles.timeline}>
      {timeline.map((event) => (
        <li key={`${event.label}-${event.at}`}>
          <StatusGlyph tone={event.tone} />
          <span className={styles.timelineAt}>{formatInstantWithDay(event.at, now)}</span>
          <span className={styles.ell}>{event.label}</span>
        </li>
      ))}
    </ul>
  );
  if (closedEmpty) {
    return (
      <>
        <div className={styles.phoneFacts}>
          <FactTile label="Now" value="Closed" tone="closed" />
          <FactTile label="Offered" value="Not offered" />
        </div>
        <dl className={styles.phoneKv} data-testid="ward-drawer-closed-reason">
          <Row label="Closed">{closedEmpty.state}</Row>
          <Row label="Reason">{closedEmpty.reason}</Row>
        </dl>
        {timeline.length > 0 ? (
          <>
            <h3 className={styles.phoneSec}>History</h3>
            {timelineList}
          </>
        ) : null}
      </>
    );
  }
  if (isReady) {
    return (
      <>
        <div className={styles.phoneFacts}>
          <FactTile
            label="Now"
            value={bedItem?.preparing ? BED_STATE_LABELS.beingMadeReady : "Ready"}
            tone={bedItem?.preparing ? "neutral" : "success"}
          />
          {/* Audit two B4: Pulled for shows only when someone is; otherwise the bed type fills the pair. */}
          {bedItem?.heldFor ? (
            <FactTile label="Pulled for" value={bedItem.heldFor} />
          ) : (
            <FactTile label="Bed" value={bedItem?.designation ?? "Empty bed"} />
          )}
        </div>
        {bedItem?.heldFor && bedItem.designation ? (
          <dl className={styles.phoneKv}>
            <Row label="Bed">{bedItem.designation}</Row>
          </dl>
        ) : null}
        {readyNote}
        {/* Live audit item 13: an empty bed's closures and reopenings, when it has any. */}
        {timeline.length > 0 ? (
          <>
            <h3 className={styles.phoneSec}>History</h3>
            {timelineList}
          </>
        ) : null}
      </>
    );
  }
  return (
    <>
      <div className={styles.phoneFacts}>
        {/* Redesign: the same four facts as the desktop drawer. */}
        <FactTile label="Stay" value={stayDay === null ? "Not recorded" : `Day ${stayDay}`} />
        <FactTile label="Legal" value={shortLegal(bedItem?.legalStatusLabel)} />
        <FactTile label="Going out" value={goingOut} tone={bedItem?.pastDate ? "warning" : null} />
        <FactTile label="Observation" value={observationShort} />
      </div>
      {observationControl}
      <NotLeftNotice bedItem={bedItem} expectedPlan={notLeftPlan} isOccupied={isOccupied} />
      {safetyNote}
      {/* Audit two B5: the desktop drawer's facts in its order (Now, then Leaving), built once
          by the drawer. #30: no Observation row; the level is the fact tile above. */}
      {shiftRows ? (
        <>
          <h3 className={styles.phoneSec}>This shift</h3>
          <dl className={styles.phoneKv}>{shiftRows}</dl>
        </>
      ) : null}
      <h3 className={styles.phoneSec}>Why they are here</h3>
      <dl className={styles.phoneKv}>{whyRows}</dl>
      {diagnosisTool}
      {personRows ? (
        <>
          <h3 className={styles.phoneSec}>This person</h3>
          <dl className={styles.phoneKv}>{personRows}</dl>
        </>
      ) : null}
      <h3 className={styles.phoneSec}>Leaving</h3>
      <dl className={styles.phoneKv}>
        <Row label="Expected">{expectedPlan}</Row>
        <Row label="Confirmed">{confirmation}</Row>
        {dateMoves ? <Row label="Date moves">{dateMoves}</Row> : null}
        {planRows}
      </dl>
      {planNote}
      {readyTool}
      <BlockerEditor
        save={blockerSave}
        blockReason={bedItem?.blockReason}
        open={quickBlockerOpen}
        selected={selectedBlocker}
        setSelected={setSelectedBlocker}
        selectRef={blockerSelectRef}
      />
      {isOccupied && admissionId ? (
        <>
          <h3 className={styles.phoneSec}>Going to</h3>
          <ChoiceChips
            label="Where are they going?"
            items={LEAVING_CHOICES}
            value={drawerLeavingDestination}
            onChange={setDrawerLeavingDestination}
            testId="drawer-leaving-dest"
          />
        </>
      ) : null}
      {planCriteria}
      {sentJourney ? (
        <>
          <h3 className={styles.phoneSec}>Movement this ward sent</h3>
          {sentJourney}
        </>
      ) : null}
      <h3 className={styles.phoneSec}>History</h3>
      {timeline.length > 0 ? timelineList : <p className={styles.phoneEmpty}>Nothing recorded for this stay yet.</p>}
      {isOccupied && admissionId ? (
        <div className={styles.phoneMore}>
          {/* Audit A1-12: the phone says plainly which destination "Record discharge" records too;
              the foot's step names this line (`drawer-leaving-summary-phone`). */}
          <p className={styles.footDestination} id="drawer-leaving-summary-phone">
            Going to{" "}
            <strong>
              {LEAVING_DESTINATIONS.find((destination) => destination.id === drawerLeavingDestination)?.label ??
                "Not chosen yet"}
            </strong>
          </p>
          {leavePaper}
        </div>
      ) : null}
    </>
  );
}
