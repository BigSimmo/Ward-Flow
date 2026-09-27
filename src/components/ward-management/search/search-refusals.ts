/**
 * THE SENTENCES SEARCH REFUSES WITH, AND WHY THEY ARE CONSTANTS.
 *
 * A refusal is a promise about what this system will never do — return a risk score, an acuity
 * score or a best match about a person. Standard §8.4: no verdict about a person is ever drawn.
 * The wording is fixed in §8.6 and is pinned verbatim by `tests/ward-search-refusals.test.ts`,
 * because a reworded refusal is a different promise and nothing else would go red.
 *
 * ⚠️ The Patient search DRAWING carries three bespoke refusal sentences that are not these. That
 * is a mockup defect and is routed to Ward Mockups. It is not copied here.
 */
export type SearchRefusal = { kind: "score" | "closed"; sentence: string };

const SCORE_WORDS = /\b(risk|acuity|scores?|best\s+match)\b/iu;
const CLOSED_WORDS = /\b(closed|arrived|discharged)\b/iu;

export function refusalFor(query: string): SearchRefusal | undefined {
  if (SCORE_WORDS.test(query)) {
    return {
      kind: "score",
      sentence:
        "Search does not return a risk or acuity score or a best match. Search by name, identifier, department, ward or owner.",
    };
  }
  if (CLOSED_WORDS.test(query)) {
    return {
      kind: "closed",
      sentence: "Closed and arrived movements are not searchable here. They are in the Movement screen's register.",
    };
  }
  return undefined;
}

export const NOTHING_FOUND = (query: string): string =>
  `Nothing matches ‘${query}’. Search finds patients by name or identifier, movements, departments, wards, owners and tools.`;

export const RESULTS_FOOTER = "Names are invented. Search never returns a risk score, an acuity score or a best match.";
