import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEdRecordSave } from "@/components/ward-management/ed/use-ed-record-save";
import { useEdRowPanels } from "@/components/ward-management/ed/use-ed-screen-state";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const ID = "WF-001";
const cases = [
  {
    kind: "urgency",
    type: "CHANGE_URGENCY",
    toggle: `ward-change-urgency-toggle-${ID}`,
    form: `ward-change-urgency-${ID}`,
    fields: [
      [`ward-change-urgency-tier-${ID}`, "2"],
      [`ward-change-urgency-reason-${ID}`, "reassessed"],
    ],
  },
  {
    kind: "legalStatus",
    type: "CHANGE_LEGAL_STATUS",
    toggle: `ward-change-legal-status-toggle-${ID}`,
    form: `ward-change-legal-status-${ID}`,
    fields: [
      [`ward-change-legal-status-value-${ID}`, "Voluntary"],
      [`ward-change-legal-status-reason-${ID}`, "recorded_by_treating_team"],
    ],
  },
  {
    kind: "receipt",
    type: "CORRECT_LEGAL_FORM_RECEIPT",
    toggle: `ed-correct-form-receipt-toggle-${ID}`,
    form: `ed-correct-form-receipt-${ID}`,
    fields: [[`ed-correct-form-receipt-reason-${ID}`, "recorded_in_error"]],
  },
] as const;
type Kind = (typeof cases)[number]["kind"];
type Panels = ReturnType<typeof useEdRowPanels>;
let world = 0;
let shared: WardFlowContextValue["shared"];
let overrideDispatch: WardCommandDispatch | undefined;
function Scope({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  const movements = value.movements.map((movement) =>
    movement.id !== ID
      ? movement
      : {
          ...movement,
          legalForm: { ...movement.legalForm, code: "1A" as const },
          legalFormReceivedAt: NOW_ANCHOR - 10,
        },
  );
  return (
    <WardFlowOverride
      value={{
        ...value,
        movements,
        worldGeneration: world,
        shared,
        eventLog: [],
        ...(overrideDispatch ? { dispatch: overrideDispatch } : {}),
      }}
    >
      {children}
    </WardFlowOverride>
  );
}
function Wrapper({ children }: { children: ReactNode }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Scope>{children}</Scope>
    </WardFlowProvider>
  );
}
function connected() {
  return { enabled: true, status: "ready" as const, error: null };
}
function deferred() {
  let resolve!: (answer: WardCommandOutcome) => void;
  const promise = new Promise<WardCommandOutcome>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function setDraft(panels: Panels, kind: Kind, revised = false) {
  if (kind === "urgency") {
    panels.setUrgencyChangeOpenFor(ID);
    panels.setUrgencyDraft({ urgency: revised ? 3 : 2, reason: "reassessed" });
  } else if (kind === "legalStatus") {
    panels.setLegalStatusChangeOpenFor(ID);
    panels.setLegalStatusDraft({
      legalStatus: revised ? "Involuntary inpatient" : "Voluntary",
      reason: "recorded_by_treating_team",
    });
  } else {
    panels.setReceiptCorrectionOpenFor(ID);
    panels.setReceiptCorrectionReasonDraft(revised ? "form_had_not_physically_arrived" : "recorded_in_error");
  }
}
function readDraft(panels: Panels, kind: Kind) {
  if (kind === "urgency") return { open: panels.urgencyChangeOpenFor, draft: panels.urgencyDraft };
  if (kind === "legalStatus") return { open: panels.legalStatusChangeOpenFor, draft: panels.legalStatusDraft };
  return { open: panels.receiptCorrectionOpenFor, draft: panels.receiptCorrectionReasonDraft };
}
function openSave(kind: Kind, dispatch: WardCommandDispatch) {
  const props = { dispatch, now: NOW_ANCHOR };
  const view = renderHook(
    (current: typeof props) => {
      const panels = useEdRowPanels();
      return { panels, ...useEdRecordSave({ ...current, panels }) };
    },
    { wrapper: Wrapper, initialProps: props },
  );
  act(() => setDraft(view.result.current.panels, kind));
  const submit = () =>
    act(() => {
      const event = { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
      if (kind === "urgency") view.result.current.submitUrgencyChange(event, ID);
      else if (kind === "legalStatus") view.result.current.submitLegalStatusChange(event, ID);
      else view.result.current.submitReceiptCorrection(event, ID);
    });
  return {
    ...view,
    props,
    submit,
    draft: () => readDraft(view.result.current.panels, kind),
    state: () => view.result.current.recordSaveState(kind, ID),
  };
}
afterEach(() => {
  cleanup();
  world = 0;
  shared = undefined;
  overrideDispatch = undefined;
  sessionStorage.clear();
});

describe.each(cases)("ED $kind save confirmation", ({ kind, type, toggle, form: formId, fields }) => {
  it("the real form retains all selections and shows failure instead of closing", async () => {
    shared = connected();
    const reply = deferred();
    overrideDispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = render(
      <Wrapper>
        <EdScreen edId="arm-ed" />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId(`ward-ed-row-name-${ID}`));
    const sheet = within(screen.getByTestId(`ward-ed-phone-sheet-${ID}`));
    fireEvent.click(sheet.getByTestId(toggle));
    const form = sheet.getByTestId(formId);
    for (const [id, value] of fields) fireEvent.change(form.querySelector(`#${id}`)!, { target: { value } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(overrideDispatch).toHaveBeenCalledTimes(1);
    expect(vi.mocked(overrideDispatch).mock.calls[0][0]).toMatchObject({ type, movementId: ID, role: "ed" });
    for (const [id] of fields) expect(form.querySelector(`#${id}`)).toBeDisabled();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    view.rerender(
      <Wrapper>
        <EdScreen edId="arm-ed" />
      </Wrapper>,
    );
    await act(async () => reply.resolve({ commandId: "synthetic-correction", status: "failed" }));
    expect(form).toBeVisible();
    expect(within(form).getByRole("status")).toHaveTextContent("Save is not confirmed");
    for (const [id, value] of fields) expect(form.querySelector(`#${id}`)).toHaveValue(value);
  });

  it("retains pending selections, blocks repeats and closes after acceptance", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(kind, dispatch);
    const before = view.draft();
    view.submit();
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ type, role: "ed", movementId: ID });
    expect(view.draft()).toEqual(before);
    expect(view.state().disabled).toBe(true);
    await act(async () => reply.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft().open).toBeUndefined();
    expect(view.state().disabled).toBe(false);
  });

  it("retains a refused draft for editing and a new attempt", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(kind, dispatch);
    const before = view.draft();
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "refused", message: "Synthetic refusal." }),
    );
    expect(view.draft()).toEqual(before);
    expect(view.state().message).toBe("Not recorded: Synthetic refusal.");
    expect(view.state().disabled).toBe(false);
    act(() => setDraft(view.result.current.panels, kind, true));
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("Retry closes through the failed command's private confirmation with an empty scoped log", async () => {
    shared = connected();
    const reply = deferred();
    const terminal = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(kind, dispatch);
    view.submit();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "failed", confirmation: terminal.promise }),
    );
    shared = connected();
    view.rerender(view.props);
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.state().disabled).toBe(true);
    expect(view.draft().open).toBe(ID);
    await act(async () => terminal.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft().open).toBeUndefined();
    expect(view.state().disabled).toBe(false);
  });

  it("a private Retry refusal survives later reads clearing the global error", async () => {
    shared = connected();
    const reply = deferred();
    const terminal = deferred();
    const view = openSave(kind, () => reply.promise);
    const before = view.draft();
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "failed", confirmation: terminal.promise }),
    );
    await act(async () =>
      terminal.resolve({ commandId: "synthetic-correction", status: "refused", message: "Synthetic Retry refusal." }),
    );
    shared = connected();
    view.rerender(view.props);
    expect(view.state().message).toBe("Not recorded: Synthetic Retry refusal.");
    expect(view.draft()).toEqual(before);
    expect(view.state().disabled).toBe(false);
  });

  it("private Retry acceptance does not clear a revised choice", async () => {
    shared = connected();
    const reply = deferred();
    const terminal = deferred();
    const view = openSave(kind, () => reply.promise);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "failed", confirmation: terminal.promise }),
    );
    act(() => setDraft(view.result.current.panels, kind, true));
    const revised = view.draft();
    await act(async () => terminal.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft()).toEqual(revised);
  });

  it("a delayed acceptance does not clear a revised choice", async () => {
    const reply = deferred();
    const view = openSave(kind, () => reply.promise);
    view.submit();
    act(() => setDraft(view.result.current.panels, kind, true));
    const revised = view.draft();
    await act(async () => reply.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft()).toEqual(revised);
  });
});

describe("ED correction lifecycle", () => {
  it("an ended world releases pending state without clearing the newer form", async () => {
    const reply = deferred();
    const view = openSave("urgency", () => reply.promise);
    view.submit();
    world++;
    view.rerender(view.props);
    await act(async () => reply.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft().open).toBe(ID);
    expect(view.state().disabled).toBe(false);
  });
  it("an ended session cannot clear a current selection", async () => {
    const reply = deferred();
    const view = openSave("legalStatus", () => reply.promise);
    const before = view.draft();
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "cancelled", isCurrent: () => false }),
    );
    expect(view.draft()).toEqual(before);
    expect(view.state().disabled).toBe(false);
  });
  it("keeps failures from throws visible without clearing a receipt draft", () => {
    const view = openSave("receipt", () => {
      throw Error("Synthetic error");
    });
    const before = view.draft();
    view.submit();
    expect(view.draft()).toEqual(before);
    expect(view.state().message).toContain("Save is not confirmed");
    expect(view.state().disabled).toBe(false);
  });
  it("an ended world ignores a delayed private Retry confirmation", async () => {
    shared = connected();
    const reply = deferred();
    const terminal = deferred();
    const view = openSave("urgency", () => reply.promise);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "failed", confirmation: terminal.promise }),
    );
    world++;
    view.rerender(view.props);
    const before = view.draft();
    await act(async () => terminal.resolve({ commandId: "synthetic-correction", status: "accepted" }));
    expect(view.draft()).toEqual(before);
    expect(view.state().disabled).toBe(false);
  });
  it("a private confirmation from an ended session retains the draft and releases its guard", async () => {
    shared = connected();
    const reply = deferred();
    const terminal = deferred();
    const view = openSave("receipt", () => reply.promise);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-correction", status: "failed", confirmation: terminal.promise }),
    );
    const before = view.draft();
    await act(async () =>
      terminal.resolve({ commandId: "synthetic-correction", status: "cancelled", isCurrent: () => false }),
    );
    expect(view.draft()).toEqual(before);
    expect(view.state().disabled).toBe(false);
  });
  it("does not dispatch missing required selections on any correction", () => {
    const dispatch = vi.fn<WardCommandDispatch>();
    const view = openSave("urgency", dispatch);
    act(() => view.result.current.panels.setUrgencyDraft({ urgency: 2, reason: undefined }));
    view.submit();
    act(() => {
      view.result.current.submitLegalStatusChange(
        { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>,
        ID,
      );
      view.result.current.submitReceiptCorrection(
        { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>,
        ID,
      );
    });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
