"use client";

// The ward drawer on Capacity (October 2026 redesign): one ward's beds as a picture, whether its
// count is fresh, its facts, closing the ward behind its own button, and its discharge records.

import { capacityConfirmer } from "./capacity-confirmer";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeOpenHandle, DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { patientListName } from "@/components/ward-management/ward-patients";
import { useCanOpenHref, useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonClass, Segmented, StatusGlyph } from "@/components/wf";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { countCellText, freeingCellText, type NetworkWardRow } from "./capacity-derivations";
import local from "./capacity-page.module.css";
import { BedCells } from "./capacity-bed-map-cards";
import { WardClosurePanel } from "./ward-closure-panel";
import { bedKindsServed, isConfirmationFresh } from "./capacity-gap-words";
import { capacityRequestIsOpen } from "@/components/ward-management/ward/ward-buzz-keys";

const DISCHARGES_HREF = "/ward-flow/discharges";

/** Keyed by generation, declared actor and ward: stale selection receipts never cross a scope change. */
/** `now` is the page's clock from `usePageLive()`, so pausing the hero freezes this panel too. */
export function CapacityWardSidebar({
  row,
  onBack,
  now,
  showPlace = true,
}: {
  row: NetworkWardRow;
  onBack: () => void;
  now: Instant;
  /** False when the drawer's own header already names the hospital and service. */
  showPlace?: boolean;
}) {
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
  const [tab, setTab] = useState<"ward" | "discharges">("ward");
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
  const sortedRecords =
    records.status === "allowed" ? [...records.value].sort((x, y) => recordOrder(x, now) - recordOrder(y, now)) : [];
  const fresh = isConfirmationFresh(row.unit, now);
  const occupied = row.occupied + row.pulled;
  const freeingWords =
    row.freeing === undefined
      ? "Freeing today is not tracked here"
      : row.freeing === 0
        ? "No beds freeing today"
        : `${row.freeing} ${row.freeing === 1 ? "bed" : "beds"} freeing today`;
  const bedNotes = [
    `${countCellText(row.occupied)} ${BED_STATE_LABELS.occupied.toLowerCase()}`,
    row.onLeave > 0 ? `${row.onLeave} ${BED_STATE_LABELS.onLeave.toLowerCase()}` : "",
    row.pulled > 0 ? `${row.pulled} ${BED_STATE_LABELS.pulled.toLowerCase()}` : "",
    row.closed > 0 ? `${row.closed} ${BED_STATE_LABELS.closed.toLowerCase()}` : "",
    (row.pendingPreparation ?? 0) > 0 ? `${row.pendingPreparation} being made ready` : "",
  ].filter(Boolean);
  // Polish (Josh, 31 Oct 2026): the panel leads with the ward's beds as one picture, then whether
  // the count is fresh with its one action, then the facts in two short groups. Closing the ward
  // is folded behind its own button. The Discharges tab lists records soonest first, surname
  // first, with a status tag on each.
  return (
    <>
      {showPlace ? (
        <p className={local.wdIdentity}>
          {siteLabel(row.unit.siteCode, site?.name)} · {site?.service ?? "Service not recorded"}
        </p>
      ) : null}
      <Segmented
        label="Ward panel view"
        className={local.wdTabs}
        items={[
          { id: "ward" as const, label: "Ward" },
          {
            id: "discharges" as const,
            label: "Discharges",
            count: records.status === "allowed" ? records.value.length + anonymousReleases.length : undefined,
          },
        ]}
        value={tab}
        onChange={(next) => {
          setTab(next);
          setOpened(null);
        }}
      />
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- catches Escape bubbling up from the focused control inside */}
      <div
        id="capacity-ward-panel"
        className={local.wdBody}
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
            <section className={local.wdBeds} aria-label="Beds now">
              <p className={local.wdBedsHead}>
                <span className={local.wdBedsFigure}>{countCellText(row.ready)}</span>
                <span>ready of {row.unit.beds} beds</span>
                <span className={`${local.tag} ${local.wdKind}`}>{bedKindsServed(row.unit)}</span>
              </p>
              <BedCells beds={row.unit.beds} ready={row.ready} used={occupied} />
              <p className={local.mutedXs}>{bedNotes.join(" · ")}</p>
            </section>

            <section className={local.wdConfirm} aria-label="Confirmed beds">
              <div className={local.wdConfirmMain}>
                <WardFreshness
                  confirmedAt={row.confirmedAt}
                  confirmedByRole={capacityConfirmer(row.unit)}
                  derived={row.unit.allocatable.source !== "ward"}
                  now={now}
                />
                {/* Polish (Josh, 31 Oct 2026): said only when the count is past its limit. */}
                {fresh ? null : (
                  <span className={`${local.mutedXs} ${local.warnInk}`}>
                    Past this ward’s {row.unit.allocatable.staleAfterMinutes} minute confirmation threshold
                  </span>
                )}
                {request ? (
                  <span role="status" className={local.mutedXs}>
                    Update requested {formatInstantWithDay(request.at, now)}
                  </span>
                ) : null}
              </div>
              {/* Redesign (Josh, 30 Oct): one name for this request, "Ask the ward". Polish (31 Oct): a
                  desk that may not ask sees no button, rather than a locked one with a reason. */}
              {recordActor.role === "coordinator" ? (
                <Button
                  size="sm"
                  variant="sec"
                  // One open request at a time, as before the redesign: the status above says it is sent.
                  disabled={request !== undefined}
                  onClick={() =>
                    dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: row.unit.id })
                  }
                >
                  Ask the ward
                </Button>
              ) : null}
            </section>

            {(row.reservationReleaseCapacityConflicts ?? 0) > 0 ||
            (row.arrivalCapacityConflicts ?? 0) > 0 ||
            row.bedRecordsMidUpdate ? (
              <ul className={local.wdNotices}>
                {(row.reservationReleaseCapacityConflicts ?? 0) > 0 ? (
                  <li>
                    <StatusGlyph tone="warning" size={9} />
                    {row.reservationReleaseCapacityConflicts} reservation release(s) need capacity re-confirmation. No
                    extra physical vacancy is implied.
                  </li>
                ) : null}
                {(row.arrivalCapacityConflicts ?? 0) > 0 ? (
                  <li>
                    <StatusGlyph tone="warning" size={9} />
                    {row.arrivalCapacityConflicts} arrival(s) awaiting capacity reconciliation.
                  </li>
                ) : null}
                {row.bedRecordsMidUpdate ? (
                  <li>
                    <StatusGlyph tone="warning" size={9} />
                    Bed records are mid-update. Gender mix may not be settled.
                  </li>
                ) : null}
              </ul>
            ) : null}

            <div className={local.wdGroups}>
              <FactGroup
                title="Today"
                rows={[
                  ["Freeing today", freeingCellText(row.freeing)],
                  [
                    "Specialling free",
                    row.speciallingFree === undefined
                      ? "Not tracked here"
                      : `${row.speciallingFree} of ${row.speciallingStaffable}`,
                  ],
                ]}
              />
              <FactGroup
                title="Ward"
                rows={[
                  ["Sex designation", row.unit.sexDesignation],
                  ["Gender mix", `Female ${row.unit.sexMix.Female} · Male ${row.unit.sexMix.Male}`],
                  ["Authorised hospital", row.unit.authorised ? "Yes" : "No"],
                ]}
              />
            </div>

            <details className={local.wdClosure} open={row.unit.isClosed || undefined}>
              <summary>
                <ChevronRight size={14} aria-hidden="true" />
                {row.unit.isClosed ? "Closed to admissions" : "Close to admissions"}
              </summary>
              <div className={local.wdClosureBody}>
                <WardClosurePanel unit={row.unit} now={now} actor={recordActor} />
              </div>
            </details>
          </>
        ) : opened ? (
          <section className={local.wdRecord} aria-label="Discharge record detail">
            <button type="button" className={local.wdBack} onClick={closeRecord}>
              <ChevronLeft size={14} aria-hidden="true" /> All discharges
            </button>
            {detail?.status === "allowed" ? (
              <>
                <h3 ref={recordHeading} tabIndex={-1} className={local.wdRecordName}>
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
            <p className={local.wdSummary}>{freeingWords}</p>
            {records.status === "denied" ? (
              <p className={local.mutedXs}>Discharge records are unavailable for this role.</p>
            ) : sortedRecords.length === 0 ? (
              <p className={local.mutedXs}>No discharge records for this ward.</p>
            ) : (
              <ul className={local.wdList} aria-label="Discharge records, soonest first">
                {sortedRecords.map((record) => {
                  const stage = dischargeRecordStage(record);
                  const passed =
                    record.leftAt === null && record.expectedDischargeAt !== null && record.expectedDischargeAt < now;
                  return (
                    <li key={record.id}>
                      <button
                        type="button"
                        id={`capacity-discharge-${record.id}`}
                        className={local.wdListRow}
                        onClick={(event) => {
                          recordOrigin.current = event.currentTarget.id;
                          openRecord(record);
                        }}
                      >
                        <span className={local.wdListMain}>
                          <span className={local.wdListName}>{dischargeRecordName(record)}</span>
                          <span className={local.mutedXs}>
                            {record.expectedDischargeAt === null
                              ? "Expected date not recorded"
                              : `Expected ${formatInstantWithDay(record.expectedDischargeAt, now)}`}
                          </span>
                          {record.blockReason !== null ? (
                            <span className={`${local.mutedXs} ${local.warnInk}`}>{record.blockReason}</span>
                          ) : null}
                        </span>
                        <span
                          className={`${local.tag} ${
                            stage === "Discharge blocked"
                              ? local.wdTagWarn
                              : stage === "Confirmed" || stage === "Departed"
                                ? local.tagGood
                                : ""
                          }`}
                        >
                          {stage === "Discharge blocked" ? "Blocked" : passed ? "Date passed" : stage}
                        </span>
                        <ChevronRight size={14} aria-hidden="true" className={local.helpChevron} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {anonymousReleases.length > 0 ? (
              <>
                <h3 className={local.wdGroupTitle}>Bed releases without a name</h3>
                <ul className={local.wdList}>
                  {anonymousReleases.map((release) => (
                    <li key={release.id} className={local.wdListStatic}>
                      <span className={local.wdListMain}>
                        <span className={local.wdListName}>{bedReleaseStateLabels[release.state]}</span>
                        <span className={local.mutedXs}>{formatInstantWithDay(release.expectedAt, now)}</span>
                        {release.blocker ? (
                          <span className={`${local.mutedXs} ${local.warnInk}`}>{release.blocker}</span>
                        ) : release.waitingOn ? (
                          <span className={local.mutedXs}>{release.waitingOn}</span>
                        ) : null}
                        {release.preparing ? (
                          <span className={local.mutedXs}>
                            Being made ready
                            {release.preparationNote ? ` · ${release.preparationNote}` : " · reason not recorded"}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
      {/* Redesign (Josh, 30 Oct): each link shows only when this desk can open its page. */}
      {canOpen(wardHref) || canOpen(DISCHARGES_HREF) ? (
        <div className={local.wdFoot}>
          {canOpen(wardHref) ? (
            <Link href={wardHref} className={buttonClass({ variant: "sec", size: "sm" })}>
              Open ward
            </Link>
          ) : null}
          {canOpen(DISCHARGES_HREF) ? (
            <Link href={DISCHARGES_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
              Discharge board
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function FactGroup({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <section className={local.wdGroup} aria-label={title}>
      <h3 className={local.wdGroupTitle}>{title}</h3>
      <dl className={local.wdFacts}>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** Blocked first, then soonest expected; a record with no date and departed records last. */
function recordOrder(record: DischargeRecord, now: Instant): number {
  if (record.leftAt !== null) return Number.MAX_SAFE_INTEGER;
  if (record.blockReason !== null) return Number.MIN_SAFE_INTEGER + (record.expectedDischargeAt ?? now);
  return record.expectedDischargeAt ?? Number.MAX_SAFE_INTEGER - 1;
}

function dischargeRecordName(record: DischargeRecord): string {
  // Surname first (D-83), with the list form every page uses.
  if (record.identity.kind === "linked") return patientListName(record.identity.patient);
  return record.identity.kind === "legacy-anonymous" ? "Identity not linked" : "Patient link unavailable";
}

function dischargeRecordStage(record: DischargeRecord): string {
  if (record.leftAt !== null) return "Departed";
  if (record.blockReason !== null) return "Discharge blocked";
  return record.dischargeConfirmedAt !== null ? "Confirmed" : "Expected";
}

function DischargeRecordFacts({ record, now }: { record: DischargeRecord; now: Instant }) {
  return (
    <dl className={local.wdFacts}>
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
