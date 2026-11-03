import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/ward/sjgm-adult-open/answer",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
import { WardReferralDetailDrawer } from "@/components/ward-management/ward/ward-referral-detail";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { OVERRIDE_REASON_REQUIRED, seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import type { Rejection } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(cleanup);
it("never labels a recorded negative clearance as medically cleared", () => {
  const state = seedWardFlowState();
  const movement = { ...state.movements[0], medicalClearance: { cleared: false, at: NOW_ANCHOR } };
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDetailDrawer
        movement={movement}
        unit={state.units[0]}
        now={NOW_ANCHOR}
        identity={resolveSubjectPatient(movement, state)}
        blocked={undefined}
        onClose={() => {}}
        onDecline={() => {}}
        onAccept={() => {}}
      />
    </WardFlowProvider>,
  );
  const detail = screen.getByTestId(`ward-referral-detail-${movement.id}`);
  expect(within(detail).queryByText("Medically cleared")).toBeNull();
  expect(within(detail).getByText("Not medically cleared")).toBeVisible();
});

it("shows community origin in the full referral instead of claiming an ED", () => {
  const state = seedWardFlowState();
  const movement = {
    ...state.movements[0],
    sourceAdmissionId: undefined,
    originEdId: undefined,
    originCommunity: { teamName: "Synthetic team", siteCode: "BTY" },
  };
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDetailDrawer
        movement={movement}
        unit={state.units[0]}
        now={NOW_ANCHOR}
        identity={resolveSubjectPatient(movement, state)}
        blocked={undefined}
        onClose={() => {}}
        onDecline={() => {}}
        onAccept={() => {}}
      />
    </WardFlowProvider>,
  );
  const detail = screen.getByTestId(`ward-referral-detail-${movement.id}`);
  expect(detail.textContent?.includes("Now at Synthetic team (community)")).toBe(true);
  expect(detail.textContent?.includes("the emergency department")).toBe(false);
});

it("does not carry a prior request's override answer to the next refused request", async () => {
  const state = seedWardFlowState();
  const unitId = "sjgm-adult-open";
  const first = state.movements.find(
    (movement) =>
      !movement.closure && movement.stage === "destination_review" && movement.referredUnitIds.includes(unitId),
  )!;
  const second = { ...first, id: "WF-AUDIT-NEXT" as const, openedAt: first.openedAt + 1 };
  const dispatch = vi.fn();
  let refused: Rejection[] = [];
  function Shared({ children }: { children: ReactNode }) {
    const context = useWardFlow();
    return (
      <WardFlowOverride value={{ ...context, movements: [first, second], dispatch, rejections: refused }}>
        {children}
      </WardFlowOverride>
    );
  }
  const tree = () => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Shared>
        <WardAnswerView unitId={unitId} />
      </Shared>
    </WardFlowProvider>
  );
  const view = render(tree());
  fireEvent.change(screen.getByRole("combobox", { name: "Pull time limit" }), { target: { value: "standard" } });
  fireEvent.click(screen.getByTestId(`ward-accept-${first.id}`));
  refused = [
    {
      id: "audit-first",
      at: NOW_ANCHOR,
      movementId: first.id,
      attempted: "ACCEPT_IN_PRINCIPLE",
      reason: OVERRIDE_REASON_REQUIRED,
    },
  ];
  await act(async () => view.rerender(tree()));
  fireEvent.click(within(screen.getByTestId(`ward-override-form-${first.id}`)).getAllByRole("radio")[0]);
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Pull time limit" }), { target: { value: "standard" } });
  fireEvent.click(screen.getByTestId(`ward-accept-${second.id}`));
  refused = [
    ...refused,
    {
      id: "audit-second",
      at: NOW_ANCHOR,
      movementId: second.id,
      attempted: "ACCEPT_IN_PRINCIPLE",
      reason: OVERRIDE_REASON_REQUIRED,
    },
  ];
  await act(async () => view.rerender(tree()));
  const choices = within(screen.getByTestId(`ward-override-form-${second.id}`)).getAllByRole(
    "radio",
  ) as HTMLInputElement[];
  expect(choices.every((choice) => !choice.checked)).toBe(true);
});
