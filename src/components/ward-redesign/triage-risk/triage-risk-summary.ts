/**
 * Triage and risk mock-up: the summary document, as data. The slide-out draws it and Copy writes it
 * as plain text from the same model, so the copy keeps its lines: "Label: value" lines and a blank
 * line between sections. Synthetic data only.
 */
import {
  FORMULATION_HEADINGS,
  HOW,
  LEGAL,
  MSE,
  PATIENT,
  REFERRER_URGENCY,
  REVIEW,
  TIER_LONG,
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
import { parseHeadedText } from "./triage-risk-text";

/** A run of text; a quiet one is drawn muted (a gap, or how a flag was recorded). */
type Bit = string | { quiet: string };
export type DocValue = readonly Bit[];

export type DocBlock =
  | { kind: "facts"; rows: readonly (readonly [label: string, value: DocValue])[] }
  | { kind: "note"; value: DocValue }
  | { kind: "missing"; text: string }
  | { kind: "tags"; label: string; items: readonly string[] };

type DocPart = { letter: string; title: string; edit: SectionId; blocks: DocBlock[] };

export type SummaryModel = {
  kicker: string;
  name: string;
  meta: string;
  keys: (readonly [label: string, value: DocValue])[];
  parts: DocPart[];
  foot: string[];
};

const HOW_NAME: Readonly<Record<string, string>> = Object.fromEntries(HOW);
const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const REVIEW_NAME: Readonly<Record<string, string>> = Object.fromEntries(REVIEW);
const SITUATION = ["Why now", "Request", "Views"];
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

export function summaryModel(state: TriageState): SummaryModel {
  const t = state.text;
  const notes = parseHeadedText(t.note);
  const plan = parseHeadedText(t.rp);
  const formulationHeads = FORMULATION_HEADINGS as readonly string[];
  const situation = notes.filter(([h]) => SITUATION.includes(h));
  const noteMental = notes.filter(([h]) => isMentalHeading(h));
  const background = notes.filter(([h]) => !SITUATION.includes(h) && !isMentalHeading(h));
  const formulation = plan.filter(([h]) => formulationHeads.includes(h));
  const safety = plan.filter(([h]) => !formulationHeads.includes(h));

  const factors = allFactors(state);
  const present = factors.filter((f) => f.mark === "y");
  const unknown = factors.filter((f) => f.mark === "u");
  const notPresent = factors.filter((f) => f.mark === "n");
  const pastPresent = present.filter((f) => f.kind === "bg");
  const nowPresent = present.filter((f) => f.kind === "now");
  const byArea = new Map<string, string[]>();
  for (const f of nowPresent) byArea.set(f.area, [...(byArea.get(f.area) ?? []), f.name]);
  const otherNow = state.xr.filter((x) => x.k !== "bg").map((x) => x.t);
  const otherPast = state.xr.filter((x) => x.k === "bg").map((x) => x.t);
  const since = sinceLastText(state);
  const fdv = fdvOutcome(state);

  const pastValue: DocValue = pastPresent.length
    ? pastPresent.flatMap((f, index) => {
        const bits: Bit[] = [index ? `, ${f.name}` : f.name];
        if (state.fromLast.includes(f.key))
          bits.push({
            quiet: state.confirmed.includes(f.key)
              ? " (carried, confirmed today)"
              : " (carried from 12 Oct, not re-checked)",
          });
        return bits;
      })
    : state.restPast
      ? ["None recorded"]
      : [{ quiet: "Not answered" }];

  const riskNote = [
    unknown.length ? `Not known: ${unknown.map((f) => f.name.toLowerCase()).join(", ")}.` : "",
    notPresent.length ? `Checked, not present: ${notPresent.map((f) => f.name.toLowerCase()).join(", ")}.` : "",
    restLine(state, "Rest of current risk", "now"),
    restLine(state, "Rest of history", "bg"),
    `FDV screen: ${(fdv ?? "not done").toLowerCase()}.`,
    state.fdvAlone ? `Asked alone: ${state.fdvAlone === "yes" ? "yes" : "no, could not ask alone"}.` : "",
    state.changeable === "yes" ? "Risk may change quickly." : "",
    state.uncertain === "yes" ? "Some factors add uncertainty." : "",
  ]
    .filter(Boolean)
    .join(" ");

  const actions = [...state.actions, ...(state.copyGiven.length ? [`Plan copy to ${state.copyGiven.join(", ")}`] : [])];
  const planNotes: string[] = [];
  if (state.urgency === "A" && state.urgNone)
    planNotes.push(`Urgency A, no one needed to be told: ${t.urgNoneWhy.trim() || "reason not given"}.`);
  if (t.consultWho.trim()) planNotes.push(`Consulted: ${t.consultWho.trim()}`);
  if (state.urgency && state.urgency !== REFERRER_URGENCY && t.urgReason.trim())
    planNotes.push(`Referrer urgency ${REFERRER_URGENCY}, changed to ${state.urgency}: ${t.urgReason.trim()}`);
  if (state.actions.includes("Bed request"))
    planNotes.push(
      `Medical clearance: ${{ yes: "cleared", pending: "pending", na: "not needed" }[state.medical ?? ""] ?? "not recorded"}.`,
    );
  if (state.ahd && state.ahd !== "none")
    planNotes.push(
      state.ahd === "ahd"
        ? `Advance health directive${state.ahdCopy === "onfile" ? " on the record" : state.ahdCopy === "toget" ? ", copy to be provided" : ""}: follow any relevant decision.`
        : state.ahd === "guard"
          ? "Guardian in place."
          : "Directive or guardian not asked.",
    );

  const legalForm = hasLegalForm(state) && t.legalForm.trim() ? ` · ${t.legalForm.trim()} (as typed)` : "";
  return {
    kicker: "Mental health triage and risk · synthetic",
    name: PATIENT.name,
    meta: [
      t.revTime.trim(),
      state.how ? HOW_NAME[state.how] : "how not set",
      state.where ?? "",
      PATIENT.author,
      "referral from Synthetic ED",
    ]
      .filter(Boolean)
      .join(" · "),
    keys: [
      ["Urgency", state.urgency ? [`${state.urgency} · ${TIER_LONG[state.urgency]}`] : gap],
      ["Outcome", state.outcome ? [state.outcome] : gap],
      ["Legal", state.legal ? [`${LEGAL_NAME[state.legal]}${legalForm}`] : gap],
      ["Review risk", state.review ? [REVIEW_NAME[state.review]] : gap],
    ],
    parts: [
      {
        letter: "S",
        title: "Situation",
        edit: "note",
        blocks: [
          situation.length ? facts(situation) : { kind: "missing", text: "Reason not written yet." },
          ...(state.problems.length
            ? [{ kind: "note", value: [`Problems: ${state.problems.join(", ")}.`] } as const]
            : []),
        ],
      },
      {
        letter: "B",
        title: "Background",
        edit: "note",
        blocks: [background.length ? facts(background) : { kind: "missing", text: "Not written yet." }],
      },
      {
        letter: "A",
        title: "Assessment",
        edit: "mse",
        blocks: [
          { kind: "facts", rows: mentalRows(state, noteMental) },
          ...(formulation.length ? [facts(formulation)] : []),
          {
            kind: "facts",
            rows: [
              ["Current risk", [nowPresent.length ? `${nowPresent.length} present` : "None flagged"]],
              ...[...byArea.entries()].map(([area, names]) => [areaShortName(area), [names.join(", ")]] as const),
              ...(otherNow.length ? [["Other current", [otherNow.join(", ")]] as const] : []),
              ...(otherPast.length ? [["Other past", [otherPast.join(", ")]] as const] : []),
              ["Past risk", pastValue],
            ],
          },
          ...(since ? [{ kind: "note", value: [since] } as const] : []),
          { kind: "note", value: [riskNote] },
        ],
      },
      {
        letter: "R",
        title: "Plan",
        edit: "plan",
        blocks: [
          safety.length ? facts(safety) : { kind: "missing", text: "Safety plan not written yet." },
          ...(actions.length ? [{ kind: "tags", label: "Actions", items: actions } as const] : []),
          ...planNotes.map((text) => ({ kind: "note", value: [text] }) as const),
        ],
      },
    ],
    foot: [
      "Prints as SMHMR900 and SMHMR905",
      state.sources.length ? `Collateral: ${state.sources.join(", ")}` : "",
      state.episode ? `${state.episode} episode` : "",
      hasLegalForm(state) ? "Legal form as typed. Not legally checked." : "",
    ].filter(Boolean),
  };
}

/** The summary as plain text: lines kept, a blank line between sections. */
export function summaryText(model: SummaryModel): string {
  const blockLines = (block: DocBlock): string[] => {
    if (block.kind === "facts") return block.rows.map(([label, value]) => `${label}: ${valueText(value)}`);
    if (block.kind === "tags") return [`${block.label}: ${block.items.join(", ")}`];
    if (block.kind === "missing") return [block.text];
    return [valueText(block.value)];
  };
  return [
    [model.kicker, model.name, model.meta].join("\n"),
    model.keys.map(([label, value]) => `${label}: ${valueText(value)}`).join("\n"),
    ...model.parts.map((part) => [part.title, ...part.blocks.flatMap(blockLines)].join("\n")),
    model.foot.join(" · "),
  ].join("\n\n");
}
