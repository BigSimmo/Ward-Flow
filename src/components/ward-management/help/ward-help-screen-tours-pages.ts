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

/** A labelled part anywhere on the page, for a hero drawn above the main content (Ward answer). */
const labelled = (label: string, element = "*"): TourTarget => ({ sel: `${element}[aria-label="${label}"]` });

/** A part inside a test-id region, such as one control in a card. */
const inside = (testId: string, inner: string, text?: string): TourTarget => ({
  sel: `[data-testid="${testId}"] ${inner}`,
  ...(text === undefined ? {} : { text }),
});

/** A card found by the heading id it is labelled by (the Weekly report's cards). */
const card = (headingId: string): TourTarget => ({ sel: `#main-content [aria-labelledby="${headingId}"]` });

/** A button or link holding these words, inside the main content. */
const press = (words: string, element = "button"): TourTarget => ({ sel: `#main-content ${element}`, text: words });

/** The Statistics pages' shared top: the figures and the views. */
const STATISTICS_FIGURES: TourTarget = named("Figures", '[role="group"]');
const statisticsViews: ShowMeStep = {
  target: id("ward-statistics-nav"),
  title: "Statistics views",
  body: "Network, Compare, Services, Wards, EDs, Teams and Weekly. Each opens its own page.",
};

/**
 * Walk-rounds for detail and stand-alone pages (5 Nov 2026), extended to a full walk of each page
 * (Josh, 15 Nov 2026: "a full walkthrough of all the useful and important and relevant features").
 * Each plays only on its own page, the same as one ward and one ED board, and names the screen a
 * desk must open to see it. Where a part differs by device, the desktop control is named first and
 * the phone's after, or the step is marked for one device.
 */
export const MORE_PAGES: readonly Around[] = [
  {
    // Feature plan item 29: the first-night walk round of the coordinator's Night view.
    screen: "night",
    name: "Night view",
    keywords: "night overnight first night shift after hours on call steps beds ready",
    page: {
      purpose: "The coordinator's overnight page: beds ready, ED waits by Step, who is on the way and on-call lines.",
      path: /^\/bedchart\/night$/u,
      needs: "night",
    },
    steps: [
      {
        target: [id("night-figures"), HERO],
        title: "Tonight at a glance",
        body: "Beds ready, people waiting in an ED and people on the way. The same figures as Home, Waiting and Movements.",
      },
      {
        device: "desk",
        target: id("ward-bar-service-trigger"),
        title: "Service in view",
        body: "The page follows the header's service. Statewide shows every service; choose one to see only its wards and EDs.",
      },
      {
        target: id("night-beds"),
        title: "Beds ready now",
        body: "Each ward with a bed ready, by health service then name. Never ranked. Capacity opens every ward's figures.",
      },
      {
        target: [starts("night-ward-"), id("night-beds")],
        title: "One ward",
        body: "The ward's service, when its count was last confirmed and how many beds are ready. Open its name for the ward.",
      },
      {
        target: id("night-ed-steps"),
        title: "ED waits by Step",
        body: "How many people are at each Step, by time in the department, with the next escalation step. Waiting opens the list.",
      },
      {
        target: [id("night-step-under"), id("night-ed-steps")],
        title: "Under Step 1",
        body: "People waiting who have not reached Step 1 yet. A Step is a prompt for a person to act.",
      },
      {
        target: id("night-on-the-way"),
        title: "On the way",
        body: "Everyone collected and moving to a ward, with where to and when due. Open a name for their record.",
      },
      {
        target: id("night-intake-windows"),
        title: "Intake windows",
        body: "Says Not recorded until wards record their overnight intake windows.",
      },
      {
        target: id("night-on-call"),
        title: "On call now",
        body: "The state desk, each service's bed flow and the crisis line, with who answers now and until when. Numbers are synthetic.",
      },
    ],
  },
  {
    screen: "patient",
    name: "this patient record",
    keywords: "patient record movement person now history details documents status card",
    page: {
      purpose: "One patient's record: where they are now, their movement and the next step.",
      path: /^\/bedchart\/(?:people\/(?!new$)[^/]+|movements\/[^/]+)$/u,
      needs: "patient",
    },
    steps: [
      {
        target: [id("ward-person-identity"), named("Patient summary", "section")],
        title: "Who and where",
        body: "Name, record number and where they are now, such as In ED or Inpatient.",
      },
      {
        target: id("ward-patient-glance"),
        title: "At a glance",
        body: "Legal status, observation level, risk and alerts, as recorded. Legal opens their forms.",
      },
      {
        target: [named("Patient actions", "ul"), id("ward-patient-pin")],
        title: "Copy, Pin and Forms",
        body: "Copy handover or Copy summary copies a short summary. Pin keeps the record on Home. Forms opens their legal forms.",
      },
      {
        target: id("ward-patient-care-journey"),
        title: "Where they are up to",
        body: "Each step from the ED to the community, with the current one marked and the dates recorded.",
      },
      {
        target: { sel: '[role="tablist"][aria-label="The record"]' },
        title: "The record",
        body: "Now, History, Details and Documents (Docs on a phone). History lists each change as it was saved.",
      },
      {
        target: id("ward-patient-status-card"),
        title: "The status card",
        body: "Where they stand now. In an ED: the bed, fit to travel and transport, each with who does it. On a ward: their day of stay.",
      },
      {
        target: [id("ward-patient-destination-row"), id("ward-patient-change-card"), id("ward-patient-status-card")],
        title: "Destination or a change",
        body: "In an ED, Destination asks wards, pulls the bed or corrects it. On a ward, Record a change starts leave, Gone to ED, a discharge date or absence.",
      },
      {
        target: [id("ward-patient-legal-now"), id("ward-patient-glance-legal")],
        title: "Legal now",
        body: "The legal forms in force, as recorded. Forms or Documents lists every form.",
      },
      {
        target: [id("ward-patient-discharge-readiness"), id("ward-patient-care-journey-discharge")],
        title: "Discharge readiness",
        body: "On a ward: the discharge date, community team and next contact, as recorded. The Discharge step shows the same date.",
      },
      {
        acts: ["RECORD_TRIAGE_SIGNED"],
        target: id("patient-triage-card"),
        title: "Triage and risk",
        body: "The signed triage on record. Triage opens the triage form.",
      },
      {
        target: id("ward-carer-callback"),
        title: "Carer call back",
        body: "Records that a carer wants a call back and when, then Call made once it is done.",
      },
      {
        target: id("ward-patient-care-plan-card"),
        title: "Care and safety",
        body: "Add care plan, the tribunal hearing date, whether a carer was told and cultural support asked for.",
      },
      {
        target: id("ward-patient-who-to-call"),
        title: "Who to call",
        body: "The ED or ward caring for them now, with a number to copy. Numbers are synthetic.",
      },
    ],
  },
  {
    screen: "add-patient",
    name: "Add patient",
    keywords: "add patient new record register umrn duplicate",
    page: {
      purpose: "Adds a new invented patient record. Only the core details are needed.",
      path: /^\/bedchart\/people\/new$/u,
      needs: "patient-new",
    },
    steps: [
      {
        target: [id("ward-add-patient-draft-pill"), id("ward-add-patient-phone-hero")],
        title: "A draft until added",
        body: "Nothing is saved until you add the patient. Cancel goes back to patient search without adding anyone.",
      },
      {
        target: [id("ward-add-patient-form"), id("ward-add-patient-family-name")],
        title: "Core details",
        body: "Family name, given name, date of birth and UMRN. The count shows how many of the four are done.",
      },
      {
        target: id("ward-add-patient-sex"),
        title: "Sex",
        body: "Female, Male, Another term or Not recorded.",
      },
      {
        target: id("ward-add-patient-duplicate-check"),
        title: "Duplicate check",
        body: "Checks every record as you type a UMRN or a name of four letters or more, so one person does not get two records.",
      },
      {
        target: id("ward-add-patient-open-all"),
        title: "Open all",
        body: "Opens every optional section at once. Close all folds them again.",
      },
      {
        target: id("ward-add-patient-more-details"),
        title: "Optional details",
        body: "Gender, contact and address, next of kin and carer, Medicare, GP and community team, culture and language, and planning.",
      },
      {
        target: [id("ward-add-patient-unavailable"), id("ward-add-patient-reset")],
        title: "What is still needed",
        body: "Names the core details still blank. Reset clears every field, and Undo puts them back.",
      },
      {
        acts: ["ADD_PATIENT"],
        target: id("ward-add-patient-register-and-refer"),
        title: "Add and start referral",
        body: "Adds the patient and goes straight to a new referral for them.",
      },
      {
        acts: ["ADD_PATIENT"],
        target: id("ward-add-patient-submit"),
        title: "Add patient",
        body: "Adds the patient and opens their new record.",
      },
      {
        device: "desk",
        target: named("Recently added records", "aside"),
        title: "Recently added",
        body: "Records added lately, with how many were added today.",
      },
    ],
  },
  {
    screen: "board",
    name: "this bed board",
    keywords: "bed board beds place move discharge shift brief",
    page: {
      purpose: "Every bed on one ward, who is in it, who is coming in and who is going out today and tomorrow.",
      path: /^\/bedchart\/board\/[^/]+$/u,
      needs: "board",
    },
    steps: [
      {
        target: [id("ward-board-band-stats"), HERO],
        title: "The ward now",
        body: "Ready, occupied and pulled now, as at the time shown. Press Pulled or expected to see who they are.",
      },
      {
        target: [id("ward-board-worth-a-look"), id("ward-board-band-stats")],
        title: "Worth a look",
        body: "Show on board narrows the beds to the people worth a look, such as long stays and people waiting to leave.",
      },
      {
        target: [named("Bed board actions", "ul"), id("ward-board-top-sheet-toggle")],
        title: "Shift brief and Change ward",
        body: "Shift brief opens this ward's brief, ready to print. Change ward opens another ward's board.",
      },
      {
        target: id("ward-board-triage"),
        title: "Also on this ward",
        body: "Discharges confirmed or held up, people away at an ED, on leave or here over three months, and closed beds. Press a count to see who.",
      },
      {
        target: id("ward-board-tabs"),
        title: "Ward home and Bed board",
        body: "Ward home is the ward's own page. Bed board is this one.",
      },
      {
        device: "phone",
        target: id("ward-board-squares"),
        title: "Beds as squares",
        body: "One square per bed, with how many are ready and any closed.",
      },
      {
        target: [named("Narrow Bed board", '[role="radiogroup"]'), named("Show", '[role="radiogroup"]')],
        title: "Narrow the beds",
        body: "All beds, Needs a look, Ready or No discharge due.",
      },
      {
        target: named("Order the beds"),
        title: "Order the beds",
        body: "Longest stay, Soonest to leave or Bed order.",
      },
      {
        target: id("ward-board-beds"),
        title: "Every bed",
        body: "One tile per bed, with the patient and their stay so far. Choose a bed to see who is in it and record a change.",
      },
      {
        target: [id("ward-board-stranded"), id("ward-board-beds")],
        title: "Long stays",
        body: "Long stays and people ready to leave who are still here, with what they are waiting for.",
      },
      {
        target: [id("ward-board-forecast-share"), id("ward-board-beds")],
        title: "Tomorrow's forecast",
        body: "How many of this ward's discharges count in tomorrow's forecast, confirmed or expected.",
      },
      {
        target: id("ward-board-work-band"),
        title: "Before handover",
        body: "What needs you before the next handover. They have left, Record hold-up and Mark them back act on each row.",
      },
      {
        target: { sel: '#main-content [role="tablist"][aria-label="Which side of the ward is shown"]' },
        title: "Going out and coming in",
        body: "Going out, Coming in and Since yesterday. Going out shows confirmed discharges today and tomorrow, or switch to expected.",
      },
    ],
  },
  {
    screen: "ward-answer",
    name: "this bed request",
    keywords: "ward answer accept decline bed request gates referral",
    page: {
      purpose: "One bed request at a time, for this ward to accept or decline.",
      path: /^\/bedchart\/ward\/[^/]+\/answer$/u,
      needs: "ward",
    },
    steps: [
      {
        target: [id("wf-occupancy-ring"), labelled("Figures", '[role="group"]')],
        title: "How full the ward is",
        body: "The share of beds in use against the alert line, with the ward's occupied, ready, pulled and closed beds.",
      },
      {
        target: [labelled("Bed request position", '[role="group"]'), named("Awaiting your answer", "section")],
        title: "One request at a time",
        body: "Previous and Next step through the requests when more than one is waiting.",
      },
      {
        target: named("Awaiting your answer", "section"),
        title: "The request",
        body: "Who is asking for a bed, from which ED, with the safety tags the referral records.",
      },
      {
        target: [named("Current facts for this patient", "dl"), named("Awaiting your answer", "section")],
        title: "Current facts",
        body: "Cohort, bed needed, sex, observation level and the other facts, as the referral records them.",
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
        acts: ["DECLINE"],
        target: [starts("ward-decline-toggle-"), named("Awaiting your answer", "section")],
        title: "Decline",
        body: "Opens the decline reasons. Choose one, then confirm the decline.",
      },
      {
        acts: ["ACCEPT_IN_PRINCIPLE"],
        target: [starts("ward-accept-"), named("Awaiting your answer", "section")],
        title: "Accept in principle",
        body: "Opens Accept referral in principle to check and confirm. A person always chooses the bed.",
      },
      {
        acts: ["CONFIRM_CAPACITY"],
        target: [named("Confirm your beds", "section"), id("ward-answer-fold-capacity")],
        title: "Confirm your beds",
        body: "Set Free beds and press Confirm, so the network sees this ward's figure. It changes this ward only.",
      },
      {
        target: [{ sel: '#main-content section[aria-label$=" Census"]' }, id("ward-answer-fold-census")],
        title: "Census",
        body: "One square per bed: ready, pulled, closed or occupied.",
      },
      {
        target: [named("Recent answers", "section"), id("ward-answer-fold-history")],
        title: "Recent answers",
        body: "What this ward answered lately, and when.",
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
      path: /^\/bedchart\/hub\/catchments$/u,
      needs: "community",
    },
    steps: [
      {
        target: [named("Catchment figures", '[role="group"]'), HERO],
        title: "Catchments at a glance",
        body: "How many community teams, suburbs mapped and team names that read alike.",
      },
      {
        target: named("Suburb or postcode", "input"),
        title: "Suburb or postcode",
        body: "Type a suburb, alias or postcode. The lookup below names the team, and the A to Z narrows to match.",
      },
      {
        target: id("community-action-catchment-guide"),
        title: "Catchment guide",
        body: "Opens the guide to how catchments are set out.",
      },
      {
        target: id("community-action-shared-suburbs"),
        title: "Shared suburbs",
        body: "Shows only suburbs whose row names more than one team. Press again to show every suburb.",
      },
      {
        target: [
          { sel: 'nav[aria-label="Places views"]' },
          inside("community-index", '[aria-label="Catchment actions"] a', "Places"),
        ],
        title: "Back to Places",
        body: "Places lists every ward, ED and team. Catchments is this page.",
      },
      {
        device: "phone",
        target: named("Show", '[role="radiogroup"]'),
        title: "One list at a time",
        body: "Suburb, A to Z, Read alike or Services. Choose one to read that list.",
      },
      {
        target: id("suburb-lookup-card"),
        title: "Suburb lookup",
        body: "Names the team that covers the suburb, with Open and Show in list. The suburbs listed each name more than one team.",
      },
      {
        device: "desk",
        target: id("community-index-teams"),
        title: "A to Z",
        body: "Every community team. Narrow by health service or jump to a letter, then open a team's own page.",
      },
      {
        device: "desk",
        target: [starts("community-gateway-reads-alike"), id("community-index-teams")],
        title: "Reads like others",
        body: "A team name close to another one. Press it to set them side by side and check you have the right team.",
      },
      {
        device: "desk",
        target: [id("community-gateway-family-panel"), id("community-index-side")],
        title: "Read alike",
        body: "Team names that look similar, side by side. Choose a group, then open the right team.",
      },
      {
        target: id("community-index-about-this-data"),
        title: "About this data",
        body: "Where the team names and suburbs come from, and what they cannot tell you.",
      },
    ],
  },
  {
    screen: "community-team",
    name: "this team",
    keywords: "community team caseload referrals cto in hospital",
    page: {
      purpose: "One community team's referrals and patients, from a referral sent to their return to the team.",
      path: /^\/bedchart\/community\/[^/]+$/u,
      needs: "community",
    },
    steps: [
      {
        target: [id("ward-community-hero-answer"), HERO],
        title: "The team now",
        body: "How many are on the caseload, with how many are in hospital.",
      },
      {
        target: [id("ward-community-switch-team"), id("ward-community-hero-answer")],
        title: "Switch team",
        body: "Opens another community team's page. A team's own desk sees only its team.",
      },
      {
        device: "desk",
        target: [id("community-top-act"), press("Act now")],
        title: "Act now",
        body: "Who needs someone today. Press it to open that list.",
      },
      {
        device: "phone",
        target: [id("community-top-act"), id("ward-community-phone-attention")],
        title: "Who needs someone",
        body: "Act now, or Worth attention, lists who needs someone today.",
      },
      {
        target: [{ sel: "#btnMainIntake" }, id("ward-community-phone-chip-intake"), press("Refer from team")],
        title: "Refer from team",
        body: "Starts a referral from this team for one of its patients.",
      },
      {
        target: [
          id("community-top-record-contact"),
          id("ward-community-phone-chip-contact"),
          { sel: '#main-content [role="toolbar"][aria-label="Team actions"] button', text: "Record contact" },
        ],
        title: "Record contact",
        body: "Records a contact with a patient or their carer.",
      },
      {
        device: "desk",
        target: id("ward-community-glance"),
        title: "At a glance",
        body: "The oldest referral and the next person due home, or the week's discharges, follow-ups and CTO reviews. Each opens its list.",
      },
      {
        device: "desk",
        target: [id("community-team-tabs"), { sel: '[role="tablist"][aria-label="Team sections"]' }],
        title: "Team sections",
        body: "Team home, Caseload, In hospital, Referrals and Clinicians. Where a search box shows, it finds a client or clinician.",
      },
      {
        device: "desk",
        target: [
          id("community-top-more"),
          { sel: '#main-content [role="toolbar"][aria-label="Team actions"] button', text: "More" },
        ],
        title: "More team actions",
        body: "CTO register, Catchment counts, How to reach the team and the demo samples.",
      },
      {
        device: "desk",
        // The contact card, or on a team with an at-a-glance line (Midland) its duty officer.
        target: [
          id("ward-community-contact"),
          id("community-top-duty"),
          { sel: '[data-testid="ward-community-glance"] button', text: "Duty officer" },
        ],
        title: "How to reach the team",
        body: "The team's phone and address, or today's duty officer and extension. All invented for the demo.",
      },
      {
        device: "phone",
        // The list picker, or on a team with the 2026 layout (Midland) its section picker.
        target: [
          { sel: '#main-content [role="radiogroup"][aria-label="Team lists"]' },
          { sel: '#main-content [role="radiogroup"][aria-label="Team sections"]' },
        ],
        title: "Team lists",
        body: "Choose which list or section to read.",
      },
      {
        device: "phone",
        // The tools row, or on a team with the 2026 layout (Midland) its duty officer.
        target: [
          { sel: '#main-content [role="group"][aria-label="Team tools"]' },
          id("community-top-duty"),
          { sel: '#main-content section[aria-label="Duty officer"]' },
        ],
        title: "Team tools",
        body: "How to reach the team, who is on duty today and the team's other tools.",
      },
    ],
  },
  {
    screen: "settings",
    name: "Settings",
    keywords: "settings rules display theme alerts profile preferences",
    page: {
      purpose: "The network's rules and this device's own choices, in tabs.",
      path: /^\/bedchart\/settings$/u,
      needs: "settings",
    },
    steps: [
      {
        target: named("Find a setting", "input"),
        title: "Find a setting",
        body: "Type what you want to change, such as theme or alerts, and choose it to go straight there.",
      },
      {
        target: [id("ward-settings-alerts-act"), id("ward-settings-open-alerts")],
        title: "Alerts on this device",
        body: "Says whether alerts reach this device. Open alerts shows how to turn them on.",
      },
      {
        device: "desk",
        target: id("ward-settings-status-strip"),
        title: "Where the rules stand",
        body: "Whether the rules are at default, the last save, and that rule changes wait for Save.",
      },
      {
        device: "desk",
        target: id("ward-settings-section-tabs"),
        title: "Sections",
        body: "Each desk sees its own sections, such as Rules, Alerts, Display and Your desk.",
      },
      {
        device: "desk",
        target: [{ sel: '[data-setting="changed-only"]' }, id("ward-settings-section-tabs")],
        title: "Changed from default",
        body: "Shows only the rules that differ from the default.",
      },
      {
        device: "desk",
        target: [{ sel: '[data-setting="surge"]' }, id("ward-settings-jump-rules")],
        title: "Standard or Surge",
        body: "Switches the timing set. The line under it lists each rule Surge changes.",
      },
      {
        device: "desk",
        target: [{ sel: '[data-setting="decision-targets"]' }, id("ward-settings-jump-rules")],
        title: "Rule values",
        body: "Each rule shows its range. Use minus and plus to change it.",
      },
      {
        device: "desk",
        acts: ["SET_CONFIGURATION"],
        target: id("ward-settings-save-bar"),
        title: "Save rule changes",
        body: "Rule changes wait here until you Save, and every save is recorded. Discard drops them.",
      },
      {
        device: "desk",
        target: [id("ward-settings-rules-more"), id("ward-settings-jump-rules")],
        title: "Rules file and tables",
        body: "Save or load the rules as a file, and read the published reference tables.",
      },
      {
        device: "desk",
        target: [id("ward-settings-alerts-check"), id("ward-settings-jump-alerts")],
        title: "Will alerts reach you",
        body: "Alerts lists each way an alert can reach this device and which are ready, with quiet hours and the buzz sound.",
      },
      {
        target: [id("ward-settings-appearance"), id("ward-settings-phone-theme"), id("ward-settings-jump-display")],
        title: "Display",
        body: "Theme, row density and the other choices for this device. They save at once.",
      },
      {
        device: "phone",
        target: starts("ward-settings-phone-area-"),
        title: "All settings",
        body: "Each area opens in its own sheet. A count on Rules shows changes not yet saved.",
      },
      {
        device: "desk",
        target: [id("ward-settings-profile-card"), id("ward-settings-jump-you")],
        title: "Your desk",
        body: "What your screens include, the service in view and the shift you are on.",
      },
      {
        device: "desk",
        target: [id("ward-settings-demo-tools"), id("ward-settings-jump-demo")],
        title: "Demo tools",
        body: "Demo controls, Reset for this browser and Copy for diagnostics. For the demo only.",
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
      path: /^\/bedchart\/reports\/downtime$/u,
      needs: "downtime",
    },
    steps: [
      {
        target: [id("ward-downtime-frozen"), HERO],
        title: "When it was taken",
        body: "The pack is a copy from this time. It does not update by itself.",
      },
      {
        target: [named("Pack totals", '[role="group"]'), HERO],
        title: "Pack totals",
        body: "Beds ready, occupied and being made ready in this copy.",
      },
      {
        target: id("ward-downtime-print"),
        title: "Print or save PDF",
        body: "Prints every table in full, whichever one is open. Save the PDF to your service's approved downtime location.",
      },
      {
        target: id("ward-downtime-refresh"),
        title: "New snapshot",
        body: "The bed coordinator takes a new snapshot. Other desks see when the last one was taken.",
      },
      {
        acts: ["RECORD_OUTAGE_WINDOW"],
        target: id("ward-downtime-record-outage-chip"),
        title: "Record an outage",
        body: "Type when the system was down, from and to, then Save. Each ward then sees a catch-up card. No bed figure changes.",
      },
      {
        target: [id("ward-downtime-old-packs"), id("ward-downtime-frozen")],
        title: "Packs not printed",
        body: "For the coordinator: each ward whose last pack was never printed or is past the age the band names, with its last print.",
      },
      {
        target: [{ sel: '#main-content [aria-label="Downtime pack section"]' }, id("ward-downtime-beds")],
        title: "Sections",
        body: "Beds by ward, ED queue, pending movements and legal forms. Choose one to read it here.",
      },
      {
        target: [id("ward-downtime-beds"), { sel: "#main-content section[aria-label] ul" }],
        title: "Beds by ward",
        body: "Each ward's beds by health service, with the ready count and totals.",
      },
    ],
  },
  {
    screen: "bed-meeting-agenda",
    name: "the agenda",
    keywords: "bed meeting agenda actions ed waits stranded",
    page: {
      purpose: "The bed meeting's agenda, built from fixed rules, and the actions agreed at earlier meetings.",
      path: /^\/bedchart\/bed-meeting\/agenda$/u,
      needs: "bed-meeting-agenda",
    },
    steps: [
      {
        target: [starts("agenda-figure-"), HERO],
        title: "The lists at a glance",
        body: "How many are on each list. Press a figure to show only that list, and again to show every list.",
      },
      {
        target: id("agenda-act"),
        title: "Earlier actions",
        body: "Actions from earlier meetings, with how many are overdue, still open and done in the last day.",
      },
      {
        target: id("agenda-find-anyone"),
        title: "Find anyone",
        body: "Opens a search to find anyone to discuss by name or UMRN.",
      },
      {
        target: id("agenda-referrals-chip"),
        title: "Referrals",
        body: "Shows only referrals awaiting a decision. Press again to show every list.",
      },
      {
        acts: ["RECORD_BED_MEETING_ACTION"],
        target: id("bed-meeting-run-start"),
        title: "Run meeting",
        body: "Steps the meeting through each service in turn, with Next and Stop, then a summary of what was recorded.",
      },
      {
        target: id("bed-meeting-agenda-groups"),
        title: "Filter by group",
        body: "Shows only the groups you choose. Each one shows above the lists, with Clear.",
      },
      {
        target: [id("agenda-start-meeting"), id("bed-meeting-sheet-open")],
        title: "TV or printed sheet",
        body: "Open on TV shows the meeting room view. Bed meeting sheet has the printable sheet.",
      },
      {
        target: id("bed-meeting-agenda-filters"),
        title: "Service",
        body: "Statewide or one health service, so the meeting can go service by service.",
      },
      {
        target: [id("bed-meeting-action-list"), id("agenda-act")],
        title: "Actions from earlier meetings",
        body: "Each open action with its owner and due time. Mark done closes one once it is.",
      },
      {
        target: id("bed-meeting-agenda-ed-waits"),
        title: "The lists",
        body: "Longest ED waits, pulled beds soonest to expire, stranded stays, out of area and closed beds past review.",
      },
      {
        acts: ["RECORD_BED_MEETING_ACTION"],
        target: id("bed-meeting-add-action"),
        title: "Add an action",
        body: "Action on a row records what was agreed for that person, with an owner and when it is due.",
      },
      {
        target: [id("bed-meeting-agenda-referrals"), id("agenda-referrals-chip")],
        title: "Referrals awaiting decision",
        body: "Referrals still waiting for a decision. Copy puts the list on the clipboard.",
      },
    ],
  },
  {
    screen: "chronology",
    name: "the chronology",
    keywords: "chronology pir post incident review timeline events export",
    page: {
      purpose: "One patient's events in time order, for a post-incident review, ready to print or download.",
      path: /^\/bedchart\/reports\/chronology$/u,
      needs: "chronology",
    },
    steps: [
      {
        target: [id("ward-chronology-patient"), id("ward-chronology-phone-picker")],
        title: "Find a patient",
        body: "Search by name or UMRN to build their chronology.",
      },
      {
        device: "desk",
        target: id("ward-chronology-generated"),
        title: "Generated",
        body: "When it was built. Synthetic demo data, not a clinical record.",
      },
      {
        target: [id("ward-chronology-start-count"), id("ward-chronology-start-patient")],
        title: "Patients on the board",
        body: "Everyone with a record, A to Z by surname. Show more lists more; search finds anyone else.",
      },
      {
        target: id("ward-chronology-start-patient"),
        title: "Open a chronology",
        body: "Choose a person to open their events in time order, with Print and CSV.",
      },
      {
        target: [{ sel: '#main-content [aria-labelledby$="-holds"]' }, id("ward-chronology-start-patient")],
        title: "What it holds",
        body: "Records, the audit trail where your desk may see it, and this session's log. Times are as recorded, never worked out.",
      },
    ],
  },
  {
    screen: "statistics-compare",
    name: "Compare",
    keywords: "statistics compare wards eds chart pinned",
    page: {
      purpose: "Every ward and every ED side by side, as a chart or a table, with up to three wards pinned.",
      path: /^\/bedchart\/statistics\/compare$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "Network figures",
        body: "Ready beds, average completed stay and discharges held up across the network.",
      },
      statisticsViews,
      {
        device: "desk",
        target: id("ward-statistics-compare-tool-open-unit"),
        title: "Open a unit",
        body: "Find one ward or ED and open its own statistics.",
      },
      {
        device: "desk",
        target: id("statistics-compare-ward-chart"),
        title: "Ward comparison",
        body: "Every ward against the network mean. Chart or Data switches the view, and CSV downloads the figures.",
      },
      {
        device: "phone",
        target: named("Compare", '[role="radiogroup"]'),
        title: "Wards or EDs",
        body: "Switch between wards and EDs, then choose the measure to set side by side.",
      },
      {
        target: named("Ward measure"),
        title: "Choose the measure",
        body: "Occupancy, completed stay, discharges held up or long stays.",
      },
      {
        device: "desk",
        target: [named("Ward group", '[role="group"]'), named("Filter wards by name or hospital", "input")],
        title: "Narrow the wards",
        body: "Type a ward or hospital name, or show one group such as Locked or Older.",
      },
      {
        device: "phone",
        target: id("ward-statistics-compare-phone-chart"),
        title: "Side by side",
        body: "Each ward or ED against the network mean, on the measure chosen.",
      },
      {
        device: "desk",
        target: id("statistics-compare-ed-chart"),
        title: "ED comparison",
        body: "Waiting, urgent, no ward yet and the longest wait for each ED, as a chart or data.",
      },
      {
        device: "desk",
        target: id("ward-statistics-compare-pinned"),
        title: "Pinned wards",
        body: "Pin up to three wards to set them beside the network.",
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
      path: /^\/bedchart\/statistics\/services$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "Services at a glance",
        body: "Each service's share of beds in use. On a phone: services, beds and open ED journeys.",
      },
      statisticsViews,
      {
        device: "desk",
        target: id("ward-statistics-services-compare"),
        title: "Compare",
        body: "Opens Compare, with every ward and ED side by side.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services"),
        title: "Each service",
        body: "Beds in use, pulled, closed and ready, with wards at the alert line. Open a service for its own figures.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services-referrals"),
        title: "Where referrals were accepted",
        body: "Every referral on record, by the service that referred and the service that accepted it.",
      },
      {
        device: "desk",
        target: id("ward-statistics-services-ed-waits"),
        title: "ED journeys open",
        body: "People still in an ED or in transit, counted by service.",
      },
      {
        device: "phone",
        target: id("ward-statistics-services-phone"),
        title: "Each service",
        body: "Beds in use, wards at the alert line and ED journeys open. Open a service for its own figures.",
      },
      {
        device: "phone",
        target: id("ward-statistics-services-dot-key"),
        title: "Amber dot",
        body: "Says what an amber dot on a service means.",
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
      path: /^\/bedchart\/statistics\/wards$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "Wards at a glance",
        body: "Wards at or over the alert line, wards with none ready, ready beds and pulled beds not yet arrived.",
      },
      statisticsViews,
      {
        device: "desk",
        target: id("ward-statistics-wards-compare"),
        title: "Compare wards",
        body: "Opens Compare, with every ward side by side.",
      },
      {
        target: named("Group wards", '[role="radiogroup"]'),
        title: "By service or one list",
        body: "Group the wards by health service, or show them as one list.",
      },
      {
        target: named("Highlight wards", '[role="group"]'),
        title: "Highlight wards",
        body: "Marks the wards with a pulled bed, a discharge held up or the other states. Press again to clear.",
      },
      {
        target: [id("ward-statistics-wards-table-card"), named("Every ward", "ul")],
        title: "Every ward",
        body: "Beds in use, occupied and ready for each ward. Open a ward for its own figures.",
      },
      {
        device: "phone",
        target: id("ward-statistics-wards-dot-key"),
        title: "Amber dot",
        body: "Says what an amber dot on a ward means.",
      },
      {
        device: "desk",
        target: id("ward-statistics-wards-mean-stay"),
        title: "Stay so far",
        body: "Average days so far for people in a bed now, for the wards with the longest.",
      },
      {
        device: "desk",
        target: id("ward-statistics-wards-blocked"),
        title: "Discharges held up",
        body: "Discharges with something in the way, counted by ward.",
      },
    ],
  },
  {
    screen: "statistics-eds",
    name: "All EDs statistics",
    keywords: "statistics eds emergency department waits time since opening",
    page: {
      purpose: "Every emergency department's open movements and how long each has been open.",
      path: /^\/bedchart\/statistics\/eds$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "EDs at a glance",
        body: "ED journeys open across the network, with the median, how many have no ward yet and how many are flagged urgent.",
      },
      statisticsViews,
      {
        device: "desk",
        target: id("ward-statistics-eds-compare"),
        title: "Compare",
        body: "Opens Compare, with every ED side by side.",
      },
      {
        target: [
          id("ward-statistics-eds-swarm-card"),
          id("ward-statistics-eds-swarm"),
          id("ward-statistics-eds-phone-swarm"),
        ],
        title: "Open movements by ED",
        body: "One dot per person, by hours since the movement opened. Show narrows to no ward yet or the longest.",
      },
      {
        device: "phone",
        target: [named("Emergency departments, busiest first", "ul"), id("ward-statistics-eds-population")],
        title: "Every ED",
        body: "Each ED's open journeys, busiest first. Open one for its own figures.",
      },
      {
        device: "desk",
        target: id("ward-statistics-eds-table-card"),
        title: "Every ED",
        body: "Journeys open, no ward yet, longest and median for each ED. Sort by any column.",
      },
      {
        device: "desk",
        target: id("ward-statistics-eds-bands"),
        title: "Time since opening",
        body: "Open movements counted in bands by how long they have been open.",
      },
    ],
  },
  {
    screen: "statistics-teams",
    name: "Community teams statistics",
    keywords: "statistics community teams in a bed caseload",
    page: {
      purpose: "Each community team's patients in a bed, and those with a discharge date.",
      path: /^\/bedchart\/statistics\/teams$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "Teams at a glance",
        body: "Team patients in a bed, those with a discharge date, teams with someone in a bed and people in a bed with no team.",
      },
      statisticsViews,
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
        body: "In a bed lists only teams with someone in a bed. All lists every team.",
      },
      {
        device: "phone",
        target: named("Find a team", "input"),
        title: "Find a team",
        body: "Type a team's name to find it in the list.",
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
      path: /^\/bedchart\/statistics\/weekly$/u,
      needs: "statistics",
    },
    steps: [
      {
        target: [STATISTICS_FIGURES, HERO],
        title: "The week at a glance",
        body: "New long ED waits, out of area bed days, delayed discharge days and occupied bed time that week.",
      },
      statisticsViews,
      {
        target: [id("ward-weekly-week"), named("Week", '[role="radiogroup"]')],
        title: "Choose the week",
        body: "The last full week, this week so far, or on a computer one of the weeks before it.",
      },
      {
        target: card("rd-pilot"),
        title: "Pilot measures",
        body: "The four agreed measures, such as referral to arrival. Targets are still proposals.",
      },
      {
        target: id("ward-pilot-steps"),
        title: "Where the time goes",
        body: "The typical time for each step finished that week, from referral to arrival.",
      },
      {
        target: card("rd-support"),
        title: "Supporting figures",
        body: "Figures that help read the measures. They are not agreed measures.",
      },
      {
        target: card("rd-pressure-week"),
        title: "Pressure this week",
        body: "Long ED waits, out of area days, delayed discharge days and occupied bed time that week.",
      },
      {
        target: [id("ward-weekly-delay-heatmap"), card("rd-pressure-week")],
        title: "Delayed discharge by day",
        body: "Bed days lost to delayed discharge, ward by day.",
      },
      {
        target: [id("ward-weekly-delayed-reasons"), card("rd-pressure-week")],
        title: "Delayed days by reason",
        body: "The same delayed bed days, by the reason recorded.",
      },
      {
        target: card("rd-waits"),
        title: "Long ED waits",
        body: "Each ED wait that first passed the target that week, and whether they are still waiting. Open Waiting for the list now.",
      },
      {
        target: card("rd-decisions"),
        title: "Declines and overrides",
        body: "Placement and referral decisions that week, by reason. Switch between declines and overrides.",
      },
      {
        target: id("ward-weekly-print"),
        title: "Print",
        body: "A paper copy of the week's report, with both declines and overrides.",
      },
    ],
  },
];
