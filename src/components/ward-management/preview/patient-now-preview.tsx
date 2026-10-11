"use client";

import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";

import { MockupPreviewBar } from "./preview-bar";
import type { MockupOption } from "./preview-option";

const HREF = "/mockups/ward-flow/preview/patient";

/**
 * Topic 1 of the device audit mockups: the Patient page Now tab, on the real screen and its shared
 * state. Only the Now tab changes between options; the hero and the other tabs stay as they are.
 */
export function PatientNowPreview({ option, patientId }: { option: MockupOption; patientId: string }) {
  return (
    <>
      <MockupPreviewBar
        topic="Patient Now"
        option={option}
        hrefFor={(next) => `${HREF}?option=${next}&patient=${encodeURIComponent(patientId)}`}
      />
      <PatientNowScreen
        patientId={patientId.startsWith("PT-") ? patientId : undefined}
        movementId={patientId.startsWith("WF-") ? patientId : undefined}
        nowLayout={option}
      />
    </>
  );
}
