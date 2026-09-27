import {
  Ambulance,
  BedSingle,
  ChartColumn,
  Building2,
  Hospital,
  ClipboardList,
  Inbox,
  LayoutGrid,
  LayoutDashboard,
  ListFilter,
  PhoneOff,
  LogOut,
  Milestone,
  Route,
  ScanSearch,
  Scale,
  Search,
  ShieldCheck,
  Siren,
  TriangleAlert,
  Truck,
  UserPlus,
  Users,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

import type { WardMode, WardNavId } from "./ward-nav";

/**
 * One icon per destination, keyed by the ids in `ward-nav.ts`. Kept out of `ward-nav.ts` so that
 * single source of truth stays plain data with no React dependency, which is what lets
 * `tests/ward-nav.test.ts` and `tests/ward-management.test.ts` read it in a plain Node context.
 *
 * Both the icon rail and the labelled panel/drawer read these, so an icon is chosen once rather
 * than per surface — the rail's icon and the panel's icon can never drift apart.
 */
export const WARD_VIEW_ICONS: Record<WardMode, LucideIcon> = {
  command: LayoutDashboard,
  network: Waypoints,
  delays: ListFilter,
  capacity: BedSingle,
  movements: Route,
  transport: Truck,
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
  // The ward index: every ward in the network. `Hospital` rather than a second `Building2`, which
  // the single seeded ward example beside it already uses — two destinations sharing an icon in an
  // icon-only rail are two destinations a reader cannot tell apart.
  wards: Hospital,
  // The community team index. `Users` — a group of people rather than a building — because a
  // community team is the only destination in this rail that is a team and not a place. Distinct
  // from every other icon here, which is the one property an icon-only rail actually needs.
  community: Users,
  board: LayoutGrid,
  ward: Building2,
  officer: Ambulance,
  ed: Siren,
  handover: ClipboardList,
  /* Siren, not TriangleAlert: `escalation` already owns TriangleAlert below, and two nav items
   * sharing one glyph is a reader's problem before it is a designer's — this rail is scanned, not
   * read. Siren is already imported for another item's use and needs no new dependency. */
  alerts: Siren,
  escalation: TriangleAlert,
  search: Search,
  // The master search hub. `ScanSearch` rather than a second `Search`, which `search` directly
  // above already uses: this rail is icon-only at its narrow width, and two destinations sharing a
  // glyph are two destinations a reader cannot tell apart. The magnifier-over-a-frame reads as
  // searching ACROSS a set, which is what this destination does and `search` does not.
  /*
   * 🔴 **`PhoneOff`, AND THE CROSSED-OUT HANDSET IS THE POINT, NOT A PLACEHOLDER.**
   * This destination holds no number and nothing diallable, by design. A plain `Phone` would promise
   * in the rail exactly what the screen exists to refuse — and the rail is icon-only at its narrow
   * width, so the glyph is the whole of the promise a reader gets before they arrive.
   */
  "on-call": PhoneOff,
  hub: ScanSearch,
  discharges: LogOut,
  referrals: Inbox,
  "referral-intake": UserPlus,
  // A column chart, because this destination is figures rather than a board of patients. Distinct
  // from every other icon in the rail, which is the only property an icon-only rail actually needs.
  statistics: ChartColumn,
  // A distance marker on a road, deliberately not a map pin or a compass: this destination is
  // about how far somebody is from home, and nothing in Phase 8 may assert where any hospital is.
  "out-of-area": Milestone,
  // A balance scale, distinct from every icon above: this is the one destination whose subject is
  // a legal instrument rather than a place, a person, a vehicle or a board of patients.
  "legal-forms": Scale,
};
