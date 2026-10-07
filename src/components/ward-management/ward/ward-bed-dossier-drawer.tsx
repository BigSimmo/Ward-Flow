"use client";

import React, { useState } from "react";
import Link from "next/link";
import styles from "./ward-bed-dossier-drawer.module.css";
import type { Unit } from "@/components/ward-management/ward-model";
import type { BedItem } from "./ward-beds-matrix";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { BED_RELEASE_BLOCKERS, type BedReleaseBlocker } from "@/components/ward-management/ward-change-reasons";
import { useWardModalFocus } from "@/components/ward-management/ward-modal-focus";

interface WardBedDossierDrawerProps {
  selectedBed: number;
  bedItem: BedItem | undefined;
  unit: Unit;
  onClose: () => void;
  drawerLeavingDestination: LeavingDestination;
  setDrawerLeavingDestination: (dest: LeavingDestination) => void;
  onRecordLeft: (admissionId: string, who: string, destination: LeavingDestination) => void;
  onUpdateBlocker?: (admissionId: string, blocker: string) => void;
  onMarkAtEd?: (bedNumber: number) => void;
  onMarkBack?: (bedNumber: number) => void;
  bedDrawerRef: React.RefObject<HTMLElement | null>;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
}

const WAITING_MATCH = {
  name: "Aaron K.",
  detail: "34yo male",
  source: "Emergency Dept (Psychiatric Assessment Team)",
  status: "Medically cleared",
  wait: "Wait recorded",
};

function recordedBlocker(value: string | undefined): BedReleaseBlocker {
  if (value && (BED_RELEASE_BLOCKERS as readonly string[]).includes(value)) {
    return value as BedReleaseBlocker;
  }
  return BED_RELEASE_BLOCKERS[0];
}

function Fact({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? `${styles.factRow} ${styles.factRowWide}` : styles.factRow}>
      <dt className={styles.factDt}>{label}</dt>
      <dd className={styles.factDd}>{value}</dd>
    </div>
  );
}

export function WardBedDossierDrawer({
  selectedBed,
  bedItem,
  unit,
  onClose,
  drawerLeavingDestination,
  setDrawerLeavingDestination,
  onRecordLeft,
  onUpdateBlocker,
  onMarkAtEd,
  onMarkBack,
  bedDrawerRef,
  onKeyDown,
}: WardBedDossierDrawerProps) {
  const [candidateAllocated, setCandidateAllocated] = useState(false);
  const [quickBlockerOpen, setQuickBlockerOpen] = useState(false);
  const [selectedBlocker, setSelectedBlocker] = useState<BedReleaseBlocker>(recordedBlocker(bedItem?.blockReason));

  useWardModalFocus(true, bedDrawerRef, onClose);

  const bedLabel = `Bed ${String(selectedBed).padStart(2, "0")}`;
  const isReady = bedItem?.status === "ready" || (!bedItem?.patientAlias && selectedBed === 20);
  const occupantAlias = bedItem?.patientAlias ?? "No occupant recorded";
  const isOccupied = Boolean(bedItem?.patientAlias);
  const isAwayAtEd = bedItem?.awayAtEdHours !== null && bedItem?.awayAtEdHours !== undefined;
  const title = isReady ? WAITING_MATCH.name : occupantAlias;
  const knownAs =
    bedItem?.preferredName && bedItem.preferredName !== occupantAlias ? `Known as ${bedItem.preferredName}` : null;

  const stayDays = typeof bedItem?.stayDays === "number" ? bedItem.stayDays : null;
  const stayHere =
    stayDays === null ? "Length of stay not recorded" : `${stayDays} day${stayDays === 1 ? "" : "s"} here`;

  const expectedPlan = bedItem?.pastDate
    ? bedItem.expectedDischargeLabel
      ? `Past the ward's own date (${bedItem.expectedDischargeLabel})`
      : "Past the ward's own date"
    : (bedItem?.expectedDischargeLabel ?? "No date set");

  const confirmation =
    bedItem?.dischargeConfirmed === true
      ? bedItem.dischargeConfirmedBy
        ? `Confirmed by ${bedItem.dischargeConfirmedBy}`
        : "Confirmed"
      : "Not yet confirmed";

  const dateMoves =
    typeof bedItem?.dischargeDateMoves === "number"
      ? bedItem.dischargeDateMoves === 0
        ? "Not moved"
        : `Moved ${bedItem.dischargeDateMoves} time${bedItem.dischargeDateMoves === 1 ? "" : "s"}`
      : null;

  return (
    <>
      <div className={`${styles.drawerScrim} ${styles.show}`} onClick={onClose} aria-hidden="true" />
      <aside
        ref={bedDrawerRef}
        className={`${styles.drawer} ${styles.show}`}
        data-testid="bed-telemetry-drawer"
        aria-labelledby="drawer-bed-title"
        role="dialog"
        aria-modal="true"
        onKeyDown={onKeyDown}
      >
        <header className={styles.drawerHead}>
          <div className={styles.drawerTitleGroup}>
            <span className={`${styles.drawerBedBadge} ${isReady ? styles.drawerBedBadgeReady : ""}`}>{bedLabel}</span>
            <div className={styles.drawerHeading}>
              <h2 id="drawer-bed-title" className={styles.drawerTitle}>
                {title}
              </h2>
              <p className={styles.drawerKicker}>
                {isReady
                  ? "Waiting to come in. This bed is empty and offered."
                  : [knownAs, bedItem?.stayBand, isAwayAtEd ? "Away at an emergency department" : null]
                      .filter(Boolean)
                      .join(" · ") || "On this ward"}
              </p>
            </div>
          </div>
          <button type="button" className={styles.drawerCloseBtn} onClick={onClose} aria-label="Close bed drawer">
            &times; Close
          </button>
        </header>

        {isReady ? (
          <div className={styles.drawerBody}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Person waiting</h3>
              </div>
              <dl className={styles.factList}>
                <Fact wide label="Who" value={`${WAITING_MATCH.name} · ${WAITING_MATCH.detail}`} />
                <Fact wide label="Source" value={WAITING_MATCH.source} />
                <Fact label="Status" value={WAITING_MATCH.status} />
                <Fact label="Wait" value={WAITING_MATCH.wait} />
              </dl>
              {candidateAllocated ? (
                <div className={`${styles.alertBanner} ${styles.alertSuccess}`}>
                  <span>Allocated to {WAITING_MATCH.name}. Bed locked for transit.</span>
                </div>
              ) : (
                <button type="button" className={styles.btnPrimaryAction} onClick={() => setCandidateAllocated(true)}>
                  Allocate this bed to {WAITING_MATCH.name} &rarr;
                </button>
              )}
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Clinical monitoring status</h3>
              </div>
              <dl className={styles.factList}>
                <Fact
                  wide
                  label="Vital signs"
                  value="Not recorded in Ward Flow. Check the ward's own observation chart."
                />
              </dl>
            </div>
          </div>
        ) : (
          <div className={styles.drawerBody}>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>This person</h3>
              </div>
              <dl className={styles.factList}>
                {typeof bedItem?.age === "number" || bedItem?.sex ? (
                  <Fact
                    label="Age and sex"
                    value={[typeof bedItem?.age === "number" ? `${bedItem.age}yo` : null, bedItem?.sex ?? null]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
                {bedItem?.gender ? <Fact label="Bed placement" value={bedItem.gender} /> : null}
                {bedItem?.umrn ? <Fact label="Record number" value={bedItem.umrn} /> : null}
                {bedItem?.homeRegion ? <Fact label="Region" value={bedItem.homeRegion} /> : null}
                {bedItem?.suburb ? <Fact label="Suburb" value={bedItem.suburb} /> : null}
                {bedItem?.generalPractitioner ? <Fact wide label="GP" value={bedItem.generalPractitioner} /> : null}
                {bedItem?.catchmentCommunityTeam ? (
                  <Fact wide label="Community team" value={bedItem.catchmentCommunityTeam} />
                ) : null}
              </dl>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Why they are here</h3>
              </div>
              <dl className={styles.factList}>
                <Fact wide label="Tentative diagnosis" value={bedItem?.tentativeDiagnosis ?? "None recorded"} />
                <Fact label="Days here" value={stayHere} />
                {bedItem?.stayBand ? <Fact label="Stay" value={bedItem.stayBand} /> : null}
              </dl>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Plan to leave</h3>
              </div>
              <dl className={styles.factList}>
                <Fact wide label="Expected leave" value={expectedPlan} />
                <Fact wide label="Discharge confirmed" value={confirmation} />
                {dateMoves ? <Fact label="Date changes" value={dateMoves} /> : null}
                <Fact wide label="Blocker" value={bedItem?.blockReason ?? "None recorded"} />
                {bedItem?.dischargeBarrier ? (
                  <Fact wide label="Discharge barrier" value={bedItem.dischargeBarrier} />
                ) : null}
              </dl>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>This shift</h3>
              </div>
              <dl className={styles.factList}>
                <Fact
                  wide
                  label="1:1 nursing"
                  value={
                    bedItem?.isSpecialling
                      ? "Specialling recorded (1:1 observation rostered)"
                      : "No specialling recorded"
                  }
                />
                <Fact label="High-acuity nursing" value={bedItem?.highAcuity ? "Requested" : "Not requested"} />
                <Fact
                  wide
                  label="Where they are"
                  value={
                    isAwayAtEd
                      ? `Away at an emergency department (${bedItem?.awayAtEdHours}h). Bed still held.`
                      : "On the ward"
                  }
                />
                {bedItem?.legalStatusLabel ? <Fact label="Legal status" value={bedItem.legalStatusLabel} /> : null}
                <Fact
                  wide
                  label="Vital signs"
                  value="Not recorded in Ward Flow. Check the ward's own observation chart."
                />
              </dl>
            </div>

            <div className={styles.card}>
              <div className={styles.cardHead}>
                <h3 className={styles.cardTitle}>Actions</h3>
              </div>
              {isOccupied && bedItem?.admissionId ? (
                <div className={styles.actionCard}>
                  <label htmlFor="drawer-leaving-dest" className={styles.actionLabel}>
                    Where are they going?
                  </label>
                  <select
                    id="drawer-leaving-dest"
                    className={styles.selectInput}
                    value={drawerLeavingDestination}
                    onChange={(e) => setDrawerLeavingDestination(e.target.value as LeavingDestination)}
                  >
                    {LEAVING_DESTINATIONS.map((destination) => (
                      <option key={destination.id} value={destination.id}>
                        {destination.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => onRecordLeft(bedItem.admissionId!, occupantAlias, drawerLeavingDestination)}
                  >
                    Record that they have left &rarr;
                  </button>
                </div>
              ) : null}
              <div className={styles.btnGrid}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => setQuickBlockerOpen(!quickBlockerOpen)}
                >
                  {bedItem?.blockReason ? "Update blocker" : "Record blocker"}
                </button>
                {isAwayAtEd ? (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => onMarkBack && onMarkBack(selectedBed)}
                  >
                    Mark back on ward
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => onMarkAtEd && onMarkAtEd(selectedBed)}
                  >
                    Mark away at ED
                  </button>
                )}
              </div>
              {quickBlockerOpen ? (
                <div className={styles.blockerEditor}>
                  <select
                    className={styles.selectInput}
                    value={selectedBlocker}
                    aria-label="Discharge blocker"
                    onChange={(e) => setSelectedBlocker(e.target.value as BedReleaseBlocker)}
                  >
                    {BED_RELEASE_BLOCKERS.map((blocker) => (
                      <option key={blocker} value={blocker}>
                        {blocker}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.btnPrimaryAction}
                    onClick={() => {
                      if (bedItem?.admissionId && onUpdateBlocker) {
                        onUpdateBlocker(bedItem.admissionId, selectedBlocker);
                      }
                      setQuickBlockerOpen(false);
                    }}
                  >
                    Save blocker &rarr;
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}

        <footer className={styles.drawerFoot}>
          <Link
            className={styles.footerLink}
            href={`/mockups/ward-flow/ward/${unit.id}/patient/${bedItem?.admissionId ?? selectedBed}`}
            onClick={onClose}
          >
            Open full patient chart &rarr;
          </Link>
        </footer>
      </aside>
    </>
  );
}
