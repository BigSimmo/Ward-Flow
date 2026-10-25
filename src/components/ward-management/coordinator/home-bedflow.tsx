"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  Card,
  CardHead,
  Icon,
  Legend,
  StackBar,
  StatusGlyph,
  cx,
  type LegendItem,
  type StackSegment,
} from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { bedsPendingPreparation, capacityBreakdown } from "@/components/ward-management/ward-bed-availability";
import { wardCategory } from "@/components/ward-management/ward-bed-designation";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { wardServiceOrder } from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { siteByCode } from "@/components/ward-management/ward-sites";
import { RELEASES_HELD_UP_LABEL } from "@/components/ward-management/ward-nav-counts";
import {
  deriveServiceBedAlerts,
  formatOccupancyPercent,
} from "@/components/ward-management/shell/ward-service-bed-alerts";

// Loads the shared coordinator styles here, ahead of home.module.css and shortlist-panel.module.css,
// as flow-diagram.tsx did while this card imported it. The Placement panel's own overrides depend on
// coming later in the cascade; left to the lazy panel, these base rules arrived last and won.
import "./coordinator.module.css";
import styles from "./home.module.css";

import { useWardNetwork } from "@/components/ward-management/ward-flow-provider";
const LEGEND: LegendItem[] = [
  { id: "ready", label: "Ready", fill: "ready" },
  { id: "pulled", label: "Pulled", hatch: true },
  { id: "closed", label: "Closed", fill: "closed" },
  { id: "occupied", label: "Occupied", fill: "data-3" },
];

type HomeBedflowProps = {
  units: Unit[];
  movements: Movement[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  admissions: readonly Admission[];
  now: Instant;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  /** Releases held up, today and tomorrow (`wardNavCounts().discharges`), for the foot. */
  dischargesHeldUp: number;
  service: HealthService | null;
};

function unitKind(unit: Unit) {
  const category = wardCategory(unit);
  return category === "Locked" ? "secure" : category.toLowerCase();
}

/**
 * The State bedflow card (direction A, owner 10 Oct 2026), at the foot of Capacity since Home v7
 * (22 Oct 2026): every inpatient ward, grouped by health service, with its ready, pulled, closed and
 * occupied beds. The patient mode that named a Placement patient and put Offer on each fitting ward
 * left with Home's card and was removed on 23 Oct 2026. Each ward row keeps the old diagram's
 * `ward-diagram-unit-<id>` and `aria-pressed` hooks.
 */
export function HomeBedflow({
  units,
  movements,
  bedReleases,
  leaveBeds,
  admissions,
  now,
  selectedUnitId,
  onSelectUnit,
  dischargesHeldUp,
  service,
}: HomeBedflowProps) {
  const network = useWardNetwork();
  const occupancy = useMemo(
    () => deriveServiceBedAlerts(units, bedReleases, network.sites, movements, now, undefined, admissions),
    [units, bedReleases, network.sites, movements, now, admissions],
  );
  const occupancyByService = new Map(occupancy.services.map((row) => [row.shortName, row.occupancyPercent]));

  const groups = useMemo(
    () =>
      wardServiceOrder
        .map((groupService) => ({
          service: groupService,
          units: units.filter((unit) => siteByCode(unit.siteCode)?.service === groupService),
        }))
        .filter((group) => group.units.length > 0),
    [units],
  );
  const unplaced = useMemo(() => {
    const grouped = new Set(groups.flatMap((group) => group.units.map((unit) => unit.id)));
    return units.filter((unit) => !grouped.has(unit.id));
  }, [groups, units]);

  // The first two health services open. A group the reader opens or shuts stays that way.
  const [toggled, setToggled] = useState<Partial<Record<string, boolean>>>({});
  const isOpenGroup = (groupService: string, index: number) => toggled[groupService] ?? index < 2;
  function toggleGroup(groupService: string, open: boolean) {
    setToggled({ ...toggled, [groupService]: !open });
  }

  const today = units.reduce((sum, unit) => {
    const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    return sum + breakdown.confirmedToday + breakdown.expectedToday;
  }, 0);

  function renderUnit(unit: Unit) {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    // The ready figure subtracts nothing for preparation (owner ruling); the note says how many.
    const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
    const expected = breakdown.confirmedToday + breakdown.expectedToday;
    const selected = selectedUnitId === unit.id;
    const segments: StackSegment[] = [
      { id: "ready", value: states.ready, fill: "ready", label: "Ready" },
      { id: "pulled", value: states.pulled, hatch: true, label: "Pulled" },
      { id: "closed", value: states.closed, fill: "closed", label: "Closed" },
      { id: "occupied", value: states.occupied, fill: "data-3", label: "Occupied" },
    ];
    return (
      <li key={unit.id} className={cx(styles.unitRow, selected && styles.unitRowSelected)}>
        <button
          type="button"
          className={styles.unitMain}
          data-testid={`ward-diagram-unit-${unit.id}`}
          aria-pressed={selected}
          onClick={() => onSelectUnit(unit.id)}
        >
          <span className={styles.unitName}>
            <span className={styles.unitNameLine}>
              <span className={styles.unitNameText} title={unit.name}>
                {unit.name}
              </span>
            </span>
            <span className={styles.unitSub}>
              {unit.cohort} {unitKind(unit)} · {unit.beds} beds
              {!unit.authorised ? " · Voluntary only" : ""}
            </span>
            {pendingPreparation > 0 ? (
              <span className={styles.unitPending} data-testid={`ward-flow-pending-${unit.id}`}>
                {pendingPreparation} being made ready
              </span>
            ) : null}
          </span>
          <StackBar className={styles.unitBar} thin label={`${unit.name} beds`} segments={segments} />
          {/* DOM reads "Ready 2" (the old diagram's wording, and what a screen reader hears);
              `column-reverse` draws the figure above a lower-case "ready", as the mockup does. */}
          <span className={styles.unitReady}>
            <span className={styles.unitReadyWord}>Ready</span>{" "}
            <span className={styles.unitReadyValue}>{states.ready}</span>
          </span>
        </button>
        <span className={styles.unitAction}>
          <span className={styles.unitExpected}>
            <span className={styles.mono}>+{expected}</span> expected
          </span>
        </span>
      </li>
    );
  }

  return (
    <Card className={styles.flowCard} aria-label="State Bedflow">
      <CardHead className={styles.flowHead} title="State bedflow" meta={`${units.length} wards`} />
      <div className={styles.flowBody}>
        {groups.map((group, index) => {
          const open = isOpenGroup(group.service, index);
          const ready = group.units.reduce(
            (sum, unit) => sum + bedStates(unit, admissions, bedReleases, leaveBeds).ready,
            0,
          );
          const occupied = occupancyByService.get(group.service);
          const bodyId = `ward-bedflow-group-${group.service.replace(/\s+/g, "-").toLowerCase()}`;
          return (
            <section key={group.service} className={styles.group} aria-label={group.service}>
              <button
                type="button"
                className={styles.groupHead}
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={() => toggleGroup(group.service, open)}
              >
                <Icon icon={open ? ChevronDown : ChevronRight} size={14} />
                <span className={styles.groupName}>{group.service}</span>
                <span className={styles.groupCount}>{group.units.length} wards</span>
                <span className={styles.groupFigures}>
                  <span className={styles.mono}>{ready}</span> ready
                  {occupied !== undefined ? (
                    <>
                      {" "}
                      <span className={styles.mono}>{formatOccupancyPercent(occupied)}</span> occupied
                    </>
                  ) : null}
                </span>
              </button>
              <ul id={bodyId} className={styles.unitList} hidden={!open}>
                {group.units.map(renderUnit)}
              </ul>
            </section>
          );
        })}
        {unplaced.length > 0 ? (
          <section className={styles.group} aria-label="Units with an unresolved health service">
            <p className={styles.groupHead}>Unresolved health service</p>
            <ul className={styles.unitList}>
              {unplaced.map((unit) => (
                <li key={unit.id} className={styles.unitRow} data-testid={`ward-diagram-unplaced-unit-${unit.id}`}>
                  <span className={styles.unitName}>
                    <span className={styles.unitNameText} title={unit.name}>
                      {unit.name}
                    </span>
                    <span className={styles.unitSub}>Health service not resolved</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
      {service ? (
        <p className={styles.cardNote} data-testid="ward-diagram-service-foot">
          {/* Home v7 (22 Oct 2026): the card sits on Capacity now, where there is no queue. */}
          {`Showing every ward in the network, not only ${service}.`}
        </p>
      ) : null}
      <div className={styles.cardFoot}>
        <Legend items={LEGEND} className={styles.flowLegend} />
        <span className={styles.footMeta}>
          <span className={styles.mono}>+{today}</span> today
          {dischargesHeldUp > 0 ? (
            <>
              <StatusGlyph tone="warning" size={9} />
              <span className={styles.mono}>{dischargesHeldUp}</span> {RELEASES_HELD_UP_LABEL.toLowerCase()}
            </>
          ) : null}
        </span>
      </div>
    </Card>
  );
}
