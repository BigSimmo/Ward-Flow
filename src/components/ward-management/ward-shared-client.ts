import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import { eventLogEntryFor, type EventLogEntry } from "./ward-event-log";
import { isValidSharedWardFlowState } from "./ward-shared-state-validation";

export type SharedSnapshot = {
  dataMode: "prototype";
  revision: number;
  now: number;
  payload: { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
};
export type SharedStatus = "loading" | "ready" | "saving" | "unavailable" | "not-authorised";
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
};

export class SharedWorkspaceClient {
  private view: SharedView = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  private pending: PendingCommand | null = null;
  private queue: WardFlowEvent[] = [];
  private disposed = false;
  private busy = false;
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
    const token = await this.options.token();
    if (this.disposed) throw new Error("Connection closed");
    const response = await (this.options.fetch ?? fetch)(`${this.options.baseUrl}${path}`, {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 || response.status === 403) {
      this.pending = null;
      this.queue = [];
      this.publish({
        snapshot: null,
        eventLog: [],
        status: "not-authorised",
        error: "Sign in with an account assigned coordinator access.",
      });
      throw new Error("Access denied");
    }
    const value = await response.json();
    return { response, value };
  }
  async refresh() {
    if (this.busy || this.pending || this.disposed || this.view.status === "not-authorised") return;
    this.busy = true;
    try {
      const { response, value } = await this.request("/v1/workspace");
      if (!response.ok) throw new Error("Workspace unavailable");
      this.adopt(value.snapshot);
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
            expectedRevision: snapshot.revision,
            event,
          };
        }
        this.publish({ status: "saving", error: null });
        const command = this.pending;
        const { response, value } = await this.request("/v1/workspace/commands", command);
        if (response.status >= 500) throw new Error("Save not confirmed");
        if (value.snapshot) this.adopt(value.snapshot);
        this.publish({ eventLog: [...(this.view.eventLog ?? []), eventLogEntryFor(command.event, response.ok)] });
        this.pending = null;
        if (!response.ok) {
          this.queue = [];
          this.publish({
            status: "ready",
            error:
              response.status === 409
                ? "Another coordinator changed the board. Your action was not applied; review the latest state."
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
  /** Registers this device's browser push subscription for the signed-in coordinator. */
  async pushSubscribe(subscription: { endpoint?: string; keys?: Record<string, string> }) {
    const { endpoint, keys } = subscription;
    const { response } = await this.request("/v1/workspace/push-subscribe", { subscription: { endpoint, keys } });
    if (!response.ok) throw new Error("Phone alerts were not turned on");
  }
  /** Stops phone alerts for this device. */
  async pushUnsubscribe(endpoint: string) {
    const { response } = await this.request("/v1/workspace/push-unsubscribe", { endpoint });
    if (!response.ok) throw new Error("Phone alerts were not turned off");
  }
  retry = async () => {
    if (this.pending) await this.drain();
    else await this.refresh();
  };
  dispose() {
    this.disposed = true;
    this.queue = [];
    this.pending = null;
    this.view = { snapshot: null, receivedAt: 0, status: "loading", error: null, eventLog: [] };
  }
}
