import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/wf";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { DelaysScreen } from "@/components/ward-management/delays/delays-screen";
import { GovernanceWorkbench } from "@/components/ward-management/governance-registers";
import { LegalFormsScreen } from "@/components/ward-management/legal-forms/legal-forms-screen";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type { Patient } from "@/components/ward-management/ward-patients";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { patientHref } from "@/components/ward-management/shell/ward-facade";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { inspectDelayPerson, showEveryDelayRow } from "./helpers/delays-interactions";

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function Override({
  dispatch,
  extra = [],
  generation,
  children,
}: {
  dispatch: WardCommandDispatch;
  extra?: Patient[];
  generation?: number;
  children: ReactNode;
}) {
  const flow = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...flow,
        dispatch,
        worldGeneration: generation ?? flow.worldGeneration,
        patients: [...flow.patients, ...extra],
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function form(dispatch: WardCommandDispatch, extra: Patient[] = [], generation?: number) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Override dispatch={dispatch} extra={extra} generation={generation}>
        <AddPatientForm />
      </Override>
    </WardFlowProvider>
  );
}

const own: Patient = {
  id: "PT-A900",
  umrn: "UM990090",
  givenName: "Synthetic",
  familyName: "Fixture",
  dateOfBirth: "1990-01-01",
};
const other: Patient = { ...own, id: "PT-A901", umrn: "UM990091" };
function fill() {
  fireEvent.change(screen.getByLabelText(/Record number|UMRN/i), { target: { value: own.umrn } });
  fireEvent.change(screen.getByLabelText("Given name"), { target: { value: own.givenName } });
  fireEvent.change(screen.getByLabelText("Family name"), { target: { value: own.familyName } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: own.dateOfBirth } });
}

beforeEach(() => router.push.mockClear());

describe("patient registration command settlement", () => {
  it("releases the submission when the accepted record belongs to an earlier workspace", async () => {
    const command = deferred<WardCommandOutcome>();
    const dispatch = vi
      .fn<WardCommandDispatch>()
      .mockReturnValueOnce(command.promise)
      .mockReturnValue({ commandId: "retry", status: "refused" });
    const view = render(form(dispatch));
    fill();
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    await act(async () => command.resolve({ commandId: "old-add", status: "accepted" }));
    view.rerender(form(dispatch, [own], 99));
    expect(router.push.mock.calls.length).toBe(0);
    expect(screen.getByTestId("ward-add-patient-submit").getAttribute("aria-disabled")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
    expect(dispatch.mock.calls.length).toBe(2);
  });
  it.each(["refused", "failed", "cancelled"] as const)(
    "ignores unrelated new records while its own command is pending then %s",
    async (status) => {
      const command = deferred<WardCommandOutcome>();
      const dispatch = vi.fn(() => command.promise);
      const view = render(form(dispatch));
      fill();
      fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
      view.rerender(form(dispatch, [other]));
      expect(router.push.mock.calls.length).toBe(0);
      fireEvent.submit(screen.getByTestId("ward-add-patient-form"));
      expect(dispatch.mock.calls.length).toBe(1);
      await act(async () => command.resolve({ commandId: "own-add", status }));
      expect(router.push.mock.calls.length).toBe(0);
      expect(screen.getByTestId("ward-add-patient-submit").getAttribute("aria-disabled")).toBeNull();
      expect((screen.getByLabelText(/Record number|UMRN/i) as HTMLInputElement).value === own.umrn).toBe(true);
    },
  );

  it.each(["snapshot-first", "outcome-first"] as const)(
    "opens only the submitted record after acceptance: %s",
    async (order) => {
      const command = deferred<WardCommandOutcome>();
      const dispatch = () => command.promise;
      const view = render(form(dispatch));
      fill();
      fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
      if (order === "snapshot-first") view.rerender(form(dispatch, [other, own]));
      expect(router.push.mock.calls.length).toBe(0);
      await act(async () => command.resolve({ commandId: "own-add", status: "accepted" }));
      if (order === "outcome-first") {
        expect(router.push.mock.calls.length).toBe(0);
        view.rerender(form(dispatch, [other, own]));
      }
      expect(router.push.mock.calls.length).toBe(1);
      expect(router.push.mock.calls[0]?.[0] === patientHref(own.id)).toBe(true);
    },
  );

  it("finishes an accepted shared save whose record stays outside the desk's view, echoing only typed text", async () => {
    vi.useFakeTimers();
    try {
      const command = deferred<WardCommandOutcome>();
      const dispatch = vi.fn<WardCommandDispatch>(() => command.promise);
      const view = render(form(dispatch));
      fill();
      fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
      await act(async () => command.resolve({ commandId: "own-add", status: "accepted" }));
      // A scoped snapshot arrives without the standalone record (only an unrelated one).
      view.rerender(form(dispatch, [other]));
      expect(screen.queryByTestId("ward-add-patient-saved-outside-view")).toBeNull();
      act(() => vi.advanceTimersByTime(3000));
      expect(router.push.mock.calls.length).toBe(0);
      expect(screen.getByTestId("ward-add-patient-saved-outside-view").textContent).toContain(
        `${own.givenName} ${own.familyName} added, ${own.umrn}`,
      );
      expect(screen.getByTestId("ward-add-patient-submit").getAttribute("aria-disabled")).not.toBeNull();
      expect((screen.getByLabelText(/Record number|UMRN/i) as HTMLInputElement).value).toBe("");
      expect(dispatch.mock.calls.length).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits once per accepted shared save, keeps typing done during the wait, and opens a record that arrives late", async () => {
    vi.useFakeTimers();
    try {
      const command = deferred<WardCommandOutcome>();
      const dispatch = vi.fn<WardCommandDispatch>(() => command.promise);
      const view = render(form(dispatch));
      fill();
      fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
      await act(async () => command.resolve({ commandId: "own-add", status: "accepted" }));
      act(() => vi.advanceTimersByTime(2000));
      // Unrelated snapshots inside the wait do not restart it.
      view.rerender(form(dispatch, [other]));
      view.rerender(form(dispatch, [other, { ...other, id: "PT-A902", umrn: "UM990092" }]));
      // Typing during the wait is kept when the save finishes.
      fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Next" } });
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByTestId("ward-add-patient-saved-outside-view").textContent).toContain(own.umrn);
      expect((screen.getByLabelText("Given name") as HTMLInputElement).value).toBe("Next");
      expect(router.push.mock.calls.length).toBe(0);
      // The record arrives late: the form holds new typing, so it is announced, not opened.
      view.rerender(form(dispatch, [other, own]));
      expect(router.push.mock.calls.length).toBe(0);
      expect(screen.getByTestId("ward-add-patient-saved-outside-view").textContent).toContain("now in Recent records");
      expect((screen.getByLabelText("Given name") as HTMLInputElement).value).toBe("Next");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens an accepted shared save's record when a slow snapshot brings it after the wait", async () => {
    vi.useFakeTimers();
    try {
      const command = deferred<WardCommandOutcome>();
      const dispatch = vi.fn<WardCommandDispatch>(() => command.promise);
      const view = render(<ToastProvider>{form(dispatch)}</ToastProvider>);
      fill();
      fireEvent.click(screen.getByTestId("ward-add-patient-submit"));
      await act(async () => command.resolve({ commandId: "own-add", status: "accepted" }));
      act(() => vi.advanceTimersByTime(3000));
      expect(router.push.mock.calls.length).toBe(0);
      view.rerender(<ToastProvider>{form(dispatch, [own])}</ToastProvider>);
      expect(router.push.mock.calls.length).toBe(1);
      expect(router.push.mock.calls[0]?.[0] === patientHref(own.id)).toBe(true);
      // One "added" toast for one save; the late arrival only says the record is available.
      const toasts = screen.getAllByTestId("toast").map((toast) => toast.textContent ?? "");
      expect(toasts.filter((text) => text.includes(" added, ")).length).toBe(1);
      expect(toasts.some((text) => text.includes("record now available"))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("escalation feedback", () => {
  it.each(["accepted", "refused", "failed", "cancelled"] as const)("waits for its own %s outcome", async (status) => {
    const command = deferred<WardCommandOutcome>();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Override dispatch={() => command.promise}>
          <DelaysScreen />
        </Override>
      </WardFlowProvider>,
    );
    showEveryDelayRow();
    const movement = seedWardFlowState().movements.find((entry) => isOpen(entry) && !entry.escalation)!;
    const panel = inspectDelayPerson(movement.id);
    fireEvent.click(within(panel).getByTestId(`delays-escalate-${movement.id}`));
    const notice = () => [...document.querySelectorAll('[role="status"]')].map((node) => node.textContent).join(" ");
    expect(notice().includes("Escalated to")).toBe(false);
    await act(async () => command.resolve({ commandId: "own-escalation", status }));
    expect(notice().includes(status === "accepted" ? "Escalated to" : "Escalation not confirmed")).toBe(true);
  });
});

function Governance({ dispatch }: { dispatch: WardCommandDispatch }) {
  const flow = useWardFlow();
  return (
    <GovernanceWorkbench movements={flow.movements} units={flow.units} now={NOW_ANCHOR} api={{ ...flow, dispatch }} />
  );
}
describe("endorsement feedback", () => {
  it("does not confirm another actor's matching review while its own command is pending or refused", async () => {
    const command = deferred<WardCommandOutcome>();
    let ownEvent: WardFlowEvent | undefined;
    function Harness() {
      const flow = useWardFlow();
      return (
        <>
          <button
            onClick={() => {
              if (ownEvent) flow.dispatch(ownEvent);
            }}
          >
            Foreign matching review
          </button>
          <GovernanceWorkbench
            movements={flow.movements}
            units={flow.units}
            now={NOW_ANCHOR}
            api={{
              ...flow,
              dispatch: (event) => {
                ownEvent = event;
                return command.promise;
              },
            }}
          />
        </>
      );
    }
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Harness />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-audit-row]")!);
    const detail = screen.getByTestId("ward-governance-decision-record");
    fireEvent.click(within(detail).getByRole("button", { name: "Reviewed" }));
    fireEvent.click(screen.getByRole("button", { name: "Foreign matching review" }));
    expect(screen.queryAllByTestId("toast").length).toBe(0);
    expect(within(detail).getByRole("status").textContent?.includes("Recording")).toBe(true);
    await act(async () => command.resolve({ commandId: "own-review", status: "refused" }));
    expect(screen.queryAllByTestId("toast").length).toBe(0);
    expect(within(detail).getByRole("status").textContent?.includes("not confirmed")).toBe(true);
  });
  it("says not confirmed, never Recording, when the sheet's review is refused before dispatch", () => {
    const dispatch = vi.fn<WardCommandDispatch>();
    function StaleHarness() {
      const flow = useWardFlow();
      return (
        <GovernanceWorkbench
          movements={flow.movements}
          units={flow.units}
          now={NOW_ANCHOR}
          api={{ ...flow, worldGeneration: flow.worldGeneration + 1, dispatch }}
        />
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <StaleHarness />
      </WardFlowProvider>,
    );
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-audit-row]")!);
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));
    fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "reviewed" } });
    const role = screen.getByLabelText("Reviewing role") as HTMLSelectElement;
    fireEvent.change(role, { target: { value: role.options[1]!.value } });
    fireEvent.click(screen.getByRole("button", { name: "Record finding" }));
    expect(dispatch).not.toHaveBeenCalled();
    const announced = document.body.textContent ?? "";
    expect(announced.includes("Recording review")).toBe(false);
    expect(announced.includes("Review not confirmed")).toBe(true);
  });
  it("keeps a reopened draft when an earlier endorsement completes", async () => {
    const command = deferred<WardCommandOutcome>();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Governance dispatch={() => command.promise} />
      </WardFlowProvider>,
    );
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-audit-row]")!);
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));
    fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "reviewed" } });
    const role = screen.getByLabelText("Reviewing role") as HTMLSelectElement;
    fireEvent.change(role, { target: { value: role.options[1]!.value } });
    fireEvent.click(screen.getByRole("button", { name: "Record finding" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Record review" }));
    await act(async () => command.resolve({ commandId: "earlier-review", status: "accepted" }));
    expect(screen.queryByLabelText("Decision") !== null).toBe(true);
  });
  it.each(["accepted", "refused", "failed", "cancelled"] as const)(
    "keeps the draft until its own %s outcome",
    async (status) => {
      const command = deferred<WardCommandOutcome>();
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Governance dispatch={() => command.promise} />
        </WardFlowProvider>,
      );
      fireEvent.click(document.querySelector<HTMLButtonElement>("[data-audit-row]")!);
      fireEvent.click(screen.getByRole("button", { name: "Record review" }));
      fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "reviewed" } });
      const role = screen.getByLabelText("Reviewing role") as HTMLSelectElement;
      fireEvent.change(role, { target: { value: role.options[1]!.value } });
      fireEvent.change(screen.getByLabelText("Note for the register"), { target: { value: "Synthetic review note" } });
      fireEvent.click(screen.getByRole("button", { name: "Record finding" }));
      expect(document.getElementById("screenAnnouncer")?.textContent === "Review recorded.").toBe(false);
      expect(screen.queryByLabelText("Decision") !== null).toBe(true);
      await act(async () => command.resolve({ commandId: "own-review", status }));
      expect(screen.queryByLabelText("Decision") !== null).toBe(status !== "accepted");
      if (status !== "accepted") {
        expect(
          (screen.getByLabelText("Note for the register") as HTMLTextAreaElement).value === "Synthetic review note",
        ).toBe(true);
        expect(screen.getByRole("button", { name: "Record finding" }).getAttribute("aria-disabled")).toBeNull();
      }
    },
  );
});

describe("clipboard feedback", () => {
  it("reports unavailable clipboard in legal forms controls", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy for handover/ }));
    await act(async () => {});
    expect(screen.queryByText("Copied") !== null).toBe(false);
    expect(screen.queryByText(/Could not copy/) !== null).toBe(true);
  });
  it("waits for clipboard acceptance in legal forms controls", async () => {
    const clipboard = deferred<void>();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => clipboard.promise },
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    const button = screen.getByRole("button", { name: /Copy for handover/ });
    fireEvent.click(button);
    expect(screen.queryByText("Copied") !== null).toBe(false);
    await act(async () => clipboard.resolve());
    expect(screen.queryByText("Copied") !== null).toBe(true);
  });
  it("shows clipboard failure without a success claim in legal forms controls", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    });
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <LegalFormsScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy for handover/ }));
    await act(async () => {});
    expect(screen.queryByText("Copied") !== null).toBe(false);
    expect(screen.queryByText(/Could not copy/) !== null).toBe(true);
  });
  it("falls back to the legacy copy path in legal forms controls", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
    try {
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <LegalFormsScreen />
        </WardFlowProvider>,
      );
      const button = screen.getByRole("button", { name: /Copy for handover/ });
      // Browsers move focus to a selected textarea; jsdom does not, so model it.
      const select = vi.spyOn(HTMLTextAreaElement.prototype, "select").mockImplementation(function (
        this: HTMLTextAreaElement,
      ) {
        this.focus();
      });
      button.focus();
      fireEvent.click(button);
      await act(async () => {});
      expect(execCommand).toHaveBeenCalledWith("copy");
      // The fallback's temporary textarea hands focus back to the control.
      expect(document.activeElement).toBe(button);
      select.mockRestore();
      expect(screen.queryByText("Copied") !== null).toBe(true);
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });
  it("raises a legal-forms copy failure as a toast, which stays visible above the sheet and drawer", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <LegalFormsScreen />
        </WardFlowProvider>
      </ToastProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Copy for handover/ }));
    await act(async () => {});
    expect(screen.getAllByTestId("toast").some((toast) => toast.textContent?.includes("Could not copy"))).toBe(true);
  });
});
