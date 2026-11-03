import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { Referral } from "@/components/ward-management/ward-model";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const commands = vi.hoisted(() => ({ raise: vi.fn() }));
vi.mock("@/components/ward-management/ward-flow-raise", () => ({ useWardRaise: () => commands.raise }));

import { CallSheet } from "@/components/ward-management/coordinator/call-sheet";
import { REFERRAL_CONTACT_OUTCOMES } from "@/components/ward-management/referrals/referral-owner-and-calls";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const seed = seedWardFlowState();
const unit = seed.units[0]!;
const ids = ["synthetic-call-referral-a", "synthetic-call-referral-b"];
const referrals: Referral[] = ids.map((id): Referral => ({
  ...seed.referrals[0]!,
  id,
  contactLog: undefined,
  destinations: [
    {
      destination: {
        kind: "psychiatric_ward",
        unitId: unit.id,
        sex: "Male",
        secureBedNeeded: false,
        involuntaryBedNeeded: false,
        highAcuityNursingNeeded: false,
      },
      state: "queued",
      referredAt: NOW_ANCHOR - 60,
    },
  ],
}));
const accepted = (): WardCommandOutcome => ({ commandId: "synthetic-call-command", status: "accepted" });
function Group() {
  const world = useWardFlow();
  return (
    <WardFlowOverride value={{ ...world, units: [unit], referrals }}>
      <CallSheet />
    </WardFlowOverride>
  );
}
function setup(promise = false) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Group />
    </WardFlowProvider>,
  );
  fireEvent.change(screen.getByTestId(`ward-call-sheet-outcome-${unit.id}`), {
    target: { value: REFERRAL_CONTACT_OUTCOMES[0]!.id },
  });
  if (promise) {
    const select = screen.getByTestId(`ward-call-sheet-promise-${unit.id}`) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: select.options[1]!.value } });
  }
  return screen.getByTestId(`ward-call-sheet-record-${unit.id}`);
}
async function press() {
  await act(async () => fireEvent.click(screen.getByTestId(`ward-call-sheet-record-${unit.id}`)));
}
beforeEach(() => {
  commands.raise.mockReset();
  commands.raise.mockImplementation(accepted);
});
afterEach(cleanup);

describe("call-sheet completion belongs to every requested referral step", () => {
  it("reports partial completion, keeps choices and retries only the refused referral", async () => {
    commands.raise.mockImplementation((_type, payload) =>
      payload.referralId === ids[1]
        ? { commandId: "synthetic-refusal", status: "refused", message: "Synthetic referral changed." }
        : accepted(),
    );
    setup();
    await press();
    expect(screen.queryByText("Recorded against 2 referrals.")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/1 of 2/);
    expect(screen.getByTestId(`ward-call-sheet-outcome-${unit.id}`)).toHaveValue(REFERRAL_CONTACT_OUTCOMES[0]!.id);
    commands.raise.mockImplementation(accepted);
    await press();
    expect(commands.raise.mock.calls.filter(([, payload]) => payload.referralId === ids[0])).toHaveLength(1);
    expect(commands.raise.mock.calls.filter(([, payload]) => payload.referralId === ids[1])).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("Recorded against 2 referrals.");
  });

  it("does not repeat an accepted contact when only its commitment was refused", async () => {
    commands.raise.mockImplementation((type, payload) =>
      type === "RECORD_REFERRAL_COMMITMENT" && payload.referralId === ids[1]
        ? { commandId: "synthetic-commitment-refusal", status: "refused" }
        : accepted(),
    );
    setup(true);
    await press();
    expect(screen.queryByText("Recorded against 2 referrals.")).toBeNull();
    commands.raise.mockImplementation(accepted);
    await press();
    const secondContactCalls = commands.raise.mock.calls.filter(
      ([type, payload]) => type === "LOG_REFERRAL_CONTACT" && payload.referralId === ids[1],
    );
    expect(secondContactCalls).toHaveLength(1);
    expect(commands.raise).toHaveBeenCalledTimes(5);
  });

  it("holds an uncertain command until its confirmation without repeating it", async () => {
    let confirm!: (outcome: WardCommandOutcome) => void;
    commands.raise.mockImplementation((_type, payload) =>
      payload.referralId === ids[1]
        ? {
            commandId: "synthetic-uncertain-call",
            status: "failed",
            confirmation: new Promise<WardCommandOutcome>((done) => {
              confirm = done;
            }),
          }
        : accepted(),
    );
    setup();
    await press();
    await press();
    expect(commands.raise).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Recorded against 2 referrals.")).toBeNull();
    await act(async () => confirm({ commandId: "synthetic-uncertain-call", status: "accepted" }));
    expect(screen.getByRole("status")).toHaveTextContent("Recorded against 2 referrals.");
    expect(commands.raise).toHaveBeenCalledTimes(2);
  });

  it("never claims success from an obsolete workspace answer", async () => {
    commands.raise.mockReturnValue({
      commandId: "synthetic-obsolete-call",
      status: "accepted",
      isCurrent: () => false,
    });
    setup();
    await press();
    expect(screen.queryByText("Recorded against 2 referrals.")).toBeNull();
    expect(screen.getByTestId(`ward-call-sheet-outcome-${unit.id}`)).toHaveValue(REFERRAL_CONTACT_OUTCOMES[0]!.id);
  });

  it("requires an explicit new-call action before changing a partially recorded call", async () => {
    commands.raise.mockImplementation((_type, payload) =>
      payload.referralId === ids[1] ? { commandId: "synthetic-refusal", status: "refused" } : accepted(),
    );
    setup();
    await press();
    expect(screen.getByTestId(`ward-call-sheet-outcome-${unit.id}`)).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Start another call" }));
    expect(screen.getByTestId(`ward-call-sheet-outcome-${unit.id}`)).not.toBeDisabled();
    expect(commands.raise).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(/Previously recorded steps are kept/);
  });
});
