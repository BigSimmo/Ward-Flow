/**
 * Synthetic referral details for the seeded journeys still waiting on a ward's answer.
 *
 * Josh, 22 Oct 2026: when a referral reaches a ward, the ward sees every detail and document except
 * where else the patient was referred. The seeded journeys were authored before the referral form
 * existed, so none of them carries an intake. This file holds what their referral would have said,
 * keyed by journey id, so the ward's referral view has real content to show in the demonstration.
 *
 * Read-only demonstration content. It is never stored, never typed by a user and never names a
 * destination: no ward, hospital bed or community team that the journey was referred to appears
 * anywhere below. Every person is invented and every phone number is in the 0491 570 to 0491 579
 * range the ACMA keeps for fiction.
 */
import type { REFERRAL_RISK_FLAGS } from "./referrals/referral-submission";

export type DossierRow = { label: string; detail: string };

type DossierCheckStatus = "done" | "pending" | "not_indicated";

export type DossierDocument = {
  id: string;
  title: string;
  pages: number;
  author: string;
  /** Minutes after the journey opened. */
  addedAfterMinutes: number;
  /** The document's text, one paragraph per entry. */
  paragraphs: string[];
};

export type ReferralDossier = {
  reasonForReferral: string;
  riskFlags: (typeof REFERRAL_RISK_FLAGS)[number][];
  risk: DossierRow[];
  legal: DossierRow[];
  medicalClearance: {
    clearedAfterMinutes?: number;
    clearedBy?: string;
    checks: { label: string; status: DossierCheckStatus; detail?: string }[];
    contact?: string;
  };
  physicalHealth: DossierRow[];
  substanceUse: DossierRow[];
  medications: { regular: string[]; givenInEd: string };
  workingDiagnosis: string;
  history?: string;
  supports: DossierRow[];
  referrer: { name: string; role: string; location: string; phone: string; email: string };
  arrival: DossierRow[];
  documents: DossierDocument[];
};

const SEEDED_DOSSIERS: Record<string, ReferralDossier> = {
  "WF-013": {
    reasonForReferral:
      'Three weeks of worsening low mood, poor oral intake and 6 kg weight loss. Nihilistic ideas ("my insides have stopped working"). Told his daughter he wants to die. She found about two weeks of saved tablets in his shed. His wife went into respite care a month ago and he now lives alone. Requesting older adult admission for assessment and treatment of severe depression. Not safe for discharge home.',
    riskFlags: ["suicide", "vulnerable", "medical"],
    risk: [
      { label: "Suicide", detail: "High. Stockpiled medication, stated intent, lives alone." },
      { label: "Aggression", detail: "Low. No history." },
      { label: "Absconding", detail: "Low. Agrees to admission." },
      { label: "Vulnerability", detail: "Two falls this month. Poor intake." },
      { label: "In ED", detail: "No seclusion, restraint or sedation." },
    ],
    legal: [
      { label: "Capacity", detail: "Has capacity to consent to admission. ED psychiatry, 08:40." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "None" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 113,
      clearedBy: "ED registrar",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "Na 131, eGFR 48, otherwise unremarkable" },
        { label: "ECG", status: "done", detail: "AF, rate 78, QTc 445 ms" },
        { label: "Drug screen", status: "not_indicated" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Stable, within normal range" },
      ],
      contact: "Dr Orla Linforth, ED registrar · 0491 570 159",
    },
    physicalHealth: [
      { label: "Conditions", detail: "AF, type 2 diabetes, CKD stage 3a, osteoarthritis" },
      { label: "Allergies", detail: "Penicillin (rash)" },
      { label: "Mobility", detail: "Walks with a frame. High falls risk." },
      { label: "Cognition", detail: "4AT 1, delirium unlikely. Cognitive screen deferred while unwell." },
      { label: "Nutrition", detail: "58 kg, down 6 kg in three weeks" },
      { label: "Infection", detail: "COVID RAT negative. No MRO." },
      { label: "Care needs", detail: "Supervision to shower. Continent." },
    ],
    substanceUse: [
      { label: "Alcohol", detail: "Two standard drinks a day. Last drink two days ago. Low withdrawal risk." },
      { label: "Other drugs", detail: "None reported" },
      { label: "Tobacco", detail: "Non smoker" },
    ],
    medications: {
      regular: ["Sertraline 100 mg mane", "Apixaban 2.5 mg BD", "Metformin 500 mg BD", "Metoprolol CR 23.75 mg daily"],
      givenInEd: "Morning doses at 08:00. No PRN given.",
    },
    workingDiagnosis:
      "Severe depressive episode with psychotic features. Differential is early neurocognitive disorder.",
    history: "Recurrent depressive disorder. Admitted in 2019, good response to ECT.",
    supports: [
      {
        label: "NOK",
        detail: "Petra Winterthorn, daughter · 0491 570 156. Knows about the referral and supports admission.",
      },
      { label: "Carer role", detail: "Main carer for his wife, who has dementia and is now in respite." },
    ],
    referrer: {
      name: "Dr Kalan Moongate",
      role: "Psychiatry liaison registrar",
      location: "Emergency department",
      phone: "0491 570 158",
      email: "kalan.moongate@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Patient transport" },
      { label: "Escort", detail: "Not needed" },
      { label: "Ready to leave ED", detail: "Now" },
    ],
    documents: [],
  },
  "WF-002": {
    reasonForReferral:
      "Manic relapse of bipolar affective disorder. Lithium was stopped by his GP three weeks ago after an acute kidney injury. Not sleeping for five nights, pressured speech, disinhibited and spending heavily. Left home at night twice and was found by police walking on the highway. Needs admission to restart mood stabiliser safely and for supervision at night.",
    riskFlags: ["vulnerable", "absconding", "medical"],
    risk: [
      { label: "Suicide", detail: "Low. Denies thoughts of self harm." },
      { label: "Aggression", detail: "Moderate. Irritable when limits are set, no violence." },
      { label: "Absconding", detail: "High. Two night time wanderings this week." },
      { label: "Vulnerability", detail: "Financial exploitation risk. Falls risk at night." },
      { label: "In ED", detail: "No seclusion or restraint. Olanzapine 5 mg oral at 23:30 with good effect." },
    ],
    legal: [
      { label: "Capacity", detail: "Agrees to admission today. Capacity fluctuating, review daily." },
      { label: "AHD or guardian", detail: "Enduring power of attorney held by his son" },
      { label: "Police or court", detail: "Brought in by police for welfare, no charges" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 150,
      clearedBy: "ED consultant",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "Creatinine back to baseline, eGFR 58, TSH normal" },
        { label: "ECG", status: "done", detail: "Sinus rhythm, QTc 430 ms" },
        { label: "Drug screen", status: "not_indicated" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Stable" },
      ],
      contact: "Dr Maren Glasswell, ED consultant · 0491 571 266",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Recent AKI, now resolved. Hypertension. Benign prostatic hyperplasia." },
      { label: "Allergies", detail: "Nil known" },
      { label: "Mobility", detail: "Independent, unsteady when tired" },
      { label: "Cognition", detail: "4AT 2, delirium screen borderline. Repeat on the ward." },
      { label: "Infection", detail: "COVID RAT negative. No MRO." },
    ],
    substanceUse: [
      { label: "Alcohol", detail: "Occasional. Nothing in the past month." },
      { label: "Other drugs", detail: "None" },
      { label: "Tobacco", detail: "Ex smoker" },
    ],
    medications: {
      regular: ["Perindopril 5 mg daily", "Tamsulosin 400 microg nocte"],
      givenInEd: "Olanzapine 5 mg oral at 23:30. Regular doses due 08:00.",
    },
    workingDiagnosis: "Bipolar affective disorder, current episode manic without psychotic features.",
    history: "Three previous manic admissions, last in 2021. Stable on lithium until this year.",
    supports: [
      { label: "NOK", detail: "Kalan Sallowfield, son · 0491 571 491. Holds enduring power of attorney." },
      { label: "Living", detail: "Lives alone in a unit. Son visits daily." },
    ],
    referrer: {
      name: "Dr Junia Huntmire",
      role: "Psychiatry liaison registrar",
      location: "Emergency department",
      phone: "0491 571 804",
      email: "junia.huntmire@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Patient transport" },
      { label: "Escort", detail: "Nurse escort for wandering risk" },
      { label: "Ready to leave ED", detail: "Now" },
    ],
    documents: [],
  },
  "WF-010": {
    reasonForReferral:
      "Brought in by police after neighbours reported shouting through the night. Believes the neighbours are poisoning her water and has not eaten or drunk properly at home for four days. Barricaded her flat. No past psychiatric contact. Referred for examination by a psychiatrist. Needs inpatient assessment of a probable first episode of psychosis.",
    riskFlags: ["vulnerable", "aggression"],
    risk: [
      { label: "Suicide", detail: "Low to moderate. No stated intent, poor self care." },
      { label: "Aggression", detail: "Moderate. Threatened neighbours verbally." },
      { label: "Absconding", detail: "Moderate. Wants to leave to check her flat." },
      { label: "Vulnerability", detail: "Dehydrated, isolated, no supports nearby." },
      { label: "In ED", detail: "No restraint. Declined oral medication." },
    ],
    legal: [
      { label: "Capacity", detail: "Lacks capacity to consent to admission. Examination pending." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "Police transport only, no charges" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 190,
      clearedBy: "ED registrar",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "Urea raised, mild dehydration. IV fluids given." },
        { label: "ECG", status: "done", detail: "Sinus rhythm, QTc 420 ms" },
        { label: "Drug screen", status: "done", detail: "Cannabinoids positive" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Stable after fluids" },
      ],
      contact: "Dr Nolan Inkstone, ED registrar · 0491 572 549",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Asthma, mild" },
      { label: "Allergies", detail: "Nil known" },
      { label: "Pregnancy", detail: "Beta hCG negative" },
      { label: "Infection", detail: "COVID RAT negative. No MRO." },
    ],
    substanceUse: [
      { label: "Cannabis", detail: "Daily for several years. Last use two days ago." },
      { label: "Alcohol", detail: "Occasional" },
      { label: "Other drugs", detail: "Denies methamphetamine" },
    ],
    medications: {
      regular: ["Salbutamol inhaler PRN"],
      givenInEd: "IV fluids 2 L. Declined oral olanzapine.",
    },
    workingDiagnosis: "First episode psychosis. Differential is cannabis induced psychotic disorder.",
    supports: [
      { label: "NOK", detail: "Petra Loxbury, sister · 0491 572 665. Lives interstate." },
      { label: "Living", detail: "Lives alone. Works part time in retail." },
    ],
    referrer: {
      name: "Dr Reya Jorrowfen",
      role: "Psychiatry liaison registrar",
      location: "Emergency department",
      phone: "0491 572 983",
      email: "reya.jorrowfen@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Patient transport with security" },
      { label: "Escort", detail: "Two staff" },
      { label: "Ready to leave ED", detail: "After examination" },
    ],
    documents: [],
  },
  "WF-017": {
    reasonForReferral:
      "Relapse of schizophrenia after missing two depot injections. Threatened to kill his brother, whom he believes is controlling his thoughts. Assaulted a security officer in the ED overnight. Made involuntary. Needs a secure bed.",
    riskFlags: ["aggression", "absconding"],
    risk: [
      { label: "Suicide", detail: "Low. Denies thoughts of self harm." },
      { label: "Aggression", detail: "High. Assault in ED, specific threats to his brother." },
      { label: "Absconding", detail: "High. Attempted to leave twice." },
      { label: "Vulnerability", detail: "Low" },
      {
        label: "In ED",
        detail: "Physical restraint at 02:05. Droperidol 10 mg IM at 02:10. Settled since.",
      },
    ],
    legal: [
      { label: "Capacity", detail: "Lacks capacity to consent to treatment." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "Police attended the ED assault. Charges under consideration." },
    ],
    medicalClearance: {
      clearedAfterMinutes: 240,
      clearedBy: "ED registrar",
      checks: [
        { label: "Examination", status: "done", detail: "Minor abrasions to knuckles" },
        { label: "Bloods", status: "done", detail: "CK 610 after restraint, repeat CK requested" },
        { label: "ECG", status: "done", detail: "Sinus rhythm, QTc 438 ms after droperidol" },
        { label: "Drug screen", status: "done", detail: "Negative" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Stable" },
      ],
      contact: "Dr Sabine Kellbourne, ED registrar · 0491 573 770",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Obesity, prediabetes" },
      { label: "Allergies", detail: "Haloperidol (dystonia)" },
      { label: "Infection", detail: "COVID RAT negative. No MRO." },
    ],
    substanceUse: [
      { label: "Alcohol", detail: "Nil" },
      { label: "Other drugs", detail: "None" },
      { label: "Tobacco", detail: "25 a day. Needs NRT patch and lozenges." },
    ],
    medications: {
      regular: ["Paliperidone palmitate 150 mg IM monthly (two doses missed)", "Metformin 500 mg BD"],
      givenInEd: "Droperidol 10 mg IM at 02:10. Nicotine patch 21 mg at 08:00.",
    },
    workingDiagnosis: "Schizophrenia, acute relapse with persecutory delusions.",
    history: "Diagnosed 2002. Four admissions, two to secure care. Under a community team on depot.",
    supports: [
      { label: "NOK", detail: "Quinta Shalecroft, mother · 0491 573 087. Asks that the brother is not given updates." },
      { label: "Living", detail: "Lives with his mother." },
    ],
    referrer: {
      name: "Dr Lark Pallowmere",
      role: "Consultant psychiatrist, liaison",
      location: "Emergency department",
      phone: "0491 574 118",
      email: "lark.pallowmere@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Secure transport" },
      { label: "Escort", detail: "Two staff and security" },
      { label: "Ready to leave ED", detail: "Now" },
    ],
    documents: [],
  },
  "WF-022": {
    reasonForReferral:
      "Paracetamol overdose two days ago with clear suicidal intent after a relationship ended. Acetylcysteine course completed and LFTs are improving. Still expresses a wish to die and has no safe place to stay. Referred for examination by a psychiatrist. She lives in the South West.",
    riskFlags: ["suicide", "vulnerable"],
    risk: [
      { label: "Suicide", detail: "High. Recent serious overdose, ongoing intent." },
      { label: "Aggression", detail: "Low" },
      { label: "Absconding", detail: "Moderate. Has asked to leave." },
      { label: "Vulnerability", detail: "No stable accommodation in Perth." },
      { label: "In ED", detail: "No restraint or sedation." },
    ],
    legal: [
      { label: "Capacity", detail: "Under review by the examining psychiatrist." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "None" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 30,
      clearedBy: "Medical team",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "ALT falling, INR 1.2. Repeat LFTs tomorrow." },
        { label: "ECG", status: "done", detail: "Sinus rhythm, QTc 410 ms" },
        { label: "Drug screen", status: "not_indicated" },
        { label: "Breath alcohol", status: "not_indicated" },
        { label: "Observations", status: "done", detail: "Stable" },
      ],
      contact: "Dr Calder Moongate, medical registrar · 0491 574 632",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Paracetamol hepatotoxicity, resolving" },
      { label: "Allergies", detail: "Nil known" },
      { label: "Pregnancy", detail: "Beta hCG negative" },
      { label: "Infection", detail: "No MRO" },
    ],
    substanceUse: [
      { label: "Alcohol", detail: "Binge drinking on weekends. Low withdrawal risk." },
      { label: "Other drugs", detail: "Occasional MDMA" },
      { label: "Tobacco", detail: "Vapes daily" },
    ],
    medications: {
      regular: ["Nil regular"],
      givenInEd: "Acetylcysteine course complete. No psychotropic medication given.",
    },
    workingDiagnosis: "Adjustment disorder with depressed mood. Emotionally unstable personality traits.",
    history: "Two previous overdoses, no admissions.",
    supports: [
      { label: "NOK", detail: "Fiora Flint, mother · 0491 575 254. Lives in the South West." },
      { label: "Living", detail: "Was staying with her former partner. Now without accommodation." },
    ],
    referrer: {
      name: "Dr Tansy Quenfold",
      role: "Psychiatry liaison registrar",
      location: "Medical ward",
      phone: "0491 575 789",
      email: "tansy.quenfold@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Patient transport, country" },
      { label: "Escort", detail: "Nurse escort" },
      { label: "Ready to leave", detail: "After examination" },
    ],
    documents: [],
  },
  "WF-027": {
    reasonForReferral:
      "Severe depressive episode not responding to eight weeks of escitalopram. Not eating, staying in bed, stopped working. Passive thoughts of death without a plan. Partner can no longer supervise her at home. Agrees to voluntary admission.",
    riskFlags: ["suicide"],
    risk: [
      { label: "Suicide", detail: "Moderate. Passive ideation, no plan, protective factors." },
      { label: "Aggression", detail: "Low" },
      { label: "Absconding", detail: "Low" },
      { label: "Vulnerability", detail: "Poor self care" },
      { label: "In ED", detail: "No restraint or sedation." },
    ],
    legal: [
      { label: "Capacity", detail: "Has capacity to consent to admission." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "None" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 95,
      clearedBy: "ED registrar",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "FBC, UEC, TFTs and B12 normal" },
        { label: "ECG", status: "done", detail: "Sinus rhythm, QTc 415 ms" },
        { label: "Drug screen", status: "not_indicated" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Stable" },
      ],
      contact: "Dr Bramwen Linforth, ED registrar · 0491 576 398",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Nil significant" },
      { label: "Allergies", detail: "Sulfonamides (rash)" },
      { label: "Nutrition", detail: "4 kg weight loss in a month" },
      { label: "Infection", detail: "No MRO" },
    ],
    substanceUse: [
      { label: "Alcohol", detail: "Nil" },
      { label: "Other drugs", detail: "None" },
      { label: "Tobacco", detail: "Non smoker" },
    ],
    medications: {
      regular: ["Escitalopram 20 mg mane"],
      givenInEd: "Escitalopram 20 mg at 08:00.",
    },
    workingDiagnosis: "Major depressive disorder, single episode, severe without psychotic features.",
    supports: [
      { label: "NOK", detail: "Delia Kestrelworth, partner · 0491 576 801" },
      { label: "Living", detail: "Lives with her partner. No children." },
    ],
    referrer: {
      name: "Dr Eamon Ferrowmoor",
      role: "Psychiatry liaison registrar",
      location: "Emergency department",
      phone: "0491 577 426",
      email: "eamon.ferrowmoor@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Partner's car" },
      { label: "Escort", detail: "Not needed" },
      { label: "Ready to leave ED", detail: "Now" },
    ],
    documents: [],
  },
  "WF-RD02": {
    reasonForReferral:
      "Persecutory ideas and auditory hallucinations after a week of heavy methamphetamine use. Last use three days ago and symptoms have not settled. Settled and cooperative in the ED. Asks for admission to stop using.",
    riskFlags: ["aggression"],
    risk: [
      { label: "Suicide", detail: "Low" },
      { label: "Aggression", detail: "Moderate when intoxicated, calm now" },
      { label: "Absconding", detail: "Low. Wants admission." },
      { label: "Vulnerability", detail: "Owes money to dealers" },
      { label: "In ED", detail: "Diazepam 10 mg oral at 21:00 for agitation." },
    ],
    legal: [
      { label: "Capacity", detail: "Has capacity to consent to admission." },
      { label: "AHD or guardian", detail: "None on file" },
      { label: "Police or court", detail: "On a community order for a driving offence" },
    ],
    medicalClearance: {
      clearedAfterMinutes: 160,
      clearedBy: "ED registrar",
      checks: [
        { label: "Examination", status: "done" },
        { label: "Bloods", status: "done", detail: "CK 380, otherwise normal" },
        { label: "ECG", status: "done", detail: "Sinus tachycardia 104, QTc 425 ms" },
        { label: "Drug screen", status: "done", detail: "Amphetamines positive" },
        { label: "Breath alcohol", status: "done", detail: "0.000" },
        { label: "Observations", status: "done", detail: "Heart rate settling" },
      ],
      contact: "Dr Orla Norrowfield, ED registrar · 0491 577 644",
    },
    physicalHealth: [
      { label: "Conditions", detail: "Hepatitis C, treated 2023" },
      { label: "Allergies", detail: "Nil known" },
      { label: "Infection", detail: "COVID RAT negative. No MRO." },
    ],
    substanceUse: [
      { label: "Methamphetamine", detail: "Smoked daily for a week. Last use three days ago." },
      { label: "Alcohol", detail: "Social" },
      { label: "Tobacco", detail: "15 a day. Needs NRT." },
    ],
    medications: { regular: ["Nil regular"], givenInEd: "Diazepam 10 mg oral at 21:00." },
    workingDiagnosis: "Methamphetamine induced psychotic disorder. Differential is schizophrenia.",
    history: "One previous admission for drug induced psychosis in 2024.",
    supports: [
      { label: "NOK", detail: "Sabine Duskwell, mother · 0491 578 957" },
      { label: "Living", detail: "Lives with his mother." },
    ],
    referrer: {
      name: "Dr Gareth Moongate",
      role: "Psychiatry liaison registrar",
      location: "Emergency department",
      phone: "0491 578 148",
      email: "gareth.moongate@example.org",
    },
    arrival: [
      { label: "Coming by", detail: "Patient transport" },
      { label: "Escort", detail: "Not needed" },
      { label: "Ready to leave ED", detail: "Now" },
    ],
    documents: [],
  },
};

/** The synthetic referral details for one seeded journey, with its documents. `undefined` for any
 *  journey that has none, which the referral view shows as "not recorded on this referral". */
export function seededReferralDossier(movementId: string): ReferralDossier | undefined {
  const dossier = SEEDED_DOSSIERS[movementId];
  if (!dossier) return undefined;
  return dossier.documents.length > 0 ? dossier : { ...dossier, documents: dossierDocuments(movementId, dossier) };
}

const STATUS_WORDS: Record<DossierCheckStatus, string> = {
  done: "Done",
  pending: "Pending",
  not_indicated: "Not indicated",
};

/** The documents attached to a seeded referral, written from the same synthetic details so the
 *  two can never disagree. */
function dossierDocuments(movementId: string, dossier: ReferralDossier): DossierDocument[] {
  const { referrer, medicalClearance, medications } = dossier;
  const checkLine = (label: string) => {
    const check = medicalClearance.checks.find((candidate) => candidate.label === label);
    return check ? `${STATUS_WORDS[check.status]}${check.detail ? `. ${check.detail}` : ""}.` : "Not recorded.";
  };
  const clearedAt = medicalClearance.clearedAfterMinutes ?? 0;
  return [
    {
      id: `${movementId}-letter`,
      title: "Referral letter",
      pages: 2,
      author: referrer.name,
      addedAfterMinutes: 3,
      paragraphs: [
        "Dear colleague,",
        dossier.reasonForReferral,
        `Working diagnosis: ${dossier.workingDiagnosis}`,
        ...dossier.risk.map((row) => `${row.label} risk: ${row.detail}`),
        `Kind regards, ${referrer.name}, ${referrer.role}. Phone ${referrer.phone}.`,
      ],
    },
    {
      id: `${movementId}-clearance`,
      title: "Medical clearance",
      pages: 1,
      author: medicalClearance.clearedBy ?? "Emergency department",
      addedAfterMinutes: clearedAt,
      paragraphs: medicalClearance.checks.map((check) => `${check.label}: ${checkLine(check.label)}`),
    },
    {
      id: `${movementId}-medications`,
      title: "Medication chart",
      pages: 2,
      author: "Emergency department",
      addedAfterMinutes: 45,
      paragraphs: [...medications.regular.map((line) => `Regular: ${line}`), `Given here: ${medications.givenInEd}`],
    },
    {
      id: `${movementId}-ecg`,
      title: "ECG",
      pages: 1,
      author: "Emergency department",
      addedAfterMinutes: 60,
      paragraphs: [`12 lead ECG. ${checkLine("ECG")}`],
    },
    {
      id: `${movementId}-bloods`,
      title: "Blood results",
      pages: 1,
      author: "Pathology",
      addedAfterMinutes: Math.max(90, clearedAt - 15),
      paragraphs: [`${checkLine("Bloods")}`, `Drug screen: ${checkLine("Drug screen")}`],
    },
  ];
}
