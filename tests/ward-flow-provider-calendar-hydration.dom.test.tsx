import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

import WardFlowMockupLayout from "@/app/mockups/ward-flow/layout";
import { formatSheetMoment, demoDayZero } from "@/components/ward-management/ward-clock";
import {
  WARD_FLOW_DEMO_STORAGE_KEY,
  WardFlowProvider,
  useWardFlow,
} from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import * as sharedAccess from "@/components/ward-management/ward-shared-access";

const BEFORE_MIDNIGHT = "2026-10-15T15:59:59Z";
const AFTER_MIDNIGHT = "2026-10-15T16:00:01Z";

// The same calendar-sensitive expression rendered by DischargeBoard's "As of" caption.
function CalendarProbe() {
  const { now, dayZero, dispatch } = useWardFlow();
  return (
    <>
      <p data-testid="calendar-caption">As of {formatSheetMoment(now, dayZero)}</p>
      <output data-testid="calendar-origin">{dayZero.toISOString()}</output>
      <output data-testid="calendar-clock">{now}</output>
      <input aria-label="Local draft" defaultValue="" />
      <button type="button" onClick={() => dispatch({ type: "ADVANCE_CLOCK", role: "demo", now, minutes: 20 })}>
        Advance demo
      </button>
    </>
  );
}

// Read the actual server layout's bootstrap props; children are replaced with the small date probe
// so this regression hydrates the real provider without duplicating the whole navigation shell.
async function serverTree() {
  const layout = await WardFlowMockupLayout({ children: null });
  return (
    <WardFlowProvider {...layout.props.children.props}>
      <CalendarProbe />
    </WardFlowProvider>
  );
}

let root: Root | undefined;
let mount: HTMLDivElement | undefined;
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "false");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(BEFORE_MIDNIGHT));
  window.sessionStorage.clear();
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  mount?.remove();
  mount = undefined;
  cleanup();
  window.sessionStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

async function hydrateAcrossMidnight() {
  const tree = await serverTree();
  mount = document.createElement("div");
  mount.innerHTML = renderToString(tree);
  document.body.appendChild(mount);
  expect(mount.textContent).toContain("Thu, 15 Oct");
  const caption = mount.querySelector('[data-testid="calendar-caption"]');
  const draft = mount.querySelector("input");
  if (!draft) throw new Error("Expected the local draft input in the server markup");
  draft.value = "unsubmitted";
  vi.setSystemTime(new Date(AFTER_MIDNIGHT));
  const recoverable: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(mount!, tree, { onRecoverableError: (error) => recoverable.push(error) });
  });
  return { caption, recoverable, draft };
}

describe("provider calendar origin across server/client midnight", () => {
  it("hydrates the actual layout bootstrap without replacing the date node, then adopts the client day", async () => {
    const { caption, recoverable, draft } = await hydrateAcrossMidnight();
    expect(recoverable).toEqual([]);
    expect(mount!.querySelector('[data-testid="calendar-caption"]')).toBe(caption);
    expect(screen.getByRole("textbox", { name: "Local draft" })).toBe(draft);
    expect(draft.value).toBe("unsubmitted");
    expect(screen.getByTestId("calendar-caption")).toHaveTextContent("Fri, 16 Oct");
    expect(screen.getByTestId("calendar-origin")).toHaveTextContent("2026-10-15T16:00:00.000Z");
  });

  it("keeps an already-open session's day fixed when the wall clock later crosses midnight", async () => {
    const initialDayZero = demoDayZero(new Date(BEFORE_MIDNIGHT)).getTime();
    const local = render(
      <WardFlowProvider initialDayZero={initialDayZero}>
        <CalendarProbe />
      </WardFlowProvider>,
    );
    vi.setSystemTime(new Date(AFTER_MIDNIGHT));
    local.rerender(
      <WardFlowProvider initialDayZero={initialDayZero}>
        <CalendarProbe />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId("calendar-origin")).toHaveTextContent("2026-10-14T16:00:00.000Z");
    expect(screen.getByTestId("calendar-clock")).toHaveTextContent(String(NOW_ANCHOR + 1));
  });

  it("still restores a changed local save on the same Perth day with the server bootstrap", async () => {
    vi.setSystemTime(new Date("2026-10-15T14:00:00Z"));
    const local = render(await serverTree());
    fireEvent.click(screen.getByRole("button", { name: "Advance demo" }));
    local.unmount();
    vi.setSystemTime(new Date("2026-10-15T14:10:00Z"));
    render(await serverTree());
    expect(screen.getByTestId("calendar-clock")).toHaveTextContent(String(NOW_ANCHOR + 30));
    expect(screen.getByTestId("calendar-origin")).toHaveTextContent("2026-10-14T16:00:00.000Z");
  });

  it("keeps a confirmed shared snapshot's calendar authoritative over the local bootstrap", async () => {
    vi.spyOn(sharedAccess, "useWardShared").mockReturnValue({
      enabled: true,
      signedIn: true,
      status: "ready",
      error: null,
      eventLog: [],
      receivedAt: Date.now(),
      snapshot: {
        dataMode: "prototype",
        revision: 1,
        now: NOW_ANCHOR,
        payload: {
          version: 1,
          state: seedWardFlowStateAt(0),
          dayZero: "2026-10-07T00:00:00.000Z",
          startedAt: "2026-10-07T10:00:00.000Z",
        },
      },
      dispatch: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
    });
    render(await serverTree());
    expect(screen.getByTestId("calendar-origin")).toHaveTextContent("2026-10-07T00:00:00.000Z");
    expect(window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY)).toBeNull();
  });

  it("expires yesterday's local save even when SSR began before midnight", async () => {
    const local = render(
      <WardFlowProvider>
        <CalendarProbe />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Advance demo" }));
    const saved = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    expect(saved).toContain('"clockOffsetMinutes":20');
    local.unmount();

    const { recoverable } = await hydrateAcrossMidnight();
    expect(recoverable).toEqual([]);
    expect(screen.getByTestId("calendar-clock")).toHaveTextContent(String(NOW_ANCHOR));
    const fresh = window.sessionStorage.getItem(WARD_FLOW_DEMO_STORAGE_KEY);
    expect(fresh).toContain(`"dayZero":${demoDayZero(new Date(AFTER_MIDNIGHT)).getTime()}`);
    expect(fresh).toContain('"clockOffsetMinutes":0');
  });
});
