"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./statistics-third-edition.module.css";

export type StatisticsTabId = "overview" | "wards" | "emergency" | "community" | "referrals";

export type StatisticsTimeRange = "today" | "7d" | "30d";

interface StatisticsSubNavProps {
  activeTab?: StatisticsTabId;
  onTabChange?: (tab: StatisticsTabId) => void;
  timeRange?: StatisticsTimeRange;
  onTimeRangeChange?: (range: StatisticsTimeRange) => void;
  counts?: {
    wards?: number;
    emergency?: number;
    community?: number;
    referrals?: number;
  };
  isRouteNav?: boolean;
  showTimeRange?: boolean;
}

export function StatisticsSubNav({
  activeTab = "overview",
  onTabChange,
  timeRange = "today",
  onTimeRangeChange,
  counts = { wards: 23, emergency: 8, community: 16, referrals: 5 },
  isRouteNav = false,
  showTimeRange = false,
}: StatisticsSubNavProps) {
  const TABS: Array<{
    id: StatisticsTabId;
    label: string;
    badge?: number;
    href?: string;
    icon: ReactNode;
  }> = [
    {
      id: "overview",
      label: "Executive Overview",
      href: "/mockups/ward-flow/statistics/overview",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      ),
    },
    {
      id: "wards",
      label: "Ward & Bed Flow",
      badge: counts.wards,
      href: "/mockups/ward-flow/statistics/compare",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M2 13V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7M1 13h14M4 8h8M4 11h8" />
        </svg>
      ),
    },
    {
      id: "emergency",
      label: "Emergency Pressure",
      badge: counts.emergency,
      href: "/mockups/ward-flow/statistics/compare",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
      ),
    },
    {
      id: "community",
      label: "Community Teams",
      badge: counts.community,
      href: "/mockups/ward-flow/community",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M3 13V7l5-4 5 4v6H3zM6 13V9h4v4" />
        </svg>
      ),
    },
    {
      id: "referrals",
      label: "Referrals & Placement",
      badge: counts.referrals,
      href: "/mockups/ward-flow/referrals",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          <path d="M14 8H2M9 3l5 5-5 5" />
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.statsNavStrip} data-testid="ward-statistics-sub-nav">
      {/* Category Tabs Track */}
      <div className={styles.segTrack} role="tablist" aria-label="Statistics view categories">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          if (isRouteNav && tab.href) {
            return (
              <Link
                key={tab.id}
                href={tab.href}
                className={`${styles.segBtn} ${isActive ? styles.active : ""}`}
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span>{tab.label}</span>
                {typeof tab.badge === "number" && (
                  <span className={styles.monoBadge} id={`tabBadge-${tab.id}`}>
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.segBtn} ${isActive ? styles.active : ""}`}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`view-${tab.id}`}
              onClick={() => onTabChange?.(tab.id)}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && (
                <span className={styles.monoBadge} id={`tabBadge-${tab.id}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Timeframe Switcher Track */}
      {showTimeRange && (
        <div
          className={`${styles.timeWindowTrack} ${styles.segTrack}`}
          role="radiogroup"
          aria-label="Reporting Time Window"
        >
          {(
            [
              { id: "today", label: "Today (Live)" },
              { id: "7d", label: "Last 7 Days" },
              { id: "30d", label: "Last 30 Days" },
            ] as const
          ).map((range) => {
            const isActive = timeRange === range.id;
            return (
              <button
                key={range.id}
                type="button"
                className={`${styles.segBtn} ${isActive ? styles.active : ""}`}
                role="radio"
                aria-checked={isActive}
                id={`btn-range-${range.id}`}
                data-range={range.id}
                onClick={() => onTimeRangeChange?.(range.id)}
              >
                {range.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
