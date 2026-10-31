/**
 * **WHO MAY GIVE WHOM ACCESS — the access admin's rules (role access plan, later pass, Josh's go
 * 16 Oct 2026).**
 *
 * One set of rules for granting and removing roles, for cover of a second ward or ED,
 * and for a person with no role asking for one. The local demo's Access admin screen and the
 * shared server (`backend/ward-flow/engine.ts`) both read this module, so the screen and the
 * server can never disagree about who may give what.
 *
 * - Nobody grants themselves a role, and nobody grants a role wider than their own place.
 * - Every granted role works immediately; no second approval is required (D-66).
 * - Every role has an end date, at most 12 months away (D-80). One not used for the set time is
 *   switched off by itself.
 * - Cover is given by a coordinator, or by a nurse in charge or ED clinician for their own ward
 *   or ED, to a colleague who already holds a ward or ED role (D-80), for one shift at most. It needs no admin, because an admin is not on at
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

// The few rules every screen's shell needs live apart, so the shell does not load all of these.
export { PUSH_ROLES, STEP_UP_MINUTES, withCover } from "./ward-access-shell-rules";

/** Cover lasts one shift at most (synthetic). */
export const COVER_MAX_MINUTES = CLINICAL_VALUES.coverLength.value * 60;
/** The review list shows a role ending this soon (synthetic). */
export const ACCESS_ENDING_SOON_MINUTES = CLINICAL_VALUES.accessExpiringSoon.value * MINUTES_PER_DAY;
/** A role not used for this long stops working by itself (synthetic). */
export const ACCESS_UNUSED_MINUTES = CLINICAL_VALUES.accessUnused.value * MINUTES_PER_DAY;
/** The latest end date a role may be given (D-80), so every role comes back to a review. */
export const ACCESS_MAX_TERM_MINUTES = CLINICAL_VALUES.accessMaxTerm.value * MINUTES_PER_DAY;
/** Said wherever a role's end date is past the ceiling, by the screen and the server alike. */
export const ACCESS_TOO_LONG = "A role lasts 12 months at most. Give it again at its review.";
/** Said when cover is offered to an account that holds no ward or ED role of its own (D-80). */
export const COVER_NEEDS_ROLE = "Cover goes only to a colleague who already holds a ward or ED role.";

type AccessMembershipKind = "role" | "cover";

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
  /**
   * Set only when an older shared backend, which still wants a second approval, reports this role
   * as not yet usable. The website then shows it as inactive instead of falsely "Active".
   */
  readonly blockedByOlderServer?: boolean;
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

/** Who may grant and remove roles: the access admin, and the statewide coordinator. */
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
 * than their own. A service covers that service's sites, wards and EDs, and, since decision 42
 * (Josh, 31 Oct 2026), its own community teams and its own transport officers' jobs, so a service's
 * access admin gives those roles inside its service. A team whose service is unknown, a job list
 * naming no service, and a statewide scope still need a statewide place. Granting stays with the
 * access admin and the statewide coordinator (`managesAccess`): a service coordinator gains nothing.
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
    case "team":
      return places.teamService?.(places.teamSlug(inner.teamName)) === outer.service;
    case "jobs":
      return inner.service === outer.service;
    default:
      return false;
  }
}

const NOT_ADMIN = "Granting and removing roles is not part of your role.";
const WIDER = "That role is wider than your own.";

/**
 * @deprecated Role grants take effect immediately; the legacy approval action always refuses.
 * Kept only so older client callers fail explicitly while they migrate away from approval.
 */
export function approveRefusal(input: {
  readonly approver: WardAccess;
  readonly approverId: string;
  readonly membership: AccessMembership;
  readonly places: AccessPlaces;
}): string | null {
  const { membership } = input;
  if (!managesAccess(input.approver)) return NOT_ADMIN;
  if (!scopeWithinScope(membership.access.scope, input.approver.scope, input.places)) return WIDER;
  return "That role is not waiting for approval.";
}

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
  if (input.expiresAt > input.now + ACCESS_MAX_TERM_MINUTES) return ACCESS_TOO_LONG;
  if (!scopeNamesPlace(input.access.scope, input.places)) return "That place is not in the workspace.";
  if (!scopeWithinScope(input.access.scope, input.granter.scope, input.places)) return WIDER;
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
  // A coordinator sees all cover inside its place, so may end any of it there, not only its own.
  if (
    membership.kind === "cover" &&
    input.remover.role === "coordinator" &&
    scopeWithinScope(membership.access.scope, input.remover.scope, input.places)
  )
    return null;
  if (!managesAccess(input.remover)) return NOT_ADMIN;
  if (!scopeWithinScope(membership.access.scope, input.remover.scope, input.places)) return WIDER;
  return null;
}

export type MembershipStatus = "active" | "inactive" | "unused" | "ended";

/**
 * Where a role stands now. "Inactive" is a role an older shared backend still holds back for an
 * approval it no longer gets (only seen while the website is updated before the backend). "Unused" is a role not worked as for the set time: it is switched off
 * by itself, and the review list says so. Cover is too short ever to go unused.
 */
export function membershipStatus(membership: AccessMembership, now: Instant): MembershipStatus {
  if (membership.revokedAt !== null || membership.expiresAt <= now) return "ended";
  if (membership.blockedByOlderServer) return "inactive";
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
 * its own ED, so a colleague can hold it while they are off the floor. The colleague must already
 * hold a ward or ED role (D-80): `recipientRoles` is the roles they hold now, and an account with
 * neither is refused, so cover is never a way in for a new account.
 */
export function coverRefusal(input: {
  readonly giver: WardAccess;
  readonly giverId: string;
  readonly recipientId: string;
  readonly scope: WardAccessScope;
  readonly minutes: number;
  readonly places: AccessPlaces;
  readonly recipientRoles: readonly WardAccessRole[];
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
  if (!input.recipientRoles.some((role) => role === "ward" || role === "ed")) return COVER_NEEDS_ROLE;
  if (!Number.isInteger(input.minutes) || input.minutes < 1 || input.minutes > COVER_MAX_MINUTES)
    return `Cover lasts up to ${CLINICAL_VALUES.coverLength.value} hours.`;
  return null;
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
