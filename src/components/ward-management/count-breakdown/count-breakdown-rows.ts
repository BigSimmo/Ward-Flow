/**
 * Rows for a count breakdown (feature plan item 5), built from the very list a figure counts. Pure.
 * Each builder keeps every item it is given, in the order given, so the rows add up to the figure;
 * nothing here filters, ranks or reorders anybody (D-71).
 */
import { durMinutes } from "@/components/wf/format";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { BedRelease, LeaveBed, Movement, Unit } from "@/components/ward-management/ward-model";
import { minutesInEd } from "@/components/ward-management/ward-shared-figures";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";
import { movementHref, wardBoardHref } from "@/components/ward-management/shell/ward-facade";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";

import type { BreakdownRow } from "./count-breakdown-model";

/** A person's name as a list shows it (D-83: formal name), and their patient id when linked. */
export type BreakdownPerson = { name: string; patientId?: string };

/** One row per movement, opening the movement's record. */
export function movementBreakdownRows(
  movements: readonly Movement[],
  personOf: (movement: Movement) => BreakdownPerson,
  now: Instant,
  canOpen: (href: string) => boolean = () => true,
): BreakdownRow[] {
  return movements.map((movement) => {
    const ed = edById(movement.originEdId);
    const href = movementHref(movement.id);
    const parts = [ed?.name, `open ${durMinutes(minutesInEd(movement, now))}`].filter(Boolean);
    return {
      id: movement.id,
      label: personOf(movement).name,
      detail: parts.join(" · "),
      href: canOpen(href) ? href : undefined,
    };
  });
}

/** One row per ward holding ready beds, with its count, opening the ward's bed board. */
export function wardReadyBreakdownRows(
  wards: readonly { unit: Unit; ready: number }[],
  canOpen: (href: string) => boolean = () => true,
): BreakdownRow[] {
  return wards
    .filter((ward) => ward.ready > 0)
    .map(({ unit, ready }) => {
      const href = wardBoardHref(unit.id);
      return {
        id: unit.id,
        label: unit.name,
        detail: siteByCode(unit.siteCode)?.name,
        href: canOpen(href) ? href : undefined,
        count: ready,
      };
    });
}

/**
 * One row per stay (an admission, a bed release or a leave bed, by its `admissionId`), naming the
 * person and opening their page when the stay is linked to one.
 */
export function stayBreakdownRows(
  stays: readonly { key: string; admissionId: string; detail?: string }[],
  personOf: (admissionId: string) => BreakdownPerson,
  canOpen: (href: string) => boolean = () => true,
): BreakdownRow[] {
  return stays.map((stay) => {
    const person = personOf(stay.admissionId);
    const href = person.patientId ? patientHref(person.patientId) : undefined;
    return {
      id: stay.key,
      label: person.name,
      detail: stay.detail,
      href: href && canOpen(href) ? href : undefined,
    };
  });
}

/** Bed releases as stays. */
export function releaseStays(releases: readonly BedRelease[]) {
  return releases.map((release) => ({ key: release.id, admissionId: release.admissionId }));
}

/** Leave beds as stays. */
export function leaveStays(leave: readonly LeaveBed[]) {
  return leave.map((bed) => ({ key: bed.id, admissionId: bed.admissionId }));
}
