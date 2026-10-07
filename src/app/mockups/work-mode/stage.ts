/** The three-phone stage for the v6 Work mode page. Synthetic demonstration only. */

import { initialWorkModeState, reduceWorkMode, type WorkModeAction, type WorkModeState } from "./state";

/** Records the phones share. Navigation, sheets and notices stay with the phone they happen on. */
const SHARED_KEYS = ["swapAccepted", "leaveSigned", "supervisionConfirmed"] as const;

export type StageState = readonly WorkModeState[];

export type StageAction = { type: "phone"; phone: number; action: WorkModeAction } | { type: "reset" };

/** My Day, Needs you, and the roster swap sheet, as the v6 mockup lays them out. */
export const initialStageState: StageState = [
  initialWorkModeState,
  { ...initialWorkModeState, view: "needs" },
  { ...initialWorkModeState, mode: "rost", tab: 2, overlay: "swap" },
];

export function reduceStage(phones: StageState, action: StageAction): StageState {
  if (action.type === "reset") return initialStageState;
  const current = phones[action.phone];
  if (!current) return phones;
  const next = reduceWorkMode(current, action.action);
  const shared = Object.fromEntries(SHARED_KEYS.map((key) => [key, next[key]])) as Pick<
    WorkModeState,
    (typeof SHARED_KEYS)[number]
  >;
  return phones.map((phone, index) => (index === action.phone ? next : { ...phone, ...shared }));
}
