import type { WardCommandMetadata } from "./ward-command-metadata";
import type { WardFlowEvent } from "./ward-flow-events";
import type { WardFlowState } from "./ward-flow-reducer";
import type { EventLogEntry } from "./ward-event-log";
import type { BoundWardPartialView } from "./ward-partial-view-contract";

// The shared client's public types, kept apart so ward-shared-client.ts stays under the line limit.
export type SharedSnapshot = {
  dataMode: "prototype";
  revision: number;
  now: number;
  payload: { version: 1; state: WardFlowState; dayZero: string; startedAt: string };
  /** False when the server refuses the demonstration controls (clock, reset and scenario). */
  demoControls?: boolean;
  /** Opaque server access lifetime for retained reports; absent on older servers. Never a grant. */
  accessContext?: string;
  /** Earliest known membership, cover or temporary-opening expiry. */
  accessUntil?: number;
  /** Display-only response data, validated against this outer snapshot before publication. */
  partialView?: BoundWardPartialView;
  /** How many closed records this world has archived (migration 14); absent on older servers. */
  archived?: number;
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
  /** Payload stays in this tab; only opaque receipt identity may survive a reload. */
  unconfirmedSave?: boolean;
  /** Audit 24-3 SM-4: `unavailable` only because a save waits on Retry; the board itself is current. */
  boardCurrent?: boolean;
  eventLog?: readonly EventLogEntry[];
  /** The role and place the server says this account is working as now. Checked by the caller. */
  access?: unknown;
  /** The membership id worked as, or "bootstrap" for a WARD_COORDINATOR_USER_IDS account. */
  workingAs?: string | null;
  /** With `choose-role`: the roles to choose from. */
  choices?: readonly SharedRoleChoice[];
  /** With `no-role`: whether this server takes requests for access, and its refusal code (`role-needs-service`). */
  canRequest?: boolean;
  noRoleReason?: string;
  /** The signed-in account's id, to say "You" in the access lists. */
  actorId?: string | null;
  /** This tab chose its role, so it can go back and choose another. */
  canSwitch?: boolean;
  /** Server-bounded retention authorisation; a failed poll never renews it. */
  accessUntil?: number;
  receiptScope?: string;
  recovery?: string;
  recovering?: boolean;
};
/** What a change returns: `null` when done, "step-up" for a fresh sign-in first, or the refusal. */
export type SharedChangeResult = string | null;
/** In-memory completion for one command. A failed save may have reached the server. */
export type WardCommandOutcome = WardCommandMetadata & {
  commandId: string;
  status: "accepted" | "refused" | "failed" | "cancelled";
  /** This command's definitive answer, including after an uncertain response and same-ID Retry.
   * Memory only: scoped forms need no access to another command's event history. */
  confirmation?: Promise<WardCommandOutcome>;
  message?: string;
  /**
   * Audit E-05: an accepted "Refer to wards" that held a ward back, and why. The wards that were
   * suitable were referred; the person must still be told about the one that was not.
   */
  partly?: string;
  undoRecords?: WardFlowState["undoRecords"];
  generation?: number;
  /** Memory-only fence for an accepted toast; never serialized with workspace state. */
  isCurrent?: () => boolean;
  /** Current board availability, separate from the command's permanent lifetime fence. */
  canUndo?: () => boolean;
};
export type WardCommandDispatch = (event: WardFlowEvent) => void | WardCommandOutcome | Promise<WardCommandOutcome>;
