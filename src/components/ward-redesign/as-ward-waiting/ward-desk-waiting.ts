// Role view (nurse in charge) for the forked Waiting board: the ward's own words, kept beside the fork
// so the merged component can read them as one more branch on the desk's role.
import { useCallback } from "react";

import { causeTitle } from "@/components/ward-management/delays/delays-board-parts";
import { ownerName } from "@/components/ward-management/delays/delays-board-model";
import { waitingViewHint, waitingViewLabel } from "@/components/ward-management/delays/waiting-views";
import { useEffectiveWardAccess } from "@/components/ward-management/shell/ward-access-store";
import type { Unit } from "@/components/ward-management/ward-model";

/** "On you" on this board is the bed coordinator; a ward desk reads that move as the coordinator's. */
function deskWords(text: string, wardDesk: boolean): string {
  return wardDesk ? text.replace(/on you\b/, "on the coordinator") : text;
}

export function useWardDeskWaiting(units: readonly Unit[]) {
  const access = useEffectiveWardAccess();
  const wardDesk = access.role === "ward";
  const ownUnitIds = access.scope.kind === "ward" ? access.scope.unitIds : [];
  const ownWardName = units.find((unit) => ownUnitIds.includes(unit.id))?.name;
  return {
    wardDesk,
    ownWardName,
    words: useCallback((text: string) => deskWords(text, wardDesk), [wardDesk]),
    causeTitle: useCallback(
      (cause: Parameters<typeof causeTitle>[0]) => deskWords(causeTitle(cause), wardDesk),
      [wardDesk],
    ),
    ownerName: useCallback(
      (owner: Parameters<typeof ownerName>[0]) => deskWords(ownerName(owner), wardDesk),
      [wardDesk],
    ),
    waitingViewLabel: (...args: Parameters<typeof waitingViewLabel>) => deskWords(waitingViewLabel(...args), wardDesk),
    waitingViewHint: (...args: Parameters<typeof waitingViewHint>) => deskWords(waitingViewHint(...args), wardDesk),
  };
}
