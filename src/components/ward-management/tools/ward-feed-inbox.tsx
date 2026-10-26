"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Inbox } from "lucide-react";

import { Select } from "@/components/wf";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "../ward-admissions";
import { wardRouteUnitId, type WardChromeRole } from "../ward-chrome-role";
import { EVENT_ROLE } from "../ward-flow-event-roles";
import { useWardFlowClock, useWardFlowSelect } from "../ward-flow-provider";
import { createPatientResolver, patientIdentityLine } from "../ward-patient-resolver";
import { useUndoableStep } from "../use-undoable-step";
import { useWardRaise } from "../ward-flow-raise";
import { useRouteRole } from "../ward-role-gate";
import type { WardCommandOutcome } from "../ward-shared-client";
import { feedSuggestion, simulatedFeedMessages, type FeedSuggestion } from "../integration/hospital-feed-sim";
import { previewFeedMessage, type FeedMessage } from "../integration/hospital-feed";
import {
  receiveFeedMessage,
  settleFeedItem,
  startFeedScript,
  syncFeedInboxGeneration,
  useFeedInbox,
  type FeedItem,
} from "./ward-feed-inbox-store";
import styles from "./ward-tools-sheet.module.css";
import inboxStyles from "./ward-feed-inbox.module.css";

const EVENT_LABELS: Record<FeedMessage["event"], string> = {
  admitted: "Admission",
  transferred: "Transfer",
  discharged: "Discharge",
  registered: "Registration",
};

const STATUS_LABELS: Record<FeedItem["status"], string> = {
  waiting: "Waiting for a person",
  confirmed: "Confirmed",
  rejected: "Rejected, nothing changed",
  refused: "Refused",
};

/**
 * The synthetic hospital feed inbox (fix plan item 5, 21 Oct 2026), in Tools beside Demo. Each tap
 * of Receive brings in the next invented message. A person confirms or rejects each one; confirming
 * raises the same event the ward's own Confirm arrival or Record departure raises, as this desk, so
 * the engine's usual role and ward checks apply. Nothing is confirmed without a person.
 */
export function WardFeedInbox() {
  const { movements, admissions, patients, units, worldGeneration, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "admissions",
    "patients",
    "units",
    "worldGeneration",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const inbox = useFeedInbox();
  const role = useRouteRole();
  const raise = useWardRaise(role);
  // Audit CS3-06: a confirmed message offers Undo, like the ward's own Confirm arrival and Has left.
  const { offer: offerUndo } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  const routeUnitId = wardRouteUnitId(usePathname() ?? "");
  const [status, setStatus] = useState("");
  // Messages whose confirmation is still saving. A shared save is async, so Confirm and Reject wait
  // for it: a second tap or a reject in the gap would raise the event twice or settle it wrongly.
  const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set());
  const setItemPending = (seq: number, on: boolean) =>
    setPending((current) => {
      const next = new Set(current);
      if (on) next.add(seq);
      else next.delete(seq);
      return next;
    });

  useEffect(() => syncFeedInboxGeneration(worldGeneration), [worldGeneration]);

  // The simulated messages follow the world as it was when the inbox started, so later changes do
  // not reshuffle what is still to come. The store holds them, so they outlive this row closing.
  const messages =
    inbox.generation === worldGeneration && inbox.script
      ? inbox.script
      : simulatedFeedMessages({ movements, admissions, patients });
  const received = inbox.generation === worldGeneration ? inbox.received : 0;
  const next = messages[received];

  function receive() {
    if (!next) return;
    startFeedScript(messages);
    const item = receiveFeedMessage(next);
    setStatus(
      item.status === "refused"
        ? `Message ${item.seq} refused. ${item.note ?? ""}`.trim()
        : `Message ${item.seq} received. It waits for a person.`,
    );
  }

  const unitName = (id: string) => units.find((unit) => unit.id === id)?.name ?? "this ward";
  // Audit CS3-06: who a message would change, by name, record number and bed, never the number alone.
  const resolvePerson = createPatientResolver({ patients, movements });
  const personOf = (suggestion: Confirmable): FeedPerson | undefined => {
    const subject =
      suggestion.kind === "arrival"
        ? movements.find((movement) => movement.id === suggestion.movementId)
        : admissions.find((admission) => admission.id === suggestion.admissionId);
    if (!subject) return undefined;
    const resolved = resolvePerson(subject);
    if (!resolved.patient) return undefined;
    const bed = "bedNumber" in subject ? subject.bedNumber : undefined;
    return {
      who: resolved.displayName,
      line: `${patientIdentityLine(resolved)}${bed === undefined ? "" : ` · Bed ${bed}`}`,
    };
  };
  const items = inbox.generation === worldGeneration ? [...inbox.items].reverse() : [];

  return (
    <div className={styles.toolBody} data-testid="ward-feed-inbox">
      <p className={styles.note}>
        Invented messages only. Nothing is connected to a hospital system. Matched by record number only.
      </p>
      <div className={styles.demoRow}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={receive}
          disabled={!next}
          data-testid="ward-feed-receive"
        >
          <Inbox aria-hidden="true" strokeWidth={1.75} />
          {next ? "Receive next message" : "No more messages"}
        </button>
      </div>
      <p className={styles.liveNote} role="status">
        {status}
      </p>
      {items.length ? (
        <ol className={inboxStyles.list} aria-label="Messages received">
          {items.map((item) => (
            <FeedRow
              key={item.seq}
              item={item}
              suggestion={item.message ? feedSuggestion(item.message, { movements, admissions, patients }) : undefined}
              personOf={personOf}
              differences={item.message ? differencesFrom(item.message, patients) : []}
              unitName={unitName}
              blockedReason={(suggestion) => confirmBlockedReason(suggestion, role, routeUnitId, unitName)}
              pending={pending.has(item.seq)}
              onConfirm={(suggestion, leaving) => {
                if (pending.has(item.seq)) return;
                setItemPending(item.seq, true);
                const outcome =
                  suggestion.kind === "arrival"
                    ? raise("PATIENT_ARRIVED", {
                        movementId: suggestion.movementId,
                        actingUnitId: suggestion.unitId,
                      })
                    : raise("RECORD_LEAVING", {
                        admissionId: suggestion.admissionId,
                        actingUnitId: suggestion.unitId,
                        leavingDestination: leaving!,
                      });
                const who = personOf(suggestion)?.who ?? "this person";
                const done =
                  suggestion.kind === "arrival"
                    ? `Arrival confirmed: ${who} on ${unitName(suggestion.unitId)}.`
                    : `Departure recorded: ${who} from ${unitName(suggestion.unitId)}.`;
                offerUndo(
                  {
                    success: done,
                    undo: (at) =>
                      suggestion.kind === "arrival"
                        ? {
                            type: "UNDO_TRANSPORT_STEP",
                            role,
                            now: at,
                            movementId: suggestion.movementId,
                            actingUnitId: suggestion.unitId,
                          }
                        : {
                            type: "UNDO_DEPARTURE",
                            role,
                            now: at,
                            admissionId: suggestion.admissionId,
                            actingUnitId: suggestion.unitId,
                          },
                    undone: `Undone: ${who} is back as before.`,
                    refusalShownInline: true,
                  },
                  { completion: outcome },
                );
                void Promise.resolve(outcome).then(
                  (result: WardCommandOutcome | void) => {
                    setItemPending(item.seq, false);
                    if (result && result.status !== "accepted") {
                      setStatus(
                        `Not recorded: ${result.message ?? "the action was refused"}. The message still waits.`,
                      );
                      return;
                    }
                    settleFeedItem(item.seq, "confirmed", done);
                    setStatus(`Message ${item.seq}: ${done}`);
                  },
                  () => {
                    setItemPending(item.seq, false);
                    setStatus("Not confirmed. Check the board before trying again.");
                  },
                );
              }}
              onReject={() => {
                if (pending.has(item.seq)) return;
                settleFeedItem(item.seq, "rejected");
                setStatus(`Message ${item.seq} rejected. Nothing changed.`);
              }}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

type Confirmable = Exclude<FeedSuggestion, { kind: "none" }>;
type FeedPerson = { who: string; line: string };

/**
 * Why this desk cannot confirm a message, or null. The same role and ward checks the engine makes,
 * asked first so a control is never offered only to be refused.
 */
function confirmBlockedReason(
  suggestion: Confirmable,
  role: WardChromeRole,
  routeUnitId: string | undefined,
  unitName: (id: string) => string,
): string | null {
  const type = suggestion.kind === "arrival" ? "PATIENT_ARRIVED" : "RECORD_LEAVING";
  if (!(EVENT_ROLE[type] as readonly string[]).includes(role)) {
    return "This desk cannot record this. Open Tools from the ward or the coordinator desk.";
  }
  if (role === "ward" && routeUnitId !== suggestion.unitId) {
    return `This message is for ${unitName(suggestion.unitId)}. Open that ward to confirm it.`;
  }
  return null;
}

/** Where a known person's name or date of birth in the message differs from the record. */
function differencesFrom(message: FeedMessage, patients: Parameters<typeof previewFeedMessage>[1]) {
  const preview = previewFeedMessage(message, patients);
  return preview.kind === "known_person" ? preview.differences : [];
}

function FeedRow({
  item,
  suggestion,
  personOf,
  differences,
  unitName,
  blockedReason,
  pending,
  onConfirm,
  onReject,
}: {
  item: FeedItem;
  suggestion: FeedSuggestion | undefined;
  personOf: (suggestion: Confirmable) => FeedPerson | undefined;
  differences: readonly string[];
  unitName: (id: string) => string;
  blockedReason: (suggestion: Confirmable) => string | null;
  pending: boolean;
  onConfirm: (suggestion: Confirmable, leaving?: LeavingDestination) => void;
  onReject: () => void;
}) {
  const [leaving, setLeaving] = useState<LeavingDestination | "">("");
  const message = item.message;
  const waiting = item.status === "waiting";
  const blocked = suggestion && suggestion.kind !== "none" ? blockedReason(suggestion) : null;
  const blockedId = `ward-feed-blocked-${item.seq}`;
  const noteId = `ward-feed-note-${item.seq}`;
  const pendingId = `ward-feed-pending-${item.seq}`;
  const unavailable = pending || !!blocked || (suggestion?.kind === "departure" && !leaving);
  return (
    <li className={inboxStyles.item} data-status={item.status} data-testid={`ward-feed-item-${item.seq}`}>
      <div className={inboxStyles.head}>
        <strong>{message ? `${EVENT_LABELS[message.event]} · ${message.umrn}` : "Unreadable message"}</strong>
        <span className={inboxStyles.status}>{STATUS_LABELS[item.status]}</span>
      </div>
      {item.note ? <p className={styles.note}>{item.note}</p> : null}
      {waiting && suggestion ? (
        // A near-miss name or date of birth is the classic wrong-patient error, so it confirms nothing.
        suggestion.kind === "none" || differences.length ? (
          <>
            <p className={styles.note}>
              {suggestion.kind === "none"
                ? suggestion.reason
                : `${differences.join(". ")}. Check the person in the hospital system. Nothing to confirm here.`}
            </p>
            <div className={styles.demoRow}>
              <button type="button" className={styles.secondaryButton} onClick={onReject}>
                Dismiss
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.note} id={noteId}>
              {(() => {
                const person = personOf(suggestion)?.line;
                const of = person ? ` of ${person}` : "";
                return suggestion.kind === "arrival"
                  ? `Confirms the arrival${of} on ${unitName(suggestion.unitId)}.`
                  : `Records the departure${of} from ${unitName(suggestion.unitId)}. Choose where the person went.`;
              })()}
            </p>
            {blocked ? (
              <p className={styles.note} id={blockedId} data-testid={blockedId}>
                {blocked}
              </p>
            ) : null}
            {pending ? (
              <p className={styles.note} id={pendingId} data-testid={pendingId}>
                Saving this confirmation.
              </p>
            ) : null}
            {suggestion.kind === "departure" && !blocked ? (
              <Select
                aria-label="Where the person went"
                value={leaving}
                onChange={(event) => setLeaving(event.target.value as LeavingDestination | "")}
                data-testid={`ward-feed-leaving-${item.seq}`}
              >
                <option value="">Choose where they went</option>
                {LEAVING_DESTINATIONS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <div className={styles.demoRow}>
              <button
                type="button"
                className={`${styles.primaryButton} ${inboxStyles.confirm}`}
                aria-disabled={unavailable || undefined}
                aria-describedby={pending ? pendingId : blocked ? blockedId : unavailable ? noteId : undefined}
                onClick={() => {
                  if (!unavailable) onConfirm(suggestion, leaving || undefined);
                }}
                data-testid={`ward-feed-confirm-${item.seq}`}
              >
                {suggestion.kind === "arrival" ? "Confirm arrival" : "Record departure"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                aria-disabled={pending || undefined}
                aria-describedby={pending ? pendingId : undefined}
                onClick={() => {
                  if (!pending) onReject();
                }}
                data-testid={`ward-feed-reject-${item.seq}`}
              >
                Reject
              </button>
            </div>
          </>
        )
      ) : null}
    </li>
  );
}
