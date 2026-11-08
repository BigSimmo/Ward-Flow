/**
 * Triage and risk (Josh, 9 Nov 2026): the triage as an iSoBAR handover, for Copy as iSoBAR in the
 * summary slide-out. Built from the same summary model and state as Copy summary, so the two never
 * disagree. A value not on the form prints "–"; nothing is invented. The UMRN sits on its own line,
 * which the copy helper drops (ward-clipboard.ts), so it never leaves the app. Synthetic data only.
 */
import { FACTOR_NAME, SIGNED_IN, TIER_LONG } from "./triage-risk-data";
import { allFactors, mseLines, type TriageState } from "./triage-risk-state";
import { summaryModel, type DocValue, type SignedBy, type SummaryModel } from "./triage-risk-summary";
import { parseHeadedText } from "./triage-risk-text";
import { followUpText } from "./triage-risk-safety";

const NONE = "–";
const RECENT_DISCHARGE = "other.now.recdis";
/** Each mental state line is cut to this many characters: the handover is short. */
const MSE_CHARS = 60;

/** A value's words, or null when it holds only quiet text (a gap or "Not recorded"). */
function written(value: DocValue | undefined): string | null {
  if (!value || value.every((bit) => typeof bit !== "string")) return null;
  const text = value
    .map((bit) => (typeof bit === "string" ? bit : bit.quiet))
    .join("")
    .trim();
  return text || null;
}

/** One labelled fact from a part of the summary document, or null when it is not filled in. */
function fact(model: SummaryModel, letter: string, label: string): string | null {
  for (const block of model.parts.find((part) => part.letter === letter)?.blocks ?? [])
    if (block.kind === "facts") {
      const row = block.rows.find(([name]) => name === label);
      if (row) return written(row[1]);
    }
  return null;
}

function tags(model: SummaryModel, letter: string, label: string): string | null {
  const block = model.parts
    .find((part) => part.letter === letter)
    ?.blocks.find((b) => b.kind === "tags" && b.label === label);
  return block?.kind === "tags" && block.items.length ? block.items.join(", ") : null;
}

const short = (text: string) => (text.length > MSE_CHARS ? `${text.slice(0, MSE_CHARS - 1).trimEnd()}…` : text);
const or = (text: string | null | undefined) => (text && text.trim() ? text.trim() : NONE);

/** The triage as iSoBAR lines: Identify, Situation, Observations, Background, Assessment, Recommendation. */
export function isbarText(state: TriageState, signed?: SignedBy): string {
  const model = summaryModel(state, signed);
  const person = state.person;
  const factors = allFactors(state);
  const present = (kind: "bg" | "now") => factors.filter((f) => f.kind === kind && f.mark === "y");
  const pastFlags = present("bg").map((f) => f.name);
  const nowFlags = present("now").filter((f) => f.key !== RECENT_DISCHARGE);
  const discharged = state.f[RECENT_DISCHARGE] === "y";
  const followUp = followUpText(state);
  const protective = parseHeadedText(state.text.rp).find(([heading]) => heading.startsWith("Protective"))?.[1];
  const stream = fact(model, "1", "Stream");
  const program = fact(model, "1", "Program");
  const mental = mseLines(state)
    .filter(([, text]) => text.trim())
    .map(([heading, text]) => `${heading || "Note"}: ${short(text.trim())}`);

  return [
    "iSoBAR handover · synthetic",
    `I Identify: ${or(signed?.by ?? SIGNED_IN)} · ${stream || program ? [stream, program].filter(Boolean).join(", ") : NONE} · ${or(person.name)}, ${or(person.meta.split(" · ")[1])}`,
    `UMRN: ${or(person.umrn)}`,
    `S Situation: Urgency ${state.urgency ? `${state.urgency}, ${TIER_LONG[state.urgency].toLowerCase()}` : NONE} · Outcome ${or(state.outcome)} · Legal ${or(fact(model, "4", "Legal"))}`,
    `O Observations: ${mental.length ? mental.join("; ") : NONE}`,
    `B Background: Past risk ${pastFlags.length ? pastFlags.join(", ") : NONE}${discharged ? ` · ${FACTOR_NAME[RECENT_DISCHARGE]}` : ""}`,
    `A Assessment: Current risk ${nowFlags.length ? nowFlags.map((f) => f.name).join(", ") : NONE}${protective?.trim() ? ` · Protective: ${protective.trim()}` : ""}`,
    `R Recommendation: Actions ${or(tags(model, "4", "Actions"))} · Review risk by ${or(fact(model, "6", "Review risk by"))}${followUp ? ` · Follow-up ${followUp}` : ""}`,
  ].join("\n");
}
