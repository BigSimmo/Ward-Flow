"use client";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Ambulance, BedDouble, Camera, FileText, Printer, Users } from "lucide-react";

import {
  Button,
  Card,
  CardHead,
  FactGrid,
  GroupHead,
  Hero,
  HeroChip,
  HeroChips,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  Spinner,
  StatusGlyph,
  Tabs,
  cx,
  durMinutes,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { BED_STATE_DETAILS, BED_STATE_LABELS } from "@/components/ward-management/ward-bed-states";
import {
  calendarDateOf,
  formatInstantWithDay,
  formatSheetMoment,
  perthCalendarDay,
  splitDuration,
  type Instant,
} from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import { useOnlineStatus } from "@/components/ward-management/use-online-status";

import {
  lastDowntimePack,
  markDowntimePackHandled,
  subscribeDowntimePack,
  type DowntimePack,
  type DowntimeWard,
} from "@/components/ward-management/reports/downtime-pack";
import { useDowntimePackAccess } from "@/components/ward-management/reports/downtime-pack-context";
import { nextDowntimePackAt } from "@/components/ward-management/reports/downtime-pack-schedule";
import { useTakeDowntimePack } from "./use-take-downtime-pack-redesign";
import { reportDay, reportMoment } from "@/components/ward-management/reports/report-parts";
import styles from "@/components/ward-management/reports/reports.module.css";

import redesign from "./downtime-redesign.module.css";

const NOT_RECORDED = "Not recorded";
const OFFLINE_LABEL = "taken offline";
/** F-08 (phone review, Oct 2026): printed at the top of the pack, so paper is never mistaken for records. */
const PRINT_NOTICE = "Prototype data, invented records. Not real patients and not for clinical use.";
/** A pack older than this reads as stale, in words and with a glyph. Nothing turns red. */
const STALE_AFTER_MINUTES = CLINICAL_VALUES.downtimePackStale.value;
/** Item 9 (Josh, 21 Oct 2026): the pack leaves the tab only as paper or a PDF the person saves. */
const KEEP_A_COPY =
  "To keep a file, choose Save as PDF in the print window and save it to your service's approved downtime location. Ward Flow keeps no copy on this device.";
/** How long "Taking snapshot" shows before the new time, so the change is seen. */
const TAKING_MS = 450;

type Section = "beds" | "ed" | "moves" | "forms";
/** Redesign: each table is the tab panel its tab controls (`Tabs` idPrefix "downtime"). */
const SECTION_IDS: Record<Section, string> = {
  beds: "downtime-panel-beds",
  ed: "downtime-panel-ed",
  moves: "downtime-panel-moves",
  forms: "downtime-panel-forms",
};

/** Wards grouped by service, in the pack's own order, with a subtotal per service. */
function serviceGroups(wards: readonly DowntimeWard[]) {
  const groups: Array<{
    service: string;
    wards: DowntimeWard[];
    total: {
      beds: number;
      ready: number;
      pending: number;
      occupied: number;
      onLeave: number;
      pulled: number;
      closed: number;
    };
  }> = [];
  for (const ward of wards) {
    let group = groups.find((entry) => entry.service === ward.service);
    if (!group) {
      group = {
        service: ward.service,
        wards: [],
        total: { beds: 0, ready: 0, pending: 0, occupied: 0, onLeave: 0, pulled: 0, closed: 0 },
      };
      groups.push(group);
    }
    group.wards.push(ward);
    group.total.beds += ward.beds;
    group.total.ready += ward.counts.ready;
    group.total.pending += ward.pendingPreparation;
    group.total.occupied += ward.counts.occupied;
    group.total.onLeave += ward.counts.onLeave;
    group.total.pulled += ward.counts.pulled;
    group.total.closed += ward.counts.closed;
  }
  return groups;
}

type PackTotals = { ready: number; ed: number; moves: number; forms: number };

/** The four hero figures of a pack. */
function packTotals(pack: DowntimePack): PackTotals {
  return {
    ready: pack.totals.ready,
    ed: pack.edQueue.length,
    moves: pack.pendingMoves.length,
    forms: pack.legalForms.length,
  };
}

/** "+2", "-1" or "0": the change since the last pack, in mono beside a hero figure. */
function signed(delta: number): string {
  return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0";
}

function twinWords(delta: number): string {
  if (delta === 0) return "no change since the last pack";
  return `${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} since the last pack`;
}

/** "17 beds · 13 occupied · 1 pulled · 1 closed": the parts that are not zero. */
function wardLine(ward: DowntimeWard): string {
  const parts = [`${ward.beds} beds`, `${ward.counts.occupied} occupied`];
  if (ward.counts.pulled > 0) parts.push(`${ward.counts.pulled} pulled`);
  if (ward.counts.closed > 0) parts.push(`${ward.counts.closed} closed`);
  if (ward.pendingPreparation > 0) parts.push(`${ward.pendingPreparation} being made ready`);
  return parts.join(" · ");
}

type SheetRow = { title: string; facts: Array<{ id: string; label: string; value: string }> };

/**
 * DOWNTIME PACK — a frozen snapshot of beds, the ED queue, moves under way and legal forms, for
 * paper use while the system is unavailable. The pack is frozen between takes: the shell retakes it
 * every hour and at each shift change, and "New snapshot" takes another at once. The last one is
 * kept in this tab's memory only (D-18), never in browser storage; a copy leaves the tab only as
 * paper or a PDF the person saves from the print window.
 *
 * v10: one hero with the frozen time and the four totals as chips that jump to their table. After a
 * new snapshot each chip carries a delta twin: the change since the pack it replaced. Phone is its
 * own layout: a compact hero, a four-way segmented control and rows that open a sheet of facts.
 *
 * Redesign mock-up: on screen one table shows at a time, chosen by tabs with counts; the print copy
 * still holds all four. Service rows read as group headers and ready counts are marked green.
 */
export function DowntimeRedesign() {
  const now = useWardFlowClock();
  const { dayZero, worldGeneration, shared, patients } = useWardFlowSelect(
    "dayZero",
    "worldGeneration",
    "shared",
    "patients",
  );
  // Redesign (D-83): rows name people surname first. A pack the shell took before this page opened
  // still says "Given Family · UMRN", so each row is re-read by its UMRN; anything else stays as taken.
  const formalByUmrn = useMemo(
    () => new Map(patients.map((patient) => [patient.umrn, `${patient.familyName}, ${patient.givenName}`])),
    [patients],
  );
  const personOf = (person: string): string => {
    const at = person.lastIndexOf(" · ");
    const formal = at < 0 ? undefined : formalByUmrn.get(person.slice(at + 3));
    return formal ? `${formal} · ${person.slice(at + 3)}` : person;
  };
  const isPhone = useIsPhone();
  const role = useRouteRole();
  const { owner, ready, unavailable } = useDowntimePackAccess();
  // UX audit 21 Oct 2026: offline, the shell takes no pack because the data may be stale, so this
  // screen must not stamp a newer time on it either.
  const online = useOnlineStatus();
  const canSnapshot = role === "coordinator" && ready && online && (!shared?.enabled || shared.status === "ready");

  const take = useTakeDowntimePack();

  // Taken or restored only after mount: the server snapshot is always null, so a server render never
  // holds a pack (it would be shared across visitors and its stamp would not match the browser's).
  const readPack = useCallback(() => lastDowntimePack(owner, worldGeneration), [owner, worldGeneration]);
  const pack = useSyncExternalStore(subscribeDowntimePack, readPack, () => null);
  // Take a pack whenever there is none: on first opening, and after a restored session has dropped
  // the one taken from the seed (the provider forgets it and notifies, whether or not the tree is
  // re-keyed). A reset or scenario switch (a new world generation) retakes it too, even while open.
  // A later world change alone never retakes: the pack is frozen until "New snapshot".
  useEffect(() => {
    if (lastDowntimePack(owner, worldGeneration) === null) take();
  }, [pack, owner, worldGeneration, take]);

  const [taking, setTaking] = useState(false);
  // The totals of the pack a New snapshot replaced, for the delta twins. Held by this screen only:
  // twins appear after a snapshot the reader asked for, never on opening.
  const [before, setBefore] = useState<PackTotals | null>(null);
  // The pack that New snapshot took. A scheduled retake replaces it, and then the twins would
  // compare two packs that were never side by side, so they show only against this one.
  const [twinFor, setTwinFor] = useState<DowntimePack | null>(null);
  const takingTimer = useRef<number | null>(null);
  useLayoutEffect(
    () => () => {
      if (takingTimer.current !== null) window.clearTimeout(takingTimer.current);
      takingTimer.current = null;
    },
    [owner, worldGeneration, ready, canSnapshot],
  );
  const newSnapshot = () => {
    if (!canSnapshot || taking) return;
    const current = lastDowntimePack(owner, worldGeneration);
    if (current) setBefore(packTotals(current));
    setTaking(true);
    takingTimer.current = window.setTimeout(() => {
      takingTimer.current = null;
      take();
      setTwinFor(lastDowntimePack(owner, worldGeneration));
      setTaking(false);
    }, TAKING_MS);
  };

  // A print started from the browser's own menu counts as well as the Print button.
  useEffect(() => {
    if (pack === null) return;
    const handled = () => markDowntimePackHandled(pack);
    window.addEventListener("afterprint", handled);
    return () => window.removeEventListener("afterprint", handled);
  }, [pack]);

  const [section, setSection] = useState<Section>("beds");
  const [sheet, setSheet] = useState<SheetRow | null>(null);
  const [previousBoundary, setPreviousBoundary] = useState({ owner, worldGeneration });
  if (previousBoundary.owner !== owner || previousBoundary.worldGeneration !== worldGeneration) {
    setPreviousBoundary({ owner, worldGeneration });
    setTaking(false);
    setBefore(null);
    setTwinFor(null);
    setSheet(null);
  }
  if (!canSnapshot && taking) setTaking(false);

  const at = (instant: Instant | null) => {
    if (instant === null) return NOT_RECORDED;
    const year = (value: Instant) => perthCalendarDay(calendarDateOf(value, dayZero)).year;
    // The provenance names the pack's year and zone. A row from another year must say its own year.
    return year(instant) === year(pack?.generatedAt ?? now)
      ? reportMoment(instant, dayZero)
      : formatSheetMoment(instant, dayZero, { includeYearAndZone: true });
  };

  if (pack === null) {
    return (
      <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v10">
        <main id="main-content" className={styles.main} aria-busy={unavailable ? undefined : true}>
          <Hero
            level={1}
            eyebrow="Downtime pack · synthetic data"
            title="Downtime pack"
            titleMeta={unavailable ? "Snapshot unavailable" : "Taking snapshot"}
          />
          {unavailable ? (
            <p className={styles.cardNote} role="status">
              {unavailable}
            </p>
          ) : (
            <Card aria-labelledby="downtime-preparing-title" className={styles.packLoading}>
              <CardHead id="downtime-preparing-title" icon={FileText} title="Preparing the downtime pack" />
              <p role="status" className={styles.cardNote}>
                Taking a snapshot of beds, the ED queue, pending moves and legal forms.
              </p>
              <div className={styles.packLoadingRows} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
            </Card>
          )}
        </main>
      </div>
    );
  }

  // Owner, 22 Oct 2026: a pack taken offline reads "taken offline" with the last updated time, and its
  // age runs from that sync, so it is never presented as freshly generated.
  const syncedAt = pack.offline ? pack.offline.lastSyncAt : pack.generatedAt;
  const provenance = pack.offline
    ? `Taken offline ${formatSheetMoment(pack.generatedAt, dayZero, { includeYearAndZone: true })} · last updated ${syncedAt === null ? NOT_RECORDED.toLowerCase() : formatSheetMoment(syncedAt, dayZero, { includeYearAndZone: true })}`
    : `Frozen ${formatSheetMoment(pack.generatedAt, dayZero, { includeYearAndZone: true })}`;
  const ageMinutes = syncedAt === null ? Infinity : Math.max(0, now - syncedAt);
  const stale = ageMinutes >= STALE_AFTER_MINUTES;
  const frozenAt = pack.offline
    ? `${OFFLINE_LABEL} · last updated ${syncedAt === null ? NOT_RECORDED.toLowerCase() : formatInstantWithDay(syncedAt, now)}`
    : formatInstantWithDay(pack.generatedAt, now);
  const groups = serviceGroups(pack.wards);

  const totals = packTotals(pack);
  const twin = (key: keyof PackTotals) =>
    before && !taking && twinFor === pack
      ? { twin: signed(totals[key] - before[key]), twinLabel: twinWords(totals[key] - before[key]) }
      : {};

  // Redesign: a chip or tab shows its table; the others stay in the print copy only.
  const jumpTo = (target: Section) => setSection(target);
  const onScreen = (target: Section) => (isPhone || section === target ? undefined : redesign.printOnlyPanel);

  const snapshotButton = (variant: "onHero" | "sec") => (
    <span className={styles.gated}>
      <Button
        variant={variant}
        icon={taking ? undefined : Camera}
        onClick={newSnapshot}
        aria-disabled={!canSnapshot || undefined}
        aria-describedby={canSnapshot ? undefined : "downtime-snapshot-reason"}
        data-testid="ward-downtime-refresh"
      >
        {taking ? (
          <>
            <Spinner /> Taking snapshot
          </>
        ) : (
          "New snapshot"
        )}
      </Button>
      {canSnapshot ? null : (
        <span id="downtime-snapshot-reason" className={styles.reasonOnHero}>
          {role !== "coordinator"
            ? "Coordinator only"
            : online
              ? "Waiting for current workspace"
              : "Offline. Snapshot when the connection returns."}
        </span>
      )}
    </span>
  );
  const printPack = () => {
    if (!ready || lastDowntimePack(owner, worldGeneration) !== pack) return;
    window.print();
    markDowntimePackHandled(pack);
  };
  const printButton = (
    <Button
      variant="light"
      icon={Printer}
      onClick={printPack}
      aria-disabled={!ready || undefined}
      data-testid="ward-downtime-print"
    >
      Print or save PDF
    </Button>
  );
  const printButtonOnHero = (
    <Button
      variant="onHero"
      icon={Printer}
      onClick={printPack}
      aria-disabled={!ready || undefined}
      data-testid="ward-downtime-print"
    >
      Print
    </Button>
  );
  // Device audit 11 Oct 2026: a column where every row reads "Not recorded" only pads the print.
  const edAccepted = pack.edQueue.some((line) => line.acceptedWard !== "");
  const movesEta = pack.pendingMoves.some((line) => line.transportEta !== null);
  const formsReceived = pack.legalForms.some((line) => line.receivedAt !== null);
  // The ED queue counts people still in the department; All EDs counts every open journey.
  const edPopulation =
    pack.leftEd > 0 ? `${pack.leftEd} more left their ED and are moving to a ward, listed under Pending moves.` : null;
  // The shell retakes the pack every hour and at each shift change (downtime-pack-schedule.ts).
  const nextPackAt = formatInstantWithDay(nextDowntimePackAt(pack.generatedAt), now);
  const takenLine = (
    <span data-testid="ward-downtime-generated">
      {pack.offline
        ? `Taken offline · last updated ${syncedAt === null ? NOT_RECORDED.toLowerCase() : at(syncedAt)} · next pack when the connection returns`
        : `Taken ${formatSheetMoment(pack.generatedAt, dayZero, { includeYearAndZone: true })} · next pack ${nextPackAt}`}
    </span>
  );
  const staleLine = stale ? (
    <span className={styles.staleLine} data-testid="ward-downtime-stale">
      <StatusGlyph tone="warning" size={9} />
      {!pack.offline
        ? `Stale · taken ${durMinutes(ageMinutes)} ago`
        : syncedAt === null
          ? "Stale · no update recorded"
          : `Stale · last updated ${durMinutes(ageMinutes)} ago`}
    </span>
  ) : null;

  // The four tables, shared by desktop and by the phone's printout: paper from any device carries
  // every table in full, never only the section a phone had open (remaining-pages audit 13 Oct 2026).
  const packTables = (
    <>
      <Card
        aria-labelledby="downtime-beds-title"
        id={SECTION_IDS.beds}
        className={cx(styles.packCard, onScreen("beds"))}
        role={isPhone ? undefined : "tabpanel"}
      >
        <CardHead
          id="downtime-beds-title"
          icon={BedDouble}
          title="Beds by ward"
          aside={
            <span className={styles.headMeta}>
              <b className={redesign.readyGreen}>{pack.totals.ready}</b> ready
              {pack.totals.pendingPreparation > 0 ? (
                <>
                  {" "}
                  · <b>{pack.totals.pendingPreparation}</b> being made ready
                </>
              ) : null}{" "}
              · <b>{pack.totals.occupied}</b> occupied of <b>{pack.totals.beds}</b>
            </span>
          }
        />
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Beds by ward table">
          <table
            className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
            data-testid="ward-downtime-beds"
          >
            <caption className={styles.srOnly}>Beds by ward at {at(pack.generatedAt)}, synthetic</caption>
            <thead>
              <tr>
                <th scope="col">Ward</th>
                <th scope="col" className={styles.num}>
                  Beds
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.ready}>
                  {BED_STATE_LABELS.ready}
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.beingMadeReady}>
                  {BED_STATE_LABELS.beingMadeReady}
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.occupied}>
                  {BED_STATE_LABELS.occupied}
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.onLeave}>
                  {BED_STATE_LABELS.onLeave}
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.pulled}>
                  {BED_STATE_LABELS.pulled}
                </th>
                <th scope="col" className={styles.num} title={BED_STATE_DETAILS.closed}>
                  {BED_STATE_LABELS.closed}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <Fragment key={group.service}>
                  <tr className={cx(styles.subtotal, redesign.groupHead)} data-testid="ward-downtime-subtotal">
                    <th scope="rowgroup">
                      {group.service}
                      <span className={styles.subtotalCount}>
                        {group.wards.length} {group.wards.length === 1 ? "ward" : "wards"}
                      </span>
                    </th>
                    <td className={styles.num}>{group.total.beds}</td>
                    <td className={styles.num}>
                      {group.total.ready > 0 ? <span className={redesign.readyChip}>{group.total.ready}</span> : 0}
                    </td>
                    <td className={styles.num}>{group.total.pending}</td>
                    <td className={styles.num}>{group.total.occupied}</td>
                    <td className={styles.num}>{group.total.onLeave}</td>
                    <td className={styles.num}>{group.total.pulled}</td>
                    <td className={styles.num}>{group.total.closed}</td>
                  </tr>
                  {group.wards.map((ward) => (
                    <tr key={ward.unitId}>
                      <th scope="row">{ward.name}</th>
                      <td className={styles.num}>{ward.beds}</td>
                      <td className={styles.num}>
                        {ward.counts.ready > 0 ? <span className={redesign.readyChip}>{ward.counts.ready}</span> : 0}
                      </td>
                      <td className={styles.num}>{ward.pendingPreparation}</td>
                      <td className={styles.num}>{ward.counts.occupied}</td>
                      <td className={styles.num}>{ward.counts.onLeave}</td>
                      <td className={styles.num}>{ward.counts.pulled}</td>
                      <td className={styles.num}>{ward.counts.closed}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.total}>
                <th scope="row">All wards</th>
                <td className={styles.num}>{pack.totals.beds}</td>
                <td className={styles.num} data-testid="ward-downtime-total-ready">
                  {pack.totals.ready > 0 ? <span className={redesign.readyChip}>{pack.totals.ready}</span> : 0}
                </td>
                <td className={styles.num}>{pack.totals.pendingPreparation}</td>
                <td className={styles.num}>{pack.totals.occupied}</td>
                <td className={styles.num}>{pack.totals.onLeave}</td>
                <td className={styles.num}>{pack.totals.pulled}</td>
                <td className={styles.num}>{pack.totals.closed}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className={styles.cardNote}>
          Beds in “Being made ready” are counted in Ready. Beds “On leave” are held for a patient on leave and counted
          in Occupied.
        </p>
      </Card>

      <Card
        aria-labelledby="downtime-ed-title"
        id={SECTION_IDS.ed}
        className={cx(styles.packCard, onScreen("ed"))}
        role={isPhone ? undefined : "tabpanel"}
      >
        <CardHead
          id="downtime-ed-title"
          icon={Users}
          title="ED queue"
          aside={
            <span className={styles.headMeta}>
              <b>{pack.edQueue.length}</b> still in ED
            </span>
          }
        />
        {pack.edQueue.length === 0 ? (
          <p className={styles.cardNote}>0 waiting. Nobody was in an ED queue when the pack was taken.</p>
        ) : (
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="ED queue table">
            <table
              className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
              data-testid="ward-downtime-ed"
            >
              <caption className={styles.srOnly}>Emergency department queue, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">ED</th>
                  <th scope="col">Arrived</th>
                  <th scope="col" className={styles.num}>
                    Waited
                  </th>
                  <th scope="col" className={styles.num}>
                    Urgency
                  </th>
                  <th scope="col">Legal status</th>
                  <th scope="col">Stage</th>
                  {edAccepted ? (
                    <th scope="col" className={styles.packAccepted}>
                      Accepted by
                    </th>
                  ) : null}
                  <th scope="col">Recorded observations</th>
                </tr>
              </thead>
              <tbody>
                {pack.edQueue.map((line) => (
                  <tr key={line.movementId}>
                    <th scope="row">{personOf(line.person)}</th>
                    <td className={styles.edCell}>{line.ed}</td>
                    <td className={styles.time}>{at(line.openedAt)}</td>
                    <td className={styles.num}>{splitDuration(line.waitedMinutes)}</td>
                    <td className={styles.num}>{line.urgency}</td>
                    <td>{line.legalStatus}</td>
                    <td>{line.stage}</td>
                    {edAccepted ? <td className={styles.packAccepted}>{line.acceptedWard || NOT_RECORDED}</td> : null}
                    <td>{line.observation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {edPopulation ? <p className={styles.cardNote}>{edPopulation}</p> : null}
      </Card>

      <Card
        aria-labelledby="downtime-moves-title"
        id={SECTION_IDS.moves}
        className={cx(styles.packCard, onScreen("moves"))}
        role={isPhone ? undefined : "tabpanel"}
      >
        <CardHead
          id="downtime-moves-title"
          icon={Ambulance}
          title="Pending moves"
          aside={
            <span className={styles.headMeta}>
              <b>{pack.pendingMoves.length}</b> accepted
            </span>
          }
        />
        {pack.pendingMoves.length === 0 ? (
          <p className={styles.cardNote}>0 pending. No accepted move was under way when the pack was taken.</p>
        ) : (
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Pending moves table">
            <table
              className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
              data-testid="ward-downtime-moves"
            >
              <caption className={styles.srOnly}>Pending moves, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Stage</th>
                  <th scope="col">Planned move</th>
                  {movesEta ? <th scope="col">Transport ETA</th> : null}
                  <th scope="col">Recorded observations</th>
                </tr>
              </thead>
              <tbody>
                {pack.pendingMoves.map((line) => (
                  <tr key={line.movementId}>
                    <th scope="row">{personOf(line.person)}</th>
                    <td className={styles.edCell}>{line.from}</td>
                    <td>{line.to}</td>
                    <td>{line.stage}</td>
                    <td className={styles.time}>{at(line.plannedAt)}</td>
                    {movesEta ? <td className={styles.time}>{at(line.transportEta)}</td> : null}
                    <td>{line.observation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        aria-labelledby="downtime-legal-title"
        id={SECTION_IDS.forms}
        className={cx(styles.packCard, onScreen("forms"))}
        role={isPhone ? undefined : "tabpanel"}
      >
        <CardHead
          id="downtime-legal-title"
          icon={FileText}
          title="Legal forms"
          meta="Recorded times only, not legally checked"
          aside={
            <span className={styles.headMeta}>
              <b>{pack.legalForms.length}</b> forms
            </span>
          }
        />
        {pack.legalForms.length === 0 ? (
          <p className={styles.cardNote}>0 forms. No legal form was on an open movement when the pack was taken.</p>
        ) : (
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Legal forms table">
            <table
              className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
              data-testid="ward-downtime-legal"
            >
              <caption className={styles.srOnly}>Legal forms with recorded times, synthetic</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Form</th>
                  <th scope="col">Legal status</th>
                  <th scope="col">Made</th>
                  {formsReceived ? <th scope="col">Received</th> : null}
                  <th scope="col">Typed expiry</th>
                </tr>
              </thead>
              <tbody>
                {pack.legalForms.map((line) => (
                  <tr key={line.movementId}>
                    <th scope="row">{personOf(line.person)}</th>
                    <td>{line.form || NOT_RECORDED}</td>
                    <td>{line.legalStatus}</td>
                    <td className={styles.time}>{at(line.madeAt)}</td>
                    {formsReceived ? <td className={styles.time}>{at(line.receivedAt)}</td> : null}
                    <td className={styles.time}>{at(line.typedExpiryAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );

  if (isPhone) {
    return (
      <div className={cx(styles.page, styles.phonePage)} data-testid="ward-downtime-pack" data-ward-design="v10">
        <main id="main-content" className={styles.main}>
          <div className={styles.phoneScreenOnly} data-print-hide>
            <PhoneHero
              level={1}
              className={styles.downtimePhoneHero}
              // F-08 (phone review, Oct 2026): the synthetic marker, as the desktop eyebrow carries it. A
              // frozen pack takes no Demo pill, whose pulse would read as live.
              eyebrow="Downtime pack · synthetic data"
              title={pack.offline ? `Frozen, ${frozenAt}` : `Frozen at ${frozenAt}`}
              sub={`${reportDay(pack.generatedAt, dayZero)} · next pack ${pack.offline ? "when online" : nextPackAt}`}
              // Ops-20 (13 Oct 2026): the counts sit once, in the section control below; the hero
              // keeps the frozen time and the actions.
              actions={
                <>
                  {snapshotButton("onHero")}
                  {/* Phone printing is rare: Print is a secondary here, never the area's primary. */}
                  {printButtonOnHero}
                </>
              }
            />
            {staleLine ? <p className={styles.phoneNote}>{staleLine}</p> : null}
            <p className={styles.phoneNote} data-testid="ward-downtime-keep-copy">
              {KEEP_A_COPY}
            </p>
            <Segmented<Section>
              className={cx(styles.phoneSeg, styles.phoneSegPinned)}
              size="md"
              label="Downtime pack section"
              value={section}
              onChange={setSection}
              items={[
                { id: "beds", label: "Beds", count: totals.ready },
                { id: "ed", label: "ED", count: totals.ed },
                { id: "moves", label: "Moves", count: totals.moves },
                { id: "forms", label: "Forms", count: totals.forms },
              ]}
            />
            {section === "beds" ? (
              groups.map((group) => (
                <section key={group.service} className={styles.phoneGroup} aria-label={group.service}>
                  <GroupHead
                    title={group.service}
                    aside={
                      <>
                        <b className={styles.phoneGroupFigure}>{group.total.ready}</b> ready
                      </>
                    }
                    variant="letter"
                    className={styles.phoneGroupHead}
                  />
                  <ul className={styles.phoneList}>
                    {group.wards.map((ward) => (
                      <PhoneListRow
                        key={ward.unitId}
                        as="li"
                        name={ward.name}
                        meta={<span className={styles.phoneMetaWrap}>{wardLine(ward)}</span>}
                        value={
                          <span className={styles.phoneReady}>
                            {ward.counts.ready > 0 ? <StatusGlyph tone="success" size={9} /> : null}
                            {ward.counts.ready}
                          </span>
                        }
                        time="ready"
                        onSelect={() =>
                          setSheet({
                            title: ward.name,
                            facts: [
                              { id: "beds", label: "Beds", value: String(ward.beds) },
                              { id: "ready", label: BED_STATE_LABELS.ready, value: String(ward.counts.ready) },
                              { id: "occupied", label: BED_STATE_LABELS.occupied, value: String(ward.counts.occupied) },
                              // Separate, as the row states them (UX audit 21 Oct 2026).
                              { id: "pulled", label: BED_STATE_LABELS.pulled, value: String(ward.counts.pulled) },
                              { id: "closed", label: BED_STATE_LABELS.closed, value: String(ward.counts.closed) },
                              ...(ward.pendingPreparation > 0
                                ? [
                                    {
                                      id: "preparing",
                                      label: "Being made ready",
                                      value: String(ward.pendingPreparation),
                                    },
                                  ]
                                : []),
                            ],
                          })
                        }
                      />
                    ))}
                  </ul>
                </section>
              ))
            ) : section === "ed" ? (
              <PhoneSection empty="Nobody waiting" count={pack.edQueue.length}>
                {pack.edQueue.map((line) => (
                  <PhoneListRow
                    key={line.movementId}
                    as="li"
                    name={personOf(line.person)}
                    meta={<span className={styles.phoneMetaWrap}>{`${line.ed} · ${line.stage}`}</span>}
                    value={splitDuration(line.waitedMinutes)}
                    time="waited"
                    onSelect={() =>
                      setSheet({
                        title: personOf(line.person),
                        facts: [
                          { id: "ed", label: "ED", value: line.ed },
                          { id: "arrived", label: "Arrived", value: at(line.openedAt) },
                          { id: "legal", label: "Legal status", value: line.legalStatus },
                          { id: "accepted", label: "Accepted by", value: line.acceptedWard || NOT_RECORDED },
                          { id: "observation", label: "Recorded observations", value: line.observation },
                        ],
                      })
                    }
                  />
                ))}
              </PhoneSection>
            ) : null}
            {section === "ed" && edPopulation ? <p className={styles.phoneNote}>{edPopulation}</p> : null}
            {section === "beds" || section === "ed" ? null : section === "moves" ? (
              <PhoneSection empty="No moves pending" count={pack.pendingMoves.length}>
                {pack.pendingMoves.map((line) => (
                  <PhoneListRow
                    key={line.movementId}
                    as="li"
                    name={personOf(line.person)}
                    meta={<span className={styles.phoneMetaWrap}>{`${line.from} to ${line.to}`}</span>}
                    value={line.plannedAt === null ? "None" : formatInstantWithDay(line.plannedAt, now)}
                    time="planned"
                    onSelect={() =>
                      setSheet({
                        title: personOf(line.person),
                        facts: [
                          { id: "to", label: "To", value: line.to },
                          { id: "stage", label: "Stage", value: line.stage },
                          { id: "planned", label: "Planned move", value: at(line.plannedAt) },
                          { id: "eta", label: "Transport ETA", value: at(line.transportEta) },
                          { id: "observation", label: "Recorded observations", value: line.observation },
                        ],
                      })
                    }
                  />
                ))}
              </PhoneSection>
            ) : (
              <PhoneSection empty="No legal forms on open movements" count={pack.legalForms.length}>
                {pack.legalForms.map((line) => (
                  <PhoneListRow
                    key={line.movementId}
                    as="li"
                    name={personOf(line.person)}
                    meta={
                      <span
                        className={styles.phoneMetaWrap}
                      >{`${line.form || NOT_RECORDED} · ${line.legalStatus}`}</span>
                    }
                    value={line.madeAt === null ? "None" : formatInstantWithDay(line.madeAt, now)}
                    time="made"
                    onSelect={() =>
                      setSheet({
                        title: personOf(line.person),
                        facts: [
                          { id: "form", label: "Form", value: line.form || NOT_RECORDED },
                          { id: "made", label: "Made", value: at(line.madeAt) },
                          { id: "received", label: "Received", value: at(line.receivedAt) },
                          { id: "expiry", label: "Typed expiry", value: at(line.typedExpiryAt) },
                        ],
                      })
                    }
                  />
                ))}
              </PhoneSection>
            )}
            <PhoneSheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet?.title ?? ""}>
              {sheet ? <FactGrid facts={sheet.facts} /> : null}
            </PhoneSheet>
          </div>
          <div className={styles.printOnly} data-testid="ward-downtime-print-pack">
            <p className={styles.printMeta}>Downtime pack · synthetic data · {provenance}. All row times are AWST.</p>
            <p className={styles.printMeta} data-testid="ward-downtime-print-notice">
              {PRINT_NOTICE}
            </p>
            {packTables}
          </div>
          <WardPrototypeFooter testId="ward-downtime-footer" note="Synthetic data" />
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page} data-testid="ward-downtime-pack" data-ward-design="v10">
      <main id="main-content" className={styles.main}>
        <Hero
          level={1}
          eyebrow="Downtime pack · synthetic data"
          title="Downtime pack"
          titleMeta={
            <span className={styles.frozen} data-testid="ward-downtime-frozen">
              <span className={styles.frozenDot} aria-hidden="true" />
              {/* Visual desk, 22 Oct 2026: the full "taken offline · last updated" line pushed the title to
                  "Dow…" at 1280, so the chip stays short and the taken line beside it says it in full. */}
              {pack.offline ? "Offline · last updated " : "Frozen "}
              <b>
                {pack.offline && syncedAt !== null
                  ? formatInstantWithDay(syncedAt, now)
                  : pack.offline
                    ? "not recorded"
                    : frozenAt}
              </b>
            </span>
          }
          aside={
            <span className={styles.heroActions} data-print-hide>
              {snapshotButton("onHero")}
              {printButton}
            </span>
          }
          bar={
            <HeroChips label="Pack totals, each shows its table">
              <HeroChip
                value={totals.ready}
                label={
                  pack.totals.pendingPreparation > 0
                    ? `Beds ready · ${pack.totals.pendingPreparation} being made ready`
                    : "Beds ready"
                }
                onPress={() => jumpTo("beds")}
                {...twin("ready")}
              />
              {/* Redesign: the chips use the tables' own names, so one thing has one word. */}
              <HeroChip value={totals.ed} label="ED queue" onPress={() => jumpTo("ed")} {...twin("ed")} />
              <HeroChip value={totals.moves} label="Pending moves" onPress={() => jumpTo("moves")} {...twin("moves")} />
              <HeroChip value={totals.forms} label="Legal forms" onPress={() => jumpTo("forms")} {...twin("forms")} />
            </HeroChips>
          }
          barAside={
            <span className={styles.heroLine}>
              {staleLine}
              {takenLine}
            </span>
          }
        />

        <p className={styles.cardNote} data-print-hide data-testid="ward-downtime-keep-copy">
          {KEEP_A_COPY}
        </p>

        {/* Redesign: one table on screen at a time, chosen here; the print copy still holds all four.
            The hero chips just above carry each table's count, so the tabs name the tables only. */}
        <div className={redesign.tabBar} data-print-hide>
          <Tabs<Section>
            label="Downtime pack section"
            idPrefix="downtime"
            value={section}
            onChange={setSection}
            className={redesign.tabs}
            items={[
              { id: "beds", label: "Beds by ward" },
              { id: "ed", label: "ED queue" },
              { id: "moves", label: "Pending moves" },
              { id: "forms", label: "Legal forms" },
            ]}
          />
          <span className={redesign.tabNote}>Print or save PDF holds all four tables.</span>
        </div>

        {/* F-08: the printout says it holds invented records before its first table. */}
        <p className={cx(styles.printOnly, styles.printMeta)} data-testid="ward-downtime-print-provenance">
          Downtime pack · {provenance}. All row times are AWST.
        </p>
        <p className={cx(styles.printOnly, styles.printMeta)}>{PRINT_NOTICE}</p>
        {packTables}

        <WardPrototypeFooter testId="ward-downtime-footer" note="Synthetic data" />
      </main>
    </div>
  );
}

/** A phone list with its empty line: 0 and a sentence, never a blank card. */
function PhoneSection({ empty, count, children }: { empty: string; count: number; children: ReactNode }) {
  if (count === 0) return <p className={styles.phoneNote}>0 · {empty}</p>;
  return <ul className={styles.phoneList}>{children}</ul>;
}
