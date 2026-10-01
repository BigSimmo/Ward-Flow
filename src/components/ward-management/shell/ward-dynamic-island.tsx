"use client";

import React, { type ReactNode } from "react";
import styles from "./ward-dynamic-island.module.css";

export type DynamicIslandTone = "normal" | "neutral" | "accent" | "good" | "warn" | "danger" | "critical" | "muted";

export interface DynamicIslandMetric {
  id?: string;
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: DynamicIslandTone;
  active?: boolean;
  onClick?: () => void;
  subtext?: string;
  testId?: string;
  ariaLabel?: string;
}

export interface WardDynamicIslandProps {
  title: ReactNode;
  icon?: ReactNode;
  status?: "nominal" | "warning" | "alarm" | "neutral";
  statusText?: string;
  metrics: DynamicIslandMetric[];
  actions?: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  ariaLabel?: string;
  testId?: string;
  children?: ReactNode;
}

/**
 * WardDynamicIsland
 *
 * Tactical, compact micro-HUD pill representing stage/screen status and vital metrics.
 * Designed as an elevated alternative to bulky rectangular KPI cards.
 *
 * Full compliance:
 * - WCAG 2.1 AA keyboard navigation and accessible roles
 * - Tabular numeric alignment with monospace font
 * - Zero raw colors; all styled via design tokens
 * - Strict 12px text size floor
 */
export function WardDynamicIsland({
  title,
  icon,
  status = "nominal",
  statusText,
  metrics,
  actions,
  align = "start",
  className,
  ariaLabel,
  testId = "ward-dynamic-island",
  children,
}: WardDynamicIslandProps) {
  const pipClass =
    status === "alarm"
      ? styles.statusPipAlarm
      : status === "warning"
        ? styles.statusPipWarning
        : status === "neutral"
          ? styles.statusPipNeutral
          : styles.statusPipNominal;

  const wrapperAlignClass =
    align === "center"
      ? styles.islandWrapperCenter
      : align === "end"
        ? styles.islandWrapperEnd
        : "";

  const effectiveStatusText =
    statusText ??
    (status === "alarm"
      ? "Critical pressure"
      : status === "warning"
        ? "Attention required"
        : status === "neutral"
          ? "Monitoring"
          : "Nominal status");

  return (
    <section
      className={`${styles.islandWrapper} ${wrapperAlignClass} ${className ?? ""}`.trim()}
      role="region"
      aria-label={ariaLabel ?? (typeof title === "string" ? `${title} HUD` : "Stage HUD")}
      data-testid={testId}
    >
      <div className={styles.island}>
        <div className={styles.stageHead}>
          <span
            className={`${styles.statusPip} ${pipClass}`}
            role="status"
            aria-label={effectiveStatusText}
            title={effectiveStatusText}
          />
          <span className={styles.stageTitle}>
            {icon && <span aria-hidden="true">{icon}</span>}
            {title}
          </span>
        </div>

        <ul className={styles.metricsList} role="list">
          {metrics.map((metric, idx) => {
            const toneClass =
              metric.tone === "accent"
                ? styles.metricToneAccent
                : metric.tone === "good"
                  ? styles.metricToneGood
                  : metric.tone === "warn"
                    ? styles.metricToneWarn
                    : metric.tone === "danger" || metric.tone === "critical"
                      ? styles.metricToneDanger
                      : metric.tone === "muted" || metric.tone === "neutral"
                        ? styles.metricToneMuted
                        : "";

            const trimmedLabel = metric.label?.trim() ?? "";
            const cleanLabel = trimmedLabel.replace(/:+$/, "");
            const formattedLabel = cleanLabel ? `${cleanLabel}:` : "";
            const defaultAriaLabel = cleanLabel
              ? `${cleanLabel}: ${metric.value}`
              : String(metric.value ?? "");

            const metricContent = (
              <>
                {cleanLabel && <span className={styles.metricLabel}>{cleanLabel}</span>}
                <span className={`${styles.metricValue} ${toneClass}`} id={metric.id}>
                  {metric.value}
                </span>
                {metric.unit && <span className={styles.metricUnit}>{metric.unit}</span>}
                {metric.subtext && <span className={styles.metricSubtext}>{metric.subtext}</span>}
              </>
            );

            if (metric.onClick) {
              return (
                <li key={metric.id ?? idx} role="listitem">
                  <button
                    type="button"
                    className={`${styles.metricBtn} ${metric.active ? styles.metricBtnActive : ""}`}
                    onClick={metric.onClick}
                    data-testid={metric.testId}
                    aria-pressed={Boolean(metric.active)}
                    aria-label={metric.ariaLabel ?? defaultAriaLabel}
                  >
                    {metricContent}
                  </button>
                </li>
              );
            }

            return (
              <li
                key={metric.id ?? idx}
                className={styles.metricItem}
                data-testid={metric.testId}
                role="listitem"
                aria-label={metric.ariaLabel ?? defaultAriaLabel}
              >
                {metricContent}
              </li>
            );
          })}
        </ul>

        {actions && (
          <div className={styles.actionsArea} data-testid="ward-dynamic-island-actions">
            {actions}
          </div>
        )}

        {children}
      </div>
    </section>
  );
}

export default WardDynamicIsland;
