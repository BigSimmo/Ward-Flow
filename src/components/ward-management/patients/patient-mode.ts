import type { WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { Movement } from "@/components/ward-management/ward-model";

/**
 * The Patient page's mode (gate board, 9 Oct 2026). The record state comes from the resolver order
 * the app already uses: an open movement, then an occupied bed, otherwise not active. An open
 * movement then splits by stage into the three placement modes a coordinator actually sees.
 *
 * On leave, absent without leave and on a community treatment order are drawn in the mockup but
 * are not derived here: the patient record has no leave, absence or CTO field yet, and adding one
 * is an engine change that needs the owner's OK. Until then those records read as On ward or
 * Not active, which is what the record can prove.
 */
export type PatientMode = "find" | "held" | "transit" | "ward" | "idle";

export const PATIENT_MODES: Record<
  PatientMode,
  { label: string; pill: string; tone: WfTone; placing: boolean; quiet: boolean }
> = {
  find: { label: "Finding a bed", pill: "In placement", tone: "info", placing: true, quiet: false },
  held: { label: "Bed held", pill: "In placement", tone: "info", placing: true, quiet: false },
  transit: { label: "In transit", pill: "In placement", tone: "info", placing: true, quiet: false },
  ward: { label: "On ward", pill: "On ward", tone: "success", placing: false, quiet: false },
  idle: { label: "Not active", pill: "Not active", tone: "neutral", placing: false, quiet: true },
};

/** True while the movement is still moving someone: not closed, not arrived, stay not departed. */
export function isOpenMovement(movement: Movement | undefined, admission?: Admission): boolean {
  return Boolean(movement && !movement.closure && movement.stage !== "arrived" && admission?.state !== "departed");
}

export function patientMode({ movement, admission }: { movement?: Movement; admission?: Admission }): PatientMode {
  if (movement && isOpenMovement(movement, admission)) {
    if (movement.stage === "placement_requested" || movement.stage === "destination_review") return "find";
    if (movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled") return "held";
    return "transit";
  }
  if (admission?.state === "occupied") return "ward";
  if (movement?.stage === "arrived" && admission?.state !== "departed") return "ward";
  return "idle";
}
