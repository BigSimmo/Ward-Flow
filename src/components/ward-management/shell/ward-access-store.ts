"use client";

/**
 * **WHO IS AT THIS DESK — the local demo's access, held for this tab (role access plan, PR 1).**
 *
 * With the `role-access` flag on, the desk picked in Switch workstation becomes the access: its role
 * and its place. Every page is checked against it and the workspace is scoped to it. With the flag
 * off nothing here is read and everyone has the statewide coordinator's view, as before.
 *
 * Storage: the role and place ids only, in this tab's session storage, so a reload keeps the desk.
 * No names, no typed text. Break glass grants and their reasons are held in memory only, because a
 * reason can be typed (`CLAUDE.md`: no typed text in browser storage). The shared workspace will
 * take its access from the server instead (plan PR 2).
 *
 * Cover (feature 2): a coordinator or a nurse in charge gives another ward's desk cover of a ward
 * until the end of the shift. While it runs, that desk's access holds both wards (`withCover`). Held
 * in memory only, like break glass, and ended by `endDueCovers` when its time passes.
 */
import { useSyncExternalStore } from "react";
import type { Instant } from "@/components/ward-management/ward-clock";
import {
  ACCESS_ROLE_LABELS,
  STATEWIDE_COORDINATOR,
  WARD_ACCESS_ROLES,
  accessIsValid,
  type BreakGlassReasonId,
  type WardAccess,
  type WardAccessScope,
} from "@/components/ward-management/ward-role-access";
import type { BreakGlassGrant } from "@/components/ward-management/ward-access-scope";
import { withCover } from "@/components/ward-management/ward-access-shell-rules";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { useWardFeatureFlag } from "./ward-feature-flag-store";

const WARD_ACCESS_STORAGE_KEY = "wardflow:access-desk-v1";

/** Per-person browser keys cleared when the desk changes or the screen locks (review finding 5). */
const WARD_PERSONAL_SESSION_KEYS = [
  "ward-flow-coordinator-last-look",
  "ward_flow_home_ed_filter",
  "wardflow:census-bed-opener",
  "wardflow:census-bed-opener-target",
] as const;

/** One break glass opening, kept in memory for the coordinator's review list. */
export type BreakGlassRecord = BreakGlassGrant & {
  readonly id: number;
  readonly openedAt: Instant;
  readonly role: WardAccess["role"];
  readonly roleLabel: string;
  readonly placeLabel: string;
  readonly reason: BreakGlassReasonId;
  /** Only for "Other". Memory only, never stored. */
  readonly otherText?: string;
};

/** Cover of one ward or ED given to another desk until a set time (feature 2). Memory only. */
export type CoverRecord = {
  readonly id: number;
  /** The desk holding the cover: a nurse in charge's ward desk, or an ED desk. */
  readonly recipient: WardAccess;
  /** The ward or ED it covers. */
  readonly scope: WardAccessScope;
  readonly givenBy: WardAccess;
  readonly givenAt: Instant;
  readonly until: Instant;
};

type Snapshot = {
  /** The desk's own access, with any cover it holds joined in (`withCover`). */
  readonly access: WardAccess;
  /** The desk as picked, before cover. */
  readonly desk: WardAccess;
  readonly records: readonly BreakGlassRecord[];
  /** The coordinator previewing another role: the coordinator's own access to return to. */
  readonly previewOf: WardAccess | null;
  readonly covers: readonly CoverRecord[];
  /** The page a desk switch is leaving while the new desk's home loads (`markDeskSwitch`). */
  readonly switchFrom?: string;
};

const EMPTY: Snapshot = {
  access: STATEWIDE_COORDINATOR,
  desk: STATEWIDE_COORDINATOR,
  records: [],
  previewOf: null,
  covers: [],
};
let snapshot: Snapshot = EMPTY;
let loaded = false;
let sequence = 1;
const listeners = new Set<() => void>();

/** One desk is its role at its place. */
export function sameDesk(a: WardAccess, b: WardAccess): boolean {
  return a.role === b.role && JSON.stringify(a.scope) === JSON.stringify(b.scope);
}

/** The desk's access with the cover it holds now joined in. Ended cover is already gone. */
function covered(desk: WardAccess, covers: readonly CoverRecord[]): WardAccess {
  const held = covers.filter((cover) => sameDesk(cover.recipient, desk)).map((cover) => cover.scope);
  return held.length ? withCover(desk, held) : desk;
}

function emit(next: Omit<Snapshot, "access">): void {
  const access = covered(next.desk, next.covers);
  snapshot = { ...next, access: sameDesk(access, snapshot.access) ? snapshot.access : access };
  for (const listener of listeners) listener();
}

/**
 * Reads a stored desk, keeping only a known role with a scope that role may hold. `shared` reads a
 * role from the shared server, which refuses a transport officer with no health service (audit
 * 24-5 RA-02); the local demo's officer desk works across every service and keeps reading.
 */
export function parseStoredAccess(
  raw: string | null,
  { shared = false }: { shared?: boolean } = {},
): WardAccess | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { role, scope } = value as { role?: unknown; scope?: unknown };
  if (typeof role !== "string" || !(WARD_ACCESS_ROLES as readonly string[]).includes(role)) return null;
  if (!scope || typeof scope !== "object") return null;
  const s = scope as Record<string, unknown>;
  let parsed: WardAccess["scope"] | null = null;
  switch (s.kind) {
    case "statewide":
      parsed = { kind: s.kind };
      break;
    case "jobs":
      if (s.service === undefined) parsed = shared ? null : { kind: "jobs" };
      else
        parsed =
          typeof s.service === "string" && (HEALTH_SERVICES as readonly string[]).includes(s.service)
            ? { kind: "jobs", service: s.service as (typeof HEALTH_SERVICES)[number] }
            : null;
      break;
    case "service":
      parsed =
        typeof s.service === "string" && (HEALTH_SERVICES as readonly string[]).includes(s.service)
          ? { kind: "service", service: s.service as (typeof HEALTH_SERVICES)[number] }
          : null;
      break;
    case "site":
      parsed =
        typeof s.siteCode === "string" && s.siteCode.length <= 40 ? { kind: "site", siteCode: s.siteCode } : null;
      break;
    case "ward":
      parsed =
        Array.isArray(s.unitIds) && s.unitIds.every((id) => typeof id === "string" && id.length <= 80)
          ? { kind: "ward", unitIds: s.unitIds as string[] }
          : null;
      break;
    case "ed":
      parsed = typeof s.edId === "string" && s.edId.length <= 80 ? { kind: "ed", edId: s.edId } : null;
      break;
    case "team":
      parsed =
        typeof s.teamName === "string" && s.teamName.length <= 120 ? { kind: "team", teamName: s.teamName } : null;
      break;
  }
  if (!parsed) return null;
  const access = { role: role as WardAccess["role"], scope: parsed };
  return accessIsValid(access) ? access : null;
}

/** A role from the server that is a transport officer naming no health service (audit 24-5 RA-02). */
export function sharedAccessNeedsService(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const { role, scope } = value as { role?: unknown; scope?: unknown };
  if (role !== "officer" || !scope || typeof scope !== "object") return false;
  const s = scope as Record<string, unknown>;
  return s.kind === "jobs" && s.service === undefined;
}

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const stored = parseStoredAccess(window.sessionStorage.getItem(WARD_ACCESS_STORAGE_KEY));
    if (stored) snapshot = { ...snapshot, access: covered(stored, snapshot.covers), desk: stored };
  } catch {
    // Storage blocked: the desk lasts until the tab reloads.
  }
}

function persist(access: WardAccess): void {
  try {
    window.sessionStorage.setItem(WARD_ACCESS_STORAGE_KEY, JSON.stringify(access));
  } catch {
    // Storage blocked: keep the desk in memory.
  }
}

function clearPersonalKeys(): void {
  try {
    for (const key of WARD_PERSONAL_SESSION_KEYS) window.sessionStorage.removeItem(key);
  } catch {
    // Nothing to clear.
  }
}

/** Ends every open grant but keeps the record for the coordinator's review list. */
function expireGrants(records: readonly BreakGlassRecord[]): BreakGlassRecord[] {
  return records.map((record) => ({ ...record, until: Math.min(record.until, record.openedAt) }));
}

function subscribe(listener: () => void): () => void {
  load();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  load();
  return snapshot;
}

const SERVER_SNAPSHOT: Snapshot = EMPTY;

export function useWardAccessSnapshot(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}

/** The access in force: the desk's when the flag is on, the whole view when it is off. */
export function useEffectiveWardAccess(): WardAccess {
  const on = useWardFeatureFlag("role-access");
  const { access } = useWardAccessSnapshot();
  return on ? access : STATEWIDE_COORDINATOR;
}

/** The access role as the existing chrome knows roles. An access admin has no clinical chrome, so it
 *  reads as executive there, which offers no actions at all. */
function chromeRoleForAccess(access: WardAccess): WardChromeRole {
  return access.role === "admin" ? "executive" : access.role;
}

/**
 * The shell's role: the desk's when the flag is on and the desk is not a coordinator's, otherwise
 * `fallback` (today's route-based behaviour, which a coordinator keeps).
 */
export function useAccessShellRole(fallback: WardChromeRole): WardChromeRole {
  const access = useEffectiveWardAccess();
  return access.role === "coordinator" ? fallback : chromeRoleForAccess(access);
}

/** The desk's name in the menus. The access admin borrows the executive chrome but is named for itself. */
export function useDeskRoleLabel(role: WardChromeRole): string {
  const access = useEffectiveWardAccess();
  return access.role === "admin" ? ACCESS_ROLE_LABELS.admin : CHROME_ROLE_LABELS[role];
}

/**
 * Take a desk. A new person at the desk loses the last person's grants and session keys. In the
 * shared workspace (`fromServer`) the server's access already carries any cover, so the local
 * demo's covers are dropped and never widen it.
 */
export function setWardAccess(access: WardAccess, { fromServer = false }: { fromServer?: boolean } = {}): void {
  if (!accessIsValid(access)) return;
  load();
  persist(access);
  clearPersonalKeys();
  emit({
    desk: access,
    records: expireGrants(snapshot.records),
    previewOf: null,
    covers: fromServer ? [] : snapshot.covers,
  });
}

/**
 * Go to a desk takes the new desk's access at once, then moves to its home. On a slow server the old
 * page stays up for seconds and, under the new desk, read "Not part of your role" as though the
 * switch had failed (visual desk, #576). While a switch is on its way that page's closed screen says
 * the desk is opening instead. The switcher marks it and clears it after a wait. Nothing here
 * changes what a desk can open.
 */
export function markDeskSwitch(leaving?: string): void {
  emit({ ...snapshot, switchFrom: leaving });
}

/** The coordinator previews another role, read only, and can return in one tap (feature 4). */
export function startAccessPreview(access: WardAccess): void {
  load();
  if (snapshot.access.role !== "coordinator" || !accessIsValid(access)) return;
  // A preview started from another preview still returns to the coordinator who began it.
  emit({ ...snapshot, desk: access, previewOf: snapshot.previewOf ?? snapshot.desk });
}

export function endAccessPreview(): void {
  if (!snapshot.previewOf) return;
  emit({ ...snapshot, desk: snapshot.previewOf, previewOf: null });
}

/**
 * Give another desk cover of one ward or ED until `until` (feature 2). The rules (who may give it,
 * for how long) are checked by the caller with `coverRefusal`. A preview gives nothing, because a
 * preview is read only.
 */
export function giveCover(input: {
  recipient: WardAccess;
  scope: WardAccessScope;
  now: Instant;
  until: Instant;
}): CoverRecord | null {
  load();
  if (snapshot.previewOf !== null || !accessIsValid(input.recipient) || !(input.until > input.now)) return null;
  const record: CoverRecord = {
    id: sequence++,
    recipient: input.recipient,
    scope: input.scope,
    givenBy: snapshot.desk,
    givenAt: input.now,
    until: input.until,
  };
  emit({ ...snapshot, covers: [...snapshot.covers, record] });
  return record;
}

/** End one cover now. */
export function endCover(id: number): void {
  load();
  if (!snapshot.covers.some((cover) => cover.id === id)) return;
  emit({ ...snapshot, covers: snapshot.covers.filter((cover) => cover.id !== id) });
}

/** Cover whose time has passed ends by itself. The scoped layout calls this as the clock moves. */
export function endDueCovers(now: Instant): void {
  if (!snapshot.covers.some((cover) => cover.until <= now)) return;
  emit({ ...snapshot, covers: snapshot.covers.filter((cover) => cover.until > now) });
}

/**
 * The idle lock: every grant ends and the personal keys are cleared, but the desk keeps its own
 * restricted access. Locking never widens access (review on PR #330): falling back to the
 * statewide view would hand the next person at a shared computer every patient.
 */
export function lockWardDesk(): void {
  load();
  clearPersonalKeys();
  emit({ ...snapshot, records: expireGrants(snapshot.records) });
}

/**
 * A signed-in session ended (sign-out, expiry or the idle lock signing out): forget this account's
 * break glass records (with any typed "Other" reason), cover and any coordinator preview, so the
 * next account in this tab inherits none of them (Codex review on PR #487). Like the idle lock, it
 * never widens access: the desk keeps its own restricted scope until the next account's access
 * arrives from the server.
 */
function forgetAccountAccess(): void {
  load();
  clearPersonalKeys();
  emit({ desk: snapshot.desk, records: [], previewOf: null, covers: [] });
}
onWardSessionEnd(forgetAccountAccess);

/**
 * Open one patient record outside the desk's care, read only, for a set time (plan section 7).
 * Returns `null` and records nothing during a coordinator preview: a preview is read only and must
 * never be logged as the previewed desk (review on PR #330).
 */
export function breakGlass(input: {
  patientId: string;
  now: Instant;
  windowMinutes: number;
  reason: BreakGlassReasonId;
  otherText?: string;
  placeLabel: string;
}): BreakGlassRecord | null {
  load();
  if (snapshot.previewOf !== null) return null;
  const record: BreakGlassRecord = {
    id: sequence++,
    patientId: input.patientId,
    openedAt: input.now,
    until: input.now + input.windowMinutes,
    role: snapshot.access.role,
    roleLabel: ACCESS_ROLE_LABELS[snapshot.access.role],
    placeLabel: input.placeLabel,
    reason: input.reason,
    ...(input.reason === "other" && input.otherText ? { otherText: input.otherText.slice(0, 200) } : {}),
  };
  emit({ ...snapshot, records: [...snapshot.records, record] });
  return record;
}

/** The desk as it stands, outside React (tests and one-off reads). */
export function readWardAccessSnapshot(): Snapshot {
  return getSnapshot();
}

/** Test seam: forget everything. */
export function resetWardAccessStoreForTests(): void {
  loaded = false;
  sequence = 1;
  snapshot = EMPTY;
  for (const listener of listeners) listener();
}
