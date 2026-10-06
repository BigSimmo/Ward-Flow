import { REFERRABLE_MOVEMENT_STAGES } from "@/components/ward-management/ward-flow-reducer";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { createPatientResolver } from "@/components/ward-management/ward-patient-resolver";
import type { Patient } from "@/components/ward-management/ward-patients";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { edById, edShortName } from "@/components/ward-management/ward-sites";
import { movementHref } from "@/components/ward-management/shell/ward-facade";

/** Where a task-card action should land. The card does not perform the clinical write itself. */
export type TaskFocus = "record" | "refer" | "contact" | "escalate";

/** Facts already on the movement, resolved once so the drawer stays free of the app provider. */
export type TaskCardContext = {
  displayName: string;
  umrn: string;
  location?: string;
  destination?: string;
  stageLabel: string;
  legalStatus: string;
  canRefer: boolean;
  alreadyEscalated: boolean;
};

type ResolverState = {
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  movements?: readonly Movement[];
};

/** One context per movement id. Missing patients stay on the resolver's own unknown-patient wording. */
export function buildTaskCardContexts(
  movements: readonly Movement[],
  units: readonly Unit[],
  state: ResolverState,
): Record<string, TaskCardContext> {
  const resolve = createPatientResolver(state);
  const contexts: Record<string, TaskCardContext> = {};
  for (const movement of movements) {
    const person = resolve(movement);
    const location = edShortName(edById(movement.originEdId));
    const destination = movement.acceptedUnitId
      ? units.find((unit) => unit.id === movement.acceptedUnitId)?.name
      : undefined;
    contexts[movement.id] = {
      displayName: person.displayName,
      umrn: person.umrn,
      location: location || undefined,
      destination,
      stageLabel: stageCopy[movement.stage].shortLabel,
      legalStatus: movement.legalStatus,
      canRefer: movement.closure === undefined && REFERRABLE_MOVEMENT_STAGES.includes(movement.stage),
      alreadyEscalated: movement.escalation !== undefined,
    };
  }
  return contexts;
}

/** Drops the movement id that inbox details still lead with. The owner is never part of this string. */
export function visibleTaskDetail(detail: string): string {
  const parts = detail.split(" · ");
  if (parts[0]?.startsWith("WF-")) return parts.slice(1).join(" · ");
  return detail;
}

/** Route for a task action. Escalate opens the delays dossier; the others open the patient record. */
export function taskFocusHref(movementId: string, focus: TaskFocus = "record"): string {
  if (focus === "escalate") {
    return `/mockups/ward-flow/delays?movement=${encodeURIComponent(movementId)}`;
  }
  const record = movementHref(movementId);
  if (focus === "refer" || focus === "contact") return `${record}?focus=${focus}`;
  return record;
}
