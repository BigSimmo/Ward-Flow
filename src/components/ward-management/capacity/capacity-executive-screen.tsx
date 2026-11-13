"use client";

/**
 * WF-06 (live test, 4 Nov 2026): the executive's Capacity link always failed. A signed-in executive
 * receives only the aggregate report (`ExecutiveWorkspace`), never the operational board, so the
 * operational Capacity screen had no workspace to read and fell to the error boundary. This view
 * draws Capacity from that report instead: bed counts only, no patient and no action.
 *
 * Wave 4 (C7, notes item 7, D-191): the same slate hero as Capacity ("Beds ready and in use", four
 * count labels, an as-at pill and a By service band in neutral words), then the kit table "Beds by
 * ward" grouped by service with a bed-squares strip per ward and a totals row. No buttons: the
 * desk never sees an action it cannot use (shared spec 6). On a phone the table is a read-only
 * list in the bed-squares phone form, with the later service groups folded.
 */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import {
  Card,
  CardHead,
  Hero,
  HeroBand,
  HeroFigures,
  HeroPill,
  HeroTop,
  LiveChip,
  SrOnly,
  cx,
  tableClasses,
  useIsPhone,
} from "@/components/wf";
import {
  BED_SQUARE_LABELS,
  BedSquare,
  BedSquares,
  BedSquaresStrip,
  bedSquareCounts,
  bedSquaresNotes,
  type BedSquareState,
} from "@/components/ward-management/bed-squares/bed-squares";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import type { ExecutiveReportingFoundation } from "@/components/ward-management/statistics/executive-statistics-contract";
import { occupancyText } from "@/components/ward-management/statistics/statistics-occupancy";
import { ExecutiveStatisticsUnavailable } from "@/components/ward-management/statistics/statistics-small-numbers";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import pageTop from "@/components/ward-management/page-top-title.module.css";

import styles from "./capacity-executive.module.css";

const FOOTER_NOTE = "Synthetic prototype · bed counts only · Not approved for clinical use";

type ExecutiveWard = ExecutiveReportingFoundation["wards"][number];
type ExecutiveService = ExecutiveReportingFoundation["services"][number];

/** The executive's squares say only what the table says: ready, being made ready, in use, closed. */
const EXECUTIVE_KEY: readonly BedSquareState[] = ["ready", "prep", "use", "closed"];

/** Phone: the first two service groups open, the rest folded (notes item 7). */
const PHONE_OPEN_GROUPS = 2;

/** "Label · window": the window in quiet ink (count labels, shared spec 2). PR E swap: WindowWord / the `window` prop. */
function CountLabel({ label, window }: { label: string; window: string }) {
  return (
    <>
      {label}
      <span className={styles.win}> · {window}</span>
    </>
  );
}

/** The neutral cohort and lock tag, from the record ("Adult · Locked"). */
function executiveWardTag(ward: Pick<ExecutiveWard, "cohort" | "lockedBeds" | "beds">): string {
  const lock = ward.lockedBeds <= 0 ? "Open" : ward.lockedBeds >= ward.beds.total ? "Locked" : "Mixed";
  return `${ward.cohort} · ${lock}`;
}

/**
 * The squares from the report's own bed counts. No discharge hatch: the executive report holds no
 * per-ward discharge count it may show (small numbers), so in use is every bed not ready, being
 * made ready or closed.
 */
function wardSquares(ward: ExecutiveWard) {
  return bedSquareCounts({
    beds: ward.beds.total,
    ready: ward.beds.ready,
    prep: ward.beds.beingMadeReady,
    closed: ward.beds.closed,
  });
}

type ServiceGroup = { service: ExecutiveService; wards: ExecutiveWard[] };

/** The coordinator's bed map order (`wardServiceOrder`: North, East, South, WACHS, CAHS, Private). */
const serviceRank = (service: ExecutiveService) => {
  const rank = wardServiceOrder.indexOf(service.service);
  return rank === -1 ? wardServiceOrder.length : rank;
};

function serviceGroups(data: ExecutiveReportingFoundation): ServiceGroup[] {
  return [...data.services]
    .sort((a, b) => serviceRank(a) - serviceRank(b))
    .map((service) => ({ service, wards: data.wards.filter((ward) => ward.service === service.service) }))
    .filter((group) => group.wards.length > 0);
}

function inUseText(beds: { total: number; inUse: number }): string {
  return occupancyText({ beds: beds.total, inUse: beds.inUse });
}

export function ExecutiveCapacityScreen() {
  const data = useExecutiveStatistics();
  const { paused, togglePause } = useExecutiveStatisticsControl();
  const isPhone = useIsPhone();
  // The skip link and the prototype disclosure stay even while the report is absent.
  if (!data)
    return (
      <main id="main-content" data-testid="ward-capacity-executive-unavailable">
        <ExecutiveStatisticsUnavailable />
        <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
      </main>
    );
  const { network } = data;
  // The counts are as at the report's time, which a held report keeps while the board clock moves.
  const asAt = formatInstant(network.asAt.now);
  const beds = network.beds;
  const groups = serviceGroups(data);
  const wardCount = data.wards.length;
  return (
    <div className={styles.screen} data-testid="ward-capacity-executive-screen">
      <main id="main-content" className={styles.main} data-testid="ward-capacity-executive">
        <Hero
          level={1}
          className={pageTop.hero}
          title={
            <>
              <SrOnly>Capacity, </SrOnly>
              Beds <span className={styles.titleSoft}>ready and in use</span>
            </>
          }
          aside={<LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={togglePause ?? undefined} />}
        >
          <HeroTop
            quickBar={false}
            figures={
              // On a phone the four figures share the row and their labels wrap (local style, `.execFigs`).
              <div className={styles.execFigs}>
                <HeroFigures
                  label="Network beds"
                  testId="ward-capacity-executive-figures"
                  items={[
                    {
                      id: "ready",
                      value: beds.ready,
                      unit: `/ ${beds.total}`,
                      label: <CountLabel label="Ready" window="now" />,
                      testId: "ward-capacity-executive-ready",
                    },
                    {
                      id: "prep",
                      value: beds.beingMadeReady,
                      label: <CountLabel label="Being made ready" window="now" />,
                      testId: "ward-capacity-executive-prep",
                    },
                    {
                      id: "in-use",
                      value: inUseText(beds),
                      label: <CountLabel label="In use" window="now" />,
                      testId: "ward-capacity-executive-in-use",
                    },
                    {
                      id: "closed",
                      value: beds.closed,
                      label: <CountLabel label="Closed" window="now" />,
                      testId: "ward-capacity-executive-closed",
                    },
                  ]}
                />
              </div>
            }
            pill={
              <HeroPill
                testId="ward-capacity-executive-as-at"
                text={`As at ${asAt} · bed counts only, no patient details${paused ? " · report paused" : ""}`}
              />
            }
            band={
              groups.length > 0 ? (
                // On a phone By service sits two across rather than scrolling sideways (local style,
                // `.execBand`).
                <div className={styles.execBand}>
                  <HeroBand
                    variant="wrap"
                    title={
                      <>
                        By service<span className={styles.win}> · now</span>
                      </>
                    }
                    testId="ward-capacity-executive-services"
                    cells={groups.map(({ service }) => ({
                      id: service.service,
                      label: service.service,
                      value: (
                        <>
                          {service.beds.ready} <span className={styles.bandWord}>ready</span>
                        </>
                      ),
                      note: `${inUseText(service.beds)} in use · ${service.beds.closed} closed`,
                      testId: `ward-capacity-executive-service-${service.service}`,
                    }))}
                  />
                </div>
              ) : undefined
            }
          />
        </Hero>
        <Card aria-labelledby="ward-capacity-executive-beds" className={styles.card}>
          <CardHead
            id="ward-capacity-executive-beds"
            title="Beds by ward"
            meta={`${wardCount} ${wardCount === 1 ? "ward" : "wards"} · counts as at ${asAt}`}
          />
          <ExecutiveKey />
          {isPhone ? (
            <ExecutivePhoneList groups={groups} />
          ) : (
            <ExecutiveTable groups={groups} total={beds} wardCount={wardCount} />
          )}
        </Card>
        <WardPrototypeFooter testId="ward-capacity-executive-footer" note={FOOTER_NOTE} />
      </main>
    </div>
  );
}

/** The key for the four states the executive squares draw. PR E swap: kit bed-squares key. */
function ExecutiveKey() {
  return (
    <p className={styles.key} aria-label="Bed squares key" data-testid="ward-capacity-executive-key">
      {EXECUTIVE_KEY.map((state) => (
        <span key={state} className={styles.keyItem}>
          <BedSquare state={state} />
          {BED_SQUARE_LABELS[state]}
        </span>
      ))}
    </p>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <td className={cx(tableClasses.num, styles.num)}>{children}</td>;
}

function ExecutiveTable({
  groups,
  total,
  wardCount,
}: {
  groups: ServiceGroup[];
  total: ExecutiveReportingFoundation["network"]["beds"];
  wardCount: number;
}) {
  return (
    // The table may be wider than a tablet's column: it scrolls sideways and is reachable by keyboard.
    <div className={styles.tableWrap} role="region" aria-label="Beds by ward, scrolls sideways" tabIndex={0}>
      <table className={cx(tableClasses.table, styles.table)} aria-labelledby="ward-capacity-executive-beds">
        <thead>
          <tr>
            <th scope="col">Ward</th>
            <th scope="col" className={styles.squaresCell}>
              <SrOnly>Bed picture</SrOnly>
            </th>
            <th scope="col" className={tableClasses.num}>
              Ready
            </th>
            <th scope="col" className={tableClasses.num}>
              Being made ready
            </th>
            <th scope="col" className={tableClasses.num}>
              In use
            </th>
            <th scope="col" className={tableClasses.num}>
              Closed
            </th>
            <th scope="col" className={tableClasses.num}>
              Beds
            </th>
          </tr>
        </thead>
        {groups.map(({ service, wards }) => (
          <tbody key={service.service} data-testid={`ward-capacity-executive-group-${service.service}`}>
            <tr className={styles.groupRow}>
              <th scope="rowgroup" colSpan={7}>
                {service.service}{" "}
                <span className={styles.ink3}>
                  · {wards.length} {wards.length === 1 ? "ward" : "wards"} · {inUseText(service.beds)} in use
                </span>
              </th>
            </tr>
            {wards.map((ward) => (
              <tr key={ward.id}>
                <th scope="row">
                  <span className={styles.wardName}>{ward.name}</span>
                  <span className={styles.wardTag}>{executiveWardTag(ward)}</span>
                </th>
                <td className={styles.squaresCell}>
                  <BedSquaresStrip counts={wardSquares(ward)} />
                </td>
                <Num>{ward.beds.ready}</Num>
                <Num>{ward.beds.beingMadeReady}</Num>
                <Num>{ward.beds.inUse}</Num>
                <Num>{ward.beds.closed}</Num>
                <Num>{ward.beds.total}</Num>
              </tr>
            ))}
          </tbody>
        ))}
        <tfoot>
          <tr className={styles.totalRow} data-testid="ward-capacity-executive-total">
            <th scope="row">
              All {wardCount} {wardCount === 1 ? "ward" : "wards"}
            </th>
            <td />
            <Num>{total.ready}</Num>
            <Num>{total.beingMadeReady}</Num>
            <Num>{total.inUse}</Num>
            <Num>{total.closed}</Num>
            <Num>{total.total}</Num>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Phone: a read-only list in the bed-squares phone form, later service groups folded. */
function ExecutivePhoneList({ groups }: { groups: ServiceGroup[] }) {
  const [open, setOpen] = useState<ReadonlySet<string>>(
    () => new Set(groups.slice(0, PHONE_OPEN_GROUPS).map((group) => group.service.service)),
  );
  const toggle = (service: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(service)) next.delete(service);
      else next.add(service);
      return next;
    });
  return (
    <div data-testid="ward-capacity-executive-list">
      {groups.map(({ service, wards }) => {
        const expanded = open.has(service.service);
        const listId = `ward-capacity-executive-list-${service.service.replace(/\W+/gu, "-")}`;
        const Chevron = expanded ? ChevronDown : ChevronRight;
        return (
          <section key={service.service} className={styles.group} aria-label={`${service.service} beds`}>
            <h3 className={styles.groupHead}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={expanded ? listId : undefined}
                onClick={() => toggle(service.service)}
              >
                <Chevron size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className={styles.groupName}>{service.service}</span>
                <span className={styles.ink3}>
                  {wards.length} {wards.length === 1 ? "ward" : "wards"}
                </span>
                <span className={styles.groupFigs}>
                  <b>{service.beds.ready}</b> ready · {inUseText(service.beds)} in use
                </span>
              </button>
            </h3>
            {expanded ? (
              <ul className={styles.wards} id={listId}>
                {wards.map((ward) => (
                  <li key={ward.id} className={styles.ward}>
                    <span className={styles.wardName}>{ward.name}</span>
                    <BedSquares
                      counts={wardSquares(ward)}
                      tag={executiveWardTag(ward)}
                      // Counts only (notes item 7): no admit windows, staff requests or review dates.
                      notes={bedSquaresNotes({
                        pulled: ward.beds.pulled,
                        prep: ward.beds.beingMadeReady,
                        closed: ward.beds.closed,
                        onLeave: ward.beds.onLeave,
                      })}
                      testId={`ward-capacity-executive-ward-${ward.id}`}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
