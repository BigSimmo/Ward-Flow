import { UserX } from "lucide-react";

import type { Admission } from "@/components/ward-management/ward-admissions";
import { formatInstant, type Instant } from "@/components/ward-management/ward-clock";
import type { InboxItem } from "@/components/ward-management/ward-derivations";
import { INBOX_CATEGORIES } from "@/components/ward-management/ward-inbox-reducer";
import type { LeaveBed, Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { isOnOrder, stayLegalStatus } from "@/components/ward-management/ward-stay-legal";
import type { Patient } from "@/components/ward-management/ward-patients";
import { patientHref } from "@/components/ward-management/shell/ward-facade";

/**
 * ABSENT WITHOUT LEAVE ON AN ORDER IS ACT NOW (audit A3-1, 13 Oct 2026).
 *
 * Marking an involuntary patient absent used to raise nothing outside their own Patient page. This
 * derives one red task per absence from the record itself (`LeaveBed.absentWithoutLeave`), so Home
 * exceptions, Alerts, the Tasks badge and the phone push all read it through `taskItems`. It leaves
 * the list when the return is recorded (`END_LEAVE_BED`), like every other fact row. A voluntary
 * patient's absence is not added: only genuinely act-now things go in Act now.
 */
export type AbsenceTaskSource = {
  leaveBeds?: readonly LeaveBed[];
  admissions?: readonly Admission[];
  movements?: readonly Movement[];
  patients?: readonly Patient[];
  referrals?: readonly Referral[];
  units?: readonly Pick<Unit, "id" | "name">[];
};

/** The absent stays whose person is on an order, newest absence first. */
export function absentOnOrder(source: AbsenceTaskSource): {
  leaveBed: LeaveBed & { absentWithoutLeave: NonNullable<LeaveBed["absentWithoutLeave"]> };
  admission: Admission;
}[] {
  const rows = [];
  for (const leaveBed of source.leaveBeds ?? []) {
    const absence = leaveBed.absentWithoutLeave;
    if (!absence) continue;
    const admission = source.admissions?.find((stay) => stay.id === leaveBed.admissionId);
    if (!admission || admission.state === "departed") continue;
    if (!isOnOrder(stayLegalStatus(admission, source))) continue;
    rows.push({ leaveBed: { ...leaveBed, absentWithoutLeave: absence }, admission });
  }
  return rows.sort((a, b) => b.leaveBed.absentWithoutLeave.since - a.leaveBed.absentWithoutLeave.since);
}

export function absenceInboxItems(source: AbsenceTaskSource, now: Instant): InboxItem[] {
  void now;
  return absentOnOrder(source).map(({ leaveBed, admission }) => {
    const ward = source.units?.find((unit) => unit.id === leaveBed.unitId)?.name ?? "the ward";
    const patient = resolveSubjectPatient(admission, source).patient;
    return {
      id: `${INBOX_CATEGORIES.absent_without_leave.idPrefix}${admission.id}`,
      tone: "danger",
      icon: UserX,
      title: "Absent without leave on an order",
      detail: `Missing from ${ward} since ${formatInstant(leaveBed.absentWithoutLeave.since)}, order stays in force`,
      owner: "Nurse in charge",
      movementId: admission.movementId ?? "",
      ...(patient ? { href: patientHref(patient.id) } : {}),
      kind: "fact",
      since: leaveBed.absentWithoutLeave.since,
    };
  });
}
