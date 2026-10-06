import type { Metadata } from "next";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";

export const metadata: Metadata = {
  title: "Patient - Ward Flow",
  description: "Unified synthetic patient dossier and transit operations for Ward Flow.",
};

/** Legacy movement links resolve the same live dossier without losing navigation context. */
export default async function WardMovementPage({
  params,
  searchParams,
}: {
  params: Promise<{ movementId: string }>;
  searchParams?: Promise<{ taskAction?: string }>;
}) {
  const { movementId } = await params;
  let id: string;
  try {
    id = decodeURIComponent(movementId);
  } catch {
    return <WardMovementNotFound requestedId={movementId} reason="not-a-movement-id" />;
  }
  if (!id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-movement-id" />;
  }
  const { taskAction } = (await searchParams) ?? {};
  return (
    <PatientNowScreen
      key={`${id}:${taskAction ?? ""}`}
      movementId={id}
      initialTaskAction={taskAction === "refer" || taskAction === "contact" ? taskAction : undefined}
    />
  );
}
