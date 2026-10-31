import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WardDemoPanel } from "@/components/ward-management/tools/ward-demo-panel";
import { exitDemoRole } from "@/components/ward-management/tools/ward-demo-role-session";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import {
  readWardAccessSnapshot,
  resetWardAccessStoreForTests,
  setWardAccess,
  useEffectiveWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { SharedSessionContext } from "@/components/ward-management/shell/ward-shared-session-context";
import {
  WardFlowOverride,
  WardFlowProvider,
  useWardFlow,
  useWardFlowSelect,
} from "@/components/ward-management/ward-flow-provider";
import {
  ACCESS_ROLE_LABELS,
  WARD_ACCESS_ROLES,
  homeHrefFor,
  screenDecision,
  screenForPath,
} from "@/components/ward-management/ward-role-access";
import { communityTeamSlug } from "@/components/ward-management/community/community-derivations";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { NOW_ANCHOR, STANDARD_WARD_SITES } from "@/components/ward-management/ward-sites";
import { scenarioUnits } from "@/components/ward-management/ward-scenarios";

const navigation = vi.hoisted(() => ({ path: "/ward-flow", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.path,
  useRouter: () => ({ push: navigation.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function Probe() {
  const { scenario, worldGeneration, movements, units, patients } = useWardFlowSelect(
    "scenario",
    "worldGeneration",
    "movements",
    "units",
    "patients",
  );
  const access = useEffectiveWardAccess();
  return (
    <output
      data-testid="role-proof"
      data-scenario={scenario}
      data-generation={worldGeneration}
      data-role={access.role}
      data-records={movements.length}
      data-identities={
        patients.filter((patient) => patient.givenName !== "Hidden" || patient.familyName !== "" || patient.umrn !== "")
          .length
      }
      data-narratives={movements.filter((movement) => "tentativeDiagnosis" in movement).length}
      data-home-open={String(
        screenDecision(access, screenForPath(homeHrefFor(access, communityTeamSlug)), wardPlaceLookup(units)).open,
      )}
    />
  );
}
function renderPanel(wrap: (children: ReactNode) => ReactNode = (child) => child) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      {wrap(
        <WardAccessScope>
          <Probe />
          <WardDemoPanel oneList />
        </WardAccessScope>,
      )}
    </WardFlowProvider>,
  );
}
function DemoHostOverride({ children, shared = false }: { children: ReactNode; shared?: boolean }) {
  const value = useWardFlow();
  return (
    <WardFlowOverride
      value={{
        ...value,
        demoControlsAvailable: false,
        shared: shared ? { enabled: true, status: "ready", error: null } : value.shared,
      }}
    >
      {children}
    </WardFlowOverride>
  );
}
const roles = () => screen.getByRole("group", { name: "Demo role" });
const choose = (label: string) =>
  fireEvent.click(within(roles()).getByRole("button", { name: new RegExp(`^${label}`) }));
const proof = () => screen.getByTestId("role-proof");

beforeEach(() => {
  navigation.path = "/ward-flow";
  navigation.push.mockImplementation((path: string) => {
    navigation.path = path;
  });
  localStorage.clear();
  act(() => {
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  });
});
afterEach(() => {
  act(() => {
    exitDemoRole();
    resetWardAccessStoreForTests();
    setWardFeatureFlagOnDevice("role-access", null);
  });
  vi.unstubAllEnvs();
});

describe("Roles within the existing Demo selector", () => {
  it("lists all canonical roles beside the existing scenarios and survives repeated switches", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /Winter surge/ })).toBeVisible();
    expect(within(roles()).getAllByRole("button")).toHaveLength(8);
    const scenario = proof().getAttribute("data-scenario");
    const generation = proof().getAttribute("data-generation");
    for (let round = 0; round < 2; round++)
      for (const role of WARD_ACCESS_ROLES) {
        choose(ACCESS_ROLE_LABELS[role]);
        expect(proof()).toHaveAttribute("data-role", role);
        expect(proof()).toHaveAttribute("data-home-open", "true");
        expect(within(roles()).getAllByRole("button", { pressed: true })).toHaveLength(1);
        expect(proof()).toHaveAttribute("data-scenario", scenario);
        expect(proof()).toHaveAttribute("data-generation", generation);
        expect(navigation.push).toHaveBeenLastCalledWith(
          homeHrefFor(readWardAccessSnapshot().access, communityTeamSlug),
        );
        if (role === "admin") expect(proof()).toHaveAttribute("data-records", "0");
        if (role === "executive") {
          // Current main's local counts-only projection retains anonymised rows for statistics.
          // PR #997's separate shared aggregate transport is not part of this demo change.
          expect(proof()).toHaveAttribute("data-identities", "0");
          expect(proof()).toHaveAttribute("data-narratives", "0");
        }
      }
  });

  it("keeps Winter surge on role changes, reset and exit", () => {
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Winter surge/ }));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Load Winter surge?" })).getByRole("button", {
        name: "Load Winter surge",
      }),
    );
    const scenario = proof().getAttribute("data-scenario");
    const generation = proof().getAttribute("data-generation");
    choose("Nurse in charge");
    choose("ED clinician");
    expect(proof()).toHaveAttribute("data-scenario", scenario);
    expect(proof()).toHaveAttribute("data-generation", generation);
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Reset the demo?" })).getByRole("button", { name: "Cancel" }),
    );
    expect(proof()).toHaveAttribute("data-generation", generation);
    fireEvent.click(screen.getByTestId("ward-tools-demo-reset"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset demo" }));
    expect(proof()).toHaveAttribute("data-role", "ed");
    fireEvent.click(screen.getByRole("button", { name: "Exit role demo" }));
    expect(proof()).toHaveAttribute("data-role", "coordinator");
    expect(proof()).toHaveAttribute("data-scenario", scenario);
    expect(navigation.push).toHaveBeenLastCalledWith("/ward-flow");
    expect(screen.queryByRole("button", { name: "Exit role demo" })).toBeNull();
  });

  it("retains exit across menu unmount and switches with the keyboard", async () => {
    const user = userEvent.setup();
    const mounted = renderPanel();
    const button = within(roles()).getByRole("button", { name: /^Transport officer/ });
    button.focus();
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute("type", "button");
    await user.keyboard("{Enter}");
    expect(proof()).toHaveAttribute("data-role", "officer");
    mounted.unmount();
    renderPanel();
    expect(within(roles()).getByRole("button", { pressed: true })).toHaveTextContent("Transport officer");
    expect(screen.getByRole("button", { name: "Exit role demo" })).toBeEnabled();
  });

  it("does not expose local role changes for an authenticated session", () => {
    renderPanel((child) => (
      <SharedSessionContext.Provider value={{ signOut: vi.fn(), logRecordView: vi.fn() }}>
        {child}
      </SharedSessionContext.Provider>
    ));
    expect(screen.queryByRole("group", { name: "Demo role" })).toBeNull();
    expect(screen.getByRole("region", { name: "Roles" })).toHaveTextContent("Use Switch role for your account");
    expect(readWardAccessSnapshot().access.role).toBe("coordinator");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("fails closed for a shared build even before an account context arrives", () => {
    vi.stubEnv("NEXT_PUBLIC_WARD_SHARED_ENABLED", "true");
    renderPanel();
    expect(screen.queryByRole("group", { name: "Demo role" })).toBeNull();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("disables all role changes when demo controls are off", () => {
    renderPanel((child) => <DemoHostOverride>{child}</DemoHostOverride>);
    for (const button of within(roles()).getAllByRole("button"))
      expect(button).toHaveAttribute("aria-disabled", "true");
    choose("Executive");
    expect(readWardAccessSnapshot().access.role).toBe("coordinator");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("does not offer local role changes for a shared workspace without a session context", () => {
    renderPanel((child) => <DemoHostOverride shared>{child}</DemoHostOverride>);
    expect(screen.queryByRole("group", { name: "Demo role" })).toBeNull();
    expect(readWardAccessSnapshot().access.role).toBe("coordinator");
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("names the held desk from its access scope, not the next-role candidate", () => {
    const sites = STANDARD_WARD_SITES.filter((site) => site.units.length > 0 && site.emergencyDepartment);
    const site = sites[sites.length - 1]!;
    const ward = site.units[site.units.length - 1]!;
    const ed = site.emergencyDepartment!;
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [ward.id] } });
    });
    renderPanel();
    const summary = () => screen.getByText(/^Current role:/);
    expect(summary()).toHaveTextContent(`Current role: ${ACCESS_ROLE_LABELS.ward}. Demo ward: ${ward.name}.`);
    act(() => setWardAccess({ role: "ed", scope: { kind: "ed", edId: ed.id } }));
    expect(summary()).toHaveTextContent(`Demo ED: ${ed.name}.`);
    act(() => setWardAccess({ role: "bed_manager", scope: { kind: "site", siteCode: site.code } }));
    expect(summary()).toHaveTextContent(`Demo site: ${site.name}.`);
    act(() => setWardAccess({ role: "community", scope: { kind: "team", teamName: "Synthetic test team" } }));
    expect(summary()).toHaveTextContent("Demo team: Synthetic test team.");
  });

  it("offers a coordinator fallback for a restored local desk without return history", () => {
    act(() => {
      setWardFeatureFlagOnDevice("role-access", true);
      setWardAccess({ role: "officer", scope: { kind: "jobs" } });
    });
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Back to Bed coordinator" }));
    expect(proof()).toHaveAttribute("data-role", "coordinator");
    expect(navigation.push).toHaveBeenLastCalledWith("/ward-flow");
    expect(screen.queryByRole("button", { name: "Back to Bed coordinator" })).toBeNull();
  });
});

it("returns to a valid coordinator desk when a scenario change removes the starting ward", () => {
  const ward = STANDARD_WARD_SITES.flatMap((site) => site.units)[0]!;
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess({ role: "ward", scope: { kind: "ward", unitIds: [ward.id] } });
  });
  renderPanel();
  choose("Bed coordinator");
  fireEvent.click(screen.getByRole("button", { name: /Winter surge/ }));
  fireEvent.click(
    within(screen.getByRole("dialog", { name: "Load Winter surge?" })).getByRole("button", {
      name: "Load Winter surge",
    }),
  );
  expect(proof()).toHaveAttribute("data-scenario", "winter-surge");
  expect(scenarioUnits("winter-surge").some((unit) => unit.id === ward.id)).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Exit role demo" }));
  expect(readWardAccessSnapshot().access).toEqual({ role: "coordinator", scope: { kind: "statewide" } });
  expect(navigation.push).toHaveBeenLastCalledWith("/ward-flow");
  expect(proof()).toHaveAttribute("data-scenario", "winter-surge");
  expect(Number(proof().getAttribute("data-records"))).toBeGreaterThan(0);
});
