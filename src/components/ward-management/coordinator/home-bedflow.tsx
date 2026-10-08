"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Button,
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
import {
  INFORMATIONAL_GATES,
  candidateReason,
  eligibleCandidatesAmong,
  restrictionNotice,
  shortlistCandidates,
  wardServiceOrder,
  type ShortlistCandidate,
} from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { edHealthService } from "@/components/ward-management/ward-service-scope";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";
import {
  deriveServiceBedAlerts,
  formatOccupancyPercent,
} from "@/components/ward-management/shell/ward-service-bed-alerts";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";

import { hubStatusText } from "./flow-diagram";
import styles from "./home.module.css";

const LEGEND: LegendItem[] = [
  { id: "ready", label: "Ready", fill: "ready" },
  { id: "pulled", label: "Pulled", hatch: true },
  { id: "closed", label: "Closed", fill: "closed" },
  { id: "occupied", label: "Occupied", fill: "data-3" },
];

type HomeBedflowProps = {
  movement: Movement | undefined;
  units: Unit[];
  movements: Movement[];
  bedReleases: BedRelease[];
  leaveBeds: LeaveBed[];
  admissions: readonly Admission[];
  now: Instant;
  selectedUnitId: string | undefined;
  onSelectUnit: (unitId: string) => void;
  /** Offer: chooses this ward in the open shortlist for the selected movement. */
  onOffer: (unitId: string) => void;
  parallelReferralCap: number;
  /** Discharges held up today (`wardNavCounts().discharges`), for the foot. */
  dischargesHeldUp: number;
  service: HealthService | null;
};

type Candidate = ReturnType<typeof eligibleCandidatesAmong>[number];

/** Where this patient could go, across the whole network: a ward that fits with a bed now, or one
 *  that fits in every way except that it has no allocatable bed. */
type FitKind = "bed" | "no-bed";

function fitKind(candidate: ShortlistCandidate): FitKind | undefined {
  // Only a ward the eligibility rules pass counts as a fit, so the count, the chips and the status
  // line below agree. A ward that declined this patient before fails `prior_decline` and stays out.
  if (candidate.availability === "eligible") return "bed";
  if (candidate.availability !== "unavailable") return undefined;
  const failing = candidate.verdict.gates.filter((gate) => !gate.pass && !INFORMATIONAL_GATES.includes(gate.gate));
  return failing.length > 0 && failing.every((gate) => gate.gate === "allocatable_bed") ? "no-bed" : undefined;
}

function unitKind(unit: Unit) {
  const category = wardCategory(unit);
  return category === "Locked" ? "secure" : category.toLowerCase();
}

/**
 * Home's State bedflow card (v6 Home mockup): every inpatient ward, grouped by health service,
 * with its ready, pulled, closed and occupied beds. When a movement is selected the card names it,
 * says how many wards fit and which fits best, and puts Offer on each ward that fits. Wards that
 * do not fit are dimmed, never hidden: the whole network stays on screen.
 *
 * Every ward row keeps the old diagram's hooks (`ward-diagram-unit-<id>`, `aria-pressed`,
 * `data-routed`, `data-eligible`, `data-accepted`, `data-referred`) so selection still links to the
 * shortlist's own candidate.
 */
export function HomeBedflow({
  movement,
  units,
  movements,
  bedReleases,
  leaveBeds,
  admissions,
  now,
  selectedUnitId,
  onSelectUnit,
  onOffer,
  parallelReferralCap,
  dischargesHeldUp,
  service,
}: HomeBedflowProps) {
  const patientOf = usePatientOf();
  const shortlist = useMemo(
    () => (movement ? eligibleCandidatesAmong(movement, units, now, parallelReferralCap) : []),
    [movement, units, now, parallelReferralCap],
  );
  const byUnitId = useMemo(() => new Map(shortlist.map((candidate) => [candidate.unit.id, candidate])), [shortlist]);
  const fits = shortlist.filter((candidate) => candidate.verdict.eligible);
  const bestFit: Candidate | undefined = fits[0];

  // Every ward in the network that fits this patient, not only the three the routed shortlist
  // keeps: green where a bed is ready, amber where the ward fits but has no bed now.
  const options = useMemo(() => {
    if (!movement) return [];
    return shortlistCandidates(movement, units, now)
      .map((candidate) => ({ unit: candidate.unit, fit: fitKind(candidate) }))
      .filter((option): option is { unit: Unit; fit: FitKind } => option.fit !== undefined)
      .sort((a, b) => Number(a.fit === "no-bed") - Number(b.fit === "no-bed"));
  }, [movement, units, now]);
  const fitByUnitId = useMemo(() => new Map(options.map((option) => [option.unit.id, option.fit])), [options]);
  const bedFitCount = options.filter((option) => option.fit === "bed").length;
  const noBedCount = options.length - bedFitCount;

  const occupancy = useMemo(
    () => deriveServiceBedAlerts(units, bedReleases, undefined, movements, now),
    [units, bedReleases, movements, now],
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

  // Opened automatically for each patient: only the health services holding a ward that fits, or
  // the recorded destination or a referral, open. A group the reader opens or shuts stays that
  // way until another patient is chosen.
  const toggleKey = movement?.id ?? "";
  const [toggledFor, setToggledFor] = useState<{ key: string; groups: Partial<Record<string, boolean>> }>({
    key: toggleKey,
    groups: {},
  });
  const toggled = toggledFor.key === toggleKey ? toggledFor.groups : {};
  const isOpenGroup = (groupService: string, index: number, groupUnits: Unit[]) => {
    const chosen = toggled[groupService];
    if (chosen !== undefined) return chosen;
    if (movement) {
      return groupUnits.some(
        (unit) =>
          fitByUnitId.has(unit.id) || movement.acceptedUnitId === unit.id || movement.referredUnitIds.includes(unit.id),
      );
    }
    return index < 2;
  };
  function toggleGroup(groupService: string, open: boolean) {
    setToggledFor({ key: toggleKey, groups: { ...toggled, [groupService]: !open } });
  }

  const today = units.reduce((sum, unit) => {
    const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    return sum + breakdown.confirmedToday + breakdown.expectedToday;
  }, 0);

  const who = movement ? patientOf(movement) : undefined;
  const originEd = movement ? allEmergencyDepartments().find((ed) => ed.id === movement.originEdId) : undefined;
  const recorded = movement && (movement.acceptedUnitId || movement.referredUnitIds.length > 0);

  function bestFitReason(candidate: Candidate) {
    const parts: string[] = [];
    const unitService = siteByCode(candidate.unit.siteCode)?.service;
    if (movement && unitService && unitService === edHealthService(movement.originEdId)) parts.push("same service");
    const ready = bedStates(candidate.unit, admissions, bedReleases, leaveBeds).ready;
    parts.push(`${ready} ready now`);
    return parts.join(", ");
  }

  function renderUnit(unit: Unit) {
    const states = bedStates(unit, admissions, bedReleases, leaveBeds);
    const breakdown = capacityBreakdown(unit, bedReleases, leaveBeds, now);
    // The ready figure subtracts nothing for preparation (owner ruling); the note says how many.
    const pendingPreparation = bedsPendingPreparation(unit.id, bedReleases);
    const expected = breakdown.confirmedToday + breakdown.expectedToday;
    const candidate = byUnitId.get(unit.id);
    const isAccepted = movement?.acceptedUnitId === unit.id;
    const isReferred = !isAccepted && (movement?.referredUnitIds.includes(unit.id) ?? false);
    const notice =
      movement !== undefined && (candidate || isAccepted || isReferred) ? restrictionNotice(movement, unit) : undefined;
    const fit = candidate?.verdict.eligible === true;
    const optionFit = fitByUnitId.get(unit.id);
    const dim = movement !== undefined && !candidate && !optionFit && !isAccepted && !isReferred;
    const selected = selectedUnitId === unit.id;
    const isBest = fit && bestFit?.unit.id === unit.id;
    // A gentle tint marks where this patient can go: fitting wards, the recorded destination and
    // outstanding referrals. Everything else stays plain or dimmed.
    const highlight = isAccepted
      ? "accepted"
      : isReferred
        ? "referred"
        : fit || optionFit === "bed"
          ? "fit"
          : optionFit === "no-bed"
            ? "fit-no-bed"
            : undefined;
    const segments: StackSegment[] = [
      { id: "ready", value: states.ready, fill: "ready", label: "Ready" },
      { id: "pulled", value: states.pulled, hatch: true, label: "Pulled" },
      { id: "closed", value: states.closed, fill: "closed", label: "Closed" },
      { id: "occupied", value: states.occupied, fill: "data-3", label: "Occupied" },
    ];
    // The old diagram's own words: a recorded destination says which kind it is, and a ward that
    // was considered but does not fit says why (`candidateReason`), never a bare "Needs a look".
    const status = isAccepted
      ? "Accepted destination"
      : isReferred
        ? "Outstanding referral"
        : candidate && !candidate.verdict.eligible
          ? candidateReason(candidate.verdict)
          : optionFit === "no-bed"
            ? "Fits, no bed now"
            : undefined;

    return (
      <li
        key={unit.id}
        className={cx(styles.unitRow, selected && styles.unitRowSelected, dim && styles.unitRowDim)}
        data-highlight={highlight}
      >
        <button
          type="button"
          className={styles.unitMain}
          data-testid={`ward-diagram-unit-${unit.id}`}
          data-routed={candidate ? "true" : undefined}
          data-eligible={candidate ? String(candidate.verdict.eligible) : undefined}
          data-accepted={isAccepted ? "true" : undefined}
          data-referred={isReferred ? "true" : undefined}
          data-more-restrictive={notice ? "true" : undefined}
          aria-pressed={selected}
          onClick={() => onSelectUnit(unit.id)}
        >
          <span className={styles.unitName}>
            <span className={styles.unitNameLine}>
              <span className={styles.unitNameText} title={unit.name}>
                {unit.name}
              </span>
              {isBest ? <span className={styles.unitBestTag}>Best fit</span> : null}
            </span>
            <span className={styles.unitSub}>
              {unit.cohort} {unitKind(unit)} · {unit.beds} beds
              {!unit.authorised ? " · Voluntary only" : ""}
            </span>
            {pendingPreparation > 0 ? (
              <span className={styles.unitPending} data-testid={`ward-flow-pending-${unit.id}`}>
                {pendingPreparation} of the ready beds {pendingPreparation === 1 ? "is" : "are"} still being made ready
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
          {status ? (
            <span className={styles.unitStatus}>
              <StatusGlyph tone={isAccepted ? "success" : isReferred ? "info" : "warning"} size={9} />
              {status}
            </span>
          ) : null}
          {/* A restriction notice is painted, never screen-reader only. A voluntary patient on a
              locked ward gets the danger glyph: it is the sharper of the two levels. */}
          {notice ? (
            <span className={styles.unitStatus} data-level={notice.level}>
              <StatusGlyph tone={notice.level === "voluntary_on_locked" ? "danger" : "warning"} size={9} />
              {notice.text}
            </span>
          ) : null}
        </button>
        <span className={styles.unitAction}>
          {fit || optionFit === "bed" ? (
            <Button size="sm" variant="tint" onClick={() => onOffer(unit.id)} aria-label={`Offer ${unit.name}`}>
              Offer
            </Button>
          ) : (
            <span className={styles.unitExpected}>
              <span className={styles.mono}>+{expected}</span> expected
            </span>
          )}
        </span>
      </li>
    );
  }

  return (
    <Card className={styles.flowCard} aria-label="State Bedflow">
      <CardHead
        className={styles.flowHead}
        title="State bedflow"
        meta={`${units.length} wards`}
        aside={<Legend items={LEGEND} className={styles.flowLegend} />}
      />
      {movement && who ? (
        <div className={styles.forStrip} data-testid="ward-bedflow-subject">
          <div className={styles.forLine}>
            <span className={styles.forLabel}>For</span>
            <strong className={styles.forName}>{who.formalName}</strong>
            <span className={styles.forMeta}>
              {movement.cohort} {movement.security.toLowerCase()} · Tier {movement.urgency}
              {originEd ? ` · ${originEd.siteCode}` : ""}
            </span>
            <span className={styles.forFits}>
              <StatusGlyph tone={bedFitCount > 0 ? "success" : noBedCount > 0 ? "warning" : "danger"} size={9} />
              {bedFitCount === 1 ? "1 ward fits" : `${bedFitCount} wards fit`}
              {noBedCount > 0 ? <span className={styles.forNoBed}>{` · ${noBedCount} no bed`}</span> : null}
            </span>
          </div>
          {options.length > 0 ? (
            <ul className={styles.forOptions} aria-label="Wards that fit" data-testid="ward-bedflow-options">
              {options.map((option) => (
                <li key={option.unit.id}>
                  <button
                    type="button"
                    className={styles.forOption}
                    data-fit={option.fit}
                    aria-pressed={selectedUnitId === option.unit.id}
                    onClick={() => onSelectUnit(option.unit.id)}
                  >
                    {option.unit.name}
                    {option.fit === "no-bed" ? <span className="sr-only">, fits but no bed now</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {recorded || !bestFit ? (
            <p className={styles.forStatus}>{hubStatusText(movement, shortlist, units, now, who.displayName)}</p>
          ) : (
            <p className={styles.forBest}>
              <span className={styles.eyebrow}>Best fit</span>
              <strong>{bestFit.unit.name}</strong>
              <span className={styles.forMeta}>{bestFitReason(bestFit)}</span>
            </p>
          )}
        </div>
      ) : null}
      <div className={styles.flowBody}>
        {groups.map((group, index) => {
          const open = isOpenGroup(group.service, index, group.units);
          const ready = group.units.reduce(
            (sum, unit) => sum + bedStates(unit, admissions, bedReleases, leaveBeds).ready,
            0,
          );
          const occupied = occupancyByService.get(group.service);
          const groupFits = group.units.filter((unit) => fitByUnitId.get(unit.id) === "bed").length;
          const groupNoBed = group.units.filter((unit) => fitByUnitId.get(unit.id) === "no-bed").length;
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
                {movement ? (
                  <span className={styles.groupFit} data-none={groupFits + groupNoBed === 0 ? "true" : undefined}>
                    {groupFits + groupNoBed === 0 ? "None fit" : groupFits > 0 ? `${groupFits} fit` : null}
                    {groupNoBed > 0 ? (
                      <span className={styles.groupNoBed}>{`${groupFits > 0 ? " · " : ""}${groupNoBed} no bed`}</span>
                    ) : null}
                  </span>
                ) : null}
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
          {`Showing the whole network. The queue is scoped to ${service}.`}
        </p>
      ) : null}
      <div className={styles.cardFoot}>
        <span className={styles.footMeta}>
          <span className={styles.eyebrow}>Today</span>
          <span className={styles.mono}>+{today}</span> expected
          {dischargesHeldUp > 0 ? (
            <>
              <StatusGlyph tone="warning" size={9} />
              <span className={styles.mono}>{dischargesHeldUp}</span>{" "}
              {dischargesHeldUp === 1 ? "discharge held up" : "discharges held up"}
            </>
          ) : null}
        </span>
        <Link href={WARD_CAPACITY_HREF} className={styles.footLink}>
          Open Capacity
        </Link>
      </div>
    </Card>
  );
}
