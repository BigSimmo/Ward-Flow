import "@testing-library/jest-dom/vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDirtyStateGuard } from "@/components/ward-management/use-dirty-state-guard";
import {
  clearSessionDrafts,
  draftSessionVersion,
  readSessionDraft,
  sessionDraftKey,
  setDraftAccount,
  writeSessionDraft,
} from "@/components/ward-management/ward-session-drafts";

describe("opted-in synthetic form recovery", () => {
  beforeEach(() => {
    clearSessionDrafts();
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  it("saves after exactly 500ms, restores on remount and clears without a stale timer", () => {
    const key = sessionDraftKey("demo", "legal", "synthetic-1");
    const first = renderHook(() => useDirtyStateGuard({ storageKey: key, isDirty: true, value: "synthetic draft" }));
    act(() => vi.advanceTimersByTime(499));
    expect(readSessionDraft(key)).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(readSessionDraft(key)).toBe("synthetic draft");
    first.unmount();
    const onRestore = vi.fn();
    const next = renderHook(() =>
      useDirtyStateGuard({ storageKey: key, isDirty: true, value: "synthetic draft", onRestore }),
    );
    expect(onRestore).toHaveBeenCalledWith("synthetic draft");
    expect(next.result.current.draftRestored).toBe(true);
    act(() => next.result.current.clearDraft());
    act(() => vi.advanceTimersByTime(1000));
    expect(readSessionDraft(key)).toBeNull();
  });
  it("does not let non-opted-in guards erase active allowed drafts", () => {
    const key = sessionDraftKey("demo", "referral", "new");
    writeSessionDraft(key, "synthetic draft", draftSessionVersion());
    renderHook(() => useDirtyStateGuard({ key: "other", isDirty: true, value: "memory only" }));
    expect(readSessionDraft(key)).toBe("synthetic draft");
  });
  it("binds a delayed storage opt-in after account adoption and restores on remount", () => {
    setDraftAccount("synthetic-before-adoption");
    const first = renderHook(
      ({ key }: { key?: string }) =>
        useDirtyStateGuard({ storageKey: key, isDirty: true, value: "Synthetic adopted draft" }),
      { initialProps: { key: undefined } as { key?: string } },
    );
    setDraftAccount("synthetic-account-a");
    const key = sessionDraftKey("demo", "legal", "new");
    first.rerender({ key });
    act(() => vi.advanceTimersByTime(500));
    expect(readSessionDraft(key)).toBe("Synthetic adopted draft");
    first.unmount();
    const onRestore = vi.fn();
    renderHook(() => useDirtyStateGuard({ storageKey: key, isDirty: false, onRestore }));
    expect(onRestore).toHaveBeenCalledWith("Synthetic adopted draft");
  });
  it("fences outgoing account callbacks while allowing a new account form to save", () => {
    setDraftAccount("synthetic-account-a");
    const oldKey = sessionDraftKey("demo", "legal", "new");
    const old = renderHook(({ value }) => useDirtyStateGuard({ storageKey: oldKey, isDirty: true, value }), {
      initialProps: { value: "Synthetic outgoing draft" },
    });
    setDraftAccount("synthetic-account-b");
    old.rerender({ value: "Synthetic stale edit after account change" });
    const newKey = sessionDraftKey("demo", "legal", "new");
    renderHook(() => useDirtyStateGuard({ storageKey: newKey, isDirty: true, value: "Synthetic new account draft" }));
    act(() => vi.advanceTimersByTime(500));
    expect(window.sessionStorage.getItem(oldKey)).toBeNull();
    expect(readSessionDraft(newKey)).toBe("Synthetic new account draft");
    setDraftAccount("synthetic-account-a");
    old.rerender({ value: "Synthetic stale edit after returning to the old account" });
    act(() => vi.advanceTimersByTime(500));
    expect(window.sessionStorage.getItem(oldKey)).toBeNull();
    old.unmount();
  });
  it("does not resurrect drafts when a session terminates before debounce", () => {
    const key = sessionDraftKey("demo", "legal", "new");
    renderHook(() => useDirtyStateGuard({ storageKey: key, isDirty: true, value: "synthetic stale" }));
    clearSessionDrafts();
    act(() => vi.advanceTimersByTime(1000));
    expect(readSessionDraft(key)).toBeNull();
  });
});

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { RecordFormSheet, type RecordDraft } from "@/components/ward-management/legal-forms/legal-forms-sheets";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import {
  clearReferralDraftSession,
  discardReferralDraft,
  keepReferralDraft,
  readKeptReferralDraft,
} from "@/components/ward-management/referrals/referral-draft-store";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function LegalDraft({ save }: { save: () => boolean | Promise<boolean> }) {
  const [draft, onDraft] = useState<RecordDraft>({ form: "1A", movement: "" });
  return (
    <RecordFormSheet
      open
      onClose={() => {}}
      draft={draft}
      onDraft={onDraft}
      openMovements={wardMovements}
      labelOf={(m) => m.id}
      now={NOW_ANCHOR}
      onSaveForm={save}
    />
  );
}

describe("synthetic form integration", () => {
  beforeEach(() => {
    clearReferralDraftSession();
    window.sessionStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    clearReferralDraftSession();
    vi.useRealTimers();
  });
  it("recovers the referral after memory is lost and Clear starts a clean sheet", () => {
    const draw = () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
        </WardFlowProvider>,
      );
    const first = draw();
    fireEvent.click(screen.getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic refresh draft" } });
    act(() => vi.advanceTimersByTime(500));
    const key = sessionDraftKey("standard/0", "referral", "PT-023");
    const cached = window.sessionStorage.getItem(key)!;
    first.unmount();
    discardReferralDraft();
    window.sessionStorage.setItem(key, cached);
    draw();
    expect(screen.getByLabelText(/Reason for referral/)).toHaveValue("Synthetic refresh draft");
    expect(screen.getByRole("status")).toHaveTextContent("Draft restored in this tab —");
    expect(screen.queryByText(/Draft restored from this session/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Clear$/ }));
    act(() => vi.advanceTimersByTime(1000));
    expect(readSessionDraft(key)).toBeNull();
    expect(screen.queryByText(/Draft restored in this tab/)).not.toBeInTheDocument();
  });
  it.each([{ destType: "unknown" }, { unidentified: 42 }, { contact: { name: "" } }])(
    "discards a malformed persisted form without a reopen crash or false restore notice %#",
    (changes) => {
      const draw = () =>
        render(
          <WardFlowProvider initialNow={NOW_ANCHOR}>
            <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
          </WardFlowProvider>,
        );
      const first = draw();
      fireEvent.click(screen.getByRole("button", { name: "Referral" }));
      fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic pending draft" } });
      act(() => vi.advanceTimersByTime(500));
      const key = sessionDraftKey("standard/0", "referral", "PT-023");
      const envelope = JSON.parse(window.sessionStorage.getItem(key)!);
      envelope.value = JSON.stringify({ ...JSON.parse(envelope.value), ...changes });
      first.unmount();
      discardReferralDraft();
      window.sessionStorage.setItem(key, JSON.stringify(envelope));
      const next = draw();
      expect(screen.getByRole("complementary", { name: "Referrals" })).toBeInTheDocument();
      expect(screen.queryByText(/Draft restored in this tab/)).not.toBeInTheDocument();
      expect(window.sessionStorage.getItem(key)).toBeNull();
      next.unmount();
      draw();
      expect(screen.getByRole("complementary", { name: "Referrals" })).toBeInTheDocument();
    },
  );
  it("retains the attachment warning across a recovered autosave and a second refresh", () => {
    const draw = () =>
      render(
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
        </WardFlowProvider>,
      );
    const first = draw();
    fireEvent.click(screen.getByRole("button", { name: "Referral" }));
    fireEvent.change(screen.getByLabelText(/Reason for referral/), {
      target: { value: "Synthetic attachment recovery" },
    });
    act(() => vi.advanceTimersByTime(500));
    const key = sessionDraftKey("standard/0", "referral", "PT-023");
    const envelope = JSON.parse(window.sessionStorage.getItem(key)!);
    envelope.value = JSON.stringify({ ...JSON.parse(envelope.value), needsChartReattachment: true });
    first.unmount();
    discardReferralDraft();
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
    const second = draw();
    expect(screen.getByText(/Attachments are not recovered/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Reason for referral/), {
      target: { value: "Synthetic attachment draft edited" },
    });
    act(() => vi.advanceTimersByTime(500));
    const saved = window.sessionStorage.getItem(key)!;
    second.unmount();
    discardReferralDraft();
    window.sessionStorage.setItem(key, saved);
    draw();
    expect(screen.getByText(/Attachments are not recovered/)).toBeInTheDocument();
  });
  it("keeps legal values and cached draft after delayed refusal; clears only after acceptance", async () => {
    let complete!: (accepted: boolean) => void;
    const save = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          complete = resolve;
        }),
    );
    render(<LegalDraft save={save} />);
    fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
    fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
    act(() => vi.advanceTimersByTime(500));
    const key = sessionDraftKey("standard/0", "legal-record", "new");
    expect(readSessionDraft(key)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    expect(readSessionDraft(key)).not.toBeNull();
    await act(async () => complete(false));
    expect(readSessionDraft(key)).not.toBeNull();
    expect(screen.getByLabelText("Time on form")).toHaveValue("00:00");
    fireEvent.click(screen.getByRole("button", { name: "Save form" }));
    await act(async () => complete(true));
    act(() => vi.advanceTimersByTime(1000));
    expect(readSessionDraft(key)).toBeNull();
  });
});

it("waits for explicit world adoption before restoring an opted-in draft", () => {
  clearSessionDrafts();
  const key = sessionDraftKey("standard", "legal", "new");
  writeSessionDraft(key, "synthetic delayed restore", draftSessionVersion());
  const restore = vi.fn();
  const hook = renderHook(
    ({ ready }) => useDirtyStateGuard({ storageKey: ready ? key : undefined, isDirty: false, onRestore: restore }),
    { initialProps: { ready: false } },
  );
  expect(restore).not.toHaveBeenCalled();
  hook.rerender({ ready: true });
  expect(restore).toHaveBeenCalledWith("synthetic delayed restore");
});
it("shows degraded referral recovery when sessionStorage fills", () => {
  clearReferralDraftSession();
  vi.useFakeTimers();
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
    </WardFlowProvider>,
  );
  const blocked = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("quota");
  });
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic quota draft" } });
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByText(/Session recovery unavailable/)).toBeInTheDocument();
  blocked.mockRestore();
  view.unmount();
  clearReferralDraftSession();
  vi.useRealTimers();
});
it("restores legal form choices and time after refresh, and Clear removes the session copy", () => {
  clearReferralDraftSession();
  vi.useFakeTimers();
  const first = render(<LegalDraft save={() => false} />);
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
  fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
  act(() => vi.advanceTimersByTime(500));
  first.unmount();
  const second = render(<LegalDraft save={() => false} />);
  expect(screen.getByLabelText("Time on form")).toHaveValue("00:00");
  expect(screen.getByLabelText("Movement")).toHaveValue(wardMovements[0]!.id);
  expect(screen.getByText(/Draft restored in this tab — use Clear to remove it./)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  act(() => vi.advanceTimersByTime(1000));
  expect(readSessionDraft(sessionDraftKey("standard/0", "legal-record", "new"))).toBeNull();
  second.unmount();
  clearReferralDraftSession();
  vi.useRealTimers();
});

function ResetDraftWorld() {
  const { dispatch } = useWardFlowSelect("dispatch");
  return (
    <button onClick={() => dispatch({ type: "RESET_SCENARIO", role: "demo", now: NOW_ANCHOR })}>
      Reset synthetic world
    </button>
  );
}
it("clears drafts on an accepted scenario reset and fences the outgoing drawer", () => {
  clearReferralDraftSession();
  vi.useFakeTimers();
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ResetDraftWorld />
      <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
    </WardFlowProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic old world draft" } });
  act(() => vi.advanceTimersByTime(500));
  const key = sessionDraftKey("standard/0", "referral", "PT-023");
  expect(readSessionDraft(key)).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset synthetic world" }));
  act(() => vi.advanceTimersByTime(1000));
  expect(readSessionDraft(key)).toBeNull();
  expect(screen.getByLabelText(/Reason for referral/)).not.toHaveValue("Synthetic old world draft");
  view.unmount();
  clearReferralDraftSession();
  vi.useRealTimers();
});
it("restores referral choices without attachment bytes and prompts reattachment", () => {
  clearReferralDraftSession();
  vi.useFakeTimers();
  const draw = () =>
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardReferralDrawer initialPatientId="PT-023" onClose={() => {}} />
      </WardFlowProvider>,
    );
  const first = draw();
  fireEvent.click(screen.getByRole("button", { name: "Referral" }));
  fireEvent.change(screen.getByLabelText(/Reason for referral/), { target: { value: "Synthetic chart draft" } });
  act(() => vi.advanceTimersByTime(500));
  first.unmount();
  const draft =
    readKeptReferralDraft<import("@/components/ward-management/referrals/ward-referral-drawer-model").KeptDraft>()!;
  const key = sessionDraftKey("standard/0", "referral", "PT-023");
  keepReferralDraft(
    {
      ...draft,
      documentation: {
        ...draft.documentation,
        charts: [
          {
            kind: "medication",
            name: "synthetic-chart.pdf",
            mimeType: "application/pdf",
            sizeBytes: 3,
            base64: "AAAA",
          },
        ],
      },
    },
    undefined,
    key,
  );
  const cached = window.sessionStorage.getItem(key)!;
  expect(cached).not.toContain("AAAA");
  discardReferralDraft();
  window.sessionStorage.setItem(key, cached);
  const second = draw();
  expect(screen.getByText(/Attachments are not recovered/)).toBeInTheDocument();
  second.unmount();
  clearReferralDraftSession();
  vi.useRealTimers();
});
it("does not clear a newer legal draft after Clear during a pending accepted save", async () => {
  clearReferralDraftSession();
  vi.useFakeTimers();
  let complete!: (accepted: boolean) => void;
  const view = render(
    <LegalDraft
      save={() =>
        new Promise((resolve) => {
          complete = resolve;
        })
      }
    />,
  );
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
  fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save form" }));
  expect(screen.getByLabelText("Time on form")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
  fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:01" } });
  act(() => vi.advanceTimersByTime(500));
  await act(async () => complete(true));
  expect(screen.getByLabelText("Time on form")).toHaveValue("00:01");
  expect(readSessionDraft(sessionDraftKey("standard/0", "legal-record", "new"))).toContain("00:01");
  view.unmount();
  clearReferralDraftSession();
  vi.useRealTimers();
});
it("asks a Form 1A's region, opening blank, and sends it only when chosen (finding 203)", async () => {
  clearReferralDraftSession();
  const save = vi.fn(() => true);
  const view = render(<LegalDraft save={save} />);
  const region = screen.getByTestId("ward-legal-forms-record-region");
  expect(region).toHaveValue("");
  fireEvent.change(region, { target: { value: "country" } });
  fireEvent.change(screen.getByLabelText("Movement"), { target: { value: wardMovements[0]!.id } });
  fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Save form" }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ formCode: "1A", region: "country" }));
  view.unmount();
  clearReferralDraftSession();
});
