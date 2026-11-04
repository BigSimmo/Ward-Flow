import type { WardAccessScope } from "../ward-role-access";
import { howToFor } from "./ward-help-access";
import { howToHref } from "./ward-help-href";
import { canShowMe, HOW_TOS, type HowTo } from "./ward-help-howto";
import type { WardTourRole } from "./ward-help-store";

/**
 * Whether Show me can walk this task for this desk on this device: it has steps the device draws,
 * and any screen it opens is one this desk may open (else it could only say "not on the screen").
 */
export function showMeAvailable(
  howTo: HowTo,
  role: WardTourRole,
  home: string | undefined,
  phone: boolean,
  scope?: WardAccessScope,
): boolean {
  return (
    howToFor(howTo, role, scope) &&
    canShowMe(howTo, phone) &&
    (!howTo.go || howToHref(howTo.go, role, home) !== undefined)
  );
}

/**
 * This login's tasks: those named for its desk that it can actually do, on screens it can open
 * (audit finding 11, Josh 31 Oct 2026; `howToFor`). Walks round a screen are not tasks.
 */
export function tasksForDesk(role: WardTourRole, scope?: WardAccessScope): readonly HowTo[] {
  // A walk round a screen is offered on that screen's card, not listed among the jobs.
  return HOW_TOS.filter((howTo) => !howTo.around && howToFor(howTo, role, scope));
}
