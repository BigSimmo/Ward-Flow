import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { WardInformationNeedsPicker } from "@/components/ward-management/referrals/referral-information-needs-panel";
import {
  ReferralCommitments,
  WardCommitmentControls,
} from "@/components/ward-management/referrals/referral-commitments-panel";
import { ReferralOwnerAndCalls } from "@/components/ward-management/referrals/referral-owner-and-calls-panel";
import { wardReferralInboxEntries } from "@/components/ward-management/referrals/referral-inbox";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { Referral } from "@/components/ward-management/ward-model";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/referrals" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: vi.fn() }) }));
const seed = seedWardFlowState();
const unit = seed.units[0]!;
const referral: Referral = {
  ...seed.referrals[0]!,
  destinations: [
    {
      state: "queued",
      destination: {
        kind: "psychiatric_ward",
        unitId: unit.id,
        sex: "Female",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
    },
  ],
};
const entry = wardReferralInboxEntries([referral], unit.id)[0]!;
const forms = ["information", "commitment", "promise", "owner", "call"] as const;
type Form = (typeof forms)[number];
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function setup(kind: Form, dispatch: WardCommandDispatch) {
  route.pathname = kind === "information" || kind === "promise" ? `/ward-flow/ward/${unit.id}` : "/ward-flow/referrals";
  setWardFeatureFlagOnDevice("referral-information-needs", true);
  function Boundary({ children }: { children: ReactNode }) {
    const state = useWardFlow();
    return <WardFlowOverride value={{ ...state, dispatch }}>{children}</WardFlowOverride>;
  }
  const view =
    kind === "information" ? (
      <WardInformationNeedsPicker entry={entry} unitId={unit.id} actingUnitId={unit.id} refusal={undefined} />
    ) : kind === "promise" ? (
      <WardCommitmentControls entry={entry} unitId={unit.id} actingUnitId={unit.id} refusal={undefined} />
    ) : kind === "owner" || kind === "call" ? (
      <ReferralOwnerAndCalls referral={referral} now={NOW_ANCHOR} />
    ) : (
      <ReferralCommitments referral={referral} now={NOW_ANCHOR} />
    );
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Boundary>{view}</Boundary>
    </WardFlowProvider>,
  );
  let field: HTMLElement;
  let button: HTMLElement;
  if (kind === "information") {
    field = screen.getByRole("checkbox", { name: "Drug screen" });
    fireEvent.click(field);
    button = screen.getByTestId(`ward-referral-needs-ask-${referral.id}`);
  } else if (kind === "promise") {
    field = screen.getByTestId(`ward-referral-promise-choice-${referral.id}`);
    fireEvent.change(field, { target: { value: (field as HTMLSelectElement).options[1]!.value } });
    button = screen.getByTestId(`ward-referral-promise-${referral.id}`);
  } else if (kind === "call") {
    field = screen.getByTestId(`ward-referral-call-who-${referral.id}`);
    fireEvent.change(field, { target: { value: "referrer" } });
    fireEvent.change(screen.getByTestId(`ward-referral-call-outcome-${referral.id}`), {
      target: { value: "said_yes" },
    });
    button = screen.getByTestId(`ward-referral-call-log-${referral.id}`);
  } else if (kind === "owner") {
    field = screen.getByTestId(`ward-referral-assign-choice-${referral.id}`);
    fireEvent.change(field, { target: { value: "coordinator" } });
    button = screen.getByTestId(`ward-referral-assign-${referral.id}`);
  } else {
    field = screen.getByTestId(`ward-referral-commitment-step-${referral.id}`);
    fireEvent.change(field, { target: { value: "acknowledged" } });
    button = screen.getByTestId(`ward-referral-commitment-record-${referral.id}`);
  }
  const retained = () =>
    kind === "information" ? (field as HTMLInputElement).checked : (field as HTMLSelectElement).value !== "";
  return { field, button, retained };
}

it.each(forms)("keeps %s answers on a refused save and reports the matching refusal", async (kind) => {
  const answer = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => answer.promise);
  const h = setup(kind, dispatch);
  fireEvent.click(h.button);
  expect(h.retained()).toBe(true);
  await act(async () =>
    answer.resolve({ commandId: "synthetic-followup", status: "refused", message: "Synthetic refusal" }),
  );
  expect(h.retained()).toBe(true);
  expect(screen.getByRole("alert")).toHaveTextContent("Synthetic refusal");
});

it.each(forms)("keeps %s submission owned until late same-command acceptance", async (kind) => {
  const confirmation = deferred<WardCommandOutcome>();
  const dispatch = vi.fn<WardCommandDispatch>(() => ({
    commandId: "synthetic-followup",
    status: "failed",
    confirmation: confirmation.promise,
  }));
  const h = setup(kind, dispatch);
  fireEvent.click(h.button);
  expect(h.retained()).toBe(true);
  fireEvent.click(h.button);
  expect(dispatch).toHaveBeenCalledTimes(1);
  await act(async () =>
    confirmation.resolve({ commandId: "synthetic-followup", status: "accepted", isCurrent: () => true }),
  );
  expect(h.retained()).toBe(false);
});
