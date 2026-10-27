import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { decodeRecordAddress, querySuffix } from "@/components/ward-management/shell/ward-record-address";

// DR-11: a movement record is told apart from a person's page by its tab title. No name goes in it.
const MOVEMENT_TITLE = "Movement record — Ward Flow";

export const metadata: Metadata = {
  title: MOVEMENT_TITLE,
  description: "Synthetic patient record and transport for Ward Flow.",
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
    // H-0195 (Josh, 27 Oct 2026): a malformed address is a real 404; `not-found.tsx` keeps the wording.
    notFound();
  }
  // D-39 (15 Oct 2026): the address carries a code, never the journey number. An old link with the
  // raw id still works: it is sent on to the coded address, with its query kept.
  const decoded = decodeRecordAddress(segment);
  if (decoded === null && segment.startsWith("WF-")) redirect(`${movementHref(segment)}${querySuffix(query)}`);
  const id = decoded ?? segment;
  // A patient id here is a wrong turn, not a bad address: the page links on to that patient.
  if (id.startsWith("PT-")) return <WardMovementNotFound requestedId={id} reason="not-a-movement-id" />;
  if (!id.startsWith("WF-")) notFound();
  const { taskAction } = query;
  return (
    <PatientNowScreen
      key={`${id}:${taskAction ?? ""}`}
      movementId={id}
      documentTitle={MOVEMENT_TITLE}
      initialTaskAction={taskAction === "refer" || taskAction === "contact" ? taskAction : undefined}
    />
  );
}
