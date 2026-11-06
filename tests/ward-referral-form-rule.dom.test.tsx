import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

/**
 * Form rule (design audit FORM-REF and LEGAL-REF, Josh's card 2, 5 Nov 2026): New referral blocks
 * only on identity (and the existing-bed check), gender, legal status, medical clearance, age band
 * and urgency. The catchment, home region, location, referring service, reason, clearance time and
 * contact, and the referrer's own contact warn in "Before you send", and Send goes ahead.
 * Synthetic seed only.
 */
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
  resetWardAccessStoreForTests();
  setWardFeatureFlagOnDevice("role-access", null);
});

function Probe() {
  const { referrals, rejections } = useWardFlow();
  const newest = referrals.filter((referral) => referral.intake).at(-1);
  return (
    <>
      <output data-testid="submitted-count">{referrals.filter((referral) => referral.intake).length}</output>
      <output data-testid="newest-intake">{JSON.stringify(newest?.intake ?? null)}</output>
      <output data-testid="referral-errors">{rejections.map((rejection) => rejection.reason).join(";")}</output>
    </>
  );
}

function tab(name: string) {
  fireEvent.click(within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name }));
}
function next(name: string) {
  fireEvent.click(screen.getAllByRole("button", { name }).at(-1)!);
}
/** The location and referring service block (finding 2), so a desk-less view fills them in. */
function fillOrigin() {
  const origin = screen.getByLabelText(/Referring (emergency department|service location)/) as HTMLSelectElement;
  fireEvent.change(origin, { target: { value: origin.options[1]!.value } });
  const team = screen.queryByLabelText("Referring community service");
  if (team) fireEvent.change(team, { target: { value: "Synthetic referring service" } });
}
function answer(label: string, value: string) {
  fireEvent.click(within(screen.getByRole("group", { name: label })).getByLabelText(value));
}

describe("New referral form rule (FORM-REF)", () => {
  it("warns on the catchment and contact details in Before you send, and still sends", async () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
        <Probe />
      </WardFlowProvider>,
    );
    chooseSampleReferralPerson();
    // The catchment is not confirmed: the next step opens anyway.
    next("Next, referral");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Patient story/)).toBeVisible();
    fillOrigin();
    expect(screen.getByTestId("ward-referral-send-warnings")).toHaveTextContent(
      /^Not recorded: catchment.*\. You can still send\.$/,
    );
    next("Next, clearance");
    // Clearance still to come: the expected time and clarification contact warn, never block.
    answer("Has the patient been medically cleared?", "No");
    expect(screen.getByTestId("ward-referral-send-warnings")).toHaveTextContent(
      "expected clearance time, clarification contact, clarification phone",
    );
    next("Next, wards");
    expect(screen.queryByRole("alert")).toBeNull();
    const locations = screen.getByRole("list", { name: "Destinations" });
    fireEvent.click(within(locations).getAllByRole("checkbox")[0]!);
    const baseline = Number(screen.getByTestId("submitted-count").textContent);
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    expect(screen.getByRole("heading", { name: "Confirm and send" })).toBeVisible();
    // A blank contact field says so in amber, and nothing is marked invalid or required.
    for (const label of ["Your name", "Phone number", "Your role", "Location or service"])
      fireEvent.change(screen.getByLabelText(label), { target: { value: "" } });
    expect(screen.getByText("Name not recorded. You can still send.")).toBeVisible();
    expect(screen.getByLabelText("Your name")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Your name")).not.toBeRequired();
    fireEvent.submit(document.getElementById("referralConfirmForm")!);
    await waitFor(() => expect(screen.getByRole("heading", { name: "Referral sent" })).toBeVisible());
    expect(screen.getByTestId("submitted-count")).toHaveTextContent(String(baseline + 1));
    expect(screen.getByTestId("referral-errors")).toBeEmptyDOMElement();
    const intake = JSON.parse(screen.getByTestId("newest-intake").textContent!);
    expect(intake.catchment.confirmed).toBe(false);
    expect(intake.referrer).toMatchObject({ name: "", phone: "", role: "", location: "" });
    expect(intake.medicalClearance).toEqual({ cleared: false });
  }, 60_000);
});

describe("New referral catchment after another patient-step error", () => {
  it("marks only the missing age band, never the warning-only catchment or home region", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} />
        <Probe />
      </WardFlowProvider>,
    );
    chooseSampleReferralPerson("UM100005");
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "" } });
    next("Next, referral");
    // The age band blocks and is marked.
    expect(screen.getByLabelText("Age band")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("link", { name: "Choose the age band" })).toBeInTheDocument();
    // The catchment and home region only warn: nothing in the card says it is required or invalid.
    expect(screen.queryByText("Confirm the catchment before continuing")).toBeNull();
    expect(screen.queryByText("Use the suggested catchment or change it before continuing")).toBeNull();
    const card = screen.getByRole("heading", { name: "Catchment" }).closest("section")!;
    expect(card.querySelector("[data-referral-invalid]")).toBeNull();
    expect(card.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});

describe("New referral legal status (LEGAL-REF)", () => {
  it('blocks until the legal status is answered, with "Not yet recorded" counted as an answer', () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-005" />
        <Probe />
      </WardFlowProvider>,
    );
    // The age band blocks too (card 2); answer it so the legal status is what stops the step.
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "Adult" } });
    tab("Referral");
    fillOrigin();
    const legal = screen.getByLabelText("Legal status");
    // A registered person with no legal status on record opens unanswered, never on a default.
    expect(legal).toHaveValue("");
    next("Next, clearance");
    expect(screen.getByRole("alert")).toHaveTextContent('Choose the legal status, or "Not yet recorded".');
    fireEvent.change(legal, { target: { value: "Not yet recorded" } });
    expect(legal).toHaveValue("Not yet recorded");
    next("Next, clearance");
    expect(screen.queryByText('Choose the legal status, or "Not yet recorded".')).not.toBeInTheDocument();
  });
});

// Josh, 5 Nov 2026 (finding 2): the location of referral and the referring service are filled from
// the sending desk, and block Send only when nothing could fill them. An accepted referral cannot be
// moved without them.
describe("New referral location from the sending desk", () => {
  it("an ED desk's location is filled in, so the referral step goes on with no block", () => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ed", scope: { kind: "ed", edId: "rph-ed" } });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-005" />
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "Adult" } });
    tab("Referral");
    expect(screen.getByLabelText(/Referring emergency department/)).toHaveValue("RPH");
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Not yet recorded" } });
    next("Next, clearance");
    expect(screen.queryByText("Choose the referring emergency department.")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-referral-send-warnings")?.textContent ?? "").not.toMatch(/location of referral/);
  });

  it("blocks with a clear message when no desk can fill the location", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-005" initialCategory="ed" />
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "Adult" } });
    tab("Referral");
    const origin = screen.getByLabelText(/Referring emergency department/);
    fireEvent.change(origin, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Not yet recorded" } });
    next("Next, clearance");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose the referring emergency department.");
    // The blocking field is named in the step's error summary and marked beside the field.
    expect(screen.getByRole("link", { name: "Choose the referring emergency department" })).toHaveAttribute(
      "href",
      `#${origin.id}`,
    );
    expect(origin).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(origin, { target: { value: "SCGH" } });
    next("Next, clearance");
    expect(screen.queryByText("Choose the referring emergency department.")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Choose the referring emergency department" })).toBeNull();
    expect(origin).not.toHaveAttribute("aria-invalid", "true");
  });

  it("names and marks a blank referring community service when no desk can fill it", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer onClose={vi.fn()} initialPatientId="PT-005" initialCategory="ed" />
        <Probe />
      </WardFlowProvider>,
    );
    fireEvent.change(screen.getByLabelText("Age band"), { target: { value: "Adult" } });
    tab("Referral");
    fireEvent.click(within(screen.getByRole("group", { name: "Source" })).getByRole("button", { name: "Community" }));
    const origin = screen.getByLabelText(/Referring service location/) as HTMLSelectElement;
    fireEvent.change(origin, { target: { value: origin.options[1]!.value } });
    fireEvent.change(screen.getByLabelText("Legal status"), { target: { value: "Not yet recorded" } });
    next("Next, clearance");
    const team = screen.getByLabelText(/Referring community service/);
    expect(screen.getByRole("link", { name: "Record the referring community service" })).toHaveAttribute(
      "href",
      `#${team.id}`,
    );
    expect(team).toHaveAttribute("aria-invalid", "true");
    expect(origin).not.toHaveAttribute("aria-invalid", "true");
    fireEvent.change(team, { target: { value: "Synthetic referring service" } });
    expect(screen.queryByRole("link", { name: "Record the referring community service" })).toBeNull();
    expect(team).not.toHaveAttribute("aria-invalid", "true");
  });
});
