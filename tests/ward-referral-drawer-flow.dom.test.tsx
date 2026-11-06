import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import {
  discardReferralDraft,
  forgetReferrerContact,
  readLastReferrerContact,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";
import { typeDate } from "./helpers/type-date-time";
import { ConfirmHost } from "@/components/wf";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// The slide-out autosaves its draft to tab memory, and an unmount keeps a pending change, so each
// journey unmounts and then drops the draft to start the next one clean.
afterEach(() => {
  cleanup();
  discardReferralDraft();
});

function Probe() {
  const { referrals, rejections } = useWardFlow();
  return (
    <>
      <output data-testid="submitted-count">{referrals.filter((referral) => referral.intake).length}</output>
      <output data-testid="referral-errors">{rejections.map((rejection) => rejection.reason).join(";")}</output>
    </>
  );
}

function setup(withBoard = false) {
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
      <WardReferralInbox unitId="rph-adult-secure" />
      {withBoard && <ReferralBoard />}
      <Probe />
    </WardFlowProvider>,
  );
  // Opened plainly the sheet starts on nobody (A2-3); these cases walk step 1 for WF-009's person.
  chooseSampleReferralPerson();
  return view;
}
function tab(name: string) {
  fireEvent.click(within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name }));
}
function next(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
}
function confirmCatchment() {
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
  fireEvent.change(screen.getByLabelText("Community team"), { target: { value: "Inner City Clinic" } });
  fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
  fireEvent.change(screen.getByLabelText("Service area"), { target: { value: "East Metro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
}
function answer(label: string, answer: string) {
  fireEvent.click(within(screen.getByRole("group", { name: label })).getByLabelText(answer));
}

describe("approved four-tab referral drawer journey", () => {
  it("warns on an unconfirmed catchment and places the story in Referral, documents in Documentation", () => {
    setup();
    // v6 (ReferralDrawer.webp): the footer always offers "Next, referral"; it checks the patient step when pressed.
    expect(screen.getByRole("button", { name: "Next, referral" })).toBeInTheDocument();
    tab("Wards");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    // FORM-REF (Josh, 5 Nov 2026): the catchment warns in Before you send and never stops Send.
    expect(screen.getByRole("alert")).not.toHaveTextContent("catchment");
    expect(screen.getByTestId("ward-referral-send-warnings")).toHaveTextContent("Not recorded: catchment");
    tab("Patient");
    confirmCatchment();
    next("Next, referral");
    expect(screen.getByLabelText(/Patient story/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Medical clearance" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mental State Examination/)).not.toBeInTheDocument();
    tab("Clearance");
    expect(screen.getByRole("group", { name: "Has the patient been medically cleared?" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Patient story/ })).not.toBeInTheDocument();
  });

  it("keeps draft text through tabs and clears patient-specific catchment and documentation on switching patient", async () => {
    setup();
    render(<ConfirmHost />);
    confirmCatchment();
    tab("Referral");
    fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic story retained" } });
    tab("Clearance");
    answer("Has the patient been medically cleared?", "No");
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Demo Doctor" } });
    tab("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("Synthetic story retained");
    tab("Patient");
    fireEvent.click(screen.getByRole("button", { name: "Change patient" }));
    const results = screen.getByRole("listbox");
    fireEvent.click(within(results).getAllByRole("option")[1]);
    const confirmation = await screen.findByRole("alertdialog", { name: "Change patient?" });
    fireEvent.click(within(confirmation).getByRole("button", { name: "Discard and change patient" }));
    await waitFor(() => expect(confirmation).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Confirm catchment" })).toBeInTheDocument();
    tab("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("");
    tab("Clearance");
    expect(
      within(screen.getByRole("group", { name: "Has the patient been medically cleared?" })).getByLabelText("No"),
    ).not.toBeChecked();
  });

  it("uploads actual charts, opens contact confirmation without dispatching, then sends once to selected inboxes", async () => {
    setup(true);
    confirmCatchment();
    next("Next, referral");
    fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
    fireEvent.change(screen.getByLabelText("Referring emergency department"), { target: { value: "RPH" } });
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: "Synthetic patient story for inbox review" },
    });
    next("Next, clearance");
    answer("Has the patient been medically cleared?", "No");
    typeDate(screen.getByLabelText("Expected clearance"), "2026-10-07T18:00");
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Demo Doctor" } });
    fireEvent.change(screen.getByLabelText("Contact phone"), { target: { value: "0412345678" } });
    answer("Triage and RAMP completed", "Yes");
    answer("Anything else to attach?", "No");
    for (const label of ["Medication chart", "Observation chart"]) {
      fireEvent.change(screen.getByLabelText(label, { selector: 'input[type="file"]' }), {
        target: { files: [new File(["%PDF-1.7\nSynthetic demo chart"], `${label}.pdf`, { type: "application/pdf" })] },
      });
    }
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Replace" })).toHaveLength(2), {
      timeout: 10_000,
    });
    next("Next, wards");
    const locations = screen.getByRole("list", { name: "Destinations" });
    const first = within(locations).getByRole("checkbox", { name: /Dabakarn/ });
    fireEvent.click(first);
    expect(screen.getByLabelText("Arrival, AWST")).toBeVisible();
    // The seeded referrals already carry authored intakes, so count from that baseline.
    const baseline = Number(screen.getByTestId("submitted-count").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
    expect(screen.getByTestId("submitted-count")).toHaveTextContent(String(baseline));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Demo Sender" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0412345678" } });
    fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
    fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Royal Perth ED" } });
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
    expect(screen.getByTestId("submitted-count")).toHaveTextContent(String(baseline + 1));
    expect(screen.getByTestId("referral-errors")).toBeEmptyDOMElement();
    // A2-6: the details sent are kept in tab memory for the next referral, never browser storage.
    expect(readLastReferrerContact()).toMatchObject({ name: "Demo Sender", role: "Nurse" });
    forgetReferrerContact();
    expect(JSON.stringify(sessionStorage)).not.toContain("sender@example.com");
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    expect(screen.getByTestId("submitted-count")).toHaveTextContent(String(baseline + 1));
    const inbox = screen.getByRole("region", { name: "Ward referral inbox" });
    expect(inbox).toHaveTextContent("Synthetic patient story for inbox review");
    fireEvent.click(within(inbox).getByRole("button", { name: "Waiting list" }));
    expect(inbox).toHaveTextContent("On waiting list");
    const board = screen.getByTestId("ward-referral-board-screen");
    // Option A (9 Oct 2026): filters highlight and never hide, so the waitlisted referral is on the queue as it stands.
    // Phone review F-06 (Oct 2026): queue rows read family name first, as the census does.
    expect(board).toHaveTextContent("Wren, Tobias");
    fireEvent.click(within(board).getAllByRole("button", { name: /Wren, Tobias/ })[0]);
    fireEvent.click(within(board).getByRole("tab", { name: "Patient" }));
    expect(board).toHaveTextContent("Synthetic patient story for inbox review");
  }, 90_000);
});

describe("errors mark and move to the field at fault (DA-12)", () => {
  // FORM-REF (Josh, 5 Nov 2026): these cases use the legal status, which blocks (LEGAL-REF). PT-005 is a registered person with no legal status here.
  const legal = () => screen.getByLabelText("Legal status");
  const legalError = 'Choose the legal status, or "Not yet recorded"';
  function setupUnanswered() {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-005" />
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "Adult" } });
    // Gender (WS-01) and urgency block too; answer them so the legal status is the one thing left.
    fireEvent.change(screen.getByTestId("ward-referral-gender"), { target: { value: "not_recorded" } });
    fireEvent.click(document.querySelector<HTMLInputElement>('input[type="radio"][name$="-urgency"][value="2"]')!);
  }

  it("marks a missing field, names its error and moves focus to it", async () => {
    setupUnanswered();
    next("Next, referral");
    expect(legal()).not.toHaveAttribute("aria-invalid");
    // The location and referring service block too when no desk fills them, and are listed in the
    // summary; give them so the legal status is the one thing to fix.
    fireEvent.change(screen.getByLabelText(/Referring (emergency department|service location)/), {
      target: { value: "RPH" },
    });
    const team = screen.queryByLabelText(/Referring community service/);
    if (team) fireEvent.change(team, { target: { value: "Synthetic referring service" } });
    next("Next, clearance");

    expect(legal()).toHaveAttribute("aria-invalid", "true");
    expect(legal()).toHaveAccessibleDescription(legalError);
    // Error summary (Josh approved 24 Oct 2026): focus lands on the step's summary; its link reaches the field.
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "1 thing to fix before the next step" })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("link", { name: legalError }));
    expect(legal()).toHaveFocus();

    fireEvent.change(legal(), { target: { value: "Voluntary" } });
    expect(legal()).not.toHaveAttribute("aria-invalid");
  });

  it("opens the step at fault when Send finds a problem on an earlier step", async () => {
    setupUnanswered();
    // Josh, 5 Nov 2026 (finding 2): the location and service block when no desk fills them; give them.
    tab("Referral");
    fireEvent.change(screen.getByLabelText(/Referring (emergency department|service location)/), {
      target: { value: "RPH" },
    });
    const team = screen.queryByLabelText("Referring community service");
    if (team) fireEvent.change(team, { target: { value: "Synthetic referring service" } });
    tab("Wards");
    expect(legal()).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));

    expect(screen.getByRole("alert")).toHaveTextContent(legalError);
    expect(legal()).toBeVisible();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "1 thing to fix before the next step" })).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("link", { name: legalError }));
    expect(legal()).toHaveFocus();
  });
});

describe("an ED referral's expected arrival time (PR #1474 review)", () => {
  const arrival = () => screen.getByLabelText("Expected arrival, AWST");
  const nextFromReferral = () => fireEvent.click(screen.getAllByRole("button", { name: /^Next, /u }).at(-1)!);

  it("holds the referral while a typed arrival is not a real 24-hour time, and lets an empty one through", () => {
    setup();
    fireEvent.click(within(screen.getByRole("group", { name: "Refer to" })).getByRole("button", { name: "ED" }));
    confirmCatchment();
    tab("Referral");
    fireEvent.change(arrival(), { target: { value: "11:45pm" } });
    nextFromReferral();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Type a 24-hour time, HH:MM, for the expected arrival, or clear it.",
    );
    expect(arrival()).toBeVisible();
    expect(arrival()).toHaveAttribute("aria-invalid", "true");
    expect(arrival()).toHaveAccessibleDescription(/Type a 24-hour time, HH:MM/u);

    // Cleared, the time is optional again and the step moves on.
    fireEvent.change(arrival(), { target: { value: "" } });
    nextFromReferral();
    expect(arrival()).not.toBeVisible();
    expect(screen.queryByText(/for the expected arrival, or clear it/u)).not.toBeInTheDocument();
  });
});
