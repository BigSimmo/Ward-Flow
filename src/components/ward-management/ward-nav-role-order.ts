import { WARD_MODES, type WardMode, type WardNavId } from "@/components/ward-management/ward-nav";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";

/**
 * **WHICH DESTINATION COMES FIRST, BY ROLE — owner's approved sidebar, 2026-09-06.**
 *
 * 🔴 **THIS REORDERS. IT NEVER ADDS OR REMOVES, AND THAT IS THE OWNER'S OWN RULING** (2026-09-06,
 * "reorder real screens only"). The drawn ward and ED sidebars named three destinations that do not
 * exist — "Movements in", "Referrals sent", "Our patients" — and the decision was that a role gets
 * the same real screens in a different order rather than links to screens nobody has built.
 *
 * 🔴 **AND IT IS ENFORCED STRUCTURALLY, NOT BY CARE.** `orderFor` sorts an existing array; it never
 * builds a new one from a hand-written list of ids. A hand-written permutation is one typo away
 * from silently dropping a destination — and a sidebar with a missing link looks exactly like a
 * sidebar, which is why the two-way check in `ward-nav.test.ts` exists in the first place. An id
 * this file does not mention keeps its source position at the end of the list rather than
 * vanishing, so **forgetting an id costs it a good position and nothing else.**
 *
 * ⚠️ **THE ROLE IS THE ROUTE.** Ward Flow has nobody signed in — see `ward-chrome-role.ts`. This is
 * a presentation hint about what is likely to be wanted first, never a statement about permission:
 * every destination stays reachable in every role, one scroll further down at worst.
 */

/** The order each role reads best in. Ids absent from a list keep their source order, last. */
const VIEW_ORDER: Record<WardChromeRole, readonly WardMode[]> = {
  /* The coordinator's order is the source order — the whole-network view is what `ward-nav.ts` was
     already written for, so this list restates it rather than changing it. */
  coordinator: WARD_MODES,
  /* A nurse in charge opens the sidebar to answer "what is happening to my beds, and who is coming
     to them" — so the bed board and the movement board come first and the network overview, which
     is somebody else's job, drops below them. */
  ward: ["capacity", "movements", "delays", "command", "network", "governance"],
  /* An emergency department is waiting on other people: where their patients have got to, and what
     is holding them up. Capacity is context they cannot act on — see the ED figures in
     `ward-standing-strip.tsx`, which carry the same caveat for the same reason. */
  ed: ["movements", "delays", "network", "capacity", "command", "governance"],
  officer: WARD_MODES,
  /* No role-specific order has been drawn for these three, so they keep source order — the same
     "keep source position" rule `orderFor` already applies to an id a list does not name. They must
     still be keys here: `VIEW_ORDER` is a total `Record` over `WardChromeRole`, so a role added to
     the union without a key here fails to compile. */
  community: [],
  bed_manager: [],
  executive: [],
};

const ROLE_GROUP_ORDER: Record<WardChromeRole, readonly WardNavId[]> = {
  coordinator: [],
  /* Own ward first, in both its shapes — the board a ward actually works from, then its detail
     screen — before the indexes that list everybody else's. */
  ward: ["board", "ward", "wards", "ed", "community", "officer", "statistics"],
  ed: ["ed", "wards", "board", "ward", "community", "officer", "statistics"],
  officer: ["officer"],
  community: [],
  bed_manager: [],
  executive: [],
};

const BOARD_GROUP_ORDER: Record<WardChromeRole, readonly WardNavId[]> = {
  coordinator: [],
  /* Handover is the ward's own daily document and it prints; discharges are what frees their beds. */
  ward: ["handover", "discharges", "referrals", "search", "hub", "referral-intake", "out-of-area"],
  /* Raising a referral is the one thing an ED does that starts everything else — `EVENT_ROLE`
     permits `RAISE_REFERRAL` for `ed`, so this is a real action for this role and not a guess. */
  ed: ["referral-intake", "referrals", "search", "hub", "handover", "discharges", "out-of-area"],
  officer: [],
  community: [],
  bed_manager: [],
  executive: [],
};

function orderFor<T extends { id: string }>(items: readonly T[], order: readonly string[]): readonly T[] {
  if (order.length === 0) return items;
  const rank = (id: string) => {
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  };
  /*
   * `toSorted` rather than `sort`: `items` is the module-level `WARD_NAV`/`WARD_VIEWS` array, and
   * sorting it in place would permanently reorder the single source of destinations for every other
   * reader in the process — including the two-way route check.
   */
  return items.toSorted((left, right) => rank(left.id) - rank(right.id));
}

export function orderViewsForRole<T extends { id: WardMode }>(items: readonly T[], role: WardChromeRole) {
  return orderFor(items, VIEW_ORDER[role]);
}

export function orderRoleScreensForRole<T extends { id: WardNavId }>(items: readonly T[], role: WardChromeRole) {
  return orderFor(items, ROLE_GROUP_ORDER[role]);
}

export function orderBoardsForRole<T extends { id: WardNavId }>(items: readonly T[], role: WardChromeRole) {
  return orderFor(items, BOARD_GROUP_ORDER[role]);
}

/**
 * The position `id` holds in its role's preferred order, or `null` when that role's list does not
 * name `id` at all — the same "keep its source position" case `orderFor` falls back to.
 *
 * Added so the third-edition rail (`shell/ward-rail.tsx`) can reorder its own groups, which MIX
 * views, role screens and boards inside one group. `orderFor` can only sort a homogeneous list
 * against one order array; this returns the single rank a caller needs to sort a heterogeneous
 * group without knowing which of the three arrays an id belongs to (the arrays cover disjoint id
 * spaces, so an id is named by at most one of them).
 *
 * ⚠️ **COORDINATOR RETURNS `null` FOR EVERY ID.** Its "order" in the mounted rail is the rail's own
 * curated `RAIL_GROUPS` order (`shell/ward-rail.tsx`, owner-approved 2026-09-13), not this module's
 * `WARD_MODES` source order — ranking the rail's entries against `VIEW_ORDER["coordinator"]` would
 * re-sort a curated order the owner approved later than this file was written. `null` therefore
 * means "keep the caller's source order", which for the rail is that curated order.
 */
export function wardNavRoleRank(role: WardChromeRole, id: string): number | null {
  if (role === "coordinator") return null;
  const viewAt = VIEW_ORDER[role].indexOf(id as WardMode);
  if (viewAt !== -1) return viewAt;
  const roleAt = ROLE_GROUP_ORDER[role].indexOf(id as WardNavId);
  if (roleAt !== -1) return roleAt;
  const boardAt = BOARD_GROUP_ORDER[role].indexOf(id as WardNavId);
  return boardAt === -1 ? null : boardAt;
}
