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
  FDV_FACTORS,
  GUIDES,
  LAST_TRIAGE,
  LEGAL_WITH_FORM,
  MSE,
  MSE_NEGATIVES,
  MSE_SIGNALS,
  PATIENT,
  WHO_TOLD,
  type SectionId,
  type Tier,
  type TriagePerson,
} from "./triage-risk-data";
import {
  boxLine,
  checkReviewTime,
  domainLineText,
  emptyHeadings,
  hasPhrase,
  headingFilled,
  isWritten,
  parseHeadedText,
  type DomainEntry,
} from "./triage-risk-text";

/** A RAMP factor: present ("y"), not present ("n") or not known ("u"); absent means not marked. */
type FactorMark = "y" | "n" | "u";

export type TextKey =
  | "revTime"
  | "note"
  | "rp"
  | "legalForm"
  | "urgReason"
  | "urgNoneWhy"
  | "consultWho"
  | "otherRisk"
  | "mseBox"
  | "accompanied"
  | "interpLang"
  | "refName"
  | "refRole"
  | "refPhone";

export type TriageState = {
  /** Who the triage is for, from the record. Not an answer: it sets the banner and what the record offers. */
  person: TriagePerson;
  how: string | null;
  where: string | null;
  present: string | null;
  others: string[];
  /** How they arrived (Review details). */
  arrivedBy: string | null;
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
  /** Urgency A: no one needed to be told (with a reason). */
  urgNone: boolean;
  medical: string | null;
  legal: string | null;
  ahd: string | null;
  ahdCopy: string | null;
  f: Record<string, FactorMark>;
  /** Past flags carried from the last RAMP (so Undo can take them back). */
  fromLast: string[];
  /** Carried flags checked with the person today. */
  confirmed: string[];
  /** Never carried: always answered today. */
  restPast: string | null;
  rest: string | null;
  /** The factors "Rest of current risk: Not present" was confirmed for; null until confirmed. */
  restCov: string[] | null;
  xr: { t: string; k: "now" | "bg" }[];
  xrKind: "now" | "bg";
  fdv: Record<string, "y" | "n">;
  /** Asked alone, answered before the questions. */
  fdvAlone: "yes" | "no" | null;
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
  urgNoneWhy: "",
  consultWho: "",
  otherRisk: "",
  mseBox: "",
  accompanied: "",
  interpLang: "",
  refName: "",
  refRole: "",
  refPhone: "",
};

/**
 * Nothing clinical chosen. The episode comes from the referral when the referral names one (the
 * Example's R-1182 is from ED); a person with no such referral starts with no episode either.
 */
export function blankTriage(person: TriagePerson = PATIENT): TriageState {
  return {
    person,
    how: null,
    where: null,
    present: null,
    others: [],
    arrivedBy: null,
    purpose: null,
    episode: person.referral?.episode ?? null,
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
    urgNone: false,
    medical: null,
    legal: null,
    ahd: null,
    ahdCopy: null,
    f: {},
    fromLast: [],
    confirmed: [],
    restPast: null,
    rest: null,
    restCov: null,
    xr: [],
    xrKind: "now",
    fdv: {},
    fdvAlone: null,
    fdvNot: false,
    fdvSus: false,
    fdvReason: null,
    changeable: null,
    uncertain: null,
    review: null,
    copyGiven: [],
    sources: [],
    // The referrer is a fact from the referral, shown as a line with Change; nothing clinical is chosen.
    text: {
      ...NO_TEXT,
      refName: person.referral?.referrer?.name ?? "",
      refRole: person.referral?.referrer?.role ?? "",
      refPhone: person.referral?.referrer?.phone ?? "",
    },
  };
}

/** The synthetic worked example the prototype opens on (How to: Example or Start blank). */
export function exampleTriage(): TriageState {
  return {
    ...blankTriage(PATIENT),
    how: "phone",
    where: "ED",
    present: "yes",
    others: ["Other service"],
    arrivedBy: "Ambulance",
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
    sources: ["Person", "Family or carer", "Records"],
    text: {
      ...blankTriage(PATIENT).text,
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
  if (state.fdvAlone === "no") return null;
  const answers = ["q1", "q2", "q3"].map((q) => state.fdv[q]);
  if (answers.includes("y")) return "Disclosed";
  if (answers.every((a) => a === "n")) return state.fdvSus ? "Suspected, not disclosed" : "Not disclosed";
  return null;
}

/** What is new today against the last RAMP's current flags, and what was not seen today. */
export function sinceLastText(state: TriageState): string {
  if (!state.person.lastTriage) return "";
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

/** Whether a domain's line or chips hold a phrase, in whichever layout is showing. */
function mseHas(state: TriageState, domain: string, phrase: string): boolean {
  if (state.mseMode === "box") return hasPhrase(boxLine(state.text.mseBox, domain), phrase, domain);
  const entry = state.mse[domain];
  return Boolean(entry && (entry.chips.includes(phrase) || hasPhrase(entry.detail, phrase, domain)));
}

/** What in the mental state or the FDV screen says a factor may be present. */
function factorSignals(state: TriageState, key: string): string[] {
  const out: string[] = [];
  for (const [flag, signs] of MSE_SIGNALS) {
    if (flag !== key) continue;
    for (const [domain, phrase] of signs)
      if (mseHas(state, domain, phrase)) out.push(`mental state: ${phrase.toLowerCase()}`);
  }
  const fdv = fdvOutcome(state);
  if ((FDV_FACTORS as readonly string[]).includes(key) && (fdv === "Disclosed" || fdv === "Suspected, not disclosed"))
    out.push(`FDV screen: ${fdv.toLowerCase()}`);
  return out;
}

export type RestSets = {
  /** Every unmarked factor of the kind. */
  all: FactorRow[];
  /** Unmarked and not contradicted: what "Not present" covers. */
  covered: FactorRow[];
  /** Unmarked but contradicted: check these first. */
  conflicts: { factor: FactorRow; why: string[] }[];
};

/** What a "Rest of …" answer covers: the unmarked factors, less any the mental state or FDV contradicts. */
export function restSets(state: TriageState, kind: "now" | "bg"): RestSets {
  const all = allFactors(state).filter((f) => f.kind === kind && !f.mark);
  const covered: FactorRow[] = [];
  const conflicts: RestSets["conflicts"] = [];
  for (const factor of all) {
    const why = factorSignals(state, factor.key);
    if (why.length) conflicts.push({ factor, why });
    else covered.push(factor);
  }
  return { all, covered, conflicts };
}

/** "Rest of current risk: Not present" is confirmed for every factor it now covers. */
export function restConfirmed(state: TriageState): boolean {
  if (state.rest !== "np") return true;
  const confirmed = state.restCov;
  return Boolean(confirmed && restSets(state, "now").covered.every((f) => confirmed.includes(f.key)));
}

/** A carried flag still present and not yet checked today. */
const carriedUnchecked = (state: TriageState) =>
  state.fromLast.filter((k) => state.f[k] === "y" && !state.confirmed.includes(k));

/** Where a "Go to" lands: an element by selector; a factor not on the form opens All RAMP factors. */
export type Target = { selector: string; factor?: string };

const radio = (id: string): Target => ({ selector: `#${id} [role="radio"][tabindex="0"]` });
const factorTarget = (key: string): Target => ({ selector: `[data-factor="${key}"] button`, factor: key });
const mseTarget = (state: TriageState, domain: string): Target => ({
  selector: state.mseMode === "box" ? "#triage-mse-box" : `#triage-mx-${domain}`,
});

export type Requirement = {
  section: SectionId;
  label: string;
  ok: boolean;
  blocks: boolean;
  target?: Target;
};

/** The "Before you sign" conflict check: what the form says one way and the record another. */
function conflictChecks(state: TriageState): Requirement[] {
  const out: Requirement[] = [];
  const add = (section: SectionId, label: string, blocks: boolean, target: Target) =>
    out.push({ section, label, ok: false, blocks, target });
  if (state.rest === "np")
    for (const { factor } of restSets(state, "now").conflicts)
      add("risk", `Conflict: check ${factor.name}`, true, factorTarget(factor.key));
  if (state.restPast === "np")
    for (const { factor } of restSets(state, "bg").conflicts)
      add("risk", `Conflict: check ${factor.name} (history)`, true, factorTarget(factor.key));
  for (const factor of allFactors(state)) {
    if (factor.mark !== "n") continue;
    const why = factorSignals(state, factor.key);
    if (why.length)
      add("risk", `Check: ${factor.name} marked not present (${why[0]})`, false, factorTarget(factor.key));
  }
  for (const [domain, phrase, flag] of MSE_NEGATIVES)
    if (state.f[flag] === "y" && mseHas(state, domain, phrase))
      add(
        "mse",
        `Check: ${FACTOR_NAME[flag]} flagged, mental state says ${phrase.toLowerCase()}`,
        false,
        mseTarget(state, domain),
      );
  if (state.fdvAlone === "yes" && (state.how === "phone" || state.others.length))
    add(
      "risk",
      `Check: FDV asked alone, but the review ${state.how === "phone" ? "was by phone" : "had others present"}`,
      false,
      radio("triage-fdv-alone"),
    );
  if (state.present === "no" && ["q1", "q2", "q3"].some((q) => state.fdv[q]))
    add("rev", "Check: FDV answered, but person not present", false, radio("triage-present"));
  return out;
}

/**
 * Everything the form checks. A blocking one is needed before signing; the rest are to check.
 * `now` is the time the reviewed time must not pass.
 */
export function requirements(state: TriageState, now: number): Requirement[] {
  const out: Requirement[] = [];
  const add = (section: SectionId, label: string, ok: unknown, blocks: boolean, target?: Target) =>
    out.push({ section, label, ok: Boolean(ok), blocks, target });
  const t = state.text;
  add("rev", "Reviewed time", checkReviewTime(t.revTime, now).ok, true, { selector: "#triage-rev-time" });
  add("rev", "How", state.how, true);
  add("rev", "Where", state.where, true);
  add("rev", "Person present", state.present, true);
  add("rev", "Purpose", state.purpose, true);
  add("rev", "Episode", state.episode, true);
  add("rev", "Aboriginal status", state.atsi, false);
  add("rev", "Interpreter", state.interp && (state.interp === "no" || state.text.interpLang.trim()), false);
  add("note", "Assessment", isWritten(t.note), true);
  add("note", "Problems", state.problems.length, false);
  for (const heading of emptyHeadings(t.note, GUIDES.note)) add("note", `Empty heading: ${heading}`, false, false);
  const answered = mseAnsweredCount(state);
  add(
    "mse",
    answered ? `Mental state: ${answered} of ${MSE.length} domains` : "Mental state",
    answered === MSE.length,
    true,
    state.mseMode === "box" ? { selector: "#triage-mse-box" } : undefined,
  );
  add("dec", "Urgency", state.urgency, true);
  const asked = state.person.referral?.urgency;
  if (state.urgency && asked && state.urgency !== asked)
    add("dec", "Why urgency differs", t.urgReason.trim().length > 3, true);
  if (state.urgency === "A")
    add(
      "dec",
      "Who was told (urgency A)",
      WHO_TOLD.some(([action]) => state.actions.includes(action)) || (state.urgNone && t.urgNoneWhy.trim().length > 3),
      true,
      { selector: state.urgNone ? "#triage-urg-none-why" : "#triage-urg-who button" },
    );
  add("dec", "Outcome", state.outcome, true);
  add("dec", "Mental Health Act", state.legal, true);
  if (state.actions.includes("Bed request")) add("dec", "Medical clearance", state.medical, true);
  add("risk", "Rest of history", state.restPast, true, radio("triage-rest-past"));
  const unchecked = carriedUnchecked(state);
  if (unchecked.length)
    add("risk", `Carried, not re-checked: ${unchecked.map((k) => FACTOR_NAME[k]).join(", ")}`, false, false, {
      selector: "#triage-carried button",
    });
  add("risk", "Rest of current risk", state.rest, true, radio("triage-rest-now"));
  if (state.rest === "np")
    add("risk", "Confirm what Rest of current risk covers", restConfirmed(state), true, {
      selector: "#triage-rest-ok",
    });
  add("risk", "FDV asked alone", state.fdvAlone || state.fdvNot, true, radio("triage-fdv-alone"));
  add("risk", "FDV screen", fdvOutcome(state), true, {
    selector: state.fdvNot ? "#triage-fdv-reason button" : "[data-fdv-question]",
  });
  add("plan", "Formulation and plan", isWritten(t.rp), true);
  add("plan", "Review date", state.review, true);
  // A safety plan is needed with any current risk or an urgent response.
  const planNeeded =
    state.urgency === "A" ||
    state.urgency === "B" ||
    allFactors(state).some((f) => f.kind === "now" && f.mark === "y") ||
    state.xr.some((x) => x.k !== "bg");
  add("plan", "Safety plan", headingFilled(t.rp, "Plan") || headingFilled(t.rp, "Crisis"), planNeeded, {
    selector: "#triage-rp",
  });
  add("plan", "Risk may change quickly", state.changeable, true, radio("triage-changeable"));
  add("plan", "Factors add uncertainty", state.uncertain, true, radio("triage-uncertain"));
  for (const heading of emptyHeadings(t.rp, GUIDES.rp)) add("plan", `Empty heading: ${heading}`, false, false);
  return [...out, ...conflictChecks(state)];
}

export type SectionStatus = { needed: number; toCheck: number; done: boolean; text: string };

export function sectionStatus(reqs: readonly Requirement[], section: SectionId, state: TriageState): SectionStatus {
  const mine = reqs.filter((r) => r.section === section && !r.ok);
  const needed = mine.filter((r) => r.blocks).length;
  const toCheck = mine.length - needed;
  let text = needed ? `${needed} needed` : toCheck ? `${toCheck} to check` : "Done";
  // Mental state is complete only when all eight are answered or marked Not assessed.
  const answered = mseAnsweredCount(state);
  if (section === "mse" && answered < MSE.length)
    text = `${answered} of ${MSE.length}${needed > 1 ? ` · ${needed - 1} more needed` : ""}`;
  return { needed, toCheck, done: needed === 0, text };
}

export const hasLegalForm = (state: TriageState) => Boolean(state.legal && LEGAL_WITH_FORM.includes(state.legal));
export const areaShortName = (area: string) => (AREA_NAME[area] ?? area).split(" ")[0];
