"use client";

import { decodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { PatientRedesign } from "./patient-redesign";
import styles from "./patient-redesign.module.css";

/** The sample record the viewer shows: the coded address `/ward-flow/people/196zcp24w5t0`. */
const SAMPLE_ADDRESS = "196zcp24w5t0";

/** The redesigned patient record, resolved from its coded address the same way the route does. */
export function PatientPage() {
  const id = decodeRecordAddress(SAMPLE_ADDRESS) ?? SAMPLE_ADDRESS;
  return (
    <div className={styles.scope}>
      <PatientRedesign
        patientId={id.startsWith("PT-") ? id : undefined}
        movementId={id.startsWith("WF-") ? id : undefined}
      />
    </div>
  );
}
