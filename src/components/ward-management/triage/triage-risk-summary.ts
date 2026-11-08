/**
 * Triage and risk (built 7 Nov 2026): the summary document, as data. The slide-out draws it and Copy writes it
 * as plain text from the same model, so the copy keeps its lines: "Label: value" lines and a blank
 * line between sections. Synthetic data only.
 */
import {
  AMHW,
  ATSI,
  EPISODE,
  FORMULATION_HEADINGS,
  HOW,
  LEGAL,
  MSE,
  REVIEW,
  SIGNED_IN,
  TIER_LONG,
  WHO_TOLD,
  type SectionId,
} from "./triage-risk-data";
import {
  allFactors,
  areaShortName,
  fdvOutcome,
  hasLegalForm,
  mseLines,
  restConfirmed,
  restSets,
  sinceLastText,
  type TriageState,
} from "./triage-risk-state";
import {
  ALL_PROGRAMS,
  PROGRAMS,
  PSOLIS_ACTIONS,
  PSOLIS_PROBLEMS,
  REFERRAL_TYPES,
  STREAMS,
  VENUES,
  psolisOf,
  type StreamCode,
} from "./triage-psolis-lists";
import { parseHeadedText } from "./triage-risk-text";
import { followUpText, meansSummary } from "./triage-risk-safety";

/** A run of text; a quiet one is drawn muted (a gap, or how a flag was recorded). */
type Bit = string | { quiet: string };
export type DocValue = readonly Bit[];

export type DocBlock =
  | { kind: "facts"; rows: readonly (readonly [label: string, value: DocValue])[] }
  | { kind: "note"; value: DocValue }
  | { kind: "missing"; text: string }
  | { kind: "tags"; label: string; items: readonly string[] };

export type DocPart = { letter: string; title: string; edit: SectionId; blocks: DocBlock[] };

export type SummaryModel = {
  kicker: string;
  name: string;
  /** Urgency · Outcome · Legal as typed · Reviewed time and mode · Reviewer. */
  keyLine: string;
  /** In PSOLIS order: review details, assessment, mental state, decision, risk, formulation and plan. */
  parts: DocPart[];
  /** The signature block. */
  signature: string[];
  foot: string[];
};

/** Who signed and when, once signed. */
export type SignedBy = { at: string; by: string };

const HOW_NAME: Readonly<Record<string, string>> = Object.fromEntries(HOW);
const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const REVIEW_NAME: Readonly<Record<string, string>> = Object.fromEntries(REVIEW);
const DOMAIN_LABELS = MSE.map((d) => d.label);
const isMentalHeading = (heading: string) => heading === "Mental state" || DOMAIN_LABELS.includes(heading);
const gap: DocValue = [{ quiet: "–" }];

const valueText = (value: DocValue) => value.map((bit) => (typeof bit === "string" ? bit : bit.quiet)).join("");

const facts = (rows: readonly (readonly [string, string])[]): DocBlock => ({
  kind: "facts",
  rows: rows.map(([label, text]) => [label || "Note", [text]] as const),
});

/** "Rest of current risk, not present, covers: …. Not covered, check: …." */
function restLine(state: TriageState, label: string, kind: "now" | "bg"): string {
  const value = kind === "now" ? state.rest : state.restPast;
  if (!value) return `${label}: not answered.`;
  const sets = restSets(state, kind);
  const notPresent = value === "np";
  const list = notPresent ? sets.covered : sets.all;
  const word = notPresent ? "not present" : kind === "now" ? "not assessed" : "not known";
  const pending = notPresent && kind === "now" && !restConfirmed(state) ? " (not yet confirmed)" : "";
  const names = list.map((f) => f.name.toLowerCase()).join(", ") || "none";
  let text = `${label}, ${word}${pending}, covers: ${names}.`;
  if (notPresent && sets.conflicts.length)
    text += ` Not covered, check: ${sets.conflicts.map((c) => c.factor.name.toLowerCase()).join(", ")}.`;
  return text;
}

/** The list a "Rest of …" answer belongs in: not present, not known or not assessed. */
function restWord(value: string | null, kind: "now" | "bg"): string {
  if (value === "np") return "not present";
  if (!value) return "rest not answered";
  return kind === "now" ? "not assessed" : "not known";
}

/** Mental state: all eight domains, in order, with "Not recorded" for any not answered. */
function mentalRows(state: TriageState, noteLines: readonly [string, string][]): (readonly [string, DocValue])[] {
  const byDomain = new Map<string, string>();
  const extra: [string, string][] = [];
  for (const [heading, text] of mseLines(state)) {
    const domain = MSE.find((d) => d.label.toLowerCase() === heading.toLowerCase());
    if (domain && !byDomain.has(domain.id)) byDomain.set(domain.id, text);
    else extra.push([heading, text]);
  }
  const fromNote = (label: string) => noteLines.find(([h]) => h === label)?.[1];
  return [
    ...MSE.map((d) => {
      const text = byDomain.get(d.id) ?? fromNote(d.label);
      return [d.label, text ? [text] : [{ quiet: "Not recorded" }]] as const;
    }),
    ...extra.map(([h, text]) => [h || "Note", [text]] as const),
    ...noteLines.filter(([h]) => h === "Mental state").map(([h, text]) => [h, [text]] as const),
  ];
}

const ATSI_NAME: Readonly<Record<string, string>> = Object.fromEntries(ATSI);
const AMHW_NAME: Readonly<Record<string, string>> = Object.fromEntries(AMHW);
const EPISODE_NAME: Readonly<Record<string, string>> = Object.fromEntries(EPISODE);
const AWARE_NAME: Readonly<Record<string, string>> = {
  person: "Person agrees",
  opposed: "Person opposed",
  carer: "Carer aware",
};
const value = (text: string | null | undefined): DocValue => (text ? [text] : gap);

type PickList = Parameters<typeof psolisOf>[0];

/**
 * A pick as Copy writes it (Josh, 7 Nov 2026): the exact PSOLIS value, never the screen label. An
 * "Other" pick with typed detail writes "OTHER: <detail>"; the detail comes from React state and
 * appears only in the document and its copied text, like every typed box.
 */
const pickText = (list: PickList, code: string | null | undefined, other?: string): string => {
  const written = psolisOf(list, code);
  const detail = other?.trim();
  return code === "other" && detail ? `${written}: ${detail}` : written;
};

/** The stream a program belongs to, for the Stream row. */
const streamOf = (program: string | null): StreamCode | undefined =>
  program
    ? (Object.keys(PROGRAMS) as StreamCode[]).find((stream) => PROGRAMS[stream].some(([code]) => code === program))
    : undefined;
const names = (list: readonly { name: string }[]) => list.map((f) => f.name).join(", ");

/**
 * The document the form builds (7 Nov 2026: a clean clinical record in PSOLIS order). A key line,
 * then six headed parts of label: value facts, mental state one line per domain, risk as Present,
 * Not known and Not present lists with past and current apart, then the signature block.
 */
export function summaryModel(state: TriageState, signed?: SignedBy): SummaryModel {
  const t = state.text;
  const person = state.person;
  const notes = parseHeadedText(t.note);
  const plan = parseHeadedText(t.rp);
  const formulationHeads = FORMULATION_HEADINGS as readonly string[];
  const noteMental = notes.filter(([h]) => isMentalHeading(h));
  const story = notes.filter(([h]) => !isMentalHeading(h));
  const formulation = plan.filter(([h]) => formulationHeads.includes(h));
  const safety = plan.filter(([h]) => !formulationHeads.includes(h));

  const factors = allFactors(state);
  const by = (kind: "now" | "bg", mark: "y" | "u") => factors.filter((f) => f.kind === kind && f.mark === mark);
  const nowPresent = by("now", "y");
  const byArea = new Map<string, string[]>();
  for (const f of nowPresent) byArea.set(f.area, [...(byArea.get(f.area) ?? []), f.name]);
  const otherNow = state.xr.filter((x) => x.k !== "bg").map((x) => x.t);
  const otherPast = state.xr.filter((x) => x.k === "bg").map((x) => x.t);
  const since = sinceLastText(state);
  const fdv = fdvOutcome(state);
  const means = meansSummary(state);
  const followUp = followUpText(state);

  const pastPresent = by("bg", "y");
  const pastValue: DocValue = pastPresent.length
    ? pastPresent.flatMap((f, index) => {
        const bits: Bit[] = [index ? `, ${f.name}` : f.name];
        if (state.fromLast.includes(f.key))
          bits.push({
            quiet: state.confirmed.includes(f.key)
              ? " (carried, confirmed today)"
              : ` (carried from ${state.person.last?.when ?? "the last triage"}, not re-checked)`,
          });
        return bits;
      })
    : state.restPast
      ? ["None recorded"]
      : [{ quiet: "Not answered" }];

  const told = WHO_TOLD.filter(([action]) => state.actions.includes(action)).map(([, label]) => label);
  const whoTold =
    state.urgency === "A"
      ? told.length
        ? told.join(", ")
        : state.urgNone
          ? `None needed: ${t.urgNoneWhy.trim() || "reason not given"}`
          : ""
      : told.join(", ");
  const decisionNotes: string[] = [];
  if (t.consultWho.trim()) decisionNotes.push(`Consulted: ${t.consultWho.trim()}`);
  const asked = person.referral?.urgency;
  if (state.urgency && asked && state.urgency !== asked && t.urgReason.trim())
    decisionNotes.push(`Referrer urgency ${asked}, changed to ${state.urgency}: ${t.urgReason.trim()}`);
  if (state.actions.includes("bed-request"))
    decisionNotes.push(
      `Medical clearance: ${{ yes: "cleared", pending: "pending", na: "not needed" }[state.medical ?? ""] ?? "not recorded"}.`,
    );
  if (state.ahd && state.ahd !== "none")
    decisionNotes.push(
      state.ahd === "ahd"
        ? `Advance health directive${state.ahdCopy === "onfile" ? " on the record" : state.ahdCopy === "toget" ? ", copy to be provided" : ""}: follow any relevant decision.`
        : state.ahd === "guard"
          ? "Guardian in place."
          : "Directive or guardian not asked.",
    );

  const legalForm = hasLegalForm(state) && t.legalForm.trim() ? ` · ${t.legalForm.trim()} (as typed)` : "";
  const legal = state.legal ? `${LEGAL_NAME[state.legal]}${legalForm}` : "";
  const mode = [t.revTime.trim(), state.how ? HOW_NAME[state.how] : ""].filter(Boolean).join(" ");
  const referrer = [[t.refName.trim(), t.refRole.trim()].filter(Boolean).join(", "), t.refPhone.trim()]
    .filter(Boolean)
    .join(" · ");
  const language = t.interpLang.trim();
  const problems = state.problems.map((code) => pickText(PSOLIS_PROBLEMS, code, t.problemOther));
  const actions = state.actions.map((code) => pickText(PSOLIS_ACTIONS, code, t.actionOther));

  return {
    kicker: "Mental health triage and risk · synthetic",
    name: person.name,
    keyLine: [
      state.urgency ? `Urgency ${state.urgency}, ${TIER_LONG[state.urgency].toLowerCase()}` : "Urgency not chosen",
      state.outcome ?? "Outcome not set",
      state.legal
        ? `${LEGAL_NAME[state.legal]}${hasLegalForm(state) && t.legalForm.trim() ? `, ${t.legalForm.trim().replace(/\s*·\s*/g, " ")}` : ""} (as typed)`
        : "Legal not set",
      mode ? `Reviewed ${mode}` : "Review time not set",
      signed?.by ?? SIGNED_IN,
    ].join(" · "),
    parts: [
      {
        letter: "1",
        title: "Review details",
        edit: "rev",
        blocks: [
          {
            kind: "facts",
            rows: [
              ["Reviewed", value(t.revTime.trim())],
              ["Mode", value(state.how ? HOW_NAME[state.how] : null)],
              ["Venue", value(pickText(VENUES, state.where, t.venueOther))],
              ["Stream", value(psolisOf(STREAMS, streamOf(state.program)))],
              ["Program", value(psolisOf(ALL_PROGRAMS, state.program))],
              ["Arrived by", value(state.arrivedBy)],
              ...(t.accompanied.trim() ? [["Accompanied by", [t.accompanied.trim()]] as const] : []),
              [
                "Person present",
                state.present
                  ? [
                      `${state.present === "yes" ? "Yes" : "No"}${state.others.length ? `; others: ${state.others.join(", ")}` : ""}`,
                    ]
                  : gap,
              ],
              ["Referral", value(person.referral ? `${person.referral.id} from ${person.referral.from}` : "None")],
              ...(referrer ? [["Referrer", [referrer]] as const] : []),
              ["Referral type", value(pickText(REFERRAL_TYPES, state.referralType, t.referralOther))],
              ["Purpose", value(state.purpose)],
              ["Episode", value(state.episode ? EPISODE_NAME[state.episode] : null)],
              [
                "Aboriginal status",
                state.atsi
                  ? [
                      `${ATSI_NAME[state.atsi]}${state.amhw ? `; Aboriginal MH worker ${AMHW_NAME[state.amhw]?.toLowerCase()}` : ""}`,
                    ]
                  : [{ quiet: "Not asked" }],
              ],
              [
                "Interpreter",
                state.interp
                  ? [
                      state.interp === "no"
                        ? "Not needed"
                        : `${state.interp === "unavail" ? "Needed, not available" : "Needed"}${language ? `, ${language}` : ", language not given"}`,
                    ]
                  : gap,
              ],
              ["Sources used", value(state.sources.join(", "))],
              ...(state.trans ? [["Notes source", ["Transcribed from paper notes"]] as const] : []),
            ],
          },
        ],
      },
      {
        letter: "2",
        title: "Assessment",
        edit: "note",
        blocks: [
          story.length ? facts(story) : { kind: "missing", text: "Reason not written yet." },
          ...(problems.length ? [{ kind: "facts", rows: [["Problems", [problems.join(", ")]]] } as const] : []),
          ...(state.aware.length
            ? [
                {
                  kind: "facts",
                  rows: [["Aware of referral", [state.aware.map((a) => AWARE_NAME[a] ?? a).join(", ")]]],
                } as const,
              ]
            : []),
        ],
      },
      {
        letter: "3",
        title: "Mental state",
        edit: "mse",
        blocks: [{ kind: "facts", rows: mentalRows(state, noteMental) }],
      },
      {
        letter: "4",
        title: "Triage decision",
        edit: "dec",
        blocks: [
          {
            kind: "facts",
            rows: [
              ["Urgency", state.urgency ? [`${state.urgency} · ${TIER_LONG[state.urgency]}`] : gap],
              ["Outcome", value(state.outcome)],
              ["Legal", legal ? [legal] : gap],
              ...(whoTold ? [["Who was told", [whoTold]] as const] : []),
              ...(followUp ? [["Follow-up", [followUp]] as const] : []),
            ],
          },
          ...(actions.length ? [{ kind: "tags", label: "Actions", items: actions } as const] : []),
          ...decisionNotes.map((text) => ({ kind: "note", value: [text] }) as const),
        ],
      },
      {
        letter: "5",
        title: "Risk assessment",
        edit: "risk",
        blocks: [
          {
            kind: "facts",
            rows: [
              ["Current: present", nowPresent.length ? [names(nowPresent)] : ["None flagged"]],
              ...[...byArea.entries()].map(([area, list]) => [`  ${areaShortName(area)}`, [list.join(", ")]] as const),
              ...(by("now", "u").length ? [["Current: not known", [names(by("now", "u"))]] as const] : []),
              [`Current: ${restWord(state.rest, "now")}`, [restLine(state, "Rest of current risk", "now")]],
              ...(otherNow.length ? [["Other current", [otherNow.join(", ")]] as const] : []),
              ...(means ? [["Means safety", [means]] as const] : []),
              ["Past: present", pastValue],
              ...(by("bg", "u").length ? [["Past: not known", [names(by("bg", "u"))]] as const] : []),
              [`Past: ${restWord(state.restPast, "bg")}`, [restLine(state, "Rest of history", "bg")]],
              ...(otherPast.length ? [["Other past", [otherPast.join(", ")]] as const] : []),
            ],
          },
          ...(since ? [{ kind: "note", value: [since] } as const] : []),
          {
            kind: "facts",
            rows: [
              [
                "FDV screen",
                [
                  `${fdv ?? "not done"}${state.fdvAlone ? `; asked alone: ${state.fdvAlone === "yes" ? "yes" : "no, could not ask alone"}` : ""}`,
                ],
              ],
              [
                "Risk may change quickly",
                value(state.changeable === "yes" ? "Yes" : state.changeable === "no" ? "No" : null),
              ],
              [
                "Factors add uncertainty",
                value(state.uncertain === "yes" ? "Yes" : state.uncertain === "no" ? "No" : null),
              ],
            ],
          },
        ],
      },
      {
        letter: "6",
        title: "Formulation and plan",
        edit: "plan",
        blocks: [
          formulation.length ? facts(formulation) : { kind: "missing", text: "Formulation not written yet." },
          safety.length ? facts(safety) : { kind: "missing", text: "Safety plan not written yet." },
          {
            kind: "facts",
            rows: [
              ["Review risk by", value(state.review ? REVIEW_NAME[state.review] : null)],
              ...(state.copyGiven.length ? [["Plan copy to", [state.copyGiven.join(", ")]] as const] : []),
            ],
          },
        ],
      },
    ],
    signature: signed
      ? [`Signed ${signed.at} by ${signed.by}`, "Prints as SMHMR900 and SMHMR905"]
      : [`Not signed. Reviewer: ${SIGNED_IN}`, "Prints as SMHMR900 and SMHMR905 once signed"],
    foot: [hasLegalForm(state) ? "Legal form as typed. Not legally checked." : "", "Synthetic record"].filter(Boolean),
  };
}

function blockLines(block: DocBlock): string[] {
  if (block.kind === "facts") return block.rows.map(([label, v]) => `${label.trim()}: ${valueText(v)}`);
  if (block.kind === "tags") return [`${block.label}: ${block.items.join(", ")}`];
  if (block.kind === "missing") return [block.text];
  return [valueText(block.value)];
}

/**
 * One part as plain text for its own PSOLIS box (7 Nov 2026): its lines in document order, one per
 * line, without the part heading (the box already has one). It never holds the UMRN; the copy
 * helper adds the synthetic first line.
 */
export function partText(part: DocPart): string {
  return part.blocks.flatMap(blockLines).join("\n");
}

/** The summary as plain text, in the same structure: lines kept, a blank line between sections. */
export function summaryText(model: SummaryModel): string {
  return [
    [model.kicker, model.name, model.keyLine].join("\n"),
    ...model.parts.map((part) => [`${part.letter}. ${part.title.toUpperCase()}`, partText(part)].join("\n")),
    ["SIGNATURE", ...model.signature].join("\n"),
    model.foot.join(" · "),
  ].join("\n\n");
}
