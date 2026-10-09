import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  REFERRAL_DRAFT_AUTOSAVE_MS,
  discardReferralDraft,
  readKeptReferralDraft,
  referralDraftAgeText,
} from "@/components/ward-management/referrals/referral-draft-store";
import { UseMyDetailsButton } from "@/components/ward-management/referrals/referral-flow-panels";
import { SETTINGS_DEMO_PROFILE, profileForChromeRole } from "@/components/ward-management/settings/settings-profile";
import { referralIsbarText, referralLetterText } from "@/components/ward-management/referrals/referral-letter";
import { referralIntakeError } from "@/components/ward-management/referrals/referral-submission";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Option B of the referral slide-out (Josh, 8 Oct 2026): Refer to first, steps named by the
 * destination, a Ready to send rail, a close guard with a kept draft, a letter preview, Refer
 * links that arrive prefilled, and new patients registered inside the sheet. The full-page form
 * these replace was retired in the same change.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Unmount first: an unmount with a pending change keeps it (autosave), so discarding before
// Testing Library's own cleanup would let one test's draft reach the next.
afterEach(() => {
  cleanup();
  discardReferralDraft();
});

function renderDrawer(props: Partial<Parameters<typeof WardReferralDrawer>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={onClose} {...props} />
    </WardFlowProvider>,
  );
  return { onClose, ...view };
}

const referTo = () => within(screen.getByRole("group", { name: "Refer to" }));
const steps = () => within(screen.getByRole("group", { name: "Referral sections" }));

describe("referral slide-out, option B", () => {
  it("asks where the referral goes first and names the steps from it", () => {
    renderDrawer();
    expect(referTo().getByRole("button", { name: "Ward" })).toHaveAttribute("aria-pressed", "true");
    expect(steps().getByRole("button", { name: "Clearance" })).toBeInTheDocument();
    expect(steps().getByRole("button", { name: "Wards" })).toBeInTheDocument();

    fireEvent.click(referTo().getByRole("button", { name: "Community" }));
    expect(steps().getByRole("button", { name: "Documents" })).toBeInTheDocument();
    expect(steps().getByRole("button", { name: "Teams" })).toBeInTheDocument();

    fireEvent.click(referTo().getByRole("button", { name: "ED" }));
    expect(steps().getByRole("button", { name: "EDs" })).toBeInTheDocument();
    expect(referTo().queryByRole("button", { name: /police/i })).not.toBeInTheDocument();
  });

  it("opens on the destination a link asks for", () => {
    renderDrawer({ initialDestination: "community" });
    expect(referTo().getByRole("button", { name: "Community" })).toHaveAttribute("aria-pressed", "true");
  });

  it("offers no police escort as transport", () => {
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Wards" }));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    const transport = screen.getByLabelText("Transport");
    expect(within(transport).queryByRole("option", { name: /police/i })).not.toBeInTheDocument();
  });

  it("shows a Ready to send summary beside the form", () => {
    renderDrawer();
    const rail = screen.getByTestId("ward-referral-summary-rail");
    expect(within(rail).getByRole("heading", { name: "Ready to send" })).toBeInTheDocument();
    expect(within(rail).getByText("Refer to")).toBeInTheDocument();
    expect(within(rail).getByText(/of 9 ready/)).toBeInTheDocument();
  });

  it("closes straight away when nothing was entered", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("ward-referral-close-guard")).not.toBeInTheDocument();
  });

  it("asks before closing a draft, and Keep editing stays open", () => {
    const { onClose } = renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    const guard = screen.getByRole("alertdialog", { name: "Close without sending?" });
    fireEvent.click(within(guard).getByRole("button", { name: "Keep editing" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Synthetic reason");
  });

  it("keeps a draft in memory only and reopens it", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const first = renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Kept synthetic reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    first.unmount();

    renderDrawer();
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Kept synthetic reason");
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeInTheDocument();
    setItem.mockRestore();
  });

  it("opens on the destination and site a link asks for, even over a kept draft", () => {
    const first = renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Kept reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep draft" }));
    first.unmount();

    renderDrawer({ initialDestination: "ed", initialCategory: "ed", initialOriginSiteCode: "RPH" });
    expect(referTo().getByRole("button", { name: "ED" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Kept reason");
    expect(screen.getByLabelText("Referring emergency department")).toHaveValue("RPH");
  });

  it("asks before Open board leaves a draft with answers", () => {
    const { onClose } = renderDrawer({ initialPatientId: "PT-003" });
    const note = screen.getByTestId("ward-referral-already-open");
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Typed reason" } });
    fireEvent.click(steps().getByRole("button", { name: "Patient" }));
    fireEvent.click(within(note).getByRole("link", { name: "Open board" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog", { name: "Close without sending?" })).toBeInTheDocument();
  });

  it("Discard drops the draft", () => {
    const first = renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Dropped reason" } });
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(first.onClose).toHaveBeenCalledTimes(1);
    first.unmount();
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("");
  });

  it("previews the letter and copies it as text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Preview letter" }));
    const preview = screen.getByTestId("ward-referral-letter-preview");
    expect(preview).toHaveTextContent("Mental health referral to a ward");
    fireEvent.click(within(preview).getByRole("button", { name: "Copy as text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain("Mental health referral to a ward");
    expect(await screen.findByRole("status")).toHaveTextContent("Letter copied");
  });

  it("arrives with the person a Refer link names, even without an open movement", () => {
    renderDrawer({ initialPatientId: "PT-002" });
    expect(document.body.textContent).toMatch(/Hallowin/);
    // No movement holds this person's age band, so the sheet asks for it.
    expect(screen.getByLabelText("Age band")).toBeInTheDocument();
  });

  it("ignores a Refer link naming nobody in the record", () => {
    renderDrawer({ initialPatientId: "PT-999", initialCategory: "ed" });
    expect(screen.queryByLabelText("Age band")).not.toBeInTheDocument();
  });

  it("prefills the referring site from the link", () => {
    renderDrawer({ initialCategory: "ed", initialOriginSiteCode: "RPH" });
    expect(screen.getByTestId("ward-referral-from")).toHaveTextContent("From");
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    expect(screen.getByLabelText("Referring emergency department")).toHaveValue("RPH");
  });

  it("registers a new patient inside the sheet and selects them", async () => {
    renderDrawer();
    fireEvent.click(screen.getByRole("button", { name: "New patient" }));
    const form = screen.getByTestId("ward-referral-new-patient");
    fireEvent.click(within(form).getByRole("button", { name: "Add patient" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Enter the family and given names.");
    fireEvent.change(within(form).getByLabelText("Family name"), { target: { value: "Synthetica" } });
    fireEvent.change(within(form).getByLabelText("Given name"), { target: { value: "Demo" } });
    fireEvent.change(within(form).getByLabelText("Date of birth"), { target: { value: "1990-01-02" } });
    fireEvent.change(within(form).getByLabelText("UMRN"), { target: { value: "UM999901" } });
    await act(async () => {
      fireEvent.click(within(form).getByRole("button", { name: "Add patient" }));
    });
    await waitFor(() => expect(document.body.textContent).toMatch(/Synthetica, Demo/));
    expect(screen.getByLabelText("Age band")).toBeInTheDocument();
  });
});

describe("needs cards and the clearance checklist", () => {
  it("lists six clearance items for a ward referral and counts those done", () => {
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Clearance" }));
    const checklist = screen.getByTestId("ward-referral-clearance-checklist");
    expect(within(checklist).getAllByRole("group")).toHaveLength(6);
    expect(checklist).toHaveTextContent("0 of 6 done");
    fireEvent.click(within(within(checklist).getByRole("group", { name: "ECG" })).getByLabelText("Done"));
    fireEvent.click(within(within(checklist).getByRole("group", { name: "Bloods" })).getByLabelText("To follow"));
    expect(checklist).toHaveTextContent("1 of 6 done");
    fireEvent.click(screen.getByRole("button", { name: "Preview letter" }));
    expect(screen.getByTestId("ward-referral-letter-preview")).toHaveTextContent(
      "Clearance checklist: Bloods to follow, ECG done",
    );
  });

  it("asks a community team's follow-up needs and puts them in the letter", () => {
    renderDrawer({ initialDestination: "community" });
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    const needs = screen.getByTestId("ward-referral-needs");
    expect(needs).toHaveTextContent("Follow-up needs");
    fireEvent.click(
      within(within(needs).getByRole("group", { name: "First contact within" })).getByLabelText("72 hours"),
    );
    fireEvent.click(within(within(needs).getByRole("group", { name: "Interpreter" })).getByLabelText("Yes"));
    expect(screen.queryByTestId("ward-referral-clearance-checklist")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Preview letter" }));
    expect(screen.getByTestId("ward-referral-letter-preview")).toHaveTextContent(
      "Needs: First contact within 72 hours, Interpreter needed",
    );
  });

  it("asks how the person reaches an ED", () => {
    renderDrawer({ initialDestination: "ed" });
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    const needs = screen.getByTestId("ward-referral-needs");
    expect(needs).toHaveTextContent("ED needs");
    expect(within(needs).getByRole("group", { name: "Coming by" })).toBeInTheDocument();
    expect(within(needs).getByLabelText("Expected arrival, AWST")).toBeInTheDocument();
  });

  it("accepts a known checklist and needs, and refuses ones the record does not know", () => {
    const base = {
      catchment: { teamName: "Synthetic team", confirmed: true as const },
      reasonForReferral: "",
      legalStatus: "Voluntary",
      riskFlags: [],
      medicalClearance: { cleared: true },
      triageAndRampCompleted: true,
      charts: (["medication", "observation"] as const).map((kind) => ({
        kind,
        name: `${kind}.pdf`,
        mimeType: "application/pdf" as const,
        sizeBytes: 3,
        base64: "AAAA",
      })),
      additionalDocuments: false,
      referrer: { name: "A", email: "a@example.invalid", phone: "08 9000 0000", role: "RN", location: "ED" },
    };
    expect(referralIntakeError({ ...base, clearanceChecklist: { ecg: "maybe" as never } })).toBe(
      "Check the medical clearance checklist.",
    );
    expect(referralIntakeError({ ...base, needs: { kind: "ed", expectedArrival: "25:00" } })).toBe(
      "Check the ED needs.",
    );
  });
});

describe("owner pins carried over from the retired full-page form", () => {
  it("names Send referral in words", () => {
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Wards" }));
    expect(screen.getByRole("button", { name: "Send referral" })).toBeInTheDocument();
  });

  it("says a blank suburb goes as Suburb not known, so no fixed address can still be referred", () => {
    renderDrawer({ initialPatientId: "PT-002" });
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "" } });
    expect(screen.getByTestId("ward-referral-suburb-note")).toHaveTextContent("Suburb not known");
    fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
    expect(screen.getByTestId("ward-referral-suburb-note")).toHaveTextContent("Perth");
  });

  it("never writes typed history to browser storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic typed history" } });
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("caps the wards chosen and says choose up to the cap", () => {
    renderDrawer();
    fireEvent.click(steps().getByRole("button", { name: "Wards" }));
    const list = screen.getByRole("list", { name: "Placement Destination Options" });
    const boxes = within(list).getAllByRole("checkbox");
    const cap = Number(/\d+/.exec(screen.getByText(/^Up to \d+$/).textContent ?? "")![0]);
    boxes.slice(0, cap + 1).forEach((box) => fireEvent.click(box));
    expect(screen.getByRole("alert")).toHaveTextContent(`Choose up to ${cap} referral locations.`);
    expect(boxes.filter((box) => (box as HTMLInputElement).checked)).toHaveLength(cap);
  });
});

describe("referral letter text", () => {
  const input = {
    destinationPhrase: "a ward",
    patientName: "Synthetic, Person",
    umrn: "UM000001",
    ageSex: "41F",
    suburb: "Armadale",
    from: "Royal Perth Hospital ED",
    recipients: ["Royal Perth Hospital · Ward 1"],
    urgency: "Tier 2 · urgent",
    legalStatus: "Voluntary",
    reason: "",
    history: "",
    risks: [],
    clearance: "Pending",
    referrer: { name: "", role: "", phone: "" },
  };

  it("says Not recorded for anything left blank rather than inventing it", () => {
    const text = referralLetterText(input, "10:46");
    expect(text).toContain("Reason: Not recorded");
    expect(text).toContain("Referrer: Not recorded");
    expect(text).toContain("Risks: None selected");
  });

  it("builds an ISBAR note with the referral number and due time", () => {
    const text = referralIsbarText(input, { referralId: "RF-024", sentAt: "10:47", decisionDue: "14:47" });
    expect(text.split("\n").map((line) => line.slice(0, 2))).toEqual(["I:", "S:", "B:", "A:", "R:"]);
    expect(text).toContain("RF-024 sent 10:47");
    expect(text).toContain("Decision due 14:47.");
  });
});

describe("referral draft autosave (9 Oct 2026)", () => {
  afterEach(() => vi.useRealTimers());

  function typeReason(value: string) {
    fireEvent.click(steps().getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value } });
  }

  it("keeps the draft in tab memory as the user types, never in browser storage", () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderDrawer();
    typeReason("Autosaved synthetic reason");
    expect(readKeptReferralDraft()).toBeNull();
    expect(screen.queryByTestId("ward-referral-draft-status")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS);
    });
    expect(readKeptReferralDraft()).not.toBeNull();
    expect(screen.getByTestId("ward-referral-draft-status")).toHaveTextContent("Draft kept · just now");
    expect(screen.getByRole("button", { name: "Discard draft" })).toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("loses nothing when the sheet goes away before the pause ends", () => {
    vi.useFakeTimers();
    const first = renderDrawer();
    typeReason("Unpaused synthetic reason");
    first.unmount();
    vi.useRealTimers();
    renderDrawer();
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Unpaused synthetic reason");
  });

  it("Discard draft in the rail drops an autosaved draft", () => {
    vi.useFakeTimers();
    const first = renderDrawer();
    typeReason("Discarded synthetic reason");
    act(() => {
      vi.advanceTimersByTime(REFERRAL_DRAFT_AUTOSAVE_MS);
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    first.unmount();
    expect(readKeptReferralDraft()).toBeNull();
  });

  it("says the draft's age in units", () => {
    expect(referralDraftAgeText(0, 20_000)).toBe("just now");
    expect(referralDraftAgeText(0, 4 * 60_000)).toBe("4m ago");
    expect(referralDraftAgeText(0, 65 * 60_000)).toBe("1h 05m ago");
  });
});

describe("Use my details", () => {
  it("fills name, role and contact from the coordinator profile", () => {
    const onFill = vi.fn();
    render(<UseMyDetailsButton lookup={profileForChromeRole("coordinator")} onFill={onFill} />);
    fireEvent.click(screen.getByRole("button", { name: /Use my details/ }));
    const { name, role, phone, email, location } = SETTINGS_DEMO_PROFILE;
    expect(onFill).toHaveBeenCalledWith({ name, role, phone, email, location });
  });

  it("shows unavailable with its reason when the role has no profile", () => {
    const onFill = vi.fn();
    const lookup = profileForChromeRole("ward");
    expect(lookup).toEqual({ status: "unavailable", reason: expect.stringMatching(/^No profile set for /) });
    render(<UseMyDetailsButton lookup={lookup} onFill={onFill} />);
    const button = screen.getByTestId("ward-referral-use-my-details");
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    expect(onFill).not.toHaveBeenCalled();
    if (lookup.status === "unavailable") expect(document.body).toHaveTextContent(lookup.reason);
  });
});

describe("28 day readmission flag in the slide-out", () => {
  it("flags a person discharged in the last 28 days, with the date and ward on expand", () => {
    renderDrawer({ initialPatientId: "PT-010" });
    const flag = screen.getByTestId("ward-referral-readmission");
    const toggle = within(flag).getByRole("button", { name: /28d readmission/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(flag).toHaveTextContent(/Discharged \d{1,2} \w{3} from /);
  });

  it("shows no flag for a person with no recent discharge", () => {
    renderDrawer({ initialPatientId: "PT-003" });
    expect(screen.queryByTestId("ward-referral-readmission")).not.toBeInTheDocument();
  });
});
