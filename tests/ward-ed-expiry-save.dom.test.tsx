import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEdExpirySave } from "@/components/ward-management/ed/use-ed-expiry-save";
import { useEdRowPanels } from "@/components/ward-management/ed/use-ed-screen-state";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import type { EventLogEntry } from "@/components/ward-management/ward-event-log";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { instantFromDateAndTimeInputs } from "@/components/ward-management/ed/ed-screen-model";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const ID = "WF-001";
const DRAFT = { date: "2026-10-25", time: "14:00" };
let world = 0;
let overrideDispatch: WardCommandDispatch | undefined;
let shared: WardFlowContextValue["shared"];
let eventLog: EventLogEntry[] = [];
function Scope({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...value,
        worldGeneration: world,
        shared,
        eventLog,
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
  let reject!: () => void;
  const promise = new Promise<WardCommandOutcome>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function openSave(dispatch: WardCommandDispatch) {
  const props = { dispatch, now: NOW_ANCHOR, dayZero: new Date("2026-10-24T00:00:00+08:00") };
  const view = renderHook(
    (current: typeof props) => {
      const panels = useEdRowPanels();
      return { panels, ...useEdExpirySave({ ...current, panels }) };
    },
    { wrapper: Wrapper, initialProps: props },
  );
  act(() => {
    view.result.current.panels.setLegalFormExpiryOpenFor(ID);
    view.result.current.panels.setLegalFormExpiryDraft(DRAFT);
  });
  return {
    ...view,
    props,
    submit: (dueAt?: number) =>
      act(() =>
        view.result.current.submitLegalFormExpiry(
          { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>,
          ID,
          dueAt,
        ),
      ),
  };
}
function receipt(accepted = true, changes: Partial<EventLogEntry> & { commandId?: string } = {}): EventLogEntry {
  const entry = {
    commandId: "synthetic-expiry",
    sequence: 0,
    type: "RECORD_LEGAL_FORM_EXPIRY" as const,
    role: "ed" as const,
    now: NOW_ANCHOR,
    movementId: ID,
    accepted,
    ...changes,
  };
  return entry;
}
afterEach(() => {
  cleanup();
  overrideDispatch = undefined;
  world = 0;
  shared = undefined;
  eventLog = [];
  sessionStorage.clear();
});

describe("ED expiry save confirmation", () => {
  it("keeps the real form wired to the local reducer and closes after acceptance", () => {
    render(
      <Wrapper>
        <EdScreen edId="arm-ed" />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId(`ward-ed-row-name-${ID}`));
    fireEvent.click(
      within(screen.getByTestId(`ward-ed-phone-sheet-${ID}`)).getByTestId(`ward-ed-legal-form-expiry-toggle-${ID}`),
    );
    const sheet = within(screen.getByTestId(`ward-ed-phone-sheet-${ID}`));
    const date = sheet.getByTestId(`ward-ed-legal-form-expiry-date-${ID}`);
    const time = sheet.getByTestId(`ward-ed-legal-form-expiry-time-${ID}`);
    fireEvent.change(date, { target: { value: DRAFT.date } });
    fireEvent.change(time, { target: { value: DRAFT.time } });
    fireEvent.submit(sheet.getByTestId(`ward-ed-legal-form-expiry-${ID}`));
    expect(sheet.queryByTestId(`ward-ed-legal-form-expiry-${ID}`)).toBeNull();
  });

  it("the real form preserves entered fields and exposes guarded failure feedback", async () => {
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
    fireEvent.click(sheet.getByTestId(`ward-ed-legal-form-expiry-toggle-${ID}`));
    const date = sheet.getByTestId(`ward-ed-legal-form-expiry-date-${ID}`);
    const time = sheet.getByTestId(`ward-ed-legal-form-expiry-time-${ID}`);
    fireEvent.change(date, { target: { value: DRAFT.date } });
    fireEvent.change(time, { target: { value: DRAFT.time } });
    const form = sheet.getByTestId(`ward-ed-legal-form-expiry-${ID}`);
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(overrideDispatch).toHaveBeenCalledTimes(1);
    expect(date).toBeDisabled();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    view.rerender(
      <Wrapper>
        <EdScreen edId="arm-ed" />
      </Wrapper>,
    );
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "failed" }));
    expect(date).toHaveValue(DRAFT.date);
    expect(time).toHaveValue(DRAFT.time);
    expect(form).toBeVisible();
    expect(within(form).getByRole("status")).toHaveTextContent("Save is not confirmed");
    expect(sheet.getByTestId(`ward-ed-legal-form-expiry-save-${ID}`)).toHaveAttribute("aria-disabled", "true");
  });

  it("retains both fields during a pending save, blocks rapid duplicates and clears only on acceptance", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: "RECORD_LEGAL_FORM_EXPIRY",
      dueAt: instantFromDateAndTimeInputs(DRAFT.date, DRAFT.time, view.props.dayZero),
    });
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.legalFormExpiryFieldsDisabled).toBe(true);
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "accepted" }));
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBeUndefined();
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual({ date: "", time: "" });
  });

  it("keeps a refused draft editable and permits correction", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-expiry", status: "refused", message: "Synthetic refusal." }),
    );
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.legalFormExpirySaveMessage).toBe("Not recorded: Synthetic refusal.");
    expect(view.result.current.legalFormExpiryCommandDisabled).toBe(false);
    act(() => view.result.current.panels.setLegalFormExpiryDraft({ ...DRAFT, time: "15:00" }));
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it.each(["throw", "reject"] as const)("retains the draft when dispatch %ss", async (kind) => {
    shared = connected();
    const dispatch = vi.fn<WardCommandDispatch>(() => {
      if (kind === "throw") throw Error("synthetic");
      return Promise.reject(Error("synthetic"));
    });
    const view = openSave(dispatch);
    await act(async () => view.submit());
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.legalFormExpirySaveMessage).toContain("Save is not confirmed");
  });

  it("keeps a failed draft frozen until Retry's own accepted receipt arrives", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "failed" }));
    view.rerender(view.props);
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.result.current.legalFormExpiryFieldsDisabled).toBe(true);
    eventLog = [receipt()];
    shared = connected();
    view.rerender(view.props);
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBeUndefined();
  });

  it("waits for an adopted board after Retry accepts while refresh is unavailable", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "failed" }));
    eventLog = [receipt()];
    view.rerender(view.props);
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBe(ID);
    expect(view.result.current.legalFormExpiryFieldsDisabled).toBe(true);
    shared = connected();
    view.rerender(view.props);
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBeUndefined();
  });

  it("does not clear an edited draft for the same record after delayed acceptance", async () => {
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    act(() => view.result.current.panels.setLegalFormExpiryDraft({ ...DRAFT, time: "15:00" }));
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "accepted" }));
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBe(ID);
    expect(view.result.current.panels.legalFormExpiryDraft.time).toBe("15:00");
  });

  it("does not call an unrelated poll or an old receipt acceptance", async () => {
    eventLog = [receipt()];
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "failed" }));
    shared = connected();
    eventLog = [receipt(), receipt(true, { sequence: 1, commandId: "synthetic-other-command" })];
    view.rerender(view.props);
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBe(ID);
  });

  it("a refused Retry stays refused even if a later matching receipt appears", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    shared = { enabled: true, status: "unavailable", error: "Save is not confirmed." };
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "failed" }));
    eventLog = [receipt(false)];
    shared = { enabled: true, status: "ready", error: "Synthetic concurrent expiry refusal." };
    view.rerender(view.props);
    expect(view.result.current.legalFormExpirySaveMessage).toContain("Synthetic concurrent expiry refusal");
    shared = connected();
    eventLog = [receipt(false), receipt(true, { sequence: 1 })];
    view.rerender(view.props);
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.legalFormExpiryCommandDisabled).toBe(false);
  });

  it("does not clear a later record or changed draft after a delayed acceptance", async () => {
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    act(() => {
      view.result.current.panels.setLegalFormExpiryOpenFor("WF-002");
      view.result.current.panels.setLegalFormExpiryDraft({ ...DRAFT, time: "15:00" });
    });
    expect(view.result.current.legalFormExpirySaveMessage).toBeUndefined();
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "accepted" }));
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBe("WF-002");
    expect(view.result.current.panels.legalFormExpiryDraft.time).toBe("15:00");
  });

  it("an ended world cannot clear the newer form", async () => {
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    world++;
    view.rerender(view.props);
    await act(async () => reply.resolve({ commandId: "synthetic-expiry", status: "accepted" }));
    expect(view.result.current.panels.legalFormExpiryOpenFor).toBe(ID);
    expect(view.result.current.legalFormExpiryFieldsDisabled).toBe(false);
  });

  it("an ended session releases pending state without clearing the draft", async () => {
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-expiry", status: "cancelled", isCurrent: () => false }),
    );
    expect(view.result.current.panels.legalFormExpiryDraft).toEqual(DRAFT);
    expect(view.result.current.legalFormExpiryFieldsDisabled).toBe(false);
  });

  it("keeps the existing half-answer and later-than validation", () => {
    const dispatch = vi.fn<WardCommandDispatch>();
    const view = openSave(dispatch);
    view.submit(Infinity);
    act(() => view.result.current.panels.setLegalFormExpiryDraft({ ...DRAFT, time: "" }));
    view.submit();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
