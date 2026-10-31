import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  discardReferralDraft,
  forgetReferrerContact,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

// P148 (27 Oct 2026): the drawer quietly strips invisible characters and outer spaces from the
// referral text it sends. This drives the real drawer and reads the stored referral, so it proves the
// behaviour the user sees rather than matching the source text.

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  discardReferralDraft();
  forgetReferrerContact();
});

const BIDI_OPEN = "\u202a";
const BIDI_OVERRIDE = "\u202e";
const BIDI_CLOSE = "\u202c";

function Probe() {
  const { referrals } = useWardFlow();
  const sent = referrals.find((referral) => referral.intake?.referrer.name.includes("Demo Sender"));
  return (
    <output data-testid="sent-referral">
      {sent
        ? JSON.stringify({
            history: sent.history,
            referrerName: sent.intake?.referrer.name,
            referrerPhone: sent.intake?.referrer.phone,
            clearanceContact: sent.intake?.medicalClearance.contactName,
          })
        : ""}
    </output>
  );
}

function next(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
}
function answer(label: string, value: string) {
  fireEvent.click(within(screen.getByRole("group", { name: label })).getByLabelText(value));
}
function confirmCatchment() {
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
  fireEvent.change(screen.getByLabelText("Catchment team"), { target: { value: "Inner City Clinic" } });
  fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
  fireEvent.change(screen.getByLabelText("Service area"), { target: { value: "East Metro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
}

describe("P148 the drawer cleans referral text before it sends", () => {
  it("strips bidi controls and outer spaces from the story and contacts, and keeps the inner text", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
        <Probe />
      </WardFlowProvider>,
    );
    chooseSampleReferralPerson();
    confirmCatchment();
    next("Next, referral");
    fireEvent.click(screen.getByRole("button", { name: "Emergency" }));
    fireEvent.change(screen.getByLabelText("Referring emergency department"), { target: { value: "RPH" } });
    fireEvent.change(screen.getByLabelText(/Patient story/), {
      target: { value: `  Synthetic story${BIDI_OVERRIDE} kept inner text  ` },
    });
    next("Next, clearance");
    answer("Has the patient been medically cleared?", "No");
    fireEvent.change(screen.getByLabelText("Expected clearance"), { target: { value: "2026-10-07T18:00" } });
    fireEvent.change(screen.getByLabelText("Contact name"), {
      target: { value: ` ${BIDI_OPEN}Demo Doctor${BIDI_CLOSE} ` },
    });
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
    const locations = screen.getByRole("list", { name: "Placement Destination Options" });
    fireEvent.click(within(locations).getByRole("checkbox", { name: /Dabakarn/ }));
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    fireEvent.change(screen.getByLabelText("Your name"), { target: { value: `  Demo Sender${BIDI_OVERRIDE} ` } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
    // A pasted phone number carrying bidi controls is cleaned before the contact check, so it is accepted.
    fireEvent.change(screen.getByLabelText("Phone number"), {
      target: { value: `${BIDI_OPEN}0412345678${BIDI_CLOSE}` },
    });
    fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
    fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Royal Perth ED" } });
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());

    const sent = JSON.parse(screen.getByTestId("sent-referral").textContent ?? "{}") as {
      history: string;
      referrerName: string;
      referrerPhone: string;
      clearanceContact: string;
    };
    expect(sent.referrerName).toBe("Demo Sender");
    expect(sent.referrerPhone).toBe("0412345678");
    expect(sent.clearanceContact).toBe("Demo Doctor");
    expect(sent.history).toContain("Synthetic story kept inner text");
    expect(sent.history).not.toMatch(/[\u202a-\u202e\u2066-\u2069]/);
  }, 90_000);
});
