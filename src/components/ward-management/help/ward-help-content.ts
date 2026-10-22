/**
 * IN-APP HELP CONTENT (fix plan item 12, 21 Oct 2026): what each screen is for and its main
 * actions, a glossary of the words and codes the screens use, and the steps of each desk's
 * first-run tour.
 *
 * Help is keyed by rail entry id (`ward-rail-entries.ts`), so the tour follows each desk's own menu
 * (`ROLE_MENUS`) and cannot describe a page the menu does not have. The words describe the current
 * screens. Nothing here is clinical advice: every screen is a synthetic prototype, and the help says
 * so once, at the top of the sheet.
 */
import { CHROME_ROLE_LABELS, type WardChromeRole } from "@/components/ward-management/ward-chrome-role";
import { BED_FINDER_MENU_ID, ROLE_MENUS } from "@/components/ward-management/shell/ward-rail-entries";
import { siteDirectory } from "@/components/ward-management/ward-sites";

export type ScreenHelp = {
  /** The screen's name as the rail shows it. */
  title: string;
  /** One sentence: what the screen is for. */
  purpose: string;
  /** Its main actions, at most three, each a short sentence. */
  actions: readonly string[];
};

export const SCREEN_HELP: Readonly<Record<string, ScreenHelp>> = {
  command: {
    title: "Home",
    purpose: "What needs the coordinator now, across every ward, ED and movement.",
    actions: [
      "Work down the act-now list first. Each row opens the record it is about.",
      "Check the ready and held bed figures before the bed meeting.",
      "Open Tasks in the header for everything addressed to this desk.",
    ],
  },
  capacity: {
    title: "Capacity",
    purpose: "Each ward's confirmed beds, what is free, held or closed, and when it was last confirmed.",
    actions: [
      "Ask a ward to confirm its beds when the figure is old.",
      "Open a ward to see its beds and who is coming in.",
      "Use the service filter in the header to look at one health service.",
    ],
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
      "Use the match view to see which wards could take the patient.",
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
      "Print or take the sheet when the shift changes.",
    ],
  },
  wards: {
    title: "All wards",
    purpose: "Every ward, grouped by health service, each opening its own ward screen.",
    actions: [
      "Open your ward to see its beds, arrivals and departures.",
      "Pin it to My wards from the ward screen, so it is one tap away next time.",
    ],
  },
  ed: {
    title: "All EDs",
    purpose: "Every emergency department, with the people there waiting for a mental health bed.",
    actions: [
      "Open your ED to see who is waiting and for how long.",
      "Raise a referral for a patient who needs a bed or a review.",
      "Book transport once a bed is ready.",
    ],
  },
  [BED_FINDER_MENU_ID]: {
    title: "Find a bed",
    purpose: "Shows which wards have a bed that fits, before you raise a referral.",
    actions: [
      "Choose the age group, bed type, sex and legal status, then read the wards that fit and their free beds.",
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
      "Use the saved views: Needs me now, Form due and For handover.",
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
};

/** The help for the screen at `pathname`: the rail entry whose address is the longest match. */
export function screenHelpFor(
  pathname: string,
  entries: readonly { id: string; href: string }[],
): (ScreenHelp & { id: string }) | undefined {
  let best: { id: string; href: string } | undefined;
  for (const entry of entries) {
    if (!(entry.id in SCREEN_HELP)) continue;
    const matches = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
    if (matches && (!best || entry.href.length > best.href.length)) best = entry;
  }
  return best ? { id: best.id, ...SCREEN_HELP[best.id] } : undefined;
}

export type GlossaryTerm = { term: string; meaning: string };

/** Ward Flow's own words. Codes for sites and services are added below from their one source. */
const WARD_FLOW_TERMS: readonly GlossaryTerm[] = [
  { term: "Act now", meaning: "Something due now or overdue. It shows first on every list that has it." },
  { term: "Movement", meaning: "One patient's journey to a bed, from the request to arrival." },
  { term: "Referred", meaning: "A destination has been asked for, and nothing has answered yet." },
  { term: "Review", meaning: "At least one unit is weighing up whether it can take the patient." },
  { term: "Accepted", meaning: "A unit has agreed in principle, but no bed has been pulled yet." },
  { term: "Pulled", meaning: "A bed is pulled for this patient, and the pull has a time limit." },
  { term: "Handover ready", meaning: "The bed and paperwork are ready. Only the physical move is left." },
  { term: "Moving", meaning: "The patient has been collected and the move is under way." },
  { term: "Arrived", meaning: "The patient has arrived, and this leg of the journey is complete." },
  { term: "Held bed", meaning: "A bed kept for one patient who has not arrived yet." },
  { term: "Confirmed beds", meaning: "The bed figures a ward last confirmed, with the time it did so." },
  {
    term: "Tentative diagnosis",
    meaning: "A broad ICD-10-AM Chapter V block chosen from a fixed list. It is never a confirmed diagnosis.",
  },
  { term: "Legal form", meaning: "The legal form a person recorded for a movement, with its due time as recorded." },
  { term: "Out of area", meaning: "A patient in a bed outside their home health service." },
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
];

/** Every glossary term, Ward Flow's words then each hospital site code, sorted A to Z. */
export const GLOSSARY: readonly GlossaryTerm[] = [
  ...WARD_FLOW_TERMS,
  ...siteDirectory.map((site) => ({ term: site.code, meaning: site.name })),
].toSorted((left, right) => left.term.localeCompare(right.term, "en-AU"));

/** Terms whose word or meaning contains `query`, ignoring case. An empty query matches all. */
export function filterGlossary(query: string, terms: readonly GlossaryTerm[] = GLOSSARY): readonly GlossaryTerm[] {
  const needle = query.trim().toLocaleLowerCase("en-AU");
  if (!needle) return terms;
  return terms.filter(
    (entry) =>
      entry.term.toLocaleLowerCase("en-AU").includes(needle) ||
      entry.meaning.toLocaleLowerCase("en-AU").includes(needle),
  );
}

export type TourStep = { title: string; body: string };

/**
 * One desk's first-run tour: a welcome, then one step per item on that desk's own menu, then where
 * help lives. Menu items with no help entry are skipped rather than described from guesswork.
 */
export function tourFor(role: WardChromeRole): readonly TourStep[] {
  const label = CHROME_ROLE_LABELS[role];
  const menuSteps = ROLE_MENUS[role].flatMap(([id, menuLabel]): TourStep[] => {
    const help = SCREEN_HELP[id];
    return help ? [{ title: menuLabel, body: `${help.purpose} ${help.actions[0] ?? ""}`.trim() }] : [];
  });
  return [
    {
      title: `Welcome, ${label}`,
      body: "Ward Flow tracks mental health beds and the patients moving to them. This is a synthetic prototype: every patient is invented, and it is not for clinical use.",
    },
    ...menuSteps,
    {
      title: "Help is always here",
      body: "Open Help from the menu for what each screen is for and a glossary. Replay this tour from Help or Settings.",
    },
  ];
}
