import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
const nav = vi.hoisted(() => ({ pathname: "/ward-flow" }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
import { WardAccessGate, WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { movementHref } from "@/components/ward-management/shell/ward-facade";
import { patientHref } from "@/components/ward-management/shell/ward-patient-href";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { scopeWorkspace } from "@/components/ward-management/ward-access-scope";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { GENERAL_OBSERVATION } from "@/components/ward-management/ward-observation";
import { allEmergencyDepartments, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";
import { communityTeamOptions } from "@/components/ward-management/referrals/referral-destination-options";
import type { WardAccess } from "@/components/ward-management/ward-role-access";

// Consumer-layer proof: actual shared/session/access wrappers, with a supplied transport callback.
// It does NOT establish provider authentication, private-detail delivery or a durable access row.
function fixtureSeed() {
  const base = seedWardFlowState();
  const teamName = communityTeamOptions()[0]!;
  const patient = base.patients.find(
    (person) =>
      person.sex === "Female" &&
      [person.address, person.interpreterLanguage].some((value) => typeof value === "string" && value.length > 0),
  );
  if (!patient) throw new Error("Synthetic detail fixture needs an existing registered patient");
  // The ordinary seed has no community movement. The real supported D-76 producers build one;
  // neither a handcrafted grant nor a fabricated visible row stands in for that workflow.
  for (const unit of base.units) {
    let state = wardFlowReducer(base, {
      type: "RECEIVE_REFERRAL",
      role: "coordinator",
      now: NOW_ANCHOR,
      patientId: patient.id,
      ageBand: "Adult",
      source: "community",
      sendingTeamName: teamName,
      originSiteCode: unit.siteCode,
      destinations: [
        {
          kind: "psychiatric_ward",
          unitId: unit.id,
          sex: "Female",
          gender: "Female",
          secureBedNeeded: false,
          involuntaryBedNeeded: false,
          highAcuityNursingNeeded: false,
        },
      ],
      homeRegion: "Perth Metropolitan",
      suburb: { kind: "unknown", reason: "not_known" },
      urgency: 2,
      transportNeeded: false,
      history: "",
    });
    if (state.rejections.at(-1) !== base.rejections.at(-1)) continue;
    const referralId = state.referrals.at(-1)!.id;
    const events: WardFlowEvent[] = [
      {
        type: "ACCEPT_REFERRAL",
        role: "coordinator",
        now: NOW_ANCHOR,
        referralId,
        destinationKind: "psychiatric_ward",
        unitId: unit.id,
        actingUnitId: unit.id,
      },
      {
        type: "RAISE_REFERRAL",
        role: "coordinator",
        now: NOW_ANCHOR,
        referralId,
        acceptedUnitId: unit.id,
        actingUnitId: unit.id,
        draft: {
          cohort: "Adult",
          sex: "Female",
          gender: "Female",
          security: "Open",
          observation: GENERAL_OBSERVATION,
          highAcuity: false,
          legalStatus: "Voluntary",
          urgency: 2,
          legalFormCode: null,
        },
      },
    ];
    let accepted = true;
    for (const event of events) {
      const next = wardFlowReducer(state, event);
      if (next.rejections.at(-1) !== state.rejections.at(-1)) {
        accepted = false;
        break;
      }
      state = next;
    }
    if (!accepted) continue;
    const scoped = scopeWorkspace(
      state,
      { role: "community", scope: { kind: "team", teamName } },
      { now: NOW_ANCHOR, places: wardPlaceLookup(state.units) },
    );
    if (scoped.movements.some((movement) => movement.patientId === patient.id)) return state;
  }
  throw new Error("Supported synthetic producer chain did not create a community journey");
}
const seed = fixtureSeed();
const places = wardPlaceLookup(seed.units);
const matrix: [string, WardAccess[]][] = [
  ["statewide coordinator", [{ role: "coordinator", scope: { kind: "statewide" } }]],
  [
    "service coordinator",
    HEALTH_SERVICES.map((service): WardAccess => ({ role: "coordinator", scope: { kind: "service", service } })),
  ],
  [
    "bed manager",
    [...new Set(seed.units.map((unit) => unit.siteCode))].map((siteCode): WardAccess => ({
      role: "bed_manager",
      scope: { kind: "site", siteCode },
    })),
  ],
  ["ward", seed.units.map((unit): WardAccess => ({ role: "ward", scope: { kind: "ward", unitIds: [unit.id] } }))],
  ["ED", allEmergencyDepartments().map((ed): WardAccess => ({ role: "ed", scope: { kind: "ed", edId: ed.id } }))],
  [
    "community",
    communityTeamOptions().map((teamName): WardAccess => ({ role: "community", scope: { kind: "team", teamName } })),
  ],
];
const fixtures = matrix.map(([label, choices]) => {
  for (const access of choices) {
    const scoped = scopeWorkspace(seed, access, { now: NOW_ANCHOR, places });
    const movement = scoped.movements.find(
      (row) => row.patientId && scoped.patients.some((person) => person.id === row.patientId),
    );
    if (movement?.patientId) return { label, access, movement, patientId: movement.patientId };
  }
  throw new Error(`Synthetic fixture missing a visible movement for ${label}`);
});
function activate(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}
function connection(access: WardAccess, logRecordView = vi.fn()): WardSharedConnection {
  return {
    enabled: true,
    signedIn: true,
    reportSnapshotReady: true,
    status: "ready",
    receivedAt: 100,
    error: null,
    actorId: "11111111-1111-4111-8111-111111111111",
    workingAs: "22222222-2222-4222-8222-222222222222",
    accountEmail: "synthetic@example.test",
    access,
    logRecordView,
    snapshot: {
      revision: 1,
      now: NOW_ANCHOR,
      dataMode: "prototype",
      accessContext: "a".repeat(64),
      payload: { version: 1, state: seed, dayZero: "2026-11-05T00:00:00.000Z", startedAt: "2026-11-05T00:00:00.000Z" },
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    dispatch: async () => ({ commandId: "synthetic", status: "cancelled" }),
    pushApi: {
      pushKey: async () => ({ enabled: false }),
      pushStatus: async () => false,
      pushSubscribe: async () => "role",
      pushUnsubscribe: async () => false,
    },
  };
}
function FixtureWorld({ children }: { children: ReactNode }) {
  const context = useWardFlow();
  return <WardFlowOverride value={{ ...context, ...seed, now: NOW_ANCHOR }}>{children}</WardFlowOverride>;
}
function tree(shared: WardSharedConnection) {
  return (
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <FixtureWorld>
        <WardSharedAccess connection={shared}>
          <WardAccessScope>
            <WardAccessGate>
              <p>Role record content</p>
            </WardAccessGate>
          </WardAccessScope>
        </WardSharedAccess>
      </FixtureWorld>
    </WardFlowProvider>
  );
}
afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});
describe("record opening across operational roles", () => {
  // The prior ward-movement case is already verified; this matrix adds the other role/surface variants.
  for (const fixture of fixtures)
    for (const surface of ["patient", "movement"] as const) {
      if (fixture.access.role === "ward" && surface === "movement") continue;
      it(`${fixture.label} opens a permitted ${surface} and requests its person's logged detail`, () => {
        activate(fixture.access);
        nav.pathname = surface === "movement" ? movementHref(fixture.movement.id) : patientHref(fixture.patientId);
        const logRecordView = vi.fn();
        render(tree(connection(fixture.access, logRecordView)));
        expect(screen.getByText("Role record content")).toBeInTheDocument();
        expect(logRecordView).toHaveBeenCalledTimes(1);
        expect(logRecordView).toHaveBeenLastCalledWith(fixture.patientId, surface);
      });
    }
  for (const access of [
    { role: "officer", scope: { kind: "jobs", service: HEALTH_SERVICES[0] } },
    { role: "executive", scope: { kind: "statewide" } },
    { role: "admin", scope: { kind: "statewide" } },
  ] satisfies WardAccess[])
    for (const surface of ["patient", "movement"] as const) {
      it(`${access.role} cannot open or report an operational ${surface} URL`, () => {
        activate(access);
        nav.pathname =
          surface === "movement" ? movementHref(fixtures[0]!.movement.id) : patientHref(fixtures[0]!.patientId);
        const logRecordView = vi.fn();
        render(tree(connection(access, logRecordView)));
        expect(screen.queryByText("Role record content")).toBeNull();
        expect(logRecordView).not.toHaveBeenCalled();
      });
    }
  it("a new authoritative access context reopens the same person's page while an ordinary poll does not", () => {
    const fixture = fixtures.find((row) => row.access.role === "ward")!;
    activate(fixture.access);
    nav.pathname = movementHref(fixture.movement.id);
    const logRecordView = vi.fn();
    const shared = connection(fixture.access, logRecordView);
    const { rerender } = render(tree(shared));
    expect(logRecordView).toHaveBeenCalledTimes(1);
    rerender(tree({ ...shared, snapshot: { ...shared.snapshot!, revision: 2 } }));
    expect(logRecordView).toHaveBeenCalledTimes(1);
    rerender(tree({ ...shared, snapshot: { ...shared.snapshot!, revision: 2, accessContext: "b".repeat(64) } }));
    expect(logRecordView).toHaveBeenCalledTimes(2);
    expect(logRecordView).toHaveBeenLastCalledWith(fixture.patientId, "movement");
  });
});
