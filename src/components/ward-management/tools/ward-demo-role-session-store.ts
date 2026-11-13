"use client";

import { useSyncExternalStore } from "react";

import type { WardAccess } from "../ward-role-access";
import type { WardChromeRole } from "../ward-chrome-role";

export type DemoRoleSession = {
  readonly desk: WardAccess;
  readonly deviceFlag: boolean | null;
  readonly persona: WardChromeRole;
  readonly personaDeskId?: string;
};

/*
 * The See it as session on its own, without the code that starts or ends one
 * (`ward-demo-role-session.ts`). The app shell's Viewing as gate reads only this, so every screen's
 * first load carries the store and not the role switching (phone size limits, 13 Nov 2026).
 *
 * Memory only. Opening/closing the Demo menu and client-side role navigation must not lose
 * the starting desk. Nothing here changes a scenario, account membership or shared permission.
 */
let session: DemoRoleSession | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDemoRoleSession() {
  return useSyncExternalStore(
    subscribe,
    () => session,
    () => null,
  );
}

/** The session now, outside React. */
export function currentDemoRoleSession(): DemoRoleSession | null {
  return session;
}

/**
 * Sets the session without telling readers yet; `publishDemoRoleSession` does that once the desk
 * has changed. Only `ward-demo-role-session.ts` calls these two.
 */
export function writeDemoRoleSession(next: DemoRoleSession | null) {
  session = next;
}

export function publishDemoRoleSession() {
  for (const listener of listeners) listener();
}
