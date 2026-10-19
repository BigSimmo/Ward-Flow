"use client";

import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { type MovementId } from "@/components/ward-management/ward-model";
import { MovementWorkspaceCockpit } from "@/components/ward-management/movements/movement-workspace-cockpit";
import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";

export { WardMovementNotFound };

export {
  stageChangeReasonLabel,
  URGENT_FIGURE_FLAG_CEILING,
  urgentFigureFlags,
  unresolvedOriginDepartment,
  stageReachedAt,
} from "@/components/ward-management/movements/movement-workspace-derivations";

/**
 * ⚠️ **THIS IS A MOVEMENT WORKSPACE, AND ITS PROP NOW SAYS SO.** It was `patientId: string`, and
 * the body looks the value up in `movements` — so the name invited a real patient id and nothing
 * stopped one being passed. It worked only because every call site happened to pass a movement.
 * The prop is now `movementId: MovementId`, so the mistake the old name invited fails to compile
 * rather than rendering a dead-end "no movement matches" page.
 *
 * The ROUTE was `/patients/[patientId]` and just as misleading to a human reader
 * as the prop had been to the compiler. It has since moved to
 * `/ward-flow/movements/[movementId]`, nested under the existing `movements` mode page —
 * the site map, the reachability assertion and this file's own doc comment all moved with it.
 *
 * ⚠️ **THE PAGE HAS A TENSE NOW, AND THAT WAS THE DEFECT UNDER MOST OF THE OTHERS** (Ward Lead
 * ruling 2, 2026-09-04). A closed movement is a DIFFERENT ARRANGEMENT of this page, not the same
 * page with a banner on top: what happened comes first and dominant, the live tools demote and go
 * quiet, "Current stage" becomes "Stopped at", and the step track shows where it stopped rather
 * than a highlighted step nobody is standing on.
 *
 * ⚠️ **THE READER IS A COORDINATOR WHO ARRIVED FROM A LIST.** Every route in is a list — patient
 * search, the tracker's review link, four mode screens, the network view — so this page never has
 * to introduce the patient. It opens on the answer: what is wrong, then what it means, then the
 * three things a person can actually do.
 */
export function WardPatientWorkspace({ movementId }: { movementId: MovementId }) {
  const { movements } = useWardFlowSelect("movements");
  const patient = movements.find((candidate) => candidate.id === movementId);

  if (!patient) {
    return <WardMovementNotFound requestedId={movementId} reason="no-such-movement" />;
  }

  return <MovementWorkspaceCockpit movementId={movementId} />;
}
