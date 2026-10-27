import { describe, expect, it } from "vitest";

import { GLOSSARY } from "@/components/ward-management/help/ward-help-content";

// H-0819 (wording audit WL-27): abbreviations the screens show must be spelt out in the Help glossary.
const SCREEN_ABBREVIATIONS = ["AWST", "CAMHS", "HDU", "KPI", "MHERL", "PIR"] as const;

describe("Help glossary spells out the screens' abbreviations", () => {
  it.each(SCREEN_ABBREVIATIONS)("has an entry for %s", (abbreviation) => {
    const entry = GLOSSARY.find((term) => term.term === abbreviation);
    expect(entry?.meaning.length).toBeGreaterThan(0);
  });
});
