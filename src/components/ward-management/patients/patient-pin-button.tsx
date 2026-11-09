"use client";

import { Pin, PinOff } from "lucide-react";

import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  isPinnablePatientId,
  MY_PATIENTS_LIMIT,
  toggleMyPatient,
  useMyPatients,
} from "@/components/ward-management/shell/ward-my-patients-store";
import { Button } from "@/components/wf";

/**
 * Pin / Unpin on the patient page header (feature 31, 9 Nov 2026). A pinned patient is listed at the top of
 * Home, in the Pinned card. Stores the record id only, on this device.
 */
export function PatientPinButton({
  patientId,
  name,
  className,
  size = "sm",
}: {
  patientId: string | undefined;
  name: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const pinned = useMyPatients();
  if (!patientId || !isPinnablePatientId(patientId)) return null;
  const isPinned = pinned.includes(patientId);
  return (
    <Button
      variant="onHero"
      size={size}
      icon={isPinned ? PinOff : Pin}
      className={className}
      title={
        isPinned
          ? "Remove from Pinned on Home"
          : pinned.length >= MY_PATIENTS_LIMIT
            ? `Pinned holds ${MY_PATIENTS_LIMIT}. Unpin one first.`
            : "Pin to Home"
      }
      onClick={() => {
        const outcome = toggleMyPatient(patientId);
        if (outcome === "pinned") announceToWardShell(`${name} pinned to Home.`);
        else if (outcome === "unpinned") announceToWardShell(`${name} unpinned from Home.`);
        else if (outcome === "full")
          announceToWardShell(`Pinned holds ${MY_PATIENTS_LIMIT} patients. Unpin one first.`);
      }}
      data-testid="ward-patient-pin"
    >
      {isPinned ? "Unpin" : "Pin"}
    </Button>
  );
}
