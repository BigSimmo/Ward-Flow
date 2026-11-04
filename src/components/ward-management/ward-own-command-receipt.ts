import type { WardCommandMetadata } from "./ward-command-metadata";
import { UNDO_STEP_TYPES } from "./ward-undo";
import type { SharedActivityAuditEvent } from "./ward-shared-client";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Audit details and other actors' identities do not enter the Activity view. */
export function activityAuditEvents(events: SharedActivityAuditEvent[]): SharedActivityAuditEvent[] {
  return events.slice(0, 200).map((row) => ({
    sequence: row.sequence,
    action: row.action,
    outcome: row.outcome,
    committed_at: row.committed_at,
    ...(typeof row.ownCommandId === "string" && UUID.test(row.ownCommandId) ? { ownCommandId: row.ownCommandId } : {}),
  }));
}

export type OwnCommandReceipt = WardCommandMetadata & {
  outcome: "accepted" | "partly" | "refused";
  commandRevision: number;
};

/** Reduce a private receipt to its bounded public contract, never retaining unknown fields. */
export function ownCommandReceipt(value: unknown): OwnCommandReceipt | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") throw new Error("The change could not be checked");
  const raw = value as Record<string, unknown>;
  if (
    !["accepted", "partly", "refused"].includes(String(raw.outcome)) ||
    !Number.isSafeInteger(raw.commandRevision) ||
    Number(raw.commandRevision) < 1
  )
    throw new Error("The change could not be checked");
  const result: OwnCommandReceipt = {
    outcome: raw.outcome as OwnCommandReceipt["outcome"],
    commandRevision: Number(raw.commandRevision),
  };
  const step = raw.undoStep as Record<string, unknown> | undefined;
  if (
    result.outcome !== "refused" &&
    step &&
    typeof step === "object" &&
    [...UNDO_STEP_TYPES, "UNDO_REFERRAL_DECISION", "UNDO_PLACE_IN_BED"].includes(String(step.undoType)) &&
    typeof step.subjectId === "string" &&
    step.subjectId.length > 0 &&
    step.subjectId.length <= 256 &&
    Number.isSafeInteger(step.seq) &&
    Number(step.seq) >= 1
  )
    result.undoStep = {
      undoType: step.undoType as NonNullable<WardCommandMetadata["undoStep"]>["undoType"],
      subjectId: step.subjectId,
      seq: Number(step.seq),
    };
  return result;
}
