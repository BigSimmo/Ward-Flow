import { useState, type ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider, WF_PHONE_QUERY } from "@/components/wf";
import { MakeRoomPanel } from "@/components/ward-management/capacity/make-room-panel";
import { HandoverPage } from "@/components/ward-management/handover/handover-page";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { recentTellSubjects } from "@/components/ward-management/legal-forms/legal-forms-view";
import { SettingsScreen } from "@/components/ward-management/settings/settings-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { HealthService } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

function Mode({ shared, children }: { shared: boolean; children: ReactNode }) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride value={{ ...flow, shared: { enabled: shared, status: "ready", error: null } }}>
      {children}
    </WardFlowOverride>
  );
}

it.each([false, true])("Settings describes the actual rule-save audience, shared=%s (WF-031)", (shared) => {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Mode shared={shared}>
          <SettingsScreen />
        </Mode>
      </WardFlowProvider>
    </ToastProvider>,
  );
  const note = screen.getByTestId("ward-settings-governance");
  expect(note).toHaveTextContent(shared ? "saved to the shared workspace" : "this device's demo workspace");
  expect(note).toHaveTextContent("Appearance preferences apply to this browser");
  expect(note).not.toHaveTextContent("Changes remembered for this browser only");
});

it("keeps the shared prototype footer on the Handover phone branch (WF-030)", () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query === WF_PHONE_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
  }));
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HandoverPage />
    </WardFlowProvider>,
  );
  const footer = screen.getByTestId("ward-handover-governance");
  expect(footer).toBeVisible();
  expect(footer).toHaveTextContent("Synthetic prototype");
  expect(footer).toHaveTextContent("not for clinical use");
});

it("updates Make room cards and counts as the service changes (WF-077/079)", () => {
  const view = (service: HealthService | null) => (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <MakeRoomPanel now={NOW_ANCHOR} service={service} />
    </WardFlowProvider>
  );
  const { rerender } = render(view(null));
  const plans = () => screen.getAllByText(/^A bed can be freed on /);
  expect(plans()).toHaveLength(2);
  rerender(view("North Metro"));
  expect(plans()).toHaveLength(1);
  expect(screen.getByTestId("make-room")).toHaveTextContent("1 plan");
  rerender(view("East Metro"));
  expect(plans()).toHaveLength(1);
  rerender(view("South Metro"));
  expect(screen.queryByText(/^A bed can be freed on /)).not.toBeInTheDocument();
  expect(screen.getByText("No eligible make-room plans available.")).toBeVisible();
  expect(screen.queryByText("No waiting referral needs room made right now.")).not.toBeInTheDocument();
  rerender(view(null));
  expect(plans()).toHaveLength(2);
});

type TellControl = { accept?: () => void; calls: WardFlowEvent[] };
function TellHarness({ deferred, control }: { deferred: boolean; control: TellControl }) {
  const flow = useWardFlow();
  const [state, setState] = useState(() => {
    let state = seedWardFlowStateAt(0);
    const subject = recentTellSubjects(state, NOW_ANCHOR)[0]!;
    for (const party of ["personal_support_person", "mhas"] as const) {
      state = wardFlowReducer(state, {
        type: "RECORD_SUPPORT_NOTIFICATION",
        role: "coordinator",
        now: NOW_ANCHOR,
        occasion: subject.occasion,
        ...(subject.occasion === "discharge"
          ? { admissionId: subject.admissionId! }
          : { movementId: subject.movementId! }),
        party,
        outcome: "told",
        who: "Synthetic contact",
        contactedAt: NOW_ANCHOR,
      });
    }
    expect(recentTellSubjects(state, NOW_ANCHOR)[0]!.missing).toEqual(["carer"]);
    return state;
  });
  const dispatch = (event: WardFlowEvent): WardCommandOutcome | Promise<WardCommandOutcome> => {
    control.calls.push(event);
    const next = wardFlowReducer(state, event);
    const outcome: WardCommandOutcome = {
      commandId: `tell-${control.calls.length}`,
      status: next.rejections.length > state.rejections.length ? "refused" : "accepted",
      undoRecords: next.undoRecords,
      generation: next.worldGeneration,
    };
    if (deferred && event.type === "RECORD_SUPPORT_NOTIFICATION")
      return new Promise((resolve) => {
        control.accept = () => {
          setState(next);
          resolve(outcome);
        };
      });
    setState(next);
    return outcome;
  };
  return (
    <WardFlowOverride value={{ ...flow, ...state, dispatch }}>
      <LegalFormsScreen />
    </WardFlowOverride>
  );
}

describe("final Tell command feedback survives its outstanding-queue removal (WF-028)", () => {
  it.each([false, true])("keeps exact success and usable Undo, deferred shared save=%s", async (deferred) => {
    const control: TellControl = { calls: [] };
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <TellHarness deferred={deferred} control={control} />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Tell next" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Record Carer" }));
    const form = screen.getByRole("form", { name: "Record Carer" });
    fireEvent.change(within(form).getByLabelText("Who was told"), { target: { value: "Synthetic final contact" } });
    await act(async () => {
      fireEvent.submit(form);
    });
    if (deferred) {
      expect(screen.queryByText("Carer record saved")).not.toBeInTheDocument();
      await act(async () => {
        control.accept!();
      });
    }
    expect(await screen.findByText("Carer record saved")).toBeVisible();
    expect(screen.getByTestId("ward-support-notifications")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(await screen.findByText("Tell record undone.")).toBeVisible();
    expect(control.calls.at(-1)?.type).toBe("UNDO_SUPPORT_NOTIFICATION");
    expect(screen.getByRole("button", { name: "Record Carer" })).toBeVisible();
  });
});
