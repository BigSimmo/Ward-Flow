"use client";

import { BedDouble, MapPin, Network as NetworkIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardHead, Segmented, SrOnly, StatusGlyph, Switch, cx, durMinutes } from "@/components/wf";
import { designationSummary } from "@/components/ward-management/ward-bed-designation";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import type { HealthService, Unit } from "@/components/ward-management/ward-model";
import type { EdPressure } from "@/components/ward-management/ward-pressure";
import { healthServiceAcronym } from "@/components/ward-management/ward-service-scope";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  REFERENCE_DISTANCE_CAVEAT,
  referenceDistance,
} from "@/components/ward-management/reference/ward-reference-distances";
import { BedStrip, BedStripLegend } from "@/components/ward-management/wards/bed-strip";

import { occupiedPercent, readyGap, type NetworkUnitRow, type ServiceGroup } from "./network-overview-derivations";
import styles from "./network-overview.module.css";

/** "Adult open · 24 beds", from the bed counts rather than prose. */
function unitMeta(unit: Unit): string {
  const designation = designationSummary(unit);
  const security = designation === "All open" ? "open" : designation === "All locked" ? "secure" : "mixed";
  return `${unit.cohort} ${security} · ${unit.beds} beds`;
}

const SERVICE_SHORT: Partial<Record<HealthService, string>> = {
  "North Metro": "North",
  "East Metro": "East",
  "South Metro": "South",
};

function serviceShort(service: HealthService): string {
  return SERVICE_SHORT[service] ?? service;
}

/**
 * State bedflow (v6 Network mockup): each health service as a small table of its wards, with the
 * bed bar, Ready, Pulled and Expected today, under a header stating how many wait in that service's
 * EDs and how full it is. Pressing a ward selects it for the detail card beside.
 */
export function NetworkBedflow({
  groups,
  selectedUnitId,
  onSelectUnit,
}: {
  groups: readonly ServiceGroup[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
}) {
  const [scope, setScope] = useState<HealthService | "all">("all");
  const [readyOnly, setReadyOnly] = useState(false);
  const scopeItems = [
    { id: "all" as const, label: "All" },
    ...groups.map((group) => ({ id: group.service, label: serviceShort(group.service) })),
  ];
  const shown = groups
    .filter((group) => scope === "all" || group.service === scope)
    .map((group) => ({ ...group, rows: readyOnly ? group.rows.filter((row) => row.states.ready > 0) : group.rows }));
  const unitCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <Card as="section" className={styles.bedflow} aria-labelledby="ward-network-flow-heading">
      <CardHead
        icon={NetworkIcon}
        id="ward-network-flow-heading"
        title={
          <>
            State bedflow <span className={styles.countTag}>{unitCount} units</span>
          </>
        }
        action={
          <span className={styles.headControls}>
            <Segmented label="Health service" items={scopeItems} value={scope} onChange={setScope} />
            <Switch label="Ready only" checked={readyOnly} onCheckedChange={setReadyOnly} />
          </span>
        }
      />
      <div className={styles.serviceGrid}>
        {shown.map((group) => {
          const share = occupiedPercent(group.occupied, group.beds);
          return (
            <section key={group.service} className={styles.serviceBox} aria-label={group.service}>
              <header className={styles.serviceHead}>
                <h3 className={styles.serviceName}>
                  {group.service}{" "}
                  <span className={styles.serviceCount}>
                    {group.rows.length} {group.rows.length === 1 ? "ward" : "wards"}
                  </span>
                </h3>
                <span className={styles.serviceMeta}>
                  <b>{group.waiting}</b> in ED
                  {share === undefined ? null : (
                    <>
                      {" "}
                      · <b>{share}</b> occupied
                    </>
                  )}
                </span>
              </header>
              {group.rows.length === 0 ? (
                <p className={styles.empty}>No ward in {group.service} has a ready bed.</p>
              ) : (
                <table className={styles.unitGrid}>
                  <thead>
                    <tr>
                      <th scope="col">Unit</th>
                      <th scope="col">Beds</th>
                      <th scope="col" className={styles.num}>
                        <abbr title="Ready">Rdy</abbr>
                      </th>
                      <th scope="col" className={styles.num}>
                        <abbr title="Pulled">Pull</abbr>
                      </th>
                      <th scope="col" className={styles.num}>
                        <abbr title="Expected today">Exp</abbr>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const selected = row.unit.id === selectedUnitId;
                      return (
                        <tr key={row.unit.id} className={cx(selected && styles.rowSelected)}>
                          <td>
                            <button
                              type="button"
                              className={styles.unitButton}
                              aria-pressed={selected}
                              data-testid={`ward-network-bedflow-${row.unit.id}`}
                              onClick={() => onSelectUnit(row.unit.id)}
                            >
                              <span className={styles.unitName}>{row.unit.name}</span>
                              <span className={styles.unitMeta}>{unitMeta(row.unit)}</span>
                            </button>
                          </td>
                          <td className={styles.barCell}>
                            <BedStrip
                              bar
                              counts={{
                                ready: row.states.ready,
                                pulled: row.states.pulled,
                                closed: row.states.closed,
                                occupied: row.states.occupied,
                                pendingPreparation: row.pendingPreparation,
                              }}
                              wardName={row.unit.name}
                            />
                          </td>
                          <td className={cx(styles.num, styles.readyNum)}>{row.states.ready}</td>
                          <td className={cx(styles.num, styles.pulledNum)}>{row.states.pulled}</td>
                          <td className={styles.num}>+{row.expected}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
        <ReadyAgainstWaiting groups={groups} />
      </div>
      <footer className={styles.foot}>
        <BedStripLegend />
        <span className={styles.footNote}>Rdy ready · Pull pulled · Exp expected today</span>
        <span className={styles.footEnd}>Schematic, not geographic</span>
      </footer>
    </Card>
  );
}

/** Ready beds against people waiting in each service's EDs. Short is a warning glyph and a word. */
function ReadyAgainstWaiting({ groups }: { groups: readonly ServiceGroup[] }) {
  const scale = Math.max(1, ...groups.map((group) => Math.max(group.ready, group.waiting)));
  return (
    <section className={styles.versus} aria-labelledby="ward-network-versus-heading">
      <header className={styles.versusHead}>
        <h3 id="ward-network-versus-heading" className={styles.versusTitle}>
          Ready against waiting
        </h3>
        <span className={styles.versusKey} aria-hidden="true">
          <span className={styles.keyReady} /> Ready <span className={styles.keyWaiting} /> Waiting
        </span>
      </header>
      <ul className={styles.versusList}>
        {groups.map((group) => {
          const gap = readyGap(group);
          return (
            <li key={group.service} className={styles.versusRow}>
              <span className={styles.versusName}>{serviceShort(group.service)}</span>
              <span className={styles.versusTrack} aria-hidden="true">
                <span className={styles.versusWaiting} style={{ width: `${(group.waiting / scale) * 100}%` }} />
                <span className={styles.versusReady} style={{ width: `${(group.ready / scale) * 100}%` }} />
              </span>
              <span className={styles.versusFigure}>
                {group.ready}/{group.waiting}
                <SrOnly> ready against waiting</SrOnly>
              </span>
              <span className={styles.versusGap}>
                <StatusGlyph tone={gap < 0 ? "warning" : "success"} size={9} />
                {gap < 0 ? `Short ${-gap}` : gap === 0 ? "Exactly enough" : `Spare ${gap}`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Wards with a ready bed, ordered by recorded road time from the chosen ED. Only wards with a ready bed and a
 * measured route appear; the distance caveat is stated, never implied away.
 */
export function ReadyByRoadTime({
  ed,
  rows,
  selectedUnitId,
  onSelectUnit,
}: {
  ed: EdPressure["ed"] | undefined;
  rows: readonly NetworkUnitRow[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
}) {
  const ranked = useMemo(() => {
    if (ed === undefined) return [];
    return rows
      .filter((row) => row.states.ready > 0)
      .map((row) => ({
        row,
        route: referenceDistance(ed.referenceEdId, siteByCode(row.unit.siteCode)?.referenceSiteId),
      }))
      .flatMap((entry) => (entry.route === null ? [] : [{ row: entry.row, route: entry.route }]))
      .sort((a, b) => a.route.min - b.route.min)
      .slice(0, 5);
  }, [ed, rows]);

  return (
    <Card as="section" className={styles.nearest} aria-labelledby="ward-network-roadtime-heading">
      <CardHead
        icon={MapPin}
        id="ward-network-roadtime-heading"
        title="Ready beds by road time"
        aside={ed === undefined ? null : <span className={styles.fromTag}>from {ed.siteCode} ED</span>}
      />
      {ranked.length === 0 ? (
        <p className={styles.empty}>No ward with a ready bed has a measured route from this department.</p>
      ) : (
        <ol className={styles.nearestList}>
          {ranked.map(({ row, route }, index) => (
            <li key={row.unit.id}>
              <button
                type="button"
                className={cx(styles.nearestRow, row.unit.id === selectedUnitId && styles.rowSelected)}
                aria-pressed={row.unit.id === selectedUnitId}
                onClick={() => onSelectUnit(row.unit.id)}
              >
                <span className={styles.rank}>{index + 1}</span>
                <span className={styles.nearestText}>
                  <span className={styles.unitName}>{row.unit.name}</span>
                  <span className={styles.unitMeta}>
                    {row.states.ready} ready · {route.km} km
                  </span>
                </span>
                <span className={styles.drive}>
                  {route.min === 0 ? (
                    <span className={styles.driveTime}>On site</span>
                  ) : (
                    <>
                      <span className={styles.driveTime}>{durMinutes(route.min)}</span>
                      <span className={styles.unitMeta}>drive</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.caveat}>{REFERENCE_DISTANCE_CAVEAT}</p>
    </Card>
  );
}

/** The selected ward's figures. Bed-level tiles are not recorded in this prototype, so none are drawn. */
export function NetworkUnitDetail({ row, now }: { row: NetworkUnitRow | undefined; now: Instant }) {
  if (row === undefined) return null;
  const { unit, states } = row;
  return (
    <Card as="section" className={styles.detail} aria-labelledby="ward-network-unit-heading">
      <CardHead
        icon={BedDouble}
        id="ward-network-unit-heading"
        title={unit.name}
        aside={<span className={styles.unitMeta}>{unitMeta(unit)}</span>}
      />
      <dl className={styles.detailStats}>
        <div>
          <dt>Ready</dt>
          <dd>{states.ready}</dd>
        </div>
        <div>
          <dt>Pulled</dt>
          <dd>{states.pulled}</dd>
        </div>
        <div>
          <dt>Occupied</dt>
          <dd>{states.occupied}</dd>
        </div>
        <div>
          <dt>Expected today</dt>
          <dd>+{row.expected}</dd>
        </div>
      </dl>
      <p className={styles.detailNote}>
        {row.service === undefined ? null : <>{healthServiceAcronym(row.service) || row.service} · </>}
        Confirmed {formatInstantWithDay(unit.allocatable.confirmedAt, now)}
        {row.pendingPreparation > 0
          ? ` · ${row.pendingPreparation} of the ready beds ${row.pendingPreparation === 1 ? "is" : "are"} still being made ready`
          : ""}
      </p>
    </Card>
  );
}
