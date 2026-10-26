"use client";

import { useRoleGate } from "@/components/ward-management/ward-role-gate";
import { WARD_ADD_PERSON_HREF } from "@/components/ward-management/ward-nav";
import { useCanOpenHref } from "./ward-access";
import type { RailEntry } from "./ward-rail-entries";

export type PhoneCreateId = "delays" | "wards" | "add-patient";

/**
 * What the phone's Create (+) may start from this desk. Each item asks the role table for the step
 * its page records, so a desk is never offered a page that refuses it (D-80). The dock reads this
 * too: a desk with nothing to start (executive, access admin) shows no + at all (Help thread,
 * 26 Oct 2026). Kept out of the Create sheet's own chunk so the dock does not load it.
 */
export function usePhoneCreateOptions(byId: ReadonlyMap<string, RailEntry>) {
  const gate = useRoleGate();
  const canOpen = useCanOpenHref();
  // Role access plan: New referral only for a desk whose role may raise one (review on PR #330).
  // The route's own gate too, so with the flag off an officer is not offered a sheet it cannot send.
  const canRefer = byId.has("referral-intake") && gate("RECEIVE_REFERRAL").allowed;
  const ids: PhoneCreateId[] = [];
  if (byId.has("delays") && gate("RECORD_MOVEMENT_BLOCKER").allowed) ids.push("delays");
  if (byId.has("wards") && gate("CONFIRM_CAPACITY").allowed) ids.push("wards");
  // Add patient is not a Menu entry, so it asks the same access table and the route's own gate
  // itself: a desk that cannot add a patient is not offered a page that refuses it (D-80).
  if (canOpen(WARD_ADD_PERSON_HREF) && gate("ADD_PATIENT").allowed) ids.push("add-patient");
  return { canRefer, ids, any: canRefer || ids.length > 0 };
}
