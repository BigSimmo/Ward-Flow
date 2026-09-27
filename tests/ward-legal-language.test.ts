import { describe, expect, it } from "vitest";

import { ALLOWED_CONTEXTS, BANNED, findBannedLegalLanguage } from "../scripts/ward-flow/check-ward-legal-language.mjs";

/**
 * The scanner that keeps the owner's 18 September decision from decaying: "stop the claim, keep the
 * facts."
 *
 * ⚠️ WHAT THESE TESTS ARE ACTUALLY FOR. A phrase list is trivially easy to write and trivially easy
 * to get wrong in one direction only. The dangerous failure is not a missed phrase — that shows up
 * as wording surviving on a screen, which somebody eventually reads. It is an over-broad match that
 * strips the ward authorisation explanation or an owner-approved form title, because THAT failure
 * looks like the guard working. So the negative cases below carry as much weight as the positive
 * one, and each names the thing it is protecting.
 */
describe("ward legal-language scanner", () => {
  it("trips on a known-bad rendered string", () => {
    const hits = findBannedLegalLanguage("a.tsx", `<span className={styles.kpiLabel}>Statutory Breaches</span>`);
    expect(hits).toHaveLength(1);
    expect(hits[0].phrase).toBe("Statutory Breaches");
    expect(hits[0].line).toBe(1);
  });

  it("trips on a deadline the app worked out for itself", () => {
    const hits = findBannedLegalLanguage("a.ts", 'chip: { level: "urgent", text: "Legal deadline passed" }');
    expect(hits.map((hit) => hit.phrase)).toContain("Legal deadline passed");
  });

  it("reports the true line number even after a comment above it is blanked", () => {
    const source = ["/* a block", "   comment */", "", "<span>Statutory Facts</span>"].join("\n");
    const hits = findBannedLegalLanguage("a.tsx", source);
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(4);
  });

  it("does not trip on an owner-approved form title", () => {
    // `ward-legal-forms.ts` records that the product owner approved adopting the official titles.
    expect(findBannedLegalLanguage("a.tsx", `<span>{legalFormName(form)}</span>`)).toHaveLength(0);
    expect(findBannedLegalLanguage("a.tsx", `<span>Form 3D</span>`)).toHaveLength(0);
    expect(findBannedLegalLanguage("a.tsx", `<span>Form 1A received</span>`)).toHaveLength(0);
  });

  it("does not trip on the ward authorisation explanation", () => {
    // `ward-eligibility.ts` refuses a non-voluntary movement a non-authorised bed. If the scanner
    // ate this sentence, the screen would refuse a bed without being able to say why.
    expect(
      findBannedLegalLanguage("a.tsx", `<p>Not authorised for involuntary admission — voluntary admissions only</p>`),
    ).toHaveLength(0);
  });

  it("does not trip on the transport legal-status vocabulary the owner ruled on", () => {
    expect(findBannedLegalLanguage("a.tsx", `<span>Involuntary</span>`)).toHaveLength(0);
    expect(findBannedLegalLanguage("a.tsx", `<span>Voluntary</span>`)).toHaveLength(0);
  });

  it("ignores comments, so writing the rule down does not fail the rule", () => {
    expect(findBannedLegalLanguage("a.tsx", `// never write Statutory Breaches here`)).toHaveLength(0);
    expect(findBannedLegalLanguage("a.tsx", `/* Statutory Forms Registry was removed on 18 Sept */`)).toHaveLength(0);
  });

  it("does not mistake a URL's slashes for a line comment", () => {
    const source = `const href = "https://example.test/x"; const label = "Statutory Facts";`;
    expect(findBannedLegalLanguage("a.ts", source)).toHaveLength(1);
  });

  it("lets a screen say it is NOT a statutory record", () => {
    expect(
      findBannedLegalLanguage("a.tsx", `<p>This is not a statutory record and carries no legal deadline.</p>`),
    ).toHaveLength(0);
  });

  it("keeps the escape hatch small, because every entry in it is a hole", () => {
    expect(ALLOWED_CONTEXTS.length).toBeLessThanOrEqual(6);
  });

  it("trips on Settings custody / Issue theatre badges", () => {
    expect(findBannedLegalLanguage("a.tsx", '<span>Form 4A Custody Stamp</span>').map((h) => h.phrase)).toContain(
      "Form 4A Custody Stamp",
    );
    expect(findBannedLegalLanguage("a.tsx", '<span>Form 1A Issue & Track</span>').map((h) => h.phrase)).toContain(
      "Form 1A Issue & Track",
    );
    expect(findBannedLegalLanguage("a.tsx", '<span>Destination no longer lawful</span>').map((h) => h.phrase)).toContain(
      "Destination no longer lawful",
    );
  });

  it("allows owner-approved Transport order titles with recorded-expiry framing (allowlist)", () => {
    // Documented allowlist: bare form titles + recorded-expiry wording are not Act-enforcement chrome.
    expect(
      findBannedLegalLanguage(
        "a.tsx",
        '<span>Transport order (4A) - recorded expiry in 2h 30m</span>',
      ),
    ).toHaveLength(0);
    expect(
      findBannedLegalLanguage("a.tsx", '<span>Transfer order (4C) - recorded expiry in 5h 00m</span>'),
    ).toHaveLength(0);
  });

  it("trips on colon-less order-clock remaining framing", () => {
    expect(
      findBannedLegalLanguage("a.tsx", '<span>Transport order (4A) remaining</span>').map((h) => h.phrase),
    ).toContain("Transport order (4A) remaining");
  });

  it("has one home for the banned list, with no duplicate entries", () => {
    expect(new Set(BANNED).size).toBe(BANNED.length);
  });
});
