// Audit CS3-01: on the real screens, a save sent from an open inline form carries that form's hold,
// so the shared board checks it against the board the form opened on. Synthetic seed data only.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

import { WardAnswerView } from "@/components/ward-management/ward/ward-answer-view";
import { SentJourneyChanges } from "@/components/ward-management/movements/sent-journey-changes";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { commandSheetHandles, openSheetHandles } from "@/components/wf/sheet-focus";

afterEach(() => cleanup());

/** Each dispatch, with how many holds a save asked for at that moment would be checked against. */
function harness(children: (state: ReturnType<typeof useWardFlow>) => ReactNode) {
  const sent: { type: string; holds: number }[] = [];
  const dispatch = vi.fn((event: WardFlowEvent) => {
    sent.push({ type: event.type, holds: commandSheetHandles().length });
  });
  function Inner() {
    const state = useWardFlow();
    return <WardFlowOverride value={{ ...state, dispatch }}>{children(state)}</WardFlowOverride>;
  }
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Inner />
    </WardFlowProvider>,
  );
  return sent;
}

describe("inline forms on the real screens carry their hold (audit CS3-01)", () => {
  it("ward answer view: the decline form, once used, is sent with its hold (page form safety net)", () => {
    const sent = harness(() => <WardAnswerView unitId="sjgm-adult-open" />);
    expect(openSheetHandles()).toHaveLength(0);
    const id = screen.getByTestId(/^ward-incoming-/).dataset.testid!.replace("ward-incoming-", "");
    fireEvent.click(screen.getByTestId(`ward-decline-toggle-${id}`));
    const form = screen.getByTestId(`ward-decline-form-${id}`);
    const reason = within(form).getAllByRole("radio")[0]!;
    fireEvent.pointerDown(reason);
    expect(openSheetHandles().length).toBeGreaterThan(0);
    fireEvent.click(reason);
    within(form).getByRole("button").focus();
    fireEvent.submit(form);
    expect(sent.find((entry) => entry.type === "DECLINE")?.holds).toBeGreaterThan(0);
  });

  it("sent journey: a legal status change is sent with the form's hold, and closing it lets go", () => {
    const sent = harness((state) => (
      <SentJourneyChanges movement={state.movements[0]!} patientWho="the synthetic patient" />
    ));
    fireEvent.click(screen.getByTestId("sent-journey-legal-status-toggle"));
    expect(openSheetHandles().length).toBeGreaterThan(0);
    const form = screen.getByTestId("sent-journey-legal-status");
    const [status, reason] = within(form).getAllByRole("combobox");
    fireEvent.change(status!, { target: { value: (status as HTMLSelectElement).options[1]!.value } });
    fireEvent.change(reason!, { target: { value: (reason as HTMLSelectElement).options[1]!.value } });
    within(form)
      .getByRole("button", { name: /Record legal status change/ })
      .focus();
    fireEvent.submit(form);
    expect(sent.find((entry) => entry.type === "CHANGE_LEGAL_STATUS")?.holds).toBeGreaterThan(0);
    expect(openSheetHandles()).toHaveLength(0);
  });
});
