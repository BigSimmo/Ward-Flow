import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * D-72 item 5, ward side: a ward changes an occupied bed's observation level from the bed drawer.
 * The change is one RECORD_OBSERVATION_LEVEL command for that admission, and "Observation level
 * recorded" appears only once the command is confirmed, never while pending or after a refusal.
 */
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

/** Holds each command until the test accepts (real local engine) or refuses it, without network access. */
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
    /** Commit through the real provider but keep the response held; call the result to release it. */
    async commitHeld() {
      const next = pending.shift()!;
      const outcome = await next.commit();
      if (!outcome) throw new Error("The real provider did not return a command outcome");
      expect(outcome.status).toBe("accepted");
      return () => next.finish(outcome);
    },
    refuse(status: "refused" | "failed") {
      pending.shift()!.finish({ commandId: "delayed", status, message: "Review the shared board" });
    },
  };
}

function Override({ control, children }: { control: ReturnType<typeof commands>; children: ReactNode }) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => control.record(event, () => flow.dispatch(event));
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}

function mount(control: ReturnType<typeof commands>) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Override control={control}>
          <WardScreen unitId={UNIT} />
        </Override>
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

/** Change the level to two staff in the drawer and press Record level. */
function saveTwoStaff() {
  const drawer = within(screen.getByTestId("bed-telemetry-drawer"));
  fireEvent.click(drawer.getAllByTestId("ward-observation-change")[0]);
  fireEvent.change(drawer.getByTestId("ward-observation-level"), { target: { value: "two_staff" } });
  fireEvent.click(drawer.getByTestId("ward-observation-save"));
}

const RECORDED = /^Observation level recorded:/;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  route.pathname = `/mockups/ward-flow/ward/${UNIT}`;
});

describe("Ward bed drawer — observation level save (D-72 item 5)", () => {
  it("raises RECORD_OBSERVATION_LEVEL for the admission and confirms only after acceptance", async () => {
    const control = commands();
    mount(control);
    selectOccupiedBoardBed();
    const drawerText = () => screen.getByTestId("bed-telemetry-drawer").textContent ?? "";
    expect(drawerText()).not.toMatch(/Two staff/);
    saveTwoStaff();

    expect(control.record).toHaveBeenCalledTimes(1);
    const event = control.record.mock.calls[0]![0];
    expect(event.type).toBe("RECORD_OBSERVATION_LEVEL");
    if (event.type !== "RECORD_OBSERVATION_LEVEL") throw new Error("unreachable");
    expect(event.target).toMatchObject({ kind: "admission", actingUnitId: UNIT });
    expect(event.observation).toMatchObject({ level: "two_staff", intervalMinutes: null });
    // Pending: nothing announced yet.
    expect(screen.queryByText(RECORDED)).toBeNull();

    // Committed by the engine but the response still held: still nothing announced.
    const release = await act(async () => control.commitHeld());
    expect(screen.queryByText(RECORDED)).toBeNull();
    await act(async () => release());
    expect(screen.getByText(RECORDED)).toHaveTextContent("Observation level recorded: Two staff");
    // The open drawer's own bed now reads the new level, so the command named this bed's
    // admission and not another occupant's.
    expect(screen.getByTestId("bed-telemetry-drawer").querySelector("[data-testid=ward-observation-level]")).toBeNull();
    expect(drawerText()).toMatch(/Two staff/);
  });

  it("does not announce a refused change and says nothing was changed", async () => {
    const control = commands();
    mount(control);
    selectOccupiedBoardBed();
    saveTwoStaff();
    expect(control.record).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(RECORDED)).toBeNull();

    await act(async () => control.refuse("refused"));
    expect(screen.queryByText(RECORDED)).toBeNull();
    expect(screen.getByText("Not recorded: Review the shared board. Nothing was changed.")).toBeInTheDocument();
  });
});
