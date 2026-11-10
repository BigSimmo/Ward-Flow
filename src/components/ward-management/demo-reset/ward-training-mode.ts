"use client";

import { useSyncExternalStore } from "react";

import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";

/**
 * TRAINING SANDBOX (feature 47, "a safe practice space with synthetic patients for new staff").
 *
 * While training is on, `WardFlowProvider` swaps in a throwaway local world seeded from the standard
 * synthetic demo scenario, never from the shared snapshot, and sends every change only to that world.
 * Nothing reaches the shared workspace, the activity audit, this device's saved demo or another tab.
 *
 * Only an on/off flag is kept, in this tab's sessionStorage (or memory when storage is blocked), so a
 * reload of the same tab stays in training. No patient data is ever stored here. The training world
 * itself lives in memory only and is discarded when training stops.
 */
const KEY = "wf-training";
let memory: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (memory !== null) return memory;
  try {
    memory = typeof window !== "undefined" && window.sessionStorage.getItem(KEY) === "on";
  } catch {
    memory = false;
  }
  return memory;
}

function write(on: boolean) {
  if (read() === on) return;
  memory = on;
  try {
    if (on) window.sessionStorage.setItem(KEY, "on");
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* Blocked storage: training still runs for this page, held in memory. */
  }
  for (const listener of listeners) listener();
}

export const startTraining = () => write(true);
export const stopTraining = () => write(false);

/** Called on every start and stop, for small stores that belong to one world (the practice steps). */
export function onTrainingChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Training belongs to the person running it, so signing out ends it, as it does a practice.
onWardSessionEnd(() => stopTraining());

/** True while this tab is in the training sandbox. False on the server and in the hydration render. */
export function useTrainingMode(): boolean {
  return useSyncExternalStore(onTrainingChange, read, () => false);
}
