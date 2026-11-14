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

import { acceptedReferralsAwaitingPull } from "@/components/ward-management/referrals/accepted-ward-referral";
import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * Review P4-8 (PR C's A9-13 with PR F's pull form): an accepted referral the ambulance brought in,
 * recorded at an ED, starts its journey at that ED, so the pull form pulls its bed as it does for an
 * ED medical referral. Synthetic seed data only.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

function AmbulanceForm() {
  const value = useWardFlow();
  const [item] = useState(() =>
    acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements).find(
      (entry) => entry.referral.source === "ambulance",
    ),
  );
  return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>No ambulance referral to pull</p>;
}

describe("Pull the bed: an accepted ambulance referral pulls (P4-8)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    current = undefined;
  });

  it("starts the journey at the recorded ED with the bed pulled", async () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Capture />
          <AmbulanceForm />
        </WardFlowProvider>
      </ToastProvider>,
    );
    const entry = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements).find(
      (candidate) => candidate.referral.source === "ambulance",
    );
    expect(entry, "the seed has no accepted ambulance referral awaiting a pull").toBeDefined();
    const form = screen.getByTestId(`ward-pull-accepted-${entry!.referral.id}`);
    expect(form).not.toHaveTextContent("This referral has no accepted ward place to pull from");

    // Answer whatever the record left open, as a person pulling would.
    const status = screen.getByTestId("ward-pull-accepted-legal-status");
    const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
    const observation = screen.getByTestId("ward-pull-accepted-observation");
    if (!within(status).queryByRole("radio", { checked: true }))
      fireEvent.click(within(status).getByRole("radio", { name: "Voluntary" }));
    if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
    if (!within(observation).queryByRole("radio", { checked: true }))
      fireEvent.click(within(observation).getByRole("radio", { name: "General" }));
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });

    expect(current!.rejections.map((rejection) => rejection.reason)).toEqual([]);
    const journey = current!.movements.find((movement) => movement.referralId === entry!.referral.id);
    expect(journey?.stage).toBe("pulled");
    expect(journey?.acceptedUnitId).toBe(entry!.unitId);
    const ed = allEmergencyDepartments().find((place) => place.siteCode === entry!.referral.originSiteCode);
    expect(ed, "the referral's ED is a known department").toBeDefined();
    expect(journey?.originEdId).toBe(ed!.id);
  });
});
