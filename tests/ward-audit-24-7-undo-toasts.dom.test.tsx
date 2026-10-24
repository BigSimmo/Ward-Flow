import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider, useToast } from "@/components/wf";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { useUndoableStep } from "@/components/ward-management/use-undoable-step";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";

// Audit 24-7 (CT-08, CT-09, CT-10): Undo outcomes after leaving the page, lasting warnings and the
// Undo window in words. Synthetic records only.
const event = { type: "REQUEST_CAPACITY_REFRESH", role: "coordinator", now: 642, unitId: "ward-test" } as const;
const record = {
  kind: "step" as const,
  undoType: "UNDO_REFER_TO_UNITS" as const,
  action: "REFER_TO_UNITS" as const,
  subjectId: "WF-030",
  at: 642,
  seq: 1,
  role: "coordinator" as const,
  unitId: null,
  changes: [],
};

function Page({ dispatch }: { dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome> }) {
  const { run } = useUndoableStep({ dispatch, now: 642, routeRole: "coordinator", rejections: [] });
  return (
    <button
      onClick={() =>
        run(event, {
          success: "Referred",
          undo: () => ({ type: "UNDO_REFER_TO_UNITS", role: "coordinator", now: 642, movementId: "WF-030" }),
        })
      }
    >
      Record
    </button>
  );
}

function Layout({ dispatch }: { dispatch: (event: WardFlowEvent) => Promise<WardCommandOutcome> }) {
  const [onPage, setOnPage] = useState(true);
  return (
    <ToastProvider>
      {onPage ? <Page dispatch={dispatch} /> : null}
      <button onClick={() => setOnPage(false)}>Leave</button>
    </ToastProvider>
  );
}

function deferred() {
  let finish!: (value: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((resolve) => {
    finish = resolve;
  });
  return { promise, finish };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Audit 24-7 undo toasts", () => {
  it.each([
    ["accepted", "Undone. Back as it was."],
    ["refused", "Not recorded: Too late to undo"],
  ] as const)("says an Undo %s after the page has gone (CT-08)", async (status, said) => {
    const undo = deferred();
    const dispatch = vi
      .fn<(event: WardFlowEvent) => Promise<WardCommandOutcome>>()
      .mockResolvedValueOnce({ commandId: "step", status: "accepted", undoRecords: [record] })
      .mockReturnValueOnce(undo.promise);
    render(<Layout dispatch={dispatch} />);
    await act(async () => {
      fireEvent.click(screen.getByText("Record"));
    });
    const toast = screen.getByTestId("toast");
    // CT-10: the toast says the engine's window, read from the shared constant.
    expect(toast).toHaveTextContent("Undo within 5 min.");
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    fireEvent.click(screen.getByText("Leave"));
    expect(screen.queryByText("Record")).toBeNull();
    await act(async () => {
      undo.finish({ commandId: "undo", status, message: status === "refused" ? "Too late to undo" : undefined });
      await undo.promise;
    });
    expect(screen.getByTestId("toast")).toHaveTextContent(said);
  });

  it("keeps a warning or danger toast until dismissed, but not an info one (CT-09)", () => {
    vi.useFakeTimers();
    function Pusher() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.push({ tone: "warning", title: "Warning stays" });
            toast.push({ tone: "danger", title: "Danger stays" });
            toast.push({ tone: "info", title: "Info goes" });
            toast.push({ tone: "warning", title: "Timed warning goes", duration: 3000 });
          }}
        >
          Push
        </button>
      );
    }
    render(
      <ToastProvider>
        <Pusher />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Push"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    const left = screen.getAllByTestId("toast").map((toast) => toast.textContent);
    expect(left.some((text) => text?.includes("Warning stays"))).toBe(true);
    expect(left.some((text) => text?.includes("Danger stays"))).toBe(true);
    expect(left.some((text) => text?.includes("Info goes"))).toBe(false);
    expect(left.some((text) => text?.includes("Timed warning goes"))).toBe(false);
  });

  it("closes the form's Undo toast once the form has gone (CT-08)", () => {
    function Layout() {
      const [onPage, setOnPage] = useState(true);
      return (
        <ToastProvider>
          <WardFlowProvider initialNow={NOW_ANCHOR}>{onPage ? <AddPatientForm /> : null}</WardFlowProvider>
          <button onClick={() => setOnPage(false)}>Leave</button>
        </ToastProvider>
      );
    }
    render(<Layout />);
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
    fireEvent.click(screen.getByTestId("ward-add-patient-reset"));
    fireEvent.click(screen.getByTestId("ward-add-patient-reset-confirm"));
    expect(screen.getByTestId("toast")).toHaveTextContent("Form cleared");
    fireEvent.click(screen.getByText("Leave"));
    expect(screen.queryByTestId("toast")).toBeNull();
  });
});
