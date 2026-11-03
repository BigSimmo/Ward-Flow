import { forgetDowntimePack } from "./reports/downtime-pack";
import type { SharedRoleChoice, SharedSnapshot, SharedView } from "./ward-shared-client-types";

// The shared client's role-binding checks, kept apart so ward-shared-client.ts stays under the line
// limit. Each reply is bound to the signed-in account, its current role and access context before
// any of it is shown; an executive account only ever holds the aggregate report.

/** A server reply as the shared client reads it; each field is checked where it is used. */
type Reply = {
  access?: unknown;
  /** As the server sent it; compared with the signed-in account before a reply is adopted. */
  actorId?: string | null;
  accessUntil?: number;
  notModified?: unknown;
  workingAs?: unknown;
  commandRevision?: unknown;
  snapshot?: { kind?: unknown; accessContext?: string; accessUntil?: number } | null;
};
/** The access and context a write was sent under, checked again against its reply. */
export type SentBinding = { access: string; context: string; epoch: number; grant: number };

/** What the role-binding checks may do to the shared client. */
export type RoleBindingHost = {
  view: () => SharedView;
  publish: (update: Partial<SharedView>) => void;
  /** Cancels this desk's commands for a role change, then clears its recovery receipt. */
  endRole: () => void;
};

const roleOf = (access: unknown) => (access as { role?: unknown } | undefined)?.role;

/** The roles a `choose-role` answer offers, each checked. The server sends up to 20 roles, plus the
 * bootstrap statewide desk. */
export function roleChoices(choices: unknown): SharedRoleChoice[] {
  return Array.isArray(choices)
    ? choices
        .filter(
          (choice: unknown): choice is SharedRoleChoice =>
            !!choice &&
            typeof (choice as SharedRoleChoice).workingAs === "string" &&
            typeof (choice as SharedRoleChoice).role === "string",
        )
        .slice(0, 21)
        .map((choice: SharedRoleChoice) => ({
          workingAs: choice.workingAs,
          role: choice.role,
          scope: choice.scope,
        }))
    : [];
}

/** An executive desk holds aggregate reports only: no archive, record access log or commands. */
export function refusesRecordPath(view: SharedView, path: string): boolean {
  const executiveDesk = view.executiveSnapshot || roleOf(view.access) === "executive";
  return (
    !!executiveDesk &&
    (path.startsWith("/v1/workspace/archive") ||
      path === "/v1/workspace/record-access" ||
      path === "/v1/workspace/commands")
  );
}

/** The operational binding a write is sent under, or `undefined` when there is none to check. */
export function sentBindingFor(
  view: SharedView,
  authenticatedActor: string | null | undefined,
  epoch: number,
  grant: number,
): SentBinding | undefined {
  const context = view.snapshot?.accessContext;
  if (
    authenticatedActor === view.actorId &&
    view.access &&
    roleOf(view.access) !== "executive" &&
    !view.executiveSnapshot &&
    typeof context === "string" &&
    /^[a-f0-9]{64}$/.test(context)
  )
    return { access: JSON.stringify(view.access), context, epoch, grant };
  return undefined;
}

/** Whether this update replaces the held snapshot with one of another account, role or kind. */
export function viewLifetimeChanged(view: SharedView, update: Partial<SharedView>): boolean {
  const before = view.executiveSnapshot ?? view.snapshot;
  const after =
    "executiveSnapshot" in update || "snapshot" in update
      ? (update.executiveSnapshot ?? update.snapshot ?? null)
      : before;
  return (
    before !== after &&
    (!before ||
      !after ||
      "kind" in before !== "kind" in after ||
      before.accessContext !== after.accessContext ||
      ("actorId" in before && "actorId" in after && before.actorId !== after.actorId))
  );
}

/** A committed revision is definitive even if its display binding changed. Older servers may
 * omit it, but their full operational snapshot must be valid before recovery can be cleared. */
async function hasCommandCompletionEvidence(value: Reply): Promise<boolean> {
  if (Number.isSafeInteger(value.commandRevision) && Number(value.commandRevision) > 0) return true;
  const snapshot = value.snapshot as (Partial<SharedSnapshot> & { kind?: unknown }) | null | undefined;
  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    Array.isArray(snapshot) ||
    snapshot.kind !== undefined ||
    snapshot.dataMode !== "prototype" ||
    !Number.isSafeInteger(snapshot.revision) ||
    Number(snapshot.revision) < 1 ||
    !Number.isFinite(snapshot.now) ||
    (snapshot.accessContext !== undefined &&
      (typeof snapshot.accessContext !== "string" || !/^[a-f0-9]{64}$/.test(snapshot.accessContext))) ||
    snapshot.payload?.version !== 1 ||
    typeof snapshot.payload.dayZero !== "string" ||
    !Number.isFinite(Date.parse(snapshot.payload.dayZero)) ||
    typeof snapshot.payload.startedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.payload.startedAt))
  )
    return false;
  const { isValidSharedWardFlowState } = await import("./ward-shared-state-validation");
  try {
    return isValidSharedWardFlowState(snapshot.payload.state);
  } catch {
    return false;
  }
}

/**
 * Checks a reply against the account, role and access context its request was sent under. Returns
 * a replacement answer when a command or opening's binding changed, and throws when a read's did.
 */
export async function verifyResponseBinding(
  host: RoleBindingHost & {
    /** Throws when the signed-in account or working view changed. */
    current: () => void;
    cancelQueued: () => void;
    clearRecovery: () => void;
    hasPending: () => boolean;
    /** Bumps the role epoch and replaces the role lifetime. */
    newRoleEpoch: () => void;
    roleEpoch: () => number;
    grantGeneration: () => number;
  },
  request: {
    path: string;
    body: object | undefined;
    response: Response;
    value: Reply;
    sentBinding: SentBinding | undefined;
    authenticatedActor: string | null | undefined;
    workspaceRead: boolean;
  },
): Promise<{ response: Response; value: { responseBindingChanged: true; commandRevision?: unknown } } | undefined> {
  const { path, body, response, value, sentBinding, authenticatedActor, workspaceRead } = request;
  const { parseStoredAccess } = await import("./shell/ward-access-store");
  host.current();
  if (path === "/v1/workspace/commands" && body && response.ok) {
    if (!(await hasCommandCompletionEvidence(value))) throw new Error("Save not confirmed");
    // Legacy snapshot validation can yield; do not act on a role that ended in the meantime.
    host.current();
  }
  const view = host.view();
  const access = parseStoredAccess(JSON.stringify(value.access), { shared: true });
  const aggregate = value.snapshot?.kind === "executive-aggregate";
  const explicitAuthority = Object.hasOwn(value, "actorId") || Object.hasOwn(value, "access");
  const boundWrite =
    !!body &&
    sentBinding &&
    sentBinding.epoch === host.roleEpoch() &&
    sentBinding.grant === host.grantGeneration() &&
    authenticatedActor === view.actorId &&
    sentBinding.access === JSON.stringify(view.access) &&
    sentBinding.context === view.snapshot?.accessContext &&
    (!Number.isFinite(view.accessUntil) || view.accessUntil! > Date.now()) &&
    (!Number.isFinite(value.accessUntil) || value.accessUntil! > Date.now()) &&
    (!Number.isFinite(value.snapshot?.accessUntil) || value.snapshot!.accessUntil! > Date.now()) &&
    !view.executiveSnapshot &&
    !aggregate &&
    (!value.snapshot || sentBinding.context === value.snapshot.accessContext) &&
    (!explicitAuthority ||
      (value.actorId === authenticatedActor && !!access && JSON.stringify(access) === sentBinding.access));
  const validRead =
    !body &&
    !!access &&
    value.actorId === authenticatedActor &&
    (!Number.isFinite(value.accessUntil) || value.accessUntil! > Date.now()) &&
    (!Number.isFinite(value.snapshot?.accessUntil) || value.snapshot!.accessUntil! > Date.now()) &&
    (access.role === "executive" ? workspaceRead && aggregate : !aggregate);
  if (!(body ? boundWrite : validRead)) {
    // The HTTP answer remains definitive for this command alone. Its display/undo/covered
    // data belongs to an unverified binding, so clear it and reconcile with a validated GET.
    if (path === "/v1/workspace/commands" && body && "commandId" in body && response.status < 500) {
      host.cancelQueued();
      host.clearRecovery();
      host.newRoleEpoch();
      host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null, status: "loading" });
      return {
        response,
        value: { responseBindingChanged: true, commandRevision: value.commandRevision },
      };
    }
    if (path === "/v1/workspace/break-glass" && body && response.ok) {
      // Opening a record deliberately changes the grant context. Older servers send no
      // outer authority here; confirm that new view with GET before publishing any rows.
      host.cancelQueued();
      if (!host.hasPending()) host.clearRecovery();
      host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null, status: "loading" });
      return { response, value: { responseBindingChanged: true } };
    }
    host.endRole();
    host.publish({
      snapshot: null,
      eventLog: [],
      access: undefined,
      actorId: null,
    });
    throw new Error("The working view changed; reconnect before viewing records.");
  }
  if (aggregate && host.view().snapshot) {
    host.endRole();
    host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null, status: "loading" });
  }
  return undefined;
}

/**
 * Binds a workspace read's reply to the current account and role before anything is adopted. An
 * executive reply is bound and published here as the aggregate report. Returns the confirmed
 * access to adopt an operational board with, or `null` when this reply is finished with.
 */
export async function bindWorkspaceReply(
  host: RoleBindingHost & {
    /** True once the desk, role, grant or connection this read started under has gone. */
    stale: () => boolean;
    canSwitch: () => boolean;
    /** Notes a whole read of the workspace (`FULL_READ_EVERY_MS`). */
    fullRead: () => void;
  },
  read: {
    current: { accessContext?: string } | null;
    value: Reply;
    authenticatedActor: string | null | undefined;
    authenticatedActorId: (() => string | null) | undefined;
  },
): Promise<{ access: unknown } | null> {
  const { current, value, authenticatedActor, authenticatedActorId } = read;
  const incomingContext = value.snapshot?.accessContext;
  const incomingAggregate = value.snapshot?.kind === "executive-aggregate";
  const incomingExecutive = roleOf(value.access) === "executive";
  if (
    current &&
    value.notModified !== true &&
    (Boolean(host.view().executiveSnapshot) !== incomingAggregate ||
      (incomingExecutive && !host.view().executiveSnapshot) ||
      (Boolean(authenticatedActorId || incomingAggregate || host.view().executiveSnapshot) &&
        incomingContext !== current.accessContext))
  ) {
    // Clear an ended binding in this call stack, before either lazy validator can yield.
    host.endRole();
    host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null, status: "loading" });
  }
  let actualAccess = value.access;
  if (authenticatedActorId) {
    if (
      !authenticatedActor ||
      authenticatedActor !== authenticatedActorId() ||
      value.actorId !== authenticatedActor ||
      !value.access
    ) {
      host.endRole();
      host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null });
      throw new Error("Current account and role must be confirmed");
    }
    const { parseStoredAccess } = await import("./shell/ward-access-store");
    if (host.stale()) return null;
    actualAccess = parseStoredAccess(JSON.stringify(value.access), { shared: true });
    if (!actualAccess || authenticatedActor !== authenticatedActorId()) {
      host.endRole();
      host.publish({ snapshot: null, eventLog: [], access: undefined, actorId: null });
      throw new Error("Current account and role must be confirmed");
    }
  }
  const aggregate = value?.snapshot?.kind === "executive-aggregate";
  const executive = roleOf(actualAccess) === "executive";
  if (aggregate || executive || host.view().executiveSnapshot) {
    // A changed role cannot keep operational rows while the lazy schema loads. Unknown or
    // malformed executive replies clear both holders; they never select an old-server board.
    const invalid = () => {
      host.endRole();
      host.publish({ snapshot: null, eventLog: [], access: actualAccess, actorId: value.actorId ?? null });
      throw new Error("Incompatible executive reporting data");
    };
    if (aggregate || executive) {
      if (host.view().snapshot) {
        host.endRole();
        host.publish({
          snapshot: null,
          eventLog: [],
          access: actualAccess,
          actorId: value.actorId ?? null,
          status: "loading",
        });
      }
      const { bindExecutiveAggregateSnapshot } = await import("./ward-shared-executive-snapshot");
      if (host.stale()) return null;
      const accepted = bindExecutiveAggregateSnapshot(
        value.snapshot,
        { ...value, access: actualAccess },
        authenticatedActorId?.(),
        Date.now(),
      );
      if (!accepted || value.notModified === true) return invalid();
      const held = host.view().executiveSnapshot;
      if (
        held &&
        accepted.accessContext === held.accessContext &&
        accepted.actorId === held.actorId &&
        accepted.revision < held.revision
      )
        return null;
      host.endRole();
      forgetDowntimePack();
      host.publish({
        snapshot: null,
        executiveSnapshot: accepted,
        receivedAt: Date.now(),
        status: "ready",
        error: null,
        access: { role: "executive", scope: { ...accepted.report.network.scope } },
        actorId: accepted.actorId,
        accessUntil: accepted.accessUntil,
        workingAs: typeof value.workingAs === "string" ? value.workingAs : null,
        canSwitch: host.canSwitch(),
        choices: undefined,
        canRequest: undefined,
        eventLog: [],
        receiptScope: undefined,
        recovery: undefined,
      });
      host.fullRead();
      return null;
    }
    // A genuine replacement operational desk may proceed, but an executive clock-only
    // response cannot refresh authority or rewrite a report's as-at time.
    if (value.notModified === true) return invalid();
    host.publish({ snapshot: null, eventLog: [], access: actualAccess, actorId: value.actorId ?? null });
  }
  return { access: actualAccess };
}
