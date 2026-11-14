// The parts of Capacity that load on first open, not with the page (phone size limit, 9 Nov 2026).
// One module, so they share one download and add one entry, not one each, to every page's
// script map.
export { ScenarioDialog } from "./capacity-scenario-dialog";
export { BedMeetingSheetDialog } from "./capacity-meeting-sheet-dialog";
export { CapacityWardFoot, CapacityWardSidebar } from "./capacity-ward-drawer";
export { BedForecast } from "./capacity-bed-forecast";
