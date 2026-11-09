// Feature 32 (Josh, 9 Nov 2026): the ward contact card, read only from the synthetic on-call directory.
import { describe, expect, it } from "vitest";

import { MOCK_NUMBER_PREFIX } from "@/components/ward-management/on-call/on-call-directory";
import { wardContactCard } from "@/components/ward-management/on-call/ward-contact-card";

describe("ward contact card", () => {
  it("gives the nurse in charge, the hospital's on-call psychiatry and switchboard, all mock numbers", () => {
    const card = wardContactCard("rph-adult-secure", 10 * 60)!;
    expect(card.siteName).toMatch(/Royal Perth/);
    expect(card.rows.map((row) => row.key)).toEqual([
      "nurseInCharge",
      "pager",
      "consultant",
      "registrar",
      "switchboard",
    ]);
    for (const row of card.rows.filter((item) => item.key !== "pager")) {
      expect(row.number, row.key).toMatch(new RegExp(`^${MOCK_NUMBER_PREFIX} \\d{4}$`));
      expect(row.entryId, row.key).toMatch(/^rph/);
    }
    // No ward has a pager in the directory.
    expect(card.rows.find((row) => row.key === "pager")).toMatchObject({ number: null, availability: null });
  });

  it("shows when each line answers until, and the on-call phone after hours", () => {
    const day = wardContactCard("rph-adult-secure", 10 * 60)!;
    const night = wardContactCard("rph-adult-secure", 22 * 60)!;
    const consultant = (card: typeof day) => card.rows.find((row) => row.key === "consultant")!;
    expect(consultant(day).availability).toMatch(/^Until \d\d:\d\d$/);
    expect(consultant(day).line).toBe("Day consultant");
    expect(consultant(night).line).toBe("On-call phone");
    // Answering drives the row's status glyph: a line open now must never read as closed.
    expect(consultant(day).answering).toBe(true);
    expect(consultant(night).answering).toBe(true);
    expect(day.rows.find((row) => row.key === "switchboard")!.availability).toBe("24 hours");
  });

  it("returns null for a ward the directory does not hold", () => {
    expect(wardContactCard("no-such-ward", 600)).toBeNull();
  });
});
