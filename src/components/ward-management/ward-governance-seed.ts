import type { AuditActor, AuditEvent } from "./ward-audit";
import { OVERRIDE_REASONS } from "./ward-change-reasons";
import type { WardFlowRole } from "./ward-flow-roles";
import type { WardFlowState } from "./ward-flow-reducer";

/**
 * **SYNTHETIC GOVERNANCE ENTRIES — v10 pass 2 (Josh, 10 Oct 2026).** The Governance page opened
 * empty on a fresh seed, because the audit log only ever holds what this session captured. These are
 * six clearly synthetic entries, timed earlier on the demonstration night (before capture started),
 * so the page has something to review from the first visit.
 *
 * ⚠️ **Derived, never stored.** They are computed from the seeded world each time they are read
 * (`governanceAuditEvents`, `ward-audit.ts`): never written to `auditEvents`, so the captured log,
 * its sequence numbers and every test pinned to a fresh, empty log are unchanged, and a reset brings
 * them back. Each carries `origin: "synthetic-seed"`, `sequence: 0` and an `audit-seed-N` id, so no
 * screen can mistake one for something captured this session. A review of one is an ordinary
 * `REVIEW_AUDIT_EVENT`, stored like any other.
 *
 * Subjects carry no patient link (`patientId: null`): D-14 keeps that link to its allowlisted
 * readers, and a synthetic entry has no reason to join a record to a person.
 *
 * Subjects are the first seeded records of each kind, so the same world always yields the same six
 * entries; an entry whose subject the scenario lacks is left out rather than invented.
 */
export function syntheticGovernanceAuditEvents(state: WardFlowState): AuditEvent[] {
  const start = state.auditCaptureStartedAt;
  if (typeof start !== "number" || !Number.isFinite(start)) return [];
  const [unitA, unitB] = state.units;
  const movements = state.movements.slice(0, 3);
  const referral = state.referrals[0];
  const admission = state.admissions[0];
  const actor = (role: WardFlowRole, unitId?: string): AuditActor => ({
    role,
    actingUnitId: role === "ward" && unitId ? unitId : null,
    attribution: "declared-prototype-role",
  });
  const movementSubject = (index: number) => {
    const movement = movements[index];
    return movement ? { kind: "movement" as const, movementId: movement.id, patientId: null } : undefined;
  };
  const entries: (AuditEvent | undefined)[] = [];
  const base = (id: string, minutesBefore: number, role: WardFlowRole, unitId?: string) => ({
    id,
    sequence: 0,
    generation: state.worldGeneration,
    at: start - minutesBefore,
    actor: actor(role, unitId),
    origin: "synthetic-seed" as const,
  });

  if (referral && unitA)
    entries.push({
      ...base("audit-seed-referral-override", 190, "coordinator"),
      subject: { kind: "referral", referralId: referral.id, patientId: null },
      outcome: "accepted",
      reasonCode: "none",
      category: "override",
      action: "ACCEPT_REFERRAL",
      details: {
        reason: OVERRIDE_REASONS[1],
        overrideFactRecorded: true,
        targets: [{ unitId: unitA.id, outcome: "accepted", reasonCode: "none" }],
      },
    });
  const legalSubject = movementSubject(0);
  if (legalSubject && unitA)
    entries.push({
      ...base("audit-seed-legal-status", 160, "ward", unitA.id),
      subject: legalSubject,
      outcome: "accepted",
      reasonCode: "none",
      category: "legal-status",
      action: "CHANGE_LEGAL_STATUS",
      details: {
        before: "Referred for psychiatric examination",
        requested: "Involuntary inpatient",
        after: "Involuntary inpatient",
      },
    });
  const refusedSubject = movementSubject(1);
  if (refusedSubject && unitB)
    entries.push({
      ...base("audit-seed-pull-patient", 120, "ward", unitB.id),
      subject: refusedSubject,
      outcome: "denied",
      reasonCode: "scope",
      category: "override",
      action: "PULL_PATIENT",
      details: {
        reason: null,
        overrideFactRecorded: false,
        targets: [{ unitId: unitB.id, outcome: "denied", reasonCode: "scope" }],
      },
    });
  if (admission)
    entries.push({
      ...base("audit-seed-admission-access", 95, "coordinator"),
      subject: {
        kind: "admission",
        admissionId: admission.id,
        unitId: admission.unitId,
        patientId: null,
      },
      outcome: "accepted",
      reasonCode: "none",
      category: "record-access",
      action: "OPEN_DISCHARGE_RECORD",
      details: { requestId: null },
    });
  const referSubject = movementSubject(2);
  if (referSubject && unitA && unitB)
    entries.push({
      ...base("audit-seed-refer-to-units", 70, "coordinator"),
      subject: referSubject,
      outcome: "accepted",
      reasonCode: "none",
      category: "override",
      action: "REFER_TO_UNITS",
      details: {
        reason: OVERRIDE_REASONS[0],
        overrideFactRecorded: true,
        targets: [
          { unitId: unitA.id, outcome: "accepted", reasonCode: "none" },
          { unitId: unitB.id, outcome: "accepted", reasonCode: "none" },
        ],
      },
    });
  if (legalSubject)
    entries.push({
      ...base("audit-seed-legal-status-stale", 40, "coordinator"),
      subject: legalSubject,
      outcome: "stale",
      reasonCode: "revision",
      category: "legal-status",
      action: "CHANGE_LEGAL_STATUS",
      details: { before: "Involuntary inpatient", requested: "Voluntary", after: "Involuntary inpatient" },
    });
  return entries.filter((entry): entry is AuditEvent => entry !== undefined);
}
