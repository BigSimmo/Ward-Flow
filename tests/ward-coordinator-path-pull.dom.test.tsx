import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { boundedBedAvailability } from "@/components/ward-management/ward-ready-beds";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * WS-02 and WS-03 (workflow speed audit, 26 Oct 2026): after a ward accepts, the coordinator pulls
 * the bed in one step from the details already recorded. Synthetic seed data only.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function PullFirst() {
  const value = useWardFlow();
  // Held from the first render, as Home and the Referrals board hold the row they opened: the
  // referral leaves the awaiting list as soon as its journey starts, before the bed is pulled.
  const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
  return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>Nothing to pull</p>;
}

function renderWithAcceptedReferral() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        <PullFirst />
      </WardFlowProvider>
    </ToastProvider>,
  );
  // The seed holds a community referral a ward has accepted with no bed pulled (D-76).
  const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
  expect(first).toBeDefined();
  const unit = current!.units.find((candidate) => candidate.id === first!.unitId)!;
  expect(boundedBedAvailability(unit).available).toBeGreaterThan(0);
  return { referral: first!.referral, unitId: first!.unitId, unitName: first!.unitName };
}

describe("Pull the bed in one step", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("asks only what is not recorded, then one tap starts the journey and pulls the bed at the ward that accepted", async () => {
    const { referral, unitId, unitName } = renderWithAcceptedReferral();
    const form = screen.getByTestId(`ward-pull-accepted-${referral.id}`);
    expect(form).toBeInTheDocument();
    // The person the bed is for, surname first (D-83), as the form names them.
    const name = (form.getAttribute("aria-label") ?? "").replace(/^Pull the bed for /u, "");
    expect(name).toMatch(/^[^,]+, \S/u);
    const status = screen.getByTestId("ward-pull-accepted-legal-status") as HTMLSelectElement;
    const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
    const observation = screen.getByTestId("ward-pull-accepted-observation") as HTMLSelectElement;
    // Answer whatever the records left open. Recorded answers are kept as they are.
    if (status.value === "") fireEvent.change(status, { target: { value: "Voluntary" } });
    if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
    if (observation.value === "") fireEvent.change(observation, { target: { value: "general" } });
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    // WT-08: one tap starts the journey and keeps the bed. There is no second Confirm pull step.
    const journey = current!.movements.find((movement) => movement.referralId === referral.id);
    expect(screen.getByTestId("ward-pull-accepted-status")).toBeEmptyDOMElement();
    expect(current!.rejections.map((rejection) => rejection.reason)).toEqual([]);
    expect(journey).toBeDefined();
    expect(journey!.acceptedUnitId).toBe(unitId);
    expect(journey!.stage).toBe("pulled");
    // Pop-ups build (toast, round 2): the save confirmation names who the bed was pulled for.
    expect(await screen.findByText(`Bed pulled at ${unitName} for ${name}`)).toBeInTheDocument();
    expect(acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements)).not.toContainEqual(
      expect.objectContaining({ referral: expect.objectContaining({ id: referral.id }) }),
    );
  });

  it("does nothing until every answer is given, and says what is missing", async () => {
    const { referral } = renderWithAcceptedReferral();
    fireEvent.change(screen.getByTestId("ward-pull-accepted-legal-status"), { target: { value: "Voluntary" } });
    fireEvent.change(screen.getByTestId("ward-pull-accepted-legal-form"), { target: { value: "none" } });
    fireEvent.change(screen.getByTestId("ward-pull-accepted-observation"), { target: { value: "" } });
    expect(screen.getByTestId("ward-pull-accepted-confirm")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("Choose an observation level", { selector: "[id$='-why']" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    expect(current!.movements.some((movement) => movement.referralId === referral.id)).toBe(false);
  });
});

describe("Pull the bed: form and status that do not fit (finding 78)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("warns when the form does not fit the legal status, and never blocks the pull", () => {
    renderWithAcceptedReferral();
    const status = screen.getByTestId("ward-pull-accepted-legal-status");
    const legalForm = screen.getByTestId("ward-pull-accepted-legal-form");
    fireEvent.change(screen.getByTestId("ward-pull-accepted-observation"), { target: { value: "general" } });
    fireEvent.change(status, { target: { value: "Voluntary" } });
    fireEvent.change(legalForm, { target: { value: "1A" } });
    expect(screen.getByTestId("ward-pull-accepted-form-mismatch")).toHaveTextContent(
      "Check the legal form: Form 1A is chosen, but the legal status is Voluntary. You can still pull the bed.",
    );
    expect(screen.getByTestId("ward-pull-accepted-confirm")).not.toHaveAttribute("aria-disabled", "true");
    fireEvent.change(status, { target: { value: "Involuntary inpatient" } });
    fireEvent.change(legalForm, { target: { value: "none" } });
    expect(screen.getByTestId("ward-pull-accepted-form-mismatch")).toHaveTextContent(
      "no form is chosen, but the legal status is Involuntary inpatient.",
    );
    fireEvent.change(legalForm, { target: { value: "6A" } });
    expect(screen.queryByTestId("ward-pull-accepted-form-mismatch")).toBeNull();
  });
});

describe("Home: Act now and Referrals to decide (WS-02, WS-04)", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("puts an accepted referral with no bed pulled in Act now, with Pull the bed opening the one-step sheet", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <CoordinatorScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
    const rows = screen.getByTestId("home-accepted-to-pull");
    const row = rows.querySelector(`[data-referral-id="${first!.referral.id}"]`) as HTMLElement;
    expect(row).toHaveTextContent("Accepted, bed not pulled");
    expect(row).toHaveTextContent(`${first!.unitName} accepted`);
    // The row's title and its Pull the bed button both open the sheet.
    const pull = within(row)
      .getAllByRole("button", { name: /^Pull the bed for / })
      .at(-1)!;
    expect(pull).toHaveTextContent("Pull the bed");
    expect(pull).toHaveAttribute("data-placement-action");
    fireEvent.click(pull);
    const sheet = await screen.findByTestId(`ward-pull-accepted-${first!.referral.id}`);
    expect(sheet).toBeInTheDocument();
    // Audit 1 Nov 2026: Pull the bed is a placement decision, so it keeps the 48px phone and touch
    // size the kit gives `data-placement-action`.
    expect(within(sheet).getByTestId("ward-pull-accepted-confirm")).toHaveAttribute("data-placement-action");
  });

  it("makes Decide a link to the referral on the Referrals board, where Accept and Decline are", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <CoordinatorScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const decide = screen.getAllByRole("link", { name: /^Decide referral for / });
    expect(decide.length).toBeGreaterThan(0);
    for (const link of decide) expect(link.getAttribute("href")).toMatch(/^\/ward-flow\/referrals\?referral=/);
  });
});
