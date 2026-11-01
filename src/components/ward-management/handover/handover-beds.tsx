"use client";

/**
 * The Beds tab of the refined Handover page (9 Oct 2026). Summary tiles, beds by ward grouped by
 * health service, and a ward panel for the clicked ward with who is heading there. Highlight chips
 * only highlight rows; every ward in scope stays. Values are the ward feed's, each with its age.
 * Patients are named by record and UMRN only, never the journey id.
 */
import Link from "next/link";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { ChevronRight, MapPin, X } from "lucide-react";
import {
  Button,
  Card,
  CardBody,
  CardHead,
  ChipGroup,
  FilterChip,
  Icon,
  SrOnly,
  StatusGlyph,
  buttonClass,
  cx,
  tableClasses,
  durMinutes,
  type WfTone,
} from "@/components/wf";
import { formatInstantWithDay, type Instant } from "@/components/ward-management/ward-clock";
import {
  isActOrUrgent,
  isMoving,
  isWaitingForBed,
  STAGE_LABEL,
  wardIsStale,
  type HandoverRow,
  type HandoverWard,
  type HeldDischarge,
  isStoppedAwaitingRelease,
} from "./handover-model";
import { wardClosedLine } from "../capacity/ward-closure";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { accessIsWholeNetwork, unitInScope } from "@/components/ward-management/ward-role-access";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import styles from "./handover-beds.module.css";

export type HandoverBedsProps = {
  /** Open movements already in the handover scope. */
  rows: HandoverRow[];
  /** Wards already in scope. */
  wards: HandoverWard[];
  /** Held discharges already in scope, longest first. */
  held: HeldDischarge[];
  now: Instant;
  /**
   * The hero's "Finding a ward" figure (the meeting group), so this tile and the hero's
   * "beds ready for N finding a ward" read one number. Falls back to every row still finding a ward.
   */
  waitingForBed?: number;
  /** Switches to the Patients tab and selects the row. */
  onOpenPatient: (movementId: string) => void;
};

type BedChip = "ready" | "stale" | "full" | "holds";

const BED_CHIPS: { id: BedChip; label: string; test: (ward: HandoverWard, now: Instant) => boolean }[] = [
  { id: "ready", label: "Wards with ready beds", test: (ward) => ward.ready > 0 },
  { id: "stale", label: "Feed over 15 min", test: (ward, now) => wardIsStale(ward, now) },
  { id: "full", label: "Full", test: (ward) => ward.beds > 0 && ward.occupied >= ward.beds },
  { id: "holds", label: "Wards with discharges held up", test: (ward) => ward.holds > 0 },
];

const SERVICE_TOKEN: Record<string, string> = {
  "East Metro": "var(--wf-svc-east)",
  "North Metro": "var(--wf-svc-north)",
  "South Metro": "var(--wf-svc-south)",
  WACHS: "var(--wf-svc-wachs)",
  CAHS: "var(--wf-svc-cahs)",
  Private: "var(--wf-svc-private)",
};

const COLUMN_COUNT = 9;

const off = <span className={styles.off}>None</span>;

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const notReady = (ward: Pick<HandoverWard, "empty" | "ready">) => Math.max(0, ward.empty - ward.ready);
const daysText = (days: number | null) =>
  days === null ? "Days not recorded" : `${days} ${days === 1 ? "day" : "days"}`;

/** Status shape for a patient heading to a ward: act now, moving, or waiting. */
function patientTone(row: HandoverRow, now: Instant): WfTone {
  if (isActOrUrgent(row, now)) return "danger";
  if (isMoving(row)) return "info";
  return "neutral";
}

function OccupancyBar({
  ward,
  big = false,
}: {
  ward: Pick<HandoverWard, "occupied" | "empty" | "ready">;
  big?: boolean;
}) {
  const empty = notReady(ward);
  return (
    <span
      className={cx(styles.obar, big && styles.obarBig)}
      role="img"
      aria-label={`${ward.occupied} occupied, ${empty} empty not ready, ${ward.ready} ready`}
    >
      {ward.occupied > 0 ? <i className={styles.segOcc} style={{ flexGrow: ward.occupied }} /> : null}
      {empty > 0 ? <i className={styles.segEmpty} style={{ flexGrow: empty }} /> : null}
      {ward.ready > 0 ? <i className={styles.segReady} style={{ flexGrow: ward.ready }} /> : null}
    </span>
  );
}

function CountPill({ n }: { n: number }) {
  return <span className={styles.k}>{n}</span>;
}

function BedTiles({ rows, wards, held, now, waitingForBed }: Omit<HandoverBedsProps, "onOpenPatient">) {
  const sum = (key: "ready" | "beds" | "occupied" | "outToday" | "pastEdd" | "longStays") =>
    wards.reduce((total, ward) => total + ward[key], 0);
  const ready = sum("ready");
  const preparing = wards.reduce((total, ward) => total + ward.pendingPreparation, 0);
  const beds = sum("beds");
  const occupied = sum("occupied");
  const stale = wards.filter((ward) => wardIsStale(ward, now)).length;
  const waiting = waitingForBed ?? rows.filter(isWaitingForBed).length;
  return (
    <div className={styles.tiles}>
      <div className={cx(styles.tile, styles.tileOk)}>
        <b className={cx(styles.tileValue, styles.inkSuccess)}>{ready}</b>
        <span className={styles.tileLabel}>Beds ready</span>
        <span className={styles.tileSub}>
          for <b>{waiting}</b> finding a ward{preparing > 0 ? `, ${preparing} being made ready` : ""}
        </span>
      </div>
      <div className={styles.tile}>
        <b className={styles.tileValue}>{pct(occupied, beds)}%</b>
        <span className={styles.tileLabel}>Occupied</span>
        <span className={styles.tileSub}>
          {occupied} of {beds} beds
        </span>
      </div>
      <div className={styles.tile}>
        <b className={styles.tileValue}>{sum("outToday")}</b>
        <span className={styles.tileLabel}>Due out today</span>
        <span className={styles.tileSub}>{sum("pastEdd")} past EDD</span>
      </div>
      <div className={styles.tile}>
        <b className={cx(styles.tileValue, held.length > 0 && styles.inkWarning)}>{held.length}</b>
        <span className={styles.tileLabel}>Discharges held</span>
        <span className={styles.tileSub}>{sum("longStays")} stays over 7 days</span>
      </div>
      <div className={styles.tile}>
        <b className={cx(styles.tileValue, stale > 0 && styles.inkWarning)}>{stale}</b>
        <span className={styles.tileLabel}>Feeds over 15 min</span>
        <span className={styles.tileSub}>of {wards.length} wards</span>
      </div>
    </div>
  );
}

function PatientButton({
  row,
  now,
  onOpenPatient,
}: {
  row: HandoverRow;
  now: Instant;
  onOpenPatient: (movementId: string) => void;
}) {
  return (
    <button type="button" className={styles.person} onClick={() => onOpenPatient(row.id)}>
      <StatusGlyph tone={patientTone(row, now)} />
      <span className={styles.nm}>
        <b>{row.name}</b>
        <span className={styles.mono}>{row.umrn}</span>
      </span>
      <span className={styles.personStage}>{STAGE_LABEL[row.stage]}</span>
      <Icon icon={ChevronRight} size={14} className={styles.chev} />
      <SrOnly>, open in Patients</SrOnly>
    </button>
  );
}

function WardPanel({
  ward,
  rows,
  held,
  now,
  onClose,
  onOpenPatient,
}: {
  ward: HandoverWard;
  rows: HandoverRow[];
  held: HeldDischarge[];
  now: Instant;
  onClose: () => void;
  onOpenPatient: (movementId: string) => void;
}) {
  const age = now - ward.confirmedAt;
  const stale = wardIsStale(ward, now);
  const heading = rows.filter((row) => row.to?.unitId === ward.id && !isStoppedAwaitingRelease(row));
  const reviewing = rows.filter((row) => row.asked.some((asked) => asked.unitId === ward.id));
  const holds = held.filter((item) => item.admission.unitId === ward.id);
  const closedLine = wardClosedLine(ward.unit);
  const facts: { label: string; value: string; warn?: boolean }[] = [
    ...(closedLine ? [{ label: "Admissions", value: closedLine, warn: true }] : []),
    {
      label: "Updated",
      value: `${durMinutes(age)} ago, at ${formatInstantWithDay(ward.confirmedAt, now)}${stale ? ", over 15 min" : ""}`,
      warn: stale,
    },
    { label: "Being made ready", value: String(ward.pendingPreparation) },
    { label: "Pulled for incoming", value: String(ward.held) },
    { label: "Due out today", value: String(ward.outToday) },
    { label: "Past EDD", value: String(ward.pastEdd) },
    { label: "Stays over 7 days", value: String(ward.longStays) },
    { label: "Discharges held up", value: String(ward.holds) },
  ];
  return (
    <Card className={styles.panel} aria-labelledby={`ward-panel-${ward.id}`}>
      <div className={styles.panelHead}>
        <Icon icon={MapPin} size={16} className={styles.muted} />
        <span className={styles.nm}>
          <b id={`ward-panel-${ward.id}`} className={styles.panelTitle}>
            {ward.name}
          </b>
          <span>
            {ward.service} · {ward.beds} beds
          </span>
        </span>
        <Button variant="ghost" size="sm" iconOnly icon={X} aria-label={`Close ${ward.name}`} onClick={onClose} />
      </div>
      <div className={styles.section}>
        <OccupancyBar ward={ward} big />
        <div className={styles.legendCounts}>
          <span>
            <b>{ward.occupied}</b>Occupied
          </span>
          <span>
            <b>{notReady(ward)}</b>Empty, not ready
          </span>
          <span>
            <b className={styles.inkSuccess}>{ward.ready}</b>Ready
          </span>
        </div>
      </div>
      <div className={styles.section}>
        <dl className={styles.facts}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className={cx(fact.warn && styles.stale)}>
                {fact.warn ? <StatusGlyph tone="warning" size={8} /> : null}
                <span className={styles.trunc}>{fact.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={styles.section}>
        <div className={styles.sectionHead}>
          <h3 className={styles.sectionTitle}>Heading here</h3>
          <CountPill n={heading.length} />
        </div>
        {heading.length ? (
          heading.map((row) => <PatientButton key={row.id} row={row} now={now} onOpenPatient={onOpenPatient} />)
        ) : (
          <span className={styles.sub}>No accepted patients</span>
        )}
      </div>
      {reviewing.length ? (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Reviewing a referral</h3>
            <CountPill n={reviewing.length} />
          </div>
          {reviewing.map((row) => (
            <PatientButton key={row.id} row={row} now={now} onOpenPatient={onOpenPatient} />
          ))}
        </div>
      ) : null}
      {holds.length ? (
        <div className={styles.section}>
          <div className={styles.sectionHead}>
            <h3 className={styles.sectionTitle}>Discharges held up</h3>
            <CountPill n={holds.length} />
          </div>
          {holds.map((item) => (
            <div key={item.admission.id} className={styles.personStatic}>
              <StatusGlyph tone="warning" />
              <span className={styles.nm}>
                <b>{item.name}</b>
                <span className={styles.mono}>{item.umrn}</span>
              </span>
              <span className={styles.personStage} title={`${item.reason}, ${daysText(item.days)}`}>
                {item.reason}, {daysText(item.days)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className={styles.panelFoot}>
        <Link
          href={unitHref(ward.id)}
          className={buttonClass({ variant: "sec", size: "sm", className: styles.footButton })}
        >
          Open ward
        </Link>
      </div>
    </Card>
  );
}

function NoWardSelected() {
  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderTitle}>
        <Icon icon={MapPin} size={16} />
        No ward selected
      </div>
      <div className={styles.ghostBar} aria-hidden="true" />
      <div className={styles.ghostGrid} aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index}>
            <i className={styles.ghostLineShort} />
            <i className={styles.ghostLineLong} />
          </div>
        ))}
      </div>
      <div className={styles.placeholderHint}>Click a ward to see who is heading there</div>
    </div>
  );
}

function HeldList({ held }: { held: HeldDischarge[] }) {
  const baseId = useId();
  return (
    <Card aria-labelledby={`${baseId}-handover-beds-held`}>
      <CardHead
        id={`${baseId}-handover-beds-held`}
        title="Discharges held up"
        meta={<CountPill n={held.length} />}
        aside={<span className={styles.sub}>Longest first</span>}
        className={styles.cardHead}
      />
      <CardBody flush>
        {held.length ? (
          <ul className={styles.heldList}>
            {held.map((item) => (
              <li key={item.admission.id}>
                <span className={styles.nm}>
                  <b>{item.name}</b>
                  <span className={styles.trunc}>
                    <span className={styles.mono}>{item.umrn}</span> · {item.ward}
                  </span>
                </span>
                <span className={styles.heldRight}>
                  <span className={styles.mono}>{daysText(item.days)}</span>
                  <span className={styles.sub} title={item.reason}>
                    {item.reason}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.emptyLine}>No discharges held up in scope</p>
        )}
      </CardBody>
    </Card>
  );
}

/** Incoming per ward: accepted journeys heading there and wards still reviewing a request. */
export function incomingCounts(rows: readonly HandoverRow[]): Map<string, { accepted: number; reviewing: number }> {
  const map = new Map<string, { accepted: number; reviewing: number }>();
  const bump = (unitId: string, key: "accepted" | "reviewing") => {
    const entry = map.get(unitId) ?? { accepted: 0, reviewing: 0 };
    entry[key] += 1;
    map.set(unitId, entry);
  };
  for (const row of rows) {
    // Owner ruling 2026-10-13 22:13 AWST (PR #279): a stopped journey is not coming; keep it out of incoming.
    if (row.to && !isStoppedAwaitingRelease(row)) bump(row.to.unitId, "accepted");
    for (const asked of row.asked) bump(asked.unitId, "reviewing");
  }
  return map;
}

export function HandoverBeds({ rows, wards: allWards, held, now, waitingForBed, onOpenPatient }: HandoverBedsProps) {
  // A scoped desk totals its own wards only; another ward's empty count must not read as its own.
  const access = useEffectiveWardAccess();
  const wards = useMemo(() => {
    if (accessIsWholeNetwork(access)) return allWards;
    const places = wardPlaceLookup(allWards.map((ward) => ward.unit));
    return allWards.filter((ward) => unitInScope(access.scope, ward.id, places));
  }, [allWards, access]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const baseId = useId();
  const [chips, setChips] = useState<ReadonlySet<BedChip>>(() => new Set());

  const selected = selectedId === null ? undefined : wards.find((ward) => ward.id === selectedId);

  const incoming = useMemo(() => incomingCounts(rows), [rows]);

  const groups = useMemo(() => {
    const services = [...new Set(wards.map((ward) => ward.service))];
    return services.map((service) => {
      const members = wards
        .filter((ward) => ward.service === service)
        .sort((a, b) => b.ready - a.ready || a.name.localeCompare(b.name));
      const beds = members.reduce((total, ward) => total + ward.beds, 0);
      const occupied = members.reduce((total, ward) => total + ward.occupied, 0);
      const ready = members.reduce((total, ward) => total + ward.ready, 0);
      return { service, wards: members, ready, occupiedPct: pct(occupied, beds) };
    });
  }, [wards]);

  const highlighted = (ward: HandoverWard) =>
    chips.size > 0 && BED_CHIPS.every((chip) => !chips.has(chip.id) || chip.test(ward, now));
  const highlightedCount = chips.size > 0 ? wards.filter(highlighted).length : 0;

  const toggleChip = (id: BedChip, pressed: boolean) =>
    setChips((current) => {
      const next = new Set(current);
      if (pressed) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleWard = (id: string) => setSelectedId((current) => (current === id ? null : id));

  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>, id: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleWard(id);
    }
  };

  return (
    <div data-testid="ward-handover-beds" className={styles.root}>
      <div className={styles.main}>
        <BedTiles rows={rows} wards={wards} held={held} now={now} waitingForBed={waitingForBed} />
        <Card aria-labelledby={`${baseId}-handover-beds-wards`}>
          <CardHead
            id={`${baseId}-handover-beds-wards`}
            title="Beds by ward"
            meta={<CountPill n={wards.length} />}
            aside={
              <span className={styles.legend} role="group" aria-label="Bar key">
                <span>
                  <i className={cx(styles.swatch, styles.segOcc)} aria-hidden="true" />
                  Occupied
                </span>
                <span>
                  <i className={cx(styles.swatch, styles.segEmpty)} aria-hidden="true" />
                  Empty, not ready
                </span>
                <span>
                  <i className={cx(styles.swatch, styles.segReady)} aria-hidden="true" />
                  Ready
                </span>
              </span>
            }
            className={styles.cardHead}
          />
          <div className={styles.chipBar}>
            <span className={styles.chipLabel}>Highlight</span>
            <ChipGroup label="Highlight wards" className={styles.chips}>
              {BED_CHIPS.map((chip) => (
                <FilterChip
                  key={chip.id}
                  pressed={chips.has(chip.id)}
                  onPressedChange={(pressed) => toggleChip(chip.id, pressed)}
                  count={wards.filter((ward) => chip.test(ward, now)).length}
                >
                  {chip.label}
                </FilterChip>
              ))}
            </ChipGroup>
            {chips.size > 0 ? (
              <>
                <span className={styles.spacer} />
                <span className={styles.sub} role="status">
                  <b className={styles.ink1}>{highlightedCount}</b> synthetic rows highlighted, all wards stay
                </span>
                <Button variant="ghost" size="sm" onClick={() => setChips(new Set())}>
                  Clear
                </Button>
              </>
            ) : null}
          </div>
          <div className={styles.tableWrap}>
            <table className={cx(tableClasses.table, styles.bedsTable)}>
              <caption className={styles.caption}>Beds by ward, grouped by health service</caption>
              <colgroup>
                <col className={styles.colWard} />
                <col className={styles.colBeds} />
                <col className={styles.colNarrow} />
                <col className={styles.colIncoming} />
                <col className={styles.colUpdated} />
                <col className={styles.colHeld} />
                <col className={styles.colOutToday} />
                <col className={styles.colPastEdd} />
                <col className={styles.colNarrow} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Ward</th>
                  <th scope="col">Beds</th>
                  <th scope="col">Ready</th>
                  <th scope="col">Incoming</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Pulled</th>
                  <th scope="col" title="Out today">
                    Out today
                  </th>
                  <th scope="col">Past EDD</th>
                  <th scope="col">Held up</th>
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.service}>
                  <tr className={styles.groupRow}>
                    <th scope="rowgroup" colSpan={COLUMN_COUNT}>
                      <span className={styles.groupHead}>
                        <span
                          className={styles.serviceDot}
                          style={{ background: SERVICE_TOKEN[group.service] ?? "var(--wf-svc-statewide)" }}
                          aria-hidden="true"
                        />
                        <b>{group.service}</b>
                        <CountPill n={group.wards.length} />
                        <span className={styles.why}>
                          {group.ready} ready, {group.occupiedPct}% occupied
                        </span>
                      </span>
                    </th>
                  </tr>
                  {group.wards.map((ward) => {
                    const stale = wardIsStale(ward, now);
                    const age = now - ward.confirmedAt;
                    const inc = incoming.get(ward.id);
                    const isSelected = selected?.id === ward.id;
                    return (
                      <tr
                        key={ward.id}
                        className={cx(styles.row, highlighted(ward) && styles.rowHl, isSelected && styles.rowSel)}
                        tabIndex={0}
                        aria-selected={isSelected}
                        onClick={() => toggleWard(ward.id)}
                        onKeyDown={(event) => onRowKey(event, ward.id)}
                      >
                        <td>
                          <span className={styles.nm}>
                            <b>{ward.name}</b>
                            <span className={styles.sans}>{ward.beds} beds</span>
                          </span>
                        </td>
                        <td>
                          <span className={styles.occ}>
                            <OccupancyBar ward={ward} />
                            <span className={styles.mono}>
                              {ward.occupied}/{ward.beds}
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className={cx(styles.ready, ward.ready > 0 && styles.readyOn)}>{ward.ready}</span>
                        </td>
                        <td>
                          {inc && (inc.accepted || inc.reviewing) ? (
                            <span className={styles.two}>
                              {inc.accepted ? <span>{inc.accepted} accepted</span> : null}
                              {inc.reviewing ? (
                                <span className={cx(inc.accepted > 0 && styles.sub)}>{inc.reviewing} reviewing</span>
                              ) : null}
                            </span>
                          ) : (
                            off
                          )}
                        </td>
                        <td title={`Confirmed ${formatInstantWithDay(ward.confirmedAt, now)}`}>
                          {stale ? (
                            <span className={styles.stale}>
                              <StatusGlyph tone="warning" size={8} />
                              <span className={styles.mono}>{durMinutes(age)} ago</span>
                              <SrOnly>, over 15 minutes old</SrOnly>
                            </span>
                          ) : (
                            <span className={cx(styles.mono, styles.muted)}>{durMinutes(age)} ago</span>
                          )}
                        </td>
                        <td className={styles.mono}>{ward.held || off}</td>
                        <td className={styles.mono}>{ward.outToday || off}</td>
                        <td className={styles.mono}>{ward.pastEdd || off}</td>
                        <td className={styles.mono}>
                          {ward.holds ? (
                            <span className={styles.stale}>
                              <StatusGlyph tone="warning" size={8} />
                              {ward.holds}
                            </span>
                          ) : (
                            off
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
          <div className={styles.foot}>A feed over 15 minutes old is amber.</div>
        </Card>
      </div>
      <div className={styles.side}>
        {selected ? (
          <WardPanel
            ward={selected}
            rows={rows}
            held={held}
            now={now}
            onClose={() => setSelectedId(null)}
            onOpenPatient={onOpenPatient}
          />
        ) : (
          <NoWardSelected />
        )}
        <HeldList held={held} />
      </div>
    </div>
  );
}
