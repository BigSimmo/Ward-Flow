/**
 * **A DESK'S PLACE IN WORDS — "Ward 6B", "Fiona Stanley ED", "South Metro".**
 *
 * Plain functions with no React, so the shared workspace's sign-in screens can name a role without
 * loading the app shell.
 */
import {
  ACCESS_ROLE_LABELS,
  ROLE_SCOPE_KINDS,
  type WardAccess,
  type WardAccessRole,
  type WardAccessScope,
} from "@/components/ward-management/ward-role-access";
import { HEALTH_SERVICES, type Unit } from "@/components/ward-management/ward-model";
import {
  STANDARD_WARD_SITES,
  allEmergencyDepartments,
  edById,
  siteByCode,
} from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

/** Where the desk is, in words: "Ward 6B", "Fiona Stanley ED", "South Metro". */
export function accessPlaceLabel(access: WardAccess, units: readonly Unit[]): string {
  const scope = access.scope;
  switch (scope.kind) {
    case "statewide":
      return "Statewide";
    case "service":
      return scope.service;
    case "site":
      return siteByCode(scope.siteCode)?.name ?? scope.siteCode;
    case "ward":
      return scope.unitIds.map((id) => units.find((unit) => unit.id === id)?.name ?? id).join(", ");
    case "ed":
      return edById(scope.edId)?.name ?? scope.edId;
    case "team":
      return scope.teamName;
    case "jobs":
      return scope.service === undefined ? "Assigned transport jobs" : `Transport jobs, ${scope.service}`;
  }
}

/** The standard network's wards, for naming places before the shared board is read. */
export const SEED_UNITS: readonly Unit[] = STANDARD_WARD_SITES.flatMap((site) => site.units);

/** A role and place in words on the standard network, for the shared workspace's status line. */
export function sharedDeskLabel(access: WardAccess): string {
  return `${ACCESS_ROLE_LABELS[access.role]}, ${accessPlaceLabel(access, SEED_UNITS)}`;
}

/** Every place a role may hold, in words. Built from the workspace, never a literal list of wards. */
export function placeOptions(
  role: WardAccessRole,
  units: readonly Unit[],
): { key: string; label: string; scope: WardAccessScope }[] {
  const options: WardAccessScope[] = [];
  for (const kind of ROLE_SCOPE_KINDS[role]) {
    if (kind === "statewide") options.push({ kind: "statewide" });
    // A granted officer always names its service (D-80 item 7).
    if (kind === "jobs") for (const service of HEALTH_SERVICES) options.push({ kind: "jobs", service });
    if (kind === "service") for (const service of HEALTH_SERVICES) options.push({ kind: "service", service });
    if (kind === "site")
      for (const siteCode of [...new Set(units.map((unit) => unit.siteCode))]) options.push({ kind: "site", siteCode });
    if (kind === "ward") for (const unit of units) options.push({ kind: "ward", unitIds: [unit.id] });
    if (kind === "ed") for (const ed of allEmergencyDepartments()) options.push({ kind: "ed", edId: ed.id });
    if (kind === "team")
      for (const teamName of Object.values(COMMUNITY_TEAMS)) options.push({ kind: "team", teamName });
  }
  return options.map((scope) => ({
    key: JSON.stringify(scope),
    label: accessPlaceLabel({ role, scope }, units),
    scope,
  }));
}
