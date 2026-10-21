"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Inbox } from "lucide-react";

import { Select } from "@/components/wf";
import { LEAVING_DESTINATIONS, type LeavingDestination } from "../ward-admissions";
import { wardRouteUnitId, type WardChromeRole } from "../ward-chrome-role";
import { EVENT_ROLE } from "../ward-flow-event-roles";
import { useWardFlowSelect } from "../ward-flow-provider";
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
  const { movements, admissions, patients, units, worldGeneration } = useWardFlowSelect(
    "movements",
    "admissions",
    "patients",
    "units",
    "worldGeneration",
  );
  const inbox = useFeedInbox();
  const role = useRouteRole();
  const raise = useWardRaise(role);
  const routeUnitId = wardRouteUnitId(usePathname() ?? "");
  const [status, setStatus] = useState("");

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
              differences={item.message ? differencesFrom(item.message, patients) : []}
              unitName={unitName}
              blockedReason={(suggestion) => confirmBlockedReason(suggestion, role, routeUnitId, unitName)}
              onConfirm={(suggestion, leaving) => {
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
                const done =
                  suggestion.kind === "arrival"
                    ? `Arrival confirmed on ${unitName(suggestion.unitId)}.`
                    : `Departure recorded from ${unitName(suggestion.unitId)}.`;
                void Promise.resolve(outcome).then(
                  (result: WardCommandOutcome | void) => {
                    if (result && result.status !== "accepted") {
                      setStatus(
                        `Not recorded: ${result.message ?? "the action was refused"}. The message still waits.`,
                      );
                      return;
                    }
                    settleFeedItem(item.seq, "confirmed", done);
                    setStatus(`Message ${item.seq}: ${done}`);
                  },
                  () => setStatus("Not confirmed. Check the board before trying again."),
                );
              }}
              onReject={() => {
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
  differences,
  unitName,
  blockedReason,
  onConfirm,
  onReject,
}: {
  item: FeedItem;
  suggestion: FeedSuggestion | undefined;
  differences: readonly string[];
  unitName: (id: string) => string;
  blockedReason: (suggestion: Confirmable) => string | null;
  onConfirm: (suggestion: Confirmable, leaving?: LeavingDestination) => void;
  onReject: () => void;
}) {
  const [leaving, setLeaving] = useState<LeavingDestination | "">("");
  const message = item.message;
  const waiting = item.status === "waiting";
  const blocked = suggestion && suggestion.kind !== "none" ? blockedReason(suggestion) : null;
  const blockedId = `ward-feed-blocked-${item.seq}`;
  const unavailable = !!blocked || (suggestion?.kind === "departure" && !leaving);
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
            <p className={styles.note}>
              {suggestion.kind === "arrival"
                ? `Confirms the arrival on ${unitName(suggestion.unitId)}.`
                : `Records the departure from ${unitName(suggestion.unitId)}. Choose where the person went.`}
            </p>
            {blocked ? (
              <p className={styles.note} id={blockedId} data-testid={blockedId}>
                {blocked}
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
                aria-describedby={blocked ? blockedId : undefined}
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
                onClick={onReject}
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
