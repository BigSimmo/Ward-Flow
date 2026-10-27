"use client";

import { useContext } from "react";
import { LogOut, Repeat } from "lucide-react";
import { SharedSessionContext } from "./ward-shared-session-context";

/**
 * Sign out (and Switch role, for an account with more than one) beside the rail's other utility
 * links. Josh, 27 Oct 2026: the strip above the app that used to hold them was pointless, so it now
 * shows only when a save or the connection needs action. Nothing in the local demo.
 */
export function WardAccountActions({ className }: { className: string }) {
  const session = useContext(SharedSessionContext);
  if (!session) return null;
  const signOutLabel = session.accountEmail ? `Sign out ${session.accountEmail}` : "Sign out";
  return (
    <>
      {session.switchRole ? (
        <button
          type="button"
          className={className}
          aria-label="Switch role"
          title="Switch role"
          onClick={session.switchRole}
          data-testid="ward-account-switch-role"
        >
          <Repeat aria-hidden="true" strokeWidth={1.75} />
          <span>Switch role</span>
        </button>
      ) : null}
      <button
        type="button"
        className={className}
        aria-label={signOutLabel}
        title={session.accountEmail ? `Signed in as ${session.accountEmail}. Sign out` : "Sign out"}
        onClick={() => session.signOut()}
        data-testid="ward-account-sign-out"
      >
        <LogOut aria-hidden="true" strokeWidth={1.75} />
        <span>Sign out</span>
      </button>
    </>
  );
}
