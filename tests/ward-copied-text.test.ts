import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  copiedText,
  copyTextToClipboard,
  SYNTHETIC_COPY_LINE,
  withoutCopiedIdentifiers,
} from "@/components/ward-management/ward-clipboard";
import { referralIsbarText, referralLetterText } from "@/components/ward-management/referrals/referral-letter";

// D-71 item 7 (Josh, 21 Oct 2026): every Ward Flow copy starts with the synthetic line and carries
// no UMRN or date of birth. All names and numbers below are synthetic.

const UMRN = /UM\d{6}/;

function lines(text: string): string[] {
  return text.split("\n");
}

describe("copiedText", () => {
  it("puts the synthetic line first", () => {
    expect(lines(copiedText("Discharges, admission records, 4 open."))[0]).toBe(SYNTHETIC_COPY_LINE);
    expect(lines(copiedText("08 0000 1016"))).toEqual([SYNTHETIC_COPY_LINE, "08 0000 1016"]);
  });

  it("keeps a text that already opens with the synthetic line to one synthetic line", () => {
    const letter = "Synthetic prototype. Draft 10:46 AWST.\nMental health referral to a ward";
    expect(copiedText(letter)).toBe(letter);
    expect(copiedText(`${SYNTHETIC_COPY_LINE}\nTransport handover`)).toBe(`${SYNTHETIC_COPY_LINE}\nTransport handover`);
  });

  it("adds the line above a footer-only disclaimer", () => {
    const text = copiedText("Bed summary\nSynthetic prototype data. Not for clinical use.");
    expect(lines(text)[0]).toBe(SYNTHETIC_COPY_LINE);
  });

  it.each([
    [
      "a name with the number in brackets",
      "1. T2 Alex Testperson (UM100001) | waiting 3 h",
      "1. T2 Alex Testperson | waiting 3 h",
    ],
    [
      "a labelled number in a sentence",
      "I: Alex Testperson, 41, female, UMRN UM100001. Referral sent 10:46",
      "I: Alex Testperson, 41, female. Referral sent 10:46",
    ],
    [
      "a bare number between commas",
      "Identify: Alex Testperson, UM100001, 41 female.",
      "Identify: Alex Testperson, 41 female.",
    ],
    ["a number leading the value", "Identify: UM100001, Form 1A", "Identify: Form 1A"],
    ["a list of numbers in brackets", "2 new act now (UM100001, UM500002)", "2 new act now"],
    [
      "a number after a name",
      "- Bed review. Alex Testperson UM700003. ED to ward.",
      "- Bed review. Alex Testperson. ED to ward.",
    ],
    [
      "an unrecorded number",
      "I: Alex Testperson, 41, female, UMRN Not recorded. Referral sent",
      "I: Alex Testperson, 41, female. Referral sent",
    ],
  ])("strips the UMRN from %s", (_label, input, expected) => {
    expect(withoutCopiedIdentifiers(input)).toBe(expected);
  });

  it("drops lines that hold only an identifier", () => {
    const text = withoutCopiedIdentifiers(
      "Alex Testperson\nUMRN: UM100023\nDOB: 1988-03-14\nDate of birth: 14/03/1988\nWard 3",
    );
    expect(text).toBe("Alex Testperson\nWard 3");
  });

  it.each([
    [
      "DOB: 14/03/1988",
      "I: Alex Testperson, 41, female, DOB: 14/03/1988, Ward 3",
      "I: Alex Testperson, 41, female, Ward 3",
    ],
    ["Date of birth: 1988-03-14", "Alex Testperson (Date of birth: 1988-03-14) to Ward 3", "Alex Testperson to Ward 3"],
    ["DOB 14 March 1988", "Alex Testperson; DOB 14 March 1988. Ward 3", "Alex Testperson. Ward 3"],
    ["DOB: March 14, 1988", "Alex Testperson, DOB: March 14, 1988, Ward 3", "Alex Testperson, Ward 3"],
  ])("strips an inline date of birth (%s) mid-line (H-0332)", (_label, input, expected) => {
    expect(withoutCopiedIdentifiers(input)).toBe(expected);
  });

  it("keeps a month-first date that is not a date of birth", () => {
    const text = "Alex Testperson admitted March 14, 1988 review, Ward 3";
    expect(withoutCopiedIdentifiers(text)).toBe(text);
  });

  it("leaves text without identifiers untouched", () => {
    const text = "Out of area: 3 away from home , 12 bed days.\nState bed desk 08 0000 1234, 08:00 to 20:00";
    expect(withoutCopiedIdentifiers(text)).toBe(text);
  });
});

describe("referral letter and ISBAR copies", () => {
  const input = {
    destinationPhrase: "a ward",
    patientName: "Alex Testperson",
    umrn: "UM100001",
    ageSex: "41, female",
    suburb: "Midland",
    from: "Royal Perth Hospital ED",
    recipients: ["Ward 3"],
    urgency: "Tier 2, urgent",
    legalStatus: "Voluntary",
    reason: "Synthetic reason",
    history: "Synthetic history",
    risks: [],
    clearance: "Cleared",
    referrer: { name: "Dr Synthetic", role: "Registrar", phone: "08 0000 0001" },
  };

  it("copies the letter with one synthetic line and no UMRN line", () => {
    const text = copiedText(referralLetterText(input, "10:46"));
    expect(lines(text)[0]).toBe("Synthetic prototype. Draft 10:46 AWST.");
    expect(text).not.toMatch(UMRN);
    expect(text).not.toMatch(/^UMRN/m);
    expect(text).toContain("Name: Alex Testperson");
  });

  it("copies the ISBAR note without the UMRN", () => {
    const text = copiedText(referralIsbarText(input, { referralId: "R-1", sentAt: "10:50" }));
    expect(lines(text)[0]).toBe(SYNTHETIC_COPY_LINE);
    expect(text).not.toMatch(UMRN);
    expect(lines(text)[1]).toBe("I: Alex Testperson, 41, female. Referral sent 10:50 to Ward 3.");
  });
});

describe("copyTextToClipboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes the prepared text, not the raw text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyTextToClipboard("Alex Testperson (UM100001), Midland");
    expect(writeText).toHaveBeenCalledWith(`${SYNTHETIC_COPY_LINE}\nAlex Testperson, Midland`);
  });
});

// Every Ward Flow screen copies through ward-clipboard.ts, so none can skip the line or the scrub.
describe("one way onto the clipboard", () => {
  const roots = ["src/components/ward-management", "src/app/ward-flow"];
  const helper = "src/components/ward-management/ward-clipboard.ts";

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
  }

  it("has no direct clipboard write outside the helper", () => {
    const offenders = roots
      .flatMap((root) => sourceFiles(join(process.cwd(), root)))
      .filter((path) => relative(process.cwd(), path).replaceAll("\\", "/") !== helper)
      .filter((path) =>
        /\bwriteText\s*\(|execCommand\s*\(\s*["']copy|clipboard\s*\.\s*write\s*\(/.test(readFileSync(path, "utf8")),
      )
      .map((path) => relative(process.cwd(), path));
    expect(offenders).toEqual([]);
  });

  it("does not import the app-wide helper that skips the synthetic line", () => {
    const offenders = roots
      .flatMap((root) => sourceFiles(join(process.cwd(), root)))
      .filter((path) => readFileSync(path, "utf8").includes("@/lib/copy-to-clipboard"))
      .map((path) => relative(process.cwd(), path));
    expect(offenders).toEqual([]);
  });
});
