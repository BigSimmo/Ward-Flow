import { WardAuthError } from "./ward-supabase-auth";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { eventLogEntryFor, type EventLogEntry } from "./ward-event-log";
import { isValidSharedWardFlowState } from "./ward-shared-state-validation";
import type { BreakGlassGrant } from "./ward-access-scope";
import type { BreakGlassReasonId, WardAccessRole, WardAccessScope } from "./ward-role-access";

export type { BreakGlassGrant, BreakGlassReasonId, WardAccessRole, WardAccessScope };

export interface SharedWorkspaceMembership {
  id: string;
  role: WardAccessRole;
  scope: WardAccessScope;
  label: string;
}

export type SharedSnapshot = {
  dataMode: "prototype";
  revision: number;
  now: number;
  payload: { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
  /** False when the server refuses the demonstration controls (clock, reset and scenario). */
  demoControls?: boolean;
  role?: WardAccessRole;
  membershipId?: string;
  memberships?: readonly SharedWorkspaceMembership[];
  grants?: readonly BreakGlassGrant[];
};

export type SharedWorkspaceEnvelope = SharedSnapshot;

type SharedStatus = "loading" | "ready" | "saving" | "unavailable" | "not-authorised";
export type SharedView = {
  snapshot: SharedSnapshot | null;
  receivedAt: number;
  status: SharedStatus;
  error: string | null;
  eventLog?: readonly EventLogEntry[];
  role?: WardAccessRole;
  membershipId?: string;
  memberships?: readonly SharedWorkspaceMembership[];
  grants?: readonly BreakGlassGrant[];
};
type PendingCommand = {
  dataMode: "prototype";
  classification: "synthetic";
  commandId: string;
  expectedRevision: number;
  event: WardFlowEvent;
  /** Asked for while more commands are queued: an accepted reply then carries no snapshot. */
  reply?: "revision";
};

type RawEnvelope =
  | SharedSnapshot
  | {
      snapshot?: SharedSnapshot;
      role?: WardAccessRole;
      membershipId?: string;
      workingAs?: string;
      memberships?: readonly SharedWorkspaceMembership[];
      grants?: readonly BreakGlassGrant[];
    };

export class SharedWorkspaceClient {
  private view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  private pending: PendingCommand | null = null;
  private queue: WardFlowEvent[] = [];
  private disposed = false;
  private busy = false;
  /** The revision this tab's own accepted revision-only commands reached, ahead of its snapshot. */
  private headRevision = 0;
  private workingAs: string | null = null;
  private readonly lifetime = new AbortController();
  private accessDenied() {
    return this.view.status === "not-authorised";
  }
  constructor(
    private readonly options: {
      baseUrl: string;
      token: () => Promise<string>;
      changed: (view: SharedView) => void;
      fetch?: typeof fetch;
      commandId?: () => string;
    },
  ) {}
  private publish(update: Partial<SharedView>) {
    if (this.disposed) return;
    this.view = { ...this.view, ...update };
    this.options.changed(this.view);
  }
  private adopt(raw: RawEnvelope): SharedSnapshot {
    const hasNested = Boolean(raw && typeof raw === "object" && "snapshot" in raw && raw.snapshot !== undefined);
    const base = (hasNested ? (raw as { snapshot: SharedSnapshot }).snapshot : raw) as SharedSnapshot;
    const outer = (hasNested ? raw : undefined) as
      | {
          role?: WardAccessRole;
          membershipId?: string;
          workingAs?: string;
          memberships?: readonly SharedWorkspaceMembership[];
          grants?: readonly BreakGlassGrant[];
        }
      | undefined;
    if (
      !base ||
      base.dataMode !== "prototype" ||
      !Number.isSafeInteger(base.revision) ||
      base.revision < 1 ||
      !Number.isFinite(base.now) ||
      base.payload?.version !== 1 ||
      !isValidSharedWardFlowState(base.payload.state) ||
      !Number.isFinite(Date.parse(base.payload.dayZero)) ||
      !Number.isFinite(Date.parse(base.payload.startedAt))
    )
      throw new Error("Incompatible workspace data");
    const role = base.role ?? outer?.role ?? this.view.role;
    const membershipId =
      base.membershipId ?? outer?.membershipId ?? outer?.workingAs ?? this.workingAs ?? this.view.membershipId;
    const memberships = base.memberships ?? outer?.memberships ?? this.view.memberships;
    const sameMembership = membershipId === undefined || membershipId === this.view.membershipId;
    const grants = base.grants ?? outer?.grants ?? (sameMembership ? this.view.grants : undefined);
    const snapshot: SharedSnapshot = {
      ...base,
      ...(role !== undefined ? { role } : {}),
      ...(membershipId !== undefined ? { membershipId } : {}),
      ...(memberships !== undefined ? { memberships } : {}),
      ...(grants !== undefined ? { grants } : {}),
    };
    if (snapshot.revision >= (this.view.snapshot?.revision ?? 0)) {
      this.publish({
        snapshot,
        receivedAt: Date.now(),
        ...(role !== undefined ? { role } : {}),
        ...(membershipId !== undefined ? { membershipId } : {}),
        ...(memberships !== undefined ? { memberships } : {}),
        grants,
      });
    }
    return snapshot;
  }
  private async request(path: string, body?: PendingCommand | Record<string, unknown>) {
    let token: string;
    try {
      token = await this.options.token();
    } catch (error) {
      if (error instanceof WardAuthError && error.kind === "session") {
        this.pending = null;
        this.queue = [];
        this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error: error.message });
      }
      throw error;
    }
    if (this.disposed) throw new Error("Connection closed");
    const response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: {
        authorization: `Bearer ${token}`,
        ...(this.workingAs ? { "x-ward-working-as": this.workingAs } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.any([AbortSignal.timeout(15000), this.lifetime.signal]),
    });
    if (this.disposed) throw new Error("Connection closed");
    const denied = (error: string) => {
      this.pending = null;
      this.queue = [];
      this.publish({ snapshot: null, eventLog: [], status: "not-authorised", error });
      return new Error("Access denied");
    };
    if (response.status === 401 || response.status === 403)
      throw denied("Sign in with an account assigned a Ward Flow role.");
    const value = await response.json();
    if (this.disposed) throw new Error("Connection closed");
    // The server holds more than one role for this account and needs to be told which.
    if (response.status === 409 && value?.code === "choose-role")
      throw denied(
        "This account holds more than one role. Choosing which one to work as is not wired in this prototype.",
      );
    return { response, value };
  }
  async refresh() {
    if (this.busy || this.pending || this.disposed || this.view.status === "not-authorised") return;
    this.busy = true;
    try {
      const current = this.view.snapshot;
      // The poll names the revision it holds; an unchanged workspace answers with its clock only.
      const { response, value } = await this.request(
        current ? `/v1/workspace?since=${current.revision}` : "/v1/workspace",
      );
      if (!response.ok) throw new Error("Workspace unavailable");
      if (value?.notModified === true) {
        if (!current || value.revision !== current.revision || !Number.isFinite(value.now))
          throw new Error("Incompatible workspace data");
        if (this.view.snapshot === current)
          this.publish({ snapshot: { ...current, now: value.now }, receivedAt: Date.now() });
      } else this.adopt(value);
      this.publish({ status: "ready", error: this.view.status === "unavailable" ? null : this.view.error });
    } catch {
      if (!this.accessDenied())
        this.publish({
          status: "unavailable",
          error: "The shared board could not be refreshed. Reconnect before making changes.",
        });
    } finally {
      this.busy = false;
      if (this.queue.length && this.view.status === "ready") void this.drain();
    }
  }
  dispatch = (event: WardFlowEvent) => {
    if (
      !this.view.snapshot ||
      this.view.status === "unavailable" ||
      this.view.status === "not-authorised" ||
      this.disposed
    )
      return;
    this.queue.push(event);
    void this.drain();
  };
  private async drain() {
    if (this.busy || this.disposed) return;
    this.busy = true;
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
        const { response, value } = await this.request("/v1/workspace/commands", command);
        if (response.status >= 500) throw new Error("Save not confirmed");
        if (value.snapshot) this.adopt(value.snapshot);
        else if (response.ok && Number.isSafeInteger(value.commandRevision))
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
      if (this.view.status !== "not-authorised")
        this.publish({
          status: "unavailable",
          error: "Save is not confirmed. Retry reconnects using the same command ID, so the action cannot run twice.",
        });
    } finally {
      this.busy = false;
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
  }): Promise<"subscribed" | "limit" | "in-use"> {
    const { endpoint, keys } = subscription;
    const { response, value } = await this.request("/v1/workspace/push-subscribe", {
      subscription: { endpoint, keys },
    });
    if (response.status === 409 && (value?.code === "limit" || value?.code === "in-use")) return value.code;
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
  async selectMembership(membershipId: string): Promise<SharedWorkspaceEnvelope> {
    if (!membershipId || !membershipId.trim()) throw new Error("A role is required");
    const chosenId = membershipId.trim();
    const previousWorkingAs = this.workingAs;
    this.workingAs = chosenId;
    try {
      const { response, value } = await this.request("/v1/workspace");
      if (!response.ok) {
        this.workingAs = previousWorkingAs;
        throw new Error(typeof value?.error === "string" ? value.error : "Role selection was not applied");
      }
      const adopted = this.adopt({
        ...value,
        membershipId: value?.membershipId ?? value?.workingAs ?? chosenId,
      });
      this.publish({ status: "ready", error: null });
      return adopted;
    } catch (error) {
      this.workingAs = previousWorkingAs;
      throw error;
    }
  }
  async breakGlass({
    patientId,
    reason,
  }: {
    patientId: string;
    reason: BreakGlassReasonId;
    otherText?: string;
  }): Promise<SharedWorkspaceEnvelope> {
    const trimmedPatientId = typeof patientId === "string" ? patientId.trim() : "";
    if (!trimmedPatientId) throw new Error("A patient is required");
    const { response, value } = await this.request("/v1/workspace/break-glass", {
      patientId: trimmedPatientId,
      reason,
    });
    if (!response.ok) {
      throw new Error(typeof value?.error === "string" ? value.error : "Break-glass access was refused");
    }
    const adopted = this.adopt(value);
    this.publish({ status: "ready", error: null });
    return adopted;
  }
  retry = async () => {
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
