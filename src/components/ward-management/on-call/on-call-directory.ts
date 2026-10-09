import { HEALTH_SERVICES, type HealthService, type Site } from "@/components/ward-management/ward-model";
import { wardSites } from "@/components/ward-management/ward-sites";
import { referenceEntity } from "@/components/ward-management/reference/ward-reference-registry";
import { REFERENCE_TEAM_NAMES, referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";
import { NETWORK_ON_CALL_ROLES, SERVICE_ON_CALL_ROLES, type OnCallRole } from "./on-call-roster";

/**
 * The On-call contacts directory (owner request, 9 October 2026: "build option A", the contact card
 * design, with mock records and the time each number is available until).
 *
 * 🔴 **EVERY NUMBER AND EMAIL HERE IS A MOCK, MADE BY TWO FUNCTIONS AND NOTHING ELSE.** A number is
 * `MOCK_NUMBER_PREFIX` plus a four digit serial: the (08) 0000 exchange is unassigned, so it cannot
 * reach a person. An email uses the reserved `.invalid` domain, so it cannot be delivered. This is the
 * pattern the Tools contact directory already uses for its owner-requested mock contacts. No real
 * number, published or otherwise, is copied onto this page, including the community teams the
 * reference pack holds published lines for. `tests/ward-on-call-holds-no-people.test.ts` asserts every
 * rendered line and address matches the mock pattern.
 *
 * 🔴 **NOTHING DIALS OR SENDS.** There is no tel or mail link anywhere on this screen. Call copies
 * the number and says the dialler is not wired.
 *
 * ⚠️ **THE ROSTER STAYS THE SOURCE OF ON-CALL TIMES.** Every rostered line below takes its window
 * from `on-call-roster.ts`, parsed from the roster's own words. Office hours, inbox hours and every
 * other window are synthetic and labelled so on screen. `OnCallRole` is untouched: a directory entry
 * is a separate record, and the role type still holds no contact method.
 */

/** Set to false to show "Not held" in every number slot instead of a mock number. */
export const SHOW_MOCK_CONTACTS = true;
export const MOCK_NUMBER_PREFIX = "08 0000";
const MOCK_EMAIL_DOMAIN = "example.invalid";

export type DirectoryService = "Statewide" | HealthService;
export type DirectorySection = "hospitals" | "community" | "statewide";

/** A window in minutes from midnight, start inclusive, end exclusive, wrapping past midnight. */
export type ContactWindow = readonly [start: number, end: number];

export type ContactLine = {
  /** What the line is, e.g. "On-call phone". Never a person. */
  label: string;
  number: string | null;
  /** Null when the line is answered around the clock. */
  window: ContactWindow | null;
};

export type ContactKind =
  | "switchboard"
  | "epic"
  | "edLiaison"
  | "registrar"
  | "consultant"
  | "afterHours"
  | "nurseInCharge"
  | "referralInbox"
  | "bedFlow"
  | "serviceConsultant"
  | "executive"
  | "aboriginalLiaison"
  | "community"
  | "regional"
  | "line";

export type DirectoryEntry = {
  id: string;
  service: DirectoryService;
  section: DirectorySection;
  /** Rows sharing a group render under one group heading. */
  group: string;
  groupTitle: string;
  siteCode?: string;
  kind: ContactKind;
  /** The row's name: a role, a ward or a team. Never a person. */
  name: string;
  /** Where or what, beneath the name. */
  place: string;
  purpose: string;
  lines: ContactLine[];
  email: string | null;
  /** Hours the inbox is read. Null with an email means read through the day. */
  emailWindow: ContactWindow | null;
  sendWith: string[];
  note: string;
  /** Synthetic age of the record, in days. Over `CHECK_DUE_DAYS` reads as check due. */
  checkedDaysAgo: number;
  /** True when a line's hours come from the on-call roster. */
  rostered: boolean;
};

export const CHECK_DUE_DAYS = 40;
/** Minutes on the clock face, for wrapping times past midnight. A calendar fact, not a limit. */
export const CLOCK_DAY = 24 * 60;
export const mod = (value: number) => ((value % CLOCK_DAY) + CLOCK_DAY) % CLOCK_DAY;
export const hhmm = (minute: number) =>
  `${String(Math.floor(mod(minute) / 60)).padStart(2, "0")}:${String(mod(minute) % 60).padStart(2, "0")}`;

export const SERVICE_META: Record<DirectoryService, { name: string; short: string; tone: string }> = {
  Statewide: { name: "Statewide", short: "Statewide", tone: "statewide" },
  "North Metro": { name: "North Metro", short: "NMHS", tone: "north" },
  "East Metro": { name: "East Metro", short: "EMHS", tone: "east" },
  "South Metro": { name: "South Metro", short: "SMHS", tone: "south" },
  CAHS: { name: "Child and Adolescent", short: "CAHS", tone: "cahs" },
  WACHS: { name: "Country", short: "WACHS", tone: "wachs" },
  Private: { name: "Private", short: "Private", tone: "private" },
};

/** Directory order: the metro services, then children's, country and private. */
export const SERVICE_ORDER: readonly HealthService[] = [
  "North Metro",
  "East Metro",
  "South Metro",
  "CAHS",
  "WACHS",
  "Private",
];

const HSP_SERVICE: Record<string, HealthService> = {
  NMHS: "North Metro",
  EMHS: "East Metro",
  SMHS: "South Metro",
  CAHS: "CAHS",
  WACHS: "WACHS",
};

/** Parses a roster shift ("Overnight, 20:00 to 08:00") into a window. The roster's words are the source. */
export function shiftWindow(shift: string): ContactWindow | null {
  const match = shift.match(/(\d{2}):(\d{2}) to (\d{2}):(\d{2})$/u);
  if (!match) return null;
  const [, sh, sm, eh, em] = match;
  return [Number(sh) * 60 + Number(sm), Number(eh) * 60 + Number(em)];
}

function rosterRole(service: HealthService, role: string): OnCallRole | undefined {
  return SERVICE_ON_CALL_ROLES[service].find((item) => item.role === role);
}

function networkWindow(id: string): ContactWindow | null {
  const role = NETWORK_ON_CALL_ROLES.find((item) => item.id === id);
  return role ? shiftWindow(role.shift) : null;
}

const hash = (text: string) => [...text].reduce((total, char) => (Math.imul(total, 31) + char.charCodeAt(0)) >>> 0, 7);

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/\(.*?\)/gu, "")
    .replace(/[^a-z0-9]+/gu, ".")
    .replace(/^\.|\.$/gu, "");

const SEND_WITH = {
  ward: ["Referral form", "Risk assessment", "Medication chart", "Legal status"],
  community: ["Referral form", "Discharge summary", "Risk assessment", "Follow-up date and GP"],
  placement: ["Referral form", "Risk assessment", "Legal status", "Current location and bed need"],
};

const NOTE: Record<ContactKind, string> = {
  switchboard: "Ask for the role by title, never by name.",
  epic: "The emergency physician in charge carries this phone for the shift.",
  edLiaison: "Mental health liaison nurse in ED. After hours the registrar on call takes ED reviews.",
  registrar: "First call for ED reviews, admissions and ward reviews after hours.",
  consultant: "Go through the registrar first unless it cannot wait.",
  afterHours: "Site beds, staffing and security after hours.",
  nurseInCharge: "Bed state and handover. Accepts same-site moves for the ward.",
  referralInbox: "Phone the nurse in charge when the inbox is closed.",
  bedFlow: "Placement, transfers and out-of-area requests for the service.",
  serviceConsultant: "Service level advice and placement disputes.",
  executive: "Diversion, capacity escalation and anything that needs an executive.",
  aboriginalLiaison: "Cultural support and family liaison. No after-hours line.",
  community: "Team line in office hours. Use the crisis line after hours.",
  regional: "Through the regional hospital switchboard.",
  line: "Direct crisis and urgent response line.",
};

/** Office hours used by synthetic office lines, 08:00 to 17:00. */
const OFFICE: ContactWindow = [480, 1020];
/** Referral inboxes are read 08:00 to 16:30. */
const INBOX: ContactWindow = [480, 990];

/**
 * Builds the whole directory from the site list, the roster and the reference team names. Pure:
 * the same sites give the same records, numbers and record ages every time.
 */
export function buildOnCallDirectory(sites: readonly Site[] = wardSites): DirectoryEntry[] {
  let serial = 0;
  const number = () => {
    serial += 1;
    return SHOW_MOCK_CONTACTS ? `${MOCK_NUMBER_PREFIX} ${1000 + serial}` : null;
  };
  const email = (local: string) => (SHOW_MOCK_CONTACTS ? [local, MOCK_EMAIL_DOMAIN].join("@") : null);
  const line = (label: string, window: ContactWindow | null): ContactLine => ({ label, number: number(), window });
  const entries: DirectoryEntry[] = [];
  const add = (
    entry: Omit<DirectoryEntry, "checkedDaysAgo" | "email" | "emailWindow" | "sendWith" | "note" | "rostered"> &
      Partial<Pick<DirectoryEntry, "email" | "emailWindow" | "sendWith" | "note" | "rostered">>,
  ) => {
    entries.push({
      email: null,
      emailWindow: null,
      sendWith: [],
      note: NOTE[entry.kind],
      rostered: false,
      ...entry,
      checkedDaysAgo: (hash(`${entry.id}c`) % 52) + 1,
    });
  };

  /* Statewide */
  const statewide = (
    group: string,
    id: string,
    name: string,
    place: string,
    purpose: string,
    lines: ContactLine[],
    extra: Partial<DirectoryEntry> = {},
  ) =>
    add({
      id,
      service: "Statewide",
      section: "statewide",
      group,
      groupTitle: group,
      kind: "line",
      name,
      place,
      purpose,
      lines,
      ...extra,
    });

  const bedDesk = networkWindow("bed-coordinator");
  statewide(
    "Beds and escalation",
    "sw-bfc",
    "State bed flow coordinator",
    "Central bed desk",
    "Statewide placement",
    [line("State bed desk", bedDesk ? [OFFICE[0], bedDesk[0]] : OFFICE), line("Coordinator on call", bedDesk)],
    {
      kind: "bedFlow",
      email: email("state.bed.desk"),
      sendWith: SEND_WITH.placement,
      note: "The only role that accepts a transfer from another hospital's ward.",
      rostered: bedDesk !== null,
    },
  );
  statewide(
    "Beds and escalation",
    "sw-gov",
    "Governance lead on call",
    "Statewide Tier 3 desk",
    "Senior escalation, from home",
    [line("Governance on call", networkWindow("governance-lead"))],
    {
      kind: "executive",
      note: "Senior escalation from home. Call after the service executive.",
      rostered: true,
    },
  );
  statewide(
    "Crisis lines",
    "sw-mherl",
    "Mental Health Emergency Response Line",
    "MHERL, metro",
    "Crisis triage",
    [line("Crisis line", null)],
    { note: "Crisis triage and advice for metro, day and night." },
  );
  statewide(
    "Crisis lines",
    "sw-rural",
    "Rurallink",
    "Country, after hours",
    "Country crisis triage",
    [line("Rurallink", [990, 510])],
    { note: "Country crisis line after hours. MHETS covers country EDs." },
  );
  statewide(
    "Rights and legal",
    "sw-mhas",
    "Mental Health Advocacy Service",
    "MHAS",
    "Involuntary patient rights",
    [line("Advocacy line", [510, 1020])],
    { email: email("mhas.referrals"), emailWindow: [510, 1020], note: "Rights and advocacy for involuntary patients." },
  );
  statewide(
    "Rights and legal",
    "sw-mht",
    "Mental Health Tribunal",
    "Statewide",
    "Hearings and reviews",
    [line("Tribunal office", [510, 990])],
    { email: email("tribunal.registry"), emailWindow: [510, 990], note: "Hearing bookings and reviews." },
  );
  statewide(
    "Rights and legal",
    "sw-ocp",
    "Office of the Chief Psychiatrist",
    "Statewide",
    "Notifiable incidents",
    [line("Office", [510, 1020])],
    {
      email: email("ocp.notifications"),
      emailWindow: [510, 1020],
      note: "Notifiable incidents and reportable events.",
    },
  );
  statewide(
    "Transport and retrieval",
    "sw-sja",
    "St John WA clinical coordination",
    "Ambulance",
    "Urgent transfers",
    [line("Clinical coordination", null)],
    { note: "Urgent interhospital transfers." },
  );
  statewide(
    "Transport and retrieval",
    "sw-pts",
    "Patient transport bookings",
    "Statewide",
    "Non urgent transfers",
    [line("Bookings", [420, 1140])],
    { email: email("patient.transport"), emailWindow: [420, 1140], note: "Non urgent transfers between sites." },
  );
  statewide(
    "Transport and retrieval",
    "sw-rfds",
    "Royal Flying Doctor Service",
    "Western Operations",
    "Country retrievals",
    [line("Retrieval coordination", null)],
    { note: "Country retrievals and aeromedical transfers." },
  );
  statewide(
    "Specialist services",
    "sw-sfmhs",
    "State Forensic Mental Health Service",
    "Frankland Centre",
    "Forensic admissions",
    [line("Admissions", null)],
    { note: "Forensic admissions and court liaison." },
  );
  statewide(
    "Specialist services",
    "sw-mbu",
    "Mother and Baby Unit",
    referenceEntity("kemh")?.name ?? "Statewide",
    "Perinatal admissions",
    [line("Unit phone", null)],
    {
      email: email("mbu.referrals"),
      emailWindow: INBOX,
      sendWith: SEND_WITH.ward,
      note: "Perinatal admissions with infant.",
    },
  );
  statewide(
    "Police and interpreters",
    "sw-cor",
    "Mental Health Co-Response",
    "WA Police",
    "Police and clinician response",
    [line("Co-Response desk", null)],
    { note: "Joint police and clinician response in the community." },
  );
  statewide(
    "Police and interpreters",
    "sw-tis",
    "TIS National",
    "Interpreter",
    "Telephone interpreting",
    [line("Interpreting", null)],
    { note: "Telephone interpreting, day and night. Book onsite interpreters through the site." },
  );

  /* Service wide, then each site's hospital and ward lines */
  for (const service of SERVICE_ORDER) {
    const meta = SERVICE_META[service];
    const group = `${service}-service`;
    const groupTitle = "Service wide";
    const svc = (
      id: string,
      kind: ContactKind,
      name: string,
      purpose: string,
      lines: ContactLine[],
      extra: Partial<DirectoryEntry> = {},
    ) =>
      add({
        id,
        service,
        section: "hospitals",
        group,
        groupTitle,
        kind,
        name,
        place: meta.short,
        purpose,
        lines,
        ...extra,
      });

    if (service === "Private") {
      const liaison = rosterRole(service, "Coordinator on call");
      const window = liaison ? shiftWindow(liaison.shift) : OFFICE;
      svc(
        "pr-liaison",
        "bedFlow",
        "Private placement liaison",
        "Private placement enquiries",
        [line("Liaison office", window)],
        {
          place: "Private facilities",
          email: email("private.placement"),
          emailWindow: window,
          sendWith: SEND_WITH.placement,
          note: "Private placement enquiries. Business hours only.",
          rostered: liaison !== undefined,
        },
      );
    } else {
      const key = meta.short.toLowerCase();
      const coordinator = rosterRole(service, "Coordinator on call");
      const coordinatorWindow = coordinator ? shiftWindow(coordinator.shift) : null;
      svc(
        `${key}-bfc`,
        "bedFlow",
        "Bed flow coordinator",
        "Placement and transfers",
        coordinatorWindow
          ? [line("Bed flow office", [OFFICE[0], coordinatorWindow[0]]), line("On-call mobile", coordinatorWindow)]
          : [line("Bed flow office", OFFICE)],
        {
          email: email(`${key}.bedflow`),
          emailWindow: INBOX,
          sendWith: SEND_WITH.placement,
          note: coordinatorWindow
            ? NOTE.bedFlow
            : "No after-hours coordinator is recorded. Use the State bed desk after 17:00.",
          rostered: coordinatorWindow !== null,
        },
      );
      const consultant = rosterRole(service, "Duty consultant");
      const consultantWindow = consultant ? shiftWindow(consultant.shift) : null;
      const gap = consultantWindow && consultantWindow[0] > OFFICE[1];
      svc(
        `${key}-scon`,
        "serviceConsultant",
        "Service consultant on call",
        "Service level advice",
        consultantWindow
          ? [line("Service office", OFFICE), line("On-call mobile", consultantWindow)]
          : [line("Service office", OFFICE)],
        {
          note: gap
            ? `No cover from ${hhmm(OFFICE[1])} to ${hhmm(consultantWindow[0])}. Use the executive on call in that gap.`
            : NOTE.serviceConsultant,
          rostered: consultantWindow !== null,
        },
      );
      if (service === "CAHS") {
        svc("cahs-ccc", "line", "CAMHS Crisis Connect", "Young person crisis line", [line("Crisis line", null)], {
          note: "Young person crisis line, day and night.",
        });
        svc(
          "cahs-acit",
          "line",
          "Acute Community Intervention Team",
          "Urgent community follow up",
          [line("Team phone", [480, 1320])],
          {
            note: "Urgent community follow up for young people.",
          },
        );
      }
      if (service === "WACHS") {
        svc(
          "wachs-mhets",
          "line",
          "Mental Health Emergency Telehealth Service",
          "Country ED psychiatric review",
          [line("Telehealth line", null)],
          {
            note: "Psychiatric review by video for country EDs, day and night.",
          },
        );
        for (const region of [
          "Kimberley",
          "Pilbara",
          "Midwest",
          "Goldfields",
          "Wheatbelt",
          "South West",
          "Great Southern",
        ]) {
          svc(
            `wachs-rp-${slug(region)}`,
            "regional",
            "Regional psychiatrist on call",
            "Regional psychiatric advice",
            [line("Regional switchboard", null)],
            {
              place: region,
            },
          );
        }
      }
      svc(`${key}-exec`, "executive", "Executive on call", "Diversion and escalation", [
        line("Executive office", OFFICE),
        line("Executive on call", [OFFICE[1], OFFICE[0]]),
      ]);
      svc(
        `${key}-aml`,
        "aboriginalLiaison",
        "Aboriginal mental health liaison",
        "Cultural support and family",
        [line("Liaison office", INBOX)],
        {
          email: email(`${key}.aboriginal.liaison`),
          emailWindow: INBOX,
        },
      );
    }

    for (const site of sites.filter((item) => item.service === service)) {
      const code = site.code;
      const base = {
        service,
        section: "hospitals" as const,
        group: code,
        groupTitle: site.name,
        siteCode: code,
        place: site.name,
      };
      const lower = code.toLowerCase();
      const hasEd = Boolean(site.emergencyDepartment);
      const hasUnits = site.units.length > 0;
      add({
        ...base,
        id: `${lower}-sw`,
        kind: "switchboard",
        name: "Switchboard",
        purpose: "Ask for any role by title",
        lines: [line("Switchboard", null)],
      });
      if (hasEd) {
        add({
          ...base,
          id: `${lower}-epic`,
          kind: "epic",
          name: "EPIC",
          purpose: "Emergency physician in charge",
          lines: [line("EPIC phone", null)],
        });
        add({
          ...base,
          id: `${lower}-edl`,
          kind: "edLiaison",
          name: "ED mental health liaison",
          purpose: "ED psychiatric review",
          lines: [line("Liaison phone", [480, 1350])],
        });
      }
      if (service !== "Private" && (hasEd || hasUnits)) {
        add({
          ...base,
          id: `${lower}-reg`,
          kind: "registrar",
          name: "Psychiatry registrar on call",
          purpose: "Assessments and admissions",
          lines: [line("Day registrar", OFFICE), line("On-call phone", [OFFICE[1], OFFICE[0]])],
        });
        add({
          ...base,
          id: `${lower}-con`,
          kind: "consultant",
          name: "Consultant psychiatrist on call",
          purpose: "Senior psychiatric advice",
          lines: [line("Day consultant", OFFICE), line("On-call phone", [OFFICE[1], OFFICE[0]])],
        });
      }
      if (hasUnits) {
        add({
          ...base,
          id: `${lower}-ahm`,
          kind: "afterHours",
          name: "After-hours nurse manager",
          purpose: "Site beds and staffing",
          lines: [line("Bed manager", [480, 990]), line("After-hours phone", [990, 480])],
        });
      }
      for (const unit of site.units) {
        const ward = unit.name.replace(/\s+—.*$/u, "");
        add({
          ...base,
          id: `${unit.id}-nic`,
          kind: "nurseInCharge",
          name: ward,
          place: "Nurse in charge",
          purpose: "Bed state and handover",
          lines: [line("Nurses' station", null)],
        });
        add({
          ...base,
          id: `${unit.id}-ref`,
          kind: "referralInbox",
          name: ward,
          place: "Referral inbox",
          purpose: "Ward referrals and forms",
          lines: [],
          email: email(`${lower}.${slug(ward.replace(`${code} `, ""))}.referrals`),
          emailWindow: INBOX,
          sendWith: SEND_WITH.ward,
        });
      }
    }
  }

  /* Community teams, by name from the reference pack, with mock lines only */
  for (const name of REFERENCE_TEAM_NAMES) {
    const detail = referenceTeamDetail(name);
    const service = detail?.hsp ? HSP_SERVICE[detail.hsp] : undefined;
    if (!service) continue;
    add({
      id: `cm-${slug(name)}`,
      service,
      section: "community",
      group: `${service}-community`,
      groupTitle: `${SERVICE_META[service].short} community teams`,
      kind: "community",
      name,
      place: /CAMHS/u.test(name)
        ? "Child and adolescent"
        : /older adult/iu.test(name)
          ? "Older adult"
          : "Adult community",
      purpose: "Community referral",
      lines: [line("Team phone", [510, 990])],
      email: detail?.referralEmail
        ? email(`${slug(name.replace(/Community Mental Health Service/u, ""))}.referrals`)
        : null,
      emailWindow: INBOX,
      sendWith: SEND_WITH.community,
    });
  }

  return entries;
}

/* ---------------- availability ---------------- */

export function inWindow(window: ContactWindow | null, minute: number): boolean {
  if (window === null) return true;
  const [start, end] = window;
  const m = mod(minute);
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** The line answering at a minute: the first whose window holds it. */
export function lineAt(entry: DirectoryEntry, minute: number): ContactLine | null {
  return entry.lines.find((item) => inWindow(item.window, minute)) ?? null;
}

export type Availability =
  | { kind: "none" }
  | { kind: "on"; allDay: true; line: ContactLine | null; email: boolean }
  | {
      kind: "on";
      allDay: false;
      line: ContactLine | null;
      email: boolean;
      until: number;
      left: number;
      then: ContactLine | null;
      soon: boolean;
    }
  | { kind: "off"; email: boolean; opens: number; wait: number; next: ContactLine | null };

/** Who answers at `minute`, until when, and what follows. Minutes step through one day at most. */
export function availability(entry: DirectoryEntry, minute: number): Availability {
  if (entry.lines.length === 0) {
    if (!entry.email) return { kind: "none" };
    const window = entry.emailWindow;
    if (!window) return { kind: "on", allDay: true, line: null, email: true };
    if (inWindow(window, minute)) {
      const left = mod(window[1] - minute) || CLOCK_DAY;
      return {
        kind: "on",
        allDay: false,
        line: null,
        email: true,
        until: mod(window[1]),
        left,
        then: null,
        soon: left <= 60,
      };
    }
    return {
      kind: "off",
      email: true,
      opens: mod(window[0]),
      wait: mod(window[0] - minute) || CLOCK_DAY,
      next: null,
    };
  }
  const current = lineAt(entry, minute);
  // The answering line can only change where some line's window starts or ends, so only those
  // minutes are checked, nearest first.
  const steps = [
    ...new Set(
      entry.lines.flatMap((item) =>
        item.window ? [mod(item.window[0] - minute) || CLOCK_DAY, mod(item.window[1] - minute) || CLOCK_DAY] : [],
      ),
    ),
  ].sort((a, b) => a - b);
  if (current) {
    const step = steps.find((candidate) => lineAt(entry, minute + candidate) !== current);
    if (step === undefined) return { kind: "on", allDay: true, line: current, email: false };
    return {
      kind: "on",
      allDay: false,
      line: current,
      email: false,
      until: mod(minute + step),
      left: step,
      then: lineAt(entry, minute + step),
      soon: step <= 60,
    };
  }
  const step = steps.find((candidate) => lineAt(entry, minute + candidate)) ?? CLOCK_DAY;
  return { kind: "off", email: false, opens: mod(minute + step), wait: step, next: lineAt(entry, minute + step) };
}

/** The number to show now: the answering line, else the next to open, else the first. */
export function numberAt(entry: DirectoryEntry, minute: number): string | null {
  const now = availability(entry, minute);
  if (now.kind === "on" && now.line) return now.line.number;
  if (now.kind === "off" && now.next) return now.next.number;
  return entry.lines[0]?.number ?? null;
}

export const isAnswering = (entry: DirectoryEntry, minute: number) => availability(entry, minute).kind === "on";

export const windowText = (window: ContactWindow | null) =>
  window === null ? "24 hours" : `${hhmm(window[0])} to ${hhmm(window[1])}`;

/* ---------------- escalation ---------------- */

/**
 * Who to try next if this line does not answer, in order. A preview order for the prototype, not a
 * ratified escalation policy; the screen labels it so.
 */
export function escalationChain(entry: DirectoryEntry, all: readonly DirectoryEntry[]): DirectoryEntry[] {
  const find = (kind: ContactKind, service: DirectoryService = entry.service, siteCode?: string) =>
    all.find(
      (item) =>
        item.kind === kind &&
        item.service === service &&
        item.section === "hospitals" &&
        (siteCode === undefined || item.siteCode === siteCode),
    );
  const byId = (id: string) => all.find((item) => item.id === id);
  const site = entry.siteCode;
  let chain: (DirectoryEntry | undefined)[] = [];
  switch (entry.kind) {
    case "nurseInCharge":
    case "referralInbox":
      chain = [find("bedFlow"), find("afterHours", entry.service, site), find("executive")];
      break;
    case "registrar":
      chain = [find("consultant", entry.service, site), find("serviceConsultant"), find("executive")];
      break;
    case "consultant":
      chain = [find("serviceConsultant"), find("executive")];
      break;
    case "epic":
    case "edLiaison":
      chain = [find("registrar", entry.service, site), find("bedFlow"), find("executive")];
      break;
    case "bedFlow":
      chain = entry.id === "sw-bfc" ? [byId("sw-gov")] : [byId("sw-bfc"), find("executive"), byId("sw-gov")];
      break;
    case "afterHours":
    case "switchboard":
      chain = [find("bedFlow"), find("executive")];
      break;
    case "community":
      // Each service's own after-hours crisis line first: child teams to CAMHS Crisis Connect,
      // country teams to Rurallink, everyone else to MHERL.
      chain = [
        byId(entry.service === "CAHS" ? "cahs-ccc" : entry.service === "WACHS" ? "sw-rural" : "sw-mherl"),
        find("bedFlow"),
      ];
      break;
    case "serviceConsultant":
    case "regional":
      chain = [find("executive"), byId("sw-gov")];
      break;
    case "executive":
      chain = entry.id === "sw-gov" ? [] : [byId("sw-gov")];
      break;
    case "aboriginalLiaison":
      chain = [find("bedFlow")];
      break;
    default:
      chain = [];
  }
  // Every ladder ends at the statewide Tier 3 desk, whatever stops lower down.
  const gov = byId("sw-gov");
  if (chain.length && !chain.includes(gov)) chain.push(gov);
  return chain.filter((item): item is DirectoryEntry => item !== undefined && item.id !== entry.id);
}

/* ---------------- changes coming up ---------------- */

const KIND_PLURAL: Partial<Record<ContactKind, string>> = {
  registrar: "Registrars",
  consultant: "Consultants",
  afterHours: "Nurse managers",
  edLiaison: "ED liaison",
  bedFlow: "Bed flow",
  serviceConsultant: "Service consultants",
  executive: "Executives",
  aboriginalLiaison: "Aboriginal liaison",
  community: "Community teams",
};

export type CoverChange = {
  minute: number;
  /** Minutes from the reference time. */
  in: number;
  kind: "switch" | "open" | "close";
  text: string;
  count: number;
};

/**
 * Line boundaries within `span` minutes, merged so a set of the same role changing together reads as
 * one event, and a close with an open at the same minute reads as a switch.
 */
export function upcomingChanges(entries: readonly DirectoryEntry[], minute: number, span = 180): CoverChange[] {
  type Bucket = {
    minute: number;
    in: number;
    kind: ContactKind;
    rows: DirectoryEntry[];
    opens: ContactLine | null;
    closes: ContactLine | null;
  };
  const buckets = new Map<string, Bucket>();
  for (const entry of entries) {
    for (const item of entry.lines) {
      if (!item.window) continue;
      for (const [edge, at] of [
        ["open", item.window[0]],
        ["close", item.window[1]],
      ] as const) {
        const delta = mod(at - minute);
        if (delta <= 0 || delta > span) continue;
        const shared = KIND_PLURAL[entry.kind] && entry.service !== "Statewide";
        const key = `${at}|${entry.kind}|${shared ? "" : entry.id}`;
        const bucket = buckets.get(key) ?? {
          minute: mod(at),
          in: delta,
          kind: entry.kind,
          rows: [],
          opens: null,
          closes: null,
        };
        if (!bucket.rows.includes(entry)) bucket.rows.push(entry);
        if (edge === "open") bucket.opens = item;
        else bucket.closes = item;
        buckets.set(key, bucket);
      }
    }
  }
  const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
  return [...buckets.values()]
    .map((bucket) => {
      const first = bucket.rows[0]!;
      const noun =
        bucket.rows.length > 1
          ? (KIND_PLURAL[bucket.kind] ?? first.name)
          : `${first.name}${first.siteCode ? `, ${first.siteCode}` : ""}`;
      const kind = bucket.opens && bucket.closes ? "switch" : bucket.opens ? "open" : "close";
      const text =
        kind === "switch"
          ? `${noun} switch to ${lower(bucket.opens!.label)}`
          : kind === "open"
            ? `${noun}: ${lower(bucket.opens!.label)} opens`
            : `${noun}: ${lower(bucket.closes!.label)} closes`;
      return { minute: bucket.minute, in: bucket.in, kind, text, count: bucket.rows.length } satisfies CoverChange;
    })
    .sort((a, b) => a.in - b.in || b.count - a.count);
}

/** The lines the hero keeps one tap away: the state desk, each service's bed flow, then the crisis line. */
export const KEY_LINE_IDS = [
  "sw-bfc",
  "nmhs-bfc",
  "emhs-bfc",
  "smhs-bfc",
  "cahs-bfc",
  "wachs-bfc",
  "sw-mherl",
] as const;

export function keyLineLabel(entry: DirectoryEntry): string {
  if (entry.id === "sw-bfc") return "State bed desk";
  if (entry.id === "sw-mherl") return "MHERL crisis line";
  return `${SERVICE_META[entry.service].short} bed flow`;
}

/** Health services in the directory, for any check that wants every service represented. */
export const DIRECTORY_SERVICES: readonly DirectoryService[] = ["Statewide", ...HEALTH_SERVICES];

/* ---------------- grouping, shared by desktop and phone ---------------- */

export type DirectoryTab = DirectorySection | "mine";

export const ROLE_ORDER: [ContactKind | "other", string][] = [
  ["epic", "EPIC, emergency physician in charge"],
  ["edLiaison", "ED mental health liaison"],
  ["registrar", "Psychiatry registrar on call"],
  ["consultant", "Consultant psychiatrist on call"],
  ["bedFlow", "Bed flow coordinators"],
  ["afterHours", "After-hours nurse managers"],
  ["nurseInCharge", "Wards, nurse in charge"],
  ["referralInbox", "Ward referral inboxes"],
  ["serviceConsultant", "Service consultants on call"],
  ["executive", "Executives on call"],
  ["aboriginalLiaison", "Aboriginal mental health liaison"],
  ["switchboard", "Switchboards"],
  ["other", "Other service lines"],
];

function siteMeta(entries: readonly DirectoryEntry[], group: string): string {
  const rows = entries.filter((entry) => entry.group === group);
  const parts: string[] = [];
  if (rows.some((entry) => entry.kind === "epic")) parts.push("ED");
  if (rows.some((entry) => entry.kind === "afterHours")) parts.push("Mental health unit");
  const wards = rows.filter((entry) => entry.kind === "nurseInCharge").length;
  if (wards) parts.push(`${wards} ${wards === 1 ? "ward" : "wards"}`);
  return parts.join(", ");
}

type Group = { key: string; title: string; code?: string; meta?: string; rows: DirectoryEntry[] };
type ServiceBlock = { service: DirectoryEntry["service"] | null; groups: Group[] };

/** Rows in display order, grouped by service and then by site, team set or role. Shared with phone. */
export function groupRows(
  entries: readonly DirectoryEntry[],
  rows: readonly DirectoryEntry[],
  tab: DirectoryTab,
  groupBy: "place" | "role",
): ServiceBlock[] {
  if (tab === "hospitals" && groupBy === "role") {
    const groups = ROLE_ORDER.map(([kind, title]) => ({
      key: `role-${kind}`,
      title,
      rows: rows.filter((entry) =>
        kind === "other" ? !ROLE_ORDER.some(([known]) => known === entry.kind) : entry.kind === kind,
      ),
    })).filter((group) => group.rows.length);
    return [{ service: null, groups }];
  }
  if (tab === "mine")
    return [{ service: null, groups: rows.length ? [{ key: "mine", title: "My list", rows: [...rows] }] : [] }];
  const order = tab === "statewide" ? (["Statewide"] as const) : SERVICE_ORDER;
  return order
    .map((service) => {
      const inService = rows.filter((entry) => entry.service === service);
      const keys = [...new Set(inService.map((entry) => entry.group))];
      return {
        service: tab === "statewide" ? null : service,
        groups: keys.map((key) => {
          const groupRows = inService.filter((entry) => entry.group === key);
          const first = groupRows[0]!;
          return {
            key,
            title: first.groupTitle,
            code: first.siteCode,
            meta: first.siteCode ? siteMeta(entries, key) : undefined,
            rows: groupRows,
          };
        }),
      };
    })
    .filter((block) => block.groups.length);
}
