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
} from "@/components/ward-management/ward-role-access";
import type { BreakGlassGrant } from "@/components/ward-management/ward-access-scope";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { useWardFeatureFlag } from "./ward-feature-flag-store";

export const WARD_ACCESS_STORAGE_KEY = "wardflow:access-desk-v1";

/** Per-person browser keys cleared when the desk changes or the screen locks (review finding 5). */
export const WARD_PERSONAL_SESSION_KEYS = [
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

type Snapshot = {
  readonly access: WardAccess;
  readonly records: readonly BreakGlassRecord[];
  /** The coordinator previewing another role: the coordinator's own access to return to. */
  readonly previewOf: WardAccess | null;
};

let snapshot: Snapshot = { access: STATEWIDE_COORDINATOR, records: [], previewOf: null };
let loaded = false;
let sequence = 1;
const listeners = new Set<() => void>();

function emit(next: Snapshot): void {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Reads a stored desk, keeping only a known role with a scope that role may hold. */
export function parseStoredAccess(raw: string | null): WardAccess | null {
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
    case "jobs":
      parsed = { kind: s.kind };
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

function load(): void {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const stored = parseStoredAccess(window.sessionStorage.getItem(WARD_ACCESS_STORAGE_KEY));
    if (stored) snapshot = { ...snapshot, access: stored };
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

const SERVER_SNAPSHOT: Snapshot = { access: STATEWIDE_COORDINATOR, records: [], previewOf: null };

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
export function chromeRoleForAccess(access: WardAccess): WardChromeRole {
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

/** Take a desk. A new person at the desk loses the last person's grants and session keys. */
export function setWardAccess(access: WardAccess): void {
  if (!accessIsValid(access)) return;
  load();
  persist(access);
  clearPersonalKeys();
  emit({ access, records: expireGrants(snapshot.records), previewOf: null });
}

/** The coordinator previews another role, read only, and can return in one tap (feature 4). */
export function startAccessPreview(access: WardAccess): void {
  load();
  if (snapshot.access.role !== "coordinator" || !accessIsValid(access)) return;
  emit({ ...snapshot, access, previewOf: snapshot.access });
}

export function endAccessPreview(): void {
  if (!snapshot.previewOf) return;
  emit({ ...snapshot, access: snapshot.previewOf, previewOf: null });
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
  snapshot = { access: STATEWIDE_COORDINATOR, records: [], previewOf: null };
  for (const listener of listeners) listener();
}
