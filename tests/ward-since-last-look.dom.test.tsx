import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import {
  LAST_LOOK_STORAGE_KEY,
  parseLastLookSnapshot,
  takeLastLookSnapshot,
  scopeLastLookWorld,
  type LastLookWorld,
} from "@/components/ward-management/coordinator/since-last-look";
import { useSinceLastLook } from "@/components/ward-management/coordinator/since-last-look-panel";
import {
  SharedAccessContext,
  type SharedAccessApi,
} from "@/components/ward-management/shell/ward-shared-access-context";
import { useWardFlow, WardFlowProvider, WardFlowOverride } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

import { DEFAULT_DUE_SOON_THRESHOLDS } from "@/components/ward-management/ward-clock";
const NOW = NOW_ANCHOR;

function scopedStorageKey(scopeKey: string, userId: string, scenario: string, generation: number) {
  return `${LAST_LOOK_STORAGE_KEY}:${scopeKey}:${encodeURIComponent(userId)}:${encodeURIComponent(scenario)}:${generation}`;
}

function renderCommand() {
  return render(
    <WardFlowProvider initialNow={NOW}>
      <CoordinatorScreen />
    </WardFlowProvider>,
  );
}

function seededSnapshot() {
  const state = seedWardFlowState();
  return takeLastLookSnapshot(
    {
      scenario: state.scenario,
      referrals: state.referrals,
      movements: state.movements,
      units: state.units,
      bedReleases: state.bedReleases,
    },
    NOW,
    DEFAULT_DUE_SOON_THRESHOLDS,
  );
}

describe("the Command screen's 'Since you last looked' list", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("shows nothing on a first look, and remembers the picture once the coordinator leaves", async () => {
    const { unmount } = renderCommand();
    expect(screen.queryByTestId("ward-since-last-look")).toBeNull();
    expect(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY)).toBeNull();
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(parseLastLookSnapshot(window.sessionStorage.getItem(LAST_LOOK_STORAGE_KEY))).toBeDefined();
  });

  it("lists what is new since the remembered picture, and clears when marked as seen", () => {
    const snapshot = seededSnapshot();
    const droppedReferral = snapshot.referralIds[snapshot.referralIds.length - 1]!;
    const unitId = Object.keys(snapshot.readyByUnit).find((id) => snapshot.readyByUnit[id]! > 0)!;
    window.sessionStorage.setItem(
      LAST_LOOK_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        at: NOW - 60,
        referralIds: snapshot.referralIds.filter((id) => id !== droppedReferral),
        readyByUnit: { ...snapshot.readyByUnit, [unitId]: snapshot.readyByUnit[unitId]! - 1 },
      }),
    );

    renderCommand();
    // Owner, 10 Oct 2026: the list opens from the hero's "N new since HH:MM" count, which counts it.
    const toggle = screen.getByRole("button", { name: /new since \d\d:\d\d/, expanded: false });
    expect(toggle).toHaveTextContent("2");
    fireEvent.click(toggle);
    const panel = screen.getByRole("region", { name: "Since you last looked" });
    expect(panel).toHaveTextContent("1 new referral");
    expect(panel).toHaveTextContent("1 bed newly ready");

    fireEvent.click(screen.getByRole("button", { name: "Mark as seen" }));
    expect(screen.queryByRole("region", { name: "Since you last looked" })).toBeNull();
    expect(screen.getByTestId("ward-since-last-look")).toHaveTextContent("Nothing new since you last looked");
    expect(screen.getByRole("button", { name: /new since \d\d:\d\d/, expanded: true })).toHaveTextContent("0");
  });
});

describe("actual last-look provider fences", () => {
  function LookProbe() {
    const world = useWardFlow();
    const { changes } = useSinceLastLook(world, world.now);
    return (
      <>
        <output data-testid="look-basis">{changes.basis ?? "look"}</output>
        <button onClick={() => world.dispatch({ type: "RESET_SCENARIO", role: "demo", now: world.now })}>
          Reset world
        </button>
      </>
    );
  }
  function Look({ userId }: { userId: string }) {
    return (
      <WardFlowProvider initialNow={NOW}>
        <SharedAccessContext.Provider value={{ actorId: userId, api: {} as SharedAccessApi }}>
          <LookProbe />
        </SharedAccessContext.Provider>
      </WardFlowProvider>
    );
  }
  it("starts fresh after a same-scenario reset or account change", () => {
    window.sessionStorage.setItem(
      LAST_LOOK_STORAGE_KEY,
      JSON.stringify({ ...seededSnapshot(), userId: "account-one", at: NOW - 5 }),
    );
    const view = render(<Look userId="account-one" />);
    expect(screen.getByTestId("look-basis").textContent).toBe("look");
    view.rerender(<Look userId="account-two" />);
    expect(screen.getByTestId("look-basis").textContent).toBe("shift");
    view.rerender(<Look userId="account-one" />);
    expect(screen.getByTestId("look-basis").textContent).toBe("look");
    fireEvent.click(screen.getByText("Reset world"));
    expect(screen.getByTestId("look-basis").textContent).toBe("shift");
  });
});

import { SinceLastLookPill } from "@/components/ward-management/since-last-look-pill";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";

function ScopedFixture() {
  const base = useWardFlow();
  const [step, setStep] = useState(0);
  const movement = {
    ...base.movements[0]!,
    acceptedUnitId: base.units[0]!.id,
    stage: step === 0 ? ("accepted_awaiting_bed" as const) : ("arrived" as const),
    closure: step === 0 ? undefined : { at: NOW, outcome: "arrived" as const, reason: "" },
  };
  return (
    <>
      <button onClick={() => setStep(1)}>Synthetic arrival</button>
      <WardFlowOverride value={{ ...base, worldGeneration: 0, movements: [movement], referrals: [], bedReleases: [] }}>
        <SinceLastLookPill scopeKey={`ward:${base.units[0]!.id}`} />
        <SinceLastLookPill scopeKey={`ed:${movement.originEdId}`} />
        <SinceLastLookPill scopeKey="ward:unrelated" />
      </WardFlowOverride>
    </>
  );
}

describe("scoped Ward and ED last-look sheets", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("captures reviewed rows, isolates acknowledgements, and preserves arrivals while open", async () => {
    const state = seedWardFlowState();
    const unitId = state.units[0]!.id;
    const movement = { ...state.movements[0]!, acceptedUnitId: unitId, stage: "placement_requested" as const };
    const world = { ...state, movements: [movement], referrals: [], bedReleases: [] };
    for (const scopeKey of [`ward:${unitId}`, `ed:${movement.originEdId}`]) {
      const picture = takeLastLookSnapshot(
        scopeLastLookWorld(world, scopeKey),
        NOW - 5,
        DEFAULT_DUE_SOON_THRESHOLDS,
        scopeKey,
      );
      window.sessionStorage.setItem(
        scopedStorageKey(scopeKey, "local-demo", state.scenario, 0),
        JSON.stringify(picture),
      );
    }
    render(
      <WardFlowProvider initialNow={NOW}>
        <ScopedFixture />
      </WardFlowProvider>,
    );
    const ward = within(screen.getByTestId(`since-last-look-ward:${unitId}`));
    const ed = within(screen.getByTestId(`since-last-look-ed:${movement.originEdId}`));
    expect(ward.getByRole("button")).toHaveTextContent("1 update");
    expect(ed.getByRole("button")).toHaveTextContent("1 update");
    expect(within(screen.getByTestId("since-last-look-ward:unrelated")).getByRole("button")).toHaveTextContent(
      "0 updates",
    );
    const trigger = ward.getByRole("button");
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger).toHaveTextContent("0 updates");
    expect(ed.getByRole("button")).toHaveTextContent("1 update");
    expect(screen.getByRole("dialog", { name: "Since you last looked" })).toHaveTextContent("1 journey updated");
    fireEvent.click(screen.getByText("Synthetic arrival"));
    expect(trigger).toHaveTextContent("1 update");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 journey updated");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    fireEvent.click(trigger);
    expect(trigger).toHaveTextContent("0 updates");
  });

  it("renders the tracker on both routed Ward and ED headers", () => {
    const state = seedWardFlowState();
    const ward = render(
      <WardFlowProvider initialNow={NOW}>
        <WardScreen unitId={state.units[0]!.id} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId(`since-last-look-ward:${state.units[0]!.id}`)).toBeInTheDocument();
    ward.unmount();
    render(
      <WardFlowProvider initialNow={NOW}>
        <EdScreen edId={state.movements[0]!.originEdId} />
      </WardFlowProvider>,
    );
    expect(screen.getByTestId(`since-last-look-ed:${state.movements[0]!.originEdId}`)).toBeInTheDocument();
  });
});

describe("scoped review persistence", () => {
  beforeEach(() => window.sessionStorage.clear());

  function scopedWorld(at: number): LastLookWorld {
    const state = seedWardFlowState();
    const movement = {
      ...state.movements[0]!,
      acceptedUnitId: state.units[0]!.id,
      openedAt: at,
      acceptedAt: undefined,
      referredAt: undefined,
      leftDepartmentAt: undefined,
      closure: undefined,
      transport: undefined,
      stageChanges: [],
      referralAnswerHistory: [],
      withdrawnReferrals: [],
    };
    return { ...state, worldGeneration: 0, movements: [movement], referrals: [], bedReleases: [] };
  }

  function Probe({ world }: { world: LastLookWorld }) {
    const scopeKey = `ward:${world.units[0]!.id}`;
    const { changes, markSeen } = useSinceLastLook(world, NOW, { scopeKey });
    return <button onClick={markSeen}>{changes.updates?.length ?? 0} unread</button>;
  }

  function fixture(world: LastLookWorld, account = "account-one") {
    return (
      <SharedAccessContext.Provider value={{ actorId: account, api: {} as SharedAccessApi }}>
        <Probe world={world} />
      </SharedAccessContext.Provider>
    );
  }

  it("keeps an initial recent update unread across pagehide and an actual remount until reviewed", async () => {
    const world = scopedWorld(NOW - 5);
    const key = scopedStorageKey(`ward:${world.units[0]!.id}`, "account-one", world.scenario, 0);
    const first = render(fixture(world));
    expect(screen.getByRole("button")).toHaveTextContent("1 unread");
    fireEvent(window, new Event("pagehide"));
    expect(window.sessionStorage.getItem(key)).toBeNull();
    first.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.sessionStorage.getItem(key)).toBeNull();
    const second = render(fixture(world));
    expect(screen.getByRole("button")).toHaveTextContent("1 unread");
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("0 unread");
    const reviewed = window.sessionStorage.getItem(key);
    second.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.sessionStorage.getItem(key)).toBe(reviewed);
    render(fixture(world));
    expect(screen.getByRole("button")).toHaveTextContent("0 unread");
  });

  it("preserves a reviewed baseline when a later update survives leaving and remounting", async () => {
    const world = scopedWorld(NOW - 60);
    const key = scopedStorageKey(`ward:${world.units[0]!.id}`, "account-one", world.scenario, 0);
    const view = render(fixture(world));
    expect(screen.getByRole("button")).toHaveTextContent("0 unread");
    fireEvent.click(screen.getByRole("button"));
    const reviewed = window.sessionStorage.getItem(key);
    const changed = {
      ...world,
      movements: [
        {
          ...world.movements[0]!,
          stage: "arrived" as const,
          closure: { at: NOW, outcome: "arrived" as const, reason: "" },
        },
      ],
    };
    view.rerender(fixture(changed));
    expect(screen.getByRole("button")).toHaveTextContent("1 unread");
    fireEvent(window, new Event("pagehide"));
    view.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(window.sessionStorage.getItem(key)).toBe(reviewed);
    render(fixture(changed));
    expect(screen.getByRole("button")).toHaveTextContent("1 unread");
  });

  it("isolates reviewed baselines by account, scenario and generation and recovers each on return", () => {
    const world = scopedWorld(NOW - 5);
    const view = render(fixture(world));
    fireEvent.click(screen.getByRole("button"));
    for (const [other, account] of [
      [world, "account-two"],
      [{ ...world, scenario: "other-scenario" }, "account-one"],
      [{ ...world, worldGeneration: 1 }, "account-one"],
    ] as const) {
      view.rerender(fixture(other, account));
      expect(screen.getByRole("button")).toHaveTextContent("1 unread");
      fireEvent.click(screen.getByRole("button"));
      view.rerender(fixture(world));
      expect(screen.getByRole("button")).toHaveTextContent("0 unread");
      view.rerender(fixture(other, account));
      expect(screen.getByRole("button")).toHaveTextContent("0 unread");
    }
    expect(Object.keys(window.sessionStorage).filter((key) => key.startsWith(LAST_LOOK_STORAGE_KEY))).toHaveLength(4);
  });

  it("names yesterday in both the header and review description when its window crosses midnight", () => {
    render(
      <WardFlowProvider initialNow={1445}>
        <ScopedFixture />
      </WardFlowProvider>,
    );
    const state = seedWardFlowState();
    const trigger = within(screen.getByTestId(`since-last-look-ward:${state.units[0]!.id}`)).getByRole("button");
    expect(trigger).toHaveTextContent("since 23:50 yesterday");
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription("Updates since 23:50 yesterday · 15-minute window");
  });
});
