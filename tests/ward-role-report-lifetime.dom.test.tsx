import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  WardPartialViewProvider,
  WardLocalPartialViewProvider,
  useWardPartialView,
  useWardPartialDisplay,
} from "@/components/ward-management/ward-partial-view";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { bindWardPartialView } from "@/components/ward-management/ward-partial-view-contract";
import { WardFlowProvider, WardFlowOverride, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { setWardAccess, startAccessPreview } from "@/components/ward-management/shell/ward-access-store";
import type { ReactNode } from "react";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { STATEWIDE_COORDINATOR } from "@/components/ward-management/ward-role-access";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";
import { scopeWardFlowState } from "@/components/ward-management/ward-access-state";
import { projectWardPartialView } from "@/components/ward-management/ward-partial-view-projector";
import { isValidSharedWardFlowState } from "@/components/ward-management/ward-shared-state-validation";
import { useSenderPresentation } from "@/components/ward-management/ward-sender-presentation";

const CONTEXT_A = "a".repeat(64);
const CONTEXT_B = "b".repeat(64);

function scopedCollectionFixture(state: "queued" | "declined" = "queued") {
  // Shared transport serialises explicit undefined values before validating the saved world.
  const serialised: unknown = JSON.parse(JSON.stringify(seedWardFlowState()));
  if (!isValidSharedWardFlowState(serialised)) throw new Error("Synthetic shared seed fixture must be valid");
  const full = serialised;
  const origin = full.units[0]!;
  const foreign = full.units.find((unit) => unit.id !== origin.id)!;
  const access = { role: "ward" as const, scope: { kind: "ward" as const, unitIds: [origin.id] } };
  const row = {
    ...full.referrals[0]!,
    id: "RF-SYNTHETIC-OLD-COLLECTION",
    source: "psychiatric_ward" as const,
    originUnitId: origin.id,
    originSiteCode: origin.siteCode,
    raisedAt: NOW_ANCHOR - CLINICAL_VALUES.wardHandoffWindow.value * 1440 - 1,
    destinations: [
      {
        destination: {
          kind: "psychiatric_ward" as const,
          unitId: foreign.id,
          sex: "Female" as const,
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
        state,
        ...(state === "declined"
          ? { decidedAt: NOW_ANCHOR, declineReason: "belongs_to_another_service" as const }
          : {}),
      },
    ],
  };
  full.referrals = [...full.referrals, row];
  expect(isValidSharedWardFlowState(structuredClone(full))).toBe(true);
  const options = { now: NOW_ANCHOR, places: wardPlaceLookup(full.units) };
  const scoped = scopeWardFlowState(full, access, options).state;
  expect(isValidSharedWardFlowState(structuredClone(scoped))).toBe(true);
  const view = projectWardPartialView(full, access, options);
  const connection = sharedDisplayConnection();
  connection.access = access;
  connection.snapshot = {
    ...connection.snapshot!,
    payload: { ...connection.snapshot!.payload, state: scoped },
    partialView: bindWardPartialView(
      { revision: 9, accessContext: CONTEXT_A, view },
      { revision: 9, accessContext: CONTEXT_A },
    )!,
  };
  return { access, foreign, connection, row };
}

/** Controlled transport input only. Actual scoped-state/projector validators and scope/provider
 * components run here; this does not establish account authentication or command behaviour. */
function AdoptedCollectionSource({
  connection,
  now,
  children,
}: {
  connection: WardSharedConnection;
  now: number;
  children: ReactNode;
}) {
  const context = useWardFlow();
  const state = connection.snapshot!.payload.state;
  return (
    <WardFlowOverride
      value={{
        ...context,
        referrals: state.referrals,
        patients: state.patients,
        movements: state.movements,
        admissions: state.admissions,
        units: state.units,
        notices: state.notices,
        now,
        shared: { enabled: connection.enabled, status: connection.status, error: connection.error },
      }}
    >
      {children}
    </WardFlowOverride>
  );
}

function CollectionProbe() {
  const context = useWardFlow();
  const display = useWardPartialDisplay();
  const bound = useWardPartialView();
  const id = "RF-SYNTHETIC-OLD-COLLECTION";
  return (
    <p role="status" aria-label="Sender collection">
      Rows {Number(context.referrals.some((row) => row.id === id))}; display{" "}
      {Number(display?.referrals.some((row) => row.id === id) ?? false)}; Bound{" "}
      {Number(bound?.view.referrals.some((row) => row.id === id) ?? false)}
    </p>
  );
}

function SenderRequirementProbe() {
  const presentation = useSenderPresentation();
  const summary = presentation.referralFor({ id: "RF-SYNTHETIC-OLD-COLLECTION" });
  return (
    <p role="status" aria-label="Sender requirement">
      Required {String(presentation.required)}; outcome{" "}
      {summary === null ? "unavailable" : summary === undefined ? "record" : "sender"}
    </p>
  );
}

function MovementCollectionProbe({ id, foreign }: { id: string; foreign: string }) {
  const context = useWardFlow();
  const display = useWardPartialDisplay();
  const bound = useWardPartialView();
  const movement = context.movements.find((row) => row.id === id);
  return (
    <p role="status" aria-label="Sender movement collection">
      Rows {Number(movement !== undefined)}; foreign acceptance {Number(movement?.acceptedUnitId === foreign)}; display{" "}
      {Number(display?.movements.some((row) => row.id === id) ?? false)}; Bound{" "}
      {Number(bound?.view.movements.some((row) => row.id === id) ?? false)}
    </p>
  );
}

function sharedCollectionTree(
  connection: WardSharedConnection,
  now = NOW_ANCHOR,
  roleStoreSource?: WardAccess,
  children: ReactNode = <CollectionProbe />,
) {
  const scope = <WardAccessScope>{children}</WardAccessScope>;
  return (
    <WardFlowProvider initialNow={now}>
      <AdoptedCollectionSource connection={connection} now={now}>
        {roleStoreSource ? (
          <WardPartialViewProvider
            response={connection.snapshot?.partialView}
            currentRevision={connection.snapshot?.revision ?? null}
            currentAccessContext={connection.snapshot?.accessContext ?? null}
            currentNow={connection.snapshot?.now}
            readSource={{ access: roleStoreSource, snapshot: connection.snapshot! }}
          >
            {scope}
          </WardPartialViewProvider>
        ) : (
          <WardSharedAccess connection={connection}>{scope}</WardSharedAccess>
        )}
      </AdoptedCollectionSource>
    </WardFlowProvider>
  );
}

describe("shared sender collection integration", () => {
  it("keeps the actual shared sender requirement while a stale coordinator role is denied its source", () => {
    const fixture = scopedCollectionFixture();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(STATEWIDE_COORDINATOR);
    });
    const mounted = render(
      sharedCollectionTree(fixture.connection, NOW_ANCHOR, fixture.access, <SenderRequirementProbe />),
    );
    try {
      expect(screen.getByRole("status", { name: "Sender requirement" })).toHaveTextContent(
        "Required true; outcome unavailable",
      );
      act(() => setWardAccess(fixture.access));
      expect(screen.getByRole("status", { name: "Sender requirement" })).toHaveTextContent(
        "Required true; outcome sender",
      );
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });
  it("expires both sender movement hints while the receiving row survives and loses its foreign acceptance", () => {
    const seed: unknown = JSON.parse(JSON.stringify(seedWardFlowState()));
    if (!isValidSharedWardFlowState(seed)) throw new Error("Synthetic shared seed must pass its actual validator");
    const origin = seed.units[0]!;
    const foreign = seed.units.find((unit) => unit.id !== origin.id)!;
    const template = seed.admissions.find((row) => row.unitId === origin.id && row.patientId);
    if (!template?.patientId) throw new Error("Synthetic source stay needs a genuine joined patient");
    const leftAt = NOW_ANCHOR - CLINICAL_VALUES.wardHandoffWindow.value * 1440;
    const stay = {
      ...template,
      id: "AD-SYNTHETIC-MOVEMENT-SOURCE",
      state: "departed" as const,
      pulledAt: leftAt - 20,
      arrivedAt: leftAt - 10,
      leftAt,
      movementId: null,
      referralId: null,
    };
    delete stay.bedNumber;
    const movement = {
      ...seed.movements[0]!,
      id: "WF-SYNTHETIC-MOVEMENT-COLLECTION" as const,
      patientId: template.patientId,
      sourceAdmissionId: stay.id,
      stage: "accepted_awaiting_bed" as const,
      acceptedUnitId: foreign.id,
      referredUnitIds: [origin.id],
      declines: [],
      withdrawnReferrals: [],
      unwinds: [],
      overrides: [],
      stageChanges: [],
    };
    delete movement.referralId;
    delete movement.closure;
    delete movement.transport;
    delete movement.allocatedBed;
    delete movement.heldBedNumber;
    seed.admissions = [...seed.admissions, stay];
    seed.movements = [...seed.movements, movement];
    const full: unknown = JSON.parse(JSON.stringify(seed));
    if (!isValidSharedWardFlowState(full))
      throw new Error("Augmented full fixture must pass the actual shared validator");
    const access = { role: "ward" as const, scope: { kind: "ward" as const, unitIds: [origin.id] } };
    const options = { now: NOW_ANCHOR, places: wardPlaceLookup(full.units) };
    const scoped = scopeWardFlowState(full, access, options).state;
    expect(isValidSharedWardFlowState(structuredClone(scoped))).toBe(true);
    expect(scoped.movements.find((row) => row.id === movement.id)?.acceptedUnitId).toBe(foreign.id);
    const afterScope = scopeWardFlowState(scoped, access, { ...options, now: NOW_ANCHOR + 1 }).state;
    expect(isValidSharedWardFlowState(structuredClone(afterScope))).toBe(true);
    expect(afterScope.movements.some((row) => row.id === movement.id)).toBe(true);
    expect(afterScope.movements.find((row) => row.id === movement.id)?.acceptedUnitId).toBeUndefined();
    const connection = sharedDisplayConnection();
    connection.access = access;
    connection.snapshot = {
      ...connection.snapshot!,
      payload: { ...connection.snapshot!.payload, state: scoped },
      partialView: bindWardPartialView(
        { revision: 9, accessContext: CONTEXT_A, view: projectWardPartialView(full, access, options) },
        { revision: 9, accessContext: CONTEXT_A },
      )!,
    };
    expect(connection.snapshot.partialView?.view.movements.find((row) => row.id === movement.id)).toMatchObject({
      kind: "sender",
      visibleUntil: NOW_ANCHOR,
    });
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(access);
    });
    const probe = <MovementCollectionProbe id={movement.id} foreign={foreign.id} />;
    const mounted = render(sharedCollectionTree(connection, NOW_ANCHOR, undefined, probe));
    try {
      expect(screen.getByRole("status", { name: "Sender movement collection" })).toHaveTextContent(
        "Rows 1; foreign acceptance 1; display 1; Bound 1",
      );
      mounted.rerender(sharedCollectionTree(connection, NOW_ANCHOR + 1, undefined, probe));
      expect(screen.getByRole("status", { name: "Sender movement collection" })).toHaveTextContent(
        "Rows 1; foreign acceptance 0; display 0; Bound 0",
      );
      expect(connection.snapshot.payload.state.movements.find((row) => row.id === movement.id)?.acceptedUnitId).toBe(
        foreign.id,
      );
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });

  it("retains the server-supplied old open referral through the actual second scope pass", () => {
    const fixture = scopedCollectionFixture();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(fixture.access);
    });
    const mounted = render(sharedCollectionTree(fixture.connection));
    try {
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 1; display 1; Bound 1");
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });

  it("expires sender rows and hints on the UI clock even before another cheap poll", () => {
    const fixture = scopedCollectionFixture("declined");
    const deadline = NOW_ANCHOR + CLINICAL_VALUES.wardHandoffWindow.value * 1440;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(fixture.access);
    });
    const mounted = render(sharedCollectionTree(fixture.connection, deadline));
    try {
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 1; display 1; Bound 1");
      mounted.rerender(sharedCollectionTree(fixture.connection, deadline + 1));
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 0; display 0; Bound 0");
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });

  it("requires the current shared role and adopted source before exposing its sender collection", () => {
    const fixture = scopedCollectionFixture();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [fixture.foreign.id] } });
    });
    // Isolate the first render before the genuine shared host's passive role-store sync.
    const mounted = render(sharedCollectionTree(fixture.connection, NOW_ANCHOR, fixture.access));
    try {
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 0; display 0; Bound 0");
      act(() => setWardAccess(fixture.access));
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 1; display 1; Bound 1");
      mounted.rerender(sharedCollectionTree({ ...fixture.connection, reportSnapshotReady: false }));
      expect(screen.getByRole("status", { name: "Sender collection" })).toHaveTextContent("Rows 0; display 0; Bound 0");
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });
});

function DisplayProbe() {
  const display = useWardPartialDisplay();
  const bound = useWardPartialView();
  return (
    <p role="status" aria-label="Sender display">
      {display
        ? `${display.referrals.length} referral summaries (${bound ? "shared" : "local/preview"})`
        : "Display unavailable"}
    </p>
  );
}

function TimedSenderProbe() {
  const bound = useWardPartialView();
  const display = useWardPartialDisplay();
  return (
    <p role="status" aria-label="Timed sender">
      Bound {bound?.view.referrals.length ?? "unavailable"}, display {display?.referrals.length ?? "unavailable"}
    </p>
  );
}

/** Transport double only: the data/actions remain the actual full synthetic provider value. */
function AdoptedSharedWorld({ children }: { children: ReactNode }) {
  const context = useWardFlow();
  return (
    <WardFlowOverride value={{ ...context, shared: { enabled: true, status: "ready", error: null } }}>
      {children}
    </WardFlowOverride>
  );
}

function sharedDisplayConnection(): WardSharedConnection {
  return {
    enabled: true,
    signedIn: true,
    reportSnapshotReady: true,
    status: "ready",
    receivedAt: 100,
    error: null,
    actorId: "synthetic-current-actor",
    workingAs: "00000000-0000-4000-8000-000000000001",
    access: { role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } },
    snapshot: {
      revision: 9,
      now: NOW_ANCHOR,
      dataMode: "prototype",
      accessContext: CONTEXT_A,
      partialView: bindWardPartialView(senderResponse(), { revision: 9, accessContext: CONTEXT_A })!,
      payload: {
        version: 1,
        state: seedWardFlowState(),
        dayZero: "2026-10-24T00:00:00.000Z",
        startedAt: "2026-10-24T00:00:00.000Z",
      },
    },
    signIn: () => {},
    signOut: () => {},
    retry: () => {},
    dispatch: async () => ({ commandId: "synthetic-test", status: "cancelled" }),
    pushApi: {
      pushKey: async () => ({ enabled: false }),
      pushStatus: async () => false,
      pushSubscribe: async () => "role",
      pushUnsubscribe: async () => false,
    },
  };
}

describe("sender display hosts", () => {
  it("uses the actual cheap-poll world clock to remove expired sender hints from both hooks", () => {
    const deadline = NOW_ANCHOR + 1;
    const response = senderResponse();
    const finite = {
      ...response,
      view: { ...response.view, referrals: [{ ...response.view.referrals[0], visibleUntil: deadline }] },
    };
    const connection = sharedDisplayConnection();
    const original = bindWardPartialView(finite, { revision: 9, accessContext: CONTEXT_A })!;
    connection.snapshot!.partialView = original;
    const tree = (now: number) => (
      <WardSharedAccess connection={{ ...connection, snapshot: { ...connection.snapshot!, now } }}>
        <TimedSenderProbe />
      </WardSharedAccess>
    );
    const mounted = render(tree(NOW_ANCHOR));
    try {
      expect(screen.getByRole("status", { name: "Timed sender" })).toHaveTextContent("Bound 1, display 1");
      mounted.rerender(tree(deadline));
      expect(screen.getByRole("status", { name: "Timed sender" })).toHaveTextContent("Bound 1, display 1");
      mounted.rerender(tree(deadline + 1));
      expect(screen.getByRole("status", { name: "Timed sender" })).toHaveTextContent("Bound 0, display 0");
      expect(original.view.referrals).toHaveLength(1);
      expect(connection.snapshot!.revision).toBe(9);
    } finally {
      mounted.unmount();
    }
  });

  it.each([undefined, null, NaN, Infinity])(
    "hides a finite sender hint without a usable current world clock: %s",
    (currentNow) => {
      const response = senderResponse();
      const finite = {
        ...response,
        view: { ...response.view, referrals: [{ ...response.view.referrals[0], visibleUntil: NOW_ANCHOR + 1 }] },
      };
      render(
        <WardPartialViewProvider
          response={finite}
          currentRevision={9}
          currentAccessContext={CONTEXT_A}
          currentNow={currentNow}
        >
          <TimedSenderProbe />
        </WardPartialViewProvider>,
      );
      expect(screen.getByRole("status", { name: "Timed sender" })).toHaveTextContent("Bound 0, display 0");
    },
  );

  it("derives a local display from the actual full provider before the ward scope masks it", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [seedWardFlowState().units[0]!.id] } });
    });
    const mounted = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardAccessScope>
          <DisplayProbe />
        </WardAccessScope>
      </WardFlowProvider>,
    );
    try {
      await waitFor(() =>
        expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent(
          /referral summaries \(local\/preview\)/,
        ),
      );
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });

  it("keeps local/preview display data separate from the authenticated Bound hook", () => {
    render(
      <WardLocalPartialViewProvider display={{ source: "local", view: senderResponse().view }}>
        <DisplayProbe />
      </WardLocalPartialViewProvider>,
    );
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent(
      "1 referral summaries (local/preview)",
    );
  });

  it("lets shared-unavailable shadow local data in either nesting order", () => {
    const local = { source: "local" as const, view: senderResponse().view };
    const { rerender } = render(
      <WardLocalPartialViewProvider display={local}>
        <WardPartialViewProvider response={null} currentRevision={9} currentAccessContext={CONTEXT_A}>
          <DisplayProbe />
        </WardPartialViewProvider>
      </WardLocalPartialViewProvider>,
    );
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
    rerender(
      <WardPartialViewProvider response={null} currentRevision={9} currentAccessContext={CONTEXT_A}>
        <WardLocalPartialViewProvider display={local}>
          <DisplayProbe />
        </WardLocalPartialViewProvider>
      </WardPartialViewProvider>,
    );
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
  });

  it("requires current host permission for a coordinator preview and removes it on the same render", () => {
    const preview = { source: "coordinator-preview" as const, view: senderResponse().view };
    const coordinator = sharedDisplayConnection();
    coordinator.access = STATEWIDE_COORDINATOR;
    delete coordinator.snapshot!.partialView;
    const tree = (allowed: boolean, response: unknown = undefined) => (
      <WardPartialViewProvider
        response={response}
        currentRevision={9}
        currentAccessContext={CONTEXT_A}
        previewAllowed={allowed}
        readSource={allowed ? { access: STATEWIDE_COORDINATOR, snapshot: coordinator.snapshot! } : null}
      >
        <WardLocalPartialViewProvider display={preview}>
          <DisplayProbe />
        </WardLocalPartialViewProvider>
      </WardPartialViewProvider>
    );
    const { rerender } = render(tree(true));
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent(
      "1 referral summaries (local/preview)",
    );
    rerender(tree(false));
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
    rerender(tree(true, null));
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
    rerender(tree(true, senderResponse()));
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
  });

  it("mounts the genuine adopted shared sibling around the application's children", () => {
    render(
      <WardSharedAccess connection={sharedDisplayConnection()}>
        <DisplayProbe />
      </WardSharedAccess>,
    );
    expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("1 referral summaries (shared)");
  });

  it("removes an existing shared display on the same render when its current source is unavailable or mismatched", () => {
    const tree = (connection: WardSharedConnection) => (
      <WardSharedAccess connection={connection}>
        <DisplayProbe />
      </WardSharedAccess>
    );
    const mounted = render(tree(sharedDisplayConnection()));
    try {
      const changes: ((connection: WardSharedConnection) => void)[] = [
        (connection) => {
          connection.reportSnapshotReady = false;
        },
        (connection) => {
          connection.actorId = null;
        },
        (connection) => {
          connection.status = "unavailable";
        },
        (connection) => {
          connection.snapshot!.accessContext = CONTEXT_B;
        },
        (connection) => {
          connection.snapshot!.revision = 10;
        },
        (connection) => {
          delete connection.snapshot!.partialView;
        },
        (connection) => {
          connection.sessionEndsAt = Date.now() - 1;
        },
        (connection) => {
          connection.sessionEndsAt = NaN;
        },
      ];
      for (const change of changes) {
        const connection = sharedDisplayConnection();
        change(connection);
        mounted.rerender(tree(connection));
        expect(screen.getByText("Display unavailable")).toBeInTheDocument();
        mounted.rerender(tree(sharedDisplayConnection()));
        expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent(
          "1 referral summaries (shared)",
        );
      }
      mounted.rerender(tree({ ...sharedDisplayConnection(), signedIn: false }));
      expect(screen.queryByText("1 referral summaries (shared)")).not.toBeInTheDocument();
    } finally {
      mounted.unmount();
    }
  });

  it("expires the supplied shared session lifetime without a poll or retained report effect", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-25T00:00:00.000Z"));
    const connection = sharedDisplayConnection();
    connection.sessionEndsAt = Date.now() + 1000;
    const mounted = render(
      <WardSharedAccess connection={connection}>
        <DisplayProbe />
      </WardSharedAccess>,
    );
    try {
      expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("1 referral summaries (shared)");
      act(() => vi.advanceTimersByTime(1000));
      expect(screen.getByText("Display unavailable")).toBeInTheDocument();
    } finally {
      mounted.unmount();
      vi.useRealTimers();
    }
  });

  it("derives an authorised coordinator preview without inventing its legitimately absent sibling", async () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess(STATEWIDE_COORDINATOR);
      startAccessPreview({ role: "ward", scope: { kind: "ward", unitIds: [seedWardFlowState().units[0]!.id] } });
    });
    const coordinator = sharedDisplayConnection();
    coordinator.access = STATEWIDE_COORDINATOR;
    delete coordinator.snapshot!.partialView;
    const tree = (connection: WardSharedConnection) => (
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AdoptedSharedWorld>
          <WardSharedAccess connection={connection}>
            <WardAccessScope>
              <DisplayProbe />
            </WardAccessScope>
          </WardSharedAccess>
        </AdoptedSharedWorld>
      </WardFlowProvider>
    );
    const mounted = render(tree(coordinator));
    try {
      await waitFor(() =>
        expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent(
          /referral summaries \(local\/preview\)/,
        ),
      );
      const wardMissing = sharedDisplayConnection();
      delete wardMissing.snapshot!.partialView;
      mounted.rerender(tree(wardMissing));
      expect(screen.getByRole("status", { name: "Sender display" })).toHaveTextContent("Display unavailable");
    } finally {
      mounted.unmount();
      act(() => {
        setWardAccess(STATEWIDE_COORDINATOR);
        setWardFeatureFlagOnDevice("role-access", null);
      });
    }
  });
});

function senderResponse(accessContext = CONTEXT_A, revision = 9) {
  return {
    revision,
    accessContext,
    view: {
      version: 1,
      referrals: [
        {
          id: "RF-SYNTHETIC-REVIEW",
          kind: "sender",
          state: "queued",
          withdrawn: false,
          decidedAt: null,
          visibleUntil: null,
          canWithdraw: true,
          informationNeeds: ["legal_form_copy"],
        },
      ],
      movements: [],
    },
  } as const;
}

function SenderProbe() {
  const bound = useWardPartialView();
  const needsForm = bound?.view.referrals.some(
    (referral) => referral.kind === "sender" && referral.informationNeeds.includes("legal_form_copy"),
  );
  return (
    <p role="status">
      {bound ? (needsForm ? "Legal form copy requested" : "No outstanding items") : "Progress unavailable"}
    </p>
  );
}

function senderDisplay(response: unknown, revision: number | null, accessContext: string | null) {
  return (
    <WardPartialViewProvider response={response} currentRevision={revision} currentAccessContext={accessContext}>
      <SenderProbe />
    </WardPartialViewProvider>
  );
}

describe("response-only sender display lifetime", () => {
  it("removes the prior desk's information on an equal-revision access change", () => {
    const oldResponse = senderResponse();
    const { rerender } = render(senderDisplay(oldResponse, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");

    // A role or grant change can leave the world revision untouched.
    rerender(senderDisplay(oldResponse, 9, CONTEXT_B));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    expect(screen.queryByText("Legal form copy requested")).not.toBeInTheDocument();

    rerender(senderDisplay(senderResponse(CONTEXT_B), 9, CONTEXT_B));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");
  });

  it("clears on sign-out and requires a response matching the next accepted revision", () => {
    const response = senderResponse();
    const { rerender } = render(senderDisplay(response, 9, CONTEXT_A));
    rerender(senderDisplay(response, null, null));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");

    rerender(senderDisplay(response, 10, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    rerender(senderDisplay(senderResponse(CONTEXT_A, 10), 10, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Legal form copy requested");
  });

  it("does not retain a previously valid display when the next sibling is missing or malformed", () => {
    const response = senderResponse();
    const { rerender } = render(senderDisplay(response, 9, CONTEXT_A));
    const malformed = { ...response, view: { ...response.view, destinations: ["foreign-destination"] } };
    rerender(senderDisplay(malformed, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
    rerender(senderDisplay(null, 9, CONTEXT_A));
    expect(screen.getByRole("status")).toHaveTextContent("Progress unavailable");
  });
});
