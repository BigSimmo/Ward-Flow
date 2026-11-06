/**
 * Triage and risk mock-up (Option D, 6 Nov 2026): the static lists behind the combined mental health
 * triage (SMHMR900) and risk assessment (SMHMR905) form. Ported from the approved single-file
 * prototype (`d-lean.html`). Synthetic data only: the patient, the referral, the previous triage and
 * every contact here are invented. Nothing here is validated clinical decision support, and there is
 * no low, medium or high rating and no computed score.
 */

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

export const PROBLEMS = [
  "Psychosis",
  "Mood",
  "Anxiety",
  "Self-harm",
  "Aggression",
  "Alcohol or drugs",
  "Cognitive",
  "Accommodation",
  "Cultural",
  "Assault victim",
  "Adverse drug reaction",
  "Physical health",
] as const;

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

export type FlagGroup = readonly [group: string, flags: readonly Factor[]];

/** The past-risk flags shown on the form (keys are `area.bg.factor`). */
export const FLAGS_PAST: readonly FlagGroup[] = [
  [
    "Suicide",
    [
      ["suicide.bg.att", "Previous attempts"],
      ["suicide.bg.sh", "Previous self-harm"],
    ],
  ],
  [
    "Violence",
    [
      ["violence.bg.prev", "Previous violence"],
      ["violence.bg.weap", "Previous use of weapons"],
      ["violence.bg.for", "Forensic history"],
    ],
  ],
  [
    "Other",
    [
      ["other.bg.abs", "Absconding"],
      ["general.bg.aod", "Significant alcohol or drug use"],
      ["other.bg.vic", "Victim of violence or abuse"],
      ["other.bg.nonad", "Non-adherence"],
    ],
  ],
];

/** The current-risk flags shown on the form (keys are `area.now.factor`). Never carried forward. */
export const FLAGS_NOW: readonly FlagGroup[] = [
  [
    "Suicide",
    [
      ["suicide.now.idea", "Suicidal ideas"],
      ["suicide.now.plan", "Plan or intent"],
      ["suicide.now.means", "Access to means"],
      ["suicide.now.hope", "Hopelessness"],
      ["suicide.now.shnow", "Recent self-harm"],
    ],
  ],
  [
    "Violence",
    [
      ["violence.now.cur", "Recent violence"],
      ["violence.now.intent", "Intent to harm others"],
      ["violence.now.cmd", "Command hallucinations"],
      ["violence.now.vmeans", "Access to weapons"],
      ["violence.now.para", "Paranoid ideas about others"],
    ],
  ],
  [
    "Other",
    [
      ["general.now.intox", "Intoxicated or withdrawing"],
      ["general.now.agit", "Distress or agitation"],
      ["other.now.leave", "Wants to leave"],
      ["other.now.parent", "Children or dependants"],
      ["other.now.nonadn", "Not taking treatment"],
      ["other.now.self", "Self-neglect"],
      ["other.now.sexex", "Vulnerable to exploitation"],
      ["other.now.recdis", "Recent discharge"],
      ["other.now.sexsafe", "Sexual safety concern"],
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

/** A current flag (or area prefix) that suggests a problem chip. */
export const RISK_TO_PROBLEM: readonly (readonly [prefix: string, problem: string])[] = [
  ["suicide.now", "Self-harm"],
  ["violence.now", "Aggression"],
  ["general.now.intox", "Alcohol or drugs"],
  ["other.now.self", "Physical health"],
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
] as const;

/** Urgency tiers A to G. The clinician always chooses; the form only hints. */
export const TIERS = [
  ["A", "Now", "Immediate"],
  ["B", "2 h", "Within 2 hours"],
  ["C", "12 h", "Within 12 hours"],
  ["D", "48 h", "Within 48 hours"],
  ["E", "2 wk", "Within 2 weeks"],
  ["F", "Recontact", "Further triage contact"],
  ["G", "No action", "No further action"],
] as const;
export type Tier = (typeof TIERS)[number][0];
export const TIER_LONG = Object.fromEntries(TIERS.map(([tier, , long]) => [tier, long])) as Record<Tier, string>;
export const TIER_SHORT = Object.fromEntries(TIERS.map(([tier, short]) => [tier, short])) as Record<Tier, string>;

export const ACTIONS = [
  ["Intake meeting", "Intake meeting"],
  ["Bed request", "Bed request"],
  ["Police notified", "Police"],
  ["Ambulance notified", "Ambulance"],
  ["Aboriginal MH worker notified", "Aboriginal MH worker"],
  ["Child protection notified", "Child protection"],
  ["Senior consulted", "Senior consulted"],
  ["Refer community team", "Refer community team"],
  ["GP letter", "GP letter"],
] as const;

export const LEGAL = [
  ["vol", "Voluntary", "Vol"],
  ["ref", "Referred (Form 1A)", "1A"],
  ["det", "Detained", "Det"],
  ["cto", "CTO", "CTO"],
  ["ito", "Inpatient order", "ITO"],
  ["nyr", "Not yet recorded", "NYR"],
] as const;
/** Legal statuses with a form, whose form and date are kept only as typed. */
export const LEGAL_WITH_FORM: readonly string[] = ["ref", "det", "cto", "ito"];

export const REVIEW = [
  ["24h", "24 hours"],
  ["72h", "72 hours"],
  ["7d", "7 days"],
  ["move", "At transfer"],
  ["dis", "At discharge"],
] as const;

export const HOW = [
  ["person", "In person"],
  ["phone", "Phone"],
  ["video", "Video"],
  ["other", "Other"],
] as const;

export const WHERE = ["ED", "Ward", "Clinic", "Home", "Custody", "Other"] as const;
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
export const INTERPRETER = [
  ["no", "Not needed"],
  ["used", "Used"],
  ["na", "Needed, not available"],
] as const;
export const OUTCOMES = ["Accepted", "Referred on", "Advice only", "No further action"] as const;
export const AHD = [
  ["none", "None known"],
  ["ahd", "Advance health directive"],
  ["guard", "Guardian"],
  ["unk", "Not asked"],
] as const;
export const COPY_TO = ["Person", "Carer", "GP"] as const;
export const SOURCES = ["Person", "Carer", "Referrer", "CMHT", "GP", "Police", "Records"] as const;

/** The referrer's asked urgency (synthetic referral R-1182). */
export const REFERRER_URGENCY: Tier = "C";

/** The synthetic previous triage and risk plan (12 Oct, Synthetic CMHT). */
export const LAST_TRIAGE = {
  label: "Last RAMP · 12 Oct · Synthetic CMHT",
  pastFlags: ["violence.bg.prev", "violence.bg.weap", "other.bg.abs", "general.bg.aod"],
  pastSummary:
    "Previous violence · Previous use of weapons · Absconding · Significant alcohol or drug use. Rest of history: not present.",
  /** Current flags seen then, only to say what is new today. Never carried forward. */
  nowFlags: ["general.now.agit"],
  history: "History (12 Oct, Synthetic CMHT, check): Lives with mother; no dependants. No current charges.",
} as const;

/** Synthetic patient banner and record. */
export const PATIENT = {
  name: "Harlow, Jesse",
  meta: "Male · 34y",
  umrn: "SYN 40-2271",
  dob: "14/03/1992",
  nowAt: "Synthetic ED · bay 7",
  team: "Active",
  legalTag: "Form 5A, as typed · Not legally checked.",
  alert: "Violence to staff, Mar 2025",
  alertCount: 3,
  allergies: "Penicillin (rash) · Haloperidol (dystonia)",
  author: "Dr A. Nguyen",
} as const;

export const ALERTS = [
  {
    title: "Violence to staff",
    detail:
      "Assaulted a staff member during an inpatient stay. Security nearby on admission. Source: Synthetic Hospital.",
    when: "Mar 2025",
    tone: "warning",
  },
  {
    title: "Absconding",
    detail: "Left a locked unit over a fence. Check doors and observation level. Source: Synthetic Hospital.",
    when: "Aug 2024",
    tone: "warning",
  },
  {
    title: "Depot missed",
    detail: "Fortnightly depot due 30 Oct, not given. Source: Synthetic East CMHT.",
    when: "30 Oct",
    tone: "neutral",
  },
] as const;

export const CONTACTS = [
  ["Phone", "0491 570 156", ""],
  ["Carer · mother", "0491 570 159", "R. Harlow"],
  ["Case manager", "(08) 5550 0142", "K. Morgan, Synthetic East CMHT"],
  ["GP", "(08) 5550 0177", "Dr L. Hart, Sample Medical"],
] as const;

export const HOW_TO = [
  [
    "Check the banner",
    "Identity, legal status, alerts and the referral come from the record. Contacts are in Patient profile. Fix errors at the source.",
  ],
  [
    "Review details",
    "When, how and where you reviewed, who was present, the purpose and the episode. Ask Aboriginal status every time.",
  ],
  ["Assessment", "Write as you talk in one box. Open What to cover for prompts. Tap the problems."],
  [
    "Mental state",
    "One box: tap a phrase to add it under its domain, or type. Switch to By domain for one row per domain. Look for explains each one. By phone, mark what you could not see.",
  ],
  [
    "Triage decision",
    "Choose urgency A to G yourself and say why if it differs from the referrer. Set the outcome, actions and legal status.",
  ],
  [
    "Risk and FDV",
    "Past risk: carry forward the last RAMP, check it, and answer Rest of history. Current risk: assess today, tap what is present, answer Rest of current risk. Then ask the three family violence questions alone, word for word.",
  ],
  [
    "Formulation and plan",
    "Who is at risk, of what, how soon, what keeps them safe, and the plan. Set the review. Preview, then sign.",
  ],
] as const;

/** Where each PSOLIS field went on this form. */
export const PSOLIS_FIELD_MAP = [
  ["DMR publishing", "Episode (one tap)"],
  ["Start date and time", "Reviewed, with Now"],
  ["End date and time", "Stamped when you sign"],
  ["Is transcribed", "Notes source chip"],
  ["Triaged by, designation", "From your login"],
  ["Medium", "How"],
  ["Stream, program", "From your desk"],
  ["Venue, collected at", "Where they were"],
  ["Consumer and associate present", "Person present, also present"],
  ["Referral medium, type, name, contact", "From the referral"],
  ["Purpose", "Purpose"],
  ["Reason", "Assessment box (Why now, Request)"],
  ["Urgency", "Urgency tiles"],
  ["Outcome", "Outcome"],
  ["Problems and comments", "Problem chips; detail in the box"],
  [
    "History, medical, treatments, drug and alcohol, social, forensic, MSE, formulation, communication (9 boxes)",
    "One Assessment box with a guide",
  ],
  ["Mental state examination", "Mental state section: tap what you observed, add detail"],
  ["Action plan, referred on", "Action chips"],
  ["Participants", "Author added; consult line"],
  ["Advance health directive, legal status", "Triage decision"],
  ["Consumer and carer aware", "Aware of referral chips"],
  ["RAMP: background factors", "Past risk, carried from the last RAMP and checked"],
  ["RAMP: current factors", "Current risk, assessed today"],
  ["RAMP: FDV", "Risk factors, family violence block"],
  ["RAMP: other (specify)", "Other risk: add any number, past or current"],
  ["RAMP: overview, protective, overall risk, plan, sources", "Formulation and plan"],
  ["RAMP: schedule, next due", "Review risk by"],
  ["RAMP: consultation", "Consulted with (from Senior consulted)"],
  ["Address, phone, contacts", "Not entered here; Patient profile"],
] as const;

export const SECTIONS = [
  { id: "rev", n: 1, label: "Review details", part: "triage" },
  { id: "note", n: 2, label: "Assessment", part: "triage" },
  { id: "mse", n: 3, label: "Mental state", part: "triage" },
  { id: "dec", n: 4, label: "Triage decision", part: "triage" },
  { id: "risk", n: 5, label: "Risk and FDV", part: "risk" },
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
