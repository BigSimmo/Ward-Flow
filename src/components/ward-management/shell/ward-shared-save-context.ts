"use client";

import { createContext, useContext } from "react";
import type { SharedView } from "../ward-shared-client";

/** Memory-only save recovery. An unconfirmed action must use its existing Retry, not a new submit. */
export type WardSharedSave = {
  unconfirmedSave: boolean;
  status: SharedView["status"];
  error: string | null;
  retry: () => void;
};

export const WardSharedSaveContext = createContext<WardSharedSave | null>(null);

export function useWardSharedSave(): WardSharedSave | null {
  return useContext(WardSharedSaveContext);
}
