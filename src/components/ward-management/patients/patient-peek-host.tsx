"use client";

// Patient peek host (Josh's approval, 8 Nov 2026). Mounted once in the Ward Flow layout; a panel
// button calls `openPatientPeek(movementId)` and the person opens here, over the page, instead of
// on the Patient page. The sheet's code loads on first use, so no screen's first load grows.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { onPatientPeek } from "@/components/ward-management/shell/patient-peek-bus";

const PatientPeekSheet = dynamic(() => import("./patient-peek-sheet").then((m) => m.PatientPeekSheet), {
  loading: () => null,
});

export function PatientPeekHost() {
  const [movementId, setMovementId] = useState<string | null>(null);
  useEffect(() => onPatientPeek(({ movementId: id }) => setMovementId(id)), []);
  if (movementId === null) return null;
  return <PatientPeekSheet key={movementId} movementId={movementId} onClose={() => setMovementId(null)} />;
}
