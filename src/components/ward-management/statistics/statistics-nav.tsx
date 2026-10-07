"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_SERVICE_CHOOSER_HREF,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
} from "./statistics-sections";
import { useStatisticsSamples, setStatisticsSamples } from "./statistics-samples";
import styles from "./statistics-nav.module.css";

export type StatisticsNavSection = "hub" | "overview" | "compare" | "service" | "ward" | "ed" | "community";

interface StatisticsNavProps {
  currentSection?: StatisticsNavSection;
  activeSlug?: string;
}

export function StatisticsNav({ currentSection, activeSlug }: StatisticsNavProps) {
  const samples = useStatisticsSamples();
  const pathname = usePathname() || "";
  const router = useRouter();
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('[data-testid="ward-bar"]');
    if (!bar || !navRef.current) return;
    const nav = navRef.current;
    const updateOffset = () => {
      const barHeight = bar.getBoundingClientRect().height;
      nav.style.setProperty("--statistics-header-offset", `${barHeight}px`);
      // Account for both rows when links wrap, and avoid counting the shell's scroll padding twice.
      const shell = nav.closest<HTMLElement>('[class*="shellContent"]');
      const scroller = shell && getComputedStyle(shell).overflowY === "auto" ? shell : document.scrollingElement;
      const shellScrollPadding = scroller ? parseFloat(getComputedStyle(scroller).scrollPaddingTop) || 0 : 0;
      nav.parentElement?.style.setProperty(
        "--statistics-anchor-offset",
        `${barHeight + nav.getBoundingClientRect().height - shellScrollPadding + 12}px`,
      );
    };
    updateOffset();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateOffset);
    observer.observe(bar);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);

  // Auto-detect section if not provided explicitly
  const activeSection =
    currentSection ||
    (pathname.includes("/statistics/overview")
      ? "overview"
      : pathname.includes("/statistics/compare")
        ? "compare"
        : pathname.includes("/statistics/service")
          ? "service"
          : pathname.includes("/statistics/ward")
            ? "ward"
            : pathname.includes("/statistics/ed")
              ? "ed"
              : pathname.includes("/statistics/community")
                ? "community"
                : "hub");

  // Extract active slug from pathname if present
  let extractedSlug = activeSlug;
  if (!extractedSlug) {
    if (pathname.includes("/statistics/service/")) {
      extractedSlug = pathname.split("/statistics/service/")[1]?.split("/")[0]?.split("?")[0];
    } else if (pathname.includes("/statistics/ward/")) {
      extractedSlug = pathname.split("/statistics/ward/")[1]?.split("/")[0]?.split("?")[0];
    } else if (pathname.includes("/statistics/ed/")) {
      extractedSlug = pathname.split("/statistics/ed/")[1]?.split("/")[0]?.split("?")[0];
    } else if (pathname.includes("/statistics/community/")) {
      extractedSlug = pathname.split("/statistics/community/")[1]?.split("/")[0]?.split("?")[0];
    }
  }

  const serviceHref =
    activeSection === "service" && extractedSlug
      ? `/mockups/ward-flow/statistics/service/${extractedSlug}`
      : STATISTICS_SERVICE_CHOOSER_HREF;

  const wardHref =
    activeSection === "ward" && extractedSlug
      ? `/mockups/ward-flow/statistics/ward/${extractedSlug}`
      : STATISTICS_UNIT_CHOOSER_HREF;

  const edHref =
    activeSection === "ed" && extractedSlug
      ? `/mockups/ward-flow/statistics/ed/${extractedSlug}`
      : STATISTICS_COMPARE_HREF;

  const communityHref =
    activeSection === "community" && extractedSlug
      ? `/mockups/ward-flow/statistics/community/${extractedSlug}`
      : STATISTICS_COMMUNITY_CHOOSER_HREF;

  const NAV_ITEMS = [
    {
      id: "hub",
      label: "Summary",
      href: "/mockups/ward-flow/statistics",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
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
      id: "overview",
      label: "Network overview",
      href: "/mockups/ward-flow/statistics/overview",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M2 8h12M8 2a10 10 0 0 1 0 12 10 10 0 0 1 0-12" />
        </svg>
      ),
    },
    {
      id: "compare",
      label: "Compare",
      href: "/mockups/ward-flow/statistics/compare",
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M3 13V9M8 13V4M13 13V7" />
        </svg>
      ),
    },
    {
      id: "service",
      label: "Health services",
      href: serviceHref,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M2 14V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v11M6 6h4M8 4v4" />
        </svg>
      ),
    },
    {
      id: "ward",
      label: "Wards",
      href: wardHref,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M2 13V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6M1 13h14M3 9h10" />
        </svg>
      ),
    },
    {
      id: "ed",
      label: "Emergency departments",
      href: edHref,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
      ),
    },
    {
      id: "community",
      label: "Community teams",
      href: communityHref,
      icon: (
        <svg
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M3 13V7l5-4 5 4v6H3zM6 13V9h4v4" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      ref={navRef}
      className={styles.navBar}
      aria-label="Ward Flow statistics sections"
      data-testid="ward-statistics-nav"
    >
      <label className={styles.mobileSelect}>
        <span>Statistics</span>
        <select
          aria-label="Statistics section"
          value={activeSection}
          onChange={(event) => {
            const item = NAV_ITEMS.find((item) => item.id === event.target.value);
            if (item) router.push(item.href);
          }}
        >
          {NAV_ITEMS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.scrollTrack}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.navItemActive : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {isActive && <span className={styles.activePillIndicator} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={samples}
        aria-label="Sample statistics"
        className={styles.sampleSwitch}
        onClick={() => setStatisticsSamples(!samples)}
      >
        <span>Samples</span>
        <span className={styles.switchTrack} aria-hidden="true">
          <span />
        </span>
        <span className={styles.switchState}>{samples ? "On" : "Off"}</span>
      </button>
    </nav>
  );
}
