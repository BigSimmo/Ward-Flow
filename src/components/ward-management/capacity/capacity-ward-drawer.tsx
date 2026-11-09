"use client";

// The ward drawer on Capacity (October 2026 redesign): one ward's beds as a picture, whether its
// count is fresh, its facts, closing the ward behind its own button, and its discharge records.

import { useWardFormSave } from "../use-ward-form-save";
import { capacityConfirmer } from "./capacity-confirmer";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LEAVING_DESTINATIONS } from "@/components/ward-management/ward-admissions";
import { dayOf, formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { DischargeOpenHandle, DischargeRecord } from "@/components/ward-management/ward-discharge-records";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { patientListName } from "@/components/ward-management/ward-patients";
import { useCanOpenHref, useWardRecordActors } from "@/components/ward-management/shell/ward-access";
import { BookUser, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonClass, DrawerFootRow, StatusGlyph, useIsPhone, type DrawerTab } from "@/components/wf";
import { siteLabel } from "@/components/ward-management/ward-absence-labels";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { WardFreshness } from "@/components/ward-management/ward-freshness";
import { BED_RELEASE_BLOCKED_LABEL, bedReleaseStateLabels } from "@/components/ward-management/ward-derivations";
import { BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import { openBedReleases } from "@/components/ward-management/ward-bed-availability";
import { countCellText, freeingCellText, type NetworkWardRow } from "./capacity-derivations";
import local from "./capacity-page.module.css";
import { BedCells, releaseParts } from "./capacity-bed-map-cards";
import { DayBars } from "./capacity-day-bars";
import { wardDayBars } from "./capacity-bed-forecast";
import type { HorizonDay, HorizonRow } from "@/components/ward-management/forecast/forecast-horizon";
import type { BedRelease } from "@/components/ward-management/ward-model";
import { WardClosuresDialog } from "./capacity-ward-closures-dialog";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { bedKindsServed, isConfirmationFresh } from "./capacity-gap-words";
import { capacityRequestIsOpen } from "@/components/ward-management/ward/ward-buzz-keys";
import { OnBehalfReasonForm } from "../on-behalf-reason-form-lazy";
import type { OnBehalfReasonId } from "../ward-on-behalf-reason";

const DISCHARGES_HREF = "/ward-flow/discharges";

export type CapacityWardTab = "ward" | "discharges";

/**
 * The ward panel's two tabs, shown by the kit drawer (`PanelDrawer`) that holds the panel, and the
 * selected one. Discharges counts the ward page's own window: releases not yet discharged
 * (`openBedReleases`). Each ward opens on Ward, as when the tabs lived inside the panel.
 */
export function useCapacityWardTabs(unitId: string | undefined): {
  tabs: DrawerTab<CapacityWardTab>[];
  tab: CapacityWardTab;
  onTabChange: (next: CapacityWardTab) => void;
} {
  const { bedReleases } = useWardFlowSelect("bedReleases");
  const [chosen, setChosen] = useState<{ unitId: string | undefined; tab: CapacityWardTab }>({
    unitId: undefined,
    tab: "ward",
  });
  if (unitId === undefined && chosen.unitId !== undefined) setChosen({ unitId: undefined, tab: "ward" });
  return {
    tabs: [
      { id: "ward", label: "Ward" },
      { id: "discharges", label: "Discharges", count: unitId ? openBedReleases(bedReleases, unitId).length : 0 },
    ],
    tab: chosen.unitId === unitId ? chosen.tab : "ward",
    onTabChange: (next) => setChosen({ unitId, tab: next }),
  };
}

/** Keyed by generation, declared actor and ward: stale selection receipts never cross a scope change. */
/** `now` is the page's clock from `usePageLive()`, so pausing the hero freezes this panel too. */
export function CapacityWardSidebar({
  row,
  onBack,
  now,
  tab = "ward",
  showPlace = true,
  footInDrawer = false,
  week,
}: {
  row: NetworkWardRow;
  /** The forecast's days and this ward's own row of them (the "By ward" view's row), for its bars. */
  week?: { days: readonly HorizonDay[]; row: HorizonRow | undefined };
  onBack: () => void;
  now: Instant;
  /** The drawer's selected tab (`useCapacityWardTabs`); the drawer draws the tabs themselves. */
  tab?: CapacityWardTab;
  /** False when the drawer's own header already names the hospital and service. */
  showPlace?: boolean;
  /** True when the drawer pins `CapacityWardFoot` to its own foot (Capacity issue 4). */
  footInDrawer?: boolean;
}) {
  const canOpen = useCanOpenHref();
  // Josh, 4 Nov 2026: on a phone "Open patient" beside each discharge row is a 40px icon button.
  const isPhone = useIsPhone();
  const refreshSave = useWardFormSave(`capacity-ward-refresh:${row.unit.id}`);
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
  const [opened, setOpened] = useState<{ admissionId: string; handle: DischargeOpenHandle | null } | null>(null);
  // A tab change closes an opened discharge record, as before the tabs moved into the kit drawer.
  const [shownTab, setShownTab] = useState(tab);
  if (shownTab !== tab) {
    setShownTab(tab);
    setOpened(null);
  }
  const recordHeading = useRef<HTMLHeadingElement>(null);
  const recordOrigin = useRef<string | null>(null);
  useEffect(() => {
    if (opened) recordHeading.current?.focus();
  }, [opened]);
  const site = siteByCode(row.unit.siteCode);
  const records = readDischargeRecords(recordActor, row.unit.id);
  const detail = opened ? readDischargeRecord(recordActor, opened.admissionId, opened.handle) : null;
  const anonymousReleases = bedReleases.filter((release) => release.unitId === row.unit.id);
  // Integration QA (3 Nov 2026): the Discharges count is the ward page's own window, releases not
  // yet discharged (`openBedReleases`), not every record plus every past release.
  const openReleases = openBedReleases(bedReleases, row.unit.id);
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
    // D-80 item 17: a coordinator's opening waits for its "on behalf of the ward" reason (null handle).
    const handle = recordActor.role === "coordinator" ? null : openDischargeRecord(recordActor, record.admissionId);
    setOpened({ admissionId: record.admissionId, handle });
  }
  function openOnBehalf(reason: OnBehalfReasonId) {
    if (opened?.handle !== null || !opened) return;
    setOpened({
      admissionId: opened.admissionId,
      handle: openDischargeRecord(recordActor, opened.admissionId, reason),
    });
  }
  const sortedRecords =
    records.status === "allowed" ? [...records.value].sort((x, y) => recordOrder(x, now) - recordOrder(y, now)) : [];
  const fresh = isConfirmationFresh(row.unit, now);
  const occupied = row.occupied + row.pulled;
  // C4 (Josh, 4 Nov 2026): the in-use squares coloured by discharge state, said in words too.
  const parts = releaseParts(bedReleases, row.unit.id);
  const wardBars = week ? wardDayBars(week.days, week.row) : null;
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
  const releaseNotes = [
    { count: parts.confirmed, words: "confirmed out", swatch: local.cellConfirmed },
    { count: parts.expected, words: "expected out", swatch: local.cellExpected },
    { count: parts.heldUp, words: BED_RELEASE_BLOCKED_LABEL.toLowerCase(), swatch: local.cellHeldUp },
  ].filter((note) => note.count > 0);
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
              <BedCells beds={row.unit.beds} ready={row.ready} used={occupied} parts={parts} />
              {releaseNotes.length > 0 ? (
                <ul className={`${local.mutedXs} ${local.wdPartsKey}`} aria-label="Beds in use by discharge state">
                  {releaseNotes.map((note) => (
                    <li key={note.words} className={local.wdPartsItem}>
                      <span aria-hidden="true" className={`${local.wdPartsSwatch} ${note.swatch ?? ""}`} />
                      {note.count} {note.words}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className={local.mutedXs}>{bedNotes.join(" · ")}</p>
            </section>

            {wardBars ? (
              <section className={local.wdWeek} aria-labelledby="capacity-ward-week">
                <h3 id="capacity-ward-week" className={local.wdGroupTitle}>
                  Going out, next {wardBars.bars.length} days
                </h3>
                <DayBars days={wardBars.bars} summary={wardBars.summary} mini />
              </section>
            ) : null}

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
                  disabled={request !== undefined || refreshSave.pending}
                  onClick={() =>
                    refreshSave.submit(
                      () =>
                        dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: row.unit.id }),
                      () => {},
                    )
                  }
                >
                  Ask the ward
                </Button>
              ) : null}
              {refreshSave.error ? (
                <p role="alert" className={local.mutedXs}>
                  {refreshSave.error}
                </p>
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

            {/* Capacity issue 4 (Josh, 3 Nov 2026): closing is a last resort, so it moved to a quiet
                "Closures" button in the drawer's foot. A closed ward still says so here. */}
            {row.unit.isClosed ? (
              <p className={`${local.wdNoticeLine} ${local.warnInk}`}>
                <StatusGlyph tone="closed" size={9} /> Closed to admissions. Reopen from Closures below.
              </p>
            ) : null}
          </>
        ) : opened ? (
          <section className={local.wdRecord} aria-label="Discharge record detail">
            <button type="button" className={local.wdBack} onClick={closeRecord}>
              <ChevronLeft strokeWidth={1.75} size={14} aria-hidden="true" /> All discharges
            </button>
            {detail?.status === "allowed" ? (
              <>
                <h3 ref={recordHeading} tabIndex={-1} className={local.wdRecordName}>
                  {dischargeRecordName(detail.value)}
                </h3>
                <span className={`${local.tag} ${stageTone(detail.value, now)}`}>{stageWords(detail.value, now)}</span>
                <DischargeRecordFacts record={detail.value} now={now} />
                {detail.value.identity.kind === "linked" && canOpen(patientHref(detail.value.identity.patient.id)) ? (
                  <div className={local.wdRecordActions}>
                    <Link
                      href={patientHref(detail.value.identity.patient.id)}
                      className={buttonClass({ variant: "sec", size: "sm" })}
                    >
                      Open patient
                    </Link>
                    {canOpen(DISCHARGES_HREF) ? (
                      <Link href={DISCHARGES_HREF} className={buttonClass({ variant: "ghost", size: "sm" })}>
                        Change on Discharge board
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : opened.handle === null ? (
              // D-80 item 17: the coordinator says why before the ward's record opens.
              <OnBehalfReasonForm key={opened.admissionId} onOpen={openOnBehalf} />
            ) : (
              <p role="status">This discharge record is unavailable. Return to the list and open it again.</p>
            )}
          </section>
        ) : (
          <>
            <p className={local.wdSummary}>{freeingWords}</p>
            <p className={local.mutedXs}>{openReleases.length} not yet discharged, the count the ward page shows.</p>
            {records.status === "denied" ? (
              <p className={local.mutedXs}>Discharge records are unavailable for this role.</p>
            ) : sortedRecords.length === 0 ? (
              <p className={local.mutedXs}>No discharge records for this ward.</p>
            ) : (
              <ul className={local.wdList} aria-label="Discharge records, soonest first">
                {sortedRecords.map((record) => {
                  // C4 (Josh, 4 Nov 2026): one click to the patient, beside the row and never inside it.
                  const href = record.identity.kind === "linked" ? patientHref(record.identity.patient.id) : null;
                  const openHref = href !== null && canOpen(href) ? href : null;
                  return (
                    <li key={record.id} className={openHref ? local.wdListWithLink : undefined}>
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
                        <span className={`${local.tag} ${stageTone(record, now)}`}>{stageWords(record, now)}</span>
                        <ChevronRight strokeWidth={1.75} size={14} aria-hidden="true" className={local.helpChevron} />
                      </button>
                      {openHref ? (
                        <Link
                          href={openHref}
                          className={`${buttonClass({ variant: "ghost", size: "sm", iconOnly: isPhone })} ${local.wdListLink}`}
                          aria-label={`Open patient, ${dischargeRecordName(record)}`}
                        >
                          {isPhone ? <BookUser size={16} strokeWidth={1.75} aria-hidden="true" /> : "Open patient"}
                        </Link>
                      ) : null}
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
                    <li key={release.id} className={`${local.wdListStatic} ${local.wdListTagged}`}>
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
                      <span className={`${local.tag} ${toneOfWords(releaseWords(release, now))}`}>
                        {releaseWords(release, now)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </div>
      {footInDrawer ? null : <CapacityWardFoot row={row} now={now} />}
    </>
  );
}

/**
 * The ward drawer's actions, pinned to the drawer's foot so they stay in reach however far the
 * discharge list scrolls (Capacity issue 4, Josh, 3 Nov 2026). Open ward leads; Closures is the
 * quiet last item, a last resort.
 */
export function CapacityWardFoot({ row, now }: { row: NetworkWardRow; now: Instant }) {
  const canOpen = useCanOpenHref();
  const recordActors = useWardRecordActors();
  const recordActor =
    recordActors.find((actor) => actor.role === "ward" && actor.actingUnitId === row.unit.id) ?? recordActors[0]!;
  const [closures, setClosures] = useState(false);
  const wardHref = `/ward-flow/ward/${row.unit.id}`;
  // A ward desk may close beds only on its own ward, the same test as the closure panel's mayAct.
  const mayClose =
    recordActor.role === "coordinator" ||
    recordActor.role === "bed_manager" ||
    (recordActor.role === "ward" && recordActor.actingUnitId === row.unit.id);
  // Redesign (Josh, 30 Oct): each link shows only when this desk can open its page.
  if (!canOpen(wardHref) && !canOpen(DISCHARGES_HREF) && !mayClose) return null;
  return (
    <DrawerFootRow>
      {/* One filled action, as every Capacity pop-up foot: Open ward, or the Discharge board when this
          desk cannot open the ward. Closures is never the filled one. */}
      {canOpen(wardHref) ? (
        <Link href={wardHref} className={buttonClass({ variant: "pri" })}>
          Open ward
        </Link>
      ) : null}
      {canOpen(DISCHARGES_HREF) ? (
        <Link href={DISCHARGES_HREF} className={buttonClass({ variant: canOpen(wardHref) ? "ghost" : "pri" })}>
          Discharge board
        </Link>
      ) : null}
      {mayClose ? (
        <>
          <Button
            variant="ghost"
            className={local.wdFootQuiet}
            aria-haspopup="dialog"
            onClick={() => setClosures(true)}
          >
            {row.unit.isClosed ? "Closures (ward closed)" : "Closures"}
          </Button>
          <WardClosuresDialog
            open={closures}
            onClose={() => setClosures(false)}
            unit={row.unit}
            now={now}
            actor={recordActor}
          />
        </>
      ) : null}
    </DrawerFootRow>
  );
}

/** Capacity issue 4: one colour per discharge state, the word always beside it. */
function stageWords(record: DischargeRecord, now: Instant): string {
  const stage = dischargeRecordStage(record);
  if (stage === "Discharge held up") return BED_RELEASE_BLOCKED_LABEL;
  if (stage !== "Expected" || record.expectedDischargeAt === null) return stage;
  if (record.expectedDischargeAt < now) return "Date passed";
  const days = dayOf(record.expectedDischargeAt) - dayOf(now);
  return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : "Expected";
}

function stageTone(record: DischargeRecord, now: Instant): string {
  return toneOfWords(stageWords(record, now));
}

/** One tone per status word, shared by the named records and the bed releases without a name. */
function toneOfWords(words: string): string {
  if (words === BED_RELEASE_BLOCKED_LABEL) return local.wdTagWarn ?? "";
  // Q8 (Josh, 4 Nov 2026): a passed date is amber, as everywhere else. Red means act now only.
  if (words === "Date passed") return local.wdTagWarn ?? "";
  if (words === "Due today" || words === "Due tomorrow") return local.wdTagInfo ?? "";
  if (words === "Confirmed" || words === "Left ward" || words === "Discharged") return local.wdTagGood ?? "";
  return "";
}

/** A bed release's status word, worded as the named records' (C4, Josh, 4 Nov 2026). */
function releaseWords(release: BedRelease, now: Instant): string {
  if (release.state !== "discharged" && release.blocker !== null) return BED_RELEASE_BLOCKED_LABEL;
  if (release.state !== "expected") return bedReleaseStateLabels[release.state];
  if (release.expectedAt < now) return "Date passed";
  const days = dayOf(release.expectedAt) - dayOf(now);
  return days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : bedReleaseStateLabels.expected;
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
  // Left ward, not Discharged: a record that has left also covers a death or a transfer.
  if (record.leftAt !== null) return "Left ward";
  if (record.blockReason !== null) return "Discharge held up";
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
          <dt>Held up by</dt>
          <dd>{record.blockReason}</dd>
        </div>
      ) : null}
      {record.leftAt !== null ? (
        <>
          <div>
            <dt>Left ward</dt>
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
