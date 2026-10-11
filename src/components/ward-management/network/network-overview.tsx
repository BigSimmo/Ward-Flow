"use client";

import { BedDouble, ChevronRight, MapPin, Network as NetworkIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { unitHref } from "@/components/ward-management/shell/ward-facade";

import {
  Button,
  Card,
  CardHead,
  FilterChip,
  PhoneSheet,
  Segmented,
  SrOnly,
  StatusGlyph,
  Switch,
  cx,
  durMinutes,
  useIsPhone,
} from "@/components/wf";
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

/** A hero figure pressed to highlight the bed flow (v10 Network). Units has no highlight. */
export type NetworkHighlight = "waiting" | "ready" | "pulled" | "expected";

const HIGHLIGHT_WORDS: Record<NetworkHighlight, string> = {
  waiting: "in a service with people waiting in ED",
  ready: "with a ready bed",
  pulled: "with a pulled bed",
  expected: "expecting a bed today",
};

/** Whether a unit row matches a hero highlight. Waiting is a service figure, so it reads the group. */
function matchesHighlight(highlight: NetworkHighlight, row: NetworkUnitRow, group: ServiceGroup): boolean {
  if (highlight === "waiting") return group.waiting > 0;
  if (highlight === "ready") return row.states.ready > 0;
  if (highlight === "pulled") return row.states.pulled > 0;
  return row.expected > 0;
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
  highlight,
  onClearHighlight,
  scope: scopeProp,
  onScopeChange,
}: {
  groups: readonly ServiceGroup[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  /**
   * The hero figure pressed (v10 Network): matching cells mark and every other row dims by colour.
   * Nothing is hidden.
   */
  highlight?: NetworkHighlight;
  onClearHighlight?: () => void;
  /**
   * Optional controlled service scope. Phone (v10 Network) lets a "Ready against waiting" row
   * outside this card scope the beds; without these props the card keeps its own scope.
   */
  scope?: HealthService | "all";
  onScopeChange?: (scope: HealthService | "all") => void;
}) {
  const isPhone = useIsPhone();
  const [ownScope, setOwnScope] = useState<HealthService | "all">("all");
  const scope = scopeProp ?? ownScope;
  const setScope = (next: HealthService | "all") => {
    setOwnScope(next);
    onScopeChange?.(next);
  };
  const [readyOnly, setReadyOnly] = useState(false);
  const scopeItems = [
    { id: "all" as const, label: "All" },
    ...groups.map((group) => ({ id: group.service, label: serviceShort(group.service) })),
  ];
  // Ready only highlights and dims, it never hides (v10: filters highlight and dim).
  const shown = groups.filter((group) => scope === "all" || group.service === scope);
  const unitCount = groups.reduce((sum, group) => sum + group.rows.length, 0);
  const shownCount = shown.reduce((sum, group) => sum + group.rows.length, 0);
  const highlightedCount = highlight
    ? shown.reduce((sum, group) => sum + group.rows.filter((row) => matchesHighlight(highlight, row, group)).length, 0)
    : 0;
  const readyCount = shown.reduce((sum, group) => sum + group.rows.filter((row) => row.states.ready > 0).length, 0);

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
          isPhone ? (
            <Switch label="Ready only" checked={readyOnly} onCheckedChange={setReadyOnly} />
          ) : (
            <span className={styles.headControls}>
              <Segmented label="Health service" items={scopeItems} value={scope} onChange={setScope} />
              <Switch label="Ready only" checked={readyOnly} onCheckedChange={setReadyOnly} />
            </span>
          )
        }
      />
      {isPhone ? (
        // Phone (v10 Network): the services as a scrolling chip row, 44px high, none cut off.
        <div className={styles.scopeChips} role="group" aria-label="Health service">
          {scopeItems.map((item) => (
            <FilterChip
              key={item.id}
              pressed={scope === item.id}
              onPressedChange={() => setScope(item.id)}
              className={styles.scopeChip}
            >
              {item.label}
            </FilterChip>
          ))}
        </div>
      ) : null}
      {highlight ? (
        <p className={styles.highlightNote} data-testid="ward-network-highlight-note">
          <span>
            <b>{highlightedCount}</b> of {shownCount} units {HIGHLIGHT_WORDS[highlight]}, all rows stay
          </span>
          {onClearHighlight ? (
            <Button variant="ghost" size="sm" onClick={onClearHighlight}>
              Clear
            </Button>
          ) : null}
        </p>
      ) : null}
      {readyOnly && !highlight ? (
        <p className={styles.highlightNote} data-testid="ward-network-ready-only-note">
          <span>
            <b>{readyCount}</b> of {shownCount} units with a ready bed, all rows stay
          </span>
        </p>
      ) : null}
      <div className={styles.serviceGrid}>
        {shown.map((group) => {
          const share = occupiedPercent(group.occupied, group.beds);
          return (
            <section key={group.service} className={styles.serviceBox} aria-label={group.service}>
              {isPhone ? (
                <header className={styles.phoneServiceHead}>
                  <h3 className={styles.phoneServiceName}>
                    <span
                      className={styles.phoneServiceDot}
                      data-service={SERVICE_DOT[group.service] ?? "other"}
                      aria-hidden="true"
                    />
                    {group.service}
                  </h3>
                  <span className={styles.phoneServiceReady}>
                    <b>{group.ready}</b> ready
                  </span>
                </header>
              ) : (
                <header className={styles.serviceHead}>
                  <h3 className={styles.serviceName}>
                    {group.service}{" "}
                    <span className={styles.serviceCount}>
                      {group.rows.length} {group.rows.length === 1 ? "ward" : "wards"}
                    </span>
                  </h3>
                  <span
                    className={styles.serviceMeta}
                    data-hl={highlight === "waiting" && group.waiting > 0 ? "true" : undefined}
                  >
                    <b>{group.waiting}</b> in ED
                    {share === undefined ? null : (
                      <>
                        {" "}
                        · <b>{share}</b> occupied
                      </>
                    )}
                  </span>
                </header>
              )}
              {group.rows.length === 0 ? (
                <p className={styles.empty}>No ward in {group.service} has a ready bed.</p>
              ) : isPhone ? (
                // Phone (v10 Network): each ward as a row, name and bed bar left, ready and pulled right.
                <ul className={styles.phoneUnits}>
                  {group.rows.map((row) => {
                    const selected = row.unit.id === selectedUnitId;
                    const match = highlight ? matchesHighlight(highlight, row, group) : false;
                    const readyMatch = row.states.ready > 0;
                    const dim = highlight ? !match : readyOnly && !readyMatch;
                    return (
                      <li key={row.unit.id} data-dim={dim ? "true" : undefined}>
                        <button
                          type="button"
                          className={cx(styles.phoneUnit, selected && styles.rowSelected)}
                          aria-pressed={selected}
                          data-testid={`ward-network-bedflow-${row.unit.id}`}
                          onClick={() => onSelectUnit(row.unit.id)}
                        >
                          <span className={styles.phoneUnitMain}>
                            <span className={styles.unitName}>{row.unit.name}</span>
                            <span className={styles.unitMeta}>{unitMeta(row.unit)}</span>
                            <BedStrip
                              thin
                              className={styles.phoneUnitStrip}
                              counts={{
                                ready: row.states.ready,
                                pulled: row.states.pulled,
                                closed: row.states.closed,
                                occupied: row.states.occupied,
                                pendingPreparation: row.pendingPreparation,
                              }}
                              wardName={row.unit.name}
                            />
                          </span>
                          <span className={styles.phoneUnitSide}>
                            <span className={styles.phoneUnitReady}>
                              <b>{row.states.ready}</b> ready
                            </span>
                            <span className={styles.phoneUnitPulled}>
                              {row.states.pulled} pulled
                              {row.expected > 0 ? ` · +${row.expected}` : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
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
                      const match = highlight ? matchesHighlight(highlight, row, group) : false;
                      const readyMatch = row.states.ready > 0;
                      const mark = (kind: NetworkHighlight) =>
                        (highlight === kind && match) || (kind === "ready" && readyOnly && !highlight && readyMatch)
                          ? "true"
                          : undefined;
                      const dim = highlight ? !match : readyOnly && !readyMatch;
                      return (
                        <tr
                          key={row.unit.id}
                          className={cx(selected && styles.rowSelected)}
                          data-dim={dim ? "true" : undefined}
                        >
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
                          <td className={cx(styles.num, styles.readyNum)} data-hl={mark("ready")}>
                            {row.states.ready}
                          </td>
                          <td className={cx(styles.num, styles.pulledNum)} data-hl={mark("pulled")}>
                            {row.states.pulled}
                          </td>
                          <td className={styles.num} data-hl={mark("expected")}>
                            +{row.expected}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
        {isPhone ? null : <ReadyAgainstWaiting groups={groups} />}
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

const SERVICE_DOT: Partial<Record<HealthService, string>> = {
  "North Metro": "north",
  "East Metro": "east",
  "South Metro": "south",
  WACHS: "wachs",
  CAHS: "cahs",
  Private: "private",
};

/**
 * Phone (v10 Network): "Ready against waiting" as the first list, one row per service. Pressing a
 * row scopes the bed flow below to that service; pressing it again shows every service.
 */
export function ReadyAgainstWaitingPhone({
  groups,
  scope,
  onScope,
}: {
  groups: readonly ServiceGroup[];
  scope: HealthService | "all";
  onScope: (scope: HealthService | "all") => void;
}) {
  return (
    <section className={styles.phoneVersus} aria-labelledby="ward-network-versus-phone-heading">
      <header className={styles.phoneVersusHead}>
        <h2 id="ward-network-versus-phone-heading" className={styles.phoneVersusTitle}>
          Ready against waiting
        </h2>
        <span className={styles.phoneVersusHint}>tap to scope beds</span>
      </header>
      <ul className={styles.phoneVersusList}>
        {groups.map((group) => {
          const gap = readyGap(group);
          const selected = scope === group.service;
          return (
            <li key={group.service}>
              <button
                type="button"
                className={cx(styles.phoneVersusRow, selected && styles.rowSelected)}
                aria-pressed={selected}
                onClick={() => onScope(selected ? "all" : group.service)}
              >
                <span
                  className={styles.phoneServiceDot}
                  data-service={SERVICE_DOT[group.service] ?? "other"}
                  aria-hidden="true"
                />
                <span className={styles.phoneVersusMain}>
                  <span className={styles.phoneVersusName}>{group.service}</span>
                  <span className={styles.phoneVersusMeta}>
                    <b>{group.ready}</b> ready · <b>{group.waiting}</b> waiting in ED
                  </span>
                </span>
                <span className={styles.phoneVersusGap}>
                  <StatusGlyph tone={gap < 0 ? "warning" : "success"} size={9} />
                  {gap < 0 ? (
                    <>
                      Short <b>{-gap}</b>
                    </>
                  ) : gap === 0 ? (
                    "Exactly enough"
                  ) : (
                    <>
                      Spare <b>{gap}</b>
                    </>
                  )}
                </span>
              </button>
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
  sheetOpen: sheetOpenProp,
  onSheetOpenChange,
}: {
  ed: EdPressure["ed"] | undefined;
  rows: readonly NetworkUnitRow[];
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  /** Phone: lets the caller open the road-time sheet (an ED row tap). Uncontrolled when omitted. */
  sheetOpen?: boolean;
  onSheetOpenChange?: (open: boolean) => void;
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
  // Phone (v10): one link row under the departments; the ranked list opens as a bottom sheet.
  const isPhone = useIsPhone();
  const [sheetOpenLocal, setSheetOpenLocal] = useState(false);
  const sheetOpen = sheetOpenProp ?? sheetOpenLocal;
  const setSheetOpen = (open: boolean) => {
    setSheetOpenLocal(open);
    onSheetOpenChange?.(open);
  };

  const list =
    ranked.length === 0 ? (
      <p className={styles.empty}>No ward with a ready bed has a measured route from this department.</p>
    ) : (
      <ol className={styles.nearestList}>
        {ranked.map(({ row, route }, index) => (
          <li key={row.unit.id}>
            <button
              type="button"
              className={cx(styles.nearestRow, row.unit.id === selectedUnitId && styles.rowSelected)}
              aria-pressed={row.unit.id === selectedUnitId}
              onClick={() => {
                onSelectUnit(row.unit.id);
                if (isPhone) setSheetOpen(false);
              }}
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
    );

  if (isPhone) {
    const first = ranked.at(0);
    return (
      <>
        <button
          type="button"
          className={styles.roadLink}
          aria-haspopup="dialog"
          data-testid="ward-network-roadtime-row"
          onClick={() => setSheetOpen(true)}
        >
          <MapPin size={18} aria-hidden="true" className={styles.roadLinkIcon} />
          <span className={styles.roadLinkText}>
            <span className={styles.roadLinkTitle}>
              Ready beds by road time{ed === undefined ? "" : ` from ${ed.siteCode} ED`}
            </span>
            <span className={styles.unitMeta}>
              {first === undefined
                ? "No measured route to a ready bed"
                : `${first.row.unit.name} · ${first.route.min === 0 ? "on site" : `${durMinutes(first.route.min)} drive`}`}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className={styles.roadLinkIcon} />
        </button>
        <PhoneSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Ready beds by road time"
          description={
            ed === undefined
              ? "Indicative, not live traffic"
              : `From ${ed.name.replace(/\s*(Public Hospital|Hospital|Health Campus)?\s*Emergency Department$/u, " ED")} · indicative, not live traffic`
          }
          data-testid="ward-network-roadtime-sheet"
        >
          <div className={styles.roadSheet}>
            {list}
            <p className={styles.caveat}>{REFERENCE_DISTANCE_CAVEAT}</p>
            <p className={styles.caveat}>Change the department under Emergency departments.</p>
          </div>
        </PhoneSheet>
      </>
    );
  }

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
export function NetworkUnitDetail({
  row,
  now,
  onClose,
}: {
  row: NetworkUnitRow | undefined;
  now: Instant;
  /** Phone: closes the ward's bottom sheet (clears the selection). */
  onClose?: () => void;
}) {
  const isPhone = useIsPhone();
  if (isPhone && onClose) return <NetworkUnitSheet row={row} now={now} onClose={onClose} />;
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

/** Phone (v10): a ward picked on the network opens as a bottom sheet with its figures and two actions. */
function NetworkUnitSheet({
  row,
  now,
  onClose,
}: {
  row: NetworkUnitRow | undefined;
  now: Instant;
  onClose: () => void;
}) {
  const { dispatch } = useWardFlow();
  const router = useRouter();
  const unit = row?.unit;
  return (
    <PhoneSheet
      open={row !== undefined}
      onClose={onClose}
      title={unit?.name ?? "Ward"}
      description={
        row === undefined || unit === undefined ? undefined : [row.service, unitMeta(unit)].filter(Boolean).join(" · ")
      }
      secondary={
        unit === undefined
          ? undefined
          : {
              label: "Ask to confirm",
              onAction: () => dispatch({ type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now, unitId: unit.id }),
            }
      }
      primary={
        unit === undefined ? undefined : { label: "Open ward page", onAction: () => router.push(unitHref(unit.id)) }
      }
      data-testid="ward-network-unit-sheet"
    >
      {row === undefined || unit === undefined ? null : (
        <div className={styles.unitSheet}>
          <dl className={styles.unitSheetFacts}>
            <div>
              <dt>Ready</dt>
              <dd>
                {row.states.ready > 0 ? <StatusGlyph tone="success" size={9} /> : null}
                {row.states.ready}
              </dd>
            </div>
            <div>
              <dt>Pulled</dt>
              <dd>{row.states.pulled}</dd>
            </div>
            <div>
              <dt>Occupied</dt>
              <dd>{row.states.occupied}</dd>
            </div>
            <div>
              <dt>Expected today</dt>
              <dd>+{row.expected}</dd>
            </div>
          </dl>
          <BedStrip
            counts={{ ...row.states, pendingPreparation: row.pendingPreparation }}
            wardName={unit.name}
            className={styles.unitSheetStrip}
          />
          <p className={styles.unitSheetLine}>
            <b>{durMinutes(Math.max(0, now - unit.allocatable.confirmedAt))}</b> since confirmed
            {row.pendingPreparation > 0
              ? ` · ${row.pendingPreparation} of the ready beds ${row.pendingPreparation === 1 ? "is" : "are"} still being made ready`
              : ""}
          </p>
          <dl className={styles.unitSheetKv}>
            <dt>Involuntary</dt>
            <dd>{unit.authorised ? "Authorised hospital" : "Not authorised"}</dd>
            <dt>Site</dt>
            <dd>{siteByCode(unit.siteCode)?.name ?? unit.siteCode}</dd>
          </dl>
        </div>
      )}
    </PhoneSheet>
  );
}
