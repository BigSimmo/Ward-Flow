/**
 * IN-APP HELP CONTENT (fix plan item 12, 21 Oct 2026): what each screen is for and its main
 * actions, a glossary of the words and codes the screens use, and the keyboard shortcuts the app
 * registers. Each desk's tour has its own steps (`ward-tour-steps.ts`). A screen's "How do I" and
 * "Why can't I" answers sit with that screen's help, so they show where the task is done.
 *
 * Rail screens are keyed by rail entry id (`ward-rail-entries.ts`) and match their own address only,
 * so Home never stands in for a page without help. Detail and stand-alone pages match by their whole
 * address (`PAGE_HELP`). A screen with neither shows the sheet's "no help page yet" line.
 *
 * The words describe the current screens. Nothing here is clinical or legal advice: every screen is
 * a synthetic prototype, and the help says so once, at the top of the sheet.
 */
import { formTitleForCode } from "@/lib/form-register";
import { BED_FINDER_MENU_ID, ROLE_MENUS } from "@/components/ward-management/shell/ward-rail-entries";
import type { WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { CONTINUATION_LEGAL_FORMS } from "@/components/ward-management/ward-legal-forms";
import { WARD_COMMAND_HREF } from "@/components/ward-management/ward-nav";
import { siteDirectory } from "@/components/ward-management/ward-sites";
import type { SiteIdentity } from "@/components/ward-management/ward-sites";

export type ScreenHelp = {
  /** The screen's name as the rail or the page heading shows it. */
  title: string;
  /** One sentence: what the screen is for. */
  purpose: string;
  /** Its main actions, at most three, each a short sentence. */
  actions: readonly string[];
  /** The same actions on a phone, where a keyboard line would mean nothing (HF-14). */
  phoneActions?: readonly string[];
  /** Questions people ask on this screen, each answered in a sentence or two. */
  questions?: readonly HelpQuestion[];
};

type HelpQuestion = { question: string; answer: string };

const WHY_NO_ANSWER: HelpQuestion = {
  question: "Why can't I answer this referral?",
  answer:
    "Only the ward itself accepts or declines its referrals. A bed manager sees them but cannot answer, so ask the ward to answer from its own desk.",
};

/**
 * The meeting room TV hides the header, so Help cannot open there. Its help sits on the screens
 * that open it: Capacity, a ward and an ED (HF-10). Full names on every TV view (D-83, WT-20).
 */
const TV_QUESTION: HelpQuestion = {
  question: "How do I put this on the meeting room TV?",
  answer:
    "On a desktop, choose Open on TV on Capacity, or On TV on a ward or an ED. The TV is read only, shows full names as the desks do and updates on its own. Use Change screen to pick another meeting, ward or ED, Full screen for the wall screen and Leave TV view to come back. On a TV that stays on the wall, Lock as TV keeps that browser on TV views, even after a reload, until someone presses Unlock.",
};

export const SCREEN_HELP: Readonly<Record<string, ScreenHelp>> = {
  command: {
    title: "Home",
    purpose: "What needs the coordinator now, across every ward, ED and movement.",
    actions: [
      "Work down My list first: act now, then referrals to decide. Each row opens the record it is about.",
      "Switch to Everyone waiting for the whole queue. Overdue waits and Tier 1 highlight those rows.",
      "Open Alerts or Tasks in the header for everything addressed to this desk.",
    ],
  },
  capacity: {
    title: "Capacity",
    purpose: "Each ward's confirmed beds, what is ready, pulled or closed, and when it was last confirmed.",
    actions: [
      "Ask for an update when a ward's figure is old.",
      "Open a ward to see its beds and who is coming in.",
      "Use the service selector in the header to look at one health service.",
    ],
    questions: [TV_QUESTION],
  },
  movements: {
    title: "Movements",
    purpose: "Every patient moving to a bed, by stage, from referral to arrival.",
    actions: [
      "Open a movement to see its bed, transport and legal form in one place.",
      "Move it on a stage once that step is done, such as pulling a bed or booking transport.",
      "Watch the act-now edge on a row, which marks something due now.",
    ],
  },
  referrals: {
    title: "Referrals",
    purpose: "Referrals waiting for an answer, and those decided recently.",
    actions: [
      "Open a referral to see where it was sent and each destination's answer.",
      "Accept or decline it for your own ward or team, with a reason when declining.",
      "On a keyboard, J and K step through referrals. Press ? for the rest.",
    ],
    phoneActions: [
      "Open a referral to see where it was sent and each destination's answer.",
      "Accept or decline it for your own ward or team, with a reason when declining.",
      "Tap a referral to open it, and the back arrow to return to the list.",
    ],
    questions: [
      {
        question: "How do I ask more wards?",
        answer:
          "Open the referral and choose Ask more wards, then tick the wards. They are listed A to Z and never ranked, and only a ward that fits can be ticked. The card shows how many are waiting out of the network's limit, and a ward that declines frees its place.",
      },
    ],
  },
  "referral-intake": {
    title: "New referral",
    purpose: "Raise a referral to one or more wards, an ED or a community team.",
    actions: [
      "Choose the destinations. Several can be sent in one go.",
      "Record the legal status and the tentative diagnosis block, if known.",
      "Send it. Each destination answers on its own.",
    ],
  },
  handover: {
    title: "Handover",
    purpose: "A point-in-time handover sheet for the next shift, ready to print.",
    actions: [
      "Read Act now first, then anything due before the next handover.",
      "Check the Before you sign list, then choose Sign off.",
      "Print handover and Present are under More.",
    ],
    questions: [
      {
        question: "How do I hand over to the next shift?",
        answer:
          "Read Act now first, then what is due before the next handover. Work through Before you sign, then choose Sign off. Use More to print the sheet or present it at the meeting.",
      },
    ],
  },
  wards: {
    title: "All wards",
    purpose: "Every ward, grouped by health service, each opening its own ward screen.",
    actions: [
      "Open your ward to see its beds, arrivals and departures.",
      "While a ward is open, Pin this ward in the menu keeps it under My wards.",
    ],
  },
  ed: {
    title: "All EDs",
    purpose: "Every emergency department, with the people there waiting for a mental health bed.",
    actions: [
      "Search by ED, hospital or service, or filter by status and order.",
      "Use Past target to find EDs with someone past the access target.",
      "Open an ED to see its board and each patient's next step.",
    ],
  },
  [BED_FINDER_MENU_ID]: {
    title: "Find a bed",
    purpose: "Lists which wards meet the checks you choose, A to Z by name, before you raise a referral.",
    actions: [
      "Choose the age group, bed type, sex and legal status, then read the wards that meet those checks and their ready beds. Wards are never ranked.",
    ],
  },
  officer: {
    title: "Transport",
    purpose: "The transport officer's jobs: who is moving, where and when.",
    actions: [
      "Open a job to see the pickup, the destination and the booking.",
      "Record when the patient is collected.",
    ],
  },
  alerts: {
    title: "Alerts",
    purpose: "What is addressed to this desk right now, across every movement and referral.",
    actions: ["Act on the top alert first.", "Each alert opens the record it is about."],
  },
  community: {
    title: "Community",
    purpose: "Every community team, each opening its own team page with its referrals.",
    actions: ["Open your team to see referrals waiting for an answer.", "Raise a referral from the team page."],
  },
  delays: {
    title: "Waiting",
    purpose: "Why each waiting patient is still waiting, grouped by cause.",
    actions: [
      "Use the saved views: Due soon or on you, Form due and For handover.",
      "Open a row to deal with what is holding it up.",
    ],
  },
  statistics: {
    title: "Statistics",
    purpose: "Counts and waits for the network, a service or a ward, worked out from the records.",
    actions: ["Read each figure's note for what it counts and what it leaves out."],
  },
  discharges: {
    title: "Discharges",
    purpose: "Planned discharges and departures, blocked releases first.",
    actions: [
      "Work through what is blocking each discharge.",
      "Open one to see where the patient is going and the bed release.",
    ],
  },
  search: {
    title: "Patients",
    purpose: "Find an open movement or stay by record number, place, stage or owner.",
    actions: ["Search by record number, place, stage or owner."],
  },
  hub: {
    title: "Places",
    purpose: "Every ward, ED and community team in the network, with each one's beds and when they were confirmed.",
    actions: [
      "Search places, or narrow the list to wards, EDs or teams.",
      "Choose a place to preview it, then open it or view its statistics.",
      "Pin the places you use most.",
    ],
  },
  "legal-forms": {
    title: "Legal forms",
    purpose: "Every open movement with a legal form, and the expiry time a person typed from that form.",
    actions: [
      "Times are as typed from the paper form. Ward Flow does not work out legal periods, and the times are not legally checked.",
      "Switch between Clocks, Checklist and History. Choose a patient to see their form.",
      "Use Record next form when a new form is written, and Record and tell for who to let know.",
    ],
  },
  governance: {
    title: "Governance",
    purpose: "Recorded decisions to review, gaps by site and the audit trail for this session.",
    actions: [
      "Choose an event under Review, then Record review.",
      "Gaps by site lists missing requirements for each site.",
      "Audit trail lists what this session captured. Registers and Reports hold previews.",
    ],
  },
  seclusion: {
    title: "Seclusion",
    purpose: "An operational view of seclusion rooms, seclusion and restraint in use, and incidents, ward by ward.",
    actions: [
      "Choose the ward, then Mark available or Mark out of service for its seclusion room.",
      "Record start when one begins and Record end when it finishes. Times are as typed, and nothing works out a legal limit.",
      "Use Record incident for an incident on the ward.",
    ],
  },
  "out-of-area": {
    title: "Out of area",
    purpose: "Patients in a bed outside their home health service, with days away and any return plan.",
    actions: [
      "Choose a patient to open their return plan.",
      "Fill in the plan, then Record sent to ward or Record return.",
      "Copy the bed meeting summary or export the list from the header.",
    ],
  },
  "on-call": {
    title: "On-call",
    purpose: "Who answers each on-call line now, for hospitals, teams and state lines.",
    actions: [
      "Search by role, hospital, ward, team or number.",
      "Use Cover at to see who answers at a later time.",
      "Star a line to keep it under Mine.",
    ],
  },
};

/** One page the rail does not list, matched by its whole address. */
type PageHelp = ScreenHelp & {
  id: string;
  path: RegExp;
  /** The rail id whose role-menu name this page takes (a ward desk's My ward opens its ward). */
  menuId?: string;
};

/** Detail and stand-alone pages. Listed most specific first; the first match wins. */
const PAGE_HELP: readonly PageHelp[] = [
  {
    id: "ward-answer",
    path: /^\/ward-flow\/ward\/[^/]+\/answer$/u,
    title: "Ward answer",
    purpose: "One bed request at a time, for this ward to accept or decline.",
    actions: [
      "Read the request and check each gate: Pass or Does not pass.",
      "Choose Accept in principle, or Decline with a reason.",
      "Use Previous and Next when more than one request is waiting.",
    ],
    questions: [WHY_NO_ANSWER],
  },
  {
    id: "ward",
    path: /^\/ward-flow\/ward\/[^/]+$/u,
    menuId: "wards",
    title: "Ward",
    purpose: "One ward's beds, who is coming and going, and the decisions due this shift.",
    actions: [
      "Ward home lists what needs you, with referrals awaiting your answer.",
      "Bed board places patients in beds. Decisions holds what is due this shift.",
      "Confirm numbers when the bed figures change. Notices, Shift brief and Handover are in the toolbar.",
    ],
    questions: [WHY_NO_ANSWER, TV_QUESTION],
  },
  {
    id: "board",
    path: /^\/ward-flow\/board\/[^/]+$/u,
    title: "Stays and discharges",
    purpose: "Every bed on one ward, who is in it, who is coming in and who is going out today and tomorrow.",
    actions: [
      "Choose a bed to see its patient. Move the date, Record a blocker or Record that they have left.",
      "Before handover lists beds out of service and people due out.",
      "Show shift brief opens the ward's sheet for the shift.",
    ],
  },
  {
    id: "add-patient",
    path: /^\/ward-flow\/people\/new$/u,
    title: "Add a patient",
    purpose: "Adds a new invented patient record with identity only. The referral or movement holds the rest.",
    actions: [
      "Fill in UMRN, date of birth, given name and family name.",
      "Read the Duplicate check first, so one person does not get two records.",
      "Choose Add patient to open the new record, or Register & start referral to go straight to a referral.",
    ],
  },
  {
    id: "patient",
    path: /^\/ward-flow\/(?:people|movements)\/[^/]+$/u,
    title: "Patient",
    purpose: "One patient's record: where they are now, their journey and the next step.",
    actions: [
      "Now shows the status card: the bed, fit to travel and transport, each with its next step.",
      "Open Destination to ask wards, pull the bed or make a correction.",
      "History, Community, Details and Documents hold the rest of the record.",
    ],
    questions: [
      {
        question: "How do I ask more wards?",
        answer:
          "In the Bed box choose Ask wards, or Ask more wards once some have been asked, then choose the wards. Wards are never ranked, and a ward that declines frees its place.",
      },
      {
        question: "How do I pull a bed?",
        answer:
          "Once a ward accepts, the Bed box shows Pull the bed. Choose it and pick the bed. The bed is kept for the patient until the pull time limit.",
      },
      {
        question: "How do I change a destination?",
        answer:
          "Open Destination on Now to ask other wards or move a pulled bed. If the plan has changed completely, Withdraw referral closes the movement and frees any pulled bed.",
      },
      {
        question: "Why can't I book transport?",
        answer:
          "Log booking stays greyed until a ward has accepted the patient, and the reason shows beside it. Book by phone first: logging it needs the CAD number from the call, the quoted ETA, the provider, the legal status and whether an escort is needed.",
      },
    ],
  },
  {
    id: "ed-board",
    path: /^\/ward-flow\/ed\/[^/]+$/u,
    menuId: "ed",
    title: "ED board",
    purpose: "One emergency department's mental health patients, each row with its next step.",
    actions: [
      "Work down My list first. Act-now items have a red edge.",
      "Each row's button is its next step, such as Record exam, Refer to a ward or Handover ready. A referral waiting in the inbox has Ask for a bed.",
      "Raise referral starts a new one. Tap a figure in the header to highlight those patients.",
    ],
    questions: [TV_QUESTION],
  },
  {
    id: "community-team",
    path: /^\/ward-flow\/community\/[^/]+$/u,
    menuId: "community",
    title: "Community team",
    purpose: "One community team's referrals and patients, from a referral sent to their return to the team.",
    actions: [
      "Sent and Waiting answer show this team's referrals and where each one is up to.",
      "In a bed, Expected back and Caseload and CTOs follow the team's patients.",
      "New referral in the header starts a referral. How to reach this team stays beside every list.",
    ],
  },
  {
    id: "settings",
    path: /^\/ward-flow\/settings$/u,
    title: "Settings",
    purpose: "The network's rules and this device's own choices, in tabs.",
    actions: [
      "Change a rule under Rules, then Save. Rule changes wait for Save.",
      "Display holds the theme, Single-key shortcuts and Replay the tour.",
      "Press / to find a setting.",
    ],
  },
  {
    id: "downtime",
    path: /^\/ward-flow\/reports\/downtime$/u,
    title: "Downtime pack",
    purpose:
      "A frozen, printable snapshot for when the system is down: beds by ward, the ED queue, pending moves and legal forms.",
    actions: [
      "The coordinator takes a New snapshot. The pack does not update by itself.",
      "Print or save PDF to keep a paper copy.",
    ],
  },
  {
    id: "bed-meeting-agenda",
    path: /^\/ward-flow\/bed-meeting\/agenda$/u,
    title: "Bed meeting agenda",
    purpose: "The bed meeting's agenda, built from fixed rules, and the actions agreed at earlier meetings.",
    actions: [
      "Work through each section: longest ED waits, pulled beds, stranded stays and out of area.",
      "Add action against a person, with an owner and a due time, then Record action.",
      "Mark an earlier action Done once it is.",
    ],
  },
];

/**
 * Settings as the access admin sees it: it opens on Access, the desk's only job (HF-02). The other
 * desks read the Settings help above.
 */
export const ADMIN_SETTINGS_HELP: ScreenHelp & { id: string } = {
  id: "settings",
  title: "Settings",
  purpose: "Where you give, check and remove roles. It opens on Access. You see no patients from this desk.",
  actions: [
    "Answer Requests for access with Give for 90 days or Decline.",
    "Use Give a role for a new role: the person, one desk, one place and an end date.",
    "Check Everyone with a role, and Remove a role when someone changes job or leaves.",
  ],
};

/** Rail screens whose own pages sit under their address, so they share its help. */
const OWNS_SUB_PAGES: ReadonlySet<string> = new Set(["statistics"]);

/** Desk menu entries that open the desk's own place, not the list page that shares their id. */
const OWN_PLACE_MENUS: ReadonlySet<string> = new Set(["wards", "ed", "community"]);

type ShownHelp = ScreenHelp & { id: string };

/**
 * The help for the screen at `pathname`. A page pattern wins; then the rail entry at that exact
 * address (Home also at its `/command` alias). When the desk's own menu renames the page, the title
 * is that menu's name, so Help and the menu agree.
 */
export function screenHelpFor(
  pathname: string,
  entries: readonly { id: string; href: string }[],
  role?: WardChromeRole,
): ShownHelp | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/u, "") : pathname;
  let help: ShownHelp | undefined;
  let menuId: string | undefined;
  const page = PAGE_HELP.find((candidate) => candidate.path.test(path));
  if (page) {
    help = {
      id: page.id,
      title: page.title,
      purpose: page.purpose,
      actions: page.actions,
      phoneActions: page.phoneActions,
      questions: page.questions,
    };
    menuId = page.menuId;
  } else {
    const entry = entries.find(
      (candidate) =>
        candidate.id in SCREEN_HELP &&
        (path === candidate.href ||
          (candidate.id === "command" && path === WARD_COMMAND_HREF) ||
          (OWNS_SUB_PAGES.has(candidate.id) && path.startsWith(`${candidate.href}/`))),
    );
    if (!entry) return undefined;
    help = { id: entry.id, ...SCREEN_HELP[entry.id] };
    menuId = OWN_PLACE_MENUS.has(entry.id) ? undefined : entry.id;
  }
  const renamed = role ? ROLE_MENUS[role].find(([id]) => id === menuId)?.[1] : undefined;
  return renamed ? { ...help, title: renamed } : help;
}

export type GlossaryTerm = { term: string; meaning: string };

/** Ward Flow's own words. Codes for sites and services are added below from their one source. */
const WARD_FLOW_TERMS: readonly GlossaryTerm[] = [
  { term: "Act now", meaning: "Something due now or overdue. Lists that have it keep it in its own Act now group." },
  { term: "Movement", meaning: "One patient's journey to a bed, from the request to arrival." },
  { term: "Referred", meaning: "A destination has been asked for, and nothing has answered yet." },
  { term: "Review", meaning: "At least one unit is weighing up whether it can take the patient." },
  { term: "Accepted", meaning: "A unit has agreed in principle, but no bed has been pulled yet." },
  {
    term: "Pulled",
    meaning: "A bed kept for a named patient who has not arrived yet. The pull has a time limit.",
  },
  { term: "Pull expired", meaning: "The time limit on a pulled bed has passed. Move or release the bed." },
  { term: "Handover ready", meaning: "The bed and paperwork are ready. Only the physical move is left." },
  { term: "Moving", meaning: "The patient has been collected and the move is under way." },
  { term: "Arrived", meaning: "The patient has arrived, and this leg of the journey is complete." },
  { term: "Held bed", meaning: "A bed kept for a patient on leave or away from the ward, ready for their return." },
  {
    term: "Pull time limit",
    meaning:
      "How long a pulled bed is kept for the patient. When it passes, the bed shows Pull expired and a person moves or releases it.",
  },
  { term: "Being made ready", meaning: "A released bed still being prepared. It may not be offered as Ready yet." },
  { term: "Ready", meaning: "A bed the ward has confirmed is clean and staffed for an admission." },
  { term: "Held up", meaning: "A discharge or move that is delayed. It is not a bed state." },
  {
    term: "Short",
    meaning:
      "More people waiting than beds that fit, for one kind of bed. Spare means more beds than people, and Enough means they match.",
  },
  { term: "Confirmed beds", meaning: "The bed figures a ward last confirmed, with the time it did so." },

  { term: "Past date", meaning: "The patient is still on the ward after their expected discharge date." },
  {
    term: "Confirmed out",
    meaning: "A discharge the ward has confirmed. Due out is one that is expected but not confirmed.",
  },
  {
    term: "CLD",
    meaning:
      "Criteria led discharge. The ward records the criteria the treating psychiatrist set and ticks each one met.",
  },
  {
    term: "CLD ready",
    meaning: "Every criterion for criteria led discharge is met. CLD review means the criteria have lapsed.",
  },
  {
    term: "Tier",
    meaning:
      "The urgency recorded on the referral, from T1 (most urgent) to T3. Lists stay in wait order; the tier only marks a row.",
  },
  { term: "T1", meaning: "Urgency tier 1, most urgent. The tier is recorded on the referral." },
  { term: "T2", meaning: "Urgency tier 2, urgent." },
  { term: "T3", meaning: "Urgency tier 3, least urgent." },
  { term: "Overdue waits", meaning: "Patients who have waited longer than the target for their urgency tier." },
  {
    term: "Access target",
    meaning:
      "An ED performance target set in Settings, counted from when the patient's wait began. It is not a legal deadline.",
  },
  { term: "Fit to travel", meaning: "The ED doctor's recorded medical clearance. It is needed before transport." },

  {
    term: "Catchment",
    meaning: "The area a community mental health team covers. Ward Flow finds it from the patient's suburb.",
  },
  {
    term: "Cohort",
    meaning:
      "The age group a bed is for: Adult, Older adult or Youth. Capacity splits adult beds into locked and open.",
  },
  {
    term: "Secure bed",
    meaning: "A locked bed. An open bed is unlocked. This describes the ward, not the patient's legal status.",
  },

  {
    term: "Board time",
    meaning: "The clock every screen works from, in Perth time (AWST). It opens the demo controls.",
  },
  {
    term: "Constant observation",
    meaning: "An observation level that keeps staff with the patient, shown as 1:1 or 2:1. A person records it.",
  },
  {
    term: "Shift brief",
    meaning: "The ward's sheet for the shift: who came in, who is going, who is stuck and who is overdue.",
  },
  {
    term: "Notices",
    meaning: "A ward's own messages: buzzes from the coordinator, urgent tasks and notices, under the bell.",
  },
  { term: "Activity", meaning: "The header drawer of recent changes and notices. Shift+A opens it." },
  { term: "Synthetic", meaning: "Invented. Every patient, bed figure and record in Ward Flow is made up." },
  { term: "Demo", meaning: "The Demo panel: scenario, clock and reset for the invented data. Board time opens it." },
  {
    term: "Tentative diagnosis",
    meaning: "A broad ICD-10-AM Chapter V block chosen from a fixed list. It is never a confirmed diagnosis.",
  },
  { term: "Legal form", meaning: "The legal form a person recorded for a movement, with its due time as recorded." },

  { term: "Out of area", meaning: "A patient in a bed outside their home health service." },
  { term: "AWOL", meaning: "Absent without leave: a patient who has left the ward without approved leave." },
  {
    term: "CTO",
    meaning: "Community treatment order. The community team's CTO register lists the people on one.",
  },
  { term: "ETA", meaning: "Estimated time of arrival, as quoted by the transport provider or the ward." },
  { term: "MDT", meaning: "Multidisciplinary team, such as the catchment MDT a community team holds." },
  { term: "MHA", meaning: "The Mental Health Act, the WA law the legal forms are named from." },
  { term: "ATS", meaning: "Australasian Triage Scale category, as recorded at ED triage." },
  { term: "RAMP", meaning: "Risk Assessment and Management Plan, the WA mental health form." },
  { term: "PSP", meaning: "Personal support person: a carer, close family member, nominated person or guardian." },
  { term: "MHAS", meaning: "Mental Health Advocacy Service." },
  { term: "GP", meaning: "General practitioner." },
  { term: "BPSD", meaning: "Behavioural and psychological symptoms of dementia." },
  { term: "ED", meaning: "Emergency department." },
  { term: "EDD", meaning: "Expected date of discharge." },
  { term: "UMRN", meaning: "Unit medical record number. Ward Flow uses invented ones only." },
  { term: "CAD number", meaning: "The St John WA booking number for an ambulance transfer." },
  { term: "ECT", meaning: "Electroconvulsive therapy." },
  { term: "NIC", meaning: "Nurse in charge." },
  { term: "NUM", meaning: "Nurse unit manager." },
  { term: "CAHS", meaning: "Child and Adolescent Health Service." },
  { term: "EMHS", meaning: "East Metropolitan Health Service." },
  { term: "NMHS", meaning: "North Metropolitan Health Service." },
  { term: "SMHS", meaning: "South Metropolitan Health Service." },
  { term: "WACHS", meaning: "WA Country Health Service." },
  { term: "AWST", meaning: "Australian Western Standard Time, Perth time. Every time in Ward Flow is in AWST." },
  { term: "CAMHS", meaning: "Child and Adolescent Mental Health Service." },
  { term: "HDU", meaning: "High dependency unit: a ward area for patients who need closer care." },
  { term: "KPI", meaning: "Key performance indicator, such as the national seven-day follow-up measure." },
  { term: "MHERL", meaning: "Mental Health Emergency Response Line, the WA crisis phone line." },
  { term: "PIR", meaning: "Post-incident review. The PIR chronology lists one patient's events in time order." },
];

/**
 * The legal forms people can record, named from the Chief Psychiatrist's register, so the glossary
 * cannot drift from the titles the screens show (HF-08).
 */
const FORM_TERMS: readonly GlossaryTerm[] = CONTINUATION_LEGAL_FORMS.flatMap(({ code }) => {
  const title = formTitleForCode(code);
  return title === null
    ? []
    : [{ term: `Form ${code}`, meaning: `${title}. Any time shown is as typed from the paper form.` }];
});

/** Initial glossary retained for existing imports. The help sheet reads the active directory below. */
export const GLOSSARY: readonly GlossaryTerm[] = [
  ...WARD_FLOW_TERMS,
  ...FORM_TERMS,
  ...siteDirectory.map((site) => ({ term: site.code, meaning: site.name })),
].toSorted((left, right) => left.term.localeCompare(right.term, "en-AU"));

const glossaries = new WeakMap<readonly SiteIdentity[], readonly GlossaryTerm[]>([[siteDirectory, GLOSSARY]]);

/** Stable terms for one scenario's identity directory; pass sites explicitly in React consumers. */
export function glossaryForSites(sites: readonly SiteIdentity[]): readonly GlossaryTerm[] {
  const existing = glossaries.get(sites);
  if (existing) return existing;
  const terms = [
    ...WARD_FLOW_TERMS,
    ...FORM_TERMS,
    ...sites.map((site) => ({ term: site.code, meaning: site.name })),
  ].toSorted((left, right) => left.term.localeCompare(right.term, "en-AU"));
  glossaries.set(sites, terms);
  return terms;
}

/** Terms whose word or meaning contains `query`, ignoring case. An empty query matches all. */
export function filterGlossary(
  query: string,
  terms: readonly GlossaryTerm[] = glossaryForSites(siteDirectory),
): readonly GlossaryTerm[] {
  const needle = query.trim().toLocaleLowerCase("en-AU");
  if (!needle) return terms;
  return terms.filter(
    (entry) =>
      entry.term.toLocaleLowerCase("en-AU").includes(needle) ||
      entry.meaning.toLocaleLowerCase("en-AU").includes(needle),
  );
}

/**
 * The shortcuts the shell registers on a keyboard (`search-shortcut.ts`, `ward-rail-preferences.ts`,
 * `ward-rail.tsx`, and `wf/toast-keyboard.ts` for notices), with the names the screens use. Every one
 * but Ctrl+K, Alt+N and Esc is a single-key shortcut, which Settings can turn off.
 */
export const KEYBOARD_SHORTCUTS: readonly { keys: string; action: string }[] = [
  { keys: "/", action: "Search, from the box in the header. On Settings it finds a setting." },
  { keys: "Ctrl+K", action: "Search, even with single-key shortcuts off. Cmd+K on a Mac." },
  { keys: "Shift+T", action: "Open Alerts, called Tasks on some desks." },
  { keys: "Shift+A", action: "Open Activity." },
  { keys: "Shift+R", action: "Start a new referral." },
  { keys: "[", action: "Fold the side menu to icons, or open it again." },
  { keys: "Alt+N", action: "Jump to the newest notice's button, and back. With none showing, open Recent." },
  { keys: "Esc", action: "Close what is open, or step back." },
  { keys: "?", action: "Show these shortcuts. On Handover and Referrals, list that page's own keys." },
];
