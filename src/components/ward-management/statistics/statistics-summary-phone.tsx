"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Activity, Building2, ChevronRight, Clock, Layers } from "lucide-react";

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
import { formatInstant } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";

import { StatisticsNav } from "./statistics-nav";
import { PhoneDotKey } from "./statistics-phone-parts";
import { STATISTICS_OVERVIEW_HREF, STATISTICS_SERVICES_HREF } from "./statistics-sections";
import styles from "./statistics-phone.module.css";

/** One ward on the phone Summary, from the same figures the desktop pressure table reads. */
export type PhoneWard = {
  id: string;
  name: string;
  hospital: string;
  service: string;
  beds: number;
  ready: number;
  /** Rounded occupancy percent. */
  percent: number;
};

export type PhoneEd = { id: string; name: string; site: string; waiting: number; longest: number | null };

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

/**
 * Statistics Summary on a phone (v10 phone design, 390 wide): a compact hero with three figures,
 * the section chooser, the hospitals or wards as a priority list, then the pressure, ED and
 * referral figures as rows that open bottom sheets. Every figure is passed in from the desktop
 * screen's own derivations, so the two never disagree.
 */
export function StatisticsSummaryPhone({
  ready,
  beingMadeReady,
  occupied,
  occupiedPct,
  waitingInEd,
  endedToday,
  wards,
  eds,
  referrals,
  wardCount,
  paused,
  onTogglePause,
}: {
  ready: number;
  beingMadeReady: number;
  /** Beds in use: Occupied + Pulled, the one occupancy count (`ward-occupancy.ts`). */
  occupied: number;
  occupiedPct: number;
  waitingInEd: number;
  endedToday: number;
  wards: readonly PhoneWard[];
  eds: readonly PhoneEd[];
  referrals: { raised: number; accepted: number; declined: number; open: number };
  wardCount: number;
  paused: boolean;
  onTogglePause: () => void;
}) {
  const now = useWardFlowClock();
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
  const edsWaiting = eds.filter((ed) => ed.waiting > 0);
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
      value={ward.ready}
      time="ready"
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
            { id: "ed", value: waitingInEd, label: "Waiting in ED" },
            { id: "ended", value: endedToday, label: "Ended today" },
          ]}
          eyebrow="Statistics · Whole network"
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
            items={[
              { id: "hospital", label: "Hospitals", count: hospitals.length },
              { id: "ward", label: "Wards", count: wards.length },
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
                    value={hospital.ready}
                    time="ready"
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
              <li className={styles.showAllItem}>
                <button
                  type="button"
                  className={styles.showAll}
                  aria-expanded={showAll}
                  onClick={() => setShowAll((value) => !value)}
                >
                  {showAll ? "Show fewer" : `Show all ${listLength}`}
                </button>
              </li>
            ) : null}
          </ul>
          <PhoneDotKey testId="ward-statistics-summary-dot-key">
            {`Amber dot: ${BED_ALERT_THRESHOLD_PERCENT}% or more of beds in use`}
          </PhoneDotKey>
        </div>

        <section className={styles.group} aria-label="Referrals today">
          <GroupHead
            title="Referrals today"
            variant="letter"
            aside={`${referrals.raised} raised`}
            className={styles.groupHead}
          />
          <dl className={styles.tiles}>
            <div className={styles.tile}>
              <dt>
                <StatusGlyph tone="success" size={9} /> Accepted
              </dt>
              <dd>{referrals.accepted}</dd>
            </div>
            <div className={styles.tile}>
              <dt>
                <StatusGlyph tone="closed" size={9} /> Declined
              </dt>
              <dd>{referrals.declined}</dd>
            </div>
            <div className={styles.tile}>
              <dt>
                <StatusGlyph tone="neutral" size={9} /> Still open
              </dt>
              <dd>{referrals.open}</dd>
            </div>
            <div className={styles.tile}>
              <dt>Raised</dt>
              <dd>{referrals.raised}</dd>
            </div>
          </dl>
        </section>

        <nav className={styles.navRows} aria-label="More figures">
          {/* Audit stats-18: the one fullest-first ward list lives on Overview; this row opens it. */}
          <Link className={styles.navRow} href={STATISTICS_OVERVIEW_HREF} data-testid="ward-statistics-pressure-link">
            <IconTile icon={Activity} />
            <span className={styles.navText}>
              <b>Where the pressure is</b>
              <span>
                <b className={styles.num}>{overCount}</b> {overCount === 1 ? "ward" : "wards"} at or over{" "}
                {BED_ALERT_THRESHOLD_PERCENT}%, fullest first
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </Link>
          <button
            type="button"
            className={styles.navRow}
            onClick={() =>
              setSheet({
                title: "ED waits for a bed",
                body: (
                  <ul className={styles.list}>
                    {eds.map((ed) => (
                      <PhoneListRow
                        key={ed.id}
                        as="li"
                        name={ed.name}
                        meta={ed.longest === null ? "Nobody waiting" : `Longest ${durMinutes(ed.longest)}`}
                        value={ed.waiting}
                        time="waiting"
                        href={edStatisticsHref(ed.id)}
                      />
                    ))}
                  </ul>
                ),
              })
            }
          >
            <IconTile icon={Clock} />
            <span className={styles.navText}>
              <b>ED waits for a bed</b>
              <span>
                {longestEd === null ? (
                  `${edsWaiting.length} of ${eds.length} departments with someone waiting`
                ) : (
                  <>
                    Longest <b className={styles.num}>{durMinutes(longestEd)}</b> · {waitingInEd} waiting in{" "}
                    {edsWaiting.length} of {eds.length}
                  </>
                )}
              </span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </button>
          <Link className={styles.navRow} href={STATISTICS_OVERVIEW_HREF}>
            <IconTile icon={Layers} />
            <span className={styles.navText}>
              <b>More figures</b>
              <span>Blocked discharges, declines, pull to arrival</span>
            </span>
            <ChevronRight size={16} aria-hidden="true" className={styles.navGo} />
          </Link>
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
