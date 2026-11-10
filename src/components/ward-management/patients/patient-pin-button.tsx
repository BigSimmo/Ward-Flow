"use client";

import { Pin, PinOff } from "lucide-react";

import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  isPinnablePatientId,
  MY_PATIENTS_LIMIT,
  toggleMyPatient,
  useMyPatients,
} from "@/components/ward-management/shell/ward-my-patients-store";
import { Button, type HeroChipItem } from "@/components/wf";

function pinTitle(isPinned: boolean, count: number): string {
  if (isPinned) return "Remove from Pinned on Home";
  return count >= MY_PATIENTS_LIMIT ? `Pinned holds ${MY_PATIENTS_LIMIT}. Unpin one first.` : "Pin to Home";
}

function togglePin(patientId: string, name: string) {
  const outcome = toggleMyPatient(patientId);
  if (outcome === "pinned") announceToWardShell(`${name} pinned to Home.`);
  else if (outcome === "unpinned") announceToWardShell(`${name} unpinned from Home.`);
  else if (outcome === "full") announceToWardShell(`Pinned holds ${MY_PATIENTS_LIMIT} patients. Unpin one first.`);
}

/**
 * Pin / Unpin as a quick chip in the patient page top (feature 31; page tops, 9 Nov 2026), or null
 * when the record cannot be pinned.
 */
export function usePatientPinChip(patientId: string | undefined, name: string): HeroChipItem | null {
  const pinned = useMyPatients();
  if (!patientId || !isPinnablePatientId(patientId)) return null;
  const isPinned = pinned.includes(patientId);
  const Glyph = isPinned ? PinOff : Pin;
  return {
    id: "pin",
    label: isPinned ? "Unpin" : "Pin",
    icon: <Glyph strokeWidth={1.75} aria-hidden="true" />,
    ariaLabel: isPinned ? "Unpin from Home" : "Pin to Home",
    onClick: () => togglePin(patientId, name),
    testId: "ward-patient-pin",
  };
}

/**
 * Pin / Unpin on the patient page header (feature 31, 9 Nov 2026). A pinned patient is listed at the top of
 * Home, in the Pinned card. Stores the record id only, on this device.
 */
export function PatientPinButton({ patientId, name }: { patientId: string | undefined; name: string }) {
  const pinned = useMyPatients();
  if (!patientId || !isPinnablePatientId(patientId)) return null;
  const isPinned = pinned.includes(patientId);
  return (
    <Button
      variant="onHero"
      size="sm"
      icon={isPinned ? PinOff : Pin}
      title={pinTitle(isPinned, pinned.length)}
      onClick={() => togglePin(patientId, name)}
      data-testid="ward-patient-pin"
    >
      {isPinned ? "Unpin" : "Pin"}
    </Button>
  );
}
