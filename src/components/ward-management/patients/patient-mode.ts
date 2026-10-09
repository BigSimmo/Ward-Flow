import type { WfTone } from "@/components/wf";
import type { Admission } from "@/components/ward-management/ward-admissions";
import type { LeaveBed, Movement } from "@/components/ward-management/ward-model";
import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * The Patient page's mode (gate board, 9 Oct 2026). The record state comes from the resolver order
 * the app already uses: an open movement, then an occupied bed, otherwise not active. An open
 * movement splits by stage into the three placement modes. An occupied bed is On leave when the stay
 * has a leave bed, and Absent without leave when that held bed records an absence (D-38). A record
 * with nothing open is On a CTO when the patient record holds a community treatment order (D-38).
 */
export type PatientMode = "find" | "held" | "transit" | "ward" | "leave" | "awol" | "idle" | "cto";

export const PATIENT_MODES: Record<
  PatientMode,
  { label: string; pill: string; tone: WfTone; placing: boolean; quiet: boolean }
> = {
  find: { label: "Finding a bed", pill: "In placement", tone: "info", placing: true, quiet: false },
  held: { label: "Bed held", pill: "In placement", tone: "info", placing: true, quiet: false },
  transit: { label: "In transit", pill: "In placement", tone: "info", placing: true, quiet: false },
  ward: { label: "On ward", pill: "On ward", tone: "success", placing: false, quiet: false },
  leave: { label: "On leave", pill: "On leave", tone: "neutral", placing: false, quiet: false },
  awol: { label: "Absent without leave", pill: "Absent without leave", tone: "danger", placing: false, quiet: false },
  idle: { label: "Not active", pill: "Not active", tone: "neutral", placing: false, quiet: true },
  cto: { label: "On a CTO", pill: "Not active", tone: "neutral", placing: false, quiet: true },
};

/** True while the movement is still moving someone: not closed, not arrived, stay not departed. */
export function isOpenMovement(movement: Movement | undefined, admission?: Admission): boolean {
  return Boolean(movement && !movement.closure && movement.stage !== "arrived" && admission?.state !== "departed");
}

export function patientMode({
  movement,
  admission,
  leaveBed,
  patient,
}: {
  movement?: Movement;
  admission?: Admission;
  /** The held bed for this stay, if it is on leave or absent. Joined by stay, never by person. */
  leaveBed?: LeaveBed;
  patient?: Patient;
}): PatientMode {
  if (movement && isOpenMovement(movement, admission)) {
    if (movement.stage === "placement_requested" || movement.stage === "destination_review") return "find";
    if (movement.stage === "accepted_awaiting_bed" || movement.stage === "pulled") return "held";
    return "transit";
  }
  const onWard = admission?.state === "occupied";
  if (onWard) {
    if (leaveBed && admission && leaveBed.admissionId === admission.id) {
      return leaveBed.absentWithoutLeave ? "awol" : "leave";
    }
    return "ward";
  }
  return patient?.communityTreatmentOrder ? "cto" : "idle";
}
