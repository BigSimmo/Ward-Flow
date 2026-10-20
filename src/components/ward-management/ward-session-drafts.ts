import { CLINICAL_VALUES } from "./ward-clinical-values";
/** Explicit synthetic-form exception only. Submitted clinical state still uses the D-18 privacy lock. */
// v2 (19 Oct 2026): drafts saved while legal status still had a default are dropped, not restored.
const PREFIX = "wf-draft:v2:";
export const SESSION_DRAFT_MAX_AGE_MS = CLINICAL_VALUES.sessionLimit.value * 60 * 60_000;
export const SESSION_DRAFT_MAX_CHARS = 256_000;
const SESSION_KEY = "wf-draft-session:v1";
let generation = 0;
let account = "synthetic-demo";
let activeScenarioScope: string | null = null;
let fallbackSession = "memory-only";
let fallbackStartedAt: number | null = null;

function fallbackDetails(): { id: string; startedAt: number } {
  fallbackStartedAt ??= Date.now();
  return { id: fallbackSession, startedAt: fallbackStartedAt };
}

function sessionId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues is also available on HTTP origins where randomUUID is absent.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const draftSessionVersion = () => generation;

function sessionDetails(): { id: string; startedAt: number } {
  const fresh = () => ({ id: sessionId(), startedAt: Date.now() });
  if (typeof window === "undefined") return fallbackDetails();
  try {
    const existing = window.sessionStorage.getItem(SESSION_KEY);
    if (existing) {
      const parsed: unknown = JSON.parse(existing);
      if (
        parsed &&
        typeof parsed === "object" &&
        "id" in parsed &&
        typeof parsed.id === "string" &&
        "startedAt" in parsed &&
        typeof parsed.startedAt === "number" &&
        Number.isFinite(parsed.startedAt) &&
        parsed.startedAt <= Date.now() &&
        Date.now() - parsed.startedAt < SESSION_DRAFT_MAX_AGE_MS
      )
        return { id: parsed.id, startedAt: parsed.startedAt };
      clearSessionDrafts();
    }
    const next = fresh();
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
    return next;
  } catch {
    return fallbackDetails();
  }
}

export function sessionDraftKey(scenario: string, kind: string, subject: string): string {
  return PREFIX + [account, sessionDetails().id, scenario, kind, subject].map(encodeURIComponent).join(":");
}

export function clearSessionDrafts(): void {
  generation += 1;
  activeScenarioScope = null;
  fallbackSession = `memory-only-${generation}`;
  fallbackStartedAt = Date.now();
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i));
    for (const key of keys) if (key?.startsWith("wf-draft:")) storage.removeItem(key);
    storage.removeItem(SESSION_KEY);
  } catch {
    /* Storage can be blocked. Old callbacks remain fenced. */
  }
}

export function setDraftAccount(next: string): void {
  // Start the bounded local recovery window when the account is connected, not on its first keystroke.
  sessionDetails();
  if (account === next) return;
  // A refresh may re-establish the same account; remove only other accounts' entries.
  generation += 1;
  account = next;
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    const prefix = PREFIX + encodeURIComponent(account) + ":";
    for (const key of Array.from({ length: storage.length }, (_, i) => storage.key(i))) {
      if (key?.startsWith("wf-draft:") && !key.startsWith(prefix)) storage.removeItem(key);
    }
  } catch {
    /* The in-memory session fence still applies. */
  }
}

/** Observed world replacement, including incoming shared or cross-tab resets. */
export function setDraftScenarioScope(scope: string): void {
  activeScenarioScope = scope;
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    for (const key of Array.from({ length: storage.length }, (_, i) => storage.key(i))) {
      if (key?.startsWith(PREFIX) && key.split(":")[4] !== encodeURIComponent(scope)) storage.removeItem(key);
    }
  } catch {
    /* Writes to an outgoing world's scope remain fenced even with blocked storage. */
  }
}

export function clearLegacySessionDrafts(): void {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    for (const key of Array.from({ length: storage.length }, (_, i) => storage.key(i))) {
      if (key?.startsWith("wf-draft:") && !key.startsWith(PREFIX)) storage.removeItem(key);
    }
  } catch {
    /* Browser storage may be disabled. */
  }
}

export function readSessionDraft(key: string): string | null {
  if (
    typeof window === "undefined" ||
    !key.startsWith(PREFIX + [account, sessionDetails().id].map(encodeURIComponent).join(":") + ":")
  )
    return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const entry: unknown = JSON.parse(raw);
    if (
      !entry ||
      typeof entry !== "object" ||
      !("version" in entry) ||
      entry.version !== 1 ||
      !("value" in entry) ||
      typeof entry.value !== "string" ||
      entry.value.length > SESSION_DRAFT_MAX_CHARS ||
      !("savedAt" in entry) ||
      typeof entry.savedAt !== "number" ||
      !Number.isFinite(entry.savedAt) ||
      entry.savedAt > Date.now() ||
      entry.savedAt < sessionDetails().startedAt ||
      !("expiresAt" in entry) ||
      typeof entry.expiresAt !== "number" ||
      !Number.isFinite(entry.expiresAt) ||
      entry.expiresAt <= Date.now() ||
      entry.expiresAt <= entry.savedAt ||
      entry.expiresAt > sessionDetails().startedAt + SESSION_DRAFT_MAX_AGE_MS
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return entry.value;
  } catch {
    removeSessionDraft(key);
    return null;
  }
}

export function writeSessionDraft(key: string, value: string, owner: number): boolean {
  if (typeof window === "undefined") return false;
  const session = sessionDetails();
  if (
    owner !== generation ||
    session.startedAt > Date.now() ||
    Date.now() - session.startedAt >= SESSION_DRAFT_MAX_AGE_MS ||
    (activeScenarioScope !== null && key.split(":")[4] !== encodeURIComponent(activeScenarioScope)) ||
    value.length > SESSION_DRAFT_MAX_CHARS ||
    !key.startsWith(PREFIX + [account, session.id].map(encodeURIComponent).join(":") + ":")
  )
    return false;
  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        value,
        savedAt: Date.now(),
        expiresAt: session.startedAt + SESSION_DRAFT_MAX_AGE_MS,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function removeSessionDraft(key: string): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
  } catch {
    /* Browser storage may be disabled. */
  }
}

/** Clear approved recovery on termination, or only legacy caches on a guarded form's mount. */
export function clearWardFlowDraftCaches({ legacyOnly = false }: { legacyOnly?: boolean } = {}): void {
  if (legacyOnly) clearLegacySessionDrafts();
  else clearSessionDrafts();
}
