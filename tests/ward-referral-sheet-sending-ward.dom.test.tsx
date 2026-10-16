import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { NO_SENDING_WARD } from "@/components/ward-management/referrals/use-ward-referral-drawer-state";
import {
  discardReferralDraft,
  forgetReferrerContact,
  keepReferralDraft,
  readKeptReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
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
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  discardReferralDraft();
  forgetReferrerContact();
});

const seed = seedWardFlowState();
const SENDING = "rph-adult-secure";
const sendingWard = seed.units.find((unit) => unit.id === SENDING)!;
const otherWard = seed.units.find((unit) => unit.id !== SENDING)!;
/** A synthetic patient in a bed on the sending ward, and one on no ward at all. */
const ON_WARD_UMRN = "UM100028";
const OFF_WARD_UMRN = "UM100023";

type KeptWards = { selectedUnitIds: string[] };

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

/** The Wards to refer card's count of chosen wards. */
function selectedCount() {
  return screen.getByText((_, el) => el?.tagName === "SPAN" && /^\d+ selected$/.test(el.textContent ?? "")).textContent;
}

function renderSheet() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
      <Probe />
    </WardFlowProvider>,
  );
}

/** Opens the sheet, chooses the person and confirms their catchment, ready for Next, referral. */
function startReferral(umrn: string) {
  renderSheet();
  chooseSampleReferralPerson(umrn);
  fireEvent.click(screen.getByRole("button", { name: "Change" }));
  fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
  fireEvent.change(screen.getByLabelText("Search catchment"), { target: { value: "Inner City Clinic" } });
  fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
  fireEvent.change(screen.getByLabelText("Service area"), { target: { value: "East Metro" } });
  fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
  const ageBand = screen.queryByLabelText("Age band");
  if (ageBand instanceof HTMLSelectElement && !ageBand.value) fireEvent.change(ageBand, { target: { value: "Adult" } });
}

/** Walks the sheet to the wards step, with no From details chosen: a ward sender has none. */
async function walkToWards() {
  startReferral(ON_WARD_UMRN);
  next("Next, referral");
  fireEvent.change(screen.getByLabelText(/Patient story/), { target: { value: "Synthetic ward to ward story" } });
  const urgent = screen.getAllByRole("radio").find((radio) => radio.getAttribute("name")?.endsWith("-urgency"));
  if (
    urgent &&
    !screen
      .getAllByRole("radio")
      .some((r) => r.getAttribute("name")?.endsWith("-urgency") && (r as HTMLInputElement).checked)
  )
    fireEvent.click(urgent);
  // The sending ward is a secure ward, so a secure bed request would list it if it were offered.
  fireEvent.click(within(screen.getByRole("group", { name: "Bed security" })).getByLabelText("Secure"));
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
  const list = screen.getByRole("list", { name: "Placement Destination Options" });
  // A ward never refers to itself, so the sending ward is not offered.
  expect(within(list).queryByRole("checkbox", { name: new RegExp(SENDING) })).toBeNull();
  fireEvent.click(within(list).getAllByRole("checkbox")[0]!);
  expect(selectedCount()).toBe("1 selected");
}

/** Walks the sheet to Confirm and send. */
async function walkToConfirm() {
  await walkToWards();
  fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
  expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
  fireEvent.change(screen.getByLabelText("Your name"), { target: { value: "Demo Sender" } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "sender@example.com" } });
  fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "0412345678" } });
  fireEvent.change(screen.getByLabelText("Your role"), { target: { value: "Nurse" } });
  fireEvent.change(screen.getByLabelText("Location or service"), { target: { value: "Synthetic ward" } });
}

async function sendAndExpectFromSendingWard() {
  fireEvent.submit(document.getElementById("referralConfirmForm")!);
  await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
  expect(screen.getByTestId("errors")).toBeEmptyDOMElement();
  expect(JSON.parse(screen.getByTestId("sent").textContent!)).toEqual([
    { source: "psychiatric_ward", originUnitId: SENDING },
  ]);
}

/** The From card names why the sheet cannot send, in place of the ED or community choice. */
function expectNoSendingWard() {
  next("Next, referral");
  expect(screen.getByTestId("ward-referral-drawer-no-sending-ward")).toHaveTextContent(NO_SENDING_WARD);
  expect(screen.queryByRole("button", { name: "Emergency" })).not.toBeInTheDocument();
}

describe("the New referral sheet on a ward page", () => {
  it("sends in the ward's own name, with no ED or community choice", async () => {
    route.pathname = `/mockups/ward-flow/ward/${SENDING}`;
    await walkToConfirm();
    await sendAndExpectFromSendingWard();
  }, 60_000);

  it("never counts a kept choice of the sending ward toward the ward limit", async () => {
    route.pathname = `/mockups/ward-flow/ward/${SENDING}`;
    await walkToWards();
    await waitFor(() => expect(readKeptReferralDraft<KeptWards>()?.selectedUnitIds).toHaveLength(1));
    const draft = readKeptReferralDraft<KeptWards>()!;
    cleanup();
    // A draft kept elsewhere, where the sending ward was on offer, reopens on the ward's page.
    keepReferralDraft({ ...draft, selectedUnitIds: [SENDING, ...draft.selectedUnitIds] });
    renderSheet();
    expect(selectedCount()).toBe("1 selected");
  }, 60_000);

  it("asks for a patient on the ward, because a ward refers its own patients", () => {
    route.pathname = `/mockups/ward-flow/ward/${SENDING}`;
    startReferral(OFF_WARD_UMRN);
    next("Next, referral");
    expect(screen.getByRole("alert")).toHaveTextContent(`Choose a patient on ${sendingWard.name}`);
  });

  it("says why it cannot send from a ward page that names no ward", () => {
    route.pathname = "/mockups/ward-flow/ward/not-a-ward";
    startReferral(ON_WARD_UMRN);
    expectNoSendingWard();
  });

  it("never sends from the ward a statistics page is about", () => {
    route.pathname = `/mockups/ward-flow/statistics/ward/${SENDING}`;
    startReferral(ON_WARD_UMRN);
    expectNoSendingWard();
  });

  it("off a ward page, a ward desk with one ward sends from that ward", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [SENDING] } });
    });
    route.pathname = "/mockups/ward-flow/referrals/new";
    await walkToConfirm();
    await sendAndExpectFromSendingWard();
  }, 60_000);

  it("off a ward page, a desk covering two wards is asked to send from the ward's page", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [SENDING, otherWard.id] } });
    });
    route.pathname = "/mockups/ward-flow/referrals/new";
    startReferral(ON_WARD_UMRN);
    expectNoSendingWard();
  });
});
