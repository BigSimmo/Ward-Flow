import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { INBOX_CATEGORIES, inboxOccurrenceSince } from "@/components/ward-management/ward-inbox-reducer";
import { currentInboxOwner, type InboxOwnershipEntry } from "@/components/ward-management/ward-inbox-snooze";
import type { Movement, Referral, Unit } from "@/components/ward-management/ward-model";
import { isAwaitingAnswer, referralDestinationLabel, referralState } from "@/components/ward-management/ward-referrals";

/**
 * "BEING WORKED ON BY" (smart features idea 3, overall review 20 Oct 2026). A quiet courtesy note on
 * a referral still waiting for answers, naming the desks that have it in hand so two people do not
 * ring the same wards about the same person:
 *   - a desk that CLAIMED it: the current owner of an action-list row about this referral's bed
 *     request (`TAKE_INBOX_ITEM_OWNERSHIP`), shown by its desk name, never a person. Only while
 *     that row is still on the task list: claims are never released, so a claim on a row that has
 *     since cleared names nobody (`rowIsLive`, from the current `taskItems` ids);
 *   - a ward that OPENED it and has not answered yet (`MARK_REFERRAL_OPENED`).
 *
 * Not a lock and not an answer: anyone can still act, and the decision clock keeps running. Read
 * only; nothing here is stored.
 */
export function referralWorkedOnBy(
  referral: Referral,
  records: {
    movements: readonly Movement[];
    inboxOwnership: Readonly<Record<string, readonly InboxOwnershipEntry[]>>;
    units: readonly Pick<Unit, "id" | "name">[];
    /** True while a task row with this id is on the list now. */
    rowIsLive: (rowId: string) => boolean;
  },
): string[] {
  if (referralState(referral) !== "queued") return [];
  const desks: string[] = [];
  const add = (desk: string) => {
    if (!desks.includes(desk)) desks.push(desk);
  };

  // Claims first, newest first: the bed requests raised from this referral and their rows' owners.
  const claims: InboxOwnershipEntry[] = [];
  for (const movement of records.movements) {
    if (movement.referralId !== referral.id || movement.closure !== undefined) continue;
    for (const category of Object.values(INBOX_CATEGORIES)) {
      const rowId = `${category.idPrefix}${movement.id}`;
      if (!records.rowIsLive(rowId)) continue;
      const owner = currentInboxOwner(records.inboxOwnership[rowId], inboxOccurrenceSince(movement, rowId));
      if (owner) claims.push(owner);
    }
  }
  for (const claim of claims.sort((a, b) => b.at - a.at)) add(deskNameOf(claim.by));

  // Then each ward that opened its copy and has not answered, in the order they opened it.
  const opened = referral.destinations
    .filter((arm) => isAwaitingAnswer(arm) && arm.openedAt !== undefined)
    .sort((a, b) => a.openedAt! - b.openedAt!);
  for (const arm of opened) {
    const unitId = arm.destination.kind === "psychiatric_ward" ? arm.destination.unitId : undefined;
    add(records.units.find((unit) => unit.id === unitId)?.name ?? referralDestinationLabel(arm.destination));
  }
  return desks;
}

/** A recorded role label ("Flow coordinator") as the desk is named on screen ("Bed coordinator"). */
function deskNameOf(recordedRole: string): string {
  const role = (Object.keys(WARD_FLOW_ROLE_LABELS) as (keyof typeof WARD_FLOW_ROLE_LABELS)[]).find(
    (candidate) => WARD_FLOW_ROLE_LABELS[candidate] === recordedRole,
  );
  return role !== undefined && Object.hasOwn(CHROME_ROLE_LABELS, role)
    ? CHROME_ROLE_LABELS[role as WardChromeRole]
    : recordedRole;
}

/** "Being worked on by Bed coordinator and Ward 4B", or `undefined` when nobody has it in hand. */
export function workedOnLine(desks: readonly string[]): string | undefined {
  if (desks.length === 0) return undefined;
  const named = desks.length === 1 ? desks[0]! : `${desks.slice(0, -1).join(", ")} and ${desks.at(-1)!}`;
  return `Being worked on by ${named}`;
}
