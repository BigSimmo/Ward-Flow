"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { communityStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { STATISTICS_COMPARE_HREF, STATISTICS_HOME_HREF, STATISTICS_OVERVIEW_HREF } from "./statistics-sections";
import styles from "./statistics-nav.module.css";

export type StatisticsNavSection = "hub" | "overview" | "service" | "ward" | "ed" | "community" | "compare";

interface StatisticsNavProps {
  currentSection?: StatisticsNavSection;
  activeSlug?: string;
}

export function StatisticsNav({ currentSection, activeSlug }: StatisticsNavProps) {
  const pathname = usePathname() || "";
  const router = useRouter();

  // Auto-detect section if not provided explicitly
  const activeSection: StatisticsNavSection =
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
      : "/mockups/ward-flow/statistics/service/North%20Metro";

  const wardHref =
    activeSection === "ward" && extractedSlug
      ? `/mockups/ward-flow/statistics/ward/${extractedSlug}`
      : "/mockups/ward-flow/statistics/ward/bty-adult-secure";

  const edHref =
    activeSection === "ed" && extractedSlug
      ? `/mockups/ward-flow/statistics/ed/${extractedSlug}`
      : "/mockups/ward-flow/statistics/ed/rph-ed";

  const defaultCommunitySlug = COMMUNITY_TEAM_PAGES[0]?.id || "albany";
  const communityHref =
    activeSection === "community" && extractedSlug
      ? `/mockups/ward-flow/statistics/community/${extractedSlug}`
      : communityStatisticsHref(defaultCommunitySlug);

  const NAV_ITEMS = [
    {
      id: "hub",
      num: "1",
      label: "Executive Hub",
      href: STATISTICS_HOME_HREF,
    },
    {
      id: "overview",
      num: "2",
      label: "Statewide Flow",
      href: STATISTICS_OVERVIEW_HREF,
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
      href: STATISTICS_COMPARE_HREF,
    },
  ];

  // Theme synchronization
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    try {
      const root = document.documentElement;
      const attr = root.getAttribute("data-ward-theme") || root.getAttribute("data-theme");
      if (attr === "dark" || attr === "light") return attr;
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
    } catch {
      // Ignore during SSR
    }
    return "light";
  });

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    try {
      const observer = new MutationObserver(() => {
        const root = document.documentElement;
        const attr = root.getAttribute("data-ward-theme") || root.getAttribute("data-theme");
        if (attr === "dark" || attr === "light") {
          setTheme(attr);
        }
      });
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme", "data-ward-theme"],
      });
      cleanup = () => observer.disconnect();
    } catch {
      // Ignore during SSR
    }
    return () => {
      cleanup?.();
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      document.documentElement.setAttribute("data-theme", next);
      document.documentElement.setAttribute("data-ward-theme", next);
      localStorage.setItem("ward-flow-statistics-appearance", next);
      localStorage.setItem("ward-flow-theme", next);
    } catch {
      // Ignore in strict environments
    }
  };

  // Keyboard navigation shortcuts (Alt+1 through Alt+7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key >= "1" && e.key <= "7") {
        const index = parseInt(e.key, 10) - 1;
        if (NAV_ITEMS[index]) {
          e.preventDefault();
          router.push(NAV_ITEMS[index].href);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, NAV_ITEMS]);

  return (
    <nav className={styles.navBar} aria-label="Ward Flow statistics suite" data-testid="ward-statistics-nav">
      <Link href={STATISTICS_HOME_HREF} className={styles.suiteNavBrand} title="Ward Flow Statistics Suite">
        <span className={styles.suiteNavBeacon} aria-hidden="true" />
        <span className={styles.suiteNavTitle}>STATISTICS SUITE</span>
        <span className={styles.suiteNavBadge}>MOCKUP · SYNTHETIC</span>
      </Link>

      <div className={styles.scrollTrack} role="tablist" aria-label="Statistics navigation tabs">
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
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className={styles.suiteNavActions}>
        <button
          type="button"
          className={styles.suiteThemeBtn}
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>

        <Link href="/mockups/ward-flow" className={styles.suitePortalLink} title="Exit to Command">
          <span>Command</span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </nav>
  );
}
