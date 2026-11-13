import type { TriagePerson } from "@/components/ward-management/triage/triage-risk-data";
import { blankTriage, type TriageState } from "@/components/ward-management/triage/triage-risk-state";

/*
 * The worked example from Josh's approved triage and risk mock-up (6 Nov 2026), kept as a test
 * fixture when the form was built into the app (7 Nov 2026): the real form reads world people only.
 * Every name, number, referral and the previous triage here are invented (synthetic).
 */

/** A synthetic person with a referral that asked for a tier and a previous triage on record. */
export const EXAMPLE_PERSON: TriagePerson = {
  id: "PT-SYN-EXAMPLE",
  name: "Harlow, Jesse",
  meta: "Male · 34y",
  umrn: "SYN 40-2271",
  dob: "14/03/1992",
  nowAt: "Synthetic ED · bay 7",
  team: "Active",
  legal: "Community treatment order",
  legalTag: "Form 5A, as typed · Not legally checked.",
  alert: "Violence to staff, Mar 2025",
  alertCount: 3,
  allergies: "Penicillin (rash) · Haloperidol (dystonia)",
  referral: {
    id: "R-1182",
    from: "Synthetic ED",
    urgency: "C",
    episode: "ED",
    referrer: { name: "Dr P. Singh", role: "ED registrar", phone: "(08) 5550 0190" },
    received: "eReferral 06/11 08:55",
  },
  last: {
    label: "Last triage · 12 Oct · Dr S. Orlenby",
    when: "12 Oct",
    urgencyText: "D within 48 hours",
    outcome: "Accepted",
    legal: "Community treatment order",
    review: "72 hours",
    pastFlags: ["violence.bg.prev", "violence.bg.weap", "other.bg.abs", "general.bg.aod"],
    pastSummary:
      "Previous violence · Previous use of weapons · Absconding · Significant alcohol or drug use. Carries these flags only; you answer Rest of history today.",
    nowFlags: ["general.now.agit"],
  },
  recordHref: "/ward-flow/people/code-example",
};

/** The worked example's answers, as the mock-up opened on them. */
export function exampleTriage(): TriageState {
  return {
    ...blankTriage(EXAMPLE_PERSON),
    how: "phone",
    where: "ed",
    present: "yes",
    others: ["Other service"],
    arrivedBy: "Ambulance",
    purpose: "Referral",
    atsi: "n",
    interp: "no",
    problems: ["psychotic", "aggression", "aod"],
    aware: ["opposed", "carer"],
    f: {
      "violence.now.intent": "y",
      "general.now.agit": "y",
      "other.now.nonadn": "y",
      "other.now.leave": "y",
    },
    legal: "cto",
    ahd: "none",
    sources: ["Person", "Family or carer", "Records"],
    text: {
      ...blankTriage(EXAMPLE_PERSON).text,
      accompanied: "Mother",
      revTime: "06/11/2026 09:42",
      note: "Why now: Five days of rising agitation and poor sleep after a missed depot dose.\nRequest: ED asks for admission and a bed review today.\nViews: Does not want admission. Mother supports admission.\nHistory: Schizoaffective disorder. Two admissions this year, both after stopping treatment. On CTO with depot, last dose missed.\nAlcohol and drugs: Daily cannabis; denies other use today.\n",
      rp: "Risk: Raised risk of violence to staff and family now, above his baseline, in the context of relapse and threats today.\nProtective: Engaged with CMHT; mother supportive.\n",
      legalForm: "Form 5A · 28/01/2027 23:59",
      mseBox:
        'Speech: Pressured, hard to interrupt\nMood and affect: Irritable. "I just need sleep"\nThought content: Grandiose delusions. King of the city; special mission\nPerception: No perceptual disturbance\nInsight and judgement: No insight',
    },
  };
}
