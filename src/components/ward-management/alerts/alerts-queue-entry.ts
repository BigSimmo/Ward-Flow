import type { WardChromeRole } from "../ward-chrome-role";
import { CHROME_ROLE_LABELS } from "../ward-chrome-role";
import { inboxOwnerRoles } from "../ward-act-now-items";
import type { Instant } from "../ward-clock";
import type { InboxItem } from "../ward-derivations";
import type { WardFlowState } from "../ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "../ward-flow-roles";
import { activeSnooze, currentInboxOwner } from "../ward-inbox-snooze";
import {
  admissionIdOfInboxId,
  alertActionFor,
  alertGroupOf,
  effectiveOwner,
  raisedAt,
  resolveAlertSubject,
} from "./alerts-model";
import type { QueueEntry } from "./alerts-queue";

type QueueState = Pick<
  WardFlowState,
  "units" | "admissions" | "inboxOwnership" | "inboxAcknowledgements" | "inboxSnoozes"
>;

/** Bind one authorised record snapshot and role; owner words use the same mapping as Tasks. */
export function createAlertEntryBuilder(
  records: Parameters<typeof resolveAlertSubject>[2],
  state: QueueState,
  role: WardChromeRole,
  now: Instant,
) {
  const coordinator = WARD_FLOW_ROLE_LABELS.coordinator;
  const coordDesk = role === "coordinator";
  const wardNames = state.units.map((unit) => unit.name);
  return (item: InboxItem, snoozed: boolean): Omit<QueueEntry, "highlighted"> => {
    const movement = records.movements?.find((candidate) => candidate.id === item.movementId);
    const booking = item.plannedAdmission
      ? { planned: item.plannedAdmission, personLabel: item.personLabel }
      : undefined;
    const dischargeAdmissionId = admissionIdOfInboxId(item.id);
    const admission =
      dischargeAdmissionId !== undefined
        ? state.admissions.find((stay) => stay.id === dischargeAdmissionId)
        : undefined;
    const subject = resolveAlertSubject(
      movement,
      item.movementId,
      records,
      state.units,
      booking,
      admission,
      item.personId,
    );
    const recorded = effectiveOwner(item, state.inboxOwnership[item.id]);
    // #801: a taken coordinator row is never "You" on another desk. Original owners return after hand back.
    const owner = recorded === coordinator && !coordDesk ? CHROME_ROLE_LABELS.coordinator : recorded;
    const mine = coordDesk ? recorded === coordinator : inboxOwnerRoles(recorded, wardNames).includes(role);
    return {
      item,
      movement,
      subject,
      group: alertGroupOf(item),
      owner,
      mine,
      raised: raisedAt(item, movement),
      seen: state.inboxAcknowledgements[item.id]?.at(-1),
      ownedSince: currentInboxOwner(state.inboxOwnership[item.id], item.since)?.at,
      snooze: snoozed ? activeSnooze(state.inboxSnoozes[item.id], now, item.since) : undefined,
      action: alertActionFor(item, subject),
    };
  };
}
