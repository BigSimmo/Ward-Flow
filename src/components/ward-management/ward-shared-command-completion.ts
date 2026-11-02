import type { SharedSnapshot } from "./ward-shared-client-types";

const UNAVAILABLE_DISPLAY = Symbol("accepted-command-display-unavailable");
type StateCheck = ((value: unknown) => boolean) | undefined;
type Reply = { commandRevision?: unknown; snapshot?: unknown; [UNAVAILABLE_DISPLAY]?: number };

/** The full operational reply accepted by the client, including legacy command replies. */
export function validSharedSnapshot(
  value: unknown,
  checkState: StateCheck,
  knownPayload = false,
): value is SharedSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const snapshot = value as Partial<SharedSnapshot> & { kind?: unknown };
  if (
    snapshot.kind !== undefined ||
    snapshot.dataMode !== "prototype" ||
    !Number.isSafeInteger(snapshot.revision) ||
    Number(snapshot.revision) < 1 ||
    !Number.isFinite(snapshot.now) ||
    (Number.isFinite(snapshot.accessUntil) && snapshot.accessUntil! <= Date.now()) ||
    (snapshot.accessContext !== undefined &&
      (typeof snapshot.accessContext !== "string" || !/^[a-f0-9]{64}$/.test(snapshot.accessContext))) ||
    snapshot.payload?.version !== 1 ||
    typeof snapshot.payload.dayZero !== "string" ||
    !Number.isFinite(Date.parse(snapshot.payload.dayZero)) ||
    typeof snapshot.payload.startedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.payload.startedAt))
  )
    return false;
  try {
    return knownPayload || Boolean(checkState?.(snapshot.payload.state));
  } catch {
    return false;
  }
}

/** A successful HTTP status alone cannot settle a command or discard its retry identity. */
export function requireCommandCompletion(value: unknown, checkState: StateCheck): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Save not confirmed");
  const reply = value as Reply;
  const revision = Number.isSafeInteger(reply.commandRevision) && Number(reply.commandRevision) > 0;
  const snapshot = reply.snapshot;
  const usable = validSharedSnapshot(snapshot, checkState);
  if (!revision && !usable) throw new Error("Save not confirmed");
  if (revision && snapshot !== undefined && (!usable || snapshot.revision < Number(reply.commandRevision))) {
    // The commit is definitive, but this display is not. Reconcile without resending the action.
    delete reply.snapshot;
    reply[UNAVAILABLE_DISPLAY] = Number(reply.commandRevision);
  }
}

/** A malformed command display must be replaced by a read that includes its proven commit. */
export class CommandDisplayHold {
  private revision = 0;
  note(value: Reply): boolean {
    const revision = value[UNAVAILABLE_DISPLAY];
    if (revision === undefined) return false;
    this.revision = Math.max(this.revision, revision);
    return true;
  }
  check(snapshot: SharedSnapshot | null): void {
    if (!this.revision) return;
    if (!snapshot || snapshot.revision < this.revision)
      throw new Error("The accepted save is not yet reflected in the board");
    this.revision = 0;
  }
  clear(): void {
    this.revision = 0;
  }
}
