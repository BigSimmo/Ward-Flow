/**
 * Sent when a header action opens a sheet of its own (New referral), so the rail's More and Menu
 * sheets close. A module of its own because the header is on every page's first load: importing
 * this name from the rail's parts pulled the rail's capacity card, its stylesheet map and the bed
 * alert model into every phone page's first load (about 10 KB, 31 Oct 2026).
 */
export const CLOSE_MENUS_EVENT = "ward-flow-close-menus";
