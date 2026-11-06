/**
 * Triage and risk mock-up: the form's state, what is still needed before signing, and the summary.
 * Ported from the approved prototype (`d-lean.html`). State lives in React only: nothing typed here
 * goes to browser storage (HOW-WE-WORK §6), so the prototype's session draft and saved preferences
 * are not ported. Synthetic data only.
 */
import {
  ACUTE_FLAGS,
  AREA_NAME,
  AREAS,
  FACTOR_NAME,
  GUIDES,
  LAST_TRIAGE,
  LEGAL_WITH_FORM,
  MSE,
  REFERRER_URGENCY,
  type SectionId,
  type Tier,
} from "./triage-risk-data";
import {
  boxLine,
  domainLineText,
  emptyHeadings,
  headingFilled,
  isWritten,
  parseHeadedText,
  type DomainEntry,
} from "./triage-risk-text";

/** A RAMP factor: present ("y") or not known ("u"); absent means not marked. */
type FactorMark = "y" | "u";

export type TextKey = "revTime" | "note" | "rp" | "legalForm" | "urgReason" | "consultWho" | "otherRisk" | "mseBox";

export type TriageState = {
  how: string | null;
  where: string | null;
  present: string | null;
  others: string[];
  purpose: string | null;
  /** From the referral (ED), changeable. */
  episode: string | null;
  atsi: string | null;
  amhw: string | null;
  interp: string | null;
  trans: boolean;
  problems: string[];
  aware: string[];
  mseMode: "box" | "dom";
  /** By domain: each domain's chips and detail. */
  mse: Record<string, DomainEntry>;
  urgency: Tier | null;
  outcome: string | null;
  actions: string[];
  medical: string | null;
  legal: string | null;
  ahd: string | null;
  ahdCopy: string | null;
  f: Record<string, FactorMark>;
  /** Past flags carried from the last RAMP (so Undo can take them back). */
  fromLast: string[];
  restPast: string | null;
  restFromLast: boolean;
  rest: string | null;
  xr: { t: string; k: "now" | "bg" }[];
  xrKind: "now" | "bg";
  fdv: Record<string, "y" | "n">;
  fdvNot: boolean;
  fdvSus: boolean;
  fdvReason: string | null;
  changeable: string | null;
  uncertain: string | null;
  review: string | null;
  copyGiven: string[];
  sources: string[];
  text: Record<TextKey, string>;
};

const NO_TEXT: Record<TextKey, string> = {
  revTime: "",
  note: "",
  rp: "",
  legalForm: "",
  urgReason: "",
  consultWho: "",
  otherRisk: "",
  mseBox: "",
};

/** Nothing clinical chosen. The episode comes from the referral (ED). */
export function blankTriage(): TriageState {
  return {
    how: null,
    where: null,
    present: null,
    others: [],
    purpose: null,
    episode: "ED",
    atsi: null,
    amhw: null,
    interp: null,
    trans: false,
    problems: [],
    aware: [],
    mseMode: "box",
    mse: {},
    urgency: null,
    outcome: null,
    actions: [],
    medical: null,
    legal: null,
    ahd: null,
    ahdCopy: null,
    f: {},
    fromLast: [],
    restPast: null,
    restFromLast: false,
    rest: null,
    xr: [],
    xrKind: "now",
    fdv: {},
    fdvNot: false,
    fdvSus: false,
    fdvReason: null,
    changeable: null,
    uncertain: null,
    review: null,
    copyGiven: [],
    sources: [],
    text: { ...NO_TEXT },
  };
}

/** The synthetic worked example the prototype opens on (How to: Example or Start blank). */
export function exampleTriage(): TriageState {
  return {
    ...blankTriage(),
    how: "phone",
    where: "ED",
    present: "yes",
    others: ["Other service"],
    purpose: "Referral",
    atsi: "n",
    interp: "no",
    problems: ["Psychosis", "Aggression", "Alcohol or drugs"],
    aware: ["opposed", "carer"],
    f: {
      "violence.now.intent": "y",
      "general.now.agit": "y",
      "other.now.nonadn": "y",
      "other.now.leave": "y",
    },
    legal: "cto",
    ahd: "none",
    sources: ["Referrer", "Person", "Records"],
    text: {
      ...NO_TEXT,
      revTime: "06/11 09:42",
      note: "Why now: Five days of rising agitation and poor sleep after a missed depot dose.\nRequest: ED asks for admission and a bed review today.\nViews: Does not want admission. Mother supports admission.\nHistory: Schizoaffective disorder. Two admissions this year, both after stopping treatment. On CTO with depot, last dose missed.\nAlcohol and drugs: Daily cannabis; denies other use today.\n",
      rp: "Risk: Raised risk of violence to staff and family now, above his baseline, in the context of relapse and threats today.\nProtective: Engaged with CMHT; mother supportive.\n",
      legalForm: "Form 5A · 28/01/2027 23:59",
      mseBox:
        'Speech: Pressured, hard to interrupt\nMood and affect: Irritable. "I just need sleep"\nThought content: Grandiose delusions. King of the city; special mission\nPerception: No perceptual disturbance\nInsight and judgement: No insight',
    },
  };
}

export type FactorRow = { key: string; area: string; kind: "bg" | "now"; name: string; mark?: FactorMark };

export function allFactors(state: TriageState): FactorRow[] {
  return AREAS.flatMap((area) =>
    (["bg", "now"] as const).flatMap((kind) =>
      area[kind].map(([id, name]) => {
        const key = `${area.id}.${kind}.${id}`;
        return { key, area: area.id, kind, name, mark: state.f[key] };
      }),
    ),
  );
}

export function mseAnswered(state: TriageState, domain: string): boolean {
  if (state.mseMode === "box") return boxLine(state.text.mseBox, domain).length > 0;
  const entry = state.mse[domain];
  return Boolean(entry && (entry.chips.length > 0 || entry.detail.trim()));
}

export const mseAnsweredCount = (state: TriageState) => MSE.filter((d) => mseAnswered(state, d.id)).length;

/** Each answered domain as [label, text], from whichever layout is showing. */
export function mseLines(state: TriageState): [string, string][] {
  if (state.mseMode === "box") return parseHeadedText(state.text.mseBox);
  return MSE.filter((d) => mseAnswered(state, d.id)).map((d) => [d.label, domainLineText(state.mse[d.id])]);
}

export function fdvOutcome(state: TriageState): string | null {
  if (state.fdvNot) return state.fdvReason ? "Not completed" : null;
  const answers = ["q1", "q2", "q3"].map((q) => state.fdv[q]);
  if (answers.includes("y")) return "Disclosed";
  if (answers.every((a) => a === "n")) return state.fdvSus ? "Suspected, not disclosed" : "Not disclosed";
  return null;
}

/** What is new today against the last RAMP's current flags, and what was not seen today. */
export function sinceLastText(state: TriageState): string {
  const now = allFactors(state)
    .filter((f) => f.kind === "now" && f.mark === "y")
    .map((f) => f.key);
  const fresh = now.filter((k) => !(LAST_TRIAGE.nowFlags as readonly string[]).includes(k));
  const gone = LAST_TRIAGE.nowFlags.filter((k) => !now.includes(k));
  const names = (keys: readonly string[]) => keys.map((k) => FACTOR_NAME[k].toLowerCase()).join(", ");
  const parts = [
    fresh.length ? `New since 12 Oct: ${names(fresh)}.` : "",
    gone.length ? `Not seen today: ${names(gone)}.` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

export const acuteFlagNames = (state: TriageState) =>
  ACUTE_FLAGS.filter((k) => state.f[k] === "y").map((k) => FACTOR_NAME[k].toLowerCase());

export type Requirement = { section: SectionId; label: string; ok: boolean; blocks: boolean };

/** Everything the form checks. A blocking one is needed before signing; the rest are to check. */
export function requirements(state: TriageState): Requirement[] {
  const out: Requirement[] = [];
  const add = (section: SectionId, label: string, ok: unknown, blocks: boolean) =>
    out.push({ section, label, ok: Boolean(ok), blocks });
  const t = state.text;
  add("rev", "Reviewed time", t.revTime.trim().length >= 5, true);
  add("rev", "How", state.how, true);
  add("rev", "Where", state.where, true);
  add("rev", "Person present", state.present, true);
  add("rev", "Purpose", state.purpose, true);
  add("rev", "Episode", state.episode, true);
  add("rev", "Aboriginal status", state.atsi, false);
  add("rev", "Interpreter", state.interp, false);
  add("note", "Assessment", isWritten(t.note), true);
  add("note", "Problems", state.problems.length, false);
  for (const heading of emptyHeadings(t.note, GUIDES.note)) add("note", `Empty heading: ${heading}`, false, false);
  const answered = mseAnsweredCount(state);
  add("mse", "Mental state", answered > 0, true);
  if (answered > 0 && answered < MSE.length)
    add("mse", `Mental state: ${answered} of ${MSE.length} domains`, false, false);
  add("dec", "Urgency", state.urgency, true);
  if (state.urgency && state.urgency !== REFERRER_URGENCY)
    add("dec", "Why urgency differs", t.urgReason.trim().length > 3, true);
  add("dec", "Outcome", state.outcome, true);
  add("dec", "Mental Health Act", state.legal, true);
  if (state.actions.includes("Bed request")) add("dec", "Medical clearance", state.medical, true);
  add("risk", "Rest of history", state.restPast, true);
  add("risk", "Rest of current risk", state.rest, true);
  add("risk", "FDV screen", fdvOutcome(state), true);
  add("plan", "Formulation and plan", isWritten(t.rp), true);
  add("plan", "Review date", state.review, true);
  add("plan", "Safety plan", headingFilled(t.rp, "Plan") || headingFilled(t.rp, "Crisis"), false);
  add("plan", "Changeable and uncertainty", state.changeable && state.uncertain, false);
  for (const heading of emptyHeadings(t.rp, GUIDES.rp)) add("plan", `Empty heading: ${heading}`, false, false);
  return out;
}

export type SectionStatus = { needed: number; toCheck: number; done: boolean };

export function sectionStatus(reqs: readonly Requirement[], section: SectionId): SectionStatus {
  const mine = reqs.filter((r) => r.section === section && !r.ok);
  const needed = mine.filter((r) => r.blocks).length;
  return { needed, toCheck: mine.length - needed, done: needed === 0 };
}

export const hasLegalForm = (state: TriageState) => Boolean(state.legal && LEGAL_WITH_FORM.includes(state.legal));
export const areaShortName = (area: string) => (AREA_NAME[area] ?? area).split(" ")[0];
