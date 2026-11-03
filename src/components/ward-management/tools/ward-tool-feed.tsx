"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Inbox } from "lucide-react";

import { LEAVING_DESTINATIONS, type LeavingDestination } from "@/components/ward-management/ward-admissions";
import { wardRouteUnitId, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import { useWardFlowClock, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { createPatientResolver, patientIdentityLine } from "@/components/ward-management/ward-patient-resolver";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import { useWardRaise } from "@/components/ward-management/ward-flow-raise";
import { useRouteRole } from "@/components/ward-management/ward-role-gate";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  feedSuggestion,
  simulatedFeedMessages,
  type FeedSuggestion,
} from "@/components/ward-management/integration/hospital-feed-sim";
import { previewFeedMessage, type FeedMessage } from "@/components/ward-management/integration/hospital-feed";
import {
  receiveFeedMessage,
  beginFeedConfirmation,
  endFeedConfirmation,
  isCurrentFeedItem,
  settleFeedItem,
  startFeedScript,
  syncFeedInboxGeneration,
  useFeedInbox,
  type FeedItem,
} from "@/components/ward-management/tools/ward-feed-inbox-store";
import { Button, EmptyState, Menu, StatusGlyph, type WfTone } from "@/components/wf";
import styles from "./ward-tool-feed.module.css";

/**
 * Tools mock-up Q320, Hospital feed. Forked from the live `WardFeedInbox` view and its store, so a
 * confirm raises the same event, with the same role and ward checks and the same Undo. The tool
 * lists only what waits for a person, each with Confirm; settled messages fade into one "Done"
 * line. "Receive next message" is a demo control, so it moves to Demo (`ReceiveNextFeedMessage`).
 * Every message is invented and matched by record number only.
 */

const EVENT_LABELS: Record<FeedMessage["event"], string> = {
  admitted: "Admission",
  transferred: "Transfer",
  discharged: "Discharge",
  registered: "Registration",
};

const DONE_LABELS: Record<Exclude<FeedItem["status"], "waiting">, { text: string; tone: WfTone }> = {
  confirmed: { text: "Confirmed", tone: "success" },
  rejected: { text: "Rejected", tone: "neutral" },
  refused: { text: "Refused", tone: "closed" },
};

type Confirmable = Exclude<FeedSuggestion, { kind: "none" }>;
type FeedPerson = { who: string; line: string };

/** The inbox for the demo world on screen; an inbox from a replaced world reads as empty. */
function useCurrentInbox() {
  const { worldGeneration } = useWardFlowSelect("worldGeneration");
  const inbox = useFeedInbox();
  useEffect(() => syncFeedInboxGeneration(worldGeneration), [worldGeneration]);
  return { inbox, current: inbox.generation === worldGeneration, worldGeneration };
}

/** How many feed messages wait for a person, for the Tools row's count. */
export function useFeedWaitingCount(): number {
  const { inbox, current } = useCurrentInbox();
  return current ? inbox.items.filter((item) => item.status === "waiting").length : 0;
}

/**
 * Demo control: brings in the next invented feed message. Lives in Tools, Demo (Q320), not in the
 * feed tool, because it stands in for the hospital system sending one.
 */
export function ReceiveNextFeedMessage() {
  const { movements, admissions, patients } = useWardFlowSelect("movements", "admissions", "patients");
  const { inbox, current } = useCurrentInbox();
  const [status, setStatus] = useState("");
  // The script is fixed at the first message, so later board changes do not reshuffle what is to come.
  const messages = current && inbox.script ? inbox.script : simulatedFeedMessages({ movements, admissions, patients });
  const next = messages[current ? inbox.received : 0];

  function receive() {
    if (!next) return;
    startFeedScript(messages);
    const item = receiveFeedMessage(next);
    setStatus(
      item.status === "refused"
        ? `Message ${item.seq} refused. ${item.note ?? ""}`.trim()
        : `Message ${item.seq} received. It waits in Hospital feed.`,
    );
  }

  return (
    <div className={styles.receive}>
      <Button
        size="sm"
        icon={Inbox}
        onClick={receive}
        disabledReason={next ? undefined : "No more invented messages."}
        data-testid="ward-feed-receive"
      >
        Receive message
      </Button>
      <p className={styles.live} role="status">
        {status}
      </p>
    </div>
  );
}

export function ToolFeed({ onNavigate }: { onNavigate: () => void }) {
  void onNavigate;
  const { movements, admissions, patients, units, dispatch, rejections } = useWardFlowSelect(
    "movements",
    "admissions",
    "patients",
    "units",
    "dispatch",
    "rejections",
  );
  const now = useWardFlowClock();
  const { inbox, current } = useCurrentInbox();
  const role = useRouteRole();
  const raise = useWardRaise(role);
  // Audit CS3-06: a confirmed message offers Undo, like the ward's own Confirm arrival and Has left.
  const { offer: offerUndo } = useUndoableStep({ dispatch, rejections, now, routeRole: role });
  const routeUnitId = wardRouteUnitId(usePathname() ?? "");
  const [status, setStatus] = useState("");
  const [showDone, setShowDone] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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

  const items = current ? inbox.items : [];
  const waiting = items.filter((item) => item.status === "waiting");
  const done = items.filter((item) => item.status !== "waiting").reverse();

  function confirm(item: FeedItem, suggestion: Confirmable, leaving?: LeavingDestination) {
    if (!beginFeedConfirmation(item)) return;
    const who = personOf(suggestion)?.who ?? "this person";
    const doneText =
      suggestion.kind === "arrival"
        ? `Arrival confirmed: ${who} on ${unitName(suggestion.unitId)}.`
        : `Discharge recorded: ${who} from ${unitName(suggestion.unitId)}.`;
    const step = {
      success: doneText,
      undo: (at: number) =>
        suggestion.kind === "arrival"
          ? {
              type: "UNDO_TRANSPORT_STEP" as const,
              role,
              now: at,
              movementId: suggestion.movementId,
              actingUnitId: suggestion.unitId,
            }
          : {
              type: "UNDO_DEPARTURE" as const,
              role,
              now: at,
              admissionId: suggestion.admissionId,
              actingUnitId: suggestion.unitId,
            },
      undone: `Undone: ${who} is back as before.`,
      refusalShownInline: true,
    };
    const notConfirmed = () => {
      endFeedConfirmation(item);
      if (mounted.current && isCurrentFeedItem(item)) setStatus("Not confirmed. Check the board before trying again.");
    };
    const answer = (result: WardCommandOutcome | void, awaitConfirmation = true) => {
      if (!isCurrentFeedItem(item)) return;
      if (result?.status === "accepted" && result.isCurrent?.() !== false) {
        if (settleFeedItem(item, "confirmed", doneText) && mounted.current) {
          offerUndo(step, { completion: result });
          setStatus(`Message ${item.seq}: ${doneText}`);
        }
        return;
      }
      if (mounted.current)
        setStatus(`Not recorded: ${result?.message ?? "the save is not confirmed"}. The message still waits.`);
      if (awaitConfirmation && result?.status === "failed" && result.confirmation) {
        void result.confirmation.then(
          (confirmed) => (confirmed.commandId === result.commandId ? answer(confirmed, false) : notConfirmed()),
          notConfirmed,
        );
      } else endFeedConfirmation(item);
    };
    try {
      const outcome =
        suggestion.kind === "arrival"
          ? raise("PATIENT_ARRIVED", { movementId: suggestion.movementId, actingUnitId: suggestion.unitId })
          : raise("RECORD_LEAVING", {
              admissionId: suggestion.admissionId,
              actingUnitId: suggestion.unitId,
              leavingDestination: leaving!,
            });
      void Promise.resolve(outcome).then((result) => answer(result), notConfirmed);
    } catch {
      notConfirmed();
    }
  }

  return (
    <div className={styles.body} data-testid="ward-feed-inbox">
      <p className={styles.note}>Invented messages, matched by record number only.</p>
      {waiting.length ? (
        <ol className={styles.list} aria-label="Messages waiting">
          {waiting.map((item, index) => (
            <FeedRow
              key={item.seq}
              item={item}
              lead={index === 0}
              suggestion={item.message ? feedSuggestion(item.message, { movements, admissions, patients }) : undefined}
              personOf={personOf}
              differences={item.message ? differencesFrom(item.message, patients) : []}
              unitName={unitName}
              blockedReason={(suggestion) => confirmBlockedReason(suggestion, role, routeUnitId, unitName)}
              pending={inbox.pending.includes(item)}
              onConfirm={(suggestion, leaving) => confirm(item, suggestion, leaving)}
              onReject={() => {
                if (inbox.pending.includes(item)) return;
                if (settleFeedItem(item, "rejected")) setStatus(`Message ${item.seq} rejected. Nothing changed.`);
              }}
            />
          ))}
        </ol>
      ) : (
        <EmptyState title="Nothing to confirm" meta="New messages wait here for a person." />
      )}
      <p className={styles.live} role="status">
        {status}
      </p>
      {done.length ? (
        <div className={styles.done}>
          <button
            type="button"
            className={styles.doneToggle}
            aria-expanded={showDone}
            onClick={() => setShowDone((open) => !open)}
            data-testid="ward-feed-done"
          >
            <StatusGlyph tone="success" size={9} />
            <span>Done</span>
            <span className={styles.doneCount}>{done.length}</span>
            <ChevronDown aria-hidden="true" size={14} strokeWidth={1.75} data-open={showDone || undefined} />
          </button>
          {showDone ? (
            <ul className={styles.doneList} aria-label="Messages done">
              {done.map((item) => {
                const label = DONE_LABELS[item.status as keyof typeof DONE_LABELS];
                return (
                  <li key={item.seq} className={styles.doneRow} data-testid={`ward-feed-item-${item.seq}`}>
                    <span className={styles.doneHead}>
                      <StatusGlyph tone={label.tone} size={8} />
                      <span className={styles.event}>
                        {item.message ? EVENT_LABELS[item.message.event] : "Unreadable message"}
                      </span>
                      {item.message ? <span className={styles.umrn}>{item.message.umrn}</span> : null}
                      <span className={styles.doneWord}>{label.text}</span>
                    </span>
                    {item.note ? <span className={styles.doneNote}>{item.note}</span> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

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
  lead,
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
  /** The first waiting message carries the panel's one filled button. */
  lead: boolean;
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
  const confirmable = suggestion && suggestion.kind !== "none" && differences.length === 0 ? suggestion : null;
  const blocked = confirmable ? blockedReason(confirmable) : null;
  const noteId = `ward-feed-note-${item.seq}`;
  const person = confirmable ? personOf(confirmable)?.line : undefined;
  const of = person ? ` of ${person}` : "";
  // Saving shows as the button's spinner; a block or a missing destination shows as its reason.
  const reason =
    blocked ?? (confirmable?.kind === "departure" && !leaving ? "Choose where they went first." : undefined);

  return (
    <li className={styles.item} data-testid={`ward-feed-item-${item.seq}`}>
      <div className={styles.head}>
        <span className={styles.event}>{message ? EVENT_LABELS[message.event] : "Unreadable message"}</span>
        {message ? <span className={styles.umrn}>{message.umrn}</span> : null}
      </div>
      {confirmable ? (
        <>
          <p className={styles.what} id={noteId}>
            {confirmable.kind === "arrival"
              ? `Confirms the arrival${of} on ${unitName(confirmable.unitId)}.`
              : `Records the departure${of} from ${unitName(confirmable.unitId)}.`}
          </p>
          {confirmable.kind === "departure" && !blocked ? (
            <Menu
              label="Where they went"
              items={LEAVING_DESTINATIONS.map((entry) => ({
                id: entry.id,
                label: entry.label,
                checked: entry.id === leaving,
                checkable: "radio" as const,
                onSelect: () => setLeaving(entry.id),
              }))}
              trigger={(props) => (
                <button
                  {...props}
                  type="button"
                  className={styles.picker}
                  aria-label={
                    leaving
                      ? `Where they went: ${LEAVING_DESTINATIONS.find((entry) => entry.id === leaving)?.label}`
                      : "Where they went"
                  }
                  data-testid={`ward-feed-leaving-${item.seq}`}
                >
                  <span className={leaving ? styles.pickerValue : styles.pickerEmpty}>
                    {leaving ? LEAVING_DESTINATIONS.find((entry) => entry.id === leaving)?.label : "Where they went"}
                  </span>
                  <ChevronDown aria-hidden="true" size={16} strokeWidth={1.75} />
                </button>
              )}
            />
          ) : null}
          <div className={styles.actions}>
            <Button
              variant={lead ? "pri" : "sec"}
              size="sm"
              icon={Check}
              loading={pending}
              aria-describedby={noteId}
              disabledReason={reason}
              onClick={() => {
                if (!reason && !pending) onConfirm(confirmable, leaving || undefined);
              }}
              data-testid={`ward-feed-confirm-${item.seq}`}
            >
              Confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabledReason={pending ? "Saving this confirmation." : undefined}
              reasonDisplay="tooltip"
              onClick={onReject}
              data-testid={`ward-feed-reject-${item.seq}`}
            >
              Reject
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* A near-miss name or date of birth is the classic wrong-patient error: it confirms nothing. */}
          <p className={styles.what}>
            {suggestion?.kind === "none"
              ? suggestion.reason
              : differences.length
                ? `${differences.join(". ")}. Check the person in the hospital system. Nothing to confirm here.`
                : "Nothing to confirm here."}
          </p>
          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={onReject} data-testid={`ward-feed-reject-${item.seq}`}>
              Dismiss
            </Button>
          </div>
        </>
      )}
    </li>
  );
}
