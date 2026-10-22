import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const UNIT = "scgh-adult-open";
const route = vi.hoisted(() => ({ pathname: "/mockups/ward-flow/ward/scgh-adult-open" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/** Delay the actual local engine result, modelling a shared response without network access. */
function commands() {
  const pending: {
    finish: (outcome: WardCommandOutcome) => void;
    commit: () => ReturnType<WardCommandDispatch>;
  }[] = [];
  const record = vi.fn<
    (event: WardFlowEvent, commit: () => ReturnType<WardCommandDispatch>) => ReturnType<WardCommandDispatch>
  >((_event, commit) => new Promise<WardCommandOutcome>((finish) => pending.push({ finish, commit })));
  return {
    record,
    async accept() {
      const next = pending.shift()!;
      const outcome = await next.commit();
      if (!outcome) throw new Error("The real provider did not return a command outcome");
      expect(outcome.status).toBe("accepted");
      next.finish(outcome);
    },
    refuse(status: "refused" | "failed" | "cancelled") {
      pending.shift()!.finish({ commandId: "delayed", status, message: "Review the shared board" });
    },
  };
}

function Override({ control, children }: { control: ReturnType<typeof commands>; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => control.record(event, () => flow.dispatch(event));
  return (
    <WardFlowOverride
      value={{
        ...flow,
        dispatch,
        recordWardDeparture: (admissionId, actingUnitId, leavingDestination) =>
          dispatch({
            type: "RECORD_LEAVING",
            role: "ward",
            now: flow.now,
            admissionId,
            actingUnitId,
            leavingDestination,
          }),
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function mount(control: ReturnType<typeof commands>, children: ReactNode) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Override control={control}>{children}</Override>
      </ToastProvider>
    </WardFlowProvider>,
  );
}

function selectOccupiedBoardBed() {
  fireEvent.click(screen.getByRole("tab", { name: /^Bed board/ }));
  const beds = screen.getAllByTestId(/^ward-board-bed-\d+$/);
  const occupied = beds.find((cell) => !/free|closed|pulled/i.test(cell.getAttribute("aria-label") ?? ""));
  if (!occupied) throw new Error("The synthetic ward has no occupied bed");
  fireEvent.click(occupied);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  route.pathname = `/mockups/ward-flow/ward/${UNIT}`;
});

describe("Ward command feedback", () => {
  it.each(["refused", "failed", "cancelled"] as const)(
    "does not announce a pending departure or a %s departure as recorded",
    async (status) => {
      const control = commands();
      mount(control, <WardScreen unitId={UNIT} />);
      selectOccupiedBoardBed();
      fireEvent.click(screen.getByRole("button", { name: "Record that they have left" }));
      fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
      expect(control.record.mock.calls[0]?.[0].type).toBe("RECORD_LEAVING");
      expect(screen.queryByText(/^Recorded: .* has left the ward/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      await act(async () => control.refuse(status));
      expect(screen.queryByText(/^Recorded: .* has left the ward/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      // The ward screen (its confirmed-command feedback) shows the refusal reason, wherever it renders it.
      expect(screen.getByText(/Review the shared board/)).toBeInTheDocument();
    },
  );

  // A missing outcome is the local (synchronous) dispatch: main's ward screen reads a refusal back
  // from `rejections` on the next render (Josh, 26 Sept 2026, 1A), so this PR's "missing means not
  // confirmed" case no longer applies to the departure path. Raised for the owner in the #426 report.

  it("does not announce a pending or refused discharge-blocker change as recorded", async () => {
    const control = commands();
    mount(control, <WardScreen unitId={UNIT} />);
    selectOccupiedBoardBed();
    const drawer = within(screen.getByTestId("bed-telemetry-drawer"));
    fireEvent.click(drawer.getByRole("button", { name: /^(Record|Update) blocker$/ }));
    fireEvent.change(drawer.getByRole("combobox", { name: "Discharge blocker" }), {
      target: { value: "Awaiting accommodation" },
    });
    fireEvent.click(drawer.getByRole("button", { name: "Save blocker" }));
    expect(control.record).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Discharge blocker recorded:/)).toBeNull();
    await act(async () => control.refuse("refused"));
    expect(screen.queryByText(/^Discharge blocker recorded:/)).toBeNull();
    expect(screen.getByText(/Review the shared board/)).toBeInTheDocument();
  });

  it("waits for both departure acceptance and its Undo acceptance", async () => {
    const control = commands();
    mount(control, <WardScreen unitId={UNIT} />);
    selectOccupiedBoardBed();
    fireEvent.click(screen.getByRole("button", { name: "Record that they have left" }));
    fireEvent.click(screen.getByRole("button", { name: "Record departure" }));
    await act(() => control.accept());
    expect(screen.getByTestId("toast")).toHaveTextContent(/^Recorded: .* has left the ward/);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(control.record.mock.calls[1]?.[0]).toMatchObject({ type: "UNDO_DEPARTURE" });
    expect(screen.queryByText(/^Undone\. .* is back in their bed\./)).toBeNull();
    await act(() => control.accept());
    expect(screen.getByText(/^Undone\. .* is back in their bed\./)).toBeInTheDocument();
  });

  it("holds board placement feedback until its command is accepted, then confirms Undo separately", async () => {
    const control = commands();
    mount(control, <WardScreen unitId={UNIT} />);
    selectOccupiedBoardBed();
    fireEvent.click(screen.getByRole("button", { name: "Move to another bed" }));
    const free = screen
      .getAllByTestId(/^ward-board-bed-\d+$/)
      .find((bed) => bed.dataset.state === "ready" && bed.dataset.fits === "true");
    if (!free) throw new Error("The synthetic ward has no free bed");
    fireEvent.click(free);
    expect(screen.getByTestId("ward-board-say")).not.toHaveTextContent(/^Moved /);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    await act(() => control.accept());
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Moved /);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByTestId("ward-board-say")).not.toHaveTextContent(/^Undone/);
    await act(() => control.accept());
    expect(screen.getByTestId("ward-board-say")).toHaveTextContent(/^Undone/);
  });
});

describe("Referral decision feedback", () => {
  function accept(control: ReturnType<typeof commands>) {
    route.pathname = "/mockups/ward-flow/referrals";
    mount(control, <ReferralBoard />);
    fireEvent.click(screen.getByTestId("ward-referral-board-select-RF-005"));
    // D-77: pick a fitting ward in the one decision list, then Accept.
    const fit = document.querySelector<HTMLButtonElement>(
      'button[data-testid^="ward-referral-match-phone-cand-"][data-kind="yes"]',
    );
    if (!fit) throw new Error("The synthetic referral has no accepting ward");
    fireEvent.click(fit);
    fireEvent.click(screen.getByTestId("ward-referral-match-phone-accept"));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  }

  it("does not treat an absent decision completion as acceptance", () => {
    const control = commands();
    control.record.mockReturnValueOnce(undefined);
    accept(control);
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByTestId("toast")).toHaveTextContent("Save is not confirmed");
  });

  it("does not announce acceptance when the delayed decision is refused", async () => {
    const control = commands();
    accept(control);
    await act(async () => control.refuse("refused"));
    expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
    expect(screen.getByTestId("toast")).toHaveTextContent("Review the shared board");
  });

  it("waits for the accepted decision and for its Undo result", async () => {
    const control = commands();
    accept(control);
    await act(() => control.accept());
    expect(screen.getByTestId("toast")).toHaveTextContent(/^Accepted at /);
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(control.record.mock.calls[1]?.[0].type).toBe("UNDO_REFERRAL_DECISION");
    expect(screen.queryByText("Decision undone")).toBeNull();
    await act(() => control.accept());
    expect(screen.getByText("Decision undone")).toBeInTheDocument();
  });
});
