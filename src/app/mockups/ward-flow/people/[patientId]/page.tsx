import type { Metadata } from "next";

import { WardMovementNotFound } from "@/components/ward-management/ward-management-console";
import { PersonScreen } from "@/components/ward-management/patients/person-screen";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { PATIENT_NOW_RECORDS } from "@/components/ward-management/patients/patient-now-records";
import type { PatientId } from "@/components/ward-management/ward-patients";

/**
 * `/people/[patientId]`, deliberately NOT `/patients/[patientId]`.
 *
 * That route existed and looked a `Movement` up by id — all seven of its inbound links passed a
 * movement id, several through a variable called `patient`, which is where the confusion lived.
 * Giving the person their own path cost nothing and left the misnaming visible rather than
 * half-corrected, while renaming the movement route was a separate, larger change; it has since
 * moved to `/mockups/ward-flow/movements/[movementId]`, so both screens now have names that match
 * what they show.
 */
export const metadata: Metadata = {
  // D-1 (owner, 2026-09-10): "But call this page Patient." The screen name is now "Patient";
  // `person-screen.tsx` sets the same string client-side, because this route is also reached by
  // client-side navigation that this static export cannot see. The route segment, the file and the
  // `PatientId` type stay named for the person — D-1 does not authorise renaming those.
  title: "Patient - Ward Flow",
  description: "Synthetic person record for the Ward Flow prototype.",
};

/**
 * A URL segment is always just text, so the shape is CHECKED before it is asserted.
 *
 * Both routes now name what the id actually is and point at the screen that holds it. The right
 * long-term shape is one place that owns id ownership and both routes call it, rather than two
 * routes each citing the other; recorded as owed rather than built here.
 */
export default async function WardPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ patientId: string }>;
  searchParams?: Promise<{ mode?: string; view?: string }>;
}) {
  const { patientId } = await params;
  const query = await searchParams;
  let id: string;
  try {
    id = decodeURIComponent(patientId);
  } catch {
    return <WardMovementNotFound requestedId={patientId} reason="not-a-person-id" />;
  }
  if (!id.startsWith("PT-") && !id.startsWith("WF-")) {
    return <WardMovementNotFound requestedId={id} reason="not-a-person-id" />;
  }
  // P1-1 (owner, 2026-09-17): `PatientNowScreen` only holds a rich synthetic story for the
  // handful of ids `PATIENT_NOW_RECORDS` actually lists (today WF-004 and WF-009), resolved
  // the SAME way the screen itself resolves `selectedId`. Any other id — including a real
  // PT-/WF- id this screen has no story for — falls through to the governed `PersonScreen`
  // rather than silently rendering WF-009's story under a URL that asked for someone else.
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
