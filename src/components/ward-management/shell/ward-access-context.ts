"use client";

/**
 * The whole workspace, kept beside the desk's scoped one (role access plan PR 1). Only the desk
 * switcher and the access chrome read it: the switcher is the demo's identity tool and must list
 * every desk, and the closed page names the desk's own place. The Settings Access tab reads its
 * wards and EDs to name places it may grant or cover (no patients). Screens never read it.
 */
import { createContext, useContext } from "react";
import { useWardFlow, type WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";

export const UnscopedWardFlowContext = createContext<WardFlowContextValue | null>(null);

export function useUnscopedWardFlow(): WardFlowContextValue {
  const unscoped = useContext(UnscopedWardFlowContext);
  const scoped = useWardFlow();
  return unscoped ?? scoped;
}
