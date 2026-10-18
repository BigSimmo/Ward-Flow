"use client";

import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from "react";
import { forgetDowntimePack, type DowntimePackOwner } from "./downtime-pack";

const DowntimePackContext = createContext<{
  owner: DowntimePackOwner | null;
  ready: boolean;
  unavailable: string | null;
}>({ owner: null, ready: true, unavailable: null });

/** Mutable lifetime belongs to the external cache, separate from React's immutable context value. */
class PackOwner implements DowntimePackOwner {
  private retained = true;
  private available = true;
  constructor(
    readonly parent: DowntimePackOwner | null,
    readonly identity: string,
  ) {}
  get active() {
    return this.retained;
  }
  get ready() {
    return this.available;
  }
  setActive(value: boolean) {
    this.retained = value;
  }
  setReady(value: boolean) {
    this.available = value;
  }
}

/**
 * Mounted above route navigation. Each session/access transition gets a new opaque owner, including
 * a switch away and back while the report is closed. Cache comparisons use object identity only.
 * Nested boundaries combine the authenticated session with the effective desk and its grants.
 */
export function DowntimePackBoundary({
  identity,
  ready = true,
  unavailable = null,
  children,
}: {
  identity: string;
  ready?: boolean;
  unavailable?: string | null;
  children: ReactNode;
}) {
  const parent = useContext(DowntimePackContext);
  const owner = useMemo(() => new PackOwner(parent.owner, identity), [parent.owner, identity]);
  const reason = parent.unavailable ?? unavailable;
  const available = parent.ready && ready && reason === null;
  const value = useMemo(() => ({ owner, ready: available, unavailable: reason }), [owner, available, reason]);
  useLayoutEffect(() => {
    owner.setActive(true);
    return () => {
      owner.setActive(false);
      forgetDowntimePack(owner);
    };
  }, [owner]);
  useLayoutEffect(() => {
    owner.setReady(available);
  }, [owner, available]);
  return <DowntimePackContext.Provider value={value}>{children}</DowntimePackContext.Provider>;
}

export function useDowntimePackOwner(): DowntimePackOwner | null {
  return useContext(DowntimePackContext).owner;
}

export function useDowntimePackAccess() {
  return useContext(DowntimePackContext);
}
