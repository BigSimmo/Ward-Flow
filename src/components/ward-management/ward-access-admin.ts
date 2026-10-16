/**
 * **WHO MAY GIVE WHOM ACCESS — the access admin's rules (role access plan, later pass, Josh's go
 * 16 Oct 2026).**
 *
 * One set of rules for granting, approving and removing roles, for cover of a second ward or ED,
 * and for a person with no role asking for one. The local demo's Access admin screen and the
 * shared server (`backend/ward-flow/engine.ts`) both read this module, so the screen and the
 * server can never disagree about who may give what.
 *
 * - Nobody grants themselves a role, and nobody grants a role wider than their own place.
 * - A coordinator or access admin role works only once a second person approves it.
 * - Every role has an end date. One not used for the set time is switched off by itself.
 * - Cover is given by a coordinator, or by a nurse in charge or ED clinician for their own ward
 *   or ED, to a colleague, for one shift at most. It needs no admin, because an admin is not on at
 *   2 am, and it ends by itself.
 *
 * Pure and browser free. Times are `Instant` minutes; the server passes epoch minutes.
 */
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { MINUTES_PER_DAY, type Instant } from "@/components/ward-management/ward-clock";
import {
  accessIsValid,
  accessIsWholeNetwork,
  edInScope,
  type PlaceLookup,
  type WardAccess,
  type WardAccessRole,
  type WardAccessScope,
} from "@/components/ward-management/ward-role-access";

/** Roles that wait for a second person's approval before they work (plan decision 6). */
export const SECOND_APPROVER_ROLES: readonly WardAccessRole[] = ["coordinator", "admin"];

/** Cover lasts one shift at most (synthetic). */
export const COVER_MAX_MINUTES = CLINICAL_VALUES.coverLength.value * 60;
/** Granting access or breaking glass needs a sign-in this recent (synthetic). */
export const STEP_UP_MINUTES = CLINICAL_VALUES.stepUpWindow.value;
/** The review list shows a role ending this soon (synthetic). */
export const ACCESS_ENDING_SOON_MINUTES = CLINICAL_VALUES.accessExpiringSoon.value * MINUTES_PER_DAY;
/** A role not used for this long stops working by itself (synthetic). */
export const ACCESS_UNUSED_MINUTES = CLINICAL_VALUES.accessUnused.value * MINUTES_PER_DAY;

export type AccessMembershipKind = "role" | "cover";

/** One person's role at one place, as the access admin sees it. */
export type AccessMembership = {
  readonly id: string;
  readonly actorId: string;
  readonly access: WardAccess;
  readonly kind: AccessMembershipKind;
  readonly grantedBy: string;
  readonly grantedAt: Instant;
  readonly expiresAt: Instant;
  readonly approvedBy: string | null;
  /** The last time the person worked as this role, or `null` if never. */
  readonly lastUsedAt: Instant | null;
  readonly revokedAt: Instant | null;
};

/** A signed-in person with no role asking for one (feature 7). */
export type AccessRequest = {
  readonly id: string;
  readonly actorId: string;
  readonly access: WardAccess;
  readonly requestedAt: Instant;
  readonly decision: "approved" | "declined" | null;
};

/** The place answers these rules need: the access table's lookup plus every ward in the workspace. */
export type AccessPlaces = PlaceLookup & { readonly unitIds: readonly string[] };

/** Who may grant, approve and remove roles: the access admin, and the statewide coordinator. */
export function managesAccess(access: WardAccess): boolean {
  return access.role === "admin" || accessIsWholeNetwork(access);
}

/**
 * Whether a place names something in this workspace, so a grant never points at a ward, ED or site
 * that does not exist. A team is any name: one with no patients simply shows nobody.
 */
export function scopeNamesPlace(scope: WardAccessScope, places: AccessPlaces): boolean {
  switch (scope.kind) {
    case "site":
      return places.unitIds.some((id) => places.unitSiteCode(id) === scope.siteCode);
    case "ward":
      return scope.unitIds.every((id) => places.unitSiteCode(id) !== undefined);
    case "ed":
      return places.edSiteCode(scope.edId) !== undefined;
    default:
      return true;
  }
}

/**
 * Whether `inner` lies wholly inside `outer`, so nobody grants, approves or removes a role wider
 * than their own. A service covers that service's sites, wards and EDs only; statewide, team and
 * jobs scopes need a statewide place.
 */
export function scopeWithinScope(inner: WardAccessScope, outer: WardAccessScope, places: AccessPlaces): boolean {
  if (outer.kind === "statewide") return true;
  if (outer.kind !== "service") return false;
  switch (inner.kind) {
    case "service":
      return inner.service === outer.service;
    case "site": {
      const units = places.unitIds.filter((id) => places.unitSiteCode(id) === inner.siteCode);
      return units.length > 0 && units.every((id) => places.unitService(id) === outer.service);
    }
    case "ward":
      return inner.unitIds.every((id) => places.unitService(id) === outer.service);
    case "ed":
      return places.edService(inner.edId) === outer.service;
    default:
      return false;
  }
}

const NOT_ADMIN = "Granting and removing roles is not part of your role.";
const WIDER = "That role is wider than your own.";

/** Why this grant may not be made, or `null`. */
export function grantRefusal(input: {
  readonly granter: WardAccess;
  readonly granterId: string;
  readonly actorId: string;
  readonly access: WardAccess;
  readonly expiresAt: Instant;
  readonly now: Instant;
  readonly places: AccessPlaces;
}): string | null {
  if (!managesAccess(input.granter)) return NOT_ADMIN;
  if (!accessIsValid(input.access)) return "A role and a place that go together are required.";
  if (input.actorId === input.granterId) return "Nobody grants themselves a role.";
  if (!(input.expiresAt > input.now)) return "A role needs an end date in the future.";
  if (!scopeNamesPlace(input.access.scope, input.places)) return "That place is not in the workspace.";
  if (!scopeWithinScope(input.access.scope, input.granter.scope, input.places)) return WIDER;
  return null;
}

/** Whether the role waits for a second person before it works. */
export function needsSecondApprover(membership: Pick<AccessMembership, "access" | "kind">): boolean {
  return membership.kind === "role" && SECOND_APPROVER_ROLES.includes(membership.access.role);
}

/** Why this approval may not be given, or `null`. */
export function approveRefusal(input: {
  readonly approver: WardAccess;
  readonly approverId: string;
  readonly membership: AccessMembership;
  readonly places: AccessPlaces;
}): string | null {
  const { membership } = input;
  if (!managesAccess(input.approver)) return NOT_ADMIN;
  if (!scopeWithinScope(membership.access.scope, input.approver.scope, input.places)) return WIDER;
  if (!needsSecondApprover(membership) || membership.approvedBy !== null)
    return "That role is not waiting for approval.";
  if (membership.grantedBy === input.approverId || membership.actorId === input.approverId)
    return "A second person approves this role.";
  return null;
}

/** Why this role may not be removed by this person, or `null`. Cover is ended by its giver too. */
export function revokeRefusal(input: {
  readonly remover: WardAccess;
  readonly removerId: string;
  readonly membership: AccessMembership;
  readonly places: AccessPlaces;
}): string | null {
  const { membership } = input;
  if (membership.kind === "cover" && membership.grantedBy === input.removerId) return null;
  if (!managesAccess(input.remover)) return NOT_ADMIN;
  if (!scopeWithinScope(membership.access.scope, input.remover.scope, input.places)) return WIDER;
  return null;
}

export type MembershipStatus = "waiting" | "active" | "unused" | "ended";

/**
 * Where a role stands now. "Unused" is a role not worked as for the set time: it is switched off
 * by itself, and the review list says so. Cover is too short ever to go unused.
 */
export function membershipStatus(membership: AccessMembership, now: Instant): MembershipStatus {
  if (membership.revokedAt !== null || membership.expiresAt <= now) return "ended";
  if (needsSecondApprover(membership) && membership.approvedBy === null) return "waiting";
  if (membership.kind === "role" && (membership.lastUsedAt ?? membership.grantedAt) <= now - ACCESS_UNUSED_MINUTES)
    return "unused";
  return "active";
}

/** What the quarterly review list says about one role (feature 8). */
export function reviewNotes(membership: AccessMembership, now: Instant): { endingSoon: boolean; unused: boolean } {
  const status = membershipStatus(membership, now);
  return {
    endingSoon: status !== "ended" && membership.expiresAt - now <= ACCESS_ENDING_SOON_MINUTES,
    unused: status === "unused",
  };
}

/** The role a cover place carries: a ward's cover is a nurse in charge's, an ED's an ED clinician's. */
export function coverAccess(scope: WardAccessScope): WardAccess | null {
  if (scope.kind === "ward" && scope.unitIds.length === 1) return { role: "ward", scope };
  if (scope.kind === "ed") return { role: "ed", scope };
  return null;
}

/**
 * Why this cover may not be given, or `null` (feature 2). A coordinator gives cover of any ward or
 * ED inside its own place. A nurse in charge gives cover of its own ward, and an ED clinician of
 * its own ED, so a colleague can hold it while they are off the floor.
 */
export function coverRefusal(input: {
  readonly giver: WardAccess;
  readonly giverId: string;
  readonly recipientId: string;
  readonly scope: WardAccessScope;
  readonly minutes: number;
  readonly places: AccessPlaces;
}): string | null {
  const { giver, scope, places } = input;
  const access = coverAccess(scope);
  if (!access) return "Cover is for one ward or one ED.";
  if (!scopeNamesPlace(scope, places)) return "That place is not in the workspace.";
  const own =
    giver.role === "coordinator"
      ? scope.kind === "ward"
        ? scopeWithinScope(scope, giver.scope, places)
        : scope.kind === "ed" && edInScope(giver.scope, scope.edId, places)
      : giver.role === "ward"
        ? giver.scope.kind === "ward" && scope.kind === "ward" && giver.scope.unitIds.includes(scope.unitIds[0])
        : giver.role === "ed"
          ? giver.scope.kind === "ed" && scope.kind === "ed" && giver.scope.edId === scope.edId
          : false;
  if (!own)
    return giver.role === "coordinator" || giver.role === "ward" || giver.role === "ed"
      ? "That ward or ED is not in your own place."
      : "Giving cover is not part of your role.";
  if (input.recipientId === input.giverId) return "Nobody gives themselves cover.";
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > COVER_MAX_MINUTES)
    return `Cover lasts up to ${CLINICAL_VALUES.coverLength.value} hours.`;
  return null;
}

/**
 * A nurse in charge working with cover of more wards: the covered wards join its own, so night
 * cover of two wards is one desk. An ED desk works one ED at a time, so ED cover is its own choice
 * of who to work as, never merged.
 */
export function withCover(access: WardAccess, covers: readonly WardAccessScope[]): WardAccess {
  if (access.role !== "ward" || access.scope.kind !== "ward") return access;
  const unitIds = [...access.scope.unitIds];
  for (const cover of covers)
    if (cover.kind === "ward") for (const id of cover.unitIds) if (!unitIds.includes(id)) unitIds.push(id);
  return unitIds.length === access.scope.unitIds.length ? access : { role: "ward", scope: { kind: "ward", unitIds } };
}

/** Why this request may not be made, or `null`. One open request per person. */
export function requestRefusal(input: {
  readonly access: WardAccess;
  readonly openRequests: number;
  readonly places: AccessPlaces;
}): string | null {
  if (!accessIsValid(input.access)) return "A role and a place that go together are required.";
  if (!scopeNamesPlace(input.access.scope, input.places)) return "That place is not in the workspace.";
  if (input.openRequests > 0) return "You have already asked. An access admin will answer it.";
  return null;
}
