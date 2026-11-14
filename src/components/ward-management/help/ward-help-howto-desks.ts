/**
 * HELP HOW-TOS FOR THE DESKS WITH FEW JOBS (Help expansion, 5 Nov 2026): the transport officer, the
 * executive, the access admin, the site bed manager, and the ward, community and ED jobs that were
 * missing. Kept beside `ward-help-howto.ts`, which lists them in `HOW_TOS` after its own jobs, so a
 * question that matches an older job equally well still finds that one first.
 *
 * Each answer is written from the screen's own source, in the button names the screen draws. Show
 * me targets use test ids, ids and accessible text, never class names (`tests/ward-help-howto.test.ts`
 * fails when a test id leaves the source). Nothing here ranks, places or works out a legal time.
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
/** An ED board row's actions: the row's actions button on a computer, the patient's row on a phone. */
export const ED_ROW_ACTIONS: TourTarget[] = [
  { sel: '[data-testid^="ward-ed-unfold-"]' },
  { sel: '[data-testid^="ward-ed-patient-"]' },
];
/** A movement in the list; a phone groups the list by stage, so a stage stands in. */
export const MOVEMENT_ROW: TourTarget[] = [
  { sel: '#main-content a[href^="/ward-flow/movements/"]' },
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
      "Open the job and press Arrived at ward, then Record arrival to confirm. The receiving ward then confirms the arrival. The message after it offers Undo for a few seconds.",
    desks: ["officer"],
    acts: ["PATIENT_ARRIVED"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Your jobs", body: "Each job shows its stage. Select one to open it." },
      {
        target: { sel: '[data-testid^="ward-officer-arrive-"]' },
        title: "Arrived at ward",
        body: "Shows once the patient is collected. Ward Flow asks you to confirm before it records the arrival.",
      },
    ],
  },
  {
    id: "officer-undo-step",
    topic: "Transport",
    title: "Undo a job step pressed by mistake",
    keywords: "undo wrong step mistake accepted en route collected arrived back officer",
    answer:
      "Each step you record shows a message at the foot of the screen with Undo. Press Undo while it shows and the job goes back as it was. After that, ask the bed coordinator.",
    desks: ["officer"],
    acts: ["UNDO_TRANSPORT_STEP"],
    go: "home",
    showMe: [
      {
        target: { sel: '[data-testid="ward-officer-toast-undo"]' },
        title: "Undo",
        body: "Shows in the message just after you record a step, then goes after a few seconds.",
      },
    ],
  },
  {
    id: "officer-divert",
    topic: "Transport",
    title: "Record a diversion",
    keywords: "divert diverted detour redirected another hospital stopped journey officer",
    answer:
      "Once the patient is collected, open the job and press Divert. Choose why the journey was diverted and where the patient is now, then Record diversion. The job then shows it was diverted.",
    desks: ["officer"],
    acts: ["RECORD_DIVERSION"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Open the job", body: "Divert is offered on a job after collection." },
      {
        target: { sel: '[data-testid^="ward-officer-divert-"]' },
        title: "Divert",
        body: "Opens two lists: why the journey was diverted, and where the patient is now. Then Record diversion.",
      },
    ],
  },
  {
    id: "officer-cad",
    topic: "Transport",
    title: "Add the CAD number",
    keywords: "cad number dispatch job reference ambulance number to follow officer",
    answer:
      "When a job says CAD to follow, open it. Under Details, type the CAD transport number and save it. The number then shows on the job for everyone who follows it.",
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
        title: "CAD transport number",
        body: "Type the number you were given and save it.",
      },
    ],
  },
  {
    id: "officer-forms-pack",
    topic: "Transport",
    title: "Check and upload a job's forms",
    keywords: "forms pack upload legal form 4a inspect paperwork fit to travel officer",
    answer:
      "Open the job and choose Forms. The Forms pack shows each form needed and what is still to upload. Press Upload beside a form, choose the file, then Add to pack. Inspect form shows the forms check.",
    desks: ["officer"],
    acts: ["UPLOAD_PATIENT_FORM"],
    go: "home",
    showMe: [
      { target: OFFICER_JOB, title: "Open the job", body: "Each job row shows whether forms are still needed." },
      {
        target: { sel: '[data-testid^="ward-officer-forms-pack-"]' },
        title: "Forms pack",
        body: "Each form needed, with Upload or Replace beside it.",
      },
      {
        target: { sel: '[data-testid^="ward-officer-inspect-form-"]' },
        title: "Inspect form",
        body: "Opens the forms check for this job.",
      },
    ],
  },
  {
    id: "officer-history",
    topic: "Transport",
    title: "See jobs finished today",
    keywords: "history done finished completed delivered refused cancelled jobs today officer",
    answer:
      "On My jobs, choose History. It lists Arrived today, Refused and Cancelled. Refused and Cancelled hold this session only.",
    desks: ["officer"],
    go: "home",
    showMe: [
      {
        target: { sel: "#ward-officer-jobs-tab-history" },
        title: "History",
        body: "Beside Jobs. Arrived today, Refused and Cancelled, each with its count.",
      },
    ],
  },
  {
    id: "officer-copy-handover",
    topic: "Transport",
    title: "Copy the transport handover",
    keywords: "copy handover end of shift summary open jobs paste officer",
    answer:
      "Press Copy handover. It copies a plain text summary of the open jobs, starting with a line that says the records are synthetic. On a phone the button is under the job list.",
    desks: ["officer"],
    go: "home",
    showMe: [
      {
        target: { sel: "#main-content button", text: "Copy handover" },
        title: "Copy handover",
        body: "Copies each open job's route, provider, ETA and forms, ready to paste.",
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
      "Open Capacity. It shows beds ready of the total, being made ready, in use and closed, then each health service, then Beds by ward grouped by service: ready, being made ready, in use, closed and beds, with a row of bed squares. Bed counts only, with no patient details, as at the time shown.",
    desks: ["executive"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid="ward-capacity-executive-as-at"]' },
        title: "As at",
        body: "The time the counts were taken.",
      },
      {
        target: { sel: '[data-testid="ward-capacity-executive"] table' },
        title: "Beds by ward",
        body: "Ready, being made ready, in use, closed and beds for each ward, grouped by service, with the totals at the foot.",
      },
    ],
  },
  {
    id: "statistics-compare",
    topic: "Handover and reports",
    title: "Compare wards in the statistics",
    keywords: "compare wards side by side pin network statistics figures",
    answer:
      "Open Statistics, then Compare. Pin up to three wards to set them beside the network, or choose two wards to compare. Every figure is from synthetic records.",
    desks: ["executive", "coordinator"],
    go: "statistics",
    showMe: [
      { target: statisticsView("Compare"), title: "Compare", body: "In the statistics bar." },
      {
        target: { sel: '[data-testid="ward-statistics-compare-pinned"]' },
        title: "Pin a ward",
        body: "Up to three pinned wards sit beside the network.",
      },
    ],
  },
  {
    id: "statistics-weekly",
    topic: "Handover and reports",
    title: "Read the weekly report",
    keywords: "weekly report week pilot measures operations print summary",
    answer:
      "Open Statistics, then Weekly. The pilot's four agreed measures lead, and the two counted outside Ward Flow say so. How this is counted explains each one.",
    desks: ["executive", "coordinator"],
    go: "statistics",
    showMe: [{ target: statisticsView("Weekly"), title: "Weekly", body: "The last view in the statistics bar." }],
  },

  /* Access admin */
  {
    id: "answer-access-request",
    topic: "Settings and display",
    title: "Answer a request for access",
    keywords: "request access approve decline asked waiting new starter admin",
    answer: `Settings, Access, Requests for access: each request says who asked and for which desk. Press ${GIVE_FOR} or Decline. Nobody grants themselves a role.`,
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
    ],
  },
  {
    id: "remove-role",
    topic: "Settings and display",
    title: "End someone's role",
    keywords: "remove revoke end role leaver access take away admin",
    answer:
      "Settings, Access, Everyone with a role: press Remove on the person's row, then Remove role to confirm. They lose that access straight away. Your own row has no Remove.",
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
    ],
  },
  {
    id: "access-log",
    topic: "Settings and display",
    title: "See who opened a record",
    keywords: "access log audit who looked opened viewed record privacy admin",
    answer:
      "Settings, Access, Access log lists record openings by desks in your place, newest first. Records show by id only. Type a record id or account to find one.",
    desks: ["admin"],
    go: "settings#access",
    showMe: [
      {
        target: [
          { sel: '[data-testid="ward-access-log"]' },
          { sel: '[data-testid="ward-settings-phone-area-access"]' },
        ],
        title: "Access log",
        body: "Find a record id or account to narrow the list.",
      },
    ],
  },
  {
    id: "governance-review",
    topic: "Handover and reports",
    title: "Look through the audit trail",
    keywords: "governance audit review overrides refused record access trail admin",
    answer:
      "Open Governance. Review lists events waiting for review, newest first: overrides, refused or stale actions and record access. Audit trail lists what has been reviewed.",
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
    ],
  },

  /* Site bed manager (and the coordinator, where the same control serves both) */
  {
    id: "close-bed-or-ward",
    topic: "Beds and referrals",
    title: "Close a bed or a ward to admissions",
    keywords: "close bed ward closed admissions shut reopen out of action maintenance",
    answer:
      "On Capacity, open the ward, then press Closures at the foot of its panel. Choose a bed nobody is in and a reason to close it, or close the whole ward to admissions with a reason. A closed bed or ward is not offered until someone reopens it there.",
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
        target: { sel: "button", text: "Closures" },
        title: "Closures",
        body: "The quiet last button at the foot. A last resort.",
      },
    ],
  },
  {
    id: "site-sign-off",
    topic: "Handover and reports",
    title: "Sign off the site handover",
    keywords: "site handover sign off bed manager shift end checks",
    answer:
      "On Handover, the Site handover card shows each ward's sign-off, read only, and the checks before you sign. Press Sign off when the checks allow. Undo sign-off shows afterwards.",
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
        target: { sel: '[data-testid="ward-handover-site-sign-off-button"]' },
        title: "Sign off",
        body: "Records the site sign-off with the time. Each ward still signs its own.",
      },
    ],
  },
  {
    id: "planned-admission",
    topic: "Beds and referrals",
    title: "Book a planned admission",
    keywords: "planned admission booking elective scheduled book in arrival date",
    answer:
      "On Capacity, open the Planned tab and press Book. Choose an existing patient or enter initials, age group and sex, then the reason, ward, day, arrival time, expected stay and legal status. Press Book. Change or cancel it from its row.",
    desks: ["bed_manager", "coordinator"],
    acts: ["BOOK_PLANNED_ADMISSION"],
    go: "capacity",
    showMe: [
      {
        target: { sel: '[data-testid="ward-planned-book"]' },
        title: "Book",
        body: "Opens the booking form on the Planned tab.",
      },
    ],
  },
  {
    id: "send-bed-call",
    topic: "Beds and referrals",
    title: "Send a bed call or broadcast alert",
    keywords: "bed call ask wards beds message all desks announce",
    answer:
      "On Alerts, press Broadcast alert. Choose Ask wards for beds, or Tell desks something. Choose who gets it, check What each desk sees, then send. Wards answer Can take, After a discharge or Can't.",
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
      "Open Seclusion and choose the ward. Under Seclusion room, press Mark available or Mark out of service, then confirm. Everyone sees the status until it is marked again.",
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
        target: [
          { sel: '[data-testid="seclusion-room-available"]' },
          { sel: '[data-testid="seclusion-room-out-of-service"]' },
        ],
        title: "Mark the room",
        body: "Mark available or Mark out of service. It asks before it saves.",
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
      "A bed call shows as a banner at the top of the screen. Press Can take and choose how many beds, After a discharge and choose when a bed will be ready, or Can't. The coordinator sees each ward's answer.",
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
    ],
  },

  /* Community team */
  {
    id: "record-team-contact",
    topic: "Beds and referrals",
    title: "Record a team contact",
    keywords: "contact clinical contact record team touch base timestamp community",
    answer:
      "On My team, press Record contact, then Save contact. It logs a team-level contact time for your team in this session. It is not a clinical note.",
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
        target: { sel: '[data-testid="ward-community-contact-save"]' },
        title: "Save contact",
        body: "Shows when the contact was last confirmed in this session.",
      },
    ],
  },
  {
    id: "record-cto",
    topic: "Beds and referrals",
    title: "Record a community treatment order",
    keywords: "cto community treatment order form 5a record ended order",
    answer:
      "Open the patient, then the Community tab. In the CTO card press Record CTO. When the order ends, press Record ended there. Ward Flow never works out the order's dates.",
    desks: ["community"],
    acts: ["RECORD_COMMUNITY_TREATMENT_ORDER", "END_COMMUNITY_TREATMENT_ORDER"],
    needs: "search",
    showMe: [
      { target: { sel: "#pntab-community" }, title: "Community tab", body: "On the patient's record." },
      {
        target: { sel: "#main-content button", text: "Record CTO" },
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
      "Open the referral on Referrals and press Take this referral. It then names your desk as its owner, so others know who is following it up.",
    desks: ["ed", "community"],
    acts: ["ASSIGN_REFERRAL"],
    go: "referrals",
    showMe: [
      { target: REFERRAL_ROW, title: "Open the referral", body: "The owner and calls sit in its panel." },
      {
        target: { sel: '[data-testid^="ward-referral-assign-"]' },
        title: "Take this referral",
        body: "Names your desk as the owner.",
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
      "Open the referral on Referrals. Under its calls, choose who was rung and what they said, then Log a call. The next person sees who was called and when.",
    desks: ["ed", "community"],
    acts: ["LOG_REFERRAL_CONTACT"],
    go: "referrals",
    showMe: [
      { target: REFERRAL_ROW, title: "Open the referral", body: "Log a call is in the referral's panel." },
      {
        target: { sel: '[data-testid^="ward-referral-call-log-"]' },
        title: "Log a call",
        body: "Choose who was rung and what they said, then Log a call.",
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
      "Under Lists, choose Expected, find the patient and press Mark arrived. On a phone it is the Expects tab and Mark arrived in department. Use it once the person is in your department.",
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
      "Under Lists, Awaiting review (on a phone, the Medical clearance tab), find the referral and press Record medically cleared or Record not medically cleared. It records what the team found.",
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
          { sel: '[data-testid^="ward-ed-inbox-clearance-yes-"]' },
          { sel: "#main-content button", text: "Record medically cleared" },
        ],
        title: "Record medically cleared",
        body: "Or Record not medically cleared, beside it.",
      },
    ],
  },
  {
    id: "ed-examination",
    topic: "Beds and referrals",
    title: "Record an examination",
    keywords: "examination exam assessed inpatient treatment order no order made revoked further ed",
    answer:
      "Open the patient's actions on My ED board and choose Record examination. Choose Inpatient treatment order, Community treatment order, No order made, does not proceed, or Further examination ordered, then Save outcome.",
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
        target: { sel: '[data-testid^="ward-ed-examine-toggle-"]' },
        title: "Record examination",
        body: "Opens the four outcomes. Save outcome records the one chosen.",
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
        target: { sel: '[data-testid^="ward-ed-outcome-toggle-"]' },
        title: "Record outcome",
        body: "Live ward requests are withdrawn, a pulled bed is released and uncollected transport is cancelled.",
      },
    ],
  },
  {
    id: "ed-left-department",
    topic: "Beds and referrals",
    title: "Mark that a patient left the department",
    keywords: "left department gone discharged off board remove ed",
    answer:
      "After the outcome is recorded, open the patient and press Left the department, then confirm. It takes them off your board and cannot be undone there.",
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
    ],
  },
  {
    id: "ed-refer-community",
    topic: "Beds and referrals",
    title: "Refer to a community team",
    keywords: "cmht community team refer follow up outpatient ed",
    answer:
      "Open the patient's actions and choose Refer to a community team. Choose the team (the team for the recorded home suburb is listed first) and what the referral is for, then Confirm CMHT referral.",
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
        target: { sel: '[data-testid^="ed-refer-cmht-"]' },
        title: "Refer to a community team",
        body: "Choose the team and the purpose, then confirm.",
      },
    ],
  },
  {
    id: "ed-withdraw-referral",
    topic: "Beds and referrals",
    title: "Withdraw a referral",
    keywords: "withdraw cancel referral no longer needs bed stop search ed",
    answer:
      "Open the patient's actions and choose Withdraw referral, then confirm. It says the patient no longer needs a bed: live referrals are withdrawn, a pulled bed is released and the movement closes.",
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
        target: { sel: '[data-testid^="ward-ed-withdraw-referral-toggle-"]' },
        title: "Withdraw referral",
        body: "Asks before it withdraws. There is no undo for a withdrawal.",
      },
    ],
  },
];
