"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  STATISTICS_COMPARE_HREF,
  STATISTICS_UNIT_CHOOSER_HREF,
  STATISTICS_SERVICE_CHOOSER_HREF,
  STATISTICS_COMMUNITY_CHOOSER_HREF,
} from "./statistics-sections";
import styles from "./statistics-nav.module.css";

export type StatisticsNavSection =
  | "hub"
  | "overview"
  | "compare"
  | "service"
  | "ward"
  | "ed"
  | "community";

interface StatisticsNavProps {
  currentSection?: StatisticsNavSection;
  activeSlug?: string;
}

export function StatisticsNav({ currentSection, activeSlug }: StatisticsNavProps) {
  const pathname = usePathname() || "";
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Initial sync from localStorage to DOM
    try {
      const saved = localStorage.getItem("ward-flow-statistics-appearance") ||
                    localStorage.getItem("ward-flow-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.setAttribute("data-theme", saved);
      }
    } catch {
      // safe fallback
    }

    // Subscribe to DOM data-theme changes to update local button state asynchronously
    const syncFromDom = () => {
      const current = document.documentElement.getAttribute("data-theme");
      if (current === "light" || current === "dark") {
        setTheme((prev) => (prev !== current ? current : prev));
      }
    };

    const observer = new MutationObserver(syncFromDom);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    syncFromDom();

    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ward-flow-statistics-appearance", next);
      localStorage.setItem("ward-flow-theme", next);
    } catch {
      // safe fallback
    }
  };

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
      : "/mockups/ward-flow/statistics/service/north-metro";

  const wardHref =
    activeSection === "ward" && extractedSlug
      ? `/mockups/ward-flow/statistics/ward/${extractedSlug}`
      : "/mockups/ward-flow/statistics/ward/scgh-adult-open";

  const edHref =
    activeSection === "ed" && extractedSlug
      ? `/mockups/ward-flow/statistics/ed/${extractedSlug}`
      : "/mockups/ward-flow/statistics/ed/rph";

  const communityHref =
    activeSection === "community" && extractedSlug
      ? `/mockups/ward-flow/statistics/community/${extractedSlug}`
      : "/mockups/ward-flow/statistics/community/armadale";

  const NAV_ITEMS = [
    {
      id: "hub",
      num: "1",
      label: "Hub Overview",
      href: "/mockups/ward-flow/statistics",
    },
    {
      id: "overview",
      num: "2",
      label: "Statewide Flow",
      href: "/mockups/ward-flow/statistics/overview",
    },
    {
      id: "service",
      num: "3",
      label: "By Service",
      href: serviceHref,
    },
    {
      id: "ward",
      num: "4",
      label: "By Ward",
      href: wardHref,
    },
    {
      id: "ed",
      num: "5",
      label: "Emergency Dept",
      href: edHref,
    },
    {
      id: "community",
      num: "6",
      label: "Community Teams",
      href: communityHref,
    },
    {
      id: "compare",
      num: "7",
      label: "Ward Comparisons",
      href: "/mockups/ward-flow/statistics/compare",
    },
  ];

  return (
    <nav className={styles.navBar} aria-label="Ward Flow statistics sections" data-testid="ward-statistics-nav">
      <Link href="/mockups/ward-flow/statistics" className={styles.brandGroup}>
        <span className={styles.beacon} aria-hidden="true" />
        <span className={styles.brandTitle}>
          Ward Flow
          <span className={styles.suiteBadge}>STATISTICS SUITE</span>
        </span>
      </Link>

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
              <span className={styles.navPillNum}>{item.num}</span>
              <span className={styles.navLabel}>{item.label}</span>
              {isActive && <span className={styles.activePillIndicator} aria-hidden="true" />}
            </Link>
          );
        })}
      </div>

      <div className={styles.actionsGroup}>
        <button
          type="button"
          className={styles.themeBtn}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <Link href="/mockups/ward-flow/statistics" className={styles.portalLink}>
          Portal ↗
        </Link>
      </div>
    </nav>
  );
}
