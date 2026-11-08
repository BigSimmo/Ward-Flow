/**
 * Triage and risk (built 7 Nov 2026): which finished sections fold to one line (7 Nov 2026), and the line each
 * shows. Pure, so the rules are tested apart from the page. Synthetic data only.
 *
 * - Assessment, Mental state and Triage decision fold once complete, as Review details already does.
 * - The section being worked in never folds: "engaged" is the last section that took focus or a
 *   press. A jump (the index, the summary, Before you sign) or Change opens a section until focus
 *   lands in it.
 * - A signed triage is read-only and stays open, so nothing is hidden behind a Change that cannot work.
 */
import { labelOf, PSOLIS_ACTIONS, PSOLIS_PROBLEMS } from "./triage-psolis-lists";
import { GUIDES, LEGAL, MSE, TIER_LONG, type SectionId } from "./triage-risk-data";
import { hasLegalForm, mseAnsweredCount, type TriageState } from "./triage-risk-state";
import { boxLine, guideHeadings, headingFilled, NA, wordCount } from "./triage-risk-text";

export const FOLDABLE: readonly SectionId[] = ["note", "mse", "dec"];

export type FoldInput = {
  /** Each section with nothing left that blocks signing. */
  done: Readonly<Partial<Record<SectionId, boolean>>>;
  /** The section that last took focus or a press, if any. */
  engaged: SectionId | null;
  /** The section a jump or Change is opening, until focus lands in it. */
  opening: SectionId | null;
  signed: boolean;
};

export function foldedSections({ done, engaged, opening, signed }: FoldInput): ReadonlySet<SectionId> {
  if (signed) return new Set();
  return new Set(FOLDABLE.filter((id) => done[id] && id !== engaged && id !== opening));
}

const LEGAL_NAME: Readonly<Record<string, string>> = Object.fromEntries(LEGAL);
const AWARE_NAME: Readonly<Record<string, string>> = {
  person: "person agrees",
  opposed: "person opposed",
  carer: "carer aware",
};

/** Whether a domain is marked Not assessed, in whichever layout is showing. */
function notAssessed(state: TriageState, domain: string): boolean {
  if (state.mseMode === "box") return /^not assessed\.?$/i.test(boxLine(state.text.mseBox, domain));
  return Boolean(state.mse[domain]?.chips.includes(NA));
}

/**
 * The folded line's facts, each a short run. Nothing new: each is what the section holds, so the
 * line can be read without opening it. A legal form and date appear only as typed.
 */
export function foldLine(state: TriageState, section: SectionId): string[] {
  if (section === "note") {
    const all = guideHeadings(GUIDES.note);
    const covered = all.filter((h) => headingFilled(state.text.note, h)).length;
    const aware = state.aware.map((a) => AWARE_NAME[a] ?? a).join(", ");
    return [
      `${wordCount(state.text.note)} words, ${covered} of ${all.length} headings`,
      state.problems.length
        ? state.problems.map((code) => labelOf(PSOLIS_PROBLEMS, code) || code).join(", ")
        : "No problems tapped",
      aware ? `Aware: ${aware}` : "",
    ].filter(Boolean);
  }
  if (section === "mse") {
    const skipped = MSE.filter((d) => notAssessed(state, d.id)).map((d) => d.label.toLowerCase());
    return [
      `${mseAnsweredCount(state)} of ${MSE.length} domains`,
      state.mseMode === "box" ? "One box" : "By domain",
      skipped.length ? `Not assessed: ${skipped.join(", ")}` : "",
    ].filter(Boolean);
  }
  if (section === "dec") {
    const form = hasLegalForm(state) ? state.text.legalForm.trim() : "";
    const legal = state.legal ? `${LEGAL_NAME[state.legal]}${form ? `, ${form} (as typed)` : ""}` : "";
    return [
      state.urgency ? `Urgency ${state.urgency}, ${TIER_LONG[state.urgency].toLowerCase()}` : "",
      state.outcome ?? "",
      legal,
      state.actions.length
        ? `Actions: ${state.actions.map((code) => labelOf(PSOLIS_ACTIONS, code) || code).join(", ")}`
        : "",
    ].filter(Boolean);
  }
  return [];
}
