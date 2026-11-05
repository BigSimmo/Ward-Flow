import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ArrivalTimeModal } from "@/components/ward-management/referrals/arrival-time-modal";
import { AddTimeDialog } from "@/components/ward-management/legal-forms/legal-forms-add-time";
import { LegalFormDetailsSection } from "@/components/ward-management/legal-forms/legal-form-details";
import { PlannedAdmissionsPanel } from "@/components/ward-management/capacity/planned-admissions-panel";
import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { ReferralHistoryAndCorrections } from "@/components/ward-management/referrals/referral-history-corrections";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/referrals",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
afterEach(cleanup);
function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Shared({ dispatch, children }: { dispatch: WardCommandDispatch; children: ReactNode }) {
  const context = useWardFlow();
  return <WardFlowOverride value={{ ...context, dispatch }}>{children}</WardFlowOverride>;
}
function wrap(children: ReactNode, dispatch: WardCommandDispatch) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Shared dispatch={dispatch}>{children}</Shared>
    </WardFlowProvider>,
  );
}

describe("submitted draft content ownership", () => {
  it("freezes all planned admission fields while its command remains unresolved", async () => {
    const later = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "submitted",
      status: "failed",
      confirmation: later.promise,
    }));
    wrap(<PlannedAdmissionsPanel now={NOW_ANCHOR} />, dispatch);
    fireEvent.click(screen.getByTestId("ward-planned-book"));
    for (const id of ["ward-planned-patient", "ward-planned-reason", "ward-planned-unit", "ward-planned-legal"]) {
      const field = screen.getByTestId(id) as HTMLSelectElement;
      const choice = Array.from(field.options).find((option) => option.value !== "" && !option.disabled)!;
      fireEvent.change(field, { target: { value: choice.value } });
    }
    fireEvent.click(screen.getByTestId("ward-planned-submit"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    const fields = screen.getByTestId("ward-planned-time").closest("fieldset")!;
    expect(fields).toBeDisabled();
    expect(screen.getByTestId("ward-planned-time")).toBeDisabled();
    await act(async () => later.resolve({ commandId: "submitted", status: "refused", message: "Conflict" }));
    expect(fields).not.toBeDisabled();
    expect(screen.getByTestId("ward-planned-time")).not.toHaveValue("");
  });

  it("freezes a seclusion incident draft until its save settles", async () => {
    const initial = deferred();
    wrap(<SeclusionScreen />, () => initial.promise);
    const form = screen.getByTestId("seclusion-incident-form");
    const category = within(form).getByTestId("seclusion-incident-category") as HTMLSelectElement;
    fireEvent.change(category, {
      target: { value: Array.from(category.options).find((option) => option.value)!.value },
    });
    fireEvent.change(within(form).getByTestId("seclusion-incident-time"), { target: { value: "09:00" } });
    fireEvent.click(within(form).getByTestId("seclusion-incident-record"));
    expect(category).toBeDisabled();
    await act(async () => initial.resolve({ commandId: "submitted", status: "refused" }));
    expect(category).not.toBeDisabled();
    expect(category.value).not.toBe("");
  });

  it("reconciles a correction's eventual acceptance without clearing newer text", async () => {
    const later = deferred();
    const referral = seedWardFlowState().referrals.find((entry) => entry.source === "community")!;
    const dispatch = vi.fn<WardCommandDispatch>(() => ({
      commandId: "submitted",
      status: "failed",
      confirmation: later.promise,
    }));
    wrap(<ReferralHistoryAndCorrections referral={referral} now={NOW_ANCHOR} />, dispatch);
    const note = screen.getByTestId("ward-referral-correction-note");
    fireEvent.change(note, { target: { value: "Synthetic submitted correction" } });
    fireEvent.click(screen.getByTestId("ward-referral-add-correction"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    fireEvent.change(note, { target: { value: "Synthetic newer draft" } });
    fireEvent.click(screen.getByTestId("ward-referral-add-correction"));
    expect(dispatch).toHaveBeenCalledTimes(1);
    await act(async () => later.resolve({ commandId: "submitted", status: "accepted" }));
    expect(note).toHaveValue("Synthetic newer draft");
  });
});

describe("legal draft callbacks own their content and opening", () => {
  const movement = seedWardFlowState().movements.find((entry) => entry.legalForm)!;
  it("does not dismiss changed or reopened Add the time drafts", () => {
    let accept!: () => void;
    const close = vi.fn();
    const props = {
      movement,
      name: "Synthetic example",
      umrn: "SYN-OWNERSHIP",
      now: NOW_ANCHOR,
      dayZero: new Date("2026-01-01T00:00:00Z"),
      refusal: undefined,
      onClose: close,
      onSave: (_: unknown, accepted: () => void) => {
        accept = accepted;
      },
    };
    const view = render(<AddTimeDialog {...props} />);
    const time = screen.getByLabelText("Time");
    fireEvent.change(screen.getByLabelText("Date written"), { target: { value: "01/01/2026" } });
    fireEvent.change(time, { target: { value: "00:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Save time" }));
    expect(accept).toBeTypeOf("function");
    fireEvent.change(time, { target: { value: "00:01" } });
    act(() => accept());
    expect(close).not.toHaveBeenCalled();
    view.unmount();
    render(<AddTimeDialog {...props} />);
    act(() => accept());
    expect(close).not.toHaveBeenCalled();
  });

  it("holds an uncertain details command and retains newer edits after its acceptance", async () => {
    const later = deferred();
    const onSave = vi.fn(() => ({ commandId: "submitted", status: "failed" as const, confirmation: later.promise }));
    render(<LegalFormDetailsSection movement={movement} dayZero={new Date("2026-01-01T00:00:00Z")} onSave={onSave} />);
    fireEvent.click(screen.getByTestId("ward-legal-form-details-edit"));
    fireEvent.click(screen.getByTestId("ward-legal-form-details-save"));
    fireEvent.click(screen.getByTestId("ward-legal-form-details-save"));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: "Given" }));
    await act(async () => later.resolve({ commandId: "submitted", status: "accepted" }));
    expect(screen.getByTestId("ward-legal-form-details-save")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Given" })).toHaveAttribute("aria-checked", "true");
  });
});

it("keeps arrival save ownership through uncertainty and closes on matching confirmation", async () => {
  const later = deferred();
  const close = vi.fn();
  const movement = seedWardFlowState().movements.find((entry) => entry.stage === "pulled")!;
  const dispatch = vi.fn<WardCommandDispatch>(() => ({
    commandId: "submitted",
    status: "failed",
    confirmation: later.promise,
  }));
  wrap(<ArrivalTimeModal isOpen movement={movement} onClose={close} />, dispatch);
  const mode = screen.getByLabelText("How they are travelling") as HTMLSelectElement;
  fireEvent.change(mode, { target: { value: Array.from(mode.options).find((option) => option.value)!.value } });
  fireEvent.change(screen.getByLabelText("Type the ETA"), { target: { value: "11:30" } });
  fireEvent.click(screen.getByTestId("save-arrival-plan-button"));
  await act(async () => {});
  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(close).not.toHaveBeenCalled();
  expect(mode).toBeDisabled();
  await act(async () => later.resolve({ commandId: "submitted", status: "accepted" }));
  expect(close).toHaveBeenCalledTimes(1);
});
