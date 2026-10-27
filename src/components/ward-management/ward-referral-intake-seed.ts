/** Authored synthetic form content, never a clinical inference from written histories. */
import type { ReferralIntakeDetails, ReferralContact } from "./referrals/referral-submission";
import type { Movement, Referral } from "./ward-model";
import type { ReferralDossier } from "./ward-referral-dossier-seed";
import { seededReferralTimelineBase } from "./ward-referral-seed-time";

type IntakeContext = { movement?: Movement; dossier?: ReferralDossier };
type SeedContext = {
  movements?: readonly Movement[];
  dossiers?: Readonly<Record<string, ReferralDossier | undefined>>;
};

type Presentation = { reason: string; flags: ReferralIntakeDetails["riskFlags"]; risk: string };
const assessmentRisk = "Individual risk assessment remains to be recorded; no absence of risk is implied.";
const authored = (reason: string, flags: Presentation["flags"] = [], risk = assessmentRisk): Presentation => ({
  reason,
  flags,
  risk,
});

// Authored against the canonical fixture stories in ward-movements.ts (RF-/Midland rows),
// ward-demo-network.ts (RF-DN-) and ward-rulings-demo.ts (RF-RD06). No runtime prose parsing,
// symptom randomisation or inference from urgency, legal status or demographics occurs here.
const REFERRAL_PRESENTATIONS: Readonly<Record<string, Presentation>> = {
  "RF-001": authored(
    "Increasing withdrawal and missed depot appointments after stopping treatment. Requesting psychiatric assessment and supported care.",
    ["vulnerable"],
    "Withdrawal and disengagement from treatment require assessment; family support is available.",
  ),
  "RF-002": authored(
    "Continuing psychiatric care after the medical reason for admission resolved; no local psychiatric bed is available.",
    ["vulnerable"],
    "Long-distance transfer and early family involvement need planning; acute risk details require handover.",
  ),
  "RF-003": authored(
    "Acute distress and insomnia with difficulty remaining safe at home. Requesting assessment and a supported setting.",
    ["vulnerable"],
    "Unable to remain safe at home in the authored referral; partner support available pending transport.",
  ),
  "RF-004": authored(
    "Disorientation with an unclear recent history. Requesting assessment to establish mental and physical health needs.",
    ["medical", "vulnerable"],
    "Found disoriented near water; history and supports are not established. Requires direct safety and physical assessment.",
  ),
  "RF-005": authored(
    "New confusion and reduced food and fluid intake in supported residential care. Requesting psychiatric and physical-health assessment.",
    ["medical", "vulnerable"],
    "Acute change from baseline and poor intake need physical review and supported care.",
  ),
  "RF-006": authored(
    "Acute deterioration with no fixed address and no identified support contact. Requesting assessment and coordinated care.",
    ["vulnerable"],
    "Contact, accommodation and support needs are unresolved; no suburb or next of kin is inferred.",
  ),
  "RF-007": authored(
    "Repeated recent presentations and no local youth psychiatric bed. Requesting ongoing assessment and a suitable treatment setting.",
    ["vulnerable"],
    "Distance from family and continuity with existing youth care need planning.",
  ),
  "RF-008": authored(
    "Agitation and distress at home, calmer with the ambulance crew. Requesting assessment after agreeing to attend voluntarily.",
    [],
    "Recent distress needs reassessment on arrival; agreement to attend does not establish low risk.",
  ),
  "RF-009": authored("Psychiatric opinion requested before deciding whether admission is required."),
  "RF-010": authored(
    "Community follow-up after medical care, with support to re-engage in ongoing treatment rather than a psychiatric bed.",
  ),
  "RF-011": authored(
    "Department assessment and possible inpatient care requested after a family call for assistance.",
    ["vulnerable"],
    "Family cannot manage safely at home tonight; current individual risks need assessment.",
  ),
  "RF-012": authored(
    "Confusion following a fall, with increasing forgetfulness. Requesting medical and psychiatric assessment.",
    ["medical", "vulnerable"],
    "Recent fall, confusion and living alone require a direct physical and safety assessment.",
  ),
  "RF-013": authored(
    "Acute distress in a public place requiring assessment in a supported setting.",
    ["vulnerable"],
    "Could not safely be left alone at presentation; ongoing risk requires clinical assessment.",
  ),
  "RF-014": authored(
    "Assessment requested by the community team; travelling with family and not yet arrived when referred.",
    [],
    "Reassess on arrival; the referral does not record an individual risk assessment.",
  ),
  "RF-015": authored(
    "Earlier assessment request remains on the list after non-attendance. Review whether contact and assessment are still required.",
    [],
    "Current whereabouts and risk require review; non-attendance is not a completed assessment.",
  ),
  "RF-016": authored(
    "Persistent low mood and poor sleep despite community treatment. Requesting a voluntary admission for further assessment and treatment.",
  ),
  "RF-017": authored(
    "Declining everyday functioning despite community support. Requesting inpatient assessment and treatment with family involvement.",
    ["vulnerable"],
    "Reduced ability to manage day to day requires assessment and practical support.",
  ),
  "RF-018": authored(
    "Acute presentation after a disturbance at a family home. Requesting assessment and a suitable psychiatric bed.",
  ),
  "RF-019": authored(
    "Marked distress and inability to maintain personal safety; psychiatric admission requested after assessment.",
    ["vulnerable"],
    "Personal safety could not be maintained at presentation; ongoing safety planning and reassessment are required.",
  ),
  "RF-020": authored(
    "Several days of confusion and reduced intake. Requesting assessment and treatment with family support.",
    ["medical", "vulnerable"],
    "Confusion and poor intake require physical-health review and supported care.",
  ),
  "RF-021": authored(
    "Transfer for continuing psychiatric treatment after the existing bed was needed for another admission.",
  ),
  "RF-RGHS-01": authored("Community re-engagement after missed appointments, before the later inpatient episode."),
  "RF-SCGA-07": authored(
    "Community assessment for worsening sleep and withdrawal; the later admission occurred before the first appointment.",
  ),
  "RF-GRYS-09": authored(
    "Community follow-up after a brief assessment presentation, rather than an inpatient bed request.",
  ),
  "RF-RPHS-14": authored(
    "Re-establish community treatment after moving into the area; this referral predates the current admission.",
  ),
  "RF-SJGA-05": authored("Continuing community treatment after an earlier admission, with home follow-up."),
  "RF-BTYO-05": authored("Community review of memory and mood, before the later inpatient episode."),
  "RF-ARMA-01": authored("Continuing community care following a crisis-service home visit."),
  "RF-ARMA-02": authored(
    "Transfer of established community treatment following a move; this referral predates the current admission.",
  ),
  "RF-FSHS-01": authored(
    "Long-term community follow-up established before the current episode; ongoing treatment coordination requested.",
  ),
  "RF-RD06": authored("Ward-to-ward transfer request for continuing psychiatric treatment and coordinated placement."),
  "RF-DN-001": authored(
    "Three weeks of low mood and withdrawal with family concern. Requesting psychiatric assessment.",
    ["vulnerable"],
    "Withdrawal and family concern require direct risk assessment and supportive care.",
  ),
  "RF-DN-002": authored("Psychiatric assessment and supported placement requested after a crisis-service home visit."),
  "RF-DN-003": authored("Psychiatric examination arranged following police-assisted presentation."),
  "RF-DN-004": authored(
    "Assessment and psychiatric admission requested following ambulance attendance and agreement to admission.",
  ),
  "RF-DN-005": authored("Transfer for continuing psychiatric treatment and continuity of care."),
  "RF-DN-006": authored("Older-adult psychiatric care requested after recorded medical clearance."),
  "RF-DN-007": authored("Planned psychiatric admission requested by the referring general practitioner."),
  "RF-DN-008": authored("Step down from high-dependency care to an open psychiatric setting for continuing treatment."),
  "RF-DN-009": authored("Community referral for psychiatric assessment and a suitable inpatient treatment setting."),
};

const placementPresentation = authored(
  "Psychiatric placement and continuing assessment requested. Preserve the existing treatment story and recorded care needs while arranging a suitable setting.",
);

function ordinal(key: string): number {
  return [...key].reduce((value, character) => (value * 31 + character.charCodeAt(0)) >>> 0, 0);
}

/** An invented proposed review target, never a completed-clearance time or a legal duration. */
export function seededReferralMedicalTarget(raisedAt: number): string {
  const midnight = Date.parse(seededReferralTimelineBase());
  return new Date(midnight + (raisedAt + 120) * 60_000).toISOString();
}

function syntheticContact(key: string): ReferralContact {
  const index = ordinal(key) % 100;
  return {
    name: `Synthetic clinician ${index + 1}`,
    role: "Demo referring clinician",
    location: "Synthetic assessment service",
    email: `clinician-${index + 1}@ward-flow.invalid`,
    phone: "08 5550 0156",
  };
}

/** Complete an actual seed referral without creating a referral, answer or patient link. */
export function completeSyntheticReferralIntake(referral: Referral, context: IntakeContext = {}): Referral {
  const presentation = REFERRAL_PRESENTATIONS[referral.id] ?? placementPresentation;
  const referrer = syntheticContact(referral.id);
  // This one source fixture explicitly records completed medical clearance. An absent source
  // fact otherwise stays pending. The proposed review time is new synthetic planning content.
  const cleared = referral.id === "RF-DN-006";
  const intake: ReferralIntakeDetails = referral.intake ?? {
    // Invented form content only. This is not operational catchment verification, and it must
    // never populate routing fields, patient catchment, service ownership or access permissions.
    catchment: { teamName: `Synthetic catchment team ${(ordinal(referral.id) % 100) + 1}`, confirmed: true },
    reasonForReferral:
      context.dossier?.reasonForReferral ??
      `Synthetic presentation: ${presentation.reason} Risk summary: ${presentation.risk} ${cleared ? "Medical clearance is recorded in the authored fixture." : "Medical clearance remains unconfirmed; the proposed review target is invented demonstration planning content."}`,
    // Current journey status is not evidence of the legal status at this earlier referral.
    legalStatus: "Not recorded",
    riskFlags: [...(context.dossier?.riskFlags ?? presentation.flags)],
    medicalClearance: cleared
      ? { cleared: true }
      : {
          cleared: false,
          expectedAt: seededReferralMedicalTarget(referral.raisedAt),
          syntheticTimelineBase: seededReferralTimelineBase(),
          contactName: referrer.name,
          contactPhone: referrer.phone,
        },
    triageAndRampCompleted: false,
    // Metadata for invented demonstration charts, never actual uploaded files or retained bytes.
    charts: [
      { kind: "medication", name: "Synthetic medication chart.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
      { kind: "observation", name: "Synthetic observation chart.pdf", mimeType: "application/pdf", sizeBytes: 1024 },
    ],
    additionalDocuments: false,
    referrer,
    clearanceChecklist: cleared
      ? { examination: "done", observations: "done" }
      : { examination: "to_follow", observations: "to_follow" },
  };
  return {
    ...referral,
    intake,
    destinations: referral.destinations.map((entry) => ({
      ...entry,
      referredAt: entry.referredAt ?? referral.raisedAt,
    })),
  };
}

/** Apply only at seed producers. Existing user-submitted intake and all routing facts survive. */
export function completeSyntheticReferralIntakes(
  referrals: readonly Referral[],
  context: SeedContext = {},
): Referral[] {
  return referrals.map((referral) => {
    const movement = context.movements?.find((candidate) => candidate.referralId === referral.id);
    return completeSyntheticReferralIntake(referral, {
      movement,
      dossier: movement ? context.dossiers?.[movement.id] : undefined,
    });
  });
}

/** A ward offer is separate from a primary referral; an absent primary link stays absent. */
export function syntheticMovementReferralDossier(movement: Movement): ReferralDossier | undefined {
  const hasOffer =
    movement.referredUnitIds.length > 0 ||
    !!movement.acceptedUnitId ||
    movement.declines.length > 0 ||
    movement.withdrawnReferrals.length > 0;
  if (!hasOffer) return undefined;
  const presentation = placementPresentation;
  const referrer = syntheticContact(movement.id);
  const cleared = movement.medicalClearance?.cleared === true;
  const clearedAfterMinutes = cleared
    ? Math.max(0, (movement.medicalClearance?.at ?? movement.openedAt) - movement.openedAt)
    : undefined;
  const risk = [
    { label: "Authored synthetic risk summary", detail: presentation.risk },
    { label: "Risk flags", detail: "None recorded in the original fixture; this is not an assessment of low risk." },
    {
      label: "Safety plan",
      detail: "Direct assessment, supportive observation and a collaborative safety plan in this demonstration.",
    },
  ];
  const checks: ReferralDossier["medicalClearance"]["checks"] = [
    { label: "Examination", status: cleared ? "done" : "pending" },
    { label: "Observations", status: cleared ? "done" : "pending" },
  ];
  const reasonForReferral = `Synthetic presentation: ${presentation.reason}`;
  // Zero offsets are deliberate: the invented documents accompany the offer, with no extra
  // backdated event, invented decision or wall-clock dependency. Offsets survive re-anchoring.
  return {
    reasonForReferral,
    riskFlags: [...presentation.flags],
    risk,
    legal: [
      { label: "Recorded legal status", detail: movement.legalStatus },
      {
        label: "Paper authority",
        detail: "Synthetic demonstration record; check the recorded legal forms for any supplied authority and times.",
      },
    ],
    medicalClearance: {
      ...(clearedAfterMinutes === undefined ? {} : { clearedAfterMinutes, clearedBy: referrer.role }),
      checks,
      contact: `${referrer.name} · ${referrer.phone}`,
    },
    physicalHealth: [
      {
        label: "Assessment",
        detail: "Synthetic physical-health review and observation chart accompany this demonstration offer.",
      },
    ],
    substanceUse: [
      {
        label: "Assessment",
        detail: "No acute intoxication or withdrawal is authored in this synthetic presentation.",
      },
    ],
    medications: {
      regular: ["Synthetic medication chart supplied for reconciliation."],
      givenInEd: "No additional medication administration is authored in this demonstration.",
    },
    workingDiagnosis: "Assessment in progress; no diagnosis inferred by the prototype.",
    supports: [{ label: "Plan", detail: "Synthetic support contact available through the referring clinician." }],
    referrer,
    arrival: [
      { label: "Plan", detail: "See the recorded journey and transport plan. No arrival is implied by this record." },
    ],
    documents: [
      {
        id: `${movement.id}-synthetic-letter`,
        title: "Synthetic referral letter",
        pages: 1,
        author: referrer.name,
        addedAfterMinutes: 0,
        paragraphs: [
          reasonForReferral,
          ...risk.map((row) => `${row.label}: ${row.detail}`),
          `Legal status: ${movement.legalStatus}`,
        ],
      },
      {
        id: `${movement.id}-synthetic-medication`,
        title: "Synthetic medication chart",
        pages: 1,
        author: referrer.name,
        addedAfterMinutes: 0,
        paragraphs: [
          "Invented demonstration chart. Medication reconciliation is requested; no prescription or administration is asserted.",
        ],
      },
      {
        id: `${movement.id}-synthetic-observation`,
        title: "Synthetic observation chart",
        pages: 1,
        author: referrer.name,
        addedAfterMinutes: 0,
        paragraphs: [
          cleared
            ? "Synthetic observations reviewed for this offer."
            : "Medical review remains pending on the recorded journey.",
        ],
      },
    ],
  };
}
