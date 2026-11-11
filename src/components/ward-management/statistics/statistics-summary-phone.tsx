"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, Building2, ChevronRight, Clock, Download, Layers, Search, Siren } from "lucide-react";

import {
  GroupHead,
  Hero,
  HeroAct,
  HeroBand,
  HeroFigures,
  HeroQuickChips,
  HeroTop,
  IconTile,
  LiveChip,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StatusGlyph,
  cx,
  durMinutes,
  folderTabClasses,
  ShowMoreRow,
  SrOnly,
} from "@/components/wf";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useCanOpenHref, useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";

import { StatisticsNav } from "./statistics-nav";
import { downloadStatisticsFigures } from "./statistics-hero";
import type { StatisticsExport } from "./statistics-csv";
import type { NetworkServiceRow } from "./statistics-network-cards";
import { setStatisticsSamples, useStatisticsSamples } from "./statistics-samples";
import { PhoneDotKey } from "./statistics-phone-parts";
import { STATISTICS_SERVICES_HREF } from "./statistics-sections";
import styles from "./statistics-phone.module.css";
import topTitle from "../shell/page-top-title.module.css";
import { SmallNumberNote } from "./statistics-count-list";
import note from "./statistics-count-list.module.css";
import { ShortLabel } from "./redesign/statistics-redesign-parts";
import { useExecutiveStatistics, useExecutiveStatisticsControl } from "./executive-statistics-context";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
} from "./statistics-small-numbers";
import { useEffectiveWardAccess } from "../shell/ward-access-store";
import { occupancyShare } from "./statistics-occupancy";

/** One ward on the phone Summary, from the same figures the desktop pressure table reads. */
type PhoneWard = {
  id: string;
  name: string;
  hospital: string;
  service: string;
  beds: number;
  ready: number;
  /** Rounded occupancy percent. */
  percent: number;
};

type PhoneEd = {
  id: string;
  name: string;
  site: string;
  waiting: StatisticsCount;
  longest: number | null;
  openable?: boolean;
};

type PhoneTally = { id: string; label: string; count: StatisticsCount };

/** The desktop page's blocked discharges, declines and pull to arrival, for the More figures sheet. */
export type PhoneMoreFigures = {
  blocked: { total: StatisticsCount; admissions: StatisticsCount; tallies: readonly PhoneTally[] };
  /** `statement` when the declines cannot be read, in the desktop card's own words. */
  declines: { total: StatisticsCount; tallies: readonly PhoneTally[] } | { statement: string };
  arrivals: { measured: StatisticsCount; average: number | null; shortest: number | null; longest: number | null };
};

type Sheet = { kind: "hospital"; name: string } | { kind: "pressure" | "eds" | "more-figures" } | null;

/** The phone list shows this many hospitals or wards before "Show all". */
const LIST_SHOWN = 8;

const shortService = (service: string) => service.replace(/ Metro$/u, "").replace(/^Country \((.+)\)$/u, "$1");

function overLine(percent: number): boolean {
  return percent >= BED_ALERT_THRESHOLD_PERCENT;
}

function InUse({ percent, where }: { percent: number; where: string }) {
  return (
    <span className={styles.inUse}>
      {overLine(percent) ? <StatusGlyph tone="warning" size={9} /> : null}
      {percent}% in use{where ? ` · ${where}` : ""}
    </span>
  );
}

const countText = (count: number | string) => (count === 0 ? "none" : count);

function TallyList({ label, tallies }: { label: string; tallies: readonly PhoneTally[] }) {
  // Executive: the parts add up to the total above them, so they hide together, as on the desktop.
  const { small, parts } = useStatisticsCounts();
  const numeric = tallies.every((tally) => typeof tally.count === "number");
  const shown = numeric
    ? parts(tallies.map((tally) => tally.count as number))
    : tallies.map((tally) => statisticsCountText(tally.count, small));
  return (
    <ul className={styles.list} aria-label={label}>
      {tallies.map((tally, index) => (
        <PhoneListRow
          key={tally.id}
          as="li"
          name={tally.label}
          value={countText(shown[index] ?? statisticsCountText(tally.count, small))}
        />
      ))}
    </ul>
  );
}

/** The More figures sheet: blocked discharges, declines by reason and pull to arrival. */
function MoreFigures({ figures }: { figures: PhoneMoreFigures }) {
  const { blocked, declines, arrivals } = figures;
  const { small: operationalSmall } = useStatisticsCounts();
  const small = (count: StatisticsCount) => statisticsCountText(count, operationalSmall);
  const duration = (minutes: number | null) => (minutes === null ? "Not recorded" : durMinutes(minutes));
  return (
    <>
      <GroupHead
        title="Discharges held up"
        variant="letter"
        aside={`${small(blocked.total)} of ${small(blocked.admissions)} not yet discharged`}
      />
      <TallyList label="Discharges held up, by reason" tallies={blocked.tallies} />
      {"statement" in declines ? (
        <>
          <GroupHead title="Declines by reason" variant="letter" />
          <p className={styles.note}>{declines.statement}</p>
        </>
      ) : (
        <>
          <GroupHead
            title="Declines by reason"
            variant="letter"
            aside={`${small(declines.total)} ${small(declines.total) === 1 ? "decline" : "declines"}`}
          />
          <TallyList label="Declines by reason" tallies={declines.tallies} />
        </>
      )}
      <GroupHead title="Pull to arrival" variant="letter" aside={`${small(arrivals.measured)} admissions`} />
      <ul className={styles.list} aria-label="Pull to arrival">
        <PhoneListRow as="li" name="Average" value={duration(arrivals.average)} />
        <PhoneListRow as="li" name="Shortest" value={duration(arrivals.shortest)} />
        <PhoneListRow as="li" name="Longest" value={duration(arrivals.longest)} />
      </ul>
    </>
  );
}

/**
 * Statistics Summary on a phone (v10 phone design, 390 wide): a compact hero with three figures,
 * the section chooser, the hospitals or wards as a priority list, then the pressure, ED and
 * referral figures as rows that open bottom sheets. Every figure is passed in from the desktop
 * screen's own derivations, so the two never disagree.
 */
type PhoneSummaryProps = Omit<Parameters<typeof StatisticsSummaryPhoneView>[0], "now" | "dayZero"> & {
  now?: number;
};

export function StatisticsSummaryPhone(props: PhoneSummaryProps) {
  const control = useExecutiveStatisticsControl();
  const data = useExecutiveStatistics();
  const access = useEffectiveWardAccess();
  if (control.executive || access.role === "executive")
    return data ? (
      <StatisticsSummaryPhoneView
        key={JSON.stringify(data.network.scope)}
        {...props}
        eds={props.eds.map((ed) => ({ ...ed, openable: data.openableEmergencyDepartmentIds.includes(ed.id) }))}
        now={data.network.asAt.now}
        dayZero={new Date(data.network.asAt.dayZero)}
        paused={control.paused}
        onTogglePause={control.togglePause ?? undefined}
      />
    ) : (
      <ExecutiveStatisticsUnavailable />
    );
  return <OperationalSummaryPhone {...props} />;
}

function OperationalSummaryPhone(props: PhoneSummaryProps) {
  const now = useWardFlowClock();
  const { dayZero } = useWardFlowSelect("dayZero");
  return <StatisticsSummaryPhoneView {...props} now={props.now ?? now} dayZero={dayZero} />;
}

/** "North Metro" reads "North", "Country (WACHS)" reads "WACHS" in the page-top band. */
const bandName = (name: string) => name.replace(/ Metro$/u, "").replace(/^Country \((.+)\)$/u, "$1");

function StatisticsSummaryPhoneView({
  ready,
  occupied,
  occupiedPct,
  waitingInEd,
  wards,
  eds,
  referrals,
  moreFigures,
  wardCount,
  paused,
  onTogglePause,
  now,
  dayZero,
  eyebrow = "Statistics · Network now",
  totalBeds,
  services,
  onOpenUnit,
  unitFinderOpen = false,
  exportFigures,
}: {
  ready: number;
  beingMadeReady: number;
  /** Beds in use: Occupied + Pulled, the one occupancy count (`ward-occupancy.ts`). */
  occupied: number;
  occupiedPct: number | null;
  waitingInEd: StatisticsCount;
  endedToday: StatisticsCount;
  wards: readonly PhoneWard[];
  eds: readonly PhoneEd[];
  referrals: { raised: StatisticsCount; accepted: StatisticsCount; declined: StatisticsCount; open: StatisticsCount };
  moreFigures: PhoneMoreFigures;
  wardCount: number;
  paused: boolean;
  onTogglePause?: () => void;
  now: number;
  /** Role view (site bed manager): its site's name in place of "Network now". */
  eyebrow?: string;
  /** Role view (executive): every bed, shown when the people counts are held back. */
  totalBeds?: number;
  dayZero: Date;
  /** Each health service's beds, for the page-top band. Left out, the band is not drawn. */
  services?: readonly NetworkServiceRow[];
  /** Opens the one unit finder. Left out (bed manager), the chip is not offered. */
  onOpenUnit?: () => void;
  unitFinderOpen?: boolean;
  /** The figures the Export chip downloads, as the desktop's. */
  exportFigures?: StatisticsExport;
}) {
  const access = useEffectiveWardAccess();
  // Role view (site bed manager, D-80): one hospital, which the hero names, so its wards are listed
  // straight away with no Hospitals and Wards switch.
  const siteDesk = access.role === "bed_manager";
  // Rows link only where this desk may open the page (access audit, 31 Oct 2026).
  const canOpen = useCanOpenHref();
  // Role view (executive): a withheld count reads "not shown", which says nothing at a glance, so the
  // hero leaves it out and one sentence under the hero explains the small number rule instead.
  const executive = access.role === "executive";
  const held = (count: StatisticsCount) => executive && typeof count !== "number" && count.kind === "withheld";
  const referralsHeld = [referrals.raised, referrals.accepted, referrals.declined, referrals.open].every(held);
  const [chosenGroup, setGroup] = useState<"hospital" | "ward">("hospital");
  const group = siteDesk ? "ward" : chosenGroup;
  // Keyed by desk, not by board state: the executive view renders from the released report alone.
  const owner = `${access.role}:${JSON.stringify(access.scope)}`;
  const [selection, setSelection] = useState<(Exclude<Sheet, null> & { owner: string }) | null>(null);
  const sheet = selection?.owner === owner ? selection : null;
  const setSheet = (next: Sheet) => setSelection(next ? { ...next, owner } : null);
  const [showAll, setShowAll] = useState(false);

  const hospitals = [...new Set(wards.map((ward) => ward.hospital))]
    .map((name) => {
      const list = wards.filter((ward) => ward.hospital === name);
      const beds = list.reduce((sum, ward) => sum + ward.beds, 0);
      const weighted = list.reduce((sum, ward) => sum + ward.percent * ward.beds, 0);
      return {
        name,
        service: list[0]?.service ?? "Service not recorded",
        ready: list.reduce((sum, ward) => sum + ward.ready, 0),
        percent: beds > 0 ? Math.round(weighted / beds) : 0,
        wards: list,
      };
    })
    .sort((a, b) => b.ready - a.ready || b.percent - a.percent || a.name.localeCompare(b.name));
  // By ward: A to Z by ward name, every count kept (D-139, following D-126). Most ready first read as "send them here".
  const byName = [...wards].sort((a, b) => a.name.localeCompare(b.name));
  const overCount = wards.filter((ward) => overLine(ward.percent)).length;
  const edsWaiting = eds.filter((ed) => exactStatisticsCount(ed.waiting) !== 0);
  const edPresenceKnown = eds.every((ed) => exactStatisticsCount(ed.waiting) !== null);
  const longestEd = eds.reduce<number | null>(
    (most, ed) => (ed.longest !== null && (most === null || ed.longest > most) ? ed.longest : most),
    null,
  );
  const listLength = group === "hospital" ? hospitals.length : wards.length;
  const samples = useStatisticsSamples();
  const closedBeds = services?.reduce((sum, entry) => sum + entry.closed, 0) ?? 0;

  const wardRow = (ward: PhoneWard) => (
    <PhoneListRow
      key={ward.id}
      as="li"
      name={ward.name}
      meta={<InUse percent={ward.percent} where={siteDesk ? "" : ward.hospital} />}
      // The count and its noun on one line, not "4" over "ready".
      value={
        <>
          {ward.ready} <small className={styles.rowUnit}>ready</small>
        </>
      }
      href={canOpen(wardStatisticsHref(ward.id)) ? wardStatisticsHref(ward.id) : undefined}
    />
  );

  const hospital = sheet?.kind === "hospital" ? hospitals.find((each) => each.name === sheet.name) : null;
  if (
    selection &&
    (selection.owner !== owner ||
      (selection.kind === "hospital" && !wards.some((ward) => ward.hospital === selection.name)))
  )
    setSelection(null);
  let currentSheet: { title: string; description?: string; body: ReactNode } | null = null;
  if (sheet?.kind === "hospital" && hospital)
    currentSheet = { title: hospital.name, body: <ul className={styles.list}>{hospital.wards.map(wardRow)}</ul> };
  if (sheet?.kind === "pressure")
    currentSheet = {
      title: "Where the pressure is",
      description: `Wards at or over ${BED_ALERT_THRESHOLD_PERCENT}% of beds in use, fullest first.`,
      body:
        overCount === 0 ? (
          <p className={styles.note}>{`No ward is at or over ${BED_ALERT_THRESHOLD_PERCENT}%.`}</p>
        ) : (
          <ul className={styles.list}>
            {[...wards]
              .filter((ward) => overLine(ward.percent))
              .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name))
              .map(wardRow)}
          </ul>
        ),
    };
  if (sheet?.kind === "eds")
    currentSheet = {
      title: "Open ED movements",
      body: (
        <ul className={styles.list}>
          {eds.map((ed) => (
            <PhoneListRow
              key={ed.id}
              as="li"
              name={ed.name}
              meta={
                ed.longest === null
                  ? exactStatisticsCount(ed.waiting) === 0
                    ? "No open ED movements"
                    : "Longest not recorded"
                  : `Longest ${durMinutes(ed.longest)}`
              }
              value={statisticsCountText(ed.waiting)}
              time="open ED movements"
              href={ed.openable === false || !canOpen(edStatisticsHref(ed.id)) ? undefined : edStatisticsHref(ed.id)}
            />
          ))}
        </ul>
      ),
    };
  if (sheet?.kind === "more-figures")
    currentSheet = { title: "More figures", body: <MoreFigures figures={moreFigures} /> };

  return (
    <div className={styles.page} data-testid="ward-statistics-screen" data-ward-design="v10">
      <main id="main-content" className={styles.main}>
        {/* The page top (Josh, 9 Nov 2026): the place, three figures, the wards at or over the line,
            the tools and each service's share in use. The sections follow as folder tabs. */}
        <Hero
          level={1}
          className={cx(topTitle.hero, folderTabClasses.hero)}
          title={
            <>
              <SrOnly>{eyebrow} · </SrOnly>
              {siteDesk ? eyebrow.replace(/^Statistics · /u, "") : "Whole network"}
              <span className={topTitle.soft}> right now</span>
            </>
          }
          aside={
            <LiveChip
              state={paused ? "paused" : "live"}
              onHero
              age={formatInstant(now)}
              onTogglePause={onTogglePause}
            />
          }
        >
          <HeroTop
            figures={
              <HeroFigures
                label="Network at a glance"
                items={[
                  // Phone review F-26: the figure says what it counts, with its share beside it.
                  {
                    id: "occupied",
                    value: occupied,
                    unit: totalBeds === undefined ? undefined : <> / {totalBeds}</>,
                    label: `in use, ${occupancyShare(occupiedPct)}`,
                  },
                  { id: "ready", value: ready, label: ready === 1 ? "bed ready" : "beds ready" },
                  ...(held(waitingInEd)
                    ? []
                    : [
                        {
                          id: "ed",
                          value: statisticsCountText(waitingInEd),
                          label: <ShortLabel short="open movements" full="open ED movements" />,
                        },
                      ]),
                ]}
              />
            }
            act={
              siteDesk ? undefined : (
                <HeroAct
                  tone="calm"
                  testId="ward-statistics-pressure-act"
                  title={
                    overCount === 0
                      ? `No ward at or over ${BED_ALERT_THRESHOLD_PERCENT}%`
                      : `${overCount} ${overCount === 1 ? "ward" : "wards"} at or over ${BED_ALERT_THRESHOLD_PERCENT}%`
                  }
                  action={
                    overCount === 0
                      ? undefined
                      : { label: "Show wards", phoneLabel: "Show", onClick: () => setSheet({ kind: "pressure" }) }
                  }
                />
              )
            }
            chips={
              <HeroQuickChips
                label="Statistics tools"
                items={[
                  ...(onOpenUnit
                    ? [
                        {
                          id: "unit",
                          label: "Open a unit",
                          icon: <Search size={16} strokeWidth={1.75} aria-hidden="true" />,
                          onClick: onOpenUnit,
                          expanded: unitFinderOpen,
                          testId: "ward-statistics-tool-open-unit",
                        },
                      ]
                    : []),
                  ...(exportFigures
                    ? [
                        {
                          id: "export",
                          label: "Export",
                          icon: <Download size={16} strokeWidth={1.75} aria-hidden="true" />,
                          onClick: () => downloadStatisticsFigures(exportFigures, now, dayZero),
                          testId: "ward-statistics-export",
                        },
                      ]
                    : []),
                  {
                    id: "history",
                    label: "Example history",
                    icon: <Clock size={16} strokeWidth={1.75} aria-hidden="true" />,
                    onClick: () => setStatisticsSamples(!samples),
                    pressed: samples,
                    testId: "ward-statistics-example-history",
                  },
                ]}
              />
            }
            band={
              services && services.length > 0 ? (
                <HeroBand
                  title="In use by health service"
                  aside={
                    <>
                      <b>{closedBeds}</b> closed
                    </>
                  }
                  asideHref={canOpen(STATISTICS_SERVICES_HREF) ? STATISTICS_SERVICES_HREF : undefined}
                  cells={services.map((entry) => ({
                    id: entry.id,
                    label: bandName(entry.name),
                    value: `${Math.round(entry.share * 100)}%`,
                  }))}
                  testId="ward-statistics-service-band"
                />
              ) : undefined
            }
          />
        </Hero>

        <StatisticsNav currentSection="hub" withSamples={false} wardCount={wardCount} variant="folder" />

        {executive ? <SmallNumberNote className={note.note} /> : null}

        {/* v10: the switch stays pinned under the bar while its list scrolls, and lets go after it. */}
        <div className={styles.segGroup}>
          {siteDesk ? null : (
            <Segmented<"hospital" | "ward">
              className={cx(styles.seg, styles.segPinned)}
              size="md"
              label="List beds by"
              value={group}
              onChange={setGroup}
              // No counts, so the switch does not look like the Wards chip above it.
              items={[
                { id: "hospital", label: "By hospital" },
                { id: "ward", label: "By ward" },
              ]}
            />
          )}

          <ul className={styles.list} aria-label={group === "hospital" ? "Hospitals by beds ready" : "Wards A to Z"}>
            {group === "hospital"
              ? hospitals.slice(0, showAll ? undefined : LIST_SHOWN).map((hospital) => (
                  <PhoneListRow
                    key={hospital.name}
                    as="li"
                    name={hospital.name}
                    meta={<InUse percent={hospital.percent} where={shortService(hospital.service)} />}
                    value={
                      <>
                        {hospital.ready} <small className={styles.rowUnit}>ready</small>
                      </>
                    }
                    onSelect={() => setSheet({ kind: "hospital", name: hospital.name })}
                  />
                ))
              : byName.slice(0, showAll ? undefined : LIST_SHOWN).map(wardRow)}
            {listLength > LIST_SHOWN ? (
              <li className={styles.showMoreItem}>
                <ShowMoreRow expanded={showAll} onClick={() => setShowAll((value) => !value)}>
                  {showAll ? "Show fewer" : `Show all ${listLength}`}
                </ShowMoreRow>
              </li>
            ) : null}
          </ul>
          <PhoneDotKey testId="ward-statistics-summary-dot-key">
            {`Amber dot: ${BED_ALERT_THRESHOLD_PERCENT}% or more of beds in use`}
          </PhoneDotKey>
        </div>

        <section className={styles.group} aria-label="Referrals today">
          {/* The Raised tile carries the total, so the heading does not repeat it. Role view
              (executive): when all four counts are withheld, four "not shown" tiles say nothing the
              heading cannot, so the heading alone says it and the tiles go. */}
          <GroupHead
            title="Referrals today"
            variant="letter"
            aside={referralsHeld ? "not shown" : undefined}
            className={styles.groupHead}
          />
          {referralsHeld ? null : (
            <dl className={styles.tiles}>
              <div className={styles.tile}>
                <dt>
                  <StatusGlyph tone="success" size={9} /> Accepted
                </dt>
                <dd>{statisticsCountText(referrals.accepted)}</dd>
              </div>
              <div className={styles.tile}>
                <dt>
                  <StatusGlyph tone="closed" size={9} /> Declined
                </dt>
                <dd>{statisticsCountText(referrals.declined)}</dd>
              </div>
              <div className={styles.tile}>
                <dt>
                  <StatusGlyph tone="neutral" size={9} /> Still open
                </dt>
                <dd>{statisticsCountText(referrals.open)}</dd>
              </div>
              <div className={styles.tile}>
                <dt>Raised</dt>
                <dd>{statisticsCountText(referrals.raised)}</dd>
              </div>
            </dl>
          )}
        </section>

        <nav className={styles.navRows} aria-label="More figures">
          {/* Audit stats-18 sent this row to Overview's fullest-first ward list. Overview folded into
              this page (D-77, change 9), so the row opens that list here: every ward at or over the
              line, fullest first. */}
          {/* Role view (site bed manager): its few wards are listed above already, fullest marked, so
              no second list. */}
          {siteDesk ? null : (
            <button
              type="button"
              className={styles.navRow}
              data-testid="ward-statistics-pressure-link"
              onClick={() => setSheet({ kind: "pressure" })}
            >
              <IconTile icon={Activity} />
              <span className={styles.navText}>
                <b>Where the pressure is</b>
                <span>
                  <b className={styles.num}>{overCount}</b> {overCount === 1 ? "ward" : "wards"} at or over{" "}
                  {BED_ALERT_THRESHOLD_PERCENT}%, fullest first
                </span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
            </button>
          )}
          <button type="button" className={styles.navRow} onClick={() => setSheet({ kind: "eds" })}>
            {/* The menu's ED icon; a clock is for time only. */}
            <IconTile icon={Siren} />
            <span className={styles.navText}>
              <b>Open ED movements</b>
              <span>
                {!edPresenceKnown ? (
                  // Role view (executive): "not shown open ED movements" read badly and was cut off.
                  held(waitingInEd) ? (
                    "Counts not shown"
                  ) : (
                    <>{statisticsCountText(waitingInEd)} open ED movements · department totals protected</>
                  )
                ) : longestEd === null ? (
                  `${edsWaiting.length} of ${eds.length} departments with open ED movements`
                ) : (
                  <>
                    Longest <b className={styles.num}>{durMinutes(longestEd)}</b> · {statisticsCountText(waitingInEd)}{" "}
                    open movements from {edsWaiting.length} of {eds.length}
                  </>
                )}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </button>
          {/* This row opened Overview. Overview folded into this page (D-77, change 9), so it opens the
              three figures it names, the same counts the desktop page shows (Josh, 21 Oct 2026). */}
          <button
            type="button"
            className={styles.navRow}
            data-testid="ward-statistics-more-figures"
            onClick={() => setSheet({ kind: "more-figures" })}
          >
            <IconTile icon={Layers} />
            <span className={styles.navText}>
              <b>More figures</b>
              <span>Discharges held up, declines, pull to arrival</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </button>
          {/* Each health service's figures, also the Services chip above (phone review F-12). */}
          {!canOpen(STATISTICS_SERVICES_HREF) ? null : (
            <Link className={styles.navRow} href={STATISTICS_SERVICES_HREF}>
              <IconTile icon={Building2} />
              <span className={styles.navText}>
                <b>Services</b>
                <span>Beds, referrals and waits for each health service</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
            </Link>
          )}
        </nav>
      </main>
      <PhoneSheet
        open={currentSheet !== null}
        onClose={() => setSheet(null)}
        title={currentSheet?.title ?? ""}
        description={currentSheet?.description}
        bodyScrollLabel={sheet?.kind === "more-figures" ? "More figures" : undefined}
      >
        <div className={styles.sheetBody}>{currentSheet?.body}</div>
      </PhoneSheet>
    </div>
  );
}
