"use client";

import { useMemo, useState } from "react";

import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

import { BedBar, BedLegend, OccupancyPill, Panel, ReadyPill, proposalHref } from "./statistics-proposal-parts";
import { SERVICE_COLOUR, releasesToday, type BedFigures, type WardFigures } from "./statistics-proposal-figures";
import styles from "./statistics-proposal.module.css";

type Group = "hospital" | "ward";
type Sort = "ready" | "occupancy" | "beds" | "free";

type Row = BedFigures & {
  id: string;
  name: string;
  sub: string;
  colour: string;
  href: string;
  occupancy: number;
  freeToday: number;
};

const SORT_LABELS: Record<Sort, string> = {
  ready: "Most ready beds",
  occupancy: "Highest occupancy",
  free: "Most free today",
  beds: "Most beds",
};

/**
 * "Where beds are available" — the current statewide page's capacity chart, kept and improved:
 * hospitals or wards, every bar on one scale and split the same four ways as the rest of the page
 * (occupied, pulled, closed, ready), with ready beds and occupancy read off beside each bar.
 */
export function BedsAvailableChart({ wards }: { wards: readonly WardFigures[] }) {
  const [group, setGroup] = useState<Group>("hospital");
  const [sort, setSort] = useState<Sort>("ready");
  const [service, setService] = useState("all");

  const rows = useMemo(() => {
    const grouped = new Map<string, Row>();
    for (const ward of wards) {
      if (service !== "all" && ward.service !== service) continue;
      const id = group === "hospital" ? ward.unit.siteCode : ward.unit.id;
      const row = grouped.get(id) ?? {
        id,
        name: group === "hospital" ? ward.hospital : ward.unit.name,
        sub: group === "hospital" ? ward.service : ward.hospital,
        colour: SERVICE_COLOUR[ward.service],
        href: group === "hospital" ? proposalHref("service", ward.service) : proposalHref("ward", ward.unit.id),
        beds: 0,
        ready: 0,
        pulled: 0,
        closed: 0,
        occupied: 0,
        beingMadeReady: 0,
        onLeave: 0,
        occupancy: 0,
        freeToday: 0,
      };
      row.beds += ward.beds;
      row.ready += ward.ready;
      row.pulled += ward.pulled;
      row.closed += ward.closed;
      row.occupied += ward.occupied;
      row.beingMadeReady += ward.beingMadeReady;
      row.onLeave += ward.onLeave;
      row.freeToday += releasesToday(ward.releases);
      row.occupancy = row.beds ? row.occupied / row.beds : 0;
      grouped.set(id, row);
    }
    const sortValue = (row: Row) =>
      sort === "ready" ? row.ready : sort === "occupancy" ? row.occupancy : sort === "free" ? row.freeToday : row.beds;
    return [...grouped.values()].sort((a, b) => sortValue(b) - sortValue(a) || a.name.localeCompare(b.name));
  }, [wards, group, sort, service]);

  const maxBeds = Math.max(1, ...rows.map((row) => row.beds));
  const totalReady = rows.reduce((sum, row) => sum + row.ready, 0);
  const noun = group === "hospital" ? "hospitals" : "wards";
  const withNone = rows.filter((row) => row.ready === 0).length;

  return (
    <Panel
      title="Where beds are available"
      question={`${totalReady} ready ${totalReady === 1 ? "bed" : "beds"} across ${rows.length} ${noun}. ${withNone} ${withNone === 1 ? "has" : "have"} none.`}
      meta={SORT_LABELS[sort]}
      foot={<BedLegend />}
    >
      <div className={styles.chartControls}>
        <div className={styles.segmented} role="group" aria-label="Show by">
          <button type="button" aria-pressed={group === "hospital"} onClick={() => setGroup("hospital")}>
            Hospitals
          </button>
          <button type="button" aria-pressed={group === "ward"} onClick={() => setGroup("ward")}>
            Wards
          </button>
        </div>
        <label className={styles.asAt}>
          Sort
          <select className={styles.select} value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
            {(Object.keys(SORT_LABELS) as Sort[]).map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.asAt}>
          Health service
          <select className={styles.select} value={service} onChange={(event) => setService(event.target.value)}>
            <option value="all">All services</option>
            {HEALTH_SERVICES.filter((name) => wards.some((ward) => ward.service === name)).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className={styles.capacityRows}>
        {rows.map((row) => (
          <li className={styles.capacityRow} key={row.id}>
            <span className={styles.rowName}>
              <a href={row.href}>{row.name}</a>
              <span className={styles.rowSub}>
                <span className={styles.dot} style={{ background: row.colour }} aria-hidden="true" />
                {row.sub} · {row.beds} beds
              </span>
            </span>
            <BedBar figures={row} scaleTo={maxBeds} />
            <span className={styles.capacityFigures}>
              <span>
                <ReadyPill value={row.ready} /> ready
              </span>
              <span>
                <OccupancyPill value={row.occupancy} /> occupied
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
