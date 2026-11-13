import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PullAcceptedReferral } from "@/components/ward-management/referrals/pull-accepted-referral";
import {
  acceptedReferralsAwaitingPull,
  PULL_DESK_REFUSAL,
} from "@/components/ward-management/referrals/accepted-ward-referral";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

/**
 * D-191 build answers (Josh, 13 Nov 2026, settling D-188): both the ward-desk clinician and the
 * ward coordinator may pull a bed, and the record names which one did, by desk role (there are no
 * personal sign-ins). Synthetic seed data only.
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
  const [[item]] = useState(() => acceptedReferralsAwaitingPull(value.referrals, value.units, value.movements));
  return item ? <PullAcceptedReferral item={item} onDone={() => {}} /> : <p>Nothing to pull</p>;
}

function renderAs(access: (unitId: string, otherUnitId: string) => WardAccess | undefined) {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        <PullFirst />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const [first] = acceptedReferralsAwaitingPull(current!.referrals, current!.units, current!.movements);
  expect(first).toBeDefined();
  const other = current!.units.find((unit) => unit.id !== first!.unitId)!;
  const desk = access(first!.unitId, other.id);
  if (desk) {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(desk);
    });
  }
  return first!;
}

function answerOpenQuestions() {
  const status = screen.getByTestId("ward-pull-accepted-legal-status") as HTMLSelectElement;
  const legalForm = screen.getByTestId("ward-pull-accepted-legal-form") as HTMLSelectElement;
  const observation = screen.getByTestId("ward-pull-accepted-observation") as HTMLSelectElement;
  if (status.value === "") fireEvent.change(status, { target: { value: "Voluntary" } });
  if (legalForm.value === "") fireEvent.change(legalForm, { target: { value: "none" } });
  if (observation.value === "") fireEvent.change(observation, { target: { value: "general" } });
}

async function pullAndReadWho(referralId: string) {
  answerOpenQuestions();
  expect(screen.getByTestId("ward-pull-accepted-confirm")).not.toHaveAttribute("aria-disabled", "true");
  await act(async () => {
    fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
  });
  expect(current!.rejections.map((rejection) => rejection.reason)).toEqual([]);
  const journey = current!.movements.find((movement) => movement.referralId === referralId);
  expect(journey?.stage).toBe("pulled");
  return journey!.stageChanges.find((change) => change.to === "pulled")?.by;
}

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
  window.sessionStorage.clear();
  current = undefined;
});

describe("Pull the bed: who may pull, and the record names the desk (D-191)", () => {
  it("lets the coordinator pull, recorded as the coordinator", async () => {
    const { referral } = renderAs(() => undefined);
    expect(await pullAndReadWho(referral.id)).toBe("coordinator");
  });

  it("lets the ward desk of the ward that accepted pull, recorded as the ward desk", async () => {
    const { referral } = renderAs((unitId) => ({ role: "ward", scope: { kind: "ward", unitIds: [unitId] } }));
    expect(screen.queryByText("Coordinator only")).toBeNull();
    expect(await pullAndReadWho(referral.id)).toBe("ward");
  });

  it("refuses another ward's desk, with the reason, and starts nothing", async () => {
    const { referral } = renderAs((_, otherUnitId) => ({
      role: "ward",
      scope: { kind: "ward", unitIds: [otherUnitId] },
    }));
    answerOpenQuestions();
    expect(screen.getByTestId("ward-pull-accepted-confirm")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(PULL_DESK_REFUSAL, { selector: "[id$='-why']" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByTestId("ward-pull-accepted-confirm"));
    });
    expect(current!.movements.some((movement) => movement.referralId === referral.id)).toBe(false);
  });
});
