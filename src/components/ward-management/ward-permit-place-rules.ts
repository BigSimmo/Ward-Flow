/**
 * **THE PLACE RULES AS ONE TABLE — what a desk may change, by where it stands (R-STRUCT-1, D-223).**
 *
 * Every action-specific place rule of `commandScopeRefusal` (`ward-access-state.ts`), plus the
 * generic place claims (acting ward, ED or team, and every ward or ED a command aims at), as rows.
 * The two place refusals that `commandRefusal` (`backend/ward-flow/engine.ts`) makes before the role
 * check (the site feature switch and the outage record) are `DESK_RULES`, because the server asks
 * them first.
 *
 * ⚠️ PHASE 1 (14 Nov 2026): this is a COPY of the server's rules, each body and message unchanged,
 * so the same command gets the same answer from both. `ward-access-state.ts` is not edited yet.
 * Phase 2 makes `commandScopeRefusal` run this table and then its record-reference pass, and deletes
 * its own copy. `tests/ward-permit-place-rules.test.ts` holds the two to the same answers until then.
 *
 * Order matters only for the message: the rules that answer with their own words come first, as in
 * `commandScopeRefusal`. Every other rule answers `OUTSIDE_PLACE`, so running the server's
 * record-reference pass after the table gives the server's answer exactly.
 *
 * Not here, on purpose: the record-reference pass (every record a command names must be in the
 * desk's own projection, and none seen only through break glass). It needs the whole workspace and
 * the break-glass grants, so it stays on the server. A screen never draws a record outside its scope.
 *
 * Pure and browser free. Must NOT import `ward-access-state.ts`, which pulls in the governance seed
 * and would grow every screen's script (`script-budget.json`).
 */
import {
  BROADCAST_TARGET_SCOPES,
  COORDINATOR_DESK_ACKNOWLEDGER_ID,
  broadcastKind,
  pullNowWards,
  type BroadcastTargetScope,
} from "@/components/ward-management/alerts/ward-broadcast-model";
import { directiveDesks, wardsInBroadcastScope } from "@/components/ward-management/alerts/global-alert-view";
import { admittedStayForArrival } from "@/components/ward-management/ward-admissions";
import { communityTeamKey } from "@/components/ward-management/ward-access-scope";
import { movementSourceAdmission, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import {
  isPatientRegistrationScope,
  registrationIsInScope,
} from "@/components/ward-management/ward-patient-registration";
import { journeySentByDesk, referralSentByDesk } from "@/components/ward-management/ward-referral-sender";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import {
  accessIsWholeNetwork,
  edInScope,
  unitInScope,
  type PlaceLookup,
  type WardAccess,
} from "@/components/ward-management/ward-role-access";
import { siteFeatureSwitchRefusal } from "@/components/ward-management/ward-site-feature-switches";
import { siteByCode } from "@/components/ward-management/ward-sites";

/** The server's place refusal, word for word (`commandScopeRefusal`). About 14 test files pin it. */
export const OUTSIDE_PLACE = "This change names a record outside your role's place.";

export type PlaceRuleContext = {
  readonly state: WardFlowState;
  readonly access: WardAccess;
  readonly command: Readonly<Record<string, unknown>>;
  readonly places: PlaceLookup;
};

export type PlaceRule = {
  /** A stable name, for tests, the permission matrix and the AK-A fixture. */
  readonly id: string;
  /** The changes the rule asks about. Left out: every change (a generic place claim). */
  readonly types?: readonly WardFlowEventType[];
  /** The refusal, or null. The body is the server's, unchanged. */
  readonly check: (context: PlaceRuleContext) => string | null;
  /** True when the rule refuses this desk whatever the record (the matrix's "fixed place refusal"). */
  readonly fixed: boolean;
};

/** A ward or ED inside the desk's scope. */
function placeIn({ access, places }: PlaceRuleContext, id: string): boolean {
  return unitInScope(access.scope, id, places) || edInScope(access.scope, id, places);
}

/** The desk's own community team, by name or slug. Copied from `ward-access-state.ts` (phase 2 shares it). */
export function teamIsOwn(access: WardAccess, teamId: string, places: PlaceLookup): boolean {
  const scope = access.scope;
  if (scope.kind !== "team") return false;
  const ownTeam = communityTeamKey(scope.teamName);
  return ownTeam !== "" && (communityTeamKey(teamId) === ownTeam || teamId === places.teamSlug(scope.teamName));
}

/** Where a desk acts from: its ward, ED or team, or the coordinator desk itself. */
function actsFrom(context: PlaceRuleContext, id: string): boolean {
  const { access, places } = context;
  return (
    placeIn(context, id) || teamIsOwn(access, id, places) || (access.role === "coordinator" && id === "coordinator")
  );
}

/** A place refusal that needs no record: only the membership and the command. */
export type DeskRule = Omit<PlaceRule, "check"> & {
  readonly check: (context: Pick<PlaceRuleContext, "access" | "command">) => string | null;
};

/**
 * Place refusals the server makes BEFORE the role check (`commandRefusal`), so a desk of any role
 * gets these words. Neither needs a record.
 */
export const DESK_RULES: readonly DeskRule[] = [
  {
    // Batch 4 item 20 and D-142: only the statewide access admin or statewide coordinator switches a
    // feature off at a site, and the switch names the site.
    id: "site-feature-switch",
    types: ["SET_SITE_FEATURE_SWITCH"],
    check: ({ access, command }) => siteFeatureSwitchRefusal(access, command as Record<string, unknown>),
    fixed: true,
  },
  {
    // Batch 4 item 25 (D-142): an outage record is network-wide.
    id: "outage-statewide",
    types: ["RECORD_OUTAGE_WINDOW"],
    check: () => "Only the statewide coordinator records an outage.",
    fixed: true,
  },
];

const HANDOVER_SIGN_OFFS: readonly WardFlowEventType[] = ["RECORD_HANDOVER_SIGN_OFF", "UNDO_HANDOVER_SIGN_OFF"];

/** The place rules, in `commandScopeRefusal`'s order. The whole network never reaches them. */
export const PLACE_RULES: readonly PlaceRule[] = [
  {
    // Configuration is one workspace-wide object, even when no command field names a place.
    id: "configuration-statewide",
    types: ["SET_CONFIGURATION"],
    check: () => "Only the statewide coordinator may change global settings.",
    fixed: true,
  },
  {
    // Decision 41 (Josh, 31 Oct 2026): a ward signs off, or takes back, its own ward's handover only.
    id: "ward-sign-off-names-ward",
    types: HANDOVER_SIGN_OFFS,
    check: ({ access, command }) =>
      access.role === "ward" && typeof command.unitId !== "string"
        ? "A ward's handover sign-off names its ward."
        : null,
    fixed: false,
  },
  {
    // Q67 (Josh, 31 Oct 2026): only a whole-network desk signs off the whole network.
    id: "network-sign-off-statewide",
    types: HANDOVER_SIGN_OFFS,
    check: ({ command }) =>
      (command.type === "RECORD_HANDOVER_SIGN_OFF" && command.network !== undefined) ||
      (command.type === "UNDO_HANDOVER_SIGN_OFF" && typeof command.unitId !== "string")
        ? "Only the statewide coordinator signs off the whole network."
        : null,
    fixed: false,
  },
  {
    // Q61 (Josh, 31 Oct 2026): a site bed manager signs off, or takes back, its own site's handover only.
    id: "site-sign-off-own-site",
    types: ["RECORD_SITE_HANDOVER_SIGN_OFF", "UNDO_SITE_HANDOVER_SIGN_OFF"],
    check: ({ access, command }) =>
      access.role === "bed_manager" && access.scope.kind === "site" && command.siteCode === access.scope.siteCode
        ? null
        : "Only the site bed manager signs off its own site's handover.",
    fixed: false,
  },
  {
    // Resolve the recipients from the whole workspace. Alerts redesign (1 Nov 2026): a broadcast to
    // chosen desks reaches only those desks.
    id: "bed-call-recipients",
    types: ["DISPATCH_BROADCAST_ALERT"],
    check: (context) => {
      const { command, state } = context;
      const targetScope = command.targetScope as BroadcastTargetScope;
      if (!BROADCAST_TARGET_SCOPES.includes(targetScope)) return OUTSIDE_PLACE;
      const chosen = Array.isArray(command.targetUnitIds) ? (command.targetUnitIds as unknown[]) : undefined;
      const recipients: readonly unknown[] =
        chosen !== undefined
          ? chosen
          : command.kind === "bed_call"
            ? wardsInBroadcastScope(state.units, targetScope)
            : directiveDesks({ targetScope }, state.units);
      return recipients.some((id) => typeof id !== "string" || !placeIn(context, id)) ? OUTSIDE_PLACE : null;
    },
    fixed: false,
  },
  {
    // Seeing one part of an alert permits a local answer, not extending or ending it for every
    // recipient. Adding desks needs authority over every desk added as well (Q149).
    id: "bed-call-whole-alert",
    types: ["STAND_DOWN_BROADCAST_ALERT", "EXTEND_BROADCAST_ALERT", "ADD_BROADCAST_ALERT_UNITS"],
    check: (context) => {
      const { command, state } = context;
      if (
        command.type === "ADD_BROADCAST_ALERT_UNITS" &&
        (!Array.isArray(command.unitIds) ||
          (command.unitIds as unknown[]).some((id) => typeof id !== "string" || !placeIn(context, id)))
      )
        return OUTSIDE_PLACE;
      const alert = state.broadcastAlerts.find((candidate) => candidate.id === command.alertId);
      if (alert) {
        const recipients =
          broadcastKind(alert) === "directive"
            ? directiveDesks(alert, state.units)
            : (alert.targetUnitIds ?? wardsInBroadcastScope(state.units, alert.targetScope));
        if (recipients.some((id) => !placeIn(context, id))) return OUTSIDE_PLACE;
      }
      return null;
    },
    fixed: false,
  },
  {
    id: "pull-now-wards",
    types: ["RAISE_PULL_NOW"],
    check: (context) => {
      const { command, state } = context;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      return movement &&
        pullNowWards(movement, (id) => state.units.some((unit) => unit.id === id)).some((id) => !placeIn(context, id))
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  {
    // Origin and sender identity come from membership plus the stored record, never the presence
    // of an optional acting-place claim in a client command.
    id: "referral-origin-ed",
    types: ["RECEIVE_REFERRAL"],
    check: ({ access, command, places }) => {
      if (!(access.role === "ed" || (access.role === "coordinator" && command.source === "ed_medical"))) return null;
      const origin =
        typeof command.originSiteCode === "string"
          ? siteByCode(command.originSiteCode)?.emergencyDepartment?.id
          : undefined;
      return !origin || !edInScope(access.scope, origin, places) ? OUTSIDE_PLACE : null;
    },
    fixed: false,
  },
  {
    // The sender's own tools, for the desk that sent the referral only: a ward's or team's scope also
    // takes in referrals sent to it (role access plan v2, D-80).
    id: "referral-sender-tools",
    types: ["ADD_REFERRAL_CORRECTION", "RECORD_REFERRER_WITHDRAWAL", "MARK_REFERRAL_INFORMATION_MET"],
    check: ({ access, command, places, state }) => {
      const referral = state.referrals.find((candidate) => candidate.id === command.referralId);
      return referral && !referralSentByDesk(referral, access, places) ? OUTSIDE_PLACE : null;
    },
    fixed: false,
  },
  {
    // Outbound visibility does not grant authority to answer the receiving ED or team.
    id: "referral-answer-destination",
    types: ["ACCEPT_REFERRAL", "DECLINE_REFERRAL"],
    check: ({ access, command, places, state }) => {
      const scope = access.scope;
      const referral = state.referrals.find((candidate) => candidate.id === command.referralId);
      const destination = referral?.destinations.find(
        (arm) => arm.destination.kind === command.destinationKind,
      )?.destination;
      if (destination?.kind === "emergency_department" && !edInScope(scope, destination.edId, places))
        return OUTSIDE_PLACE;
      // M4: an answer that names no ward answers for the referral's own ward, so every ward it is
      // addressed to must be in scope too (a named `unitId` is checked with the other targets below).
      if (
        command.destinationKind === "psychiatric_ward" &&
        command.unitId === undefined &&
        referral?.destinations.some(
          ({ destination: arm }) =>
            arm.kind === "psychiatric_ward" && arm.unitId !== undefined && !unitInScope(scope, arm.unitId, places),
        )
      )
        return OUTSIDE_PLACE;
      if (destination?.kind === "community_team") {
        const permitted =
          teamIsOwn(access, destination.teamName, places) ||
          (scope.kind === "service" && places.teamService?.(places.teamSlug(destination.teamName)) === scope.service);
        if (!permitted) return OUTSIDE_PLACE;
      }
      return null;
    },
    fixed: false,
  },
  {
    // Booking, and adding a CAD number that was to follow, follow the same sender rule as recording
    // the need (audit 26 Oct).
    id: "transport-sender",
    types: ["RECORD_TRANSPORT_NEED", "BOOK_TRANSPORT", "RECORD_TRANSPORT_CAD"],
    check: ({ access, command, places, state }) => {
      const scope = access.scope;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      if (movement && access.role === "ward") {
        const referral = state.referrals.find((candidate) => candidate.id === movement.referralId);
        // The stay a journey leaves names its sender before the referral does: a repatriation keeps the
        // referral that brought the patient in (review on PR #617).
        const sendingWard =
          movementSourceAdmission(state, movement)?.unitId ??
          referral?.originUnitId ??
          (movement as { originUnitId?: string }).originUnitId;
        if (!sendingWard || !unitInScope(scope, sendingWard, places)) return OUTSIDE_PLACE;
      }
      if (
        movement &&
        access.role === "ed" &&
        (movement.originEdId === undefined || !edInScope(scope, movement.originEdId, places))
      )
        return OUTSIDE_PLACE;
      if (movement && access.role === "community") {
        const referral = state.referrals.find((candidate) => candidate.id === movement.referralId);
        if (
          referral?.source !== "community" ||
          referral.sendingTeamName === undefined ||
          !teamIsOwn(access, referral.sendingTeamName, places)
        )
          return OUTSIDE_PLACE;
      }
      return null;
    },
    fixed: false,
  },
  {
    // A ward or team changes a journey's urgency, legal status or form receipt, and a team readies its
    // handover, only on a journey it sent (D-80).
    id: "journey-sender-amends",
    types: [
      "CHANGE_URGENCY",
      "CHANGE_LEGAL_STATUS",
      "RECORD_LEGAL_FORM_RECEIVED",
      "CORRECT_LEGAL_FORM_RECEIPT",
      "HANDOVER_READY",
    ],
    check: ({ access, command, places, state }) => {
      if (access.role !== "ward" && access.role !== "community") return null;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      return movement && !journeySentByDesk(state, movement, access, places) ? OUTSIDE_PLACE : null;
    },
    fixed: false,
  },
  {
    // A ward records a written form, and its expiry (#219), only for a person admitted to one of its
    // own beds (WT-03).
    id: "legal-form-own-bed",
    types: [
      "RECORD_LEGAL_FORM_WRITTEN",
      "RECORD_LEGAL_FORM_CODE",
      "RECORD_LEGAL_FORM_DETAILS",
      "RECORD_LEGAL_FORM_EXPIRY",
    ],
    check: ({ access, command, places, state }) => {
      if (access.role !== "ward") return null;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      const stay = movement ? admittedStayForArrival(movement, state.admissions) : undefined;
      return !stay || !unitInScope(access.scope, stay.unitId, places) ? OUTSIDE_PLACE : null;
    },
    fixed: false,
  },
  {
    // D-128: a ward records a continuation only for a person its own ward accepted.
    id: "legal-continuation-accepting-ward",
    types: ["RECORD_LEGAL_FORM_CONTINUATION"],
    check: ({ access, command, places, state }) => {
      if (access.role !== "ward") return null;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      return movement && (!movement.acceptedUnitId || !unitInScope(access.scope, movement.acceptedUnitId, places))
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  {
    // Compare the authenticated desk with the ward captured when the original fact was recorded.
    id: "undo-legal-recording-ward",
    types: ["UNDO_LEGAL_FORM_RECORD"],
    check: ({ access, command, places, state }) => {
      if (access.role !== "ward") return null;
      const record = state.undoRecords?.find(
        (candidate) =>
          candidate.kind === "step" &&
          candidate.undoType === "UNDO_LEGAL_FORM_RECORD" &&
          candidate.subjectId === command.movementId,
      );
      return !record || record.unitId === null || !unitInScope(access.scope, record.unitId, places)
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  {
    // Every desk names its own place when it adds a patient (review on PR #606).
    id: "add-patient-own-place",
    types: ["ADD_PATIENT"],
    check: ({ access, command, places, state }) =>
      command.registrationScope === undefined ||
      !isPatientRegistrationScope(command.registrationScope, state.units) ||
      !registrationIsInScope(command.registrationScope, access, places)
        ? OUTSIDE_PLACE
        : null,
    fixed: false,
  },
  {
    id: "support-notification-accepting-ward",
    types: ["RECORD_SUPPORT_NOTIFICATION", "UNDO_SUPPORT_NOTIFICATION"],
    check: ({ access, command, places, state }) => {
      if (!((access.role === "ward" || access.role === "coordinator") && typeof command.movementId === "string"))
        return null;
      const movement = state.movements.find((candidate) => candidate.id === command.movementId);
      return movement &&
        (typeof movement.acceptedUnitId === "string"
          ? !unitInScope(access.scope, movement.acceptedUnitId, places)
          : !accessIsWholeNetwork(access))
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  // Generic place claims (every change). The server runs its record-reference pass between the
  // rules above and these; every one answers `OUTSIDE_PLACE`, so the order makes no difference.
  {
    id: "acting-unit",
    check: ({ access, command, places }) =>
      typeof command.actingUnitId === "string" && !unitInScope(access.scope, command.actingUnitId, places)
        ? OUTSIDE_PLACE
        : null,
    fixed: false,
  },
  {
    // RECORD_OBSERVATION_LEVEL names its acting unit on the target (audit 26 Oct).
    id: "observation-acting-unit",
    check: ({ access, command, places }) => {
      const target = command.target as { actingUnitId?: unknown } | undefined;
      return typeof target?.actingUnitId === "string" && !unitInScope(access.scope, target.actingUnitId, places)
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  {
    id: "origin-unit",
    check: ({ access, command, places }) =>
      typeof command.originUnitId === "string" && !unitInScope(access.scope, command.originUnitId, places)
        ? OUTSIDE_PLACE
        : null,
    fixed: false,
  },
  {
    // A scoped coordinator may approve or complete a transfer only inside its service.
    id: "transfer-receiving-ward",
    types: ["RECORD_ADMISSION_CARE"],
    check: (context) => {
      const { access, command } = context;
      const transfer = command.change as { kind?: unknown; receivingUnitId?: unknown } | undefined;
      return access.role === "coordinator" &&
        transfer?.kind === "transfer" &&
        typeof transfer.receivingUnitId === "string" &&
        !placeIn(context, transfer.receivingUnitId)
        ? OUTSIDE_PLACE
        : null;
    },
    fixed: false,
  },
  {
    id: "targets",
    check: (context) => {
      const { access, command } = context;
      const targets = [
        command.unitId,
        command.acceptedUnitId,
        ...(Array.isArray(command.unitIds) ? command.unitIds : []),
      ];
      for (const target of targets)
        if (
          typeof target === "string" &&
          !placeIn(context, target) &&
          !(access.role === "coordinator" && target === COORDINATOR_DESK_ACKNOWLEDGER_ID)
        )
          return OUTSIDE_PLACE;
      return null;
    },
    fixed: false,
  },
  {
    // The named ED is always in scope, including on an accepted referral's continuation (owner, 19 Oct 2026).
    id: "acting-place",
    check: (context) => {
      for (const from of [context.command.actingPlaceId, context.command.edId])
        if (typeof from === "string" && !actsFrom(context, from)) return OUTSIDE_PLACE;
      return null;
    },
    fixed: false,
  },
  {
    // Older withdrawal callers used placeId; it is an authority claim too.
    id: "withdrawal-place",
    types: ["WITHDRAW_REFERRAL"],
    check: (context) =>
      typeof context.command.placeId === "string" && !actsFrom(context, context.command.placeId) ? OUTSIDE_PLACE : null,
    fixed: false,
  },
  {
    id: "acting-team",
    check: ({ access, command, places }) =>
      typeof command.actingTeamId === "string" && !teamIsOwn(access, command.actingTeamId, places)
        ? OUTSIDE_PLACE
        : null,
    fixed: false,
  },
];

export type PlaceRefusal = { readonly rule: Pick<PlaceRule, "id" | "fixed">; readonly refusal: string };

/** The first rule in `rules` that refuses this command, or null. */
function firstRefusal<C extends Pick<PlaceRuleContext, "access" | "command">>(
  rules: readonly (Omit<PlaceRule, "check"> & { readonly check: (context: C) => string | null })[],
  context: C,
): PlaceRefusal | null {
  const type = context.command.type as WardFlowEventType;
  for (const rule of rules) {
    if (rule.types && !rule.types.includes(type)) continue;
    const refusal = rule.check(context);
    if (refusal !== null) return { rule, refusal };
  }
  return null;
}

/**
 * The refusals `commandRefusal` makes before the role check, for a desk short of the whole network:
 * `DESK_RULES` in order. The whole network is never refused.
 */
export function deskRuleRefusal(access: WardAccess, command: Readonly<Record<string, unknown>>): PlaceRefusal | null {
  if (accessIsWholeNetwork(access)) return null;
  return firstRefusal(DESK_RULES, { access, command });
}

/**
 * The place table's answer for a desk short of the whole network: `PLACE_RULES` in order. What
 * `commandScopeRefusal` answers before its record-reference pass. The whole network is never refused.
 */
export function placeRuleRefusal(context: PlaceRuleContext): PlaceRefusal | null {
  if (accessIsWholeNetwork(context.access)) return null;
  return firstRefusal(PLACE_RULES, context);
}
