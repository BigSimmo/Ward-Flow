/**
 * HELP HOW-TOS FOR THE DESKS WITH FEW JOBS (Help expansion, 5 Nov 2026): the transport officer, the
 * executive, the access admin, the site bed manager, and the ward, community and ED jobs that were
 * missing. Kept beside `ward-help-howto.ts`, which lists them in `HOW_TOS` after its own jobs, so a
 * question that matches an older job equally well still finds that one first.
 *
 * Each answer is written from the screen's own source, in the button names the screen draws. Show
 * me targets use test ids, ids and accessible text, never class names (`tests/ward-help-howto.test.ts`
 * fails when a test id leaves the source). Nothing here ranks, places or works out a legal time.
 *
 * Fuller walkthroughs (Josh, 15 Nov 2026): each job walks from the control that starts it, through
 * the fields of the sheet or dialog it opens, to Save or Confirm and where the result then shows.
 * Steps after a press name controls that appear only once the person has pressed; Show me never
 * presses for them.
 */
import type { HowTo } from "./ward-help-howto";
import type { TourTarget } from "./ward-tour-steps";
import { CLINICAL_VALUES, formatClinicalFigure } from "@/components/ward-management/ward-clinical-values";

/** The Give button's own words, from the value it grants (D-122: help never types a threshold). */
const GIVE_FOR = `Give for ${formatClinicalFigure(CLINICAL_VALUES.accessGrantDefault.value, CLINICAL_VALUES.accessGrantDefault.unit)}`;

/** A transport officer's open job: the job list, or a phone's Jobs section, stands in. */
const OFFICER_JOB: TourTarget[] = [
  { sel: '[data-testid="ward-officer-joblist"]' },
  { sel: '#main-content section[aria-label="Jobs"]' },
];
/** A tab of the open job's panel (Details, Forms or Activity). */
const officerJobTab = (label: string): TourTarget => ({
  sel: '[data-testid="ward-officer-detail"] [role="tab"]',
  text: label,
});
/** An ED board row's actions: the row's actions button on a computer, the patient's row on a phone. */
export const ED_ROW_ACTIONS: TourTarget[] = [
  { sel: '[data-testid^="ward-ed-unfold-"]' },
  { sel: '[data-testid^="ward-ed-patient-"]' },
];
/** A movement in the list; a phone groups the list by stage, so a stage stands in. */
export const MOVEMENT_ROW: TourTarget[] = [
  { sel: '#main-content a[href^="/bedchart/movements/"]' },
  { sel: '[data-testid^="movements-group-toggle-"]' },
];
const REFERRAL_ROW: TourTarget[] = [
  { sel: '[data-testid^="ward-referral-board-select-"]' },
  { sel: '[data-testid^="ward-referral-board-card-select-"]' },
];
/** A Statistics view's chip in the statistics bar. */
const statisticsView = (label: string): TourTarget => ({
  sel: ':is([data-testid="ward-statistics-nav"], [data-testid="ward-statistics-index"]) :is(a, button)',
  text: label,
});
/** A button in the shared "Are you sure?" dialog, by its label. */
const confirmButton = (label: string): TourTarget => ({ sel: '[data-testid="wf-confirm-dialog"] button', text: label });
/** The ED Lists card on a computer, or the phone's Lists pane. */
const ED_LISTS = '[aria-labelledby="ward-ed-lists-heading"]';

/**
 * The desks with few jobs, and common jobs across desks (Help expansion, 5 Nov 2026). Each answer
 * is written from the screen's own source: the button names are the ones the screen draws.
 */
export const DESK_JOBS: readonly HowTo[] = [
  /* Transport officer */
  {
    id: "officer-arrived",
    topic: "Transport",
    title: "Record arrival at the ward",
    keywords: "arrived delivered handed over drop off dropped destination officer job",
    answer:
      "Open the job and press Mark arrived at ward (Arrived at ward in the job's row), then Record arrival to confirm. The message after it offers Undo until the time shown. The job moves to History, Arrived today, and the receiving ward then confirms the arrival.",
    desks: ["officer"],
    acts: ["PATIENT_ARRIVED"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Your jobs", body: "Each job shows its stage. Select one to open it." },
      {
        target: { sel: '[data-testid="ward-officer-detail"]' },
        title: "The job panel",
        body: "The route, the progress so far, and Details, Forms and Activity. The one next step is pinned at its foot.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-officer-arrive-"]' },
          { sel: '[data-testid^="ward-officer-next-"]', text: "Arrived at ward" },
        ],
        title: "Mark arrived at ward",
        body: "Shows once the patient is collected. If it is greyed, the reason is printed under it.",
      },
      {
        target: confirmButton("Record arrival"),
        title: "Record arrival",
        body: "BedChart names the patient and asks you to confirm. Not yet goes back without recording.",
      },
      {
        target: { sel: '[data-testid="ward-officer-toast-undo"]' },
        title: "Undo",
        body: "In the message at the foot, until the time shown, if you pressed it by mistake.",
      },
      {
        target: { sel: "#ward-officer-jobs-tab-history" },
        title: "Where it goes",
        body: "The job leaves Jobs and shows in History, Arrived today. The receiving ward confirms the arrival.",
      },
    ],
  },
  {
    id: "officer-undo-step",
    topic: "Transport",
    title: "Undo a job step pressed by mistake",
    keywords: "undo wrong step mistake accepted en route collected arrived back officer",
    answer:
      "Each step you record shows a message at the foot of the screen with Undo. Press Undo while it shows and the job goes back as it was; its stage in the list says so. After the message has gone, ask the bed coordinator to correct the record.",
    desks: ["officer"],
    acts: ["UNDO_TRANSPORT_STEP"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-officer-toast-undo"]' },
        title: "Undo",
        body: "Shows in the message just after you record a step, until the time shown.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-stepper-"]' },
        title: "Check the stage",
        body: "After Undo, the job's Stage shows the step before, and its next step button is offered again.",
      },
      {
        target: [{ sel: '[data-testid^="ward-officer-record-"]' }, ...OFFICER_JOB],
        title: "Too late to undo",
        body: "Movement record, at the foot of an open job, shows every step recorded. Ask the bed coordinator to correct it.",
      },
    ],
  },
  {
    id: "officer-divert",
    topic: "Transport",
    title: "Record a diversion",
    keywords: "divert diverted detour redirected another hospital stopped journey officer",
    answer:
      "Once the patient is collected, open the job and press Divert. Under Why divert, choose why the journey was diverted and where the patient is now, then Record diversion. The job then says Diverted, with the reason and place, and asks nothing more of you.",
    desks: ["officer"],
    acts: ["RECORD_DIVERSION"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Open the job", body: "Divert is offered on a job after collection." },
      {
        target: { sel: '[data-testid^="ward-officer-divert-"]' },
        title: "Divert",
        body: "At the foot of the job, from collection until arrival. It opens Why divert on the Details tab.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-diversion-reason-"]' },
        title: "Why was it diverted?",
        body: "Choose the reason from the list.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-diversion-place-"]' },
        title: "Where is the patient now?",
        body: "Choose where the patient is now.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-record-diversion-"]' },
        title: "Record diversion",
        body: "Greyed until both are chosen. Cancel closes the form without saving.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-diverted-"]' },
        title: "Shown on the job",
        body: "The job then says Diverted, with the reason and place. The coordinator or ward releases the bed.",
      },
    ],
  },
  {
    id: "officer-cad",
    topic: "Transport",
    title: "Add the CAD number",
    keywords: "cad number dispatch job reference ambulance number to follow officer",
    answer:
      "When a job says CAD to follow, open it. On Details, type the number in CAD transport number and press Add CAD number. If it cannot be saved, the reason shows under the field. The number then shows on the job for everyone who follows it.",
    desks: ["officer"],
    acts: ["RECORD_TRANSPORT_CAD"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Open the job", body: "Select the job that says CAD to follow." },
      {
        target: [
          { sel: '[data-testid^="ward-officer-cad-to-follow-"]' },
          { sel: '[data-testid^="ward-officer-cad-number-"]' },
        ],
        title: "CAD to follow",
        body: "On Details, under the booking. The warning stays until the provider's number is added.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-cad-to-follow-"] input' },
        title: "CAD transport number",
        body: "Type the number exactly as the provider gave it.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-cad-to-follow-"] button', text: "Add CAD number" },
        title: "Add CAD number",
        body: "Saves it to the job. If the number cannot be saved, the reason shows under the field.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-cad-number-"]' },
        title: "CAD number",
        body: "The number replaces CAD to follow here, for everyone who follows the job.",
      },
    ],
  },
  {
    id: "officer-forms-pack",
    topic: "Transport",
    title: "Check and upload a job's forms",
    keywords: "forms pack upload legal form 4a inspect paperwork fit to travel officer",
    answer:
      "Open the job and choose Forms. The Forms pack shows each form needed and how many are still to upload. Press Upload beside a form, choose which form if asked, choose the file, then Add to pack. Inspect form opens Paperwork checks to tick against the paper.",
    desks: ["officer"],
    acts: ["UPLOAD_PATIENT_FORM"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Open the job", body: "Each job row shows whether forms are still needed." },
      {
        target: officerJobTab("Forms"),
        title: "Forms",
        body: "Its count is the forms still to upload. On Details, the forms line's View opens it too.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-forms-pack-"]' },
        title: "Forms pack",
        body: "Each form needed, with Upload or Replace beside it.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-officer-forms-pack-"] button', text: "Upload" },
          { sel: '[data-testid^="ward-officer-forms-pack-"] button', text: "Replace" },
        ],
        title: "Upload",
        body: "Opens the upload for that form. Replace swaps a form already added.",
      },
      {
        target: { sel: 'label:has(input[aria-label="Form file"])' },
        title: "Choose a file",
        body: "For the legal form, choose which form first. Then choose the PDF or photo of the signed form.",
      },
      {
        target: { sel: '[role="dialog"] button', text: "Add to pack" },
        title: "Add to pack",
        body: "Greyed until a file is chosen. The form then shows as added, with the time.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-inspect-form-"]' },
        title: "Inspect form",
        body: "Opens Paperwork checks for this job.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-check-0-"]', up: 2 },
        title: "Transfer checks",
        body: "Tick each check as you confirm it with the clinical team. They do not establish legal authorisation.",
      },
    ],
  },
  {
    id: "officer-history",
    topic: "Transport",
    title: "See jobs finished today",
    keywords: "history done finished completed delivered refused cancelled jobs today officer",
    answer:
      "On My jobs, choose History. It lists Arrived today, Refused and Cancelled, each with its count. Refused and Cancelled hold this session only. Jobs takes you back to the open jobs.",
    desks: ["officer"],
    go: "home",
    showMe: [
      {
        target: { sel: "#ward-officer-jobs-tab-history" },
        title: "History",
        body: "Beside Jobs. Arrived today, Refused and Cancelled, each with its count.",
      },
      {
        target: { sel: '[role="tablist"][aria-label="History lists"]' },
        title: "Choose a list",
        body: "Arrived today, Refused or Cancelled.",
      },
      {
        target: [{ sel: '[data-testid="ward-officer-delivered"]' }, { sel: "#ward-officer-history-tab-delivered" }],
        title: "Arrived today",
        body: "Each job that arrived today, with the time it arrived.",
      },
      {
        target: { sel: "#ward-officer-history-tab-refused" },
        title: "Refused",
        body: "Jobs refused this session. This session only.",
      },
      {
        target: { sel: "#ward-officer-history-tab-cancelled" },
        title: "Cancelled",
        body: "Transport cancelled this session. This session only.",
      },
      {
        target: { sel: "#ward-officer-jobs-tab-jobs" },
        title: "Back to Jobs",
        body: "Open jobs stay on Jobs until they arrive or their movement closes.",
      },
    ],
  },
  {
    id: "officer-copy-handover",
    topic: "Transport",
    title: "Copy the transport handover",
    keywords: "copy handover end of shift summary open jobs paste officer",
    answer:
      "Press Copy for handover, in the actions under the figures at the top. It copies a plain text summary of every open job, starting with a line that says the records are synthetic. Paste it where your handover goes.",
    desks: ["officer"],
    go: "home",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Copy for handover" },
        title: "Copy for handover",
        body: "Copies each open job's route, provider, ETA and forms, ready to paste.",
      },
      {
        target: OFFICER_JOB,
        title: "What it copies",
        body: "Every open job: patient, route, stage, provider, escort, ETA and forms. A message says how many were copied.",
      },
    ],
  },

  /* Executive */
  {
    id: "executive-capacity",
    topic: "Beds and referrals",
    title: "See beds ready across the network",
    keywords: "occupancy beds ready free in use closed wards counts executive",
    answer:
      "Open Capacity. It shows beds ready of the total, being made ready, in use and closed, then each health service, then Beds by ward grouped by service, with a row of bed squares. Bed counts only, with no patient details, as at the time shown.",
    desks: ["executive"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid="ward-capacity-executive-as-at"]' },
        title: "As at",
        body: "The time the counts were taken.",
      },
      {
        target: { sel: '[data-testid="ward-capacity-executive-figures"]' },
        title: "Network beds",
        body: "Ready of the total, being made ready, in use and closed, across your view.",
      },
      {
        target: { sel: '[data-testid="ward-capacity-executive-services"]' },
        title: "By service",
        body: "Each health service: beds ready, in use and closed.",
      },
      {
        target: [
          { sel: '[data-testid="ward-capacity-executive"] table' },
          { sel: '[data-testid="ward-capacity-executive-list"]' },
        ],
        title: "Beds by ward",
        body: "Ready, being made ready, in use, closed and beds for each ward, grouped by service.",
      },
      {
        target: { sel: '[data-testid="ward-capacity-executive-key"]' },
        title: "Bed squares key",
        body: "What each colour of bed square means.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="ward-capacity-executive-total"]' },
        title: "Totals",
        body: "The foot of the table adds up every ward, including those under Show all.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-capacity-executive-list"] h3 button' },
        title: "Open a service",
        body: "Tap a service to open or fold its wards. Later services start folded.",
      },
    ],
  },
  {
    id: "statistics-compare",
    topic: "Handover and reports",
    title: "Compare wards in the statistics",
    keywords: "compare wards side by side pin network statistics figures",
    answer:
      "Open Statistics, then Compare. On a computer, choose a measure for the ward and ED charts, and Pin a ward to set up to three beside the network. On a phone, choose Wards or EDs and a measure, then Compare two wards. Every figure is from synthetic records.",
    desks: ["executive", "coordinator"],
    go: "statistics",
    showMe: [
      { target: statisticsView("Compare"), title: "Compare", body: "In the statistics bar." },
      {
        device: "desk",
        target: { sel: '[data-testid="statistics-compare-ward-chart"]' },
        title: "Ward comparison",
        body: "Each ward against the mean of wards. Choose the measure, Graph or Table, and filter by name or group.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="statistics-compare-ed-chart"]' },
        title: "ED comparison",
        body: "Each ED on the measure you choose, against the mean of EDs.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="ward-statistics-compare-pinned"]' },
        title: "Pin a ward",
        body: "Up to three pinned wards sit beside the network.",
      },
      {
        device: "desk",
        target: { sel: '[data-testid="ward-statistics-compare-pinned"] button', text: "Pin a ward" },
        title: "Choose the ward",
        body: "Opens the ward list. Unpin or Clear takes wards off again.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-statistics-compare-phone"] [role="radiogroup"][aria-label="Compare"]' },
        title: "Wards or EDs",
        body: "Choose what to compare.",
      },
      {
        device: "phone",
        target: {
          sel: '[data-testid="ward-statistics-compare-phone"] :is([aria-label="Ward measure"], [aria-label="Department measure"])',
        },
        title: "Choose a measure",
        body: "One measure at a time.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-statistics-compare-phone-chart"]' },
        title: "The bars",
        body: "Highest first, against the network mean.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-statistics-compare-phone-pinned"]' },
        title: "Compare two wards",
        body: "Opens two wards side by side, each measure against the network mean of wards.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-statistics-compare-pair"]' },
        title: "Ward A and Ward B",
        body: "Choose the two wards. The choice stays when the sheet closes.",
      },
    ],
  },
  {
    id: "statistics-weekly",
    topic: "Handover and reports",
    title: "Read the weekly report",
    keywords: "weekly report week pilot measures operations print summary",
    answer:
      "Open Statistics, then Weekly. Choose the week, then read Pilot measures (the four agreed measures; the two counted outside BedChart say so), Where the time goes, Supporting figures and the pressure figures (in the band on a computer, Pressure this week on a phone). How this is counted explains each one. Print prints the report.",
    desks: ["executive", "coordinator"],
    go: "statistics",
    showMe: [
      { target: statisticsView("Weekly"), title: "Weekly", body: "The last view in the statistics bar." },
      {
        target: [
          { sel: '[data-testid="ward-weekly-week"]' },
          { sel: '[data-testid="ward-weekly-phone"] [role="radiogroup"][aria-label="Week"]' },
        ],
        title: "Choose the week",
        body: "It opens on the last full week. Choose another, or this week so far.",
      },
      {
        target: { sel: '[aria-labelledby="rd-pilot"]' },
        title: "Pilot measures",
        body: "The four agreed measures. Two are counted outside BedChart, and say so.",
      },
      {
        target: { sel: '[aria-labelledby="rd-pilot"] summary' },
        title: "How this is counted",
        body: "Opens how each figure is worked out. Each card has one.",
      },
      {
        target: { sel: '[aria-labelledby="rd-time"]' },
        title: "Where the time goes",
        body: "The typical time for each step, with the longest step named.",
      },
      {
        target: { sel: '[aria-labelledby="rd-support"]' },
        title: "Supporting figures",
        body: "Figures that are not agreed measures, each with its rate.",
      },
      {
        // Audit two #98: a computer shows these four as the band's figures; a phone keeps the card.
        target: [{ sel: '[aria-labelledby="rd-pressure-week"]' }, { sel: "#main-content section[aria-labelledby]" }],
        title: "Pressure this week",
        body: "ED waits, out of area, delayed discharge and recorded occupied bed time. On a computer they are the band's figures.",
      },
      {
        target: { sel: '[aria-labelledby="rd-decisions"]' },
        title: "Declines and overrides",
        body: "Counts by reason. Show switches between declines and overrides.",
      },
      {
        target: { sel: '[data-testid="ward-weekly-print"]' },
        title: "Print",
        body: "Prints the report with its exact period and when it was made.",
      },
    ],
  },

  /* Access admin */
  {
    id: "answer-access-request",
    topic: "Settings and display",
    title: "Answer a request for access",
    keywords: "request access approve decline asked waiting new starter admin",
    answer: `Settings, Access, Requests for access: each request says who asked, for which desk and place, and when. Press ${GIVE_FOR} or Decline. A line above the cards says what was done, and a given role shows under Everyone with a role. Nobody grants themselves a role.`,
    desks: ["admin"],
    go: "settings#access",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-access-requests"]' },
          { sel: '[data-testid="ward-settings-phone-area-access"]' },
        ],
        title: "Requests for access",
        body: `${GIVE_FOR} or Decline, for each request.`,
      },
      {
        target: { sel: '[data-testid="ward-access-requests"] button', text: "Give for" },
        title: GIVE_FOR,
        body: "Gives the role asked for, with that end date.",
      },
      {
        target: { sel: '[data-testid="ward-access-requests"] button', text: "Decline" },
        title: "Decline",
        body: "Turns the request down. It leaves the list.",
      },
      {
        target: { sel: '[data-testid="ward-access-result"]' },
        title: "What was done",
        body: "Says what was given or declined.",
      },
      {
        target: { sel: '[data-testid="ward-access-roles"]' },
        title: "Everyone with a role",
        body: "A given role shows here with its end date.",
      },
    ],
  },
  {
    id: "remove-role",
    topic: "Settings and display",
    title: "End someone's role",
    keywords: "remove revoke end role leaver access take away admin",
    answer:
      "Settings, Access, Everyone with a role: press Remove on the person's row, then Remove role to confirm. They lose that access straight away, and a line above the cards says what was removed. Your own row has no Remove.",
    desks: ["admin"],
    go: "settings#access",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-access-roles"]' },
          { sel: '[data-testid="ward-settings-phone-area-access"]' },
        ],
        title: "Everyone with a role",
        body: "Each role with its end date. Remove asks before it ends a role.",
      },
      {
        target: { sel: '[data-testid="ward-access-role-remove"]' },
        title: "Remove",
        body: "On each row but your own.",
      },
      {
        target: confirmButton("Remove role"),
        title: "Remove role",
        body: "Names the role and the person. They lose this access straight away.",
      },
      {
        target: { sel: '[data-testid="ward-access-result"]' },
        title: "What was removed",
        body: "Says which role was removed.",
      },
    ],
  },
  {
    id: "access-log",
    topic: "Settings and display",
    title: "See who opened a record",
    keywords: "access log audit who looked opened viewed record privacy admin",
    answer:
      "Governance, Audit trail, Access log lists record openings by desks in your place, newest first. Records show by id only. Type a record id or account in Find to narrow it, or press Break glass to show only break glass openings.",
    desks: ["admin"],
    go: "governance?tab=audit",
    showMe: [
      {
        target: [{ sel: '[data-testid="ward-access-log"]' }, { sel: '[data-testid="ward-governance-phone"]' }],
        title: "Access log",
        body: "Find a record id or account to narrow the list.",
      },
      {
        target: { sel: '[data-testid="ward-access-log"] input' },
        title: "Find a record id or account",
        body: "Type part of a record id or account name.",
      },
      {
        target: { sel: '[data-testid="ward-access-log"] button', text: "Break glass" },
        title: "Break glass",
        body: "Shows only break glass openings. Press again to show all.",
      },
      {
        target: { sel: '[data-testid="ward-access-log-row"]' },
        title: "Each opening",
        body: "Who opened which record id, and when. A break glass opening shows its reason.",
      },
    ],
  },
  {
    id: "governance-review",
    topic: "Handover and reports",
    title: "Look through the audit trail",
    keywords: "governance audit review overrides refused record access trail admin",
    answer:
      "Open Governance. Review lists events waiting for review, newest first: overrides, steps not saved and record access. Select one to see its facts, then press Reviewed, or Follow-up if it needs more. Audit trail lists what has been reviewed.",
    desks: ["admin"],
    go: "governance",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-governance-workbench"]' },
          { sel: '[data-testid="ward-governance-phone"]' },
        ],
        title: "Review and Audit trail",
        body: "Choose a view in the bar at the top. Records show by id only.",
      },
      {
        target: { sel: '[data-testid="ward-governance-review-next"]' },
        title: "Open newest",
        body: "Opens the newest event waiting for review.",
      },
      {
        target: { sel: '[data-testid="ward-governance-tabs"]' },
        title: "Governance views",
        body: "Review holds what waits; Audit trail holds what has been reviewed.",
      },
      {
        device: "desk",
        target: { sel: '[role="radiogroup"][aria-label="Show in the review list"]' },
        title: "Show in the review list",
        body: "All, Overrides, Steps not saved, or Record access. Every row stays; the others dim.",
      },
      {
        target: [
          { sel: "[data-audit-row]" },
          { sel: '[data-testid="ward-governance-phone"] [aria-label="Waiting for review"] li' },
        ],
        title: "Choose an event",
        body: "Opens its facts beside the list.",
      },
      {
        target: { sel: '[data-testid="ward-governance-decision-record"]' },
        title: "Reviewed or Follow-up",
        body: "Reviewed records your review. Follow-up keeps it under Review as needing follow-up.",
      },
      {
        target: { sel: '[data-testid="ward-governance-tabs"] button', text: "Audit trail" },
        title: "Audit trail",
        body: "Each reviewed event, with who reviewed it and when.",
      },
    ],
  },

  /* Site bed manager (and the coordinator, where the same control serves both) */
  {
    id: "close-bed-or-ward",
    topic: "Beds and referrals",
    title: "Close a bed or a ward to admissions",
    keywords: "close bed ward closed admissions shut reopen out of action maintenance",
    answer:
      "On Capacity, open the ward, then press Close a bed or ward at the foot of its panel. To close a bed, choose a bed nobody is in and why, then Close bed. To close the ward, choose a reason under Close the whole ward to admissions and confirm. When ready, press Reopen ward in the same place.",
    desks: ["bed_manager", "coordinator"],
    acts: ["SET_BED_CLOSED", "CLOSE_WARD_TO_ADMISSIONS"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid^="capacity-map-ward-"]' },
        title: "Open the ward",
        body: "Its panel opens with the ward's beds and discharges.",
      },
      {
        target: { sel: "button", text: "Close a bed or ward" },
        title: "Close a bed or ward",
        body: "The quiet last button at the foot. A last resort.",
      },
      {
        target: { sel: '[data-testid="capacity-ward-closures"] [role="group"][aria-label="Empty beds"]' },
        title: "Which bed",
        body: "Only empty beds are offered.",
      },
      {
        target: { sel: '[data-testid="capacity-ward-closures"] [role="group"][aria-label="Reason"]' },
        title: "Why",
        body: "Choose why the bed is closed.",
      },
      {
        target: { sel: '[data-testid="capacity-close-bed-review"]' },
        title: "Review in",
        body: "Optional: when to look at it again.",
      },
      {
        target: [
          { sel: '[data-testid="capacity-ward-closures"] button', text: "Close bed" },
          { sel: '[data-testid="capacity-ward-closures"] button', text: "Choose a bed" },
        ],
        title: "Close bed",
        body: "Closes it now. It then shows as closed here, with a button to reopen it.",
      },
      {
        target: { sel: '[data-testid="ward-closure-panel"]' },
        title: "Close the whole ward",
        body: "Choose the reason and when it is expected to reopen. BedChart asks again before it closes the ward.",
      },
    ],
  },
  {
    id: "site-sign-off",
    topic: "Handover and reports",
    title: "Sign off the site handover",
    keywords: "site handover sign off bed manager shift end checks",
    answer:
      "On Handover, the Site handover card shows each ward's sign-off, read only, and the checks before you sign, each with a link to where it is done. Press Sign off at (the time shown) when the checks allow. Undo sign-off shows afterwards.",
    desks: ["bed_manager"],
    acts: ["RECORD_SITE_HANDOVER_SIGN_OFF"],
    go: "handover",
    showMe: [
      {
        target: { sel: '[data-testid="ward-handover-site-checks"]' },
        title: "Before you sign",
        body: "Each check, with a link to where it is done.",
      },
      {
        target: { sel: '[data-testid="ward-handover-site-wards"]' },
        title: "Ward sign-offs",
        body: "Read only. Each ward signs its own. Open handover goes to that ward's handover.",
      },
      {
        target: { sel: '[data-testid="ward-handover-site-sign-off-button"]' },
        title: "Sign off",
        body: "Records the site sign-off with the time. Each ward still signs its own.",
      },
      {
        target: { sel: '[data-testid="ward-handover-site-signed"]' },
        title: "Signed off",
        body: "Says when you signed, and any ward or bed call not yet done then. It is kept in History.",
      },
      {
        target: { sel: '[data-testid="ward-handover-site-undo"]' },
        title: "Undo sign-off",
        body: "Shows once signed, if you need to take it back.",
      },
    ],
  },
  {
    id: "planned-admission",
    topic: "Beds and referrals",
    title: "Book a planned admission",
    keywords: "planned admission booking elective scheduled book in arrival date",
    answer:
      "On Capacity, open the Planned tab and press Book. Choose an existing patient or enter initials, age group and sex, then the reason, ward, day, arrival time, expected stay and legal status. Press Book. The booking shows in the list; its More menu holds Change booking and Cancel booking.",
    desks: ["bed_manager", "coordinator"],
    acts: ["BOOK_PLANNED_ADMISSION"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid="ward-planned-book"]' },
        title: "Book",
        body: "Opens the booking form on the Planned tab.",
      },
      {
        target: { sel: '[data-testid="ward-planned-who"]' },
        title: "Patient",
        body: "An existing patient, or Initials only for someone not yet in BedChart.",
      },
      {
        target: [{ sel: '[data-testid="ward-planned-patient"]' }, { sel: '[data-testid="ward-planned-initials"]' }],
        title: "Who is coming",
        body: "Choose the patient, or type initials, then choose the age group and recorded sex.",
      },
      {
        target: { sel: '[data-testid="ward-planned-reason"]' },
        title: "Reason",
        body: "Why the admission is planned.",
      },
      {
        target: { sel: '[data-testid="ward-planned-unit"]' },
        title: "Ward",
        body: "Wards are grouped by health service.",
      },
      {
        target: { sel: '[data-testid="ward-planned-day"]' },
        title: "Day and arrival time",
        body: "Choose the day, then type the arrival time, like 2:40 pm or 14:40.",
      },
      {
        target: { sel: '[data-testid="ward-planned-stay"]' },
        title: "Expected stay",
        body: "How many days the stay is expected to last.",
      },
      {
        target: { sel: '[data-testid="ward-planned-legal"]' },
        title: "Legal status",
        body: "As recorded for the patient.",
      },
      {
        target: { sel: '[data-testid="ward-planned-submit"]' },
        title: "Book",
        body: "Greyed with its reason until the form is complete. If an override reason is asked for, choose one first.",
      },
      {
        target: { sel: 'ul[aria-label="Booked planned admissions"]' },
        title: "Booked",
        body: "Each booking, in date order. More on a booking holds Change booking and Cancel booking.",
      },
    ],
  },
  {
    id: "send-bed-call",
    topic: "Beds and referrals",
    title: "Send a bed call or broadcast alert",
    keywords: "bed call ask wards beds message all desks announce",
    answer:
      "On Alerts, press Broadcast alert. Choose Ask wards for beds or Tell desks something, then who gets it, how urgent, a title and message, and when it ends. Check What each desk sees, tick I'm authorised, then Send. Wards answer Can take, After a discharge or Can't.",
    desks: ["bed_manager", "coordinator"],
    acts: ["DISPATCH_BROADCAST_ALERT"],
    needs: "alerts",
    go: "alerts",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Broadcast alert" },
        title: "Broadcast alert",
        body: "In the Alerts header. It opens New broadcast.",
      },
      {
        target: { sel: '[role="radiogroup"][aria-label="Broadcast type"]' },
        title: "What do you need?",
        body: "Ask wards for beds, or Tell desks something. Start from offers a message to begin with.",
      },
      {
        target: { sel: '[role="radiogroup"][aria-label="Audience"]' },
        title: "Who gets it",
        body: "Everyone, By group, or Choose desks. The number of desks shows beside the heading.",
      },
      {
        target: { sel: '[role="radiogroup"][aria-label="Severity"]' },
        title: "How urgent",
        body: "Advisory, Warning or Critical. The line under it says what each is for.",
      },
      {
        target: { sel: "#alerts-broadcast-title" },
        title: "Title and message",
        body: "A short, specific title, then what desks should do.",
      },
      {
        target: { sel: '[role="radiogroup"][aria-label="Ends after"]' },
        title: "Ends after",
        body: "It ends then, or when you stand it down.",
      },
      {
        target: { sel: 'aside[aria-label="Preview"]' },
        title: "What each desk sees",
        body: "Check the preview and who it goes to.",
      },
      {
        target: { sel: "label:has(#alerts-broadcast-safeguard)" },
        title: "I'm authorised",
        body: "Tick to confirm you may send to that many desks.",
      },
      {
        target: { sel: '[data-testid="ward-alerts-broadcast-confirm"]' },
        title: "Send",
        body: "Says how many desks it goes to. Check the preview first.",
      },
    ],
  },
  {
    id: "seclusion-room-status",
    topic: "Beds and referrals",
    title: "Mark the seclusion room available or out of service",
    keywords: "seclusion room available out of service broken repair status",
    answer:
      "Open Seclusion and choose the ward. Under Seclusion room, press Mark available or Mark out of service, then confirm. Everyone sees the status, and when it was last marked, until it is marked again.",
    desks: ["bed_manager", "ward", "coordinator"],
    acts: ["SET_SECLUSION_ROOM_STATUS"],
    go: "seclusion",
    showMe: [
      {
        target: { sel: '[data-testid^="seclusion-ward-row-"]' },
        title: "Choose the ward",
        body: "Each ward with its room status.",
      },
      {
        target: { sel: '[data-testid="seclusion-room-status"]' },
        title: "Seclusion room",
        body: "How the room is marked now, and when it was last marked.",
      },
      {
        target: [
          { sel: '[data-testid="seclusion-room-available"]' },
          { sel: '[data-testid="seclusion-room-out-of-service"]' },
        ],
        title: "Mark the room",
        body: "Mark available or Mark out of service. It asks before it saves.",
      },
      {
        target: { sel: '[data-testid="seclusion-room-confirm"]' },
        title: "Confirm",
        body: "Check the ward, then confirm. Cancel leaves it as it was.",
      },
    ],
  },

  /* Ward */
  {
    id: "answer-bed-call",
    topic: "Beds and referrals",
    title: "Answer a bed call",
    keywords: "bed call broadcast reply respond can take after discharge cant banner",
    answer:
      "A bed call shows as a banner at the top of the screen. Press Can take and choose how many beds, After a discharge and choose when a bed will be ready, or Can't. Back returns to the three answers. The coordinator sees each ward's answer.",
    desks: ["ward"],
    acts: ["REPLY_BROADCAST_ALERT"],
    showMe: [
      {
        target: { sel: '[data-testid="ward-broadcast-banner"]' },
        title: "The bed call",
        body: "Shows on every screen while it is live.",
      },
      {
        target: { sel: '[role="group"][aria-label="Your answer"]' },
        title: "Your answer",
        body: "Can take, After a discharge or Can't.",
      },
      {
        target: { sel: '[role="group"][aria-label="How many beds can you take"]' },
        title: "How many beds",
        body: "After Can take, choose the number of beds. The answer is sent when you choose.",
      },
      {
        target: { sel: '[role="group"][aria-label="When will a bed be ready"]' },
        title: "Ready at",
        body: "After After a discharge, choose when a bed will be ready.",
      },
    ],
  },

  /* Community team */
  {
    id: "record-team-contact",
    topic: "Beds and referrals",
    title: "Record a team contact",
    keywords: "contact clinical contact record team touch base timestamp community",
    answer:
      "On My team, press Record contact, then Save contact. It logs a team-level contact time for your team in this session, and the dialog shows the newest one. It is not a clinical note.",
    desks: ["community"],
    acts: ["RECORD_CLINICAL_CONTACT"],
    go: "home",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Record contact" },
        title: "Record contact",
        body: "Beside the team's sections, or in the team's actions on a phone.",
      },
      {
        target: { sel: '[data-testid="ward-community-contact-save-status"]' },
        title: "Last confirmed",
        body: "When contact was last confirmed for this team in this session.",
      },
      {
        target: { sel: '[data-testid="ward-community-contact-save"]' },
        title: "Save contact",
        body: "Shows when the contact was last confirmed in this session.",
      },
      {
        target: { sel: '[data-testid="community-top-last-contact"]' },
        title: "Where it shows",
        body: "The time of the newest contact shows beside Record contact.",
      },
    ],
  },
  {
    id: "record-cto",
    topic: "Beds and referrals",
    title: "Record a community treatment order",
    keywords: "cto community treatment order form 5a record ended order",
    answer:
      "Find the patient and open their record, then the Community tab. In the Community treatment order card press Record CTO. When the order ends, press Record ended there. Each records straight away, and its message offers Undo.",
    desks: ["community"],
    acts: ["RECORD_COMMUNITY_TREATMENT_ORDER", "END_COMMUNITY_TREATMENT_ORDER"],
    needs: "search",
    showMe: [
      { target: { sel: "#pntab-community" }, title: "Community tab", body: "On the patient's record." },
      {
        target: { sel: '[aria-label="Community treatment order"]' },
        title: "Community treatment order",
        body: "The order recorded now, if any, and earlier orders.",
      },
      {
        target: [
          { sel: "#main-content button", text: "Record CTO" },
          { sel: "#main-content button", text: "Record ended" },
        ],
        title: "Record CTO",
        body: "Record ended shows here once an order is recorded.",
      },
    ],
  },
  {
    id: "take-referral",
    topic: "Beds and referrals",
    title: "Take a referral as your desk",
    keywords: "take own assign owner follow up referral mine",
    answer:
      "Open the referral on Referrals, then its Patient tab (on a phone, Show patient details) and Owner and calls. The Owner line says who follows it up, or Not assigned. Press Take this referral. The Owner line then names your desk, with the time, so others know who is following it up.",
    desks: ["ed", "community"],
    acts: ["ASSIGN_REFERRAL"],
    go: "referrals",
    showMe: [
      { target: REFERRAL_ROW, title: "Open the referral", body: "The owner and calls sit in its panel." },
      {
        target: [
          { sel: '[role="tablist"][aria-label="Referral detail"] [role="tab"]', text: "Patient" },
          { sel: "button[aria-expanded]", text: "Show patient details" },
        ],
        title: "Patient details",
        body: "On a computer, press the Patient tab. On a phone, press Show patient details.",
      },
      {
        target: { sel: "button[aria-expanded]", text: "Owner and calls" },
        title: "Owner and calls",
        body: "Near the foot of the referral's Patient tab. Press it to open the owner and the calls.",
      },
      {
        target: { sel: 'p[data-testid^="ward-referral-owner-"]' },
        title: "Owner",
        body: "Who follows it up now, or Not assigned.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-assign-"]' },
        title: "Take this referral",
        body: "Names your desk as the owner. If it is greyed, the reason shows beside it.",
      },
    ],
  },
  {
    // The same job as the coordinator's "log-call", for the desks that follow their own referrals.
    id: "log-call-desk",
    topic: "Beds and referrals",
    title: "Log a call",
    keywords: "phone rang rung follow up callback",
    answer:
      "Open the referral on Referrals, then its Patient tab (on a phone, Show patient details) and Owner and calls. Under Log a call, choose who was rung and what they said, then press Log a call. The call is listed, newest first. A call does not answer the referral: the decision time keeps running.",
    desks: ["ed", "community"],
    acts: ["LOG_REFERRAL_CONTACT"],
    go: "referrals",
    showMe: [
      { target: REFERRAL_ROW, title: "Open the referral", body: "Log a call is in the referral's panel." },
      {
        target: [
          { sel: '[role="tablist"][aria-label="Referral detail"] [role="tab"]', text: "Patient" },
          { sel: "button[aria-expanded]", text: "Show patient details" },
        ],
        title: "Patient details",
        body: "On a computer, press the Patient tab. On a phone, press Show patient details.",
      },
      {
        target: { sel: "button[aria-expanded]", text: "Owner and calls" },
        title: "Owner and calls",
        body: "Near the foot of the referral's Patient tab. Press it to open the owner and the calls.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-call-who-"]' },
        title: "Who was rung",
        body: "The referrer, a ward or a community team.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-call-outcome-"]' },
        title: "What they said",
        body: "Choose the answer you were given.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-call-log-"]' },
        title: "Log a call",
        body: "Choose who was rung and what they said, then Log a call.",
      },
      {
        target: { sel: '[data-testid^="ward-referral-calls-"]' },
        title: "Calls logged",
        body: "Newest first, with who logged each call and when.",
      },
    ],
  },

  /* Emergency department */
  {
    id: "ed-mark-arrived",
    topic: "Beds and referrals",
    title: "Mark an expected patient as arrived",
    keywords: "arrived expected expects here in department turned up came in ed",
    answer:
      "Under Lists, choose Expected, find the patient and press Mark arrived. On a phone, open Lists, then the Expects tab, and press Mark arrived in department. Use it once the person is in your department.",
    desks: ["ed"],
    acts: ["RECORD_ARRIVED_IN_DEPARTMENT"],
    go: "home",
    showMe: [
      {
        target: [{ sel: '[aria-labelledby="ward-ed-lists-heading"]' }, { sel: "#ward-ed-expected-tab" }],
        title: "Expected",
        body: "People referred to your ED who have not arrived yet.",
      },
      {
        device: "desk",
        target: { sel: `${ED_LISTS} [role="radiogroup"][aria-label="Lists"] button`, text: "Expected" },
        title: "Choose Expected",
        body: "Its count is the people not yet in the department.",
      },
      {
        device: "phone",
        target: { sel: "#ward-ed-expected-tab" },
        title: "Expects",
        body: "Accepted referrals stay here until arrival is marked.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-expects-arrived-"]' },
          { sel: "#main-content button", text: "Mark arrived" },
        ],
        title: "Mark arrived",
        body: "Records the time they arrived in the department.",
      },
    ],
  },
  {
    id: "ed-medical-clearance",
    topic: "Beds and referrals",
    title: "Record medical clearance",
    keywords: "medically cleared clearance fit medical review ed",
    answer:
      "Under Lists, Awaiting review, press Show referral (Open referral in the inbox) on the new referral, then Record medically cleared or Record not medically cleared. On a phone it is Lists, then Review. It records what the team found, with the time, beside Medically cleared.",
    desks: ["ed"],
    acts: ["RECORD_MEDICAL_CLEARANCE"],
    go: "home",
    showMe: [
      {
        target: [{ sel: '[aria-labelledby="ward-ed-lists-heading"]' }, { sel: "#ward-ed-cleared-tab" }],
        title: "Awaiting review",
        body: "Each referral says whether clearance is recorded.",
      },
      {
        target: [
          { sel: `${ED_LISTS} button`, text: "Show referral" },
          { sel: '[data-testid="ward-ed-inbox"] button', text: "Open referral" },
        ],
        title: "Show referral",
        body: "Opens the referral in place, with Medically cleared and the buttons to record it.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-inbox-clearance-yes-"]' },
          { sel: "#main-content button", text: "Record medically cleared" },
        ],
        title: "Record medically cleared",
        body: "Or Record not medically cleared, beside it.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-inbox-clearance-no-"]' },
          { sel: "#main-content button", text: "Record not medically cleared" },
        ],
        title: "Record not medically cleared",
        body: "When the team found the person is not medically cleared.",
      },
      {
        device: "phone",
        target: { sel: '[data-testid="ward-ed-inbox"] [data-testid^="ward-ed-inbox-clearance-"]' },
        title: "Medically cleared",
        body: "Then says Yes or No, with the time it was recorded.",
      },
    ],
  },
  {
    id: "ed-examination",
    topic: "Beds and referrals",
    title: "Record an examination",
    keywords: "examination exam assessed inpatient treatment order no order made revoked further ed",
    answer:
      "Open the patient's actions on My ED board and choose Record examination. In Examination outcome, choose Inpatient treatment order, Community treatment order, No order made, does not proceed, or Further examination ordered, then Save outcome. None is chosen for you.",
    desks: ["ed"],
    acts: ["RECORD_EXAMINATION"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "The patient's actions",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-examine-toggle-"]' },
          { sel: '[data-testid^="ward-ed-next-"]', text: "Record exam" },
          { sel: '[role="dialog"] button', text: "Record exam" },
          { sel: "button[aria-expanded]", text: "Not available yet" },
        ],
        title: "Record examination",
        body: "Opens the four outcomes. Save outcome records the one chosen. When it is the next step it reads Record exam.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-examine-form-"] fieldset' },
        title: "Examination outcome",
        body: "Choose the outcome the examination reached. The person, UMRN and form are named above.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-examine-save-"]' },
        title: "Save outcome",
        body: "Greyed until an outcome is chosen. Cancel closes without saving.",
      },
    ],
  },
  {
    id: "ed-outcome",
    topic: "Beds and referrals",
    title: "Record the ED outcome",
    keywords: "outcome discharge home community follow up end bed search no longer needs bed ed",
    answer:
      "Open the patient's actions and choose Record outcome: For discharge or For community follow-up. Each asks again, naming the person. It ends the bed search. The patient stays on the board until Left the department is recorded.",
    desks: ["ed"],
    acts: ["RECORD_ED_OUTCOME"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "The patient's actions",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-outcome-toggle-"]' },
          { sel: '[role="dialog"] button', text: "Record outcome" },
          { sel: "button[aria-expanded]", text: "Not available yet" },
        ],
        title: "Record outcome",
        body: "Live ward requests are withdrawn, a pulled bed is released and uncollected transport is cancelled.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-outcome-discharge-"]' },
          { sel: '[data-testid^="ward-ed-outcome-community-"]' },
        ],
        title: "For discharge or community",
        body: "For discharge or For community follow-up. A greyed choice prints its reason underneath.",
      },
      {
        target: { sel: '[role="dialog"][data-testid^="ward-ed-outcome-"]' },
        title: "Check and confirm",
        body: "Names the person and UMRN. Press the outcome again to record it, or Cancel.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-mark-left-"]' },
        title: "Left the department",
        body: "The patient stays on the board until you record this.",
      },
    ],
  },
  {
    id: "ed-left-department",
    topic: "Beds and referrals",
    title: "Mark that a patient left the department",
    keywords: "left department gone discharged off board remove ed",
    answer:
      "After the outcome is recorded, open the patient and press Left the department. BedChart names the person and UMRN; press Left the department again to confirm. It takes them off your board and cannot be undone there.",
    desks: ["ed"],
    acts: ["RECORD_LEFT_DEPARTMENT"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "Open the patient",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-mark-left-"]' },
        title: "Left the department",
        body: "Asks again, naming the person, before it records.",
      },
      {
        target: { sel: '[role="dialog"][data-testid^="ward-ed-mark-left-"]' },
        title: "Check and confirm",
        body: "Check the name and UMRN, then press Left the department. Cancel keeps them on the board.",
      },
    ],
  },
  {
    id: "ed-refer-community",
    topic: "Beds and referrals",
    title: "Refer to a community team",
    keywords: "cmht community team refer follow up outpatient ed",
    answer:
      "Open the patient's actions and choose Refer to a community team. Choose the team (the team for the recorded home suburb is listed first) and what the referral is for, then Confirm CMHT referral. No bed is requested.",
    desks: ["ed"],
    acts: ["REFER_TO_COMMUNITY_TEAM"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "The patient's actions",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: [
          { sel: '[data-testid^="ed-refer-cmht-"]' },
          { sel: "button[aria-expanded]", text: "Not available yet" },
        ],
        title: "Refer to a community team",
        body: "Choose the team and the purpose, then confirm. Not offered yet? Not available yet lists each action with its reason.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-cmht-panel-"]' },
        title: "Community team referral",
        body: "Shows the legal status as recorded. No bed is requested.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-cmht-select-"]' },
        title: "Community team",
        body: "The team for the recorded home suburb is listed first.",
      },
      {
        target: { sel: 'fieldset[data-testid^="ward-ed-cmht-purpose-"]' },
        title: "What is the referral for?",
        body: "Choose one.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-cmht-confirm-"]' },
        title: "Confirm CMHT referral",
        body: "Greyed until a team and purpose are chosen.",
      },
    ],
  },
  {
    id: "ed-withdraw-referral",
    topic: "Beds and referrals",
    title: "Withdraw a referral",
    keywords: "withdraw cancel referral no longer needs bed stop search ed",
    answer:
      "Open the patient's actions and choose Withdraw referral, then press Withdraw referral again to confirm, or Keep the referral. It says the patient no longer needs a bed: live referrals are withdrawn, a pulled bed is released and the movement closes. The row then says Withdrawn.",
    desks: ["ed"],
    acts: ["WITHDRAW_REFERRAL"],
    go: "home",
    showMe: [
      {
        target: ED_ROW_ACTIONS,
        title: "The patient's actions",
        body: "At the end of each board row. On a phone, tap the patient.",
      },
      {
        target: [
          { sel: '[data-testid^="ward-ed-withdraw-referral-toggle-"]' },
          { sel: "button[aria-expanded]", text: "Not available yet" },
        ],
        title: "Withdraw referral",
        body: "Asks before it withdraws. There is no undo for a withdrawal. Not offered yet? Not available yet says why.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-withdraw-referral-confirm-"]', up: 2 },
        title: "Check it",
        body: "Says how many live referrals it withdraws, and that it cannot be undone.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-withdraw-referral-confirm-"]' },
        title: "Withdraw referral",
        body: "Records it. Keep the referral closes this without change.",
      },
      {
        target: { sel: '[data-testid^="ward-ed-withdrawn-reason-"]' },
        title: "Withdrawn",
        body: "The row then says Withdrawn, with the reason. Nothing more is recorded on it.",
      },
    ],
  },
];
