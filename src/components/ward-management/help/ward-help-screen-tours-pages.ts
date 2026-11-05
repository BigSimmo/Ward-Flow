/**
 * SHOW ME AROUND, the page walk-rounds (5 Nov 2026), with the target helpers and walk-round shape
 * that `ward-help-screen-tours.ts` shares. Kept apart so neither file passes the line limit. Only
 * the walk-round list imports this file, so Help's content stays lazy.
 */
import type { WardScreenId } from "@/components/ward-management/ward-role-access";

import type { ShowMeStep } from "./ward-help-howto";
import type { TourTarget } from "./ward-tour-steps";

export const id = (testId: string): TourTarget => ({ sel: `[data-testid="${testId}"]` });
export const starts = (testId: string): TourTarget => ({ sel: `[data-testid^="${testId}"]` });

/** The screen's hero card, as the desk tour finds it. */
export const HERO: TourTarget = { sel: "#main-content section[aria-labelledby]" };

export type Around = {
  /** The rail entry id, which is also the screen's help id (`SCREEN_HELP`). */
  readonly screen: string;
  /** The screen's name as Help's "On this screen" card shows it. */
  readonly name: string;
  readonly keywords?: string;
  /**
   * A page the rail does not list (one ward, one ED board), matched by its address in Help. Its walk
   * round plays on the page already open, so it names no `go`, and its purpose is said here for the
   * printed guide.
   */
  readonly page?: {
    readonly purpose: string;
    /** The page's own address; its walk round is offered only there. */
    readonly path: RegExp;
    /** The screen a desk must open to see the page, so another desk is never offered it. */
    readonly needs: WardScreenId;
  };
  readonly steps: readonly ShowMeStep[];
};

/** A labelled region or control, found by its accessible name. */
export const named = (label: string, element = "*"): TourTarget => ({
  sel: `#main-content ${element}[aria-label="${label}"]`,
});

/**
 * Walk-rounds for detail and stand-alone pages (5 Nov 2026). Each plays only on its own page, the
 * same as one ward and one ED board, and names the screen a desk must open to see it.
 */
export const MORE_PAGES: readonly Around[] = [
  {
    screen: "patient",
    name: "this patient record",
    keywords: "patient record movement person now history details documents status card",
    page: {
      purpose: "One patient's record: where they are now, their movement and the next step.",
      path: /^\/ward-flow\/(?:people\/(?!new$)[^/]+|movements\/[^/]+)$/u,
      needs: "patient",
    },
    steps: [
      {
        target: id("ward-patient-glance"),
        title: "At a glance",
        body: "Legal status, observation level, risk and alerts, as recorded.",
      },
      {
        target: id("ward-patient-care-journey"),
        title: "Where they are up to",
        body: "Each step from the ED to the community, with the current one marked.",
      },
      {
        target: id("ward-patient-status-card"),
        title: "The status card",
        body: "The bed, fit to travel and transport, each with who does it and its next step.",
      },
      {
        target: [id("ward-patient-destination-row"), id("ward-patient-legal-now")],
        title: "Destination",
        body: "Open Destination to ask wards, pull the bed or make a correction.",
      },
      {
        target: { sel: '[role="tablist"][aria-label="The record"]' },
        title: "The record",
        body: "Now, History, Details and Documents. History lists each change as it was saved.",
      },
    ],
  },
  {
    screen: "add-patient",
    name: "Add patient",
    keywords: "add patient new record register umrn duplicate",
    page: {
      purpose: "Adds a new invented patient record. Only the core details are needed.",
      path: /^\/ward-flow\/people\/new$/u,
      needs: "patient-new",
    },
    steps: [
      {
        target: [id("ward-add-patient-form"), id("ward-add-patient-family-name")],
        title: "Core details",
        body: "Family name, given name, date of birth and UMRN. Everything else is optional.",
      },
      {
        target: id("ward-add-patient-duplicate-check"),
        title: "Duplicate check",
        body: "Checks every record as you type, so one person does not get two records.",
      },
      {
        target: id("ward-add-patient-more-details"),
        title: "More details",
        body: "Contact and address, care links, and culture and language. All optional.",
      },
      {
        acts: ["ADD_PATIENT"],
        target: id("ward-add-patient-submit"),
        title: "Add patient",
        body: "Opens the new record. Add and start referral goes straight to a referral instead.",
      },
    ],
  },
  {
    screen: "board",
    name: "this bed board",
    keywords: "bed board beds place move discharge shift brief",
    page: {
      purpose: "Every bed on one ward, who is in it, who is coming in and who is going out today and tomorrow.",
      path: /^\/ward-flow\/board\/[^/]+$/u,
      needs: "board",
    },
    steps: [
      {
        target: [id("ward-board-band-stats"), HERO],
        title: "The ward now",
        body: "Ready, occupied, pulled and going out, as at the time shown.",
      },
      {
        device: "desk",
        target: id("ward-board-triage"),
        title: "Also on this ward",
        body: "Closed beds, discharges expected or held up, people away at an ED, on leave or here over three months.",
      },
      {
        target: id("ward-board-beds"),
        title: "Every bed",
        body: "One tile per bed, with the patient and their stay so far. Choose a bed to see who is in it.",
      },
      {
        target: id("ward-board-work-band"),
        title: "Before handover",
        body: "What needs you before the next handover, such as a discharge still here or a pulled bed not yet arrived.",
      },
      {
        target: id("ward-board-outgoing"),
        title: "Going out",
        body: "Discharges today and tomorrow. Switch between confirmed and expected.",
      },
    ],
  },
  {
    screen: "ward-answer",
    name: "this bed request",
    keywords: "ward answer accept decline bed request gates referral",
    page: {
      purpose: "One bed request at a time, for this ward to accept or decline.",
      path: /^\/ward-flow\/ward\/[^/]+\/answer$/u,
      needs: "ward",
    },
    steps: [
      {
        target: named("Awaiting your answer", "section"),
        title: "The request",
        body: "One bed request at a time. Previous and Next step through them when more than one is waiting.",
      },
      {
        target: [id("ward-answer-assessment"), named("Awaiting your answer", "section")],
        title: "The referral",
        body: "What the sender wrote, set out as situation, background, assessment and request.",
      },
      {
        target: [
          named("This ward's own gates for this patient", "section"),
          id("ward-answer-fold-gates"),
          named("Awaiting your answer", "section"),
        ],
        title: "Your gates",
        body: "Each gate reads Pass or Does not pass. They inform your answer and decide nothing.",
      },
      {
        device: "desk",
        target: named("Confirm your beds", "section"),
        title: "Confirm your beds",
        body: "Confirm the ward's bed figures while you are here, so the network sees them.",
      },
      {
        device: "desk",
        target: named("Recent answers", "section"),
        title: "Recent answers",
        body: "What this ward answered lately.",
      },
    ],
  },
  {
    screen: "catchments",
    name: "Catchments",
    keywords: "catchment suburb postcode community team lookup read alike",
    page: {
      purpose:
        "Which community team covers a suburb, every community team from A to Z, and team names that read alike.",
      path: /^\/ward-flow\/hub\/catchments$/u,
      needs: "community",
    },
    steps: [
      {
        target: id("suburb-lookup-card"),
        title: "Suburb lookup",
        body: "Type a suburb or postcode. It names the team that covers it.",
      },
      {
        device: "desk",
        target: id("community-index-teams"),
        title: "A to Z",
        body: "Every community team. Narrow by health service, then open a team's own page.",
      },
      {
        device: "phone",
        target: { sel: '#main-content [role="radiogroup"][aria-label="Show"]' },
        title: "One list at a time",
        body: "Suburb, A to Z, Read alike or Services. Choose one to read that list.",
      },
      {
        target: [id("community-gateway-family-panel"), id("community-index-side")],
        title: "Read alike",
        body: "Team names that look similar, side by side, so you open the right one.",
      },
      {
        target: { sel: 'nav[aria-label="Places views"]' },
        title: "Back to Places",
        body: "Choose Places to go back to every ward, ED and team.",
      },
    ],
  },
  {
    screen: "community-team",
    name: "this team",
    keywords: "community team caseload referrals cto in hospital",
    page: {
      purpose: "One community team's referrals and patients, from a referral sent to their return to the team.",
      path: /^\/ward-flow\/community\/[^/]+$/u,
      needs: "community",
    },
    steps: [
      {
        target: [id("ward-community-hero-answer"), HERO],
        title: "The team now",
        body: "How many are on the caseload, with the oldest referral and the next person due home.",
      },
      {
        device: "desk",
        target: { sel: '[role="tablist"][aria-label="Team sections"]' },
        title: "Team sections",
        body: "Team home, Caseload, In hospital, Referrals and Clinicians.",
      },
      {
        target: id("ward-community-switch-team"),
        title: "Switch team",
        body: "Opens another community team's page.",
      },
      {
        device: "desk",
        target: id("ward-community-contact"),
        title: "How to reach the team",
        body: "The team's phone and address, invented for the demo.",
      },
      {
        device: "phone",
        target: { sel: '#main-content [role="radiogroup"][aria-label="Team lists"]' },
        title: "Team lists",
        body: "Choose which list to read. Each shows how many are in it.",
      },
      {
        device: "phone",
        target: { sel: '#main-content [role="group"][aria-label="Team tools"]' },
        title: "Team tools",
        body: "How to reach the team and who is on duty open from here, with the team's own jobs after them.",
      },
    ],
  },
  {
    screen: "settings",
    name: "Settings",
    keywords: "settings rules display theme alerts profile preferences",
    page: {
      purpose: "The network's rules and this device's own choices, in tabs.",
      path: /^\/ward-flow\/settings$/u,
      needs: "settings",
    },
    steps: [
      {
        target: [id("ward-settings-section-tabs"), starts("ward-settings-phone-area-")],
        title: "Sections",
        body: "Each desk sees its own sections, such as Rules, Alerts, Display and You.",
      },
      {
        device: "desk",
        acts: ["SET_CONFIGURATION"],
        target: id("ward-settings-save-bar"),
        title: "Save rule changes",
        body: "Rule changes wait here until you Save, and every save is recorded. Discard drops them.",
      },
      {
        target: [id("ward-settings-appearance"), id("ward-settings-phone-theme")],
        title: "Display",
        body: "Theme, row density and the other choices for this device. They save at once.",
      },
      {
        device: "desk",
        target: [id("ward-settings-profile-card"), id("ward-settings-profile")],
        title: "Your desk",
        body: "What your screens include and the shift you are on.",
      },
    ],
  },
  {
    screen: "downtime",
    name: "the downtime pack",
    keywords: "downtime pack outage paper snapshot print offline",
    page: {
      purpose:
        "A printable copy of the last snapshot, for when the system is down: beds by ward, the ED queue, pending moves and legal forms.",
      path: /^\/ward-flow\/reports\/downtime$/u,
      needs: "downtime",
    },
    steps: [
      {
        target: [id("ward-downtime-frozen"), HERO],
        title: "When it was taken",
        body: "The pack is a copy from this time. It does not update by itself.",
      },
      {
        target: id("ward-downtime-refresh"),
        title: "New snapshot",
        body: "The bed coordinator takes a new snapshot. Other desks see when the last one was taken.",
      },
      {
        target: [{ sel: '#main-content [aria-label="Downtime pack section"]' }, id("ward-downtime-beds")],
        title: "Sections",
        body: "Beds by ward, ED queue, pending movements and legal forms.",
      },
      {
        device: "desk",
        target: id("ward-downtime-print"),
        title: "Print or save PDF",
        body: "Keep a paper copy, or save it as a PDF to your service's approved downtime location.",
      },
    ],
  },
  {
    screen: "bed-meeting-agenda",
    name: "the agenda",
    keywords: "bed meeting agenda actions ed waits stranded",
    page: {
      purpose: "The bed meeting's agenda, built from fixed rules, and the actions agreed at earlier meetings.",
      path: /^\/ward-flow\/bed-meeting\/agenda$/u,
      needs: "bed-meeting-agenda",
    },
    steps: [
      {
        target: id("bed-meeting-agenda-filters"),
        title: "Filter the agenda",
        body: "Choose a service, pick which lists to show, or find anyone to discuss.",
      },
      {
        target: id("bed-meeting-action-summary"),
        title: "Earlier actions",
        body: "Actions agreed at earlier meetings that are still open. Mark done closes one once it is.",
      },
      {
        target: id("bed-meeting-agenda-ed-waits"),
        title: "The lists",
        body: "Longest ED waits, pulled beds with least time left, stranded stays, out of area and referrals awaiting a decision.",
      },
      {
        acts: ["RECORD_BED_MEETING_ACTION"],
        target: id("bed-meeting-add-action"),
        title: "Add an action",
        body: "Action against a person records what was agreed, with an owner and a due time.",
      },
      {
        device: "desk",
        target: [id("agenda-start-meeting"), id("bed-meeting-sheet-open")],
        title: "Start meeting",
        body: "Opens the meeting room view. Bed meeting sheet has the printable sheet.",
      },
    ],
  },
  {
    screen: "chronology",
    name: "the chronology",
    keywords: "chronology pir post incident review timeline events export",
    page: {
      purpose: "One patient's events in time order, for a post-incident review, ready to print or download.",
      path: /^\/ward-flow\/reports\/chronology$/u,
      needs: "chronology",
    },
    steps: [
      {
        target: [id("ward-chronology-patient"), id("ward-chronology-phone-picker")],
        title: "Find a patient",
        body: "Search by name or UMRN to build their chronology.",
      },
      {
        target: id("ward-chronology-start-patient"),
        title: "Patients on the board",
        body: "Everyone with a record, A to Z by surname. Choose one to open their chronology.",
      },
      {
        device: "desk",
        target: id("ward-chronology-generated"),
        title: "Generated",
        body: "When it was built. Synthetic demo data, not a clinical record.",
      },
    ],
  },
  {
    screen: "statistics-compare",
    name: "Compare",
    keywords: "statistics compare wards eds chart pinned",
    page: {
      purpose: "Every ward and every ED side by side, as a chart or a table, with up to three wards pinned.",
      path: /^\/ward-flow\/statistics\/compare$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Statistics views",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly.",
      },
      {
        device: "desk",
        target: id("statistics-compare-ward-chart"),
        title: "Ward comparison",
        body: "Occupancy, stay, discharges held up and long stays for each ward. Data shows the table and CSV downloads it.",
      },
      {
        device: "desk",
        target: id("statistics-compare-ed-chart"),
        title: "ED comparison",
        body: "Waiting, urgent, no ward yet and the longest wait for each ED.",
      },
      {
        device: "desk",
        target: id("ward-statistics-compare-pinned"),
        title: "Pinned wards",
        body: "Pin up to three wards to set them beside the network.",
      },
      {
        device: "phone",
        target: id("ward-statistics-compare-phone-chart"),
        title: "Wards or EDs",
        body: "Switch between wards and EDs, then choose the measure to set side by side.",
      },
      {
        device: "phone",
        target: id("ward-statistics-compare-phone-pinned"),
        title: "Compare two wards",
        body: "Choose two wards to set against the network.",
      },
    ],
  },
  {
    screen: "statistics-services",
    name: "Health services",
    keywords: "statistics services health service occupancy referrals accepted",
    page: {
      purpose: "Each health service's beds, where referrals were accepted and its open ED movements.",
      path: /^\/ward-flow\/statistics\/services$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Statistics views",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services"),
        title: "Each service",
        body: "Beds in use, pulled, closed and ready. Open a service for its own figures.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services-referrals"),
        title: "Where referrals were accepted",
        body: "Every referral on record, counted by the service that accepted it.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services-ed-waits"),
        title: "Open ED movements",
        body: "People still in an ED or in transit, counted by service.",
      },
      {
        device: "phone",
        target: id("ward-statistics-services-phone"),
        title: "Each service",
        body: "Beds in use, wards over 85% and open ED movements. Open a service for its own figures.",
      },
      {
        device: "phone",
        target: id("ward-statistics-services-phone-referrals"),
        title: "Where referrals were accepted",
        body: "Every referral on record, counted by the service that accepted it.",
      },
    ],
  },
  {
    screen: "statistics-wards",
    name: "All wards statistics",
    keywords: "statistics wards occupancy stay held up table",
    page: {
      purpose: "Every ward's beds in use, stay so far and discharges held up.",
      path: /^\/ward-flow\/statistics\/wards$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Statistics views",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly.",
      },
      {
        device: "desk",
        target: id("ward-statistics-wards-table-card"),
        title: "Every ward",
        body: "Beds in use, occupied and ready for each ward. Group by service or show one list.",
      },
      {
        device: "desk",
        target: id("ward-statistics-wards-mean-stay"),
        title: "Stay so far",
        body: "Average days so far for people in a bed now.",
      },
      {
        device: "desk",
        target: id("ward-statistics-wards-blocked"),
        title: "Discharges held up",
        body: "Discharges with something in the way, counted by ward.",
      },
      {
        device: "phone",
        target: id("ward-statistics-wards-phone"),
        title: "Every ward",
        body: "Beds in use and ready for each ward. Group by service or show one list.",
      },
    ],
  },
  {
    screen: "statistics-eds",
    name: "All EDs statistics",
    keywords: "statistics eds emergency department waits time since opening",
    page: {
      purpose: "Every emergency department's open movements and how long each has been open.",
      path: /^\/ward-flow\/statistics\/eds$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Statistics views",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly.",
      },
      {
        target: [
          id("ward-statistics-eds-swarm-card"),
          id("ward-statistics-eds-swarm"),
          id("ward-statistics-eds-phone-swarm"),
        ],
        title: "Open movements by ED",
        body: "One dot per person, by hours since the movement opened.",
      },
      {
        device: "desk",
        target: id("ward-statistics-eds-table-card"),
        title: "Every ED",
        body: "Open ED movements, including transit. Sort by any column.",
      },
      {
        device: "desk",
        target: id("ward-statistics-eds-bands"),
        title: "Time since opening",
        body: "Open movements counted in bands, from under 4 hours up.",
      },
    ],
  },
  {
    screen: "statistics-teams",
    name: "Community teams statistics",
    keywords: "statistics community teams in a bed caseload",
    page: {
      purpose: "Each community team's patients in a bed, and those with a discharge date.",
      path: /^\/ward-flow\/statistics\/teams$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: id("ward-statistics-nav"),
        title: "Statistics views",
        body: "Network, Compare, Services, Wards, EDs, Teams and Weekly.",
      },
      {
        device: "desk",
        target: id("ward-statistics-teams-in-bed"),
        title: "Teams by service",
        body: "How many of each service's team patients are in a bed.",
      },
      {
        device: "desk",
        target: id("ward-statistics-teams-all"),
        title: "Teams with someone in a bed",
        body: "Only teams with someone in a bed are listed. Show all lists every team.",
      },
      {
        device: "phone",
        target: id("ward-statistics-teams-phone"),
        title: "Teams",
        body: "With patients lists the teams with someone in a bed. All teams lists every team.",
      },
    ],
  },
  {
    screen: "statistics-weekly",
    name: "the weekly report",
    keywords: "weekly report operations pilot measures week print",
    page: {
      purpose: "One week's operations: the pilot measures, where the time goes and the pressure that week.",
      path: /^\/ward-flow\/statistics\/weekly$/u,
      needs: "statistics",
    },
    steps: [
      {
        device: "desk",
        target: id("ward-weekly-week"),
        title: "Choose the week",
        body: "This week so far, the last full week, or one of the seven before it.",
      },
      {
        target: id("ward-pilot-steps"),
        title: "Where the time goes",
        body: "The typical time for each step finished that week, from referral to arrival.",
      },
      {
        target: id("ward-weekly-occupancy"),
        title: "Supporting figures",
        body: "Occupancy, out of area days, delayed days and ED waits past 24 hours that week.",
      },
      {
        device: "desk",
        target: id("ward-weekly-print"),
        title: "Print",
        body: "A paper copy of the week's report.",
      },
    ],
  },
];
