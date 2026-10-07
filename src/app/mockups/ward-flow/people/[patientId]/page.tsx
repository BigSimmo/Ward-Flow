import type { Metadata } from "next";

import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import type { PatientId } from "@/components/ward-management/ward-patients";
import { safeDecodeURIComponent } from "@/lib/safe-url";

/** Person and movement IDs share Patient Now; the governed dossier remains available by query. */
export const metadata: Metadata = {
  // D-1 (owner, 2026-09-10): "But call this page Patient." The screen name is now "Patient";
  // `person-screen.tsx` sets the same string client-side, because this route is also reached by
  // client-side navigation that this static export cannot see. The route segment, the file and the
  // `PatientId` type stay named for the person — D-1 does not authorise renaming those.
  title: "Patient - Ward Flow",
  description: "Unified synthetic patient dossier and transit operations for Ward Flow.",
};

export default async function WardPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams?: Promise<{ mode?: string; view?: string }>;
}) {
  const { patientId } = await params;
  const query = await searchParams;
  const id = safeDecodeURIComponent(patientId);
  if (!id.startsWith("PT-") && !id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id || patientId} reason="not-a-person-id" />;
  }
  if (query?.view === "governed" || query?.view === "legacy") {
    return <PersonScreen patientId={id as PatientId} />;
  }
  return (
    <PatientNowScreen
      patientId={id.startsWith("PT-") ? id : undefined}
      movementId={id.startsWith("WF-") ? id : undefined}
    />
  );
}
