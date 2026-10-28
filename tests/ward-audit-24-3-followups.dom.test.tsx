import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import type { WardCommandDispatch, WardCommandOutcome } from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";

const route = vi.hoisted(() => ({ pathname: "/ward-flow/referrals" }));
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const fake = vi.hoisted(() => ({ connection: null as WardSharedConnection | null }));
vi.mock("@/components/ward-management/ward-shared-access", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-shared-access")>();
  return { ...actual, useWardShared: (enabled: boolean) => ({ ...fake.connection!, enabled }) };
});

import { ToastProvider } from "@/components/wf/toast-provider";
import { DischargeCareJourney } from "@/components/ward-management/discharges/discharge-care-journey";
import { DischargeFollowUp } from "@/components/ward-management/discharges/discharge-follow-up";
import { SeclusionScreen } from "@/components/ward-management/restrictive-practice/seclusion-screen";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { useWardFlow, WardFlowOverride, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * Audit 24-3 follow-ups (24 Oct 2026): SV-5 controls say a refusal at the control, and SV-7 a Retry that saves replaces the bed drawer's
 * "not confirmed" message. Synthetic seed data only.
 */

type Mode = "failed" | "refused" | "pending" | "accepted";
const NOT_SAVED: Mode[] = ["failed", "refused", "pending"];
const FAILED_SAYS = "Save is not confirmed. Press Retry when you are back online. It will not be saved twice.";
const REFUSED_SAYS = "This record changed while you were looking. Your action was not applied.";
const SAYS: Record<Mode, RegExp | null> = {
  failed: /Save is not confirmed\. Press Retry when you are back online/u,
  refused: /Not recorded: This record changed while you were looking/u,
  pending: null,
  accepted: null,
};

function outcomeFor(mode: Mode): Promise<WardCommandOutcome> {
  if (mode === "pending") return new Promise<WardCommandOutcome>(() => {});
  if (mode === "accepted") return Promise.resolve({ commandId: "c-1", status: "accepted" });
  return Promise.resolve(
    mode === "failed"
      ? { commandId: "c-1", status: "failed", message: FAILED_SAYS }
      : { commandId: "c-1", status: "refused", message: REFUSED_SAYS },
  );
}

function sharedConnection(dispatch: WardSharedConnection["dispatch"]): WardSharedConnection {
  const state = JSON.parse(JSON.stringify(seedWardFlowStateAt(0)));
  return {
    enabled: true,
    signedIn: true,
    status: "ready",
    error: null,
    eventLog: [],
    receivedAt: Date.now(),
    snapshot: {
      accessContext: "a".repeat(64),
      dataMode: "prototype",
      revision: 1,
      now: 642,
      payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
    },
    dispatch,
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  } as WardSharedConnection;
}

/** The provider's own engine, except that `type` answers as `answer` says. */
function Answering({
  type,
  answer,
  calls,
  children,
}: {
  type: WardFlowEvent["type"];
  answer: (commit: () => ReturnType<WardCommandDispatch>) => ReturnType<WardCommandDispatch>;
  calls: WardFlowEvent[];
  children: ReactNode;
}) {
  const flow = useWardFlow();
  const dispatch: WardCommandDispatch = (event) => {
    if (event.type !== type) return flow.dispatch(event);
    calls.push(event);
    return answer(() => flow.dispatch(event));
  };
  return <WardFlowOverride value={{ ...flow, dispatch }}>{children}</WardFlowOverride>;
}
const byMode = (mode: Mode) => (commit: () => ReturnType<WardCommandDispatch>) =>
  mode === "accepted" ? commit() : outcomeFor(mode);

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

function expectSaid(text: string | null, mode: Mode) {
  const said = SAYS[mode];
  if (said) expect(text ?? "").toMatch(said);
  else expect(text ?? "").not.toMatch(/Not recorded|not confirmed/u);
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  route.pathname = "/ward-flow/referrals";
});

describe("SV-5 seclusion room status (shared mode)", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true"));

  it.each([...NOT_SAVED, "accepted" as const])("Mark room, %s: the reason is said beside the buttons", async (mode) => {
    const dispatch = vi.fn(() => outcomeFor(mode));
    fake.connection = sharedConnection(dispatch);
    render(
      <WardFlowProvider>
        <SeclusionScreen />
      </WardFlowProvider>,
    );
    const card = screen.getAllByTestId("seclusion-ward-card")[0]!;
    const button = [
      within(card).getByTestId("seclusion-room-available"),
      within(card).getByTestId("seclusion-room-out-of-service"),
    ].find((candidate) => candidate.getAttribute("aria-disabled") !== "true")!;
    await press(button);
    // P090: the room status asks first; confirm with the dialog's main button.
    await press(within(screen.getByRole("dialog")).getByRole("button", { name: button.textContent! }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expectSaid(within(card).queryByTestId("seclusion-room-failure")?.textContent ?? null, mode);
  });
});

describe("SV-5 discharge follow-up and care journey", () => {
  function Workspace({ part }: { part: "follow-up" | "care" }) {
    const { admissions, readDischargeRecord, openDischargeRecord } = useWardFlow();
    const [handle, setHandle] = useState<ReturnType<typeof openDischargeRecord> | null>(null);
    const admission = admissions.find((row) => row.state === "occupied" && row.patientId)!;
    const actor = { role: "coordinator" } as const;
    const read = readDischargeRecord(actor, admission.id, handle);
    return (
      <>
        <button onClick={() => setHandle(openDischargeRecord(actor, admission.id))}>Open record</button>
        {read.status === "allowed" &&
          (part === "care" ? (
            <DischargeCareJourney record={read.value} actor={actor} />
          ) : (
            <DischargeFollowUp record={read.value} actor={actor} />
          ))}
      </>
    );
  }

  it.each([...NOT_SAVED, "accepted" as const])("Record follow-up status, %s", async (mode) => {
    const calls: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Answering type="RECORD_ADMISSION_FOLLOW_UP" answer={byMode(mode)} calls={calls}>
          <Workspace part="follow-up" />
        </Answering>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open record" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Arrangement status" }), { target: { value: "arranged" } });
    await press(screen.getByRole("button", { name: "Record follow-up status" }));
    expect(calls).toHaveLength(1);
    const section = screen.getByRole("region", { name: "Follow-up arrangement" });
    expectSaid(within(section).queryByRole("alert")?.textContent ?? null, mode);
    if (mode === "accepted")
      expect(screen.getByTestId("ward-discharge-follow-up-status")).toHaveTextContent(/^Arranged/u);
  });

  it.each([...NOT_SAVED, "accepted" as const])("Record a care journey step, %s", async (mode) => {
    const calls: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Answering type="RECORD_ADMISSION_CARE" answer={byMode(mode)} calls={calls}>
          <Workspace part="care" />
        </Answering>
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open record" }));
    const section = screen.getByRole("region", { name: "Care journey" });
    // The first form whose every choice can be filled in from its own options.
    const form = Array.from(section.querySelectorAll("form")).find(
      (candidate) => candidate.querySelectorAll("input").length === 0,
    )!;
    for (const select of Array.from(form.querySelectorAll("select")))
      fireEvent.change(select, { target: { value: select.options[1]!.value } });
    await press(within(form).getByRole("button"));
    expect(calls).toHaveLength(1);
    expectSaid(within(section).queryByRole("alert")?.textContent ?? null, mode);
  });
});

describe("SV-5 confirm bed release and SV-7 Retry on the ward screen", () => {
  function renderWard(type: WardFlowEvent["type"], answer: Parameters<typeof Answering>[0]["answer"]) {
    route.pathname = "/ward-flow/ward/scgh-adult-open";
    const calls: WardFlowEvent[] = [];
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Answering type={type} answer={answer} calls={calls}>
          <ToastProvider>
            <WardScreen unitId="scgh-adult-open" />
          </ToastProvider>
        </Answering>
      </WardFlowProvider>,
    );
    return calls;
  }
  const wardSays = () => document.querySelector("[role='status'][aria-live='polite'] span")?.textContent ?? "";

  function releaseConfirm(): HTMLElement {
    for (const tab of screen.getAllByRole("tab")) {
      fireEvent.click(tab);
      const found = document.querySelector<HTMLElement>("[data-testid^='ward-today-release-confirm-']");
      if (found) return found;
    }
    throw new Error("The synthetic ward has no expected bed release to confirm");
  }

  it.each(["failed", "refused", "accepted"] as const)("Confirm bed release, %s", async (mode) => {
    const calls = renderWard("CONFIRM_BED_RELEASE", byMode(mode));
    await press(releaseConfirm());
    await act(async () => {
      await Promise.resolve();
    });
    expect(calls).toHaveLength(1);
    expectSaid(wardSays(), mode);
  });

  it("replaces the drawer's not confirmed message once Retry saves", async () => {
    let confirm!: () => void;
    const calls = renderWard("RECORD_OBSERVATION_LEVEL", (commit) => {
      const confirmation = new Promise<WardCommandOutcome>((resolve) => {
        confirm = () => void Promise.resolve(commit()).then((outcome) => resolve(outcome!));
      });
      return Promise.resolve({ commandId: "c-1", status: "failed", message: FAILED_SAYS, confirmation });
    });
    fireEvent.click(screen.getByTestId("ward-open-bed-board"));
    const occupied = Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-board-bed-']")).find(
      (bed) => !/free|closed|pulled/.test(bed.getAttribute("aria-label") ?? ""),
    )!;
    fireEvent.click(occupied);
    fireEvent.click(await screen.findByTestId("ward-observation-change"));
    fireEvent.change(screen.getByTestId("ward-observation-level"), { target: { value: "intermittent" } });
    fireEvent.change(screen.getByTestId("ward-observation-interval"), { target: { value: "30" } });
    await press(screen.getByTestId("ward-observation-save"));
    expect(calls).toHaveLength(1);
    expect(wardSays()).toBe(FAILED_SAYS);
    await act(async () => {
      confirm();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(wardSays()).toMatch(/^Observation level recorded/u);
  });
});
