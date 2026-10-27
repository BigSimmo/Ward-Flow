import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientNowScreen } from "@/components/ward-management/patients/patient-now-screen";
import { GENDER_PLACEMENT_REASONS } from "@/components/ward-management/ward-change-reasons";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  usePathname: () => "/ward-flow/people/WF-012",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

/*
 * H-0117 (audit SM2-03): on the patient transit deck, Ask wards and the clinical override keep their
 * answers until the save is accepted, and say why at the control when it is not. Synthetic seed data only.
 */

type Mode = "failed" | "refused" | "accepted";
const FAILED_SAYS = "Save is not confirmed. Press Retry when you are back online. It will not be saved twice.";
const REFUSED_SAYS = "This record changed while you were looking. Your action was not applied.";
const SAYS: Record<Mode, RegExp | null> = {
  failed: /Save is not confirmed\. Press Retry when you are back online/u,
  refused: /Not recorded: This record changed while you were looking/u,
  accepted: null,
};

function outcomeFor(mode: Exclude<Mode, "accepted">): Promise<WardCommandOutcome> {
  return Promise.resolve(
    mode === "failed"
      ? { commandId: "c-1", status: "failed", message: FAILED_SAYS }
      : { commandId: "c-1", status: "refused", message: REFUSED_SAYS },
  );
}

/**
 * The provider's own engine, except for Ask wards. `refuseFirst` has the engine refuse a plain ask (an
 * unknown ward), which opens the override card; an ask carrying an override reason answers as `mode` says.
 */
function Answering({
  mode,
  refuseFirst = false,
  calls,
  children,
}: {
  mode: Mode;
  refuseFirst?: boolean;
  calls: WardFlowEvent[];
  children: ReactNode;
}) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    if (event.type !== "REFER_TO_UNITS") return flow.dispatch(event);
    calls.push(event);
    if (refuseFirst && !event.overrideReason) return flow.dispatch({ ...event, unitIds: ["no-such-ward"] });
    return mode === "accepted" ? flow.dispatch(event) : outcomeFor(mode);
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function openAskWards(mode: Mode, refuseFirst = false) {
  const calls: WardFlowEvent[] = [];
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Answering mode={mode} refuseFirst={refuseFirst} calls={calls}>
        <PatientNowScreen movementId="WF-012" />
      </Answering>
    </WardFlowProvider>,
  );
  fireEvent.click(within(screen.getByTestId("ward-patient-gate-bed")).getByRole("button"));
  const region = screen.getByRole("region", { name: "Ask wards" });
  const box = within(region)
    .getAllByRole("checkbox")
    .find((candidate) => !candidate.hasAttribute("disabled"))!;
  fireEvent.click(box);
  fireEvent.change(screen.getByLabelText("Ward placement reason"), { target: { value: GENDER_PLACEMENT_REASONS[0] } });
  fireEvent.click(screen.getByLabelText("Placement checked with the ward"));
  return { calls, box };
}

afterEach(cleanup);

describe("H-0117 transit deck saves keep their answers until accepted", () => {
  it.each(["failed", "refused", "accepted"] as const)("Ask wards, %s", async (mode) => {
    const { calls, box } = openAskWards(mode);
    await press(screen.getByRole("button", { name: "Ask 1 ward" }));
    expect(calls).toHaveLength(1);
    const said = SAYS[mode];
    if (said) {
      expect(box).toBeChecked();
      expect(screen.getByTestId("ward-ask-count")).toHaveTextContent(/^1 of/u);
      expect(screen.getByTestId("ward-transit-ask-failure").textContent).toMatch(said);
    } else {
      expect(screen.getByTestId("ward-ask-count")).toHaveTextContent(/^0 of/u);
      expect(screen.queryByTestId("ward-transit-ask-failure")).toBeNull();
    }
  });

  it.each(["failed", "refused", "accepted"] as const)("Override reason, %s", async (mode) => {
    const { calls } = openAskWards(mode, true);
    await press(screen.getByRole("button", { name: "Ask 1 ward" }));
    const reason = screen.getByLabelText("Override reason") as HTMLSelectElement;
    const value = within(reason).getAllByRole("option")[1]!.getAttribute("value")!;
    fireEvent.change(reason, { target: { value } });
    await press(screen.getByRole("button", { name: "Record reason and continue" }));
    expect(calls).toHaveLength(2);
    // The override carries the ward placement reason already given, or the engine refuses it again.
    expect(calls[1]).toMatchObject({
      type: "REFER_TO_UNITS",
      overrideReason: value,
      genderPlacementReason: GENDER_PLACEMENT_REASONS[0],
      genderPlacementChecked: true,
    });
    const said = SAYS[mode];
    if (said) {
      expect(screen.getByLabelText("Override reason")).toHaveValue(value);
      expect(screen.getByTestId("ward-transit-override-failure").textContent).toMatch(said);
    } else {
      expect(screen.queryByTestId("ward-transit-override-failure")).toBeNull();
      expect(screen.queryByLabelText("Override reason")).toBeNull();
    }
  });
});
