"use client";
// Source: src/components/ward-management/statistics/statistics-summary-phone.tsx

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, Building2, ChevronRight, Layers, Siren } from "lucide-react";

import {
  GroupHead,
  IconTile,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StatusGlyph,
  cx,
  durMinutes,
} from "@/components/wf";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { useStatisticsCounts } from "@/components/ward-management/shell/ward-access";
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";

import { StatisticsNav } from "@/components/ward-management/statistics/statistics-nav";
import { PhoneDotKey } from "@/components/ward-management/statistics/statistics-phone-parts";
import { STATISTICS_SERVICES_HREF } from "@/components/ward-management/statistics/statistics-sections";
import styles from "@/components/ward-management/statistics/statistics-phone.module.css";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import redesign from "@/components/ward-redesign/statistics/statistics-redesign.module.css";
import {
  useExecutiveStatistics,
  useExecutiveStatisticsControl,
} from "@/components/ward-management/statistics/executive-statistics-context";
import {
  ExecutiveStatisticsUnavailable,
  statisticsCountText,
  exactStatisticsCount,
  type StatisticsCount,
} from "@/components/ward-management/statistics/statistics-small-numbers";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";

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
type PhoneMoreFigures = {
  blocked: { total: StatisticsCount; admissions: StatisticsCount; tallies: readonly PhoneTally[] };
  /** `statement` when the declines cannot be read, in the desktop card's own words. */
  declines: { total: StatisticsCount; tallies: readonly PhoneTally[] } | { statement: string };
  arrivals: { measured: StatisticsCount; average: number | null; shortest: number | null; longest: number | null };
};

type Sheet = { title: string; description?: string; body: ReactNode } | null;

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
      {percent}% in use · {where}
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
        aside={`${small(blocked.total)} of ${small(blocked.admissions)} not departed`}
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
type PhoneSummaryProps = Omit<Parameters<typeof StatisticsSummaryPhoneView>[0], "now"> & { now?: number };

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
  return <StatisticsSummaryPhoneView {...props} now={props.now ?? now} />;
}

function StatisticsSummaryPhoneView({
  ready,
  beingMadeReady,
  occupied,
  occupiedPct,
  waitingInEd,
  endedToday,
  wards,
  eds,
  referrals,
  moreFigures,
  wardCount,
  paused,
  onTogglePause,
  now,
}: {
  ready: number;
  beingMadeReady: number;
  /** Beds in use: Occupied + Pulled, the one occupancy count (`ward-occupancy.ts`). */
  occupied: number;
  occupiedPct: number;
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
}) {
  const [group, setGroup] = useState<"hospital" | "ward">("hospital");
  const [sheet, setSheet] = useState<Sheet>(null);
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
  const byReady = [...wards].sort((a, b) => b.ready - a.ready || b.percent - a.percent || a.name.localeCompare(b.name));
  const overCount = wards.filter((ward) => overLine(ward.percent)).length;
  const edsWaiting = eds.filter((ed) => exactStatisticsCount(ed.waiting) !== 0);
  const edPresenceKnown = eds.every((ed) => exactStatisticsCount(ed.waiting) !== null);
  const longestEd = eds.reduce<number | null>(
    (most, ed) => (ed.longest !== null && (most === null || ed.longest > most) ? ed.longest : most),
    null,
  );
  const listLength = group === "hospital" ? hospitals.length : wards.length;

  const wardRow = (ward: PhoneWard) => (
    <PhoneListRow
      key={ward.id}
      as="li"
      name={ward.name}
      meta={<InUse percent={ward.percent} where={ward.hospital} />}
      // Redesign: the count and its noun on one line, not "4" over "ready".
      value={
        <>
          {ward.ready} <small className={redesign.rowUnit}>ready</small>
        </>
      }
      href={wardStatisticsHref(ward.id)}
    />
  );

  return (
    <div className={styles.page} data-testid="ward-statistics-screen" data-ward-design="v10">
      <main id="main-content" className={styles.main}>
        <PhoneHero
          level={1}
          title={`${ready} ${ready === 1 ? "bed" : "beds"} ready now`}
          sub={`Prototype, invented records${beingMadeReady > 0 ? ` · ${beingMadeReady} being made ready` : ""}`}
          figures={[
            // Phone review F-26: the big figure says what it counts, with its share beside it.
            { id: "occupied", value: occupied, label: `Beds in use, ${occupiedPct.toFixed(1)}%` },
            { id: "ed", value: statisticsCountText(waitingInEd), label: "Open ED journeys" },
            // Redesign: the figure names its noun, as the desktop's "Admissions ended today" does.
            { id: "ended", value: statisticsCountText(endedToday), label: "Stays ended today" },
          ]}
          eyebrow="Statistics · Network now"
          chip={
            <LiveChip
              state={paused ? "paused" : "live"}
              onHero
              age={formatInstant(now)}
              onTogglePause={onTogglePause}
            />
          }
        />

        <StatisticsNav currentSection="hub" withSamples={false} wardCount={wardCount} variant="chips" />

        {/* v10: the switch stays pinned under the bar while its list scrolls, and lets go after it. */}
        <div className={styles.segGroup}>
          <Segmented<"hospital" | "ward">
            className={cx(styles.seg, styles.segPinned)}
            size="md"
            label="List beds by"
            value={group}
            onChange={setGroup}
            // Redesign: no counts, so the switch no longer looks like the Wards 22 chip above it.
            items={[
              { id: "hospital", label: "By hospital" },
              { id: "ward", label: "By ward" },
            ]}
          />

          <ul
            className={styles.list}
            aria-label={group === "hospital" ? "Hospitals by beds ready" : "Wards by beds ready"}
          >
            {group === "hospital"
              ? hospitals.slice(0, showAll ? undefined : LIST_SHOWN).map((hospital) => (
                  <PhoneListRow
                    key={hospital.name}
                    as="li"
                    name={hospital.name}
                    meta={<InUse percent={hospital.percent} where={shortService(hospital.service)} />}
                    value={
                      <>
                        {hospital.ready} <small className={redesign.rowUnit}>ready</small>
                      </>
                    }
                    onSelect={() =>
                      setSheet({
                        title: hospital.name,
                        body: <ul className={styles.list}>{hospital.wards.map(wardRow)}</ul>,
                      })
                    }
                  />
                ))
              : byReady.slice(0, showAll ? undefined : LIST_SHOWN).map(wardRow)}
            {listLength > LIST_SHOWN ? (
              <li className={redesign.showMoreItem}>
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
          {/* Redesign: the Raised tile carries the total, so the heading does not repeat it. */}
          <GroupHead title="Referrals today" variant="letter" className={styles.groupHead} />
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
        </section>

        <nav className={styles.navRows} aria-label="More figures">
          {/* Audit stats-18 sent this row to Overview's fullest-first ward list. Overview folded into
              this page (D-77, change 9), so the row opens that list here: every ward at or over the
              line, fullest first. */}
          <button
            type="button"
            className={styles.navRow}
            data-testid="ward-statistics-pressure-link"
            onClick={() =>
              setSheet({
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
              })
            }
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
          <button
            type="button"
            className={styles.navRow}
            onClick={() =>
              setSheet({
                title: "Open ED journeys",
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
                              ? "No open ED journeys"
                              : "Longest not recorded"
                            : `Longest ${durMinutes(ed.longest)}`
                        }
                        value={statisticsCountText(ed.waiting)}
                        time="open ED journeys"
                        href={ed.openable === false ? undefined : edStatisticsHref(ed.id)}
                      />
                    ))}
                  </ul>
                ),
              })
            }
          >
            {/* Redesign: the menu's ED icon; a clock is for time only. */}
            <IconTile icon={Siren} />
            <span className={styles.navText}>
              <b>Open ED journeys</b>
              <span>
                {!edPresenceKnown ? (
                  <>{statisticsCountText(waitingInEd)} open ED journeys · department totals protected</>
                ) : longestEd === null ? (
                  `${edsWaiting.length} of ${eds.length} departments with open ED journeys`
                ) : (
                  <>
                    Longest <b className={styles.num}>{durMinutes(longestEd)}</b> · {statisticsCountText(waitingInEd)}{" "}
                    open journeys from {edsWaiting.length} of {eds.length}
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
            onClick={() => setSheet({ title: "More figures", body: <MoreFigures figures={moreFigures} /> })}
          >
            <IconTile icon={Layers} />
            <span className={styles.navText}>
              <b>More figures</b>
              <span>Discharges held up, declines, pull to arrival</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </button>
          {/* Each health service's figures, also the Services chip above (phone review F-12). */}
          <Link className={styles.navRow} href={STATISTICS_SERVICES_HREF}>
            <IconTile icon={Building2} />
            <span className={styles.navText}>
              <b>Services</b>
              <span>Beds, referrals and waits for each health service</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </Link>
        </nav>
      </main>
      <PhoneSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.title ?? ""}
        description={sheet?.description}
      >
        <div className={styles.sheetBody}>{sheet?.body}</div>
      </PhoneSheet>
    </div>
  );
}
