"use client";

// Simplification 26 Nov 2026 (fold the Bed board into Ward, Josh's approved version, item 13): the
// board's "Also on this ward" figures that had no other home (Pulled, not arrived; Away at an ED; On
// leave; Over 3 months; Out of service), for the Ward hero's band. Each value is derived by the same
// calls `WardBoard` makes (`buildIncoming`, `buildOccupants`, `buildTiles`, `capacityBreakdownLists`),
// and each figure keeps the board's count breakdown, so the two can never disagree.

import { capacityBreakdownLists } from "@/components/ward-management/ward-bed-availability";
import type { BreakdownRow } from "@/components/ward-management/count-breakdown-model";
import { leaveStays, stayBreakdownRows } from "@/components/ward-management/count-breakdown-rows";
import { derivedBedReleases } from "@/components/ward-management/ward-discharge-dates";
import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { buildIncoming, buildOccupants, buildTiles } from "./ward-board-model";

export type AlsoOnWardFigure = {
  key: "pulled" | "awayAtEd" | "onLeave" | "overThreeMonths" | "blockedBeds";
  /** The band's short word. */
  word: string;
  /** The shared label, read in full. */
  label: string;
  value: number;
  rows?: () => readonly BreakdownRow[];
  /** The stays this figure counts, so a chip can light their beds. Absent for beds, not people. */
  ids?: ReadonlySet<string>;
};

export function useAlsoOnWardFigures(unit: Unit | undefined): AlsoOnWardFigure[] {
  const {
    admissions,
    leaveBeds,
    movements,
    bedReleases: liveBedReleases,
    patients,
    resolvePatientIdentity,
    wardReferralInbox,
  } = useWardFlowSelect(
    "admissions",
    "leaveBeds",
    "movements",
    "bedReleases",
    "patients",
    "resolvePatientIdentity",
    "wardReferralInbox",
  );
  const now = useWardFlowClock();
  const canOpenHref = useCanOpenHref();
  if (!unit) return [];
  const bedReleases = derivedBedReleases([...admissions], now);
  const namedHolds = [...movements, ...(wardReferralInbox?.(unit.id) ?? [])];
  const readyReleases = liveBedReleases ? [...liveBedReleases] : bedReleases;
  const tiles = buildTiles(unit, admissions, readyReleases, now, { leaveBeds, holds: namedHolds });
  const occupants = buildOccupants(unit, admissions, now, leaveBeds);
  const pulledIn = buildIncoming(unit, admissions, movements, now).filter((person) => person.state === "pulled");
  const dayLists = capacityBreakdownLists(unit, bedReleases, leaveBeds, now);
  const awayAtEd = occupants.filter((occupant) => occupant.awayAtEdHours !== null);
  const overThreeMonths = tiles.filter((tile) => tile.kind === "occupied" && tile.bandId === "over-3-months");
  const outOfService = tiles.filter((tile) => tile.kind === "blocked").length;
  const personOf = (admissionId: string) => {
    const subject = admissions.find((a) => a.id === admissionId) ?? { id: admissionId };
    const resolved = resolvePatientIdentity
      ? resolvePatientIdentity(subject)
      : resolveSubjectPatient(subject, { patients, movements });
    return resolved.patient
      ? { name: resolved.formalName, href: patientHref(resolved.patient.id) }
      : { name: "Name not recorded" };
  };
  const rowsOf = (stays: readonly { key: string; admissionId: string }[]) => () =>
    stayBreakdownRows(stays, personOf, canOpenHref);
  return [
    {
      key: "pulled",
      word: "Pulled, not arrived",
      label: "Pulled, not arrived",
      value: pulledIn.length,
      rows: rowsOf(pulledIn.map((person) => ({ key: person.key, admissionId: person.key }))),
      ids: new Set(pulledIn.map((person) => person.key)),
    },
    {
      key: "awayAtEd",
      word: "Away at an ED",
      label: "Away at an ED",
      value: awayAtEd.length,
      rows: rowsOf(awayAtEd.map((occupant) => ({ key: occupant.key, admissionId: occupant.admissionId }))),
      ids: new Set(awayAtEd.map((occupant) => occupant.admissionId)),
    },
    {
      key: "onLeave",
      word: "On leave",
      label: CAPACITY_FIGURE_LABELS.onLeave,
      value: dayLists.onLeave.length,
      rows: rowsOf(leaveStays(dayLists.onLeave)),
      ids: new Set(leaveStays(dayLists.onLeave).map((stay) => stay.admissionId)),
    },
    {
      key: "overThreeMonths",
      word: "Over 3 months",
      label: "Here over 3 months",
      value: overThreeMonths.length,
      rows: rowsOf(overThreeMonths.map((tile) => ({ key: tile.key, admissionId: tile.key }))),
      ids: new Set(overThreeMonths.map((tile) => tile.key)),
    },
    { key: "blockedBeds", word: "Out of service", label: "Out of service", value: outOfService },
  ];
}
