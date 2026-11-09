"use client";

// Patient peek (Josh's approval, 8 Nov 2026; replaces D-77's page jump for Ask wards). The person's
// placement deck from the Patient page (destination, bed, legal, transport and Ask wards, with the
// same role rules) in a side panel on desktop and a bottom sheet on a phone. The full Patient page
// stays one link away. Only offered where the desk may open that movement (`useCanOpenHref`).
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { PhoneSheet, useIsPhone } from "@/components/wf";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { stageCopy } from "@/components/ward-management/ward-stage-copy";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { PatientTransitOperations } from "./patient-transit-operations";
import styles from "./patient-peek.module.css";

export function PatientPeekSheet({ movementId, onClose }: { movementId: string; onClose: () => void }) {
  const { movements, patients, referrals } = useWardFlowSelect("movements", "patients", "referrals");
  const isPhone = useIsPhone();
  const canOpen = useCanOpenHref();
  const movement = movements.find((candidate) => candidate.id === movementId);
  const href = movementHref(movementId);
  if (!movement || !canOpen(href)) return null;
  const subject = resolveSubjectPatient(movement, { patients, referrals, movements });
  return (
    <PhoneSheet
      open
      onClose={onClose}
      title={subject.formalName}
      description={`${subject.umrn} · ${stageCopy[movement.stage].label}`}
      closeLabel={`Close ${subject.formalName}`}
      height="tall"
      placement={isPhone ? "bottom" : "right"}
      data-testid="patient-peek"
    >
      <div data-ward-design="v6" className={styles.body}>
        <Link className={styles.pageLink} href={href} data-testid="patient-peek-full-page">
          Open full Patient page
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
        <PatientTransitOperations key={movement.id} movement={movement} bare />
      </div>
    </PhoneSheet>
  );
}
