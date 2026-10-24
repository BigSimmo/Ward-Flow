import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { useEdExaminationSave } from "@/components/ward-management/ed/use-ed-examination-save";
import { useEdRowPanels } from "@/components/ward-management/ed/use-ed-screen-state";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  type WardFlowContextValue,
} from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  WardSharedSaveContext,
  type WardSharedSave,
} from "@/components/ward-management/shell/ward-shared-save-context";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { commandMetadata } from "@/components/ward-management/ward-command-metadata";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

const ID = "WF-001";
const seed = seedWardFlowStateAt(NOW_ANCHOR);
const movement = seed.movements.find((row) => row.id === ID)!;
let shared: WardSharedSave | null = null;
let world = seed.worldGeneration;

function ScopedContext({ children }: { children: ReactNode }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride value={{ ...value, worldGeneration: world }}>
      <WardSharedSaveContext.Provider value={shared}>{children}</WardSharedSaveContext.Provider>
    </WardFlowOverride>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ScopedContext>{children}</ScopedContext>
    </WardFlowProvider>
  );
}

function connected(): WardSharedSave {
  return { unconfirmedSave: false, status: "ready", error: null, retry: vi.fn() };
}

function deferred() {
  let resolve!: (outcome: WardCommandOutcome) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<WardCommandOutcome>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function formEvent(): FormEvent<HTMLFormElement> {
  return { preventDefault: vi.fn() } as unknown as FormEvent<HTMLFormElement>;
}

function openSave(dispatch: WardCommandDispatch, initialMovement = movement) {
  const props: Pick<WardFlowContextValue, "dispatch" | "movements" | "rejections" | "now"> = {
    dispatch,
    movements: [initialMovement],
    rejections: [],
    now: NOW_ANCHOR,
  };
  const offerStep = vi.fn();
  const view = renderHook(
    (current: typeof props) => {
      const panels = useEdRowPanels();
      return { panels, ...useEdExaminationSave({ ...current, panels, offerStep }) };
    },
    { wrapper: Wrapper, initialProps: props },
  );
  act(() => {
    view.result.current.panels.setExaminationOpenFor(ID);
    view.result.current.panels.setExaminationOutcome("inpatient_order");
  });
  return {
    ...view,
    props,
    offerStep,
    submit: () => act(() => view.result.current.submitExamination(formEvent(), ID)),
  };
}

afterEach(() => {
  cleanup();
  shared = null;
  world = seed.worldGeneration;
  sessionStorage.clear();
});

describe("ED examination save confirmation", () => {
  it("wires the real ED form to the local reducer and closes after its accepted record", () => {
    render(
      <Wrapper>
        <EdScreen edId="arm-ed" />
      </Wrapper>,
    );
    const row = screen.queryByTestId(`ward-ed-row-name-${ID}`);
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    const sheet = screen.queryByTestId(`ward-ed-phone-sheet-${ID}`);
    expect(sheet).not.toBeNull();
    fireEvent.click(within(sheet!).queryByRole("button", { name: "Record exam" })!);
    const form = screen.queryByTestId(`ward-ed-examine-form-${ID}`);
    expect(form).not.toBeNull();
    fireEvent.click(within(form!).queryByRole("radio", { name: "Inpatient treatment order" })!);
    fireEvent.submit(form!);
    expect(screen.queryByTestId(`ward-ed-examine-form-${ID}`)).toBeNull();
  });

  it("retains the choice while saving, guards rapid repeats and clears on confirmed acceptance", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.examinationFieldsDisabled).toBe(true);
    await act(async () => reply.resolve({ commandId: "synthetic-command", status: "accepted" }));
    expect(view.result.current.panels.examinationOpenFor).toBeUndefined();
    expect(view.result.current.panels.examinationOutcome).toBeUndefined();
    expect(view.offerStep).toHaveBeenCalledTimes(1);
  });

  it("retains a refused choice, reports the refusal and permits an edited new attempt", async () => {
    shared = connected();
    const reply = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-command", status: "refused", message: "Synthetic refusal." }),
    );
    expect(view.result.current.examinationSaveMessage).toBe("Not recorded: Synthetic refusal.");
    expect(view.result.current.examinationSaveDisabled).toBe(false);
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    act(() => view.result.current.panels.setExaminationOutcome("community_order"));
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch.mock.calls[1][0]).toMatchObject({ type: "RECORD_EXAMINATION", outcome: "community_order" });
  });

  it.each(["throw", "reject"] as const)("retains the form when the save %ss", async (kind) => {
    shared = connected();
    const dispatch = vi.fn<WardCommandDispatch>(() => {
      if (kind === "throw") throw new Error("Synthetic transport failure");
      return Promise.reject(new Error("Synthetic transport failure"));
    });
    const view = openSave(dispatch);
    await act(async () => view.submit());
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.examinationSaveMessage).toContain("Save is not confirmed");
    expect(view.result.current.examinationFieldsDisabled).toBe(false);
  });

  it("blocks a fresh submission while the original save is unconfirmed and reconciles its Retry", async () => {
    shared = connected();
    const reply = deferred(),
      terminal = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => reply.promise);
    const view = openSave(dispatch);
    view.submit();
    shared = { ...shared, unconfirmedSave: true, status: "unavailable" };
    await act(async () =>
      reply.resolve({
        commandId: "synthetic-command",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => true,
      }),
    );
    view.rerender(view.props);
    view.submit();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.result.current.examinationFieldsDisabled).toBe(true);
    shared = { ...shared, unconfirmedSave: false, status: "ready" };
    view.rerender({
      ...view.props,
      movements: [{ ...movement, examination: { at: NOW_ANCHOR, outcome: "inpatient_order" } }],
    });
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.examinationFieldsDisabled).toBe(true);
    await act(async () => terminal.resolve({ commandId: "synthetic-command", status: "accepted" }));
    expect(view.result.current.panels.examinationOpenFor).toBeUndefined();
    expect(view.result.current.panels.examinationOutcome).toBeUndefined();
  });

  it("confirms an accepted replay after another desk supersedes its examination", async () => {
    shared = connected();
    const first = deferred(),
      terminal = deferred();
    const dispatch = vi.fn<WardCommandDispatch>(() => first.promise);
    const view = openSave(dispatch);
    act(() => view.result.current.panels.setExaminationOutcome("further_examination_ordered"));
    view.submit();
    const recordedA = wardFlowReducer(seed, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW_ANCHOR,
      movementId: ID,
      outcome: "further_examination_ordered",
    });
    const recordedB = wardFlowReducer(recordedA, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: ID,
      outcome: "further_examination_ordered",
    });
    expect(recordedB.rejections).toHaveLength(seed.rejections.length);
    expect(recordedB.movements.find((row) => row.id === ID)?.supersededExaminations).toContainEqual({
      at: NOW_ANCHOR,
      outcome: "further_examination_ordered",
    });
    shared = { ...shared, status: "unavailable", unconfirmedSave: true };
    await act(async () =>
      first.resolve({
        commandId: "replayed-examination",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => true,
      }),
    );
    shared = connected();
    view.rerender({
      ...view.props,
      now: NOW_ANCHOR + 1,
      movements: [recordedB.movements.find((row) => row.id === ID)!],
    });
    const ownUndo = commandMetadata(seed, recordedA).undoStep;
    expect(ownUndo).toBeDefined();
    const accepted: WardCommandOutcome = {
      commandId: "replayed-examination",
      status: "accepted",
      isCurrent: () => true,
      canUndo: () => true,
      undoStep: ownUndo,
    };
    await act(async () => terminal.resolve(accepted));
    expect(view.result.current.panels.examinationOpenFor).toBeUndefined();
    expect(view.result.current.panels.examinationOutcome).toBeUndefined();
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(view.offerStep).toHaveBeenCalledTimes(1);
    const offeredCompletion = view.offerStep.mock.calls[0]?.[1]?.completion;
    const offered = await offeredCompletion;
    expect(offered).toMatchObject({ commandId: accepted.commandId, status: "accepted", undoStep: accepted.undoStep });
    expect(offered.isCurrent?.()).toBe(true);
    expect(offered.canUndo?.()).toBe(true);
  });

  it("keeps a refused private Retry refused when a foreign matching snapshot arrives", async () => {
    shared = connected();
    const first = deferred(),
      terminal = deferred();
    const view = openSave(() => first.promise);
    view.submit();
    shared = { ...shared, status: "unavailable", unconfirmedSave: true };
    await act(async () =>
      first.resolve({
        commandId: "refused-examination",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => true,
      }),
    );
    await act(async () =>
      terminal.resolve({
        commandId: "refused-examination",
        status: "refused",
        message: "Synthetic examination refusal.",
        isCurrent: () => true,
      }),
    );
    shared = connected(); // A later recovered read no longer carries the command's refusal text.
    view.rerender({
      ...view.props,
      movements: [{ ...movement, examination: { at: NOW_ANCHOR, outcome: "inpatient_order" } }],
    });
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.examinationSaveMessage).toBe("Not recorded: Synthetic examination refusal.");
  });

  it("preserves a changed choice when the original private Retry accepts", async () => {
    shared = connected();
    const first = deferred(),
      terminal = deferred();
    const view = openSave(() => first.promise);
    view.submit();
    shared = { ...shared, status: "unavailable", unconfirmedSave: true };
    await act(async () =>
      first.resolve({
        commandId: "original-examination",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => true,
      }),
    );
    act(() => view.result.current.panels.setExaminationOutcome("community_order"));
    shared = connected();
    view.rerender(view.props);
    await act(async () => terminal.resolve({ commandId: "original-examination", status: "accepted" }));
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("community_order");
    expect(view.result.current.examinationFieldsDisabled).toBe(false);
    expect(view.result.current.examinationSaveMessage).toBeUndefined();
  });

  it("fences the retained form and Undo when the original failed command lifetime ends", async () => {
    shared = connected();
    let current = true;
    const first = deferred(),
      terminal = deferred();
    const view = openSave(() => first.promise);
    view.submit();
    shared = { ...shared, status: "unavailable", unconfirmedSave: true };
    await act(async () =>
      first.resolve({
        commandId: "ended-examination",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => current,
      }),
    );
    current = false;
    shared = connected();
    view.rerender(view.props);
    await act(async () =>
      terminal.resolve({
        commandId: "ended-examination",
        status: "accepted",
        isCurrent: () => true,
        undoStep: { undoType: "UNDO_ED_STEP", subjectId: ID, seq: 1 },
      }),
    );
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.examinationFieldsDisabled).toBe(false);
    const offered = await view.offerStep.mock.calls[0]?.[1]?.completion;
    expect(offered.isCurrent?.()).toBe(false);
  });

  it("keeps a local refusal editable instead of assuming a void dispatch succeeded", () => {
    const view = openSave(vi.fn<WardCommandDispatch>());
    view.submit();
    view.rerender({
      ...view.props,
      rejections: [
        {
          id: "synthetic-refusal",
          at: NOW_ANCHOR,
          attempted: "RECORD_EXAMINATION",
          movementId: ID,
          reason: "Synthetic refusal.",
        },
      ],
    });
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.examinationSaveDisabled).toBe(false);
    expect(view.result.current.examinationSaveMessage).toBe("Not recorded: Synthetic refusal.");
  });

  it("retains the draft when Retry refuses the command with another desk's matching winner", async () => {
    shared = connected();
    const reply = deferred(),
      terminal = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    shared = { ...shared, unconfirmedSave: true, status: "unavailable" };
    await act(async () =>
      reply.resolve({
        commandId: "synthetic-command",
        status: "failed",
        confirmation: terminal.promise,
        isCurrent: () => true,
      }),
    );
    shared = {
      ...shared,
      unconfirmedSave: false,
      status: "ready",
      error: "Another desk changed this record. Nothing was changed.",
    };
    const winner = {
      ...view.props,
      movements: [{ ...movement, examination: { at: NOW_ANCHOR, outcome: "inpatient_order" as const } }],
    };
    view.rerender(winner);
    await act(async () =>
      terminal.resolve({ commandId: "synthetic-command", status: "refused", message: shared?.error ?? undefined }),
    );
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.examinationSaveMessage).toBe(
      "Not recorded: Another desk changed this record. Nothing was changed.",
    );
    shared = { ...shared, error: null };
    view.rerender(winner);
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
  });

  it("requires a new local history record to confirm a void repeat examination at the same time", () => {
    const previous = { at: NOW_ANCHOR, outcome: "further_examination_ordered" as const };
    const repeated = { ...movement, examination: previous };
    const view = openSave(() => undefined, repeated);
    act(() => view.result.current.panels.setExaminationOutcome("further_examination_ordered"));
    view.submit();
    view.rerender({ ...view.props, movements: [{ ...repeated, examination: { ...previous } }] });
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("further_examination_ordered");
    view.rerender({
      ...view.props,
      movements: [{ ...repeated, examination: { ...previous }, supersededExaminations: [previous] }],
    });
    expect(view.result.current.panels.examinationOpenFor).toBeUndefined();
    expect(view.result.current.panels.examinationOutcome).toBeUndefined();
  });

  it("does not clear a newer choice after an old failed save's matching record arrives", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    await act(async () => reply.resolve({ commandId: "synthetic-command", status: "failed", isCurrent: () => true }));
    act(() => view.result.current.panels.setExaminationOutcome("community_order"));
    view.rerender({
      ...view.props,
      movements: [{ ...movement, examination: { at: NOW_ANCHOR, outcome: "inpatient_order" } }],
    });
    expect(view.result.current.panels.examinationOutcome).toBe("community_order");
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
  });

  it("drops old waiting state without closing a draft after the save's lifetime ends", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    await act(async () =>
      reply.resolve({ commandId: "synthetic-command", status: "accepted", isCurrent: () => false }),
    );
    expect(view.result.current.examinationFieldsDisabled).toBe(false);
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
  });

  it("does not close a form opened for a different movement while a response is delayed", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    act(() => {
      view.result.current.panels.setExaminationOpenFor("synthetic-other-movement");
      view.result.current.panels.setExaminationOutcome("community_order");
    });
    await act(async () => reply.resolve({ commandId: "synthetic-command", status: "accepted" }));
    expect(view.result.current.panels.examinationOpenFor).toBe("synthetic-other-movement");
    expect(view.result.current.panels.examinationOutcome).toBe("community_order");
  });

  it("never adopts an old attempt after the synthetic world changes", async () => {
    shared = connected();
    const reply = deferred();
    const view = openSave(() => reply.promise);
    view.submit();
    world += 1;
    view.rerender(view.props);
    await act(async () => reply.resolve({ commandId: "synthetic-command", status: "accepted" }));
    expect(view.result.current.panels.examinationOpenFor).toBe(ID);
    expect(view.result.current.panels.examinationOutcome).toBe("inpatient_order");
    expect(view.result.current.examinationFieldsDisabled).toBe(false);
  });
});
