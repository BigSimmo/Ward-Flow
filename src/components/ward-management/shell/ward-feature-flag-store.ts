"use client";

import { useCallback, useEffect } from "react";

import { createBrowserStore } from "@/lib/client-store-factory";
import {
  parseStoredWardFeatureFlags,
  parseWardFeatureFlagList,
  resolveWardFeatureFlags,
  serverWardFeatureFlags,
  wardEnvironment,
  type ResolvedWardFeatureFlag,
  type WardFeatureFlag,
  type WardFeatureFlagOverrides,
} from "@/components/ward-management/ward-feature-flags";

/**
 * This device's feature flag choices (`ward-feature-flags.ts`). Same safe browser storage pattern
 * as the wallboard store: a registered flag name and on or off only, never typed text, and an
 * in-memory fallback when storage is blocked.
 */
export const WARD_FEATURE_FLAGS_STORAGE_KEY = "ward_flow_feature_flags";
const CHANGE_EVENT = "ward_flow_feature_flags_change";
/** A demo link sets flags with `?flags=name:on,other:off`. */
const WARD_FEATURE_FLAGS_URL_PARAM = "flags";

let inMemory: string | null | undefined;

function readRaw(): string | null {
  if (inMemory !== undefined) return inMemory;
  try {
    return window.localStorage.getItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeDeviceOverrides(next: WardFeatureFlagOverrides): void {
  const raw = Object.keys(next).length === 0 ? null : JSON.stringify(next);
  inMemory = raw;
  try {
    if (raw === null) window.localStorage.removeItem(WARD_FEATURE_FLAGS_STORAGE_KEY);
    else window.localStorage.setItem(WARD_FEATURE_FLAGS_STORAGE_KEY, raw);
  } catch {
    // Blocked storage: the in-memory copy above still holds for this tab.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== WARD_FEATURE_FLAGS_STORAGE_KEY) return;
    inMemory = undefined;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const SERVER_FLAGS = resolveWardFeatureFlags({
  environment: wardEnvironment(),
  server: serverWardFeatureFlags(),
  device: {},
});

let cachedRaw: string | null | undefined;
let cachedFlags: ResolvedWardFeatureFlag[] = SERVER_FLAGS;

/** Stable between reads while the stored choice is unchanged, as `useSyncExternalStore` needs. */
function snapshot(): ResolvedWardFeatureFlag[] {
  const raw = readRaw();
  if (raw === cachedRaw) return cachedFlags;
  cachedRaw = raw;
  cachedFlags = resolveWardFeatureFlags({
    environment: wardEnvironment(),
    server: serverWardFeatureFlags(),
    device: parseStoredWardFeatureFlags(raw),
  });
  return cachedFlags;
}

const useFlagStore = createBrowserStore(subscribe, snapshot, SERVER_FLAGS);

export function useWardFeatureFlags(): ResolvedWardFeatureFlag[] {
  return useFlagStore();
}

export function useWardFeatureFlag(name: WardFeatureFlag): boolean {
  return useWardFeatureFlags().find((flag) => flag.name === name)?.on ?? false;
}

/** Sets this device's choice for one flag, or `null` to go back to the server or default value. */
export function setWardFeatureFlagOnDevice(name: WardFeatureFlag, on: boolean | null): void {
  const current = parseStoredWardFeatureFlags(readRaw());
  if (on === null) delete current[name];
  else current[name] = on;
  writeDeviceOverrides(current);
}

/**
 * Applies a demo link's `?flags=` once on load and keeps it on this device, so the flag stays on
 * as the presenter moves between screens. Production ignores it (`resolveWardFeatureFlags`).
 */
export function WardFeatureFlagLink() {
  useEffect(() => {
    const requested = parseWardFeatureFlagList(
      new URLSearchParams(window.location.search).get(WARD_FEATURE_FLAGS_URL_PARAM),
    );
    if (Object.keys(requested).length === 0) return;
    writeDeviceOverrides({ ...parseStoredWardFeatureFlags(readRaw()), ...requested });
  }, []);
  return null;
}

/** A lookup for lists that carry an optional flag per item (the rail, the phone menu). */
export function useWardFeatureFlagCheck(): (name: WardFeatureFlag | undefined) => boolean {
  const flags = useWardFeatureFlags();
  return useCallback(
    (name: WardFeatureFlag | undefined) =>
      name === undefined || (flags.find((flag) => flag.name === name)?.on ?? false),
    [flags],
  );
}
