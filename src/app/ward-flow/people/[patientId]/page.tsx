import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { WardMovementNotFound } from "@/components/ward-management/ward-movement-not-found";
import { UMRN_IN_ADDRESS } from "@/components/ward-management/ward-patients";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { decodeRecordAddress, querySuffix } from "@/components/ward-management/shell/ward-record-address";

/**
 * Person and movement IDs share Patient Now. The older governed dossier (`?view=governed`) was
 * retired on 21 Oct 2026 (Josh), so there is one patient record; an old `?view=` is ignored.
 */
export const metadata: Metadata = {
  // D-1 (owner, 2026-09-10): "But call this page Patient." The screen name is now "Patient";
  // Patient Now sets the same string client-side, because this route is also reached by
  // client-side navigation that this static export cannot see. The route segment, the file and the
  // `PatientId` type stay named for the person — D-1 does not authorise renaming those.
  title: "Patient — Ward Flow",
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
  let segment: string;
  try {
    segment = decodeURIComponent(patientId);
  } catch {
    return <WardMovementNotFound requestedId={patientId} reason="not-a-person-id" />;
  }
  // D-39 (15 Oct 2026): the address carries a code, never a person or journey number. The code is
  // read first. An old link with the raw id still works: it is sent on to the coded address.
  const decoded = decodeRecordAddress(segment);
  if (decoded === null && (segment.startsWith("PT-") || segment.startsWith("WF-"))) {
    redirect(`${patientHref(segment)}${querySuffix(query)}`);
  }
  const id = decoded ?? segment;
  // D-39: patient links never go by UMRN, so a UMRN in the address is not resolved. It gets the
  // plain not-found, which quotes nothing back (the UMRN is not passed on).
  if (UMRN_IN_ADDRESS.test(id)) return <WardMovementNotFound requestedId="" reason="not-a-person-id" />;
  if (!id.startsWith("PT-") && !id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-person-id" />;
  }
  return (
    <PatientNowScreen
      patientId={id.startsWith("PT-") ? id : undefined}
      movementId={id.startsWith("WF-") ? id : undefined}
    />
  );
}
