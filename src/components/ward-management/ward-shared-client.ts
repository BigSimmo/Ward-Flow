import { WardAuthError } from "./ward-supabase-auth";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { eventLogEntryFor, type EventLogEntry } from "./ward-event-log";
import { isValidSharedWardFlowState } from "./ward-shared-state-validation";

export type SharedSnapshot = {
  dataMode: "prototype";
  revision: number;
  now: number;
  payload: { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
  /** False when the server refuses the demonstration controls (clock, reset and scenario). */
  demoControls?: boolean;
};
/**
 * `choose-role`: the account holds more than one role and must say which to work as.
 * `no-role`: signed in, but no role is assigned. Neither signs the person out.
 */
type SharedStatus = "loading" | "ready" | "saving" | "unavailable" | "not-authorised" | "choose-role" | "no-role";
/** One role this account may work as: the membership id (or "bootstrap") and its role and place. */
export type SharedRoleChoice = { workingAs: string; role: string; scope: unknown };
export type SharedView = {
  snapshot: SharedSnapshot | null;
  receivedAt: number;
  status: SharedStatus;
  error: string | null;
  eventLog?: readonly EventLogEntry[];
  /** The role and place the server says this account is working as now. Checked by the caller. */
  access?: unknown;
  /** The membership id worked as, or "bootstrap" for a WARD_COORDINATOR_USER_IDS account. */
  workingAs?: string | null;
  /** With `choose-role`: the roles to choose from. */
  choices?: readonly SharedRoleChoice[];
  /** With `no-role`: whether this server takes requests for access. */
  canRequest?: boolean;
  /** The signed-in account's id, to say "You" in the access lists. */
  actorId?: string | null;
  /** This tab chose its role, so it can go back and choose another. */
  canSwitch?: boolean;
};
/** A role or cover as the server lists it. Times are minutes from the server's now. */
export type SharedMembership = {
  id: string;
  actorId: string;
  role: string;
  scope: unknown;
  kind: "role" | "cover";
  grantedBy: string;
  approved: boolean;
  approvedBy: string | null;
  minutes: { granted: number | null; expires: number | null; lastUsed: number | null };
};
/** A request for access as the server lists it. */
export type SharedAccessRequest = {
  id: string;
  actorId: string;
  role: string;
  scope: unknown;
  decision: "approved" | "declined" | null;
  minutes: { requested: number | null };
};
/** What a change returns: `null` when done, "step-up" for a fresh sign-in first, or the refusal. */
export type SharedChangeResult = string | null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_ROLE = "No Ward Flow role is assigned to this account";
type PendingCommand = {
  dataMode: "prototype";
  classification: "synthetic";
  commandId: string;
  expectedRevision: number;
  event: WardFlowEvent;
  /** Asked for while more commands are queued: an accepted reply then carries no snapshot. */
  reply?: "revision";
};

export class SharedWorkspaceClient {
  private view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  private pending: PendingCommand | null = null;
  private queue: WardFlowEvent[] = [];
  private disposed = false;
  private busy = false;
  /** Requests stay with the desk that started them, even while waiting for a token. */
  private viewGeneration = 0;
  /** Polls started before a grant must not replace the newly opened view. */
  private grantGeneration = 0;
  /** Local selection remains authoritative when a cleanup connection cannot persist a change. */
  private workingAsOverride: string | null | undefined;
  /** The revision this tab's own accepted revision-only commands reached, ahead of its snapshot. */
  private headRevision = 0;
  private readonly lifetime = new AbortController();
  /** Refused, or waiting on the person: no polling or saving until they act. */
  private gated() {
    return ["not-authorised", "choose-role", "no-role"].includes(this.view.status);
  }
  private workingAs() {
    return this.workingAsOverride === undefined ? (this.options.workingAs?.get() ?? null) : this.workingAsOverride;
  }
  constructor(
    private readonly options: {
      baseUrl: string;
      token: () => Promise<string>;
      changed: (view: SharedView) => void;
      fetch?: typeof fetch;
      commandId?: () => string;
      /** Which of this account's roles to work as. The membership id only, never a name. */
      workingAs?: { get: () => string | null; set: (id: string | null) => void };
    },
  ) {}
  private publish(update: Partial<SharedView>) {
    if (this.disposed) return;
    this.view = { ...this.view, ...update };
    this.options.changed(this.view);
  }
  private adopt(snapshot: SharedSnapshot) {
    if (
      !snapshot ||
      snapshot.dataMode !== "prototype" ||
      !Number.isSafeInteger(snapshot.revision) ||
      snapshot.revision < 1 ||
      !Number.isFinite(snapshot.now) ||
      snapshot.payload?.version !== 1 ||
      !isValidSharedWardFlowState(snapshot.payload.state) ||
      !Number.isFinite(Date.parse(snapshot.payload.dayZero)) ||
      !Number.isFinite(Date.parse(snapshot.payload.startedAt))
    )
      throw new Error("Incompatible workspace data");
    const held = this.view.snapshot;
    if (snapshot.revision >= (held?.revision ?? 0)) {
      // Scoped polls also return full snapshots when only permissions may have changed. Keep
      // identical data stable for the provider and its field selectors, including draft owners.
      const payload =
        snapshot.revision === held?.revision && JSON.stringify(snapshot.payload) === JSON.stringify(held.payload)
          ? held.payload
          : snapshot.payload;
      this.publish({ snapshot: { ...snapshot, payload }, receivedAt: Date.now() });
    }
  }
  private async request(path: string, body?: PendingCommand | Record<string, unknown>) {
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    const workspaceRead = path === "/v1/workspace" || path.startsWith("/v1/workspace?");
    const current = () => {
      if (generation !== this.viewGeneration || (workspaceRead && grantGeneration !== this.grantGeneration))
        throw new Error("The working view changed; try again.");
    };
    let token: string;
    try {
      token = await this.options.token();
    } catch (error) {
      if (
        generation === this.viewGeneration &&
        (!workspaceRead || grantGeneration === this.grantGeneration) &&
        error instanceof WardAuthError &&
        error.kind === "session"
      ) {
        this.pending = null;
        this.queue = [];
        this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error: error.message });
      }
      throw error;
    }
    current();
    if (this.disposed) throw new Error("Connection closed");
    const stored = this.workingAs();
    const workingAs = stored && (stored === "bootstrap" || UUID.test(stored)) ? stored : null;
    const send = async (as: string | null) => {
      const response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl}${path}`, {
        method: body ? "POST" : "GET",
        cache: "no-store",
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
          ...(as ? { "x-ward-working-as": as } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.any([AbortSignal.timeout(15000), this.lifetime.signal]),
      });
      if (this.disposed) throw new Error("Connection closed");
      const value = await response.json().catch(() => null);
      current();
      if (this.disposed) throw new Error("Connection closed");
      const noRole = response.status === 403 && (value?.code === "no-role" || value?.error === NO_ROLE);
      return { response, value, noRole };
    };
    const denied = (error: string) => {
      this.pending = null;
      this.queue = [];
      this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error });
      return new Error("Access denied");
    };
    const gate = (update: Partial<SharedView>) => {
      this.pending = null;
      this.queue = [];
      this.publish({ snapshot: null, eventLog: [], error: null, ...update });
      return new Error("Waiting on the person");
    };
    const answer = await send(workingAs);
    current();
    if (answer.noRole && workingAs) {
      // Ending the selected role invalidates every concurrent request, including access steps
      // waiting for a token. A fresh read chooses from the remaining roles without the old cache.
      this.workingAsOverride = null;
      this.options.workingAs?.set(null);
      this.viewGeneration += 1;
      const changed = gate({ status: "loading" });
      void this.refresh();
      throw changed;
    }
    const { response, value, noRole } = answer;
    // A powerful step needs a fresh sign-in. The caller asks for the password and tries again.
    if (response.status === 401 && value?.code === "step-up") return { response, value };
    if (noRole) throw gate({ status: "no-role", canRequest: value?.canRequest === true });
    // A role refusal on an access step comes back as its reason, not as a sign-out.
    if (response.status === 403 && path.startsWith("/v1/workspace/access")) return { response, value };
    if (response.status === 401 || response.status === 403)
      throw denied("Sign in with an account assigned a Ward Flow role.");
    // The server holds more than one role for this account and needs to be told which.
    if (response.status === 409 && value?.code === "choose-role") {
      const choices: SharedRoleChoice[] = Array.isArray(value.choices)
        ? value.choices
            .filter(
              (choice: unknown): choice is SharedRoleChoice =>
                !!choice &&
                typeof (choice as SharedRoleChoice).workingAs === "string" &&
                typeof (choice as SharedRoleChoice).role === "string",
            )
            // The server sends up to 20 roles, plus the bootstrap statewide desk.
            .slice(0, 21)
            .map((choice: SharedRoleChoice) => ({
              workingAs: choice.workingAs,
              role: choice.role,
              scope: choice.scope,
            }))
        : [];
      throw gate({ status: "choose-role", choices });
    }
    if (value === null) throw new Error("Workspace unavailable");
    return { response, value };
  }
  async refresh() {
    if (this.busy || this.pending || this.disposed || this.gated()) return;
    this.busy = true;
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    try {
      const current = this.view.snapshot;
      // The poll names the revision it holds; an unchanged workspace answers with its clock only.
      const { response, value } = await this.request(
        current ? `/v1/workspace?since=${current.revision}` : "/v1/workspace",
      );
      if (generation !== this.viewGeneration || grantGeneration !== this.grantGeneration) return;
      if (!response.ok) throw new Error("Workspace unavailable");
      if (value?.notModified === true) {
        if (!current || value.revision !== current.revision || !Number.isFinite(value.now))
          throw new Error("Incompatible workspace data");
        if (this.view.snapshot === current)
          this.publish({ snapshot: { ...current, now: value.now }, receivedAt: Date.now() });
      } else this.adopt(value.snapshot);
      this.publish({
        status: "ready",
        error: this.view.status === "unavailable" ? null : this.view.error,
        access: value.access,
        workingAs: typeof value.workingAs === "string" ? value.workingAs : null,
        actorId: typeof value.actorId === "string" ? value.actorId : null,
        canSwitch: !!this.workingAs(),
        choices: undefined,
        canRequest: undefined,
      });
    } catch {
      if (generation === this.viewGeneration && grantGeneration === this.grantGeneration && !this.gated())
        this.publish({
          status: "unavailable",
          error: "The shared board could not be refreshed. Reconnect before making changes.",
        });
    } finally {
      this.busy = false;
      if (generation !== this.viewGeneration && this.view.status === "loading") await this.refresh();
      else if (this.queue.length && this.view.status === "ready") void this.drain();
    }
  }
  dispatch = (event: WardFlowEvent) => {
    if (!this.view.snapshot || this.view.status === "unavailable" || this.gated() || this.disposed) return;
    this.queue.push(event);
    void this.drain();
  };
  private async drain() {
    if (this.busy || this.disposed) return;
    this.busy = true;
    const generation = this.viewGeneration;
    try {
      while (!this.disposed && (this.pending || this.queue.length)) {
        if (!this.pending) {
          const snapshot = this.view.snapshot;
          const event = this.queue.shift();
          if (!snapshot || !event) break;
          this.pending = {
            classification: "synthetic",
            dataMode: "prototype",
            commandId: (this.options.commandId ?? (() => crypto.randomUUID()))(),
            expectedRevision: Math.max(snapshot.revision, this.headRevision),
            event,
            ...(this.queue.length ? { reply: "revision" as const } : {}),
          };
        }
        this.publish({ status: "saving", error: null });
        const command = this.pending;
        const grantGeneration = this.grantGeneration;
        const { response, value } = await this.request("/v1/workspace/commands", command);
        if (generation !== this.viewGeneration) return;
        if (response.status >= 500) throw new Error("Save not confirmed");
        if (value.snapshot) {
          if (grantGeneration === this.grantGeneration) this.adopt(value.snapshot);
          else {
            // Keep the definitive command result, but read the newly granted view rather than
            // replacing it with the command's earlier scope. Retry retains the same command ID.
            // A concurrent grant can invalidate this reconciliation read. Retry the read with
            // the new generation; the command response itself is already definitive.
            let latest: Awaited<ReturnType<typeof this.request>>;
            for (;;) {
              const readGrantGeneration = this.grantGeneration;
              try {
                latest = await this.request("/v1/workspace");
                if (generation !== this.viewGeneration) return;
                if (readGrantGeneration !== this.grantGeneration) continue;
                break;
              } catch (error) {
                if (generation === this.viewGeneration && readGrantGeneration !== this.grantGeneration) continue;
                throw error;
              }
            }
            if (!latest.response.ok) throw new Error("Save not confirmed");
            this.adopt(latest.value.snapshot);
          }
        } else if (response.ok && Number.isSafeInteger(value.commandRevision))
          this.headRevision = Math.max(this.headRevision, value.commandRevision);
        this.publish({ eventLog: [...(this.view.eventLog ?? []), eventLogEntryFor(command.event, response.ok)] });
        this.pending = null;
        if (!response.ok) {
          this.queue = [];
          this.publish({
            status: "ready",
            error:
              response.status === 409
                ? "Another coordinator changed the board. Your action was not applied; review the latest state."
                : value?.code === "scope" && typeof value.error === "string"
                  ? `${value.error} Nothing was changed.`
                  : command.event.role === "demo" && value.snapshot?.demoControls === false
                    ? "Demo controls are switched off on the shared workspace. Nothing was changed."
                    : "The action was not applied. Review the workflow requirements.",
          });
          break;
        }
        this.publish({ status: "ready", error: null });
      }
    } catch {
      if (generation === this.viewGeneration && !this.gated())
        this.publish({
          status: "unavailable",
          error: "Save is not confirmed. Retry reconnects using the same command ID, so the action cannot run twice.",
        });
    } finally {
      this.busy = false;
      if (generation !== this.viewGeneration && this.view.status === "loading") await this.refresh();
      // A run that ended on a revision-only reply reads the board once to catch up.
      if (!this.disposed && this.headRevision > (this.view.snapshot?.revision ?? 0) && this.view.status === "ready")
        void this.refresh();
    }
  }
  /**
   * Phone push (feature 4). The server's public VAPID key, or `enabled: false` when the server is
   * not set up for phone alerts. The private key never leaves the server.
   */
  async pushKey(): Promise<{ enabled: true; publicKey: string } | { enabled: false }> {
    const { response, value } = await this.request("/v1/workspace/push-key");
    if (!response.ok) throw new Error("Phone alerts unavailable");
    return value?.enabled === true && typeof value.publicKey === "string"
      ? { enabled: true, publicKey: value.publicKey }
      : { enabled: false };
  }
  /**
   * Registers this device's browser push subscription for the signed-in coordinator. A refusal the
   * person can act on comes back as its reason: this account is on its device limit, or another
   * account's alerts are still on for this device.
   */
  async pushSubscribe(subscription: {
    endpoint?: string;
    keys?: Record<string, string>;
  }): Promise<"subscribed" | "limit" | "in-use" | "role"> {
    const { endpoint, keys } = subscription;
    const { response, value } = await this.request("/v1/workspace/push-subscribe", {
      subscription: { endpoint, keys },
    });
    if (response.status === 409 && (value?.code === "limit" || value?.code === "in-use")) return value.code;
    if (response.status === 422 && value?.code === "role") return "role";
    if (!response.ok) throw new Error("Phone alerts were not turned on");
    return "subscribed";
  }
  /** Whether this account owns an active phone alert record for this device. */
  async pushStatus(endpoint: string): Promise<boolean> {
    const { response, value } = await this.request("/v1/workspace/push-status", { endpoint });
    if (!response.ok) throw new Error("Phone alerts could not be checked");
    return value?.owned === true;
  }
  /** Stops phone alerts for this device. True when this account's record was revoked. */
  async pushUnsubscribe(endpoint: string): Promise<boolean> {
    const { response, value } = await this.request("/v1/workspace/push-unsubscribe", { endpoint });
    if (!response.ok) throw new Error("Phone alerts were not turned off");
    return value?.revoked === true;
  }
  /** Work as one of this account's roles (`choose-role`), then read the board again. */
  chooseRole = (workingAs: string) => {
    if (workingAs !== "bootstrap" && !UUID.test(workingAs)) return;
    this.viewGeneration += 1;
    this.pending = null;
    this.queue = [];
    this.headRevision = 0;
    this.workingAsOverride = workingAs;
    this.options.workingAs?.set(workingAs);
    this.publish({ snapshot: null, eventLog: [], status: "loading", choices: undefined, error: null });
    void this.refresh();
  };
  /** Forget the role worked as, so the server lists this account's roles again. */
  switchRole = () => {
    if (this.busy || this.pending) return;
    this.viewGeneration += 1;
    this.workingAsOverride = null;
    this.options.workingAs?.set(null);
    this.publish({ snapshot: null, eventLog: [], status: "loading", error: null });
    void this.refresh();
  };
  /** A change on an access route: done, a fresh sign-in first, or the server's reason. */
  private async change(path: string, body: Record<string, unknown>): Promise<SharedChangeResult> {
    const { response, value } = await this.request(path, body);
    if (response.ok) return null;
    if (response.status === 401 && value?.code === "step-up") return "step-up";
    if (response.status >= 500) throw new Error("Change not confirmed");
    return typeof value?.error === "string" ? value.error : "The change was not made.";
  }
  /** Roles and open requests inside this access admin's own place. */
  async listAccess(): Promise<{ memberships: SharedMembership[]; requests: SharedAccessRequest[] }> {
    const { response, value } = await this.request("/v1/workspace/access");
    if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Roles could not be read");
    return {
      memberships: Array.isArray(value.memberships) ? value.memberships : [],
      requests: Array.isArray(value.requests) ? value.requests : [],
    };
  }
  /** Cover given or held by this account, and, for a coordinator, inside its place. */
  async listCovers(): Promise<SharedMembership[]> {
    const { response, value } = await this.request("/v1/workspace/access/cover");
    if (!response.ok) throw new Error(typeof value?.error === "string" ? value.error : "Cover could not be read");
    return Array.isArray(value.covers) ? value.covers : [];
  }
  grantAccess(input: { actorId: string; role: string; scope: unknown; expiresInMinutes: number }) {
    return this.change("/v1/workspace/access/grant", {
      actorId: input.actorId,
      role: input.role,
      scope: input.scope,
      expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString(),
    });
  }
  approveAccess(membershipId: string) {
    return this.change("/v1/workspace/access/approve", { membershipId });
  }
  /** Removes a role, or ends cover early (its giver may too). */
  revokeAccess(membershipId: string) {
    return this.change("/v1/workspace/access/revoke", { membershipId });
  }
  giveCover(input: { actorId: string; scope: unknown; minutes: number }) {
    return this.change("/v1/workspace/access/cover", input);
  }
  decideRequest(requestId: string, decision: "approved" | "declined", expiresInMinutes: number) {
    return this.change("/v1/workspace/access/decide", {
      requestId,
      decision,
      expiresAt: new Date(Date.now() + expiresInMinutes * 60_000).toISOString(),
    });
  }
  /**
   * Open one record outside this desk's care, read only, for the set window. The server checks
   * the reason (from the list, never typed text), records it, and answers with the board as the
   * desk now sees it, so the record shows at once.
   */
  async breakGlass(patientId: string, reason: string): Promise<SharedChangeResult> {
    const generation = this.viewGeneration;
    const grantGeneration = this.grantGeneration;
    const { response, value } = await this.request("/v1/workspace/break-glass", { patientId, reason });
    if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
    if (response.ok) {
      this.grantGeneration += 1;
      try {
        let opened = value;
        if (grantGeneration !== this.grantGeneration - 1) {
          // Response order is not commit order. Once another opening has answered, re-read the
          // server's full current grant set instead of accepting an earlier response's subset.
          const latest = await this.request("/v1/workspace");
          if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
          if (!latest.response.ok) throw new Error("Opened view unavailable");
          opened = latest.value;
        }
        if (opened?.snapshot) this.adopt(opened.snapshot);
      } catch {
        // The next poll reads the board again.
        if (generation !== this.viewGeneration) return "The working view changed; open the record again.";
      }
      return null;
    }
    if (response.status === 401 && value?.code === "step-up") return "step-up";
    if (response.status >= 500) throw new Error("Change not confirmed");
    return typeof value?.error === "string" ? value.error : "The record was not opened.";
  }
  /** This account's own open request for access, if any. Open to an account with no role. */
  async ownRequest(): Promise<SharedAccessRequest | null> {
    const { response, value } = await this.request("/v1/workspace/access/request");
    if (!response.ok) throw new Error("Your request could not be read");
    return value?.request ?? null;
  }
  /** Ask an access admin for a role at a place. The answer is the server's reason, or `null`. */
  async requestAccess(role: string, scope: unknown): Promise<SharedChangeResult> {
    return this.change("/v1/workspace/access/request", { role, scope });
  }
  retry = async () => {
    // "Check again" from the role picker or the ask for access screen reads the account again.
    if (this.view.status === "no-role" || this.view.status === "choose-role")
      this.publish({ status: "loading", error: null });
    if (this.pending) await this.drain();
    else await this.refresh();
  };
  dispose() {
    this.disposed = true;
    this.lifetime.abort();
    this.queue = [];
    this.pending = null;
    this.view = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  }
}
