/**
 * SERVICE MEMBERSHIP — one pure module, shared by every screen the service chooser scopes
 * (build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2, item 44). Until this
 * module existed, the only join deciding "does this belong to service S" lived inside the
 * handover page (`handover/handover-page.tsx`'s `movementInHandoverScope`, `case "service"`).
 * That page now delegates its service case here rather than keeping its own copy — a second
 * copy of this join is how a screen comes to disagree with the handover page about what "in
 * South Metro" means.
 *
 * THREE RULES, EXACTLY AS §2 STATES THEM, AND NO OTHERS:
 * - A unit or an emergency department belongs to its site's service.
 * - A movement belongs to each service among its origin ED, its accepted ward and every ward it
 *   was referred to — through their sites, the same three-part join the handover page already
 *   proved out.
 * - A referral belongs to each service among its origin site, its accepted wards (an
 *   `acceptedUnitId` only ever appears once a `psychiatric_ward` addressing has been accepted)
 *   and its emergency-department destinations. A community-team destination adds nothing — this
 *   application holds no registry mapping a team name to a site or a service.
 *
 * ⚠️ **NEVER `homeRegion`.** Owner ruling Q-2 (`docs/ward-flow/owner-decisions-2026-09-1x.md`):
 * catchment — where a person lives — is INFORMATION, never a filter, and no bed is hidden or
 * excluded by it. `homeRegion` is a ten-way geographic guess (`HOME_REGIONS`) with no join to a
 * `HealthService` at all; reading it here would be inventing that join, not deriving it. Neither
 * `movementHealthServices` nor `referralHealthServices` below so much as imports `HomeRegion`.
 *
 * **UNRESOLVABLE MEANS ALWAYS SHOWN, NEVER EXCLUDED.** An item whose origin cannot be resolved to
 * any site, and which touches no ward or ED that resolves either, has "no recorded service" — and
 * the safe reading, the same one `parseHandoverScope` already gives an unrecognised scope value,
 * is to show MORE than a broken join would hide, never less. `movementBelongsToService` and
 * `referralBelongsToService` both return `true` for such an item regardless of which service is
 * asked about; `movementHasNoRecordedService` / `referralHasNoRecordedService` name that state
 * explicitly so a caller can render "{n} with no recorded service {is|are} included." (§3).
 *
 * **URGENCY IS DUPLICATED HERE ON PURPOSE, NOT BY OVERSIGHT.** `handover-page.tsx` already
 * exports `movementIsUrgent` with this exact rule, but this module owns lines 118–166 of that
 * file only — not the line range `movementIsUrgent` sits on (186–190) — and importing it from
 * there would also make this module depend on a page component for a two-line clock check, the
 * wrong direction (the page should depend on this shared module, not the reverse). The rule is
 * copied verbatim rather than re-derived: flagged urgent outranks everything, or a legal deadline
 * has been breached. A future pass that also re-points `handover-page.tsx`'s own `movementIsUrgent`
 * at this one can delete the page's copy without changing behaviour anywhere.
 */
import { clockState, type Instant } from "@/components/ward-management/ward-clock";
import { SEVERE_CAUSES, delayGroups } from "@/components/ward-management/delays/delays-derivations";
import { isOpen } from "@/components/ward-management/ward-derivations";
import type { WardConfiguration } from "@/components/ward-management/ward-configuration";
import { type HealthService, type Movement, type Referral, type Unit } from "@/components/ward-management/ward-model";
import { edById, siteByCode } from "@/components/ward-management/ward-sites";

/** A unit's service is its site's service — the whole of the first membership rule. */
export function unitHealthService(unit: Unit): HealthService | undefined {
  return siteByCode(unit.siteCode)?.service;
}

/** An emergency department's service is its site's service. `undefined` for an id that resolves
 *  to no real department — never a guessed service. */
export function edHealthService(edId: string): HealthService | undefined {
  const ed = edById(edId);
  return ed ? siteByCode(ed.siteCode)?.service : undefined;
}

/**
 * Short health service acronym for space-constrained UI badges:
 * EMHS, NMHS, SMHS, WACHS, CAHS, PRIV.
 */
export function healthServiceAcronym(service: HealthService | string | undefined): string {
  if (!service) return "";
  switch (service) {
    case "East Metro":
      return "EMHS";
    case "North Metro":
      return "NMHS";
    case "South Metro":
      return "SMHS";
    case "WACHS":
      return "WACHS";
    case "CAHS":
      return "CAHS";
    case "Private":
      return "PRIV";
    default:
      return service;
  }
}

function unitServiceById(unitId: string, units: Unit[]): HealthService | undefined {
  const unit = units.find((candidate) => candidate.id === unitId);
  return unit ? unitHealthService(unit) : undefined;
}

/**
 * EVERY SERVICE A MOVEMENT BELONGS TO — the origin ED's service, the accepted ward's service, and
 * every referred ward's service, deduplicated. A movement can honestly belong to more than one
 * service at once (it opened at an East Metro ED and was referred on to a Private ward); this
 * returns the whole set rather than picking one, so `movementBelongsToService` can ask a plain
 * membership question about any of them.
 *
 * Byte-for-byte the same three-part join `handover-page.tsx`'s own `movementInHandoverScope`
 * (`case "service"`) used to carry on its own — origin ED first, then every related unit.
 */
export function movementHealthServices(movement: Movement, units: Unit[]): HealthService[] {
  const services = new Set<HealthService>();
  const originService = edHealthService(movement.originEdId);
  if (originService !== undefined) services.add(originService);
  const relatedUnitIds = movement.acceptedUnitId
    ? [movement.acceptedUnitId, ...movement.referredUnitIds]
    : movement.referredUnitIds;
  for (const unitId of relatedUnitIds) {
    const service = unitServiceById(unitId, units);
    if (service !== undefined) services.add(service);
  }
  return [...services];
}

/** Whether a movement has no service this module can resolve at all — not "excluded from every
 *  service", the opposite: an item this join cannot honestly place anywhere. */
export function movementHasNoRecordedService(movement: Movement, units: Unit[]): boolean {
  return movementHealthServices(movement, units).length === 0;
}

/**
 * THE MEMBERSHIP QUESTION A SCOPED SCREEN ACTUALLY ASKS: does this movement belong to `service`?
 * An unresolvable movement (`movementHasNoRecordedService`) answers `true` for every service —
 * always shown, per this module's own doc comment — rather than `false` for all of them, which
 * would silently exclude it from a scoped list with nothing here to catch that.
 */
export function movementBelongsToService(movement: Movement, service: HealthService, units: Unit[]): boolean {
  const services = movementHealthServices(movement, units);
  return services.length === 0 || services.includes(service);
}

/**
 * EVERY SERVICE A REFERRAL BELONGS TO — its origin site, each destination's accepted ward (only
 * ever set on a `psychiatric_ward` addressing once it has actually been accepted —
 * `ReferralAddressing.acceptedUnitId`'s own doc comment), and each `emergency_department`
 * destination's own department, regardless of that addressing's state (it names WHERE the
 * referral was sent, not whether it was accepted). A `community_team` destination adds nothing:
 * `ReferralDestination`'s own `community_team` arm carries a name, never a site or a service, and
 * this application holds no registry that could resolve one from the other.
 *
 * **NEVER `referral.homeRegion`** — see this module's own top comment for why that join does not
 * exist here.
 */
export function referralHealthServices(referral: Referral, units: Unit[]): HealthService[] {
  const services = new Set<HealthService>();
  const originService = siteByCode(referral.originSiteCode)?.service;
  if (originService !== undefined) services.add(originService);
  for (const addressing of referral.destinations) {
    const destination = addressing.destination;
    if (destination.kind === "psychiatric_ward") {
      if (addressing.acceptedUnitId === undefined) continue;
      const service = unitServiceById(addressing.acceptedUnitId, units);
      if (service !== undefined) services.add(service);
    } else if (destination.kind === "emergency_department") {
      const service = edHealthService(destination.edId);
      if (service !== undefined) services.add(service);
    }
    // destination.kind === "community_team": adds no service, by design — see the doc comment.
  }
  return [...services];
}

/** Whether a referral has no service this module can resolve at all. */
export function referralHasNoRecordedService(referral: Referral, units: Unit[]): boolean {
  return referralHealthServices(referral, units).length === 0;
}

/** The membership question a scoped screen asks about a referral. Unresolvable means always
 *  shown, for the same reason `movementBelongsToService` gives. */
export function referralBelongsToService(referral: Referral, service: HealthService, units: Unit[]): boolean {
  const services = referralHealthServices(referral, units);
  return services.length === 0 || services.includes(service);
}

/**
 * URGENT, IN THE SAME SENSE `handover-page.tsx`'s OWN `movementIsUrgent` GIVES THE WORD: the
 * explicit flag, which outranks everything, or a legal deadline that has already been breached.
 * See this module's top comment for why the rule is copied here rather than imported.
 */
export function movementIsUrgent(movement: Movement, now: Instant): boolean {
  if (movement.flaggedUrgent) return true;
  const dueAt = movement.legalForm?.dueAt;
  return dueAt !== undefined && clockState(dueAt, now) === "breached";
}

/**
 * D-a (Ward Lead's decisions, 2026-09-17, amending build plan §2 after an Opus adversarial review,
 * R1, found two P1 safety gaps in the service chooser): THE ONE SHARED DEFINITION OF "URGENT
 * OUTSIDE THE CHOSEN SERVICE", exported here and used by every scoped screen and the scope bar. A
 * movement counts if it is:
 * - flagged urgent; OR
 * - in a delay cause `delays-derivations.ts` itself lists in `SEVERE_CAUSES` — a legal form's due
 *   time already running out or passed, or no suitable bed anywhere in the network; OR
 * - escalated — carries an `escalation` record.
 *
 * ⚠️ **WIDER THAN `movementIsUrgent` ABOVE, DELIBERATELY, AND THE TWO ARE NOT THE SAME QUESTION.**
 * `movementIsUrgent` still mirrors `handover-page.tsx`'s own narrower rule byte for byte (flagged,
 * or a legal deadline already BREACHED) — the test proving that agreement is untouched by this
 * function. R1's own P1 finding is exactly the gap between the two: a movement whose legal form was
 * only RUNNING OUT, not yet breached, or one that had been escalated with no legal form at all,
 * read as not urgent under the narrow rule and could sit outside a chosen service while the scope
 * bar's own "urgent outside {S}" line still read zero. `urgentMovementsOutsideService` below — the
 * function every scope bar actually renders its count from — is repointed at THIS definition.
 *
 * `delayGroups` is Delays' own per-movement cause classifier (`delays-derivations.ts`), read here
 * rather than re-derived — a second hand-written copy of "which delay cause is this" is exactly how
 * the two would silently drift the next time a cause's own rule changes. It takes no dependency the
 * other direction (it never imports this module, so there is no cycle), and its internal `causeOf`
 * consults no movement other than the one being classified — `units` and `now` are its only other
 * inputs — so calling it with a single-movement array returns exactly the cause that movement would
 * fall under inside a full run over the real population, never a different answer for having been
 * asked alone. `delayGroups` filters to open movements internally, so a closed movement here always
 * reads as having no cause, never a stale or invented one.
 */
/**
 * ⚠️ **R2 (Ward Lead's decisions, 2026-09-17, amending D-a after a second Opus adversarial review
 * found a P1 gap): A FOURTH CONDITION — WAITED IN AN EMERGENCY DEPARTMENT PAST THE CONFIGURED ED
 * ACCESS TARGET.** A movement can wait for days with no legal form, no escalation and no flag —
 * `delayGroups`' own `no_eligible_bed` only fires when EVERY shortlisted ward is ineligible, so a
 * movement with an eligible bed somewhere in the network, just not offered or not yet answered,
 * reads as none of the first three conditions no matter how long it has waited. WF-019 (waited
 * about 62 hours) and WF-020 (about 29 hours) are exactly this shape. `now - movement.openedAt` is
 * the SAME clock Delays' own "Over 24 hours" figure and the ED access-target line
 * (`ed-screen.tsx`'s `accessTargetLine`/`minutesInDepartment`) already read — reused here, never a
 * new clock, so this can never disagree with either about how long someone has waited.
 * `configuration.edAccessTargetMinutes` is the coordinator-configured target, never a literal.
 * `isOpen` gates it the same way `delayGroups` and `edOpenSummaries` (`ed-home-derivations.ts`)
 * both already gate their own population, so a closed movement never reads as still waiting.
 */
export function movementIsUrgentForServiceSafety(
  movement: Movement,
  units: Unit[],
  now: Instant,
  configuration: Pick<WardConfiguration, "edAccessTargetMinutes">,
): boolean {
  if (movement.flaggedUrgent) return true;
  if (movement.escalation !== undefined) return true;
  const [soleGroup] = delayGroups([movement], units, now);
  if (soleGroup !== undefined && SEVERE_CAUSES.includes(soleGroup.cause)) return true;
  return isOpen(movement) && now - movement.openedAt >= configuration.edAccessTargetMinutes;
}

/**
 * S2 (§2 "Never hidden"): every scoped movement list must state the urgent movements outside the
 * service, so nothing safety-relevant is ever silently dropped by narrowing to one service.
 *
 * ⚠️ **NO LONGER THE SAME COMPUTATION AS `handover-page.tsx`'s OWN `urgentMovementsOutsideScope`,
 * BY D-a's OWN DESIGN.** Before D-a this filtered on `movementIsUrgent`, which does mirror
 * handover's rule exactly, and a test pinned that equality. D-a widens the DEFINITION this function
 * filters on (see `movementIsUrgentForServiceSafety` above) without touching handover-page.tsx at
 * all — that file is out of this task's scope, and its own "urgent" concept answers a different
 * question (handover readiness) than this one (nothing safety-relevant hidden by a service filter).
 * `tests/ward-service-scope.test.ts` now pins the JOIN's continued agreement with handover
 * (`movementBelongsToService` vs `movementInHandoverScope`) separately from the now-deliberately-
 * DIFFERENT urgency definitions.
 */
export function urgentMovementsOutsideService(
  movements: Movement[],
  service: HealthService,
  units: Unit[],
  now: Instant,
  configuration: Pick<WardConfiguration, "edAccessTargetMinutes">,
): Movement[] {
  return movements.filter(
    (movement) =>
      !movementBelongsToService(movement, service, units) &&
      movementIsUrgentForServiceSafety(movement, units, now, configuration),
  );
}

/**
 * FINDING 1 (Opus final review, 2026-09-17): THE ONE POPULATION every "no recorded service" count
 * reads, so Delays, Movements and Command can never disagree about what the figure means. Before
 * this existed, Delays counted `movementHasNoRecordedService` over its own already-open,
 * already-in-scope `open` array while Movements and Command each counted it over their whole
 * `movements` — open AND closed, every service at once — so the same network could show three
 * different numbers for what is meant to be one data-quality fact. The figure is about data
 * quality, not about who is currently waiting or which service is chosen, so it is defined once,
 * here, as OPEN movements, NETWORK-WIDE:
 *
 * - Open only — `isOpen`, the same gate every other open-movement count on these screens already
 *   uses. A closed movement's origin can no longer be corrected by anyone, so it stays out of a
 *   figure meant to prompt a data fix.
 * - Network-wide, deliberately outside `movementBelongsToService`'s own scoping — callers pass
 *   their whole unscoped movement list (never an already-service-filtered one), because an
 *   unresolvable movement already belongs to every service (this module's own "always shown"
 *   rule), so scoping it away and then filtering would either double no-op or silently invite a
 *   future caller to scope BEFORE calling this, which this signature (no `service` parameter)
 *   forecloses outright.
 */
export function noRecordedServiceMovementCount(movements: Movement[], units: Unit[]): number {
  return movements.filter((movement) => isOpen(movement) && movementHasNoRecordedService(movement, units)).length;
}

/**
 * D-e (Ward Lead's decisions, 2026-09-17): THE ONE LIST the Service panel's own note (`shell/
 * ward-bar.tsx`) names screens from, so that note can never claim a screen narrows its lists when
 * nothing in it actually reads `useServiceScope()`. The build plan's own hand-written sentence was
 * already carrying that drift — "Command, Capacity, Delays, Movements and Referrals narrow their
 * lists to it" — while neither Command nor Referrals read the store at all in this codebase.
 *
 * ⚠️ **CORRECTED, R2 (2026-09-17): "Capacity" is listed BECAUSE this worktree now carries
 * Capacity's own scoping code, not despite lacking it.** This comment previously said build plan
 * lane C1's Capacity scoping (its map and ward table) had been folded onto the ward fix line after
 * this branch's base and was absent here — that was true when written and stopped being true once
 * `capacity-screen.tsx` gained its own `useServiceScope()` read (`service`, `scopedNetworkRows`,
 * `WardServiceScopeBar`). A claim about which files exist in a worktree is a measurement with a
 * shelf life, the same trap `ward-movements.ts`'s own "reachability claim in a comment" warning
 * names — left uncorrected here, a reader would go looking for Capacity's scoping code somewhere
 * else on the ward fix line and not find it, because it is already in this file's own worktree.
 */
export const SERVICE_SCOPED_SCREENS: readonly string[] = ["Capacity", "Delays", "Movements"];
