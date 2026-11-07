import type { WardFlowRole } from "@/components/ward-management/ward-flow-roles";

/**
 * The triage form's webPSOLIS pick-lists (Josh's decisions, 7 Nov 2026; review in
 * `docs/ward-flow/handover/2026-11-07-triage-psolis-picklists.md`).
 *
 * Each option is `[code, label, psolis]`:
 * - `code` is stable and is what the form keeps and signing records (`RECORD_TRIAGE_SIGNED`);
 * - `label` is the plain sentence-case words shown on screen;
 * - `psolis` is the value exactly as webPSOLIS spells it (including "LIASON"), which Copy and the
 *   summary write, or `null` for a Ward Flow step that has no PSOLIS value (Copy writes the label).
 *
 * These are system reference values, never records. Josh decided to build with the parts the
 * photos showed and leave the gaps marked (`PSOLIS_LIST_GAPS`), to fill when he sends the rest.
 * Order is the PSOLIS order; `*_COMMON` sets what shows before "More".
 *
 * This file imports no screen code, so the reducer and the stored-state check can read it.
 */
export type PsolisOption = readonly [code: string, label: string, psolis: string | null];

/** Gaps the source photos did not show. Keep each until Josh sends the missing part. */
export const PSOLIS_LIST_GAPS = [
  "Referral type: the list's label on PSOLIS was not visible, and one item after UNKNOWN was not seen",
  "Venue: one item after LOCK UP was not seen, and the list continues past REHAB CENTRE",
  "Problems: possibly one item after PHYSICAL PROBLEMS, and the list may continue past SUICIDAL IDEATION",
  "Action plan: one item after REFERRED TO COMMUNITY, PRIMARY CARE, NGO ETC, and the list continues past MHERL NOTIFIED",
  "Medium, Purpose, Reason, Consumer present, Associate present and Outcome were not opened; the form keeps its own lists",
] as const;

/** Venue (Details). Partial: see `PSOLIS_LIST_GAPS`. */
export const VENUES = [
  ["clinic", "Clinic", "CLINIC"],
  ["community-centre", "Community centre", "COMMUNITY CENTRE"],
  ["court", "Court", "COURT"],
  ["education", "Education facility", "EDUCATION FACILITY"],
  ["ed", "Emergency department", "EMERGENCY DEPARTMENT"],
  ["entertainment", "Entertainment venue", "ENTERTAINMENT VENUE"],
  ["general-hospital", "General hospital", "GENERAL HOSPITAL"],
  ["gh-outpatient", "General hospital outpatient clinic", "GENERAL HOSPITAL OUTPATIENT CLINIC"],
  ["gp", "GP surgery", "GP SURGERY"],
  ["group-home", "Group home", "GROUP HOME"],
  ["home", "Home or private dwelling", "HOME/PRIVATE DWELLING"],
  ["hostel", "Hostel", "HOSTEL"],
  ["inhouse-school", "In-house school", "INHOUSE SCHOOL"],
  ["lock-up", "Lock-up", "LOCK UP"],
  // GAP: one item after LOCK UP was not seen.
  ["nicu", "Neonatal intensive care unit", "NEONATAL INTENSIVE CARE UNIT"],
  ["nursing-home", "Nursing home", "NURSING HOME"],
  ["other-gov", "Other government organisation", "OTHER GOVERNMENT ORGANISATION"],
  ["police-station", "Police station", "POLICE STATION"],
  ["prison", "Prison", "PRISON"],
  ["psych-hospital", "Psychiatric hospital", "PSYCHIATRIC HOSPITAL"],
  ["public-space", "Public space", "PUBLIC SPACE"],
  ["rehab", "Rehab centre", "REHAB CENTRE"],
  // GAP: the list continues below REHAB CENTRE.
] as const satisfies readonly PsolisOption[];
export const VENUES_COMMON = ["ed", "general-hospital", "psych-hospital", "home", "clinic", "police-station"] as const;

/**
 * The referral list (Details, referral block). Its PSOLIS label was not visible; "Referral type" is
 * the working name. Partial: see `PSOLIS_LIST_GAPS`.
 */
export const REFERRAL_TYPES = [
  ["bro", "Breach release order", "BREACH RELEASE ORDER"],
  ["bail", "Condition of bail", "CONDITION OF BAIL"],
  ["correctional", "Correctional facility", "CORRECTIONAL FACILITY"],
  ["court", "Court", "COURT"],
  ["external-program", "External program", "EXTERNAL PROGRAM"],
  ["family", "Family or friend", "FAMILY / FRIEND"],
  ["hospital", "Hospital", "HOSPITAL"],
  ["medical", "Medical practitioner", "MEDICAL PRACTITIONER"],
  ["nursing-home", "Nursing home or hostel", "NURSING HOME/HOSTEL"],
  ["other-establishment", "Other establishment", "OTHER ESTABLISHMENT"],
  ["other-org", "Other organisation", "OTHER ORGANISATION"],
  ["police", "Police", "POLICE"],
  ["refuge", "Refuge", "REFUGE"],
  ["school", "School", "SCHOOL"],
  ["self", "Self", "SELF"],
  ["unknown", "Unknown", "UNKNOWN"],
  // GAP: one item after UNKNOWN was not seen.
] as const satisfies readonly PsolisOption[];
export const REFERRAL_TYPES_COMMON = ["self", "family", "medical", "hospital", "police", "court"] as const;

/** Problems (Problems tab, add many). Partial: see `PSOLIS_LIST_GAPS`. */
export const PSOLIS_PROBLEMS = [
  ["accommodation", "Accommodation problems", "ACCOMMODATION PROBLEMS"],
  ["adr", "Adverse drug reaction", "ADVERSE DRUG REACTION"],
  ["aggression", "Aggressive or threatening behaviour", "AGGRESSIVE/THREATENING BEHAVIOUR"],
  ["aod", "Alcohol or drugs", "ALCOHOL/DRUGS"],
  ["anxious", "Anxious", "ANXIOUS"],
  ["assault-victim", "Assault victim", "ASSAULT VICTIM"],
  ["cultural", "Cultural issues", "CULTURAL ISSUES"],
  ["dsh", "Deliberate self-harm", "DELIBERATE SELF HARM"],
  ["dementia", "Dementia-related behaviours", "DEMENTIA RELATED BEHAVIOURS"],
  ["depot", "Depot injection", "DEPOT INJECTION"],
  ["depressed", "Depressed mood", "DEPRESSED MOOD"],
  ["disturbed-thoughts", "Disturbed thoughts, delusions", "DISTURBED THOUGHTS, DELUSIONS ETC"],
  ["eating", "Eating disorder", "EATING DISORDER"],
  ["elevated", "Elevated mood or disinhibited behaviour", "ELEVATED MOOD AND/OR DISINHIBITED BEHAVIOUR"],
  [
    "emi-medication",
    "Existing illness: change in medication or treatment",
    "EXISTING MENTAL ILLNESS - ALTERATION IN MEDICATION/TREATMENT REGIME",
  ],
  [
    "emi-contact",
    "Existing illness: contact or information only",
    "EXISTING MENTAL ILLNESS - CONTACT/INFORMATION ONLY",
  ],
  ["emi-worse", "Existing illness: getting worse", "EXISTING MENTAL ILLNESS - EXACERBATION"],
  ["grief", "Grief or loss", "GRIEF/LOSS ISSUES"],
  ["homeless", "Homelessness", "HOMELESSNESS"],
  ["info-only", "Information only", "INFORMATION ONLY"],
  ["legal", "Legal problems", "LEGAL PROBLEMS"],
  ["medication", "Medication", "MEDICATION"],
  ["mood", "Mood disturbance", "MOOD DISTURBANCE"],
  ["other", "Other", "OTHER"],
  ["perceptual", "Perceptual disturbances", "PERCEPTUAL DISTURBANCES"],
  ["perinatal-loss", "Perinatal loss", "PERINATAL LOSS"],
  ["physical", "Physical problems", "PHYSICAL PROBLEMS"],
  // GAP: possibly one item after PHYSICAL PROBLEMS was not seen.
  ["behaviour", "Problematic behaviour", "PROBLEMATIC BEHAVIOUR"],
  ["coping", "Problems coping with daily roles", "PROBLEMS COPING WITH DAILY ROLES AND ACTIVITIES"],
  ["psychotic", "Psychotic symptoms", "PSYCHOTIC SYMPTOMS"],
  ["family", "Relationship or family problem", "RELATIONSHIP/FAMILY PROBLEM"],
  ["harm-others", "Risk of harm to others", "RISK OF HARM TO OTHERS"],
  ["harm-self", "Risk of harm to self", "RISK OF HARM TO SELF"],
  ["school", "School problems", "SCHOOL PROBLEMS"],
  ["sexual-abuse", "Sexual abuse", "SEXUAL ABUSE"],
  ["sexual-assault", "Sexual assault", "SEXUAL ASSAULT"],
  ["social", "Social or interpersonal (not family)", "SOCIAL INTERPERSONAL (OTHER THAN FAMILY PROBLEM)"],
  ["suicidal", "Suicidal ideation", "SUICIDAL IDEATION"],
  // GAP: the list may continue below SUICIDAL IDEATION.
] as const satisfies readonly PsolisOption[];
export const PROBLEMS_COMMON = [
  "suicidal",
  "dsh",
  "harm-self",
  "harm-others",
  "psychotic",
  "depressed",
  "anxious",
  "aod",
] as const;

/** How an action is grouped on screen (handover: Notified, Referred to, Advised, Done). */
export type ActionGroup = "notified" | "referred" | "advised" | "done";
export const ACTION_GROUP_LABEL: Readonly<Record<ActionGroup, string>> = {
  notified: "Notified",
  referred: "Referred to",
  advised: "Advised",
  done: "Done",
};

/**
 * Action plan (Action Plan tab, add many), in PSOLIS order, then the Ward Flow steps the form
 * already had that PSOLIS has no value for (`psolis: null`). Partial: see `PSOLIS_LIST_GAPS`.
 */
export const PSOLIS_ACTIONS = [
  ["child-protection", "Child protection notified", "DEPARTMENT OF CHILD PROTECTION NOTIFIED", "notified"],
  ["police", "Police notified", "POLICE NOTIFIED", "notified"],
  ["ambulance", "Ambulance notified", "AMBULANCE NOTIFIED", "notified"],
  ["ref-inpatient", "Referred to inpatient mental health", "REFERRED TO INPATIENT MENTAL HEALTH SERVICE", "referred"],
  [
    "ref-community-mh",
    "Referred to community mental health",
    "REFERRED TO COMMUNITY MENTAL HEALTH SERVICE",
    "referred",
  ],
  ["ref-ed", "Referred to ED", "REFERRED TO EMERGENCY DEPARTMENT", "referred"],
  ["ref-primary", "Referred to primary care or NGO", "REFERRED TO COMMUNITY, PRIMARY CARE, NGO ETC", "referred"],
  // GAP: one item after "REFERRED TO COMMUNITY, PRIMARY CARE, NGO ETC" was not seen.
  ["interpreter", "Interpreter booked", "INTERPRETER BOOKED", "done"],
  ["alo", "Aboriginal liaison officer notified", "ABORIGINAL LIASON OFFICER NOTIFIED", "notified"],
  ["other", "Other", "OTHER", "done"],
  ["adv-ambulance", "Advised to call ambulance", "ADVISED TO CALL AMBULANCE", "advised"],
  ["adv-police", "Advised to call police", "ADVISED TO CALL POLICE", "advised"],
  ["appointment", "Appointment set", "APPOINTMENT SET", "done"],
  ["duty-doctor", "Assessed by duty doctor", "ASSESSED BY DUTY DOCTOR", "done"],
  ["case-manager", "Case manager notified", "CASE MANAGER NOTIFIED", "notified"],
  ["call-back", "Clinician to call back", "CLINICIAN TO RETURN CALL TO CLIENT", "done"],
  ["community-team", "Community team notified", "COMMUNITY TEAM NOTIFIED", "notified"],
  ["counselled", "Counselled by triage or duty officer", "COUNSELLED BY TRIAGE/DUTY OFFICER", "done"],
  ["depot", "Depot given", "DEPOT GIVEN", "done"],
  ["info", "Information provided", "INFORMATION PROVIDED", "done"],
  ["invited", "Invited to present", "INVITED TO PRESENT", "advised"],
  ["med-resolved", "Medication issue resolved", "MEDICATION ISSUE RESOLVED", "done"],
  ["mherl", "MHERL notified", "MHERL NOTIFIED", "notified"],
  // GAP: the list continues below MHERL NOTIFIED.
  // Ward Flow steps with no PSOLIS value. They drive the form's follow-ups (bed request asks for
  // medical clearance; senior consulted asks who), so they stay.
  ["bed-request", "Bed request", null, "done"],
  ["intake", "Intake meeting", null, "done"],
  ["senior", "Senior consulted", null, "done"],
  ["gp-letter", "GP letter", null, "done"],
] as const satisfies readonly (readonly [code: string, label: string, psolis: string | null, group: ActionGroup])[];
export const ACTIONS_COMMON = [
  "bed-request",
  "senior",
  "police",
  "ambulance",
  "ref-community-mh",
  "appointment",
] as const;

/** The outcome "Referred on" asks for one of these. */
export const REFERRED_TO_ACTIONS = PSOLIS_ACTIONS.filter(([, , , group]) => group === "referred").map(([code]) => code);

/**
 * Stream and Program (Details). Program depends on Stream. These are synthetic site settings, keyed
 * by stream, never typed on screen. Partial: the Program list scrolled past what the photos show.
 */
export const STREAMS = [["rph-adult", "RPH adult", "RPH ADULT"]] as const satisfies readonly PsolisOption[];
export type StreamCode = (typeof STREAMS)[number][0];

export const PROGRAMS: Readonly<Record<StreamCode, readonly PsolisOption[]>> = {
  "rph-adult": [
    ["rph-cl-triage", "Consultation and liaison triage", "RPH CONSULTATION AND LIAISON TRIAGE"],
    ["rph-safe-haven", "Safe haven", "RPH SAFE HAVEN"],
    ["rph-aftercare", "Aftercare", "RPH AFTERCARE"],
    [
      "emhs-edss-triage",
      "Eating disorder specialist services triage",
      "EMHS EATING DISORDER SPECIALIST SERVICES (EMHS EDSS) TRIAGE",
    ],
    ["emhs-co-response", "Ambulance co-response, adult", "EMHS AMBULANCE CO-RESPONSE ADULT"],
    ["rph-ed-triage", "ED triage", "RPH ED TRIAGE"],
  ],
};

/** Each triaging desk's synthetic stream and default program. The clinician may Change the program. */
export const DESK_PROGRAM: Readonly<Partial<Record<WardFlowRole, { stream: StreamCode; program: string }>>> = {
  ed: { stream: "rph-adult", program: "rph-ed-triage" },
  community: { stream: "rph-adult", program: "rph-aftercare" },
  ward: { stream: "rph-adult", program: "rph-cl-triage" },
  coordinator: { stream: "rph-adult", program: "rph-cl-triage" },
};

/** The codes of a list, for closed-list checks. */
const codesOf = (list: readonly (readonly [string, ...unknown[]])[]): readonly string[] => list.map(([code]) => code);

export const VENUE_CODES = codesOf(VENUES);
export const REFERRAL_TYPE_CODES = codesOf(REFERRAL_TYPES);
export const PROBLEM_CODES = codesOf(PSOLIS_PROBLEMS);
export const ACTION_CODES = codesOf(PSOLIS_ACTIONS);

/** The most problems or actions one record may name (each list is under fifty). */
export const TRIAGE_MAX_PICKS = 60;

type AnyOption = readonly [code: string, label: string, psolis: string | null, ...rest: unknown[]];
const find = (list: readonly AnyOption[], code: string | null | undefined) =>
  code ? list.find(([value]) => value === code) : undefined;

/** The plain label for a code, or "" when the code is not on the list. */
export const labelOf = (list: readonly AnyOption[], code: string | null | undefined): string =>
  find(list, code)?.[1] ?? "";

/** What Copy writes for a code: the exact PSOLIS value, or the label for a Ward Flow-only step. */
export const psolisOf = (list: readonly AnyOption[], code: string | null | undefined): string => {
  const option = find(list, code);
  return option ? (option[2] ?? option[1]) : "";
};

/** Every program option, across streams, for label and value lookups. */
export const ALL_PROGRAMS: readonly PsolisOption[] = Object.values(PROGRAMS).flat();
