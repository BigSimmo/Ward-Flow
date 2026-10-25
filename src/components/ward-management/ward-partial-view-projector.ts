import { movementNextStep } from "./movements/movement-next-step";
import { REFERRAL_INFORMATION_NEED_IDS, openInformationNeeds } from "./referrals/referral-information-needs";
import { scopeWorkspace, type ScopableWorkspace, type ScopeOptions } from "./ward-access-scope";
import { referralSentByDesk } from "./ward-referral-sender";
import { referralDecidedAt, referralState, referralWithdrawable, referralWithdrawn } from "./ward-referrals";
import type { Movement, Referral } from "./ward-model";
import { edInScope, unitInScope, type WardAccess } from "./ward-role-access";
import type {
  SenderMovementPartialView,
  SenderReferralPartialView,
  WardPartialView,
} from "./ward-partial-view-contract";

function senderReferral(
  referral: Referral,
  workspace: ScopableWorkspace,
  access: WardAccess,
): SenderReferralPartialView {
  const needs = new Set(
    referral.destinations.flatMap((line) =>
      line.destination.kind === "psychiatric_ward" && line.state === "queued" && line.withdrawnAt === undefined
        ? openInformationNeeds(line.informationNeeds).map((entry) => entry.need)
        : [],
    ),
  );
  return {
    id: referral.id,
    kind: "sender",
    state: referralState(referral),
    withdrawn: referralWithdrawn(referral),
    decidedAt: referralDecidedAt(referral) ?? null,
    canWithdraw: access.role === "ward" && referralWithdrawable(referral, [...workspace.movements]),
    informationNeeds: REFERRAL_INFORMATION_NEED_IDS.filter((need) => needs.has(need)),
  };
}

function senderMovement(movement: Movement): SenderMovementPartialView {
  const destinationStatus: SenderMovementPartialView["destinationStatus"] =
    movement.acceptedUnitId !== undefined
      ? "accepted"
      : movement.referredUnitIds.length > 0
        ? "awaiting_answer"
        : movement.declines.length > 0
          ? "none_found"
          : movement.withdrawnReferrals.length > 0 ||
              movement.unwinds.some((entry) => entry.kind === "acceptance_withdrawn")
            ? "withdrawn"
            : "not_requested";
  return {
    id: movement.id,
    kind: "sender",
    destinationStatus,
    nextStep: movementNextStep(movement)?.kind ?? "none",
    progress:
      movement.closure === undefined &&
      movement.stage === "destination_review" &&
      movement.escalation !== undefined &&
      destinationStatus !== "accepted"
        ? "escalated"
        : destinationStatus,
  };
}

/** Mirrors the bed-manager sender READ population in scopeWorkspace. It is deliberately
 * separate from referralSentByDesk, the existing sender command-authorisation predicate. */
function bedManagerSenders(workspace: ScopableWorkspace, access: WardAccess, options: ScopeOptions) {
  const { scope } = access;
  const unitIn = (unitId: string) => unitInScope(scope, unitId, options.places);
  const edIn = (edId: string | undefined) => edId !== undefined && edInScope(scope, edId, options.places);
  const sites = new Set(workspace.units.filter((unit) => unitIn(unit.id)).map((unit) => unit.siteCode));
  for (const ed of workspace.edDepartments ?? []) if (edIn(ed.id)) sites.add(ed.siteCode);
  if (scope.kind === "site") sites.add(scope.siteCode);
  if (scope.kind === "ed") {
    const site = options.places.edSiteCode(scope.edId);
    if (site) sites.add(site);
  }
  const siteIn = (site: string | undefined) =>
    site !== undefined &&
    (sites.has(site) || (scope.kind === "service" && options.places.siteService?.(site) === scope.service));
  const referrals = new Set(
    workspace.referrals
      .filter((referral) =>
        referral.source === "psychiatric_ward"
          ? referral.originUnitId !== undefined && unitIn(referral.originUnitId)
          : referral.source === "ed_medical" && siteIn(referral.originSiteCode),
      )
      .map((referral) => referral.id),
  );
  const admissions = new Set(workspace.admissions.filter((row) => unitIn(row.unitId)).map((row) => row.id));
  return {
    referral: (row: Referral) => referrals.has(row.id),
    movement: (row: Movement) =>
      edIn(row.originEdId) ||
      (row.sourceAdmissionId !== undefined && admissions.has(row.sourceAdmissionId)) ||
      (row.referralId !== undefined && referrals.has(row.referralId)),
  };
}

/** Private projection from the FULL source, before destination masking. The result is a separate
 * display value; this function neither redacts nor mutates domain records. Never call it with a
 * previously masked workspace to reconstruct unavailable outcomes. No consumer is wired yet. */
export function projectWardPartialView(
  workspace: ScopableWorkspace,
  access: WardAccess,
  options: ScopeOptions,
): WardPartialView {
  // Only the existing ward/bed-manager sender read populations receive summaries.
  if (access.role !== "ward" && access.role !== "bed_manager") return { version: 1, referrals: [], movements: [] };
  const own = scopeWorkspace(workspace, access, { ...options, grants: undefined });
  const visible = options.grants?.some((grant) => grant.until > options.now)
    ? scopeWorkspace(workspace, access, options)
    : own;
  const ownReferrals = new Set(own.referrals.map((referral) => referral.id));
  const ownMovements = new Set(own.movements.map((movement) => movement.id));
  const sourceReferrals = new Map(workspace.referrals.map((referral) => [referral.id, referral]));
  const sourceMovements = new Map(workspace.movements.map((movement) => [movement.id, movement]));
  const manager = access.role === "bed_manager" ? bedManagerSenders(workspace, access, options) : undefined;
  // READ sender membership deliberately differs from journeySentByDesk's command predicate.
  // Match scopeWorkspace's OR rule and retained ward stays, so an expired stay cannot turn a
  // receiving journey into a sender summary, and repatriation keeps an own referral's summary.
  const wardAdmissions = new Set(own.admissions.map((admission) => admission.id));
  const wardReferrals = new Set(
    workspace.referrals
      .filter((referral) => referralSentByDesk(referral, access, options.places))
      .map((referral) => referral.id),
  );
  return {
    version: 1,
    referrals: visible.referrals.map((referral) => {
      if (!ownReferrals.has(referral.id)) return { id: referral.id, kind: "restricted", restriction: "grant" };
      const full = sourceReferrals.get(referral.id)!;
      return manager?.referral(full) || (access.role === "ward" && referralSentByDesk(full, access, options.places))
        ? senderReferral(full, workspace, access)
        : { id: referral.id, kind: "restricted", restriction: "receiving" };
    }),
    movements: visible.movements.map((movement) => {
      if (!ownMovements.has(movement.id)) return { id: movement.id, kind: "restricted", restriction: "grant" };
      const full = sourceMovements.get(movement.id)!;
      return manager?.movement(full) ||
        (access.role === "ward" &&
          ((full.sourceAdmissionId !== undefined && wardAdmissions.has(full.sourceAdmissionId)) ||
            (full.referralId !== undefined && wardReferrals.has(full.referralId))))
        ? senderMovement(full)
        : { id: movement.id, kind: "restricted", restriction: "receiving" };
    }),
  };
}
