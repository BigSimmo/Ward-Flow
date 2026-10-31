import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The demo Executive desk (board clock → Tools → Demo → Roles → Executive) on Settings and on a page
 * outside its role (round 4, 31 Oct 2026). Settings is for every desk, and Governance is not an
 * executive page, so it gets the same styled "Not part of your role" page as other desks. Both sit
 * inside the executive frame, whether or not the desk's report could be made: a failed report used to
 * replace the whole page with one bare line and no way back. Synthetic data only.
 */
const guard = vi.hoisted(() => ({ path: "/ward-flow/settings", phone: false, failReport: false }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "user-agent": guard.phone ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile" : "desktop",
      "sec-ch-ua-mobile": guard.phone ? "?1" : "?0",
    }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => guard.path,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("../src/components/ward-management/statistics/executive-statistics-projector", async (original) => {
  const actual =
    await original<typeof import("../src/components/ward-management/statistics/executive-statistics-projector")>();
  return {
    ...actual,
    projectExecutiveReportingFoundation: (...args: Parameters<typeof actual.projectExecutiveReportingFoundation>) => {
      if (guard.failReport) throw new Error("Synthetic report failure");
      return actual.projectExecutiveReportingFoundation(...args);
    },
  };
});

import Layout from "../src/app/ward-flow/layout";
import GovernancePage from "../src/app/ward-flow/governance/page";
import SettingsPage from "../src/app/ward-flow/settings/page";
import { resetWardAccessStoreForTests } from "../src/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "../src/components/ward-management/shell/ward-feature-flag-store";
import { resetServiceScopeForTests } from "../src/components/ward-management/shell/ward-service-store";
import { selectDemoRole } from "../src/components/ward-management/tools/ward-demo-role-session";

async function openAsDemoExecutive(path: string, Page: () => React.ReactNode) {
  guard.path = path;
  act(() =>
    selectDemoRole(
      { role: "executive", scope: { kind: "statewide" } },
      { desk: { role: "coordinator", scope: { kind: "statewide" } }, deviceFlag: null, persona: "coordinator" },
    ),
  );
  render(await Layout({ children: <Page /> }));
  // The preview's projector loads on demand; wait until the desk is no longer loading.
  await waitFor(() => expect(screen.queryByTestId("ward-statistics-loading")).toBeNull(), { timeout: 10_000 });
  expect(screen.getAllByTestId("ward-bar")).toHaveLength(1);
}

beforeEach(() => {
  guard.phone = false;
  guard.failReport = false;
  resetWardAccessStoreForTests();
  resetServiceScopeForTests();
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: guard.phone && query === "(max-width: 48rem)",
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  }));
});
afterEach(() => {
  cleanup();
  act(() => setWardFeatureFlagOnDevice("role-access", null));
  resetWardAccessStoreForTests();
  vi.restoreAllMocks();
});

describe("the demo Executive desk on Settings and Governance", () => {
  for (const failReport of [false, true]) {
    const when = failReport ? "when its report cannot be made" : "with its report";
    for (const phone of [false, true]) {
      const width = phone ? "phone" : "desktop";
      it(`shows Settings in the executive frame on the ${width}, ${when}`, async () => {
        guard.phone = phone;
        guard.failReport = failReport;
        await openAsDemoExecutive("/ward-flow/settings", SettingsPage);
        if (failReport) {
          // Settings keeps its own explicit line rather than invented defaults, now inside the frame.
          expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
          expect(screen.getByText(/Public settings are unavailable/)).toBeInTheDocument();
        } else
          expect(screen.getByTestId("ward-settings-screen")).toHaveAttribute(
            "data-ward-design",
            phone ? "v10-phone" : "workspaces",
          );
        expect(screen.queryByTestId("ward-access-closed")).toBeNull();
        expect(screen.queryByText(/Statistics are unavailable for this desk/)).toBeNull();
        if (phone) expect(screen.getByTestId("ward-phone-dock")).toBeInTheDocument();
        else expect(screen.getByTestId("ward-rail")).toBeInTheDocument();
      }, 30_000);

      it(`shows Governance as "Not part of your role" in the executive frame on the ${width}, ${when}`, async () => {
        guard.phone = phone;
        guard.failReport = failReport;
        await openAsDemoExecutive("/ward-flow/governance", GovernancePage);
        const closed = screen.getByTestId("ward-access-closed");
        expect(within(closed).getByRole("heading", { level: 1, name: "Not part of your role" })).toBeInTheDocument();
        expect(within(closed).getByRole("link", { name: "Go to your home" })).toHaveAttribute(
          "href",
          "/ward-flow/statistics",
        );
        expect(screen.queryByText(/Statistics are unavailable for this desk/)).toBeNull();
      }, 30_000);
    }
  }
});
