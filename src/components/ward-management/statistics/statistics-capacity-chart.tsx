"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { unitCapacity } from "../ward-derivations";
import { bedsPendingPreparation } from "../ward-bed-availability";
import { siteByCode } from "../ward-sites";
import type { BedRelease, Unit } from "../ward-model";
import { statisticsChartScale } from "./statistics-chart-scale";
import { csvCell } from "./statistics-csv";
import styles from "./statistics-capacity-chart.module.css";

type CapacityRow = {
  id: string;
  name: string;
  context: string;
  beds: number;
  occupied: number;
  ready: number;
  held: number;
  pending: number;
  units: Unit[];
};

/** One current-state chart; React owns filters, aggregation, selection and bar geometry. */
export function StatisticsCapacityChart({
  units,
  bedReleases,
  initialGroup = "hospital",
  scopeLabel = "across the network",
}: {
  units: Unit[];
  bedReleases: BedRelease[];
  initialGroup?: "hospital" | "ward";
  scopeLabel?: string;
}) {
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const [groupBy, setGroupBy] = useState<"hospital" | "ward">(initialGroup);
  const [scale, setScale] = useState<"beds" | "share">("beds");
  const [service, setService] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ready");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const services = [...new Set(units.map((unit) => siteByCode(unit.siteCode)?.service).filter(Boolean))].sort();
  const rows = useMemo(() => {
    const grouped = new Map<string, CapacityRow>();
    for (const unit of units) {
      const site = siteByCode(unit.siteCode);
      if (service !== "all" && site?.service !== service) continue;
      const search = `${unit.name} ${site?.name ?? unit.siteCode} ${unit.siteCode}`.toLowerCase();
      if (query.trim() && !search.includes(query.trim().toLowerCase())) continue;
      const id = groupBy === "hospital" ? unit.siteCode : unit.id;
      const row = grouped.get(id) ?? {
        id,
        name: groupBy === "hospital" ? (site?.name ?? unit.siteCode) : unit.name,
        context: groupBy === "hospital" ? (site?.service ?? "Service not recorded") : (site?.name ?? unit.siteCode),
        beds: 0,
        occupied: 0,
        ready: 0,
        held: 0,
        pending: 0,
        units: [],
      };
      const capacity = unitCapacity(unit, bedReleases);
      row.beds += unit.beds;
      row.occupied += capacity.occupied;
      row.ready += capacity.available;
      row.held += capacity.held;
      row.pending += bedsPendingPreparation(unit.id, bedReleases);
      row.units.push(unit);
      grouped.set(id, row);
    }
    return [...grouped.values()].sort((a, b) => {
      const difference =
        sort === "ready"
          ? b.ready - a.ready
          : sort === "beds"
            ? b.beds - a.beds
            : sort === "occupancy"
              ? (b.beds ? b.occupied / b.beds : 0) - (a.beds ? a.occupied / a.beds : 0)
              : 0;
      return difference || a.name.localeCompare(b.name);
    });
  }, [units, bedReleases, service, query, groupBy, sort]);

  // Resolve from current rows: hidden or removed selections never leave a stale inspector.
  const selected = rows.find((row) => row.id === selectedId);
  const total = rows.reduce(
    (sum, row) => ({
      beds: sum.beds + row.beds,
      ready: sum.ready + row.ready,
      occupied: sum.occupied + row.occupied,
      held: sum.held + row.held,
      pending: sum.pending + row.pending,
    }),
    { beds: 0, ready: 0, occupied: 0, held: 0, pending: 0 },
  );
  const { maximum, ticks } =
    scale === "share"
      ? { maximum: 100, ticks: [0, 25, 50, 75, 100] }
      : statisticsChartScale(Math.max(0, ...rows.map((row) => row.beds)));
  const hasFilters = service !== "all" || query !== "";

  function closeDetails() {
    if (selected) rowButtons.current.get(selected.id)?.focus();
    setSelectedId(null);
  }

  function reset() {
    setService("all");
    setQuery("");
    setGroupBy(initialGroup);
    setScale("beds");
    setSort("ready");
    setSelectedId(null);
  }

  function exportCsv() {
    const lines = [
      ["Synthetic current-state data", "Scope", "Total beds", "Occupied", "Ready", "Held"],
      ...rows.map((row) => [row.name, row.context, row.beds, row.occupied, row.ready, row.held]),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.map((line) => line.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "ward-flow-synthetic-capacity.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      className={styles.chart}
      aria-label="Bed capacity explorer"
      data-testid="ward-statistics-capacity-chart"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          closeDetails();
        }
      }}
    >
      <div className={styles.toolbar}>
        <div className={styles.switch} role="group" aria-label="Group capacity by">
          <button
            type="button"
            aria-pressed={groupBy === "hospital"}
            onClick={() => {
              setGroupBy("hospital");
              setSelectedId(null);
            }}
          >
            Hospitals
          </button>
          <button
            type="button"
            aria-pressed={groupBy === "ward"}
            onClick={() => {
              setGroupBy("ward");
              setSelectedId(null);
            }}
          >
            Wards
          </button>
        </div>
        <label className={styles.search}>
          <span className={styles.srOnly}>Search capacity</span>
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3 3" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a hospital or ward"
          />
        </label>
        {services.length > 1 && (
          <label>
            <span className={styles.srOnly}>Health service filter</span>
            <select value={service} onChange={(event) => setService(event.target.value)}>
              <option value="all">All health services</option>
              {services.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span className={styles.srOnly}>Sort capacity</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="ready">Most ready beds</option>
            <option value="occupancy">Highest occupancy</option>
            <option value="beds">Largest capacity</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      <div className={styles.summary}>
        <div className={styles.summaryNumbers} aria-live="polite" aria-atomic="true">
          <strong>
            {total.ready}
            <span>ready</span>
          </strong>
          <span>
            {total.beds} beds · {rows.length}{" "}
            {groupBy === "hospital"
              ? rows.length === 1
                ? "hospital"
                : "hospitals"
              : rows.length === 1
                ? "ward"
                : "wards"}
            {hasFilters ? " matched" : ` ${scopeLabel}`}
          </span>
          {total.pending > 0 ? (
            <span data-testid="ward-statistics-capacity-pending">
              {total.pending} of the ready beds still being made ready
            </span>
          ) : null}
          <span className={styles.srOnly}>The beds are synthetic.</span>
        </div>
        <div className={styles.legend} aria-label="Bed status legend">
          <span>
            <i className={styles.ready} />
            Ready
          </span>
          <span>
            <i className={styles.occupied} />
            Occupied
          </span>
          <span>
            <i className={styles.held} />
            Held
          </span>
        </div>
        <div className={styles.switch} role="group" aria-label="Chart scale">
          <button type="button" aria-pressed={scale === "beds"} onClick={() => setScale("beds")}>
            Beds
          </button>
          <button type="button" aria-pressed={scale === "share"} onClick={() => setScale("share")}>
            %
          </button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.plot}>
          <div className={styles.axis} aria-hidden="true">
            <span>{groupBy === "hospital" ? "Hospital" : "Ward"}</span>
            <div>
              {ticks.map((tick) => (
                <span key={tick} style={{ left: `${(tick / maximum) * 100}%` }}>
                  {tick}
                  {scale === "share" ? "%" : ""}
                </span>
              ))}
            </div>
            <span>Ready</span>
          </div>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <strong>No matching wards</strong>
              <button type="button" onClick={reset}>
                Clear filters
              </button>
            </div>
          ) : (
            rows.map((row, index) => {
              const denominator = scale === "share" ? row.beds || 1 : maximum;
              const percent = row.beds ? Math.round((row.occupied / row.beds) * 100) : 0;
              return (
                <button
                  key={row.id}
                  ref={(node) => {
                    if (node) rowButtons.current.set(row.id, node);
                    else rowButtons.current.delete(row.id);
                  }}
                  title={`${row.ready} ready · ${row.occupied} occupied · ${row.held} held · ${row.beds} beds`}
                  onKeyDown={(event) => {
                    const direction = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
                    if (direction || event.key === "Home" || event.key === "End") {
                      event.preventDefault();
                      const nextIndex =
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? rows.length - 1
                            : (index + direction + rows.length) % rows.length;
                      rowButtons.current.get(rows[nextIndex].id)?.focus();
                    }
                  }}
                  type="button"
                  className={styles.row}
                  aria-pressed={selected?.id === row.id}
                  aria-label={`${row.name}: ${row.ready} ready, ${row.occupied} occupied, ${row.held} held of ${row.beds} beds. Show details.`}
                  onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}
                >
                  <span className={styles.rowName}>
                    <strong>{row.name}</strong>
                    <small>{row.context}</small>
                  </span>
                  <span className={styles.barArea} aria-hidden="true">
                    {ticks.map((tick) => (
                      <i className={styles.guide} key={tick} style={{ left: `${(tick / maximum) * 100}%` }} />
                    ))}
                    <span className={styles.bar} style={{ width: `${(row.beds / denominator) * 100}%` }}>
                      {row.ready > 0 && (
                        <span className={styles.ready} style={{ width: `${(row.ready / (row.beds || 1)) * 100}%` }} />
                      )}
                      {row.occupied > 0 && (
                        <span
                          className={styles.occupied}
                          style={{ width: `${(row.occupied / (row.beds || 1)) * 100}%` }}
                        />
                      )}
                      {row.held > 0 && (
                        <span className={styles.held} style={{ width: `${(row.held / (row.beds || 1)) * 100}%` }} />
                      )}
                    </span>
                    <small>{scale === "share" ? `${percent}% occupied` : `${row.beds} beds`}</small>
                  </span>
                  <span className={styles.readyCount} data-empty={row.ready === 0}>
                    {row.ready}
                    <span aria-hidden="true">›</span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <aside className={styles.inspector} aria-label="Selected capacity details" data-testid="capacity-details">
            <div className={styles.inspectorHeading}>
              <span>{groupBy === "hospital" ? "Hospital detail" : "Ward detail"}</span>
              <button type="button" aria-label="Close capacity details" onClick={closeDetails}>
                ×
              </button>
            </div>
            <h3>{selected.name}</h3>
            <p>{selected.context}</p>
            <dl className={styles.detailsMetrics}>
              <div>
                <dt>Ready</dt>
                <dd>{selected.ready}</dd>
              </div>
              <div>
                <dt>Occupied</dt>
                <dd>{selected.occupied}</dd>
              </div>
              <div>
                <dt>Held</dt>
                <dd>{selected.held}</dd>
              </div>
              <div>
                <dt>Total beds</dt>
                <dd>{selected.beds}</dd>
              </div>
            </dl>
            <p className={styles.definition}>
              Held beds are empty but not allocatable. Out-of-service beds are not recorded.
            </p>
            <div className={styles.wardList}>
              {selected.units.map((unit) => {
                const capacity = unitCapacity(unit, bedReleases);
                return (
                  <Link key={unit.id} href={`/mockups/ward-flow/statistics/ward/${encodeURIComponent(unit.id)}`}>
                    <span>{unit.name}</span>
                    <strong>
                      {capacity.available} ready <span aria-hidden="true">↗</span>
                    </strong>
                  </Link>
                );
              })}
            </div>
          </aside>
        )}
      </div>
      <div className={styles.footer}>
        <span>Current snapshot · synthetic data.</span>
        <div>
          {(hasFilters || groupBy !== initialGroup || scale !== "beds" || sort !== "ready") && (
            <button type="button" onClick={reset}>
              Reset view
            </button>
          )}
          <button type="button" onClick={exportCsv} disabled={!rows.length}>
            Export chart CSV <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    </section>
  );
}
