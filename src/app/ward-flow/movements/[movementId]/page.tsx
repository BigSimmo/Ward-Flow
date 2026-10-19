import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { decodeRecordAddress, querySuffix } from "@/components/ward-management/shell/ward-record-address";

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
  const query = (await searchParams) ?? {};
  let segment: string;
  try {
    segment = decodeURIComponent(movementId);
  } catch {
    return <WardMovementNotFound requestedId={movementId} reason="not-a-movement-id" />;
  }
  // D-39 (15 Oct 2026): the address carries a code, never the journey number. An old link with the
  // raw id still works: it is sent on to the coded address, with its query kept.
  const decoded = decodeRecordAddress(segment);
  if (decoded === null && segment.startsWith("WF-")) redirect(`${movementHref(segment)}${querySuffix(query)}`);
  const id = decoded ?? segment;
  if (!id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-movement-id" />;
  }
  const { taskAction } = query;
  return (
    <PatientNowScreen
      key={`${id}:${taskAction ?? ""}`}
      movementId={id}
      initialTaskAction={taskAction === "refer" || taskAction === "contact" ? taskAction : undefined}
    />
  );
}
