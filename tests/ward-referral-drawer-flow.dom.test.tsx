import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardReferralInbox } from "@/components/ward-management/referrals/ward-referral-inbox";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

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
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
      <WardReferralInbox unitId="rph-adult-secure" />
      {withBoard && <ReferralBoard />}
      <Probe />
    </WardFlowProvider>,
  );
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
  fireEvent.change(screen.getByLabelText("Search catchment"), { target: { value: "Inner City Clinic" } });
  fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
  fireEvent.change(screen.getByLabelText("Service area"), { target: { value: "East Metro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
}
function answer(label: string, answer: string) {
  fireEvent.click(within(screen.getByRole("group", { name: label })).getByLabelText(answer));
}

describe("approved four-tab referral drawer journey", () => {
  it("requires catchment confirmation and places the story in Referral, documents in Documentation", () => {
    setup();
    // v6 (ReferralDrawer.webp): the footer always offers "Next: Referral"; it checks the patient step when pressed.
    expect(screen.getByRole("button", { name: "Next: Referral" })).toBeInTheDocument();
    tab("Wards");
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm the patient's catchment");
    tab("Patient");
    confirmCatchment();
    next("Next: Referral");
    expect(screen.getByLabelText(/Patient story/)).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Medical clearance" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Mental State Examination/)).not.toBeInTheDocument();
    tab("Clearance");
    expect(screen.getByRole("group", { name: "Has the patient been medically cleared?" })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: /Patient story/ })).not.toBeInTheDocument();
  });

  it("keeps draft text through tabs and clears patient-specific catchment and documentation on switching patient", async () => {
    setup();
    confirmCatchment();
    tab("Referral");
    fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic story retained" } });
    tab("Clearance");
    answer("Has the patient been medically cleared?", "No");
    fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Demo Doctor" } });
    tab("Referral");
    expect(screen.getByLabelText(/Patient story/)).toHaveValue("Synthetic story retained");
    tab("Patient");
    fireEvent.click(screen.getByRole("button", { name: "Switch" }));
    const results = screen.getByRole("listbox");
    fireEvent.click(within(results).getAllByRole("option")[1]);
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
    next("Next: Referral");
    fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
    fireEvent.change(screen.getByLabelText("Referring emergency department"), { target: { value: "RPH" } });
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: "Synthetic patient story for inbox review" },
    });
    next("Next: Clearance");
    answer("Has the patient been medically cleared?", "No");
    fireEvent.change(screen.getByLabelText("Expected clearance"), { target: { value: "2026-10-07T18:00" } });
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
    next("Next: Wards");
    const locations = screen.getByRole("list", { name: "Placement Destination Options" });
    const first = within(locations).getByRole("checkbox", { name: /rph-adult-secure/ });
    fireEvent.click(first);
    expect(screen.getByLabelText("Arrival, AWST")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
    expect(screen.getByTestId("submitted-count")).toHaveTextContent("0");
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Demo Sender" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0412345678" } });
    fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
    fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Royal Perth ED" } });
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
    expect(screen.getByTestId("submitted-count")).toHaveTextContent("1");
    expect(screen.getByTestId("referral-errors")).toBeEmptyDOMElement();
    expect(JSON.stringify(sessionStorage)).not.toContain("sender@example.com");
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    expect(screen.getByTestId("submitted-count")).toHaveTextContent("1");
    const inbox = screen.getByRole("region", { name: "Ward referral inbox" });
    expect(inbox).toHaveTextContent("Synthetic patient story for inbox review");
    fireEvent.click(within(inbox).getByRole("button", { name: "Waitlist" }));
    expect(inbox).toHaveTextContent("Waitlisted");
    const board = screen.getByTestId("ward-referral-board-screen");
    // v6 (Referrals.png): the stream and status filters are hero tracks (radio groups), not buttons.
    fireEvent.click(within(board).getByRole("radio", { name: /^Ward\s*\d/ }));
    fireEvent.click(within(board).getByRole("radio", { name: /^Waitlisted/ }));
    expect(board).toHaveTextContent("Tobias Wren");
    fireEvent.click(within(board).getAllByRole("button", { name: /Tobias Wren/ })[0]);
    fireEvent.click(within(board).getByRole("tab", { name: "Clinical dossier" }));
    expect(board).toHaveTextContent("Synthetic patient story for inbox review");
  }, 90_000);
});
