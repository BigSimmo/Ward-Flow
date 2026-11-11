"use client";

/**
 * The whole workspace, kept beside the desk's scoped one (role access plan PR 1). Only the desk
 * switcher and the access chrome read it: the switcher is the demo's identity tool and must list
 * every desk, and the closed page names the desk's own place. The Settings Access tab reads its
 * wards and EDs to name places it may grant or cover (no patients). Screens never read it.
 */
import { createContext, use } from "react";
import { WardFlowContext, type WardFlowContextValue } from "@/components/ward-management/ward-flow-provider";

export const UnscopedWardFlowContext = createContext<WardFlowContextValue | null>(null);

export function useUnscopedWardFlow(): WardFlowContextValue {
  // `use`, so a reader under the access scope subscribes to the unscoped value only, and not also
  // to the scoped one it never reads.
  const unscoped = use(UnscopedWardFlowContext);
  if (unscoped) return unscoped;
  const scoped = use(WardFlowContext);
  if (!scoped) throw new Error("useWardFlow must be used within WardFlowProvider.");
  return scoped;
}
