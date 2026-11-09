import { describe, expect, it } from "vitest";

import { DESK_GUIDES } from "../src/components/ward-management/help/ward-help-guide";
import * as helpContent from "../src/components/ward-management/help/ward-help-content";
import { CHECKLISTS } from "../src/components/ward-management/help/ward-help-checklists";
import { DESK_JOBS } from "../src/components/ward-management/help/ward-help-howto-desks";
import { TOUR_ROLE_LABELS, tourSteps } from "../src/components/ward-management/help/ward-tour-steps";
import {
  TOUR_ROLE_LABELS as PREVIEW_TOUR_ROLE_LABELS,
  tourSteps as previewTourSteps,
} from "../src/components/ward-redesign/pop-tour/tour-steps";
import { CLINICAL_VALUES } from "../src/components/ward-management/ward-clinical-values";

/**
 * D-106 (Josh, 9 Nov 2026): the default access grant lives in the register (`accessGrantDefault`),
 * and the Settings button reads it. Help, how-to and tour text keeps the words typed, so the help
 * bundles stay small; this test makes every "Give for N days" the reader is shown follow the register.
 */
function quotesIn(value: unknown, seen = new Set<unknown>()): number[] {
  if (typeof value === "string") return [...value.matchAll(/Give for (\d+) days/gu)].map((m) => Number(m[1]));
  if (!value || typeof value !== "object" || seen.has(value)) return [];
  seen.add(value);
  return Object.values(value).flatMap((item) => quotesIn(item, seen));
}

const tours = [
  ...Object.keys(TOUR_ROLE_LABELS).flatMap((role) =>
    (["desk", "tablet", "phone"] as const).map((device) =>
      tourSteps(role as keyof typeof TOUR_ROLE_LABELS, device, {}),
    ),
  ),
  ...Object.keys(PREVIEW_TOUR_ROLE_LABELS).flatMap((role) =>
    (["desk", "phone"] as const).map((device) =>
      previewTourSteps(role as keyof typeof PREVIEW_TOUR_ROLE_LABELS, device, {}),
    ),
  ),
];

describe("help text quotes the register's default access grant", () => {
  const days = CLINICAL_VALUES.accessGrantDefault.value;
  const quotes = quotesIn([DESK_GUIDES, helpContent, CHECKLISTS, DESK_JOBS, tours]);

  it("finds the help and tour text it guards", () => {
    expect(quotes.length).toBeGreaterThanOrEqual(5);
  });

  it("every quote matches the register", () => {
    expect(quotes.filter((quoted) => quoted !== days)).toEqual([]);
  });
});
