"use client";

// Patient peek host (Josh's approval, 8 Nov 2026). Mounted once in the Ward Flow layout; a panel
// button calls `openPatientPeek(movementId)` and the person opens here, over the page, instead of
// on the Patient page. The sheet's code loads on first use, so no screen's first load grows.
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { withLoadRetry } from "@/components/ward-management/load-retry";
import { usePathname } from "next/navigation";
import { onPatientPeek } from "@/components/ward-management/shell/patient-peek-bus";

const PatientPeekSheet = dynamic(
  withLoadRetry(() => import("./patient-peek-sheet").then((m) => m.PatientPeekSheet)),
  {
    loading: () => null,
  },
);

export function PatientPeekHost() {
  const pathname = usePathname();
  // The peek belongs to the page it opened on: a route change (such as "Open full Patient page")
  // leaves it closed, so the new page never opens under a still-open sheet.
  const [peek, setPeek] = useState<{ movementId: string; path: string } | null>(null);
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => onPatientPeek(({ movementId }) => setPeek({ movementId, path: pathRef.current })), []);
  if (peek === null || peek.path !== pathname) return null;
  return <PatientPeekSheet key={peek.movementId} movementId={peek.movementId} onClose={() => setPeek(null)} />;
}
