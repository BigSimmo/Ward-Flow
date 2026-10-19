"use client";

import { ChevronDown, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Button,
  Card,
  CardHead,
  FilterChip,
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
  candidateReason,
  eligibleCandidatesAmong,
  restrictionNotice,
  shortlistCandidates,
  wardServiceOrder,
} from "@/components/ward-management/ward-derivations";
import type { BedRelease, HealthService, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { usePatientOf } from "@/components/ward-management/ward-patient-name";
import { siteByCode } from "@/components/ward-management/ward-sites";
import {
  deriveServiceBedAlerts,
  formatOccupancyPercent,
} from "@/components/ward-management/shell/ward-service-bed-alerts";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";

import { hubStatusText } from "./flow-diagram";
import { fitGroups } from "./home-fit";
import styles from "./home.module.css";

import { useWardNetwork } from "@/components/ward-management/ward-flow-provider";
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
  /** Offer: refers this patient to this ward, with an Undo window on the toast. */
  onOffer: (unitId: string) => void;
  /** A ward offered inside its Undo window: the row already reads Offered. */
  pendingOfferUnitId?: string;
  parallelReferralCap: number;
  /** Discharges held up today (`wardNavCounts().discharges`), for the foot. */
  dischargesHeldUp: number;
  service: HealthService | null;
};

type Candidate = ReturnType<typeof eligibleCandidatesAmong>[number];

function unitKind(unit: Unit) {
  const category = wardCategory(unit);
  return category === "Locked" ? "secure" : category.toLowerCase();
}

/**
 * Home's State bedflow card (direction A, owner 10 Oct 2026): every inpatient ward, grouped by
 * health service, with its ready, pulled, closed and occupied beds. With a patient in Placement the
 * card names them on one line with how many wards fit, marks the best fit on its row, and puts
 * Offer on each ward that fits. "Fits first" lifts those wards to the top of each group. Wards that
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
  pendingOfferUnitId,
  parallelReferralCap,
  dischargesHeldUp,
  service,
}: HomeBedflowProps) {
  const network = useWardNetwork();
  const patientOf = usePatientOf();
  const shortlist = useMemo(
    () => (movement ? eligibleCandidatesAmong(movement, units, now, parallelReferralCap) : []),
    [movement, units, now, parallelReferralCap],
  );
  const byUnitId = useMemo(() => new Map(shortlist.map((candidate) => [candidate.unit.id, candidate])), [shortlist]);
  const fits = shortlist.filter((candidate) => candidate.verdict.eligible);
  const bestFit: Candidate | undefined = fits[0];
  const [fitsFirst, setFitsFirst] = useState(false);

  // FitHighlight (`home-fit.ts`): every ward in the network that fits this patient, not only the
  // three the routed shortlist keeps. Green where a bed is ready, amber where the ward fits but has
  // no bed now. Placement counts the same groups, so the two columns agree.
  const fitGroupsForMovement = useMemo(
    () => (movement ? fitGroups(shortlistCandidates(movement, units, now), movement) : undefined),
    [movement, units, now],
  );
  const fitByUnitId = useMemo(() => {
    const map = new Map<string, "bed" | "no-bed">();
    for (const candidate of fitGroupsForMovement?.bed ?? []) map.set(candidate.unit.id, "bed");
    for (const candidate of fitGroupsForMovement?.["no-bed"] ?? []) map.set(candidate.unit.id, "no-bed");
    return map;
  }, [fitGroupsForMovement]);
  const bedFitCount = fitGroupsForMovement?.bed.length ?? 0;
  const noBedCount = fitGroupsForMovement?.["no-bed"].length ?? 0;
  const reviewCount = fitGroupsForMovement?.review.length ?? 0;

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
  const fitRank = (unit: Unit) => {
    const fit = fitByUnitId.get(unit.id);
    return fit === "bed" ? 0 : fit === "no-bed" ? 1 : 2;
  };
  const orderUnits = (groupUnits: Unit[]) =>
    movement && fitsFirst ? [...groupUnits].sort((a, b) => fitRank(a) - fitRank(b)) : groupUnits;

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
    // Audit S-21: a voluntary patient's locked ward reads Review, not fit (`home-fit.ts`).
    const fit = candidate?.verdict.eligible === true && notice?.level !== "voluntary_on_locked";
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
              {/* A glyph, not a word pill, so the ward name keeps its width (device audit, 11 Oct
                  2026: "Mental He..." was cut beside "Best fit"). */}
              {isBest ? (
                <span className={styles.unitBestGlyph} title="Best fit">
                  <Star size={12} aria-hidden="true" />
                  <span className="sr-only">Best fit</span>
                </span>
              ) : null}
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
          {isReferred || pendingOfferUnitId === unit.id ? (
            <span className={styles.unitOffered} data-testid={`ward-bedflow-offered-${unit.id}`}>
              <StatusGlyph tone="info" size={9} />
              Offered
            </span>
          ) : fit || optionFit === "bed" ? (
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
        aside={
          movement ? (
            <FilterChip pressed={fitsFirst} onPressedChange={setFitsFirst} className={styles.noShrink}>
              Fits first
            </FilterChip>
          ) : undefined
        }
      />
      {movement && who ? (
        <div className={styles.forStrip} data-testid="ward-bedflow-subject">
          {/* FitHighlight summary (v10 Home): "Jasper Embleton ✓ 7 fit ● 0 no bed ○ 5 review", the
              same three groups Placement lists. Words neutral; the glyphs carry the tone. */}
          <div className={styles.forLine}>
            <span className="sr-only">For</span>
            <strong className={styles.forName}>{who.formalName}</strong>
            <span className={styles.forFits}>
              <span className={styles.forCount}>
                <StatusGlyph tone="success" size={9} />
                <span className={styles.mono}>{bedFitCount}</span> fit
              </span>
              <span className={styles.forCount}>
                <StatusGlyph tone="warning" size={9} />
                <span className={styles.mono}>{noBedCount}</span> no bed
              </span>
              <span className={styles.forCount}>
                <StatusGlyph tone="neutral" size={9} />
                <span className={styles.mono}>{reviewCount}</span> review
              </span>
            </span>
          </div>
          {/* Where this patient stands, once a destination or referral is recorded, or when no
              candidate is eligible (the line then names how many were excluded). */}
          {movement.acceptedUnitId || movement.referredUnitIds.length > 0 || !bestFit ? (
            // The name already leads the line above, so the status drops it (device audit, 11 Oct
            // 2026: the repeated name pushed this onto two lines).
            <p className={styles.forStatus}>
              {sentenceCase(
                hubStatusText(movement, shortlist, units, now, who.displayName).replace(`${who.displayName} — `, ""),
              )}
            </p>
          ) : null}
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
                {orderUnits(group.units).map(renderUnit)}
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
        <Legend items={LEGEND} className={styles.flowLegend} />
        <span className={styles.footMeta}>
          <span className={styles.mono}>+{today}</span> today
          {dischargesHeldUp > 0 ? (
            <>
              <StatusGlyph tone="warning" size={9} />
              <span className={styles.mono}>{dischargesHeldUp}</span> held up
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

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
