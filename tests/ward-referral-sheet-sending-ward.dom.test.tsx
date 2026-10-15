import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { NO_SENDING_WARD } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  discardReferralDraft,
  forgetReferrerContact,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

/**
 * Josh, 15 Oct 2026: the New referral sheet on a ward page sends in that ward's own name, as the
 * ward's Raise referral does, so no ward desk borrows the ED or community role to refer.
 */

const route = vi.hoisted(() => ({ pathname: "/mockups/ward-flow" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
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

const DESTINATION = "rph-adult-secure";
const sendingWard = seedWardFlowState().units.find((unit) => unit.id !== DESTINATION)!;

function Probe() {
  const { referrals, rejections } = useWardFlow();
  const sent = referrals.filter((referral) => referral.intake);
  return (
    <>
      <output data-testid="sent">
        {JSON.stringify(sent.map(({ source, originUnitId }) => ({ source, originUnitId })))}
      </output>
      <output data-testid="errors">{rejections.map((rejection) => rejection.reason).join(";")}</output>
    </>
  );
}

function answer(label: string, choice: string) {
  fireEvent.click(within(screen.getByRole("group", { name: label })).getByLabelText(choice));
}
function next(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
}

/** Walks the sheet to Confirm and send, with no From details chosen: a ward page has none. */
async function walkToConfirm() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
      <Probe />
    </WardFlowProvider>,
  );
  chooseSampleReferralPerson();
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
  fireEvent.change(screen.getByLabelText("Search catchment"), { target: { value: "Inner City Clinic" } });
  fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
  fireEvent.change(screen.getByLabelText("Service area"), { target: { value: "East Metro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
  next("Next, referral");
  fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic ward to ward story" } });
  next("Next, clearance");
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
  next("Next, wards");
  const locations = screen.getByRole("list", { name: "Placement Destination Options" });
  fireEvent.click(within(locations).getByRole("checkbox", { name: new RegExp(DESTINATION) }));
  fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
  expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Demo Sender" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0412345678" } });
  fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
  fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Synthetic ward" } });
}

describe("the New referral sheet on a ward page", () => {
  it("sends in the ward's own name, with no ED or community choice", async () => {
    route.pathname = `/mockups/ward-flow/ward/${sendingWard.id}`;
    await walkToConfirm();
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
    expect(screen.getByTestId("errors")).toBeEmptyDOMElement();
    expect(JSON.parse(screen.getByTestId("sent").textContent!)).toEqual([
      { source: "psychiatric_ward", originUnitId: sendingWard.id },
    ]);
  }, 60_000);

  it("says why it cannot send from a ward page that names no ward", async () => {
    route.pathname = "/mockups/ward-flow/ward/not-a-ward";
    await walkToConfirm();
    const send = screen.getByRole("button", { name: "Confirm and send" });
    expect(send).toHaveAttribute("aria-disabled", "true");
    expect(send).toHaveAccessibleDescription(NO_SENDING_WARD);
    fireEvent.click(send);
    expect(screen.getByTestId("sent")).toHaveTextContent("[]");
  }, 60_000);
});
