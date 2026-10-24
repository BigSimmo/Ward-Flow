import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const intercepted = vi.hoisted(() => ({ raise: vi.fn(), select: undefined as Record<string, unknown> | undefined }));
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useOptionalWardFlowSelect: (...keys: string[]) =>
      intercepted.select === undefined
        ? Reflect.apply(actual.useOptionalWardFlowSelect, undefined, keys)
        : Object.fromEntries(keys.map((key) => [key, intercepted.select?.[key]])),
  };
});
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ward-management/ward-flow-raise", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-raise")>();
  return {
    ...actual,
    useWardRaise: (role: Parameters<typeof actual.useWardRaise>[0]) => {
      const raise = actual.useWardRaise(role);
      return ((type: string, ...args: unknown[]) =>
        type === "RAISE_REFERRAL"
          ? intercepted.raise(type, ...args)
          : Reflect.apply(raise, undefined, [type, ...args])) as typeof raise;
    },
  };
});
import { useEdReferralSave } from "@/components/ward-management/ed/use-ed-referral-save";
import { useEdReferralDraft, useEdRaiseAnnouncement } from "@/components/ward-management/ed/use-ed-screen-state";
import { DEFAULT_DRAFT } from "@/components/ward-management/ed/ed-screen-model";
import type { SharedView } from "@/components/ward-management/ward-shared-client";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import type { WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import {
  EdInboxReferralFixture,
  markNotYetIdentified,
  openRaiseIntoMovementForm,
} from "./helpers/ed-raise-into-movement";

function readyForm() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <EdInboxReferralFixture edId="jhc-ed" />
      <EdScreen edId="jhc-ed" />
    </WardFlowProvider>,
  );
  openRaiseIntoMovementForm();
  markNotYetIdentified();
  for (const [field, value] of [
    ["cohort", "Adult"],
    ["security", "Open"],
    ["sex", "Female"],
    ["gender", "Female"],
    ["legal-status", "Voluntary"],
    ["urgency", "3"],
    ["observation", "general"],
  ]) {
    fireEvent.change(screen.getByTestId(`ward-ed-referral-${field}`), { target: { value } });
  }
  fireEvent.click(screen.getByTestId("ward-ed-referral-high-acuity-not-required"));
}

describe("ED raise referral confirmation", () => {
  beforeEach(() => {
    intercepted.raise.mockReset();
    intercepted.select = undefined;
  });
  it("keeps the real form and its selected answers while a deferred save fails", async () => {
    let finish!: (outcome: WardCommandOutcome) => void;
    intercepted.raise.mockReturnValue(
      new Promise<WardCommandOutcome>((resolve) => {
        finish = resolve;
      }),
    );
    readyForm();
    fireEvent.click(screen.getByTestId("ward-ed-referral-submit"));
    expect(screen.queryByTestId("ward-ed-referral-form") !== null).toBe(true);
    await act(async () => finish({ commandId: "synthetic-command", status: "failed" }));
    expect(screen.queryByTestId("ward-ed-referral-form") !== null).toBe(true);
    expect(screen.getByTestId("ward-ed-referral-cohort")).toHaveValue("Adult");
    expect(screen.getByTestId("ward-ed-referral-sex")).toHaveValue("Female");
  });
});

function hookSetup() {
  const snapshot: {
    worldGeneration: number;
    shared: { enabled: boolean; status: SharedView["status"]; error: string | null };
    eventLog: NonNullable<SharedView["eventLog"]>;
  } = { worldGeneration: 1, shared: { enabled: true, status: "ready", error: null }, eventLog: [] };
  intercepted.select = snapshot;
  const hook = renderHook(() => {
    const state = useEdReferralDraft();
    return { state, ...useEdReferralSave(state) };
  });
  act(() => {
    hook.result.current.state.setReferralOpen(true);
    hook.result.current.state.setRaisingFromReferralId("synthetic-referral");
    hook.result.current.state.setDraft({ ...DEFAULT_DRAFT, cohort: "Adult", sex: "Female" });
  });
  return { ...hook, snapshot };
}
function receipt(commandId: string, accepted: boolean, sequence = 0) {
  return { commandId, sequence, type: "RAISE_REFERRAL" as const, role: "ed" as const, now: 642, accepted };
}

describe("ED referral save attribution and lifetime", () => {
  beforeEach(() => {
    intercepted.raise.mockReset();
    intercepted.select = undefined;
  });
  it("guards rapid repeats synchronously and closes only on accepted completion", async () => {
    const h = hookSetup();
    let finish!: (outcome: WardCommandOutcome) => void;
    const record = vi.fn(
      () =>
        new Promise<WardCommandOutcome>((resolve) => {
          finish = resolve;
        }),
    );
    act(() => {
      expect(h.result.current.saveReferral(record, 642)).toBe(true);
      expect(h.result.current.saveReferral(record, 642)).toBe(false);
    });
    expect(record).toHaveBeenCalledTimes(1);
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.referralFieldsDisabled).toBe(true);
    await act(async () => finish({ commandId: "synthetic-one", status: "accepted" }));
    expect(h.result.current.state.referralOpen).toBe(false);
    expect(h.result.current.state.draft).toBe(DEFAULT_DRAFT);
    expect(h.result.current.accepted).toBe(1);
  });
  it.each(["refused", "cancelled"] as const)("keeps the editable draft after a %s completion", async (status) => {
    const h = hookSetup();
    const draft = h.result.current.state.draft;
    await act(async () => {
      h.result.current.saveReferral(
        () => Promise.resolve({ commandId: "synthetic-one", status, message: "Synthetic refusal" }),
        642,
      );
    });
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.state.draft).toBe(draft);
    expect(h.result.current.referralFieldsDisabled).toBe(false);
    expect(h.result.current.accepted).toBe(0);
    expect(h.result.current.referralSaveMessage).toContain("Synthetic refusal");
  });
  it("ignores another command's same-minute receipt and accepts only the original Retry", async () => {
    const h = hookSetup();
    await act(async () => {
      h.result.current.saveReferral(() => Promise.resolve({ commandId: "synthetic-one", status: "failed" }), 642);
    });
    h.snapshot.eventLog = [receipt("synthetic-other", true)];
    h.rerender();
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.accepted).toBe(0);
    h.snapshot.shared.status = "saving";
    h.snapshot.eventLog = [...h.snapshot.eventLog, receipt("synthetic-one", true, 1)];
    h.rerender();
    expect(h.result.current.state.referralOpen).toBe(true);
    h.snapshot.shared.status = "ready";
    h.rerender();
    expect(h.result.current.state.referralOpen).toBe(false);
    expect(h.result.current.accepted).toBe(1);
  });
  it("keeps a refused Retry terminal after later reads clear the global error", async () => {
    const h = hookSetup();
    const draft = h.result.current.state.draft;
    await act(async () => {
      h.result.current.saveReferral(() => Promise.resolve({ commandId: "synthetic-one", status: "failed" }), 642);
    });
    h.snapshot.shared.error = "Synthetic refused Retry";
    h.snapshot.eventLog = [receipt("synthetic-one", false)];
    h.rerender();
    expect(h.result.current.referralFieldsDisabled).toBe(false);
    expect(h.result.current.referralSaveMessage).toContain("Synthetic refused Retry");
    h.snapshot.shared.error = null;
    h.snapshot.eventLog = [...h.snapshot.eventLog, receipt("synthetic-other", true, 1)];
    h.rerender();
    expect(h.result.current.state.draft).toBe(draft);
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.accepted).toBe(0);
    expect(h.result.current.referralSaveMessage).toContain("Synthetic refused Retry");
  });
  it("does not erase a replacement draft or its new linked referral on late acceptance", async () => {
    const h = hookSetup();
    let finish!: (outcome: WardCommandOutcome) => void;
    act(() => {
      h.result.current.saveReferral(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        642,
      );
    });
    act(() => {
      h.result.current.state.setDraft({ ...DEFAULT_DRAFT, sex: "Male" });
      h.result.current.state.setRaisingFromReferralId("synthetic-new-referral");
    });
    await act(async () => finish({ commandId: "synthetic-one", status: "accepted" }));
    expect(h.result.current.state.draft.sex).toBe("Male");
    expect(h.result.current.state.raisingFromReferralId).toBe("synthetic-new-referral");
    expect(h.result.current.state.referralOpen).toBe(true);
  });
  it("does not clear or announce a stale world completion", async () => {
    const h = hookSetup();
    let finish!: (outcome: WardCommandOutcome) => void;
    act(() => {
      h.result.current.saveReferral(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        642,
      );
    });
    h.snapshot.worldGeneration++;
    h.rerender();
    await act(async () => finish({ commandId: "synthetic-one", status: "accepted" }));
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.accepted).toBe(0);
    expect(h.result.current.referralFieldsDisabled).toBe(false);
  });
  it("ignores an ended command lifetime and releases its waiting state", async () => {
    const h = hookSetup();
    await act(async () => {
      h.result.current.saveReferral(
        () => Promise.resolve({ commandId: "synthetic-one", status: "accepted", isCurrent: () => false }),
        642,
      );
    });
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.accepted).toBe(0);
    expect(h.result.current.referralFieldsDisabled).toBe(false);
  });
  it("does not accept a late reply after unmount", async () => {
    const h = hookSetup();
    let finish!: (outcome: WardCommandOutcome) => void;
    act(() => {
      h.result.current.saveReferral(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        642,
      );
    });
    h.unmount();
    await act(async () => finish({ commandId: "synthetic-one", status: "accepted" }));
    expect(h.result.current.accepted).toBe(0);
  });
  it("reports synchronous throws without clearing the draft", () => {
    const h = hookSetup();
    act(() => {
      h.result.current.saveReferral(() => {
        throw Error("Synthetic failure");
      }, 642);
    });
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.referralSaveMessage).toContain("Save is not confirmed");
    expect(h.result.current.accepted).toBe(0);
  });
  it("keeps failed forms guarded after a background read alone returns ready", async () => {
    const h = hookSetup();
    await act(async () => {
      h.result.current.saveReferral(() => Promise.resolve({ commandId: "synthetic-one", status: "failed" }), 642);
    });
    h.snapshot.shared.status = "ready";
    h.snapshot.shared.error = null;
    h.rerender();
    expect(h.result.current.referralFieldsDisabled).toBe(true);
    expect(h.result.current.state.referralOpen).toBe(true);
    expect(h.result.current.accepted).toBe(0);
  });
});

describe("ED accepted raise announcement", () => {
  beforeEach(() => {
    intercepted.select = undefined;
  });
  it("never announces or links a movement from an unrelated board update", () => {
    const push = vi.fn(() => "synthetic-toast");
    const toast = { push, dismiss: vi.fn() };
    const hook = renderHook(
      ({ accepted, unrelatedBoardRevision }) => {
        void unrelatedBoardRevision;
        useEdRaiseAnnouncement({ accepted, toast });
      },
      { initialProps: { accepted: 0, unrelatedBoardRevision: 1 } },
    );
    hook.rerender({ accepted: 0, unrelatedBoardRevision: 2 });
    expect(push).not.toHaveBeenCalled();
    hook.rerender({ accepted: 1, unrelatedBoardRevision: 3 });
    expect(push).toHaveBeenCalledExactlyOnceWith({ tone: "success", title: "Referral raised" });
    hook.rerender({ accepted: 1, unrelatedBoardRevision: 4 });
    expect(push).toHaveBeenCalledTimes(1);
  });
});
