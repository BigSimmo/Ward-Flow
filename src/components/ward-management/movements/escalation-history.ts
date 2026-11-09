// Item 28 (Josh, 9 Nov 2026, care plans and safety flags thread: defaults approved): every
// escalation on a movement, oldest first, with what happened next. D9-2 still holds: recording an
// escalation records it and marks screens, nothing else. "What happened next" is read from the
// movement's own records (an acceptance, a closure or a later escalation), never typed.
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import type { Instant } from "@/components/ward-management/ward-clock";
import type { EscalationRecord, Movement } from "@/components/ward-management/ward-model";

/** Every escalation on the movement, oldest first. A record saved before the list began has one. */
export function escalationRecords(movement: Pick<Movement, "escalation" | "escalations">): EscalationRecord[] {
  if (movement.escalations && movement.escalations.length > 0) return movement.escalations;
  return movement.escalation ? [{ ...movement.escalation }] : [];
}

export type EscalationNext =
  | { kind: "accepted"; at: Instant; unitId: string }
  | { kind: "arrived"; at: Instant }
  | { kind: "did_not_proceed"; at: Instant }
  | { kind: "escalated_again"; at: Instant }
  | { kind: "none" };

export type EscalationHistoryEntry = EscalationRecord & { next: EscalationNext };

/**
 * Each escalation with the first thing that followed it before the next escalation: a ward's
 * acceptance, the journey's closure, or the next escalation. `none` means nothing is recorded yet.
 */
export function escalationHistory(
  movement: Pick<Movement, "escalation" | "escalations" | "acceptedAt" | "acceptedUnitId" | "closure">,
): EscalationHistoryEntry[] {
  const records = escalationRecords(movement);
  return records.map((record, index) => {
    const following = records[index + 1];
    const until = following?.at ?? Number.POSITIVE_INFINITY;
    const candidates: Exclude<EscalationNext, { kind: "none" }>[] = [];
    if (
      movement.acceptedAt !== undefined &&
      movement.acceptedUnitId !== undefined &&
      movement.acceptedAt >= record.at &&
      movement.acceptedAt < until
    )
      candidates.push({ kind: "accepted", at: movement.acceptedAt, unitId: movement.acceptedUnitId });
    const closure = movement.closure;
    if (closure && closure.at >= record.at && closure.at < until)
      candidates.push({ kind: closure.outcome === "arrived" ? "arrived" : "did_not_proceed", at: closure.at });
    if (following) candidates.push({ kind: "escalated_again", at: following.at });
    const next: EscalationNext = candidates.sort((a, b) => a.at - b.at)[0] ?? { kind: "none" };
    return { ...record, next };
  });
}

/** The raising role in words; an escalation carried over from an older save has none recorded. */
export function escalationByLabel(record: Pick<EscalationRecord, "by">): string {
  return record.by ? WARD_FLOW_ROLE_LABELS[record.by] : "Role not recorded";
}

/** What happened next, in words. `unitName` resolves a ward the desk can see. */
export function escalationNextLabel(
  next: EscalationNext,
  unitName: (unitId: string) => string,
  when: (at: Instant) => string,
): string {
  switch (next.kind) {
    case "accepted":
      return `Accepted by ${unitName(next.unitId)}, ${when(next.at)}`;
    case "arrived":
      return `Arrived, ${when(next.at)}`;
    case "did_not_proceed":
      return `Withdrawn, did not proceed, ${when(next.at)}`;
    case "escalated_again":
      return `Escalated again, ${when(next.at)}`;
    case "none":
      return "No answer recorded yet";
  }
}
