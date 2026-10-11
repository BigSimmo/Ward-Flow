"use client";

import { wardScrollBehavior } from "@/lib/ward-scroll";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Instant } from "@/components/ward-management/ward-clock";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import type { Unit } from "@/components/ward-management/ward-model";
import { getHealthServiceDotStyle } from "@/components/ward-management/ward-service-colors";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { BedStrip } from "@/components/ward-management/wards/bed-strip";
import { FilterChip, PhoneSheet, SrOnly, StatusGlyph, durMinutes } from "@/components/wf";
import { networkServiceGroupTotals, type NetworkServiceGroup, type NetworkWardRow } from "./capacity-derivations";
import styles from "./capacity.module.css";

export interface CapacityPhoneFilter {
  id: string;
  label: string;
  predicate: (row: NetworkWardRow) => boolean;
}

/** "Adult secure", "Adult open", "Adult secure and open", or the cohort for the other wards. */
function wardKind(unit: Unit): string {
  if (unit.cohort !== "Adult") return unit.cohort;
  const locked = unit.lockedBeds > 0;
  const open = unit.beds - unit.lockedBeds > 0;
  if (locked && open) return "Adult secure and open";
  return locked ? "Adult secure" : "Adult open";
}

function shortService(service: string): string {
  return service.replace(/ Metro$/, "");
}

function stripCounts(row: NetworkWardRow) {
  return {
    ready: row.ready,
    pulled: row.pulled,
    closed: row.closed,
    occupied: row.occupied,
    pendingPreparation: row.pendingPreparation,
  };
}

/**
 * Phone (v10) Wards tab on Capacity: region chips that jump to a region, highlight chips, then one
 * list of wards grouped by health service. A chip highlights or scrolls; it never hides a ward (the
 * owner's capacity ruling). A ward opens as a bottom sheet with its figures and two actions.
 */
export function CapacityPhoneWards({
  groups,
  filters,
  activeFilterId,
  onFilter,
  now,
  isFresh,
}: {
  groups: NetworkServiceGroup[];
  filters: CapacityPhoneFilter[];
  activeFilterId: string;
  onFilter: (id: string) => void;
  now: Instant;
  isFresh: (unit: Unit) => boolean;
}) {
  const { dispatch } = useWardFlow();
  const router = useRouter();
  const [region, setRegion] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = groups.filter((group) => group.wards.length > 0);
  const active = filters.find((filter) => filter.id === activeFilterId);
  const highlighting = active !== undefined && active.id !== "all";
  const open = shown.flatMap((group) => group.wards).find((row) => row.unit.id === openId);

  function jump(id: string) {
    setRegion(id);
    const target = document.getElementById(id === "all" ? "capacity-phone-wards" : `capacity-phone-region-${id}`);
    target?.scrollIntoView({ block: "start", behavior: wardScrollBehavior() });
  }

  const highlightChips = filters.filter((filter) => filter.id !== "all" && filter.id !== "open-ready");

  return (
    <section id="capacity-phone-wards" className={styles.phoneWards} aria-label="Wards">
      <div className={styles.phoneChipRow} role="group" aria-label="Go to a region">
        <FilterChip pressed={region === "all"} onPressedChange={() => jump("all")}>
          All
        </FilterChip>
        {shown.map((group) => (
          <FilterChip
            key={group.service}
            pressed={region === group.service}
            onPressedChange={() => jump(group.service)}
          >
            {shortService(group.service)}
          </FilterChip>
        ))}
      </div>
      <div className={styles.phoneChipRow} role="group" aria-label="Highlight wards">
        {highlightChips.map((filter) => (
          <FilterChip
            key={filter.id}
            pressed={activeFilterId === filter.id}
            onPressedChange={(pressed) => onFilter(pressed ? filter.id : "all")}
          >
            {filter.id === "ready" ? "Ready beds" : filter.id === "locked-ready" ? "Locked ready" : "Unconfirmed"}
          </FilterChip>
        ))}
      </div>

      <div className={styles.phoneWardList}>
        {shown.map((group) => {
          const totals = networkServiceGroupTotals(group.wards);
          const beds = group.wards.reduce((sum, row) => sum + row.unit.beds, 0);
          const occupancy = beds > 0 ? ((totals.occupied / beds) * 100).toFixed(1) : "0.0";
          return (
            <div key={group.service} id={`capacity-phone-region-${group.service}`} className={styles.phoneRegion}>
              <h3 className={styles.phoneRegionHead}>
                <span
                  className={styles.phoneRegionDot}
                  style={getHealthServiceDotStyle(group.service)}
                  aria-hidden="true"
                />
                <span className={styles.phoneRegionName}>{group.service}</span>
                <span className={styles.phoneRegionFigures}>
                  <b>{totals.ready}</b> ready · {occupancy}%
                </span>
              </h3>
              <ul className={styles.phoneWardRows}>
                {group.wards.map((row) => {
                  const fresh = isFresh(row.unit);
                  const lit = !highlighting || (active?.predicate(row) ?? true);
                  return (
                    <li key={row.unit.id} data-dim={lit ? undefined : "true"}>
                      <button
                        type="button"
                        className={styles.phoneWardRow}
                        aria-haspopup="dialog"
                        onClick={() => setOpenId(row.unit.id)}
                      >
                        <span className={styles.phoneWardText}>
                          <span className={styles.phoneWardName}>{row.unit.name}</span>
                          <span className={styles.phoneWardSub}>
                            {fresh ? null : (
                              <>
                                <StatusGlyph tone="warning" size={8} />
                                <span>{durMinutes(Math.max(0, now - row.confirmedAt))} since confirmed · </span>
                              </>
                            )}
                            {wardKind(row.unit)} · {row.unit.beds} beds
                          </span>
                          <BedStrip
                            counts={stripCounts(row)}
                            wardName={row.unit.name}
                            className={styles.phoneWardStrip}
                          />
                        </span>
                        <span className={styles.phoneWardReady}>
                          <b>{row.ready}</b>
                          <span>{row.lockedReady > 0 ? `ready · ${row.lockedReady} locked` : "ready"}</span>
                        </span>
                        {highlighting && lit ? <SrOnly>, matches {active?.label}</SrOnly> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <PhoneSheet
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        title={open?.unit.name ?? "Ward"}
        description={
          open
            ? [siteByCode(open.unit.siteCode)?.service, wardKind(open.unit), `${open.unit.beds} beds`]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        secondary={
          open
            ? {
                label: "Ask for an update",
                onAction: () =>
                  dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: open.unit.id }),
              }
            : undefined
        }
        primary={
          open
            ? {
                label: "Open ward page",
                onAction: () => router.push(unitHref(open.unit.id)),
              }
            : undefined
        }
        data-testid="capacity-phone-ward-sheet"
      >
        {open ? (
          <div className={styles.phoneWardSheet}>
            <dl className={styles.phoneWardFacts}>
              <div>
                <dt>Ready</dt>
                <dd>
                  {open.ready > 0 ? <StatusGlyph tone="success" size={9} /> : null}
                  {open.ready}
                </dd>
              </div>
              <div>
                <dt>Locked ready</dt>
                <dd>{open.lockedReady}</dd>
              </div>
              <div>
                <dt>Pulled</dt>
                <dd>{open.pulled}</dd>
              </div>
              <div>
                <dt>Due out today</dt>
                <dd>{open.dischargesDueToday ?? "Not tracked"}</dd>
              </div>
            </dl>
            <BedStrip counts={stripCounts(open)} wardName={open.unit.name} />
            <p className={styles.phoneWardConfirmed}>
              <StatusGlyph tone={isFresh(open.unit) ? "success" : "warning"} size={9} />
              <span>
                <b>{durMinutes(Math.max(0, now - open.confirmedAt))}</b> since confirmed
                {isFresh(open.unit) ? "" : ", stale"}
              </span>
            </p>
            <dl className={styles.phoneWardKv}>
              <dt>Occupied</dt>
              <dd>
                {open.occupied} of {open.unit.beds}
              </dd>
              <dt>Closed</dt>
              <dd>{open.closed}</dd>
              <dt>Involuntary</dt>
              <dd>{open.unit.authorised ? "Authorised hospital" : "Not authorised"}</dd>
              <dt>Site</dt>
              <dd>{siteByCode(open.unit.siteCode)?.name ?? open.unit.siteCode}</dd>
            </dl>
          </div>
        ) : null}
      </PhoneSheet>
    </section>
  );
}
