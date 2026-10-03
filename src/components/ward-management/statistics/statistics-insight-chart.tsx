"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { statisticsChartScale } from "./statistics-chart-scale";
import styles from "./statistics-insight-chart.module.css";

export type InsightMetric = {
  id: string;
  label: string;
  unit: string;
  note: string;
  tone?: "warning" | "good";
  references?: { value: number; label: string }[];
};
export type InsightRow = {
  id: string;
  name: string;
  context?: string;
  tone?: "warning" | "good";
  values: Record<string, number | null>;
  unavailable?: string;
  detail?: string;
  href?: string;
  linkLabel?: string;
  group?: string;
  groups?: string[];
};

/** Current-state comparisons. React owns scales and interaction; no chart runtime or historical inference. */
export function StatisticsInsightChart({
  title,
  metrics,
  rows,
  defaultMetric,
  defaultSort = "record",
  defaultGroup = "all",
  emptyText = "No matching records.",
  groups,
  variant = "bars",
  testId,
}: {
  title: string;
  metrics: InsightMetric[];
  rows: InsightRow[];
  defaultMetric?: string;
  defaultSort?: "record" | "value" | "name";
  defaultGroup?: string;
  emptyText?: string;
  variant?: "bars" | "distribution" | "timeline";
  groups?: { id: string; label: string }[];
  testId: string;
}) {
  const headingId = useId();
  const rowButtons = useRef(new Map<string, HTMLButtonElement>());
  const [metricId, setMetricId] = useState(defaultMetric ?? metrics[0]?.id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [group, setGroup] = useState(defaultGroup);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const metric = metrics.find((item) => item.id === metricId) ?? metrics[0];
  if (!metric) return null;
  const valueOf = (row: InsightRow) => row.values[metric.id] ?? null;
  const visible = rows.filter(
    (row) =>
      (group === "all" || row.group === group || row.groups?.includes(group)) &&
      `${row.name} ${row.context ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  if (sort !== "record")
    visible.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : (valueOf(b) ?? -Infinity) - (valueOf(a) ?? -Infinity) || a.name.localeCompare(b.name),
    );
  const { maximum, ticks } = statisticsChartScale(
    Math.max(0, ...visible.map((row) => valueOf(row) ?? 0)),
    !["h", "days"].includes(metric.unit),
  );
  const references = (metric.references ?? []).filter((reference) => reference.value > 0 && reference.value <= maximum);
  const changed =
    view !== "chart" ||
    query !== "" ||
    sort !== defaultSort ||
    group !== defaultGroup ||
    metric.id !== (defaultMetric ?? metrics[0]?.id);
  const selected = visible.find((row) => row.id === selectedId);
  const format = (value: number) =>
    new Intl.NumberFormat(
      "en-AU",
      maximum < 1 || (value !== 0 && Math.abs(value) < 0.1)
        ? { maximumFractionDigits: 2, maximumSignificantDigits: 2 }
        : { maximumFractionDigits: 1 },
    ).format(value);
  const unitFor = (value: number) =>
    value === 1
      ? ({ people: "person", admissions: "admission", referrals: "referral", days: "day" }[metric.unit] ?? metric.unit)
      : metric.unit;
  const display = (row: InsightRow) => {
    const value = valueOf(row);
    return value === null ? (row.unavailable ?? "Not recorded") : `${format(value)} ${unitFor(value)}`;
  };
  function navigateRows(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const direction =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (direction || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? visible.length - 1
            : (index + direction + visible.length) % visible.length;
      rowButtons.current.get(visible[nextIndex].id)?.focus();
    }
  }
  function closeDetails() {
    if (selected) rowButtons.current.get(selected.id)?.focus();
    setSelectedId(null);
  }
  function reset() {
    setView("chart");
    setQuery("");
    setSort(defaultSort);
    setGroup(defaultGroup);
    setMetricId(defaultMetric ?? metrics[0]?.id);
    setSelectedId(null);
  }
  function exportCsv() {
    const quote = (value: string | number) => {
      const text = String(value);
      // Neutralise spreadsheet formula injection: prefix cells a spreadsheet would evaluate.
      const safe = typeof value === "string" && /^[=+\-@	]/.test(text) ? `'${text}` : text;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const data = [
      ["Synthetic current-state data", "Context", metric.label, "Unit", "Availability"],
      ...visible.map((row) => [
        row.name,
        row.context ?? "",
        valueOf(row) ?? "",
        metric.unit,
        valueOf(row) === null ? (row.unavailable ?? "Not recorded") : "Recorded",
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([data.map((line) => line.map(quote).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ward-flow-${testId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
  return (
    <section
      className={styles.chart}
      aria-labelledby={headingId}
      data-testid={testId}
      onKeyDown={(event) => {
        if (event.key === "Escape" && selected) {
          event.preventDefault();
          closeDetails();
        }
      }}
    >
      <header className={styles.header}>
        <div>
          <h2 id={headingId}>{title}</h2>
        </div>
        <div className={styles.actions}>
          <span className={styles.count} aria-live="polite" aria-atomic="true">
            {visible.length} of {rows.length}
            <span className={styles.srOnly}> synthetic records shown</span>
          </span>
          <button
            type="button"
            aria-label={`${title} data view`}
            aria-pressed={view === "table"}
            onClick={() => setView(view === "chart" ? "table" : "chart")}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            >
              <rect x="1.5" y="2.5" width="13" height="11" rx="1" />
              <path d="M1.5 6.5h13M1.5 10h13M6.5 2.5v11" />
            </svg>
            Data
          </button>
          <button type="button" onClick={exportCsv} disabled={!visible.length}>
            Export CSV
          </button>
          {changed && (
            <button type="button" onClick={reset}>
              Reset
            </button>
          )}
        </div>
      </header>
      {(metrics.length > 1 || groups || rows.length > 6 || variant !== "distribution") && (
        <div className={styles.toolbar}>
          {metrics.length > 1 && (
            <label>
              <span className={styles.srOnly}>Measure</span>
              <select
                aria-label={`${title} measure`}
                value={metric.id}
                onChange={(event) => {
                  setMetricId(event.target.value);
                  setSelectedId(null);
                }}
              >
                {metrics.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {groups && (
            <label>
              <span className={styles.srOnly}>Show</span>
              <select
                aria-label={`${title} group`}
                value={group}
                onChange={(event) => {
                  setGroup(event.target.value);
                  setSelectedId(null);
                }}
              >
                <option value="all">All records</option>
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {rows.length > 6 && (
            <label className={styles.search}>
              <span className={styles.srOnly}>Search</span>
              <input
                type="search"
                aria-label={`Search ${title}`}
                placeholder="Name or location"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                }}
              />
            </label>
          )}
          {variant !== "distribution" && (
            <label>
              <span className={styles.srOnly}>Order</span>
              <select
                aria-label={`${title} order`}
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
              >
                <option value="record">Record order</option>
                <option value="value">Highest first</option>
                <option value="name">Name</option>
              </select>
            </label>
          )}
        </div>
      )}
      <p className={styles.note}>{metric.note}</p>
      <div className={styles.workspace}>
        {view === "chart" ? (
          <div
            className={styles.plot}
            data-variant={variant}
            data-empty={visible.every((row) => valueOf(row) === null || valueOf(row) === 0)}
          >
            <div className={styles.axis} aria-hidden="true">
              <span>{metric.label}</span>
              <span>{metric.unit}</span>
            </div>
            <div className={styles.rows} data-variant={variant}>
              <div className={variant === "distribution" ? styles.yAxis : styles.xAxis} aria-hidden="true">
                {variant !== "distribution" &&
                  references.map((reference) => (
                    <span
                      className={styles.referenceLabel}
                      key={reference.label}
                      style={{ left: `${(reference.value / maximum) * 100}%` }}
                    >
                      {reference.label}
                    </span>
                  ))}
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    data-tick={tick}
                    style={{ [variant === "distribution" ? "bottom" : "left"]: `${(tick / maximum) * 100}%` }}
                  >
                    {format(tick)}
                  </span>
                ))}
              </div>
              {visible.map((row, index) => {
                const value = valueOf(row);
                return (
                  <button
                    key={row.id}
                    ref={(node) => {
                      if (node) rowButtons.current.set(row.id, node);
                      else rowButtons.current.delete(row.id);
                    }}
                    title={`${row.name}: ${display(row)}${row.context ? ` · ${row.context}` : ""}`}
                    onKeyDown={(event) => navigateRows(event, index)}
                    type="button"
                    className={styles.row}
                    data-chart-record=""
                    data-tone={row.tone ?? metric.tone}
                    aria-pressed={selected?.id === row.id}
                    aria-label={`${row.name}: ${display(row)}`}
                    onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}
                  >
                    <span className={styles.identity}>
                      <strong>{row.name}</strong>
                      {row.context && <small>{row.context}</small>}
                    </span>
                    <span className={styles.track} aria-hidden="true">
                      {ticks.map((tick) => (
                        <i
                          key={tick}
                          className={styles.guide}
                          style={{ [variant === "distribution" ? "bottom" : "left"]: `${(tick / maximum) * 100}%` }}
                        />
                      ))}
                      {references.map((reference) => (
                        <i
                          key={reference.label}
                          className={styles.reference}
                          style={{
                            [variant === "distribution" ? "bottom" : "left"]: `${(reference.value / maximum) * 100}%`,
                          }}
                        />
                      ))}
                      {value !== null && (
                        <span
                          className={styles.bar}
                          data-tone={row.tone ?? metric.tone}
                          style={{
                            [variant === "distribution" ? "height" : "width"]:
                              `${Math.max(0, Math.min(100, (value / maximum) * 100))}%`,
                          }}
                        />
                      )}
                    </span>
                    <span className={styles.value} data-unavailable={value === null}>
                      {display(row)}
                    </span>
                  </button>
                );
              })}
            </div>
            {!visible.length && (
              <div className={styles.empty}>
                <p>{emptyText}</p>
                <button type="button" onClick={reset}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.dataView}>
            <table>
              <caption className={styles.srOnly}>
                {title}: {metric.label} ({metric.unit})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Record</th>
                  <th scope="col">
                    {metric.label} <small>({metric.unit})</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => (
                  <tr key={row.id} data-selected={selected?.id === row.id}>
                    <th scope="row">
                      <button
                        data-chart-record=""
                        type="button"
                        aria-label={`${row.name}: ${display(row)}`}
                        aria-pressed={selected?.id === row.id}
                        ref={(node) => {
                          if (node) rowButtons.current.set(row.id, node);
                          else rowButtons.current.delete(row.id);
                        }}
                        onKeyDown={(event) => navigateRows(event, index)}
                        onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}
                      >
                        <strong>{row.name}</strong>
                        {row.context && <small>{row.context}</small>}
                      </button>
                    </th>
                    <td data-unavailable={valueOf(row) === null}>{display(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visible.length && (
              <div className={styles.empty}>
                <p>{emptyText}</p>
                <button type="button" onClick={reset}>
                  Clear filters
                </button>
              </div>
            )}
          </div>
        )}
        {selected && (
          <aside className={styles.inspector} aria-label={`${selected.name} details`}>
            <div className={styles.inspectorHeading}>
              <h3>{selected.name}</h3>
              <button type="button" aria-label="Close chart details" onClick={closeDetails}>
                ×
              </button>
            </div>
            {selected.context && <p>{selected.context}</p>}
            <strong className={styles.selectedValue}>{display(selected)}</strong>
            <p>{metric.label}</p>
            {selected.detail && <p>{selected.detail}</p>}
            {selected.href && <Link href={selected.href}>{selected.linkLabel ?? "Open statistics"} →</Link>}
          </aside>
        )}
      </div>
    </section>
  );
}
