"use client";

import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { Ambulance, BedSingle, Camera, FileText, Users } from "lucide-react";

import {
  Card,
  CardHead,
  FactGrid,
  GroupHead,
  FolderTabs,
  Hero,
  HeroAct,
  HeroFigures,
  HeroPill,
  HeroQuickChips,
  HeroTop,
  SrOnly,
  folderTabClasses,
  heroChipClassName,
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
  leftEdNote,
  markDowntimePackHandled,
  subscribeDowntimePack,
  type DowntimePack,
  type DowntimeWard,
} from "./downtime-pack";
import { useDowntimePackAccess } from "./downtime-pack-context";
import { nextDowntimePackAt } from "./downtime-pack-schedule";
import { useTakeDowntimePack } from "./use-take-downtime-pack";
import { reportDay, reportMoment } from "./report-parts";
import { FORM_RECORDED_ENDED } from "@/components/ward-management/legal-forms/legal-form-progression";
import topTitle from "../shell/page-top-title.module.css";
import styles from "./reports.module.css";
import tabsStyles from "./downtime-pack-tabs.module.css";

const NOT_RECORDED = "Not recorded";
const OFFLINE_LABEL = "taken offline";
/** F-08 (phone review, Oct 2026): printed at the top of the pack, so paper is never mistaken for records. */
const PRINT_NOTICE = "Prototype data, invented records. Not real patients and not for clinical use.";
/** A pack older than this reads as stale, in words and with a glyph. Nothing turns red. */
const STALE_AFTER_MINUTES = CLINICAL_VALUES.downtimePackStale.value;
/** Item 9 (Josh, 21 Oct 2026): the pack leaves the tab only as paper or a PDF the person saves. */
const KEEP_A_COPY =
  "To keep a file, save it as a PDF to your service's approved downtime location. Ward Flow keeps no copy.";
/** How long "Taking snapshot" shows before the new time, so the change is seen. */
const TAKING_MS = 450;

type Section = "beds" | "ed" | "moves" | "forms";
/** Each table is the tab panel its tab controls (`Tabs` idPrefix "downtime"). */
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
 * Redesign (approved by Josh, 31 Oct 2026): on screen one table shows at a time, chosen by tabs; the
 * print copy still holds all four. Service rows read as group headers and ready counts are marked green.
 */
export function DowntimePackScreen() {
  const now = useWardFlowClock();
  const { dayZero, worldGeneration, shared } = useWardFlowSelect("dayZero", "worldGeneration", "shared");
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
                Taking a snapshot of beds, the ED queue, pending movements and legal forms.
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
  // A tab shows its table; the others stay in the print copy only.
  const onScreen = (target: Section) => (isPhone || section === target ? undefined : tabsStyles.printOnlyPanel);

  // Page-top redesign (Josh, 9 Nov 2026): New snapshot is the top's one chip, gated as before.
  const snapshotChip = (
    <span className={styles.gated}>
      <button
        type="button"
        className={heroChipClassName}
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
          <>
            <Camera size={16} strokeWidth={1.75} aria-hidden="true" />
            New snapshot
          </>
        )}
      </button>
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
  // Device audit 11 Oct 2026: a column where every row reads "Not recorded" only pads the print.
  const edAccepted = pack.edQueue.some((line) => line.acceptedWard !== "");
  const movesEta = pack.pendingMoves.some((line) => line.transportEta !== null);
  const formsReceived = pack.legalForms.some((line) => line.receivedAt !== null);
  // The ED queue counts people still in the department; All EDs counts every open journey.
  const edPopulation = leftEdNote(pack.leftEd);
  // The shell retakes the pack every hour and at each shift change (downtime-pack-schedule.ts).
  const nextPackAt = formatInstantWithDay(nextDowntimePackAt(pack.generatedAt), now);
  const takenLine = (
    <span data-testid="ward-downtime-generated">
      {pack.offline
        ? `Taken offline · last updated ${syncedAt === null ? NOT_RECORDED.toLowerCase() : at(syncedAt)} · next pack when the connection returns`
        : `Taken ${formatSheetMoment(pack.generatedAt, dayZero, { includeYearAndZone: true })} · next pack ${nextPackAt}`}
    </span>
  );
  const staleText = !stale
    ? null
    : !pack.offline
      ? `Stale · taken ${durMinutes(ageMinutes)} ago`
      : syncedAt === null
        ? "Stale · no update recorded"
        : `Stale · last updated ${durMinutes(ageMinutes)} ago`;

  // Page-top redesign (Josh, 9 Nov 2026): the frozen time is the title, then the pack's totals, the
  // print as the act row and New snapshot as the one chip. The tables follow as folder tabs.
  const frozenTitle = pack.offline
    ? `Offline · last updated ${syncedAt === null ? "not recorded" : formatInstantWithDay(syncedAt, now)}`
    : `Frozen at ${frozenAt}`;
  const day = reportDay(pack.generatedAt, dayZero);
  const twins = before && !taking && twinFor === pack;
  const tabItems: Array<{ id: Section; label: string; short: string; count: number }> = [
    { id: "beds", label: "Beds by ward", short: "Beds", count: totals.ready },
    { id: "ed", label: "ED queue", short: "ED", count: totals.ed },
    { id: "moves", label: "Pending movements", short: "Moves", count: totals.moves },
    { id: "forms", label: "Legal forms", short: "Forms", count: totals.forms },
  ];
  const twinKey: Record<Section, keyof PackTotals> = { beds: "ready", ed: "ed", moves: "moves", forms: "forms" };
  const pageTop = (
    <Hero
      level={1}
      className={cx(topTitle.hero, folderTabClasses.hero)}
      eyebrow={<SrOnly>Downtime pack · synthetic data</SrOnly>}
      title={
        <>
          <span data-testid="ward-downtime-frozen">{frozenTitle}</span>
          {isPhone ? null : (
            <>
              {" "}
              <span className={topTitle.soft}>{day}</span>
            </>
          )}
        </>
      }
      aside={
        <span data-page-top-pill="" data-print-hide>
          <HeroPill text={isPhone ? day : "Synthetic data"} />
        </span>
      }
    >
      <HeroTop
        figures={
          <HeroFigures
            label="Pack totals"
            items={[
              { id: "ready", value: totals.ready, label: "beds ready" },
              {
                id: "occupied",
                value: pack.totals.occupied,
                unit: <>&thinsp;/&thinsp;{pack.totals.beds}</>,
                label: "occupied",
              },
              { id: "making-ready", value: pack.totals.pendingPreparation, label: "being made ready" },
            ]}
          />
        }
        act={
          <HeroAct
            tone={staleText ? "warning" : "calm"}
            title={staleText ?? `Ready to print · next at ${pack.offline ? "when online" : nextPackAt}`}
            titleTestId={staleText ? "ward-downtime-stale" : undefined}
            action={{
              label: "Print or save PDF",
              phoneLabel: "Print",
              onClick: printPack,
              testId: "ward-downtime-print",
            }}
          />
        }
        chips={
          <div className={styles.topChips} data-print-hide>
            <HeroQuickChips
              label="Pack actions"
              items={[{ id: "snapshot", label: "New snapshot", node: snapshotChip }]}
            />
            {isPhone ? null : (
              <p className={styles.topNote} data-testid="ward-downtime-keep-copy">
                {KEEP_A_COPY}
              </p>
            )}
          </div>
        }
      >
        {twins ? (
          <p className={styles.topTwins}>
            <span aria-hidden="true">Against the last pack: </span>
            {tabItems.map((item, index) => {
              const delta = totals[twinKey[item.id]] - before[twinKey[item.id]];
              return (
                <span key={item.id}>
                  <span aria-hidden="true">
                    {index > 0 ? " · " : ""}
                    {item.short} {signed(delta)}
                  </span>
                  <SrOnly>{`${item.label}: ${twinWords(delta)}.`}</SrOnly>
                </span>
              );
            })}
          </p>
        ) : null}
      </HeroTop>
    </Hero>
  );

  // D-115 (audit 6): everyone absent without leave, by ward, named as the pack names everyone else.
  const missing = pack.wards.flatMap((ward) =>
    (ward.absentWithoutLeave ?? []).map((line) => ({ ward: ward.name, line })),
  );
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
          icon={BedSingle}
          title="Beds by ward"
          aside={
            <span className={cx(styles.headMeta, styles.printOnlyInline)}>
              <b className={tabsStyles.readyGreen}>{pack.totals.ready}</b> ready
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
                  <tr className={cx(styles.subtotal, tabsStyles.groupHead)} data-testid="ward-downtime-subtotal">
                    <th scope="rowgroup">
                      {group.service}
                      <span className={styles.subtotalCount}>
                        {group.wards.length} {group.wards.length === 1 ? "ward" : "wards"}
                      </span>
                    </th>
                    <td className={styles.num}>{group.total.beds}</td>
                    <td className={styles.num}>
                      {group.total.ready > 0 ? <span className={tabsStyles.readyChip}>{group.total.ready}</span> : 0}
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
                        {ward.counts.ready > 0 ? <span className={tabsStyles.readyChip}>{ward.counts.ready}</span> : 0}
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
                <th scope="row">Wards in this snapshot</th>
                <td className={styles.num}>{pack.totals.beds}</td>
                <td className={styles.num} data-testid="ward-downtime-total-ready">
                  {pack.totals.ready > 0 ? <span className={tabsStyles.readyChip}>{pack.totals.ready}</span> : 0}
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
        <p className={styles.cardNote}>Ready includes beds being made ready. Occupied includes beds held for leave.</p>
        {missing.length > 0 ? (
          <ul className={styles.cardNote} data-testid="ward-downtime-awol">
            {missing.map(({ ward, line }) => (
              <li key={line.admissionId}>
                <StatusGlyph tone="danger" size={9} /> Absent without leave, {ward}: {line.person}, since{" "}
                {at(line.since)}
              </li>
            ))}
          </ul>
        ) : null}
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
            <span className={cx(styles.headMeta, styles.printOnlyInline)}>
              <b>{pack.edQueue.length}</b> still in ED
            </span>
          }
        />
        {pack.edQueue.length === 0 ? (
          <p className={styles.cardNote}>0 waiting when the pack was taken.</p>
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
                    <th scope="row">{line.person}</th>
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
          title="Pending movements"
          aside={
            <span className={cx(styles.headMeta, styles.printOnlyInline)}>
              <b>{pack.pendingMoves.length}</b> accepted
            </span>
          }
        />
        {pack.pendingMoves.length === 0 ? (
          <p className={styles.cardNote}>0 pending when the pack was taken.</p>
        ) : (
          <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Pending movements table">
            <table
              className={`${tableClasses.table} ${styles.table} ${styles.packTable}`}
              data-testid="ward-downtime-moves"
            >
              <caption className={styles.srOnly}>Pending movements, synthetic</caption>
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
                    <th scope="row">{line.person}</th>
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
            <span className={cx(styles.headMeta, styles.printOnlyInline)}>
              <b>{pack.legalForms.length}</b> forms
            </span>
          }
        />
        {pack.legalForms.length === 0 ? (
          <p className={styles.cardNote}>0 forms when the pack was taken.</p>
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
                    <th scope="row">{line.person}</th>
                    <td>{line.form || NOT_RECORDED}</td>
                    <td>{line.legalStatus}</td>
                    <td className={styles.time}>{at(line.madeAt)}</td>
                    {formsReceived ? <td className={styles.time}>{at(line.receivedAt)}</td> : null}
                    <td className={styles.time}>{line.formEnded ? FORM_RECORDED_ENDED : at(line.typedExpiryAt)}</td>
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
            {pageTop}
            <FolderTabs label="Downtime pack tables" value={section} testId="ward-downtime-tabs">
              <Segmented<Section>
                className={folderTabClasses.switch}
                size="md"
                label="Downtime pack section"
                value={section}
                onChange={setSection}
                items={tabItems.map((item) => ({ id: item.id, label: item.short, count: item.count }))}
              />
            </FolderTabs>
            <p className={styles.phoneNote} data-testid="ward-downtime-keep-copy">
              {KEEP_A_COPY}
            </p>
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
                          // Page-top redesign (Josh, 9 Nov 2026): "✓ 2 ready" on one line.
                          <span className={styles.phoneReady}>
                            {ward.counts.ready > 0 ? <StatusGlyph tone="success" size={9} /> : null}
                            {ward.counts.ready} <small className={styles.phoneReadyUnit}>ready</small>
                          </span>
                        }
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
                    name={line.person}
                    meta={<span className={styles.phoneMetaWrap}>{`${line.ed} · ${line.stage}`}</span>}
                    value={splitDuration(line.waitedMinutes)}
                    time="waited"
                    onSelect={() =>
                      setSheet({
                        title: line.person,
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
                    name={line.person}
                    meta={<span className={styles.phoneMetaWrap}>{`${line.from} to ${line.to}`}</span>}
                    value={line.plannedAt === null ? NOT_RECORDED : formatInstantWithDay(line.plannedAt, now)}
                    time="planned"
                    onSelect={() =>
                      setSheet({
                        title: line.person,
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
                    name={line.person}
                    meta={
                      <span
                        className={styles.phoneMetaWrap}
                      >{`${line.form || NOT_RECORDED} · ${line.legalStatus}`}</span>
                    }
                    value={line.madeAt === null ? NOT_RECORDED : formatInstantWithDay(line.madeAt, now)}
                    time="made"
                    onSelect={() =>
                      setSheet({
                        title: line.person,
                        facts: [
                          { id: "form", label: "Form", value: line.form || NOT_RECORDED },
                          { id: "made", label: "Made", value: at(line.madeAt) },
                          { id: "received", label: "Received", value: at(line.receivedAt) },
                          {
                            id: "expiry",
                            label: "Typed expiry",
                            value: line.formEnded ? FORM_RECORDED_ENDED : at(line.typedExpiryAt),
                          },
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
            <p className={styles.printMeta}>{takenLine}</p>
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
      {/* Paper (8 Nov 2026): landscape A4 so each patient row prints on one line. Mounted with the
          pack, as the handover sheet sets its own page; the row styles are in ward-flow-print.css. */}
      <style>{DOWNTIME_PAGE_CSS}</style>
      <main id="main-content" className={styles.main}>
        {pageTop}
        {/* One table on screen at a time, chosen here; Print or save PDF still holds all four. */}
        <FolderTabs label="Downtime pack tables" value={section} testId="ward-downtime-tabs">
          <Tabs<Section>
            label="Downtime pack section"
            idPrefix="downtime"
            value={section}
            onChange={setSection}
            className={folderTabClasses.switch}
            items={tabItems.map((item) => ({ id: item.id, label: item.label, count: item.count }))}
          />
        </FolderTabs>

        {/* F-08: the printout says it holds invented records before its first table. */}
        <p className={cx(styles.printOnly, styles.printMeta)} data-testid="ward-downtime-print-provenance">
          Downtime pack · {provenance}. All row times are AWST.
        </p>
        <p className={cx(styles.printOnly, styles.printMeta)}>{takenLine}</p>
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

const DOWNTIME_PAGE_CSS = "@media print { @page { size: A4 landscape; margin: 9mm 10mm; } }";
