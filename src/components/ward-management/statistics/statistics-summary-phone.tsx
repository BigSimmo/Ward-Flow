"use client";

import { useState, type ReactNode } from "react";

import {
  GroupHead,
  LiveChip,
  PhoneHero,
  PhoneListRow,
  PhoneSheet,
  Segmented,
  StatusGlyph,
  durMinutes,
} from "@/components/wf";
import { wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { BED_ALERT_THRESHOLD_PERCENT } from "@/components/ward-management/shell/ward-service-bed-alerts";

import { StatisticsNav } from "./statistics-nav";
import { FactGrid } from "../reports/report-parts";
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

type Sheet = { title: string; body: ReactNode } | null;

const shortService = (service: string) => service.replace(/ Metro$/u, "").replace(/^Country \((.+)\)$/u, "$1");

function overLine(percent: number): boolean {
  return percent >= BED_ALERT_THRESHOLD_PERCENT;
}

function InUse({ percent, where }: { percent: number; where: string }) {
  return (
    <span className={styles.inUse}>
      {overLine(percent) ? <StatusGlyph tone="warning" size={9} /> : null}
      {percent}% occupied · {where}
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
  const [group, setGroup] = useState<"hospital" | "ward">("hospital");
  const [sheet, setSheet] = useState<Sheet>(null);

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
  const pressure = [...wards].sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  const overCount = wards.filter((ward) => overLine(ward.percent)).length;
  const edsWaiting = eds.filter((ed) => ed.waiting > 0);

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
            { id: "occupied", value: occupied, label: `${occupiedPct}% occupied` },
            { id: "ed", value: waitingInEd, label: "Waiting in ED" },
            { id: "ended", value: endedToday, label: "Ended today" },
          ]}
          actions={
            <span className={styles.heroActions}>
              <StatisticsNav currentSection="hub" withSamples={false} wardCount={wardCount} />
              <LiveChip state={paused ? "paused" : "live"} onHero onTogglePause={onTogglePause} />
            </span>
          }
        />

        <Segmented<"hospital" | "ward">
          className={styles.seg}
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
            ? hospitals.map((hospital) => (
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
            : byReady.map(wardRow)}
        </ul>

        <section className={styles.group} aria-label="More figures">
          <GroupHead title="More figures" variant="letter" />
          <ul className={styles.list}>
            <PhoneListRow
              as="li"
              name="Where the pressure is"
              meta={`Wards at or over ${BED_ALERT_THRESHOLD_PERCENT}% occupied`}
              value={overCount}
              time="wards"
              onSelect={() =>
                setSheet({
                  title: "Where the pressure is",
                  body: (
                    <>
                      <p className={styles.note}>
                        Amber dot: at or over {BED_ALERT_THRESHOLD_PERCENT}%. Every ward is listed, fullest first.
                      </p>
                      <ul className={styles.list}>{pressure.map(wardRow)}</ul>
                    </>
                  ),
                })
              }
            />
            <PhoneListRow
              as="li"
              name="ED waits for a bed"
              meta={`${edsWaiting.length} of ${eds.length} departments with someone waiting`}
              value={waitingInEd}
              time="waiting"
              onSelect={() =>
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
                        />
                      ))}
                    </ul>
                  ),
                })
              }
            />
            <PhoneListRow
              as="li"
              name="Referrals today"
              meta={`${referrals.accepted} accepted · ${referrals.open} still open`}
              value={referrals.raised}
              time="raised"
              onSelect={() =>
                setSheet({
                  title: "Referrals today",
                  body: (
                    <FactGrid
                      facts={[
                        { id: "raised", label: "Raised", value: referrals.raised },
                        { id: "accepted", label: "Accepted", value: referrals.accepted },
                        { id: "declined", label: "Declined", value: referrals.declined },
                        { id: "open", label: "Still open", value: referrals.open },
                      ]}
                    />
                  ),
                })
              }
            />
          </ul>
        </section>
      </main>
      <PhoneSheet open={sheet !== null} onClose={() => setSheet(null)} title={sheet?.title ?? ""}>
        <div className={styles.sheetBody}>{sheet?.body}</div>
      </PhoneSheet>
    </div>
  );
}
