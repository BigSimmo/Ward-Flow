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
type SharedStatus = "loading" | "ready" | "saving" | "unavailable" | "not-authorised";
export type SharedView = {
  snapshot: SharedSnapshot | null;
  receivedAt: number;
  status: SharedStatus;
  error: string | null;
  eventLog?: readonly EventLogEntry[];
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

export class SharedWorkspaceClient {
  private view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  private pending: PendingCommand | null = null;
  private queue: WardFlowEvent[] = [];
  private disposed = false;
  private busy = false;
  /** The revision this tab's own accepted revision-only commands reached, ahead of its snapshot. */
  private headRevision = 0;
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
    if (snapshot.revision >= (this.view.snapshot?.revision ?? 0)) this.publish({ snapshot, receivedAt: Date.now() });
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
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
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
      } else this.adopt(value.snapshot);
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
