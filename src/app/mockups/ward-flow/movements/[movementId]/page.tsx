import type { Metadata } from "next";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { safeDecodeURIComponent } from "@/lib/safe-url";

export const metadata: Metadata = {
  title: "Patient - Ward Flow",
  description: "Unified synthetic patient dossier and transit operations for Ward Flow.",
};

/** Legacy movement links resolve the same live dossier without losing navigation context. */
export default async function WardMovementPage({ params }: { params: Promise<{ movementId: string }> }) {
  const { movementId } = await params;
  const id = safeDecodeURIComponent(movementId);
  if (!id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id || movementId} reason="not-a-movement-id" />;
  }
  return <PatientNowScreen movementId={id} />;
}
