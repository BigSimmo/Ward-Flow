/**
 * Triage and risk (Josh's approved mock-up, Option D, 6 Nov 2026; built into the app 7 Nov 2026):
 * the static lists behind the combined mental health triage (SMHMR900) and risk assessment
 * (SMHMR905) form. Ported from the approved single-file prototype (`d-lean.html`). The people come
 * from the synthetic world, never from here. Nothing here is validated clinical decision support,
 * and there is no low, medium or high rating and no computed score.
 */
import type { Tier } from "./triage-record";
import { SIGNED_IN_COORDINATOR_NAME } from "@/components/ward-management/ward-staff-names-seed";

// The closed lists a signed triage records are kept with the record (`triage-record.ts`), so the
// reducer, the stored-state check and the patient record read them without this file.
export { LEGAL, OUTCOMES, REVIEW, TIER_LONG, TIER_SHORT, TIERS, type Tier } from "./triage-record";

/** A guide heading for a free-text box: the heading typed into the box, and what it should cover. */
type GuideItem = readonly [heading: string, cover: string];
export type GuideGroup = readonly [title: string, items: readonly GuideItem[]];

export const GUIDES: Readonly<Record<"note" | "rp", readonly GuideGroup[]>> = {
  note: [
    [
      "Presentation",
      [
        ["Why now", "What changed, since when, what tipped it today"],
        ["Request", "What the referrer asks, and how soon"],
        ["Views", "The person's and carer's view; any opposition"],
      ],
    ],
    [
      "Background",
      [
        ["History", "Diagnoses, admissions, team, past treatment"],
        ["Medication", "Current medicines, depot due, adherence, recent changes"],
        ["Alcohol and drugs", "What, how much, last use, withdrawal risk"],
        ["Physical health", "Conditions, overdose or head injury, medical clearance, pregnancy, delirium"],
        ["Social", "Housing, dependants and where they are now, supports"],
        ["Forensic", "Charges, orders, recent release, police contact"],
      ],
    ],
    ["Other", [["Culture and communication", "Language, cultural needs, sensory or communication needs"]]],
  ],
  rp: [
    [
      "Formulation",
      [
        ["Risk", "Who is at risk, of what, how soon; now against their baseline"],
        ["Protective", "People, reasons for living, engagement, what has helped before"],
        ["Warning signs", "What would show it is getting worse"],
        ["Would change it", "Intoxication, leave, losses, stopping treatment"],
      ],
    ],
    [
      "Safety plan",
      [
        ["Plan", "Where they go next, observation level, environment"],
        ["Means safety", "What is removed or held, and by whom"],
        ["Crisis", "If it worsens: who to call 24/7 and what each person does"],
        ["Follow-up", "Who sees them and when; plan made with the person; copy to person, carer, GP"],
      ],
    ],
  ],
};

export const FORMULATION_HEADINGS = ["Risk", "Protective", "Warning signs", "Would change it"] as const;

type Factor = readonly [id: string, name: string];
export type RiskArea = { id: string; name: string; bg: readonly Factor[]; now: readonly Factor[] };

/** Every RAMP factor, by area: background (history) and now (current). */
export const AREAS: readonly RiskArea[] = [
  {
    id: "general",
    name: "General",
    bg: [
      ["mpi", "Major psychiatric illness"],
      ["pd", "Diagnosed personality disorder"],
      ["aod", "Significant alcohol or drug use"],
      ["med", "Serious medical condition"],
      ["id", "Intellectual disability or cognitive deficit"],
      ["bd", "Behavioural disorder under 18"],
      ["ca", "Childhood abuse or maladjustment"],
    ],
    now: [
      ["dis", "Disorientation or disorganisation"],
      ["imp", "Disinhibited, intrusive or impulsive"],
      ["intox", "Intoxication or withdrawal"],
      ["pain", "Significant physical pain"],
      ["agit", "Distress or agitation"],
    ],
  },
  {
    id: "suicide",
    name: "Suicide and self-harm",
    bg: [
      ["att", "Previous suicide attempts"],
      ["sh", "Other self-harm"],
      ["fh", "Family history of suicide"],
      ["sep", "Separated, widowed or divorced"],
      ["iso", "Isolated or unsupported"],
    ],
    now: [
      ["life", "Recent significant life events"],
      ["hope", "Hopelessness or despair"],
      ["dist", "High distress"],
      ["idea", "Suicidal ideas"],
      ["shnow", "Self-harming"],
      ["plan", "Current plan or intent"],
      ["means", "Access to means"],
    ],
  },
  {
    id: "violence",
    name: "Violence and aggression",
    bg: [
      ["prev", "Previous violence"],
      ["weap", "Previous use of weapons"],
      ["for", "Forensic history"],
      ["vid", "Previous violent ideation"],
      ["pred", "Predatory behaviour"],
    ],
    now: [
      ["cur", "Recent or current violence"],
      ["cmd", "Command hallucinations"],
      ["vro", "Violence restraining order"],
      ["para", "Paranoid ideas about others"],
      ["intent", "Intent to harm others"],
      ["ang", "Anger or agitation"],
      ["ctl", "Reduced self-control"],
      ["vmeans", "Access to means"],
      ["vuln", "Contact with vulnerable people"],
    ],
  },
  {
    id: "other",
    name: "Vulnerability and other",
    bg: [
      ["abs", "Absconding"],
      ["vic", "Physical or sexual victimisation"],
      ["fin", "Financial vulnerability"],
      ["fall", "Falls or accidents"],
      ["harmch", "Harm to children or dependants"],
      ["exp", "Exploitation"],
      ["negl", "Neglect of a serious medical condition"],
      ["nonad", "Non-adherence"],
      ["fdvh", "Family and domestic violence"],
      ["home", "Risk of homelessness"],
      ["nfa", "No fixed address"],
    ],
    now: [
      ["leave", "Wants to leave hospital"],
      ["sexex", "Vulnerable to sexual exploitation"],
      ["delu", "Current delusional beliefs"],
      ["phys", "Physical illness"],
      ["parent", "Parent or carer of children"],
      ["self", "Self-neglect"],
      ["nonadn", "Not taking treatment"],
      ["judg", "Impaired judgement or self-control"],
      ["fdvn", "Family and domestic violence"],
      ["homen", "Risk of homelessness"],
      ["nfan", "No fixed address"],
      ["drive", "Driving"],
      ["recdis", "Recent discharge (28 days)"],
      ["sexsafe", "Sexual safety concern"],
    ],
  },
];

/** A group of flags on the form, by key; each flag's name is its factor name (one name per factor). */
export type FlagGroup = readonly [group: string, flags: readonly string[]];

/** The past-risk flags shown on the form (keys are `area.bg.factor`). */
export const FLAGS_PAST: readonly FlagGroup[] = [
  ["Suicide", ["suicide.bg.att", "suicide.bg.sh"]],
  ["Violence", ["violence.bg.prev", "violence.bg.weap", "violence.bg.for"]],
  ["Other", ["other.bg.abs", "general.bg.aod", "other.bg.vic", "other.bg.nonad"]],
];

/** The current-risk flags shown on the form (keys are `area.now.factor`). Never carried forward. */
export const FLAGS_NOW: readonly FlagGroup[] = [
  ["Suicide", ["suicide.now.idea", "suicide.now.plan", "suicide.now.means", "suicide.now.hope", "suicide.now.shnow"]],
  [
    "Violence",
    ["violence.now.cur", "violence.now.intent", "violence.now.cmd", "violence.now.vmeans", "violence.now.para"],
  ],
  [
    "Other",
    [
      "general.now.intox",
      "general.now.agit",
      "other.now.leave",
      "other.now.parent",
      "other.now.nonadn",
      "other.now.self",
      "other.now.sexex",
      "other.now.recdis",
      "other.now.sexsafe",
    ],
  ],
];

/** What each flag means (the "What each flag means" pop-out and each flag's hover title). */
export const FLAG_INFO: Readonly<Record<string, string>> = {
  "suicide.bg.att": "Any past suicide attempt. Note when, method and lethality.",
  "suicide.bg.sh": "Self-injury at any time, with or without suicidal intent.",
  "violence.bg.prev": "Any physical violence to people, including in hospital.",
  "violence.bg.weap": "Has carried or used a weapon or object to threaten or harm.",
  "violence.bg.for": "Charges, convictions, orders or prison, especially for violence.",
  "other.bg.abs": "Has left hospital or care without agreement before.",
  "general.bg.aod": "Use that has harmed health, safety or mental state.",
  "other.bg.vic": "Past physical, sexual or family violence against the person.",
  "other.bg.nonad": "Has stopped or refused treatment before, often before relapse.",
  "suicide.now.idea": "Thoughts of ending their life now or in recent days.",
  "suicide.now.plan": "A plan, preparation or stated intent to act. Ask directly.",
  "suicide.now.means": "Can reach what they would use: medicines, firearms, ligatures, heights.",
  "suicide.now.hope": "Sees no future or way out. A strong short-term warning sign.",
  "suicide.now.shnow": "Any self-harm in recent weeks, including today.",
  "violence.now.cur": "Violence or damage in recent days, including in ED.",
  "violence.now.intent": "Threats or a stated wish to harm someone.",
  "violence.now.cmd": "Voices telling them to harm themselves or others.",
  "violence.now.vmeans": "Can reach a weapon now.",
  "violence.now.para": "Believes others mean harm and may act to defend themselves.",
  "general.now.intox": "Alcohol or drugs on board, or withdrawal. Affects judgement and assessment.",
  "general.now.agit": "High arousal, restlessness or distress now.",
  "other.now.leave": "Wants or tries to leave care now.",
  "other.now.parent": "Cares for children or others who may be at risk or unsupervised.",
  "other.now.nonadn": "Missed or stopped medicines or a depot recently.",
  "other.now.self": "Not eating, drinking, washing or managing basic needs.",
  "other.now.sexex": "Others may take advantage: sexual, financial or other.",
  "other.now.recdis": "Left hospital in the last 28 days, a high-risk period.",
  "other.now.sexsafe": "Risk of sexual harm to or from others, in care or at home.",
};

export type MseDomain = {
  id: string;
  label: string;
  lookFor: string;
  phrases: readonly string[];
  detailHint: string;
};

/** The eight mental state domains, in the order their lines are kept. Nothing is assumed normal. */
export const MSE: readonly MseDomain[] = [
  {
    id: "app",
    label: "Appearance and behaviour",
    lookFor: "Dress, hygiene, injuries, eye contact, rapport, agitation, psychomotor change, signs of intoxication.",
    phrases: [
      "Well kempt",
      "Dishevelled",
      "Poor hygiene",
      "Cooperative",
      "Good rapport",
      "Guarded",
      "Hostile",
      "Withdrawn",
      "Tearful",
      "Disinhibited",
      "Overfamiliar",
      "Good eye contact",
      "Poor eye contact",
      "Agitated",
      "Restless",
      "Slowed",
      "Bizarre behaviour",
      "Visible injuries",
      "Intoxicated",
    ],
    detailHint: "Detail, e.g. pacing, poor eye contact",
  },
  {
    id: "speech",
    label: "Speech",
    lookFor: "Rate, volume, tone, latency, and whether you can interrupt.",
    phrases: [
      "Normal rate and volume",
      "Pressured",
      "Hard to interrupt",
      "Rapid",
      "Slowed",
      "Increased latency",
      "Loud",
      "Quiet",
      "Monotonous",
      "Sparse",
      "Slurred",
      "Mute",
      "Interpreter used",
    ],
    detailHint: "Detail",
  },
  {
    id: "mood",
    label: "Mood and affect",
    lookFor: "Mood in their own words; affect you observe: range, reactivity, congruence.",
    phrases: [
      "Euthymic",
      "Depressed",
      "Anxious",
      "Irritable",
      "Angry",
      "Fearful",
      "Hopeless",
      "Elevated",
      "Labile",
      "Reactive affect",
      "Restricted affect",
      "Blunted",
      "Flat affect",
      "Congruent",
      "Incongruent",
    ],
    detailHint: 'Their words, e.g. "I just need sleep"',
  },
  {
    id: "tf",
    label: "Thought form",
    lookFor: "How thoughts link: logical, circumstantial, tangential, flight of ideas, blocking.",
    phrases: [
      "Logical",
      "Goal directed",
      "Circumstantial",
      "Tangential",
      "Flight of ideas",
      "Derailment",
      "Loosened associations",
      "Perseveration",
      "Neologisms",
      "Thought block",
      "Disorganised",
    ],
    detailHint: "Detail",
  },
  {
    id: "tc",
    label: "Thought content",
    lookFor: "Delusions, preoccupations, obsessions, suicidal or violent thoughts. Ask directly.",
    phrases: [
      "No delusions elicited",
      "Persecutory delusions",
      "Grandiose delusions",
      "Ideas of reference",
      "Passivity phenomena",
      "No suicidal thoughts",
      "Suicidal thoughts",
      "Suicidal plan",
      "Suicidal intent",
      "Hopelessness",
      "Guilt",
      "No thoughts of harming others",
      "Thoughts of harming others",
      "Obsessions",
      "Preoccupations",
    ],
    detailHint: "Detail, e.g. themes",
  },
  {
    id: "perc",
    label: "Perception",
    lookFor: "Hallucinations by type, responding to unseen stimuli. Ask about commands.",
    phrases: [
      "No perceptual disturbance",
      "Auditory hallucinations",
      "Command hallucinations",
      "Second person voices",
      "Third person voices",
      "Visual hallucinations",
      "Tactile hallucinations",
      "Olfactory hallucinations",
      "Responding to unseen stimuli",
      "Denies, appears distracted",
    ],
    detailHint: "Detail",
  },
  {
    id: "cog",
    label: "Cognition",
    lookFor: "Alertness, orientation, attention, memory. Note sedation or intoxication.",
    phrases: [
      "Alert",
      "Oriented",
      "Disoriented",
      "Attention intact",
      "Poor attention",
      "Memory grossly intact",
      "Memory impaired",
      "Fluctuating",
      "Drowsy or sedated",
      "Not formally tested",
    ],
    detailHint: "Detail",
  },
  {
    id: "ins",
    label: "Insight and judgement",
    lookFor: "Do they see a problem, their view of treatment, and capacity for this decision.",
    phrases: [
      "Full insight",
      "Partial insight",
      "No insight",
      "Judgement intact",
      "Judgement impaired",
      "Impulsive",
      "Help seeking",
      "Accepts treatment",
      "Declines treatment",
      "Has capacity for this decision",
      "Lacks capacity for this decision",
    ],
    detailHint: "Detail",
  },
];

/** Phrases that cannot both be true: choosing one side replaces the other (and says so). */
export const MSE_VS: readonly (readonly [domain: string, one: readonly string[], other: readonly string[]])[] = [
  ["app", ["Well kempt"], ["Dishevelled"]],
  ["app", ["Cooperative"], ["Hostile"]],
  ["app", ["Well kempt"], ["Poor hygiene"]],
  ["app", ["Good eye contact"], ["Poor eye contact"]],
  ["app", ["Good rapport"], ["Hostile", "Guarded"]],
  [
    "speech",
    ["Normal rate and volume"],
    [
      "Pressured",
      "Rapid",
      "Slowed",
      "Increased latency",
      "Loud",
      "Quiet",
      "Monotonous",
      "Sparse",
      "Slurred",
      "Mute",
      "Hard to interrupt",
    ],
  ],
  ["speech", ["Pressured", "Rapid"], ["Slowed", "Sparse", "Mute", "Increased latency"]],
  ["speech", ["Loud"], ["Quiet"]],
  ["mood", ["Euthymic"], ["Depressed", "Anxious", "Irritable", "Angry", "Fearful", "Hopeless", "Elevated", "Labile"]],
  ["mood", ["Reactive affect"], ["Restricted affect", "Blunted", "Flat affect"]],
  ["mood", ["Congruent"], ["Incongruent"]],
  [
    "tf",
    ["Logical", "Goal directed"],
    [
      "Circumstantial",
      "Tangential",
      "Flight of ideas",
      "Derailment",
      "Loosened associations",
      "Perseveration",
      "Neologisms",
      "Thought block",
      "Disorganised",
    ],
  ],
  [
    "tc",
    ["No delusions elicited"],
    ["Persecutory delusions", "Grandiose delusions", "Ideas of reference", "Passivity phenomena"],
  ],
  ["tc", ["No suicidal thoughts"], ["Suicidal thoughts", "Suicidal plan", "Suicidal intent"]],
  ["tc", ["No thoughts of harming others"], ["Thoughts of harming others"]],
  [
    "perc",
    ["No perceptual disturbance"],
    [
      "Auditory hallucinations",
      "Command hallucinations",
      "Second person voices",
      "Third person voices",
      "Visual hallucinations",
      "Tactile hallucinations",
      "Olfactory hallucinations",
      "Responding to unseen stimuli",
      "Denies, appears distracted",
    ],
  ],
  ["cog", ["Oriented"], ["Disoriented"]],
  ["cog", ["Alert"], ["Drowsy or sedated", "Fluctuating"]],
  ["cog", ["Attention intact"], ["Poor attention"]],
  ["cog", ["Memory grossly intact"], ["Memory impaired"]],
  ["ins", ["Full insight"], ["Partial insight", "No insight"]],
  ["ins", ["Partial insight"], ["No insight"]],
  ["ins", ["Accepts treatment"], ["Declines treatment"]],
  ["ins", ["Judgement intact"], ["Judgement impaired"]],
  ["ins", ["Has capacity for this decision"], ["Lacks capacity for this decision"]],
];

/** A mental state phrase that suggests a current risk flag (a suggestion chip, never automatic). */
export const MSE_TO_RISK: readonly (readonly [domain: string, phrase: string, flag: string])[] = [
  ["tc", "Suicidal thoughts", "suicide.now.idea"],
  ["tc", "Suicidal plan", "suicide.now.plan"],
  ["tc", "Hopelessness", "suicide.now.hope"],
  ["mood", "Hopeless", "suicide.now.hope"],
  ["tc", "Thoughts of harming others", "violence.now.intent"],
  ["perc", "Command hallucinations", "violence.now.cmd"],
  ["tc", "Persecutory delusions", "violence.now.para"],
  ["app", "Intoxicated", "general.now.intox"],
  ["app", "Agitated", "general.now.agit"],
];

/**
 * Mental state phrases that contradict a current factor being covered by "Not present": a factor
 * with any of these in the mental state is listed as a conflict to check, never silently covered.
 */
export const MSE_SIGNALS: readonly (readonly [
  flag: string,
  signs: readonly (readonly [domain: string, phrase: string])[],
])[] = [
  [
    "other.now.delu",
    [
      ["tc", "Persecutory delusions"],
      ["tc", "Grandiose delusions"],
      ["tc", "Ideas of reference"],
      ["tc", "Passivity phenomena"],
    ],
  ],
  ["violence.now.para", [["tc", "Persecutory delusions"]]],
  ["suicide.now.idea", [["tc", "Suicidal thoughts"]]],
  [
    "suicide.now.plan",
    [
      ["tc", "Suicidal plan"],
      ["tc", "Suicidal intent"],
    ],
  ],
  [
    "suicide.now.hope",
    [
      ["tc", "Hopelessness"],
      ["mood", "Hopeless"],
    ],
  ],
  ["violence.now.intent", [["tc", "Thoughts of harming others"]]],
  ["violence.now.cmd", [["perc", "Command hallucinations"]]],
  ["general.now.intox", [["app", "Intoxicated"]]],
  [
    "general.now.agit",
    [
      ["app", "Agitated"],
      ["app", "Restless"],
    ],
  ],
  [
    "violence.now.ang",
    [
      ["mood", "Angry"],
      ["app", "Hostile"],
    ],
  ],
  [
    "general.now.imp",
    [
      ["app", "Disinhibited"],
      ["ins", "Impulsive"],
    ],
  ],
  [
    "other.now.judg",
    [
      ["ins", "Judgement impaired"],
      ["ins", "Impulsive"],
      ["ins", "Lacks capacity for this decision"],
    ],
  ],
  [
    "general.now.dis",
    [
      ["cog", "Disoriented"],
      ["tf", "Disorganised"],
    ],
  ],
  ["other.now.nonadn", [["ins", "Declines treatment"]]],
  ["other.now.self", [["app", "Poor hygiene"]]],
];

/** A flag marked present while the mental state says the opposite: a "Check" before signing. */
export const MSE_NEGATIVES: readonly (readonly [domain: string, phrase: string, flag: string])[] = [
  ["tc", "No suicidal thoughts", "suicide.now.idea"],
  ["tc", "No suicidal thoughts", "suicide.now.plan"],
  ["tc", "No thoughts of harming others", "violence.now.intent"],
  ["perc", "No perceptual disturbance", "violence.now.cmd"],
  ["tc", "No delusions elicited", "other.now.delu"],
  ["tc", "No delusions elicited", "violence.now.para"],
];

/** Factors a disclosed or suspected family violence screen contradicts as "Not present". */
export const FDV_FACTORS = ["other.now.fdvn", "other.bg.fdvh"] as const;

/** A current flag (or area prefix) that suggests a problem, as a PSOLIS problem code (`triage-psolis-lists.ts`). */
export const RISK_TO_PROBLEM: readonly (readonly [prefix: string, problem: string])[] = [
  ["suicide.now", "harm-self"],
  ["violence.now", "harm-others"],
  ["general.now.intox", "aod"],
  ["other.now.self", "physical"],
];

/** Flags that bring the "Consider A or B. You choose." hint. A hint only, never a choice. */
export const ACUTE_FLAGS = [
  "suicide.now.plan",
  "suicide.now.shnow",
  "violence.now.intent",
  "violence.now.cur",
  "violence.now.cmd",
] as const;

/** The family and domestic violence screen, word for word. The fourth shows only after a yes. */
export const FDV_QUESTIONS = [
  ["q1", "Are you ever afraid of somebody in your home, a partner or an ex-partner?"],
  ["q2", "Has anyone in your family, household, or from a previous relationship, ever threatened to hurt you?"],
  ["q3", "Are you worried about the safety of your children or someone else in your family or household?"],
  ["q4", "If yes, would you like help with this now?"],
] as const;

export const FDV_NOT_ASKED = [
  ["others", "Others present"],
  ["declined", "Declined"],
  ["unwell", "Too unwell"],
  ["phone", "Phone, not private"],
  ["interp", "No interpreter"],
] as const;

/** Who was told, for urgency A, as action codes (`PSOLIS_ACTIONS`): one of these, or None needed with a reason. */
export const WHO_TOLD = [
  ["police", "Police"],
  ["ambulance", "Ambulance"],
  ["senior", "Senior"],
] as const;

/**
 * Short legal names for smaller screens (Josh, 7 Nov 2026: full words on larger screens, "CTO" on
 * smaller). Only the hero figure and chip use them; the form and the document keep full words.
 */
export const LEGAL_SHORT: Readonly<Record<string, string>> = {
  "Community treatment order": "CTO",
  "Inpatient treatment order": "ITO",
  "Referred (Form 1A)": "Referred",
  "Not yet recorded": "Not recorded",
};
/** Legal statuses with a form, whose form and date are kept only as typed. */
export const LEGAL_WITH_FORM: readonly string[] = ["ref", "det", "cto", "ito"];

export const HOW = [
  ["person", "In person"],
  ["phone", "Phone"],
  ["video", "Video"],
  ["other", "Other"],
] as const;

export const PURPOSE = ["Referral", "Assessment", "Information", "GP advice", "GP liaison"] as const;
export const EPISODE = [
  ["ED", "ED episode"],
  ["Inpatient", "Inpatient episode"],
  ["Other", "Other episode"],
] as const;
export const ATSI = [
  ["a", "Aboriginal"],
  ["t", "Torres Strait"],
  ["b", "Both"],
  ["n", "Neither"],
  ["ns", "Not stated"],
] as const;
export const AMHW = [
  ["offered", "Offered"],
  ["accepted", "Accepted"],
  ["declined", "Declined"],
  ["na", "Not available"],
] as const;
/**
 * Interpreter needed: No, Yes, or Needed, not available, each of the last two with the language
 * (7 Nov 2026). Josh kept "Needed, not available": it records a real barrier to the assessment.
 */
export const INTERPRETER = [
  ["no", "No"],
  ["yes", "Yes"],
  ["unavail", "Needed, not available"],
] as const;
/** How the person arrived (7 Nov 2026). */
export const ARRIVED_BY = [
  "Self",
  "Family or friend",
  "Ambulance",
  "Police",
  "Mental health team",
  "GP or other service",
  "Transfer from another hospital",
  "Other",
] as const;
/** Others present at the review. */
export const OTHERS_PRESENT = ["Family or carer", "Other service", "Police", "Security"] as const;
export const AHD = [
  ["none", "None known"],
  ["ahd", "Advance health directive"],
  ["guard", "Guardian"],
  ["unk", "Not asked"],
] as const;
export const COPY_TO = ["Person", "Carer", "GP"] as const;
/** Sources used (collateral), chosen in Review details. */
export const SOURCES = ["Person", "Family or carer", "GP", "Records", "Police", "Other"] as const;

/**
 * The last signed triage on record for the person, read from the workspace (`RECORD_TRIAGE_SIGNED`).
 * Codes only: the earlier formulation, plan and history were typed and are never kept, so a later
 * triage carries forward flags alone and every typed answer is written fresh.
 */
export type PreviousTriage = {
  /** "Last triage · 07 Nov · Dr S. Orlenby". */
  label: string;
  /** "07 Nov", for "Carried from 07 Nov". */
  when: string;
  urgencyText: string;
  /** Who signed it, in words; left out on a fixture that does not say. */
  by?: string;
  outcome: string;
  legal: string;
  review: string;
  /** Past (history) factors marked present then: the only thing Carry forward brings. */
  pastFlags: readonly string[];
  pastSummary: string;
  /** Current factors marked present then, only to say what is new today. Never carried forward. */
  nowFlags: readonly string[];
};

/** The referral a triage answers, as the record holds it. */
export type TriageReferral = {
  id: string;
  /** Who sent it, in words. */
  from: string;
  /** The urgency the referrer asked for, when they asked for a tier. */
  urgency: Tier | null;
  /** The episode the referral opens, when it names one. */
  episode: string | null;
  /** Who referred, when the referral names them (synthetic). */
  referrer: { name: string; role: string; phone: string } | null;
  /** When it came in, as the referral records it. */
  received: string | null;
};

/**
 * Who a triage is for, read from the record (synthetic). The banner, the record tabs and the summary
 * read this; nothing in it is an answer on the form.
 */
export type TriagePerson = {
  /** The record id the patient record opens on. */
  id: string;
  /** Surname first: "Ridgewell, Ada". */
  name: string;
  meta: string;
  umrn: string;
  dob: string;
  nowAt: string;
  team: string;
  /** Legal status as typed on the record, or null when none is recorded. */
  legal: string | null;
  legalTag: string;
  alert: string | null;
  alertCount: number;
  /** Every alert on the record, allergies aside, for the Alerts tab; `alert` alone when left out. */
  alerts?: readonly string[];
  allergies: string;
  referral: TriageReferral | null;
  /** The last signed triage on record, or null ("No previous triage on record"). */
  last: PreviousTriage | null;
  /** Every earlier signed triage on record, newest first (`last` is the first); none when left out. */
  previous?: readonly PreviousTriage[];
  /** The app address of the person's record. */
  recordHref: string;
};

/** The signed-in clinician in the synthetic world, who reviews and signs. */
export const SIGNED_IN = SIGNED_IN_COORDINATOR_NAME;

/** Where each PSOLIS field went on this form. Copy and the summary write the exact PSOLIS value for each pick-list. */
export const PSOLIS_FIELD_MAP = [
  ["DMR publishing", "Episode (one tap)"],
  ["Start date and time", "Reviewed, with Now"],
  ["End date and time", "Stamped when you sign"],
  ["Is transcribed", "Notes source chip"],
  ["Arrival mode, accompanied by", "Arrived by, accompanied by (Review details)"],
  ["Interpreter required, language", "Interpreter needed, with the language"],
  ["Triaged by, designation", "From your login"],
  ["Medium", "How"],
  ["Stream, program", "From your desk, with Change (that stream's programs only)"],
  ["Venue, collected at", "Where they were: common venues, then More for the PSOLIS list"],
  ["Consumer and associate present", "Person present, others present"],
  ["Referral type", "Referral type: common types, then More for the PSOLIS list"],
  ["Referral medium, name, contact", "From the referral: referrer name, role and phone, with Change"],
  ["Purpose", "Purpose"],
  ["Reason", "Assessment box (Why now, Request)"],
  ["Urgency", "Urgency tiles"],
  ["Outcome", "Outcome"],
  ["Problems and comments", "Problem chips from the PSOLIS list, then More; detail in the box"],
  [
    "History, medical, treatments, drug and alcohol, social, forensic, MSE, formulation, communication (9 boxes)",
    "One Assessment box with a guide",
  ],
  ["Mental state examination", "Mental state section: tap what you observed, add detail"],
  ["Action plan, referred on", "Action chips from the PSOLIS list, then More"],
  ["Participants", "Author added; consult line"],
  ["Advance health directive, legal status", "Triage decision"],
  ["Consumer and carer aware", "Aware of referral chips"],
  ["RAMP: background factors", "Past risk, carried from the last RAMP and checked"],
  ["RAMP: current factors", "Current risk, assessed today"],
  ["RAMP: FDV", "Risk factors, family violence block"],
  ["RAMP: other (specify)", "Other risk: add any number, past or current"],
  ["RAMP: overview, protective, overall risk, plan", "Formulation and plan"],
  ["RAMP: sources", "Sources used chips (Review details)"],
  ["RAMP: schedule, next due", "Review risk by"],
  ["RAMP: consultation", "Consulted with (from Senior consulted)"],
  ["Address, phone, contacts", "Not entered here; Patient profile"],
] as const;

export const SECTIONS = [
  { id: "rev", n: 1, label: "Review details", part: "triage" },
  { id: "note", n: 2, label: "Assessment", part: "triage" },
  { id: "mse", n: 3, label: "Mental state", part: "triage" },
  { id: "dec", n: 4, label: "Triage decision", part: "triage" },
  { id: "risk", n: 5, label: "Risk assessment", part: "risk" },
  { id: "plan", n: 6, label: "Formulation and plan", part: "risk" },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];

/** Full factor names and area names, keyed `area.kind.factor` and `area`. */
export const FACTOR_NAME: Readonly<Record<string, string>> = Object.fromEntries(
  AREAS.flatMap((area) =>
    (["bg", "now"] as const).flatMap((kind) => area[kind].map(([id, name]) => [`${area.id}.${kind}.${id}`, name])),
  ),
);
export const AREA_NAME: Readonly<Record<string, string>> = Object.fromEntries(AREAS.map((a) => [a.id, a.name]));
