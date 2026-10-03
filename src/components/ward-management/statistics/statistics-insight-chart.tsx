"use client";

import { useId, useState } from "react";
import Link from "next/link";
import styles from "./statistics-insight-chart.module.css";

export type InsightMetric = { id: string; label: string; unit: string; note: string; tone?: "warning" | "good" };
export type InsightRow = {
  id: string;
  name: string;
  context?: string;
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
  const [metricId, setMetricId] = useState(defaultMetric ?? metrics[0]?.id);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [group, setGroup] = useState(defaultGroup);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const maximum = Math.max(1, ...visible.map((row) => valueOf(row) ?? 0));
  const selected = visible.find((row) => row.id === selectedId);
  const format = (value: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(value);
  const display = (row: InsightRow) => {
    const value = valueOf(row);
    return value === null ? (row.unavailable ?? "Not recorded") : `${format(value)} ${metric.unit}`;
  };
  function reset() {
    setQuery("");
    setSort(defaultSort);
    setGroup(defaultGroup);
    setMetricId(defaultMetric ?? metrics[0]?.id);
    setSelectedId(null);
  }
  function exportCsv() {
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
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
    <section className={styles.chart} aria-labelledby={headingId} data-testid={testId}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Current records</span>
          <h2 id={headingId}>{title}</h2>
        </div>
        <span className={styles.count}>
          {visible.length} of {rows.length}
        </span>
      </header>
      <div className={styles.toolbar}>
        {metrics.length > 1 && (
          <label>
            Measure
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
            Show
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
            Search
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
        <label>
          Order
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
        <button type="button" onClick={exportCsv}>
          Export CSV
        </button>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </div>
      <p className={styles.note}>{metric.note}</p>
      <div className={`${styles.workspace} ${selected ? styles.withSelection : ""}`}>
        <div
          className={styles.plot}
          data-variant={variant}
          data-empty={visible.every((row) => valueOf(row) === null || valueOf(row) === 0)}
        >
          <div className={styles.axis} aria-hidden="true">
            <span>{metric.label}</span>
            <span>
              0 — {format(maximum)} {metric.unit}
            </span>
          </div>
          {visible.map((row) => {
            const value = valueOf(row);
            return (
              <button
                key={row.id}
                type="button"
                className={styles.row}
                aria-pressed={selected?.id === row.id}
                aria-label={`${row.name}: ${display(row)}`}
                onClick={() => setSelectedId(selected?.id === row.id ? null : row.id)}
              >
                <span className={styles.identity}>
                  <strong>{row.name}</strong>
                  {row.context && <small>{row.context}</small>}
                </span>
                <span className={styles.track} aria-hidden="true">
                  {value !== null && (
                    <span
                      className={styles.bar}
                      data-tone={metric.tone}
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
          {!visible.length && (
            <div className={styles.empty}>
              <p>{emptyText}</p>
              <button type="button" onClick={reset}>
                Clear filters
              </button>
            </div>
          )}
        </div>
        {selected && (
          <aside className={styles.inspector} aria-label={`${selected.name} details`}>
            <div className={styles.inspectorHeading}>
              <h3>{selected.name}</h3>
              <button type="button" aria-label="Close chart details" onClick={() => setSelectedId(null)}>
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
