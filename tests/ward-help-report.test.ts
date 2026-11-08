import { describe, expect, it } from "vitest";

import {
  browserSummary,
  findPatientDetails,
  patientDetailRefusal,
  reportMailto,
  reportText,
  reportTime,
  supportEmail,
} from "@/components/ward-management/help/ward-help-report";

// Synthetic examples only: every name and number below is made up.
describe("Report a problem: patient detail check", () => {
  it.each([
    ["UMRN 1234567 would not load", "record-number"], // precommit-scan: allow (made-up detector input)
    ["MRN: A123456 stuck", "record-number"], // precommit-scan: allow (made-up detector input)
    ["the card for UM100001 froze", "record-number"],
    ["number 20034567 again", "record-number"],
    ["Medicare 2123 45679 1 shown", "medicare"],
    ["call 0412 345 678 back", "phone"],
    ["rang +61 8 9224 1234", "phone"],
    ["ward phone 9224 1234", "phone"],
    ["email jane.citizen@example.invalid", "email"],
    ["born 14/03/1988", "date"],
    ["DOB 3-4-88", "date"],
    ["dob was 14 March 1988", "date"],
    ["dob was March 14, 1988", "date"],
    ["Mr Smith was not on the list", "titled-name"],
    ["mrs O'Brien moved", "titled-name"],
    ["Dr. Ng could not sign", "titled-name"],
    ["SMITH, John showed twice", "surname-first"],
  ] as const)("finds %j as %s", (text, kind) => {
    expect(findPatientDetails(text)).toContain(kind);
  });

  it.each([
    "The board froze after I pressed Accept on bed 12.",
    "Ward 3 showed 0 free beds but the ward said 2.",
    "Transport time shortcut picked 14:30 instead of 15:00.",
    "The DOB field is in the wrong place on the referral form.",
    "I miss the old filter on Movements.",
    "Pressed Save at 8/11 and it spun for a minute.",
    "Page WF-001 opened twice in 2026.",
    "The Medicare field label is cut off on my phone.",
  ])("lets an ordinary report through: %j", (text) => {
    expect(findPatientDetails(text)).toEqual([]);
  });

  it("names each kind once, in a fixed order, and never repeats the words", () => {
    const kinds = findPatientDetails("Mr Smith, 0412 345 678, Mr Jones, UMRN 7654321"); // precommit-scan: allow
    expect(kinds).toEqual(["record-number", "phone", "titled-name"]);
    const refusal = patientDetailRefusal(kinds);
    expect(refusal).toBe(
      "Remove patient details first. This looks like it has a record number (UMRN or MRN), a phone number and a name with a title, like Mr Smith. The time and screen are added for you.",
    );
    expect(refusal).not.toContain("0412");
    expect(refusal).not.toContain("Jones");
  });
});

describe("Report a problem: settings and report text", () => {
  it("reads one plain support address and nothing else", () => {
    expect(supportEmail("pilot-support@example.invalid")).toBe("pilot-support@example.invalid");
    expect(supportEmail("  pilot@example.invalid ")).toBe("pilot@example.invalid");
    expect(supportEmail(undefined)).toBeNull();
    expect(supportEmail("")).toBeNull();
    expect(supportEmail("not an address")).toBeNull();
    expect(supportEmail("a@example.invalid,b@example.invalid")).toBeNull();
    expect(supportEmail("a@example.invalid?bcc=b@example.invalid")).toBeNull();
  });

  it("names the browser and system briefly", () => {
    expect(
      browserSummary(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("Chrome 131 on Android");
    expect(
      browserSummary(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      ),
    ).toBe("Edge 131 on Windows");
    expect(
      browserSummary(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("Safari 18 on iOS");
    expect(browserSummary("")).toBe("Unknown browser");
  });

  it("gives the time locally and exactly", () => {
    expect(reportTime(new Date("2026-11-08T06:05:00.000Z"))).toMatch(/\(2026-11-08T06:05:00\.000Z\)$/u);
  });

  it("builds the report and a mailto whose body carries it, encoded", () => {
    const context = {
      screen: "Home",
      path: "/ward-flow",
      desk: "Bed manager",
      version: { id: "2026-11-08-help-report-a-problem", date: "2026-11-08" },
      browser: "Chrome 131 on Android",
      viewport: { width: 390, height: 844 },
      time: "now",
    };
    const text = reportText("  The board froze & would not scroll.  ", context);
    expect(text).toBe(
      [
        "Ward Flow problem report",
        "",
        "What happened:",
        "The board froze & would not scroll.",
        "",
        "Screen: Home (/ward-flow)",
        "Desk: Bed manager",
        "Version: latest change 2026-11-08 (2026-11-08-help-report-a-problem)",
        "Browser: Chrome 131 on Android",
        "Window: 390 × 844",
        "Time: now",
      ].join("\n"),
    );
    const href = reportMailto("pilot@example.invalid", "Ward Flow problem report: Home", text);
    expect(href.startsWith("mailto:pilot@example.invalid?subject=Ward%20Flow%20problem%20report%3A%20Home&body=")).toBe(
      true,
    );
    expect(decodeURIComponent(href.split("&body=")[1] ?? "")).toBe(text);
    expect(href).not.toContain("& would");
  });
});
