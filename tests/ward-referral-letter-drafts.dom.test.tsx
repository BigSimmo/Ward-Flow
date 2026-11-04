import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { referralLetterModel } from "@/components/ward-management/referrals/referral-letter";
import { ReferralLetterDocument } from "@/components/ward-management/referrals/referral-letter-document";
import {
  clearSessionDrafts,
  draftSessionVersion,
  listSessionDrafts,
  sessionDraftKey,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

// RF2 and L12 (Josh, 4 Nov 2026). Synthetic people only.
const bus = vi.hoisted(() => ({ open: vi.fn<(href: string) => void>() }));
vi.mock("@/components/ward-management/shell/ward-drawer-bus", () => ({ openReferralSheet: bus.open }));
vi.mock("@/components/ward-management/settings/settings-desk-profile", () => ({
  useSettingsDeskProfile: () => ({ role: "ED registrar" }),
}));
vi.mock("@/components/ward-management/settings/discreet-names", () => ({
  usePatientNameDisplay: () => (name: string) => name,
}));
vi.mock("@/components/ward-management/ward-flow-provider", () => ({
  useWardFlowSelect: () => ({
    patients: [
      { id: "p-1", umrn: "UM100001", givenName: "Alex", familyName: "Testperson" },
      { id: "p-2", umrn: "UM100002", givenName: "Sam", familyName: "Sample" },
    ],
  }),
}));
vi.mock("@/components/ward-management/ward-patients", () => ({
  patientDisplayName: (patient: { givenName: string; familyName: string }) =>
    `${patient.familyName}, ${patient.givenName}`,
}));

import { SettingsDraftsCard } from "@/components/ward-management/settings/settings-drafts-card";
import { raiseReferralHref } from "@/components/ward-management/shell/ward-facade";

const input = {
  destinationPhrase: "a ward",
  patientName: "Alex Testperson",
  umrn: "UM100001",
  ageSex: "41, female",
  suburb: "Midland",
  from: "Royal Perth Hospital ED",
  recipients: [],
  urgency: "Tier 2, urgent",
  legalStatus: "Voluntary",
  reason: "Synthetic reason",
  history: "",
  risks: [],
  clearance: "Not answered",
  referrer: { name: "Dr Synthetic", role: "Registrar", phone: "" },
};

describe("referral letter model and paper", () => {
  it("lists every gap once, in order, and keeps answered fields as rows", () => {
    const model = referralLetterModel(input);
    expect(model.toConfirm).toEqual(["Medical clearance", "Refer to", "History", "Referrer contact"]);
    expect(model.key.find((row) => row.label === "Urgency")).toEqual({ label: "Urgency", value: "Tier 2, urgent" });
    expect(model.key.find((row) => row.label === "Risks")?.value).toBe("None selected");
  });

  it("renders one printable letter with the patient, the gaps and the referrer", () => {
    render(<ReferralLetterDocument input={input} stamp="Draft 10:46 AWST" />);
    const letter = screen.getByRole("article", { name: "Referral letter" });
    expect(letter).toHaveAttribute("data-wf-print-letter");
    // Print rules hide <header>, so the letter head must not be one.
    expect(letter.querySelector("header")).toBeNull();
    expect(within(letter).getByText("Alex Testperson")).toBeVisible();
    expect(letter.textContent).toMatch(/Still to confirm/);
    expect(letter.textContent).toMatch(/Referred by/);
    expect(letter.querySelector("style")?.textContent).toMatch(/@page\s*{\s*size: A4 portrait/);
  });
});

describe("Profile drafts list", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearSessionDrafts();
    bus.open.mockReset();
  });
  afterEach(() => {
    clearSessionDrafts();
    vi.useRealTimers();
  });

  function keep(subject: string, value: unknown, at: string) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(at));
    const key = sessionDraftKey("standard/0", "referral", subject);
    expect(writeSessionDraft(key, JSON.stringify(value), draftSessionVersion())).toBe(true);
    vi.useRealTimers();
    return key;
  }

  it("lists kept drafts newest first, by key and save time only", () => {
    keep("p-1", { reason: "typed synthetic words" }, "2026-11-04T01:00:00Z");
    keep("p-2", { reason: "more typed words" }, "2026-11-04T02:00:00Z");
    const drafts = listSessionDrafts();
    expect(drafts.map((draft) => [draft.kind, draft.subject])).toEqual([
      ["referral", "p-2"],
      ["referral", "p-1"],
    ]);
    expect(JSON.stringify(drafts)).not.toMatch(/typed/);
  });

  it("shows name, desk and time, never the typed text, and reopens the draft", () => {
    keep("p-1", { reason: "typed synthetic words" }, new Date(Date.now() - 5 * 60_000).toISOString());
    keep("new", { activePatientKey: "patient:p-2", reason: "typed words" }, new Date().toISOString());
    render(<SettingsDraftsCard />);
    const card = screen.getByTestId("ward-settings-drafts-card");
    expect(within(card).getByText("Sample, Sam")).toBeVisible();
    expect(within(card).getByText("Testperson, Alex")).toBeVisible();
    expect(within(card).getAllByText("Referral · ED registrar")).toHaveLength(2);
    expect(within(card).getByText("5 min ago")).toBeVisible();
    expect(card.textContent).not.toMatch(/typed/);
    fireEvent.click(within(card).getByRole("button", { name: "Open the referral draft for Testperson, Alex" }));
    expect(bus.open).toHaveBeenCalledWith(raiseReferralHref({ patientId: "p-1" }));
  });

  it("says so when nothing is kept", () => {
    render(<SettingsDraftsCard />);
    expect(screen.getByText("No drafts kept")).toBeVisible();
  });
});
