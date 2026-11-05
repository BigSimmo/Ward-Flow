/** Reload recovery deliberately holds identities, never command bodies or typed content. */
export const COMMAND_RECOVERY_KEY = "wardflow:pending-commands-v2";
export const LEGACY_COMMAND_RECOVERY_KEY = "wardflow:pending-command-v1";
export type RecoveryEntry = { commandId: string; receiptScope: string; expiresAt: number; phase: "queued" | "sent" };
export type RecoveryResult = {
  commandId: string;
  outcome: "accepted" | "partly" | "refused" | "unsent" | "unknown" | "expired";
};
/** Plain words for staff; the outcome codes stay internal. */
export const RECOVERY_OUTCOME_WORDS: Record<RecoveryResult["outcome"], string> = {
  accepted: "saved",
  partly: "partly saved",
  refused: "not saved",
  unsent: "not sent before the reload",
  unknown: "outcome not known",
  expired: "outcome not known, the check ran out of time",
};
type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ENTRIES = 256;

function clean(value: unknown, legacy = false): RecoveryEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<RecoveryEntry>;
  if (
    typeof entry.commandId !== "string" ||
    !UUID.test(entry.commandId) ||
    typeof entry.receiptScope !== "string" ||
    !entry.receiptScope ||
    entry.receiptScope.length > 1024 ||
    typeof entry.expiresAt !== "number" ||
    !Number.isFinite(entry.expiresAt) ||
    entry.expiresAt <= 0 ||
    (!legacy && entry.phase !== "queued" && entry.phase !== "sent")
  )
    return null;
  return {
    commandId: entry.commandId,
    receiptScope: entry.receiptScope,
    expiresAt: entry.expiresAt,
    phase: legacy ? "sent" : entry.phase!,
  };
}

export function readCommandRecovery(storage?: RecoveryStorage): {
  entries: RecoveryEntry[];
  invalid?: boolean;
  unavailable?: boolean;
} {
  if (!storage) return { entries: [] };
  try {
    const raw = storage.getItem(COMMAND_RECOVERY_KEY);
    const legacy = raw === null ? storage.getItem(LEGACY_COMMAND_RECOVERY_KEY) : null;
    if (!raw && !legacy) return { entries: [] };
    if ((raw ?? legacy)!.length > 350_000) return { entries: [], invalid: true };
    const parsed: unknown = JSON.parse((raw ?? legacy)!);
    const oldShape = legacy !== null || (!!parsed && typeof parsed === "object" && "commandId" in parsed);
    const list = oldShape
      ? [parsed]
      : parsed && typeof parsed === "object" && "version" in parsed && parsed.version === 2 && "entries" in parsed
        ? parsed.entries
        : null;
    if (!Array.isArray(list) || list.length > MAX_ENTRIES) return { entries: [], invalid: true };
    const entries = list.map((value) => clean(value, oldShape));
    if (entries.some((entry) => !entry) || new Set(entries.map((entry) => entry!.commandId)).size !== entries.length)
      return { entries: [], invalid: true };
    return { entries: entries as RecoveryEntry[] };
  } catch (error) {
    return error instanceof SyntaxError ? { entries: [], invalid: true } : { entries: [], unavailable: true };
  }
}

export function writeCommandRecovery(storage: RecoveryStorage | undefined, entries: readonly RecoveryEntry[]): boolean {
  if (!storage || entries.length > MAX_ENTRIES) return false;
  const safe = entries.map((entry) => clean(entry));
  if (safe.some((entry) => !entry) || new Set(safe.map((entry) => entry!.commandId)).size !== safe.length) return false;
  try {
    if (safe.length) storage.setItem(COMMAND_RECOVERY_KEY, JSON.stringify({ version: 2, entries: safe }));
    else storage.removeItem(COMMAND_RECOVERY_KEY);
    storage.removeItem(LEGACY_COMMAND_RECOVERY_KEY);
    return true;
  } catch {
    return false;
  }
}

/** Preserve a retained queued marker unless its transition to sent is durable. */
export function recordCommandRecovery(
  storage: RecoveryStorage,
  entry: RecoveryEntry,
): { available: boolean; sendSafe: boolean } {
  const read = readCommandRecovery(storage);
  if (read.unavailable || read.invalid) return { available: false, sendSafe: false };
  const wasQueued = read.entries.some((held) => held.commandId === entry.commandId && held.phase === "queued");
  const entries = read.entries;
  const index = entries.findIndex((held) => held.commandId === entry.commandId);
  if (index < 0) entries.push(entry);
  else entries[index] = entry;
  const available = writeCommandRecovery(storage, entries);
  return { available, sendSafe: available || !wasQueued };
}

/** An unreadable journal must not erase other command identities during per-command cleanup. */
export function removeCommandRecovery(storage: RecoveryStorage, commandId?: string): boolean {
  if (!commandId) return writeCommandRecovery(storage, []);
  const read = readCommandRecovery(storage);
  if (read.unavailable || read.invalid) return false;
  return writeCommandRecovery(
    storage,
    read.entries.filter((held) => held.commandId !== commandId),
  );
}
