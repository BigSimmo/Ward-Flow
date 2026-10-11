"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BedDouble, Check, ChevronRight, Download, ListFilter, Minus, Plus, Search, X } from "lucide-react";

import {
  Button,
  CardBody,
  CardFoot,
  FilterChip,
  Icon,
  Legend,
  Menu,
  Segmented,
  SrOnly,
  StatusGlyph,
  TextInput,
  type MenuItem,
} from "@/components/wf";
import { BED_ALERT_THRESHOLD_PERCENT } from "../shell/ward-service-bed-alerts";
import { unitCapacity } from "../ward-derivations";
import { bedsPendingPreparation } from "../ward-bed-availability";
import { BED_STATE_LABELS, bedStates } from "../ward-bed-states";
import type { Admission } from "../ward-admissions";
import { siteByCode } from "../ward-sites";
import type { BedRelease, LeaveBed, Unit } from "../ward-model";
import { statisticsChartScale } from "./statistics-chart-scale";
import { csvCell } from "./statistics-csv";
import { StatCard } from "./statistics-hero";
import styles from "./statistics-capacity-chart.module.css";

type CapacityRow = {
  id: string;
  name: string;
  context: string;
  beds: number;
  occupied: number;
  ready: number;
  pulled: number;
  closed: number;
  onLeave: number;
  pending: number;
  services: Set<string>;
  units: Unit[];
};

type SortKey = "ready" | "occupancy" | "beds" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  ready: "Most ready",
  occupancy: "Highest occupancy",
  beds: "Largest capacity",
  name: "Name A to Z",
};

/** "North Metro" reads "North" on the filter track; the full name stays in the accessible name. */
const shortService = (name: string) => name.replace(/ Metro$/, "");

/**
 * One current-state chart; React owns filters, aggregation, selection and bar geometry. Bed figures
 * are the ruled boxes from `bedStates` — Ready · Pulled · Closed · Occupied add up to the beds.
 * Without `admissions` no pull can be told apart, so Pulled is 0 and a pulled patient stays inside
 * Occupied. The dashed alert line marks occupancy at the bed alert threshold; a row at or over it
 * carries an amber circle beside its ready count.
 */
export function StatisticsCapacityChart({
  units,
  bedReleases,
  admissions = [],
  leaveBeds = [],
  initialGroup = "hospital",
  scopeLabel = "across the network",
  title = "Where beds are available",
}: {
  units: Unit[];
  bedReleases: BedRelease[];
  admissions?: readonly Admission[];
  leaveBeds?: readonly LeaveBed[];
  initialGroup?: "hospital" | "ward";
  scopeLabel?: string;
  title?: string;
}) {
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const [groupBy, setGroupBy] = useState<"hospital" | "ward">(initialGroup);
  const [scale, setScale] = useState<"beds" | "share">("share");
  const [service, setService] = useState("all");
  const [overOnly, setOverOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("ready");
  const [alertLine, setAlertLine] = useState(BED_ALERT_THRESHOLD_PERCENT);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const services = [
    ...new Set(
      units
        .map((unit) => siteByCode(unit.siteCode)?.service)
        .filter((name): name is NonNullable<typeof name> => !!name),
    ),
  ].sort();

  const { rows, allCount } = useMemo(() => {
    const group = (list: Unit[]) => {
      const grouped = new Map<string, CapacityRow>();
      for (const unit of list) {
        const site = siteByCode(unit.siteCode);
        const id = groupBy === "hospital" ? unit.siteCode : unit.id;
        const row = grouped.get(id) ?? {
          id,
          name: groupBy === "hospital" ? (site?.name ?? unit.siteCode) : unit.name,
          context: groupBy === "hospital" ? (site?.service ?? "Service not recorded") : (site?.name ?? unit.siteCode),
          beds: 0,
          occupied: 0,
          ready: 0,
          pulled: 0,
          closed: 0,
          onLeave: 0,
          pending: 0,
          services: new Set<string>(),
          units: [],
        };
        if (site?.service) row.services.add(site.service);
        const states = bedStates(unit, admissions, bedReleases, leaveBeds);
        row.beds += unit.beds;
        row.occupied += states.occupied;
        row.ready += states.ready;
        row.pulled += states.pulled;
        row.closed += states.closed;
        row.onLeave += states.onLeave;
        row.pending += bedsPendingPreparation(unit.id, bedReleases);
        row.units.push(unit);
        grouped.set(id, row);
      }
      return [...grouped.values()];
    };
    const needle = query.trim().toLowerCase();
    // The service choice highlights and dims (v10 filter rule); only the typed search narrows.
    const matched = units.filter((unit) => {
      const site = siteByCode(unit.siteCode);
      const search = `${unit.name} ${site?.name ?? unit.siteCode} ${unit.siteCode}`.toLowerCase();
      return !needle || search.includes(needle);
    });
    const sorted = group(matched).sort((a, b) => {
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
    return { rows: sorted, allCount: group(units).length };
  }, [units, bedReleases, admissions, leaveBeds, query, groupBy, sort]);

  const occupancyOf = (row: CapacityRow) => (row.beds ? ((row.occupied + row.pulled) / row.beds) * 100 : 0);
  const inService = (row: CapacityRow) => service === "all" || row.services.has(service);
  const isLit = (row: CapacityRow) => inService(row) && (!overOnly || occupancyOf(row) >= alertLine);
  const highlighting = service !== "all" || overOnly;
  const litRows = rows.filter(isLit);
  // Resolve from current rows: removed selections never leave a stale inspector.
  const selected = rows.find((row) => row.id === selectedId);
  const total = litRows.reduce(
    (sum, row) => ({
      beds: sum.beds + row.beds,
      ready: sum.ready + row.ready,
      pending: sum.pending + row.pending,
    }),
    { beds: 0, ready: 0, pending: 0 },
  );
  const { maximum, ticks } =
    scale === "share"
      ? { maximum: 100, ticks: [0, 25, 50, 75, 100] }
      : statisticsChartScale(Math.max(0, ...rows.map((row) => row.beds)));
  const overLine = rows.filter((row) => inService(row) && occupancyOf(row) >= alertLine).length;
  const hasFilters = highlighting || query !== "";
  const changed = hasFilters || groupBy !== initialGroup || scale !== "share" || sort !== "ready";
  const noun = groupBy === "hospital" ? (allCount === 1 ? "hospital" : "hospitals") : allCount === 1 ? "ward" : "wards";

  function closeDetails() {
    if (selected) rowButtons.current.get(selected.id)?.focus();
    setSelectedId(null);
  }

  function reset() {
    setService("all");
    setOverOnly(false);
    setQuery("");
    setGroupBy(initialGroup);
    setScale("share");
    setSort("ready");
    setSelectedId(null);
  }

  function exportCsv() {
    const lines = [
      ["Synthetic current-state data", "Scope", "Total beds", "Ready", "Pulled", "Closed", "Occupied", "On leave"],
      ...rows.map((row) => [
        row.name,
        row.context,
        row.beds,
        row.ready,
        row.pulled,
        row.closed,
        row.occupied,
        row.onLeave,
      ]),
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

  const sortItems: MenuItem[] = (Object.keys(SORT_LABELS) as SortKey[]).map((key) => ({
    id: key,
    label: SORT_LABELS[key],
    icon: sort === key ? Check : undefined,
    onSelect: () => setSort(key),
  }));

  return (
    <StatCard
      className={styles.chart}
      data-testid="ward-statistics-capacity-chart"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          closeDetails();
        }
      }}
      icon={BedDouble}
      title={title}
      action={
        <span className={styles.headControls}>
          <Segmented
            label="Group capacity by"
            value={groupBy}
            onChange={(id) => {
              setGroupBy(id);
              setSelectedId(null);
            }}
            items={[
              { id: "hospital", label: "Hospitals" },
              { id: "ward", label: "Wards" },
            ]}
          />
          <Segmented
            label="Chart scale"
            value={scale}
            onChange={setScale}
            items={[
              { id: "share", label: "%" },
              { id: "beds", label: "Beds" },
            ]}
          />
        </span>
      }
    >
      <div className={styles.toolbar}>
        <TextInput
          type="search"
          icon={Search}
          boxClassName={styles.search}
          aria-label="Search capacity"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a hospital or ward"
        />
        {services.length > 1 ? (
          <Segmented
            label="Health service filter"
            value={service}
            onChange={(id) => {
              setService(id);
              setSelectedId(null);
            }}
            items={[{ id: "all", label: "All" }, ...services.map((name) => ({ id: name, label: shortService(name) }))]}
          />
        ) : null}
        <span className={styles.sortSlot}>
          <Menu
            label="Sort capacity"
            align="end"
            items={sortItems}
            trigger={(props) => (
              <button {...props} type="button" className={styles.sortButton}>
                <Icon icon={ListFilter} size={14} />
                {SORT_LABELS[sort]}
              </button>
            )}
          />
        </span>
      </div>

      <div className={styles.summary}>
        <span className={styles.summaryNumbers} aria-live="polite" aria-atomic="true">
          <strong>{total.ready}</strong> ready of {total.beds} <SrOnly>synthetic </SrOnly>beds
          {total.pending > 0 ? (
            <span className={styles.beingReady} data-testid="ward-statistics-capacity-pending">
              {total.pending} being made ready
            </span>
          ) : null}
        </span>
        <span role="group" aria-label="Bed status legend" className={styles.legendSlot}>
          <Legend
            items={[
              { id: "ready", label: BED_STATE_LABELS.ready, fill: "data-1" },
              { id: "pulled", label: BED_STATE_LABELS.pulled, hatch: true },
              { id: "closed", label: BED_STATE_LABELS.closed, fill: "data-2" },
              { id: "occupied", label: BED_STATE_LABELS.occupied, fill: "data-3" },
            ]}
          />
        </span>
        {scale === "share" ? (
          <span className={styles.alertLine}>
            <span className={styles.alertKey} aria-hidden="true" />
            <span>Alert line</span>
            <span className={styles.stepper} role="group" aria-label="Alert line">
              <button
                type="button"
                aria-label="Lower the alert line"
                disabled={alertLine <= 50}
                onClick={() => setAlertLine((value) => Math.max(50, value - 5))}
              >
                <Icon icon={Minus} size={14} />
              </button>
              <output aria-live="polite">{alertLine}%</output>
              <button
                type="button"
                aria-label="Raise the alert line"
                disabled={alertLine >= 100}
                onClick={() => setAlertLine((value) => Math.min(100, value + 5))}
              >
                <Icon icon={Plus} size={14} />
              </button>
            </span>
          </span>
        ) : null}
      </div>

      <CardBody flush className={styles.workspace}>
        <div className={styles.plot}>
          <div className={styles.axis} aria-hidden="true">
            <span />
            <div className={styles.axisTicks}>
              {ticks.map((tick) => (
                <span key={tick} style={{ left: `${(tick / maximum) * 100}%` }}>
                  {tick}
                  {scale === "share" ? "%" : ""}
                </span>
              ))}
            </div>
            <span className={styles.axisReady}>Ready</span>
            <span />
          </div>
          {rows.length === 0 ? (
            <div className={styles.empty}>
              <strong>No matching wards</strong>
              <Button size="sm" variant="ghost" onClick={reset}>
                Clear filters
              </Button>
            </div>
          ) : (
            rows.map((row, index) => {
              const denominator = scale === "share" ? row.beds || 1 : maximum;
              const over = occupancyOf(row) >= alertLine;
              const wards = row.units.length;
              const sub =
                groupBy === "hospital"
                  ? `${row.context} · ${wards} ${wards === 1 ? "ward" : "wards"} · ${row.beds} beds`
                  : `${row.context} · ${row.beds} beds`;
              return (
                <button
                  key={row.id}
                  ref={(node) => {
                    if (node) rowButtons.current.set(row.id, node);
                    else rowButtons.current.delete(row.id);
                  }}
                  title={`${row.ready} ready · ${row.pulled} pulled · ${row.closed} closed · ${row.occupied} occupied · ${row.beds} beds`}
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
                  data-dim={highlighting && !isLit(row) ? "true" : undefined}
                  aria-pressed={selected?.id === row.id}
                  aria-label={`${row.name}: ${row.ready} ready, ${row.pulled} pulled, ${row.closed} closed, ${row.occupied} occupied of ${row.beds} beds. Show details.`}
                  onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}
                >
                  <span className={styles.rowName}>
                    <strong>{row.name}</strong>
                    <small>{sub}</small>
                  </span>
                  <span className={styles.barArea} aria-hidden="true">
                    {ticks.map((tick) => (
                      <i className={styles.guide} key={tick} style={{ left: `${(tick / maximum) * 100}%` }} />
                    ))}
                    {scale === "share" ? <i className={styles.alertMark} style={{ left: `${alertLine}%` }} /> : null}
                    <span className={styles.bar} style={{ width: `${(row.beds / denominator) * 100}%` }}>
                      {row.ready > 0 && (
                        <span className={styles.ready} style={{ width: `${(row.ready / (row.beds || 1)) * 100}%` }} />
                      )}
                      {row.pulled > 0 && (
                        <span
                          className={styles.pulled}
                          data-bed-state="pulled"
                          style={{ width: `${(row.pulled / (row.beds || 1)) * 100}%` }}
                        />
                      )}
                      {row.closed > 0 && (
                        <span className={styles.held} style={{ width: `${(row.closed / (row.beds || 1)) * 100}%` }} />
                      )}
                      {row.occupied > 0 && (
                        <span
                          className={styles.occupied}
                          style={{ width: `${(row.occupied / (row.beds || 1)) * 100}%` }}
                        />
                      )}
                    </span>
                  </span>
                  <span className={styles.readyCount} data-empty={row.ready === 0}>
                    {over ? <StatusGlyph tone="warning" size={9} /> : null}
                    {row.ready}
                  </span>
                  <Icon icon={ChevronRight} size={14} className={styles.chevron} />
                </button>
              );
            })
          )}
        </div>

        {selected && (
          <aside className={styles.inspector} aria-label="Selected capacity details" data-testid="capacity-details">
            <div className={styles.inspectorHeading}>
              <h3>{selected.name}</h3>
              <span>{selected.context}</span>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                icon={X}
                aria-label="Close capacity details"
                onClick={closeDetails}
              />
            </div>
            <dl className={styles.detailsMetrics}>
              <div>
                <dt>{BED_STATE_LABELS.ready}</dt>
                <dd>{selected.ready}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.pulled}</dt>
                <dd>{selected.pulled}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.closed}</dt>
                <dd>{selected.closed}</dd>
              </div>
              <div>
                <dt>{BED_STATE_LABELS.occupied}</dt>
                <dd>
                  {selected.occupied}
                  {selected.onLeave > 0 ? ` · ${selected.onLeave} on leave` : null}
                </dd>
              </div>
              <div>
                <dt>Total beds</dt>
                <dd>{selected.beds}</dd>
              </div>
            </dl>
            <div className={styles.wardList}>
              {selected.units.map((unit) => {
                const capacity = unitCapacity(unit, bedReleases);
                return (
                  <Link key={unit.id} href={`/mockups/ward-flow/statistics/ward/${encodeURIComponent(unit.id)}`}>
                    <span>{unit.name}</span>
                    <strong>{capacity.available} ready</strong>
                    <Icon icon={ChevronRight} size={14} />
                  </Link>
                );
              })}
            </div>
          </aside>
        )}
      </CardBody>
      <CardFoot
        meta={
          <span className={styles.showing} data-testid="ward-statistics-capacity-showing">
            {highlighting ? (
              <>
                <b>{litRows.length}</b> of {rows.length} {noun} highlighted, all rows stay
              </>
            ) : (
              <>
                Showing <b>{rows.length}</b> of {allCount} {noun}
                {query !== "" ? " matched" : ` ${scopeLabel}`}
              </>
            )}
            {scale === "share" ? (
              <FilterChip
                className={styles.footOver}
                pressed={overOnly}
                onPressedChange={setOverOnly}
                tone="warning"
                count={overLine}
              >
                At or over the alert line
              </FilterChip>
            ) : null}
          </span>
        }
      >
        {changed ? (
          <Button size="sm" variant="ghost" onClick={reset}>
            Reset view
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" icon={Download} onClick={exportCsv} disabled={!rows.length}>
          Chart CSV
        </Button>
      </CardFoot>
    </StatCard>
  );
}
