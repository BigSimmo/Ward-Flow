import { durMinutes } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { sourceWardName } from "@/components/ward-management/ward-movement-origin";
import { readyBedsNow, type ReservationReferral } from "@/components/ward-management/ward-bed-states";
import type { Instant } from "@/components/ward-management/ward-clock";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { BedRelease, EmergencyDepartment, Movement, Unit } from "@/components/ward-management/ward-model";
import { wardBedsInUse } from "@/components/ward-management/ward-occupancy";

import { FLOW_STAGES, flowStageOf } from "./priority-queue";

/**
 * Home's Pinned card (feature 31, 9 Nov 2026): the wards and patients this person pinned on this
 * device, in the order they were pinned, wards first. Pure: the card passes the pins, the world and
 * which addresses this desk may open, and draws what comes back. A pin that names nothing in today's
 * world, or that this desk may not open, is left out (it stays stored and returns when it can).
 *
 * The figures are the ones every other screen prints: Ready is `readyBedsNow`, occupied is
 * `wardBedsInUse` (the occupancy count), and a patient's step is Home's own Flow stage.
 */

export type PinnedWardRow = {
  kind: "ward";
  id: string;
  name: string;
  siteCode: string;
  ready: number;
  inUse: number;
  beds: number;
  href: string;
};

export type PinnedPatientRow = {
  kind: "patient";
  id: string;
  href: string;
  /** Where they are now: an ED, "In transit", a ward, or "Not in hospital". */
  where: string;
  /** Home's Flow stage for an open movement, "On ward" for a stay, else "No open movement". */
  step: string;
  /** How long the open movement has waited, e.g. "4h 12m". Absent when there is no open movement. */
  wait?: string;
  waitedMinutes?: number;
};

export type PinnedRows = { wards: PinnedWardRow[]; patients: PinnedPatientRow[] };

export type PinnedWorld = {
  units: readonly Unit[];
  admissions: readonly Admission[];
  bedReleases: readonly BedRelease[];
  movements: readonly Movement[];
  /** D-115: referrals, so a bed named for an accepted referral is not counted as ready. */
  referrals: readonly ReservationReferral[];
  /**
   * Which patient a movement or stay belongs to, through the shared resolver (`usePatientOf`), so
   * this file never reads the patient link itself (D-14 default-deny guard).
   */
  patientIdOf: (record: Movement | Admission) => string | undefined;
  patientIds: ReadonlySet<string>;
  eds: readonly EmergencyDepartment[];
};

const STEP_LABEL = new Map<string, string>(FLOW_STAGES.map((stage) => [stage.id, stage.label]));

/** The newest open movement for a patient, resolved the way every patient row is. */
function openMovementOf(patientId: string, world: PinnedWorld): Movement | undefined {
  for (let index = world.movements.length - 1; index >= 0; index -= 1) {
    const movement = world.movements[index];
    if (isOpen(movement) && world.patientIdOf(movement) === patientId) return movement;
  }
  return undefined;
}

function liveStayOf(patientId: string, world: PinnedWorld): Admission | undefined {
  const stays = world.admissions.filter((a) => a.state !== "departed" && world.patientIdOf(a) === patientId);
  return stays.findLast((a) => a.state === "occupied") ?? stays.at(-1);
}

export function pinnedRows(
  pins: { wards: readonly string[]; patients: readonly string[] },
  world: PinnedWorld,
  now: Instant,
  hrefs: { ward: (id: string) => string; patient: (id: string) => string; canOpen: (href: string) => boolean },
): PinnedRows {
  const unitsById = new Map(world.units.map((unit) => [unit.id, unit]));
  const edsById = new Map(world.eds.map((ed) => [ed.id, ed]));

  const wards: PinnedWardRow[] = [];
  for (const id of pins.wards) {
    const unit = unitsById.get(id);
    const href = hrefs.ward(id);
    if (!unit || !hrefs.canOpen(href)) continue;
    wards.push({
      kind: "ward",
      id,
      name: unit.name,
      siteCode: unit.siteCode,
      ready: readyBedsNow(unit, world.admissions, world.bedReleases, [...world.movements, ...world.referrals]),
      inUse: wardBedsInUse(unit, world.admissions, world.bedReleases),
      beds: unit.beds,
      href,
    });
  }

  const patients: PinnedPatientRow[] = [];
  for (const id of pins.patients) {
    const href = hrefs.patient(id);
    if (!world.patientIds.has(id) || !hrefs.canOpen(href)) continue;
    const movement = openMovementOf(id, world);
    if (movement) {
      const stage = flowStageOf(movement);
      const ed = movement.originEdId === undefined ? undefined : edsById.get(movement.originEdId);
      const waitedMinutes = Math.max(0, now - movement.openedAt);
      patients.push({
        kind: "patient",
        id,
        href,
        // A ward-to-ward or inpatient transfer starts at the sending ward, not the first ED (WF-J03).
        where:
          stage === "moving"
            ? "In transit"
            : (sourceWardName(movement, world.admissions, world.units) ?? (ed ? `${ed.siteCode} ED` : "Community")),
        step: STEP_LABEL.get(stage) ?? "Not recorded",
        wait: durMinutes(waitedMinutes),
        waitedMinutes,
      });
      continue;
    }
    const stay = liveStayOf(id, world);
    if (stay) {
      patients.push({
        kind: "patient",
        id,
        href,
        where: unitsById.get(stay.unitId)?.name ?? "Ward not recorded",
        // A waitlisted or pulled stay holds a bed before arrival, so only an occupied one is on the ward.
        // F-91 (K23): "held" is a leave bed's word; a stay before arrival is pulled or waitlisted.
        step: stay.state === "occupied" ? "On ward" : stay.state === "pulled" ? "Bed pulled" : "On the waiting list",
      });
      continue;
    }
    patients.push({ kind: "patient", id, href, where: "Not in hospital", step: "No open movement" });
  }
  return { wards, patients };
}
