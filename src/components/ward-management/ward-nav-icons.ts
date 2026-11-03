import {
  Ambulance,
  ArrowLeftRight,
  BedSingle,
  Bell,
  BookUser,
  Building2,
  ChartColumn,
  ClipboardList,
  DoorClosed,
  DoorOpen,
  FileBadge,
  FilePlusCorner,
  Hospital,
  Hourglass,
  House,
  Inbox,
  LayoutGrid,
  MapPin,
  PhoneOff,
  Presentation,
  ShieldCheck,
  Signpost,
  Siren,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { WardMode, WardNavId } from "./ward-nav";

/**
 * One crisp Lucide line icon per destination (icon audit, 3 Nov 2026), keyed by the ids in
 * `ward-nav.ts`. Kept out of `ward-nav.ts` so that single source of truth stays plain data with no React dependency, which is what lets
 * `tests/ward-nav.test.ts` and `tests/ward-management.test.ts` read it in a plain Node context.
 *
 * Both the icon rail and the labelled panel/drawer read these, so an icon is chosen once rather
 * than per surface — the rail's icon and the panel's icon can never drift apart.
 */
export const WARD_VIEW_ICONS: Record<WardMode, LucideIcon> = {
  // A house, as on the phone menu, so Home reads as Home on the icon rail (Josh, 27 Oct 2026).
  command: House,
  // An hourglass (icon audit, 3 Nov 2026): Waiting is time spent waiting for a bed, not a filter.
  delays: Hourglass,
  capacity: BedSingle,
  movements: ArrowLeftRight,
  governance: ShieldCheck,
};

/**
 * Keyed by `WardNavId`, not `string`, so this map is guarded exactly the way `WARD_VIEW_ICONS`
 * above always has been: a `WARD_NAV` id with no icon here is a compile error, and an icon here
 * for an id `WARD_NAV` no longer carries is a compile error too. It was `Record<string, …>`, which
 * accepted every key and therefore checked nothing, while both the rail and the drawer render the
 * looked-up value directly as a component.
 *
 * This is a STRENGTHENING, not a hole being closed. `tests/ward-nav.test.ts` already asserted the
 * same property and stays — compile-time and test-time fail differently, and keeping both is the
 * point.
 */
export const WARD_NAV_ICONS: Record<WardNavId, LucideIcon> = {
  // The ward index: every ward in the network, a hospital with its cross. The single ward beside it
  // is a plain building, so the two never share an icon in the icon-only rail.
  wards: Hospital,
  // The community team index: two people, because a community team is the only destination in
  // this rail that is a team and not a place.
  community: Users,
  board: LayoutGrid,
  ward: Building2,
  officer: Ambulance,
  ed: Siren,
  handover: ClipboardList,
  /* A bell (icon audit, 3 Nov 2026), the one the phone dock and the top bar already use for
   * Alerts. It was a Siren, which All EDs also used, so two rail items shared one glyph. */
  alerts: Bell,
  escalation: TriangleAlert,
  // Patients is a census, not a search (UX audit, 21 Oct 2026): a book of people rather than the
  // magnifier the bar's own Search uses or a bare list.
  search: BookUser,
  /*
   * 🔴 **`PhoneOff`, AND THE CROSSED-OUT HANDSET IS THE POINT, NOT A PLACEHOLDER.**
   * This destination holds no number and nothing diallable, by design. A plain `Phone` would promise
   * in the rail exactly what the screen exists to refuse — and the rail is icon-only at its narrow
   * width, so the glyph is the whole of the promise a reader gets before they arrive.
   */
  "on-call": PhoneOff,
  // D-72: a closed door for the seclusion room, distinct from every other glyph in the rail.
  seclusion: DoorClosed,
  // Places, the index of every site: a map pin. It was a magnifier, which read as a second Search.
  hub: MapPin,
  // An open door (icon audit): LogOut is the Sign out icon in the rail's own foot. Seclusion keeps
  // the closed door.
  discharges: DoorOpen,
  referrals: Inbox,
  // A page with a plus: a referral is a document, and UserPlus read as adding a user account.
  "referral-intake": FilePlusCorner,
  // A column chart, because this destination is figures rather than a board of patients. Distinct
  // from every other icon in the rail, which is the only property an icon-only rail actually needs.
  statistics: ChartColumn,
  // A signpost, deliberately not a map pin or a compass: this destination is about how far somebody
  // is from home, and nothing in Phase 8 may assert where any hospital is.
  "out-of-area": Signpost,
  // A form with its badge: the one destination whose subject is a legal instrument rather than a
  // place, a person, a vehicle or a board of patients. The page is the forms, not the court.
  "legal-forms": FileBadge,
  // A presentation screen: the one destination meant to be read from across a meeting room.
  "bed-meeting": Presentation,
};
