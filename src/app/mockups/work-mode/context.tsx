"use client";

import { createContext, useContext } from "react";

import type { WorkModeAction, WorkModeState } from "./state";

export type WorkApi = {
  state: WorkModeState;
  dispatch: (action: WorkModeAction) => void;
};

export const WorkContext = createContext<WorkApi | null>(null);

export function useWork(): WorkApi {
  const value = useContext(WorkContext);
  if (!value) throw new Error("Work mode screens must render inside the phone");
  return value;
}
