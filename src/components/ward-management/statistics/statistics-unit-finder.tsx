"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { CardFoot, Icon, Segmented, TextInput } from "@/components/wf";
import {
  communityStatisticsHref,
  edStatisticsHref,
  serviceStatisticsHref,
  wardStatisticsHref,
} from "@/components/ward-management/shell/ward-facade";

import { StatCard } from "./statistics-hero";
import {
  STATISTICS_COMMUNITY_CHOOSER_ID,
  STATISTICS_SERVICE_CHOOSER_ID,
  STATISTICS_UNIT_CHOOSER_HREF,
} from "./statistics-sections";
import styles from "./statistics-v6.module.css";

export type FinderKind = "ward" | "ed" | "service" | "team";

export type FinderEntry = { id: string; name: string; code?: string; meta?: ReactNode };

const NOUNS: Record<FinderKind, string> = { ward: "wards", ed: "departments", service: "services", team: "teams" };
const PLACEHOLDER: Record<FinderKind, string> = {
  ward: "Find a ward",
  ed: "Find a department",
  service: "Find a service",
  team: "Find a team",
};

function hrefFor(kind: FinderKind, id: string): string {
  if (kind === "ward") return wardStatisticsHref(id);
  if (kind === "ed") return edStatisticsHref(id);
  if (kind === "service") return serviceStatisticsHref(id);
  return communityStatisticsHref(id);
}

/** The service and team chooser anchors open the finder on their own tab. */
function kindFromHash(hash: string): FinderKind | null {
  if (hash === `#${STATISTICS_SERVICE_CHOOSER_ID}`) return "service";
  if (hash === `#${STATISTICS_COMMUNITY_CHOOSER_ID}`) return "team";
  return null;
}

/**
 * "Open a unit": one finder for every statistics page a unit has. The health-service and
 * community-team chooser anchors live here, and arriving at either opens its tab.
 */
export function StatisticsUnitFinder({ lists }: { lists: Record<FinderKind, FinderEntry[]> }) {
  const [kind, setKind] = useState<FinderKind>("ward");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const sync = () => {
      const fromHash = kindFromHash(window.location.hash);
      if (fromHash) setKind(fromHash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const entries = lists[kind];
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) => `${entry.name} ${entry.code ?? ""}`.toLowerCase().includes(needle));
  }, [entries, query]);

  return (
    <StatCard icon={Search} title="Open a unit" data-testid="ward-statistics-unit-finder">
      <span id={STATISTICS_SERVICE_CHOOSER_ID} className={styles.anchor} />
      <span id={STATISTICS_COMMUNITY_CHOOSER_ID} className={styles.anchor} />
      <div className={styles.toolbar}>
        <Segmented
          label="Unit kind"
          value={kind}
          onChange={(next) => {
            setKind(next);
            setQuery("");
          }}
          items={[
            { id: "ward", label: "Wards", count: lists.ward.length },
            { id: "ed", label: "EDs", count: lists.ed.length },
            { id: "service", label: "Services", count: lists.service.length },
            { id: "team", label: "Teams", count: lists.team.length },
          ]}
        />
        <TextInput
          type="search"
          icon={Search}
          boxClassName={styles.search}
          style={{ flex: "1 1 auto" }}
          aria-label={PLACEHOLDER[kind]}
          placeholder={PLACEHOLDER[kind]}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {shown.length === 0 ? (
        <p className={styles.empty}>No matching {NOUNS[kind]}</p>
      ) : (
        <ul
          className={styles.finderList}
          aria-label={NOUNS[kind]}
          data-testid={
            kind === "service"
              ? "ward-statistics-service-list"
              : kind === "team"
                ? "ward-statistics-community-list"
                : undefined
          }
        >
          {shown.map((entry) => (
            <li key={entry.id}>
              <Link
                href={hrefFor(kind, entry.id)}
                className={styles.finderLink}
                data-testid={
                  kind === "service"
                    ? `ward-statistics-service-link-${entry.id}`
                    : kind === "team"
                      ? `ward-statistics-community-link-${entry.id}`
                      : undefined
                }
              >
                <span className={styles.finderName}>
                  {entry.name}
                  {entry.code ? <span className={styles.code}>{entry.code}</span> : null}
                </span>
                <span className={styles.finderMeta}>{entry.meta}</span>
                <Icon icon={ChevronRight} size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <CardFoot
        meta={
          <>
            Showing {shown.length} of {entries.length}
          </>
        }
      >
        {kind === "ward" || kind === "ed" ? (
          <Link href={STATISTICS_UNIT_CHOOSER_HREF} className={styles.footLink}>
            Compare all
          </Link>
        ) : null}
      </CardFoot>
    </StatCard>
  );
}
