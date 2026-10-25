"use client";

import { useSyncExternalStore } from "react";

import { onWardSessionEnd } from "@/components/ward-management/ward-browser-data";
import { useOptionalWardFlowSelect } from "@/components/ward-management/ward-flow-provider";

export type PracticeSession = { scenario: string; generation: number; startedWith: ReadonlySet<string> };

/**
 * The running practice, held at module level so it survives the Tools sheet closing while the
 * learner works in the real screens. Tied to the scenario and the world generation: switching
 * scenario, resetting the demo or loading a scenario file ends it, since newly seeded requests would
 * otherwise look like ones the learner raised.
 */
let session: PracticeSession | null = null;
const listeners = new Set<() => void>();

export function setPracticeSession(next: PracticeSession | null) {
  session = next;
  for (const listener of listeners) listener();
}

// A practice belongs to the person running it, so signing out ends it (PR #487).
onWardSessionEnd(() => setPracticeSession(null));

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const readSession = () => session;
const serverSession = () => null;

/**
 * Audit 24-7 (CT-17): whether a practice is running for the current scenario and demo, so screens
 * outside Tools can say so. Never true in the shared workspace, where practice is off (CT-01).
 */
export function usePracticeRunning(): boolean {
  const ward = useOptionalWardFlowSelect("scenario", "worldGeneration", "shared");
  const current = usePracticeSession();
  if (!ward || !current || ward.shared?.enabled === true) return false;
  return current.scenario === ward.scenario && current.generation === ward.worldGeneration;
}

/** The running practice, or null. Its own small module so the shell can ask without loading the practice panel. */
export function usePracticeSession(): PracticeSession | null {
  return useSyncExternalStore(subscribe, readSession, serverSession);
}
