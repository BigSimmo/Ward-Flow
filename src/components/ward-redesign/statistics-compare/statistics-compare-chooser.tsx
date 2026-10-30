"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";

import { Icon, Segmented, TextInput } from "@/components/wf";
import { STATISTICS_UNIT_CHOOSER_ID } from "@/components/ward-management/statistics/statistics-sections";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { StatCard } from "@/components/ward-management/statistics/statistics-hero";
import styles from "@/components/ward-management/statistics/statistics-v6.module.css";

import compare from "./statistics-compare-redesign.module.css";
import type { ComparisonDepartment, ComparisonUnit } from "./statistics-compare-redesign";

/* Moved out of the Compare fork to keep it under the file cap. */
type ChooserKind = "ward" | "ed";

/** "Open a unit": public places, linking only to detail pages the current desk may open. */
export function UnitChooser({
  units,
  emergencyDepartments,
}: {
  units: ComparisonUnit[];
  emergencyDepartments: ComparisonDepartment[];
}) {
  const [kind, setKind] = useState<ChooserKind>("ward");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (name: string, code: string) => !needle || `${name} ${code}`.toLowerCase().includes(needle);

  const unitLink = (id: string, name: string, siteCode: string, href: string | null) => {
    const site = siteByCode(siteCode);
    return (
      <li key={id} hidden={!matches(name, siteCode) || undefined}>
        {href ? (
          <Link href={href} className={compare.chooserLink}>
            <span className={compare.rowNameText}>{name}</span>
            <span className={site ? styles.code : compare.noSite}>{site ? siteCode : "matches no site"}</span>
            <Icon icon={ChevronRight} size={14} />
          </Link>
        ) : (
          <span className={compare.chooserLink}>
            <span className={compare.rowNameText}>{name}</span>
            <span className={site ? styles.code : compare.noSite}>{site ? siteCode : "matches no site"}</span>
          </span>
        )}
      </li>
    );
  };

  return (
    <div id={STATISTICS_UNIT_CHOOSER_ID} className={compare.chooserAnchor} tabIndex={-1}>
      <StatCard
        icon={Search}
        title="Open a unit"
        data-testid="ward-statistics-compare-chooser"
        aside={<span className={compare.footNote}>{units.length + emergencyDepartments.length} units</span>}
      >
        <div className={styles.toolbar}>
          <Segmented
            label="Unit kind"
            value={kind}
            onChange={setKind}
            items={[
              { id: "ward", label: "Wards", count: units.length },
              { id: "ed", label: "EDs", count: emergencyDepartments.length },
            ]}
          />
          <TextInput
            type="search"
            icon={Search}
            boxClassName={compare.chooserSearch}
            aria-label="Find a ward or ED"
            placeholder="Find a ward or ED"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div hidden={kind !== "ward"}>
          {units.length === 0 ? (
            <p className={styles.empty} data-testid="ward-statistics-compare-no-wards">
              No ward is recorded in this prototype, so there is none to choose.
            </p>
          ) : (
            <ul className={compare.chooserGrid} aria-label="Wards" data-testid="ward-statistics-compare-ward-list">
              {units.map((unit) => unitLink(unit.id, unit.name, unit.siteCode, wardStatisticsHref(unit.id)))}
            </ul>
          )}
        </div>
        <div hidden={kind !== "ed"}>
          {emergencyDepartments.length === 0 ? (
            <p className={styles.empty} data-testid="ward-statistics-compare-no-eds">
              No emergency department is recorded in this prototype, so there is none to choose.
            </p>
          ) : (
            <ul
              className={compare.chooserGrid}
              aria-label="Emergency departments"
              data-testid="ward-statistics-compare-ed-list"
            >
              {emergencyDepartments.map((department) =>
                unitLink(
                  department.id,
                  department.name,
                  department.siteCode,
                  department.openable === false ? null : edStatisticsHref(department.id),
                ),
              )}
            </ul>
          )}
        </div>
      </StatCard>
    </div>
  );
}
