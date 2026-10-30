// Fork of src/components/ward-management/capacity/capacity-ward-sidebar.tsx (Capacity redesign).
"use client";

// The side panel for one ward on the capacity screen, with its tabs and discharge record facts.
// Split out of `capacity-screen.tsx` (18 October 2026) to keep that file under the line cap.

import { capacityConfirmer } from "@/components/ward-management/capacity/capacity-confirmer";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeOpenHandle, DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useCanOpenHref, useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import { Button } from "@/components/wf";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  countCellText,
  freeingCellText,
  type NetworkWardRow,
} from "@/components/ward-management/capacity/capacity-derivations";
import styles from "@/components/ward-management/capacity/capacity.module.css";
import local from "./capacity-redesign.module.css";
import { WardClosurePanel } from "@/components/ward-management/capacity/ward-closure-panel";
import { bedKindsServed, isConfirmationFresh } from "@/components/ward-management/capacity/capacity-gap-words";
import { capacityRequestIsOpen } from "@/components/ward-management/ward/ward-buzz-keys";

const DISCHARGES_HREF = "/ward-flow/discharges";

export function CapacityTabs({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className={styles.sidebarTabs} role="tablist" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.id}
          id={`${id}-${option.id}-tab`}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          aria-controls={`${id}-panel`}
          tabIndex={value === option.id ? 0 : -1}
          onClick={() => onChange(option.id)}
          onKeyDown={(event) => {
            let next: number;
            if (event.key === "ArrowRight") next = (index + 1) % options.length;
            else if (event.key === "ArrowLeft") next = (index + options.length - 1) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault();
            onChange(options[next].id);
            document.getElementById(`${id}-${options[next].id}-tab`)?.focus();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Keyed by generation, declared actor and ward: stale selection receipts never cross a scope change. */
/** `now` is the page's clock from `usePageLive()`, so pausing the hero freezes this panel too. */
export function CapacityWardSidebar({ row, onBack, now }: { row: NetworkWardRow; onBack: () => void; now: Instant }) {
  const canOpen = useCanOpenHref();
  const wardHref = `/ward-flow/ward/${row.unit.id}`;
  const { bedReleases, refreshRequests, dispatch, readDischargeRecords, openDischargeRecord, readDischargeRecord } =
    useWardFlowSelect(
      "bedReleases",
      "refreshRequests",
      "dispatch",
      "readDischargeRecords",
      "openDischargeRecord",
      "readDischargeRecord",
    );
  const recordActors = useWardRecordActors();
  const recordActor =
    recordActors.find((actor) => actor.role === "ward" && actor.actingUnitId === row.unit.id) ?? recordActors[0]!;
  const [tab, setTab] = useState("ward");
  const [opened, setOpened] = useState<{ admissionId: string; handle: DischargeOpenHandle } | null>(null);
  const recordHeading = useRef<HTMLHeadingElement>(null);
  const recordOrigin = useRef<string | null>(null);
  useEffect(() => {
    if (opened) recordHeading.current?.focus();
  }, [opened]);
  const site = siteByCode(row.unit.siteCode);
  const records = readDischargeRecords(recordActor, row.unit.id);
  const detail = opened ? readDischargeRecord(recordActor, opened.admissionId, opened.handle) : null;
  const anonymousReleases = bedReleases.filter((release) => release.unitId === row.unit.id);
  const request = refreshRequests
    .filter((entry) => entry.unitId === row.unit.id && capacityRequestIsOpen(entry, row.unit.allocatable))
    .at(-1);
  function closeRecord() {
    setOpened(null);
    // The list remounts after state changes; restore its deliberate opener on the next frame.
    requestAnimationFrame(() => {
      if (recordOrigin.current) document.getElementById(recordOrigin.current)?.focus();
    });
  }
  function openRecord(record: DischargeRecord) {
    const handle = openDischargeRecord(recordActor, record.admissionId);
    setOpened({ admissionId: record.admissionId, handle });
  }
  return (
    <>
      <CapacityTabs
        id="capacity-ward"
        label="Selected ward"
        value={tab}
        onChange={(next) => {
          setTab(next);
          setOpened(null);
        }}
        options={[
          { id: "ward", label: "Ward" },
          { id: "discharges", label: "Discharges" },
        ]}
      />
      {/* Redesign (Josh, 30 Oct): the drawer's title names the ward and its close returns to the
          network, so the panel no longer repeats them. */}
      <div className={styles.wardIdentity}>
        <p>
          {siteLabel(row.unit.siteCode, site?.name)} · {site?.service ?? "Service not recorded"}
        </p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- catches Escape or arrow keys bubbling up from the focused control inside */}
      <div
        id="capacity-ward-panel"
        role="tabpanel"
        aria-labelledby={`capacity-ward-${tab}-tab`}
        tabIndex={0}
        className={styles.sidebarBody}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (opened) closeRecord();
            else onBack();
          }
        }}
      >
        {tab === "ward" ? (
          <>
            <dl className={styles.wardFacts}>
              <div>
                <dt>Total beds</dt>
                <dd>{row.unit.beds}</dd>
              </div>
              <div>
                <dt>Bed kinds</dt>
                <dd>{bedKindsServed(row.unit)}</dd>
              </div>
              <div>
                <dt>Ready</dt>
                <dd>{countCellText(row.ready)}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.pulled}</dt>
                <dd>{countCellText(row.pulled)}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.closed}</dt>
                <dd>{countCellText(row.closed)}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.occupied}</dt>
                <dd>
                  {countCellText(row.occupied)}
                  {row.onLeave > 0 ? ` · ${row.onLeave} ${BED_STATE_LABELS.onLeave.toLowerCase()}` : null}
                </dd>
              </div>
              <div>
                <dt>Freeing today</dt>
                <dd>{freeingCellText(row.freeing)}</dd>
              </div>
              <div>
                <dt>Gender mix</dt>
                <dd>
                  Female {row.unit.sexMix.Female} · Male {row.unit.sexMix.Male}
                </dd>
              </div>
              <div>
                <dt>Sex designation</dt>
                <dd>{row.unit.sexDesignation}</dd>
              </div>
              <div>
                <dt>Specialling free</dt>
                <dd>
                  {row.speciallingFree === undefined
                    ? "Not tracked here"
                    : `${row.speciallingFree} of ${row.speciallingStaffable}`}
                </dd>
              </div>
              <div>
                <dt>Authorised hospital</dt>
                <dd>{row.unit.authorised ? "Yes" : "No"}</dd>
              </div>
            </dl>
            {(row.pendingPreparation ?? 0) > 0 ? (
              <p className={styles.sidebarWarning}>{row.pendingPreparation} discharged beds still being made ready.</p>
            ) : null}
            {(row.reservationReleaseCapacityConflicts ?? 0) > 0 ? (
              <p className={styles.sidebarWarning}>
                {row.reservationReleaseCapacityConflicts} reservation release(s) need capacity re-confirmation — an
                offered count already reported its ceiling. No extra physical vacancy is implied.
              </p>
            ) : null}
            {(row.arrivalCapacityConflicts ?? 0) > 0 ? (
              <p className={styles.sidebarWarning}>
                {row.arrivalCapacityConflicts} arrival(s) awaiting capacity reconciliation.
              </p>
            ) : null}
            {row.bedRecordsMidUpdate ? (
              <p className={styles.sidebarWarning}>Bed records are mid-update. Gender mix may not be settled.</p>
            ) : null}
            <section className={styles.confirmationSection}>
              <h3>Confirmed beds</h3>
              <WardFreshness
                confirmedAt={row.confirmedAt}
                confirmedByRole={capacityConfirmer(row.unit)}
                derived={row.unit.allocatable.source !== "ward"}
                now={now}
              />
              <p className={!isConfirmationFresh(row.unit, now) ? styles.preparationWarning : undefined}>
                {isConfirmationFresh(row.unit, now) ? "Within" : "Past"} this ward’s{" "}
                {row.unit.allocatable.staleAfterMinutes} minute confirmation threshold.
              </p>
              {/* Redesign (Josh, 30 Oct): one name for this request, "Ask the ward", as on the side
                  card, on the kit's small secondary button. */}
              {recordActor.role === "coordinator" ? (
                <Button
                  size="sm"
                  variant="sec"
                  className={local.askWard}
                  onClick={() =>
                    dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: row.unit.id })
                  }
                >
                  Ask the ward
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="sec"
                  className={local.askWard}
                  disabledReason="Only the coordinator can ask the ward."
                >
                  Ask the ward
                </Button>
              )}
              {request ? <p role="status">Update requested {formatInstantWithDay(request.at, now)}.</p> : null}
            </section>
            <WardClosurePanel unit={row.unit} now={now} actor={recordActor} />
          </>
        ) : (
          <>
            <p className={styles.dischargeSummary}>
              {freeingCellText(row.freeing)} {row.freeing === 1 ? "bed" : "beds"} freeing today.
            </p>
            {opened ? (
              <section className={styles.recordDetail} aria-label="Discharge record detail">
                <button type="button" className={styles.textButton} onClick={closeRecord}>
                  Back to discharge list
                </button>
                {detail?.status === "allowed" ? (
                  <>
                    <h3 ref={recordHeading} tabIndex={-1}>
                      {dischargeRecordName(detail.value)}
                    </h3>
                    <DischargeRecordFacts record={detail.value} now={now} />
                  </>
                ) : (
                  <p role="status">This discharge record is unavailable. Return to the list and open it again.</p>
                )}
              </section>
            ) : (
              <>
                <h3 className={styles.sidebarSectionTitle}>Discharge records</h3>
                {records.status === "denied" ? (
                  <p className={styles.absent}>Discharge records are unavailable for this role.</p>
                ) : records.value.length === 0 ? (
                  <p className={styles.absent}>No discharge records for this ward.</p>
                ) : (
                  <ul className={styles.dischargeRecords}>
                    {records.value.map((record) => (
                      <li key={record.id}>
                        <button
                          type="button"
                          id={`capacity-discharge-${record.id}`}
                          className={styles.recordButton}
                          onClick={(event) => {
                            recordOrigin.current = event.currentTarget.id;
                            openRecord(record);
                          }}
                        >
                          <strong>{dischargeRecordName(record)}</strong>
                          <span>{dischargeRecordStage(record)}</span>
                        </button>
                        <p>
                          {record.expectedDischargeAt === null
                            ? "Expected date not recorded"
                            : `Expected ${formatInstantWithDay(record.expectedDischargeAt, now)}`}
                        </p>
                        {record.blockReason !== null ? (
                          <p className={styles.preparationWarning}>{record.blockReason}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <h3 className={styles.sidebarSectionTitle}>Bed frees (no name)</h3>
                {anonymousReleases.length === 0 ? (
                  <p className={styles.absent}>No anonymous bed releases recorded.</p>
                ) : (
                  <ul className={styles.dischargeRecords}>
                    {anonymousReleases.map((release) => (
                      <li key={release.id}>
                        <strong>{bedReleaseStateLabels[release.state]}</strong>
                        <p>{formatInstantWithDay(release.expectedAt, now)}</p>
                        {release.blocker ? (
                          <p className={styles.preparationWarning}>{release.blocker}</p>
                        ) : release.waitingOn ? (
                          <p>{release.waitingOn}</p>
                        ) : null}
                        {release.preparing ? (
                          <p>
                            Being made ready
                            {release.preparationNote ? ` · ${release.preparationNote}` : " · reason not recorded"}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </>
        )}
      </div>
      {/* Redesign (Josh, 30 Oct): each link shows only when this desk can open its page, by the same
          table the menu reads, so none leads to "Not part of your role". */}
      {canOpen(wardHref) || canOpen(DISCHARGES_HREF) ? (
        <div className={styles.sidebarFooter}>
          {canOpen(wardHref) ? <Link href={wardHref}>Open ward</Link> : null}
          {canOpen(DISCHARGES_HREF) ? <Link href={DISCHARGES_HREF}>Discharge board</Link> : null}
        </div>
      ) : null}
    </>
  );
}

function dischargeRecordName(record: DischargeRecord): string {
  if (record.identity.kind === "linked")
    return `${record.identity.patient.givenName} ${record.identity.patient.familyName}`;
  return record.identity.kind === "legacy-anonymous" ? "Identity not linked" : "Patient link unavailable";
}

function dischargeRecordStage(record: DischargeRecord): string {
  if (record.leftAt !== null) return "Departed";
  if (record.blockReason !== null) return "Discharge blocked";
  return record.dischargeConfirmedAt !== null ? "Confirmed" : "Expected";
}

function DischargeRecordFacts({ record, now }: { record: DischargeRecord; now: Instant }) {
  return (
    <dl className={styles.wardFacts}>
      {record.identity.kind === "linked" ? (
        <div>
          <dt>UMRN</dt>
          <dd>{record.identity.patient.umrn ?? "Not recorded"}</dd>
        </div>
      ) : null}
      <div>
        <dt>Status</dt>
        <dd>{dischargeRecordStage(record)}</dd>
      </div>
      <div>
        <dt>Expected</dt>
        <dd>
          {record.expectedDischargeAt === null ? "Not recorded" : formatInstantWithDay(record.expectedDischargeAt, now)}
        </dd>
      </div>
      <div>
        <dt>Date recorded by</dt>
        <dd>{record.dischargeDateSetBy ?? "Not recorded"}</dd>
      </div>
      <div>
        <dt>Date recorded at</dt>
        <dd>
          {record.dischargeDateSetAt === null ? "Not recorded" : formatInstantWithDay(record.dischargeDateSetAt, now)}
        </dd>
      </div>
      <div>
        <dt>Confirmed</dt>
        <dd>
          {record.dischargeConfirmedAt === null
            ? "Not confirmed"
            : formatInstantWithDay(record.dischargeConfirmedAt, now)}
        </dd>
      </div>
      <div>
        <dt>Confirmed by</dt>
        <dd>{record.dischargeConfirmedBy ?? "Not recorded"}</dd>
      </div>
      {record.blockReason !== null ? (
        <div>
          <dt>Waiting on</dt>
          <dd>{record.blockReason}</dd>
        </div>
      ) : null}
      {record.leftAt !== null ? (
        <>
          <div>
            <dt>Departed</dt>
            <dd>{formatInstantWithDay(record.leftAt, now)}</dd>
          </div>
          <div>
            <dt>Destination</dt>
            <dd>
              {LEAVING_DESTINATIONS.find((destination) => destination.id === record.leavingDestination)?.label ??
                "Not recorded"}
            </dd>
          </div>
        </>
      ) : null}
    </dl>
  );
}
