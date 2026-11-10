// Access test fixes (26 Oct 2026, #800, #801, #814): a desk is not offered an action its role cannot take.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/alerts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { AccessSettings } from "@/components/ward-management/settings/access-settings";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardSharedAccess, type WardSharedConnection } from "@/components/ward-management/ward-shared-access";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToastProvider } from "@/components/wf";

afterEach(() => {
  cleanup();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("Broadcast alert", () => {
  function broadcastButton(role: "ed" | "bed_manager") {
    setWardFeatureFlagOnDevice("role-access", true);
    act(() =>
      setWardAccess(
        role === "ed"
          ? { role: "ed", scope: { kind: "ed", edId: "peel-ed" } }
          : { role: "bed_manager", scope: { kind: "site", siteCode: "RPH" } },
      ),
    );
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    return screen.queryAllByRole("button", { name: /^Broadcast/ })[0];
  }

  it("is not offered to an ED desk", () => {
    // Page tops (9 Nov 2026): Broadcast alert is a hero chip, left out (not greyed) where the desk may not
    // broadcast. Either way the ED desk has no working Broadcast.
    const button = broadcastButton("ed");
    if (button) expect(button).toHaveAttribute("aria-disabled", "true");
    else expect(screen.getByTestId("ward-alerts-top")).toBeInTheDocument();
  });

  it("stays available to a bed manager", () => {
    const button = broadcastButton("bed_manager");
    expect(button).toBeDefined();
    expect(button).not.toHaveAttribute("aria-disabled", "true");
  });
});

describe("the roles list", () => {
  it("does not let an admin remove their own admin role, but lets them remove another's", async () => {
    act(() => setWardAccess({ role: "admin", scope: { kind: "statewide" } }));
    const row = (id: string, actorId: string) => ({
      id,
      actorId,
      role: "admin",
      scope: { kind: "statewide" },
      kind: "role",
      grantedBy: "other",
      approved: true,
      minutes: { granted: -60, expires: 600, lastUsed: null },
    });
    const connection = {
      enabled: true,
      signedIn: true,
      snapshot: {
        dataMode: "prototype" as const,
        revision: 1,
        now: 642,
        accessContext: "a".repeat(64),
        payload: {
          version: 1 as const,
          state: seedWardFlowState(),
          dayZero: "2026-10-07T00:00:00Z",
          startedAt: "2026-10-07T10:00:00Z",
        },
      },
      receivedAt: Date.now(),
      status: "ready",
      recovering: false,
      error: null,
      accessUntil: Date.now() + 60000,
      access: { role: "admin", scope: { kind: "statewide" } },
      actorId: "own-account",
      signIn: vi.fn(),
      signOut: vi.fn(),
      retry: vi.fn(),
      dispatch: vi.fn(),
      pushApi: {},
      accessApi: {
        listAccess: async () => ({ memberships: [row("m1", "own-account"), row("m2", "someone-else")], requests: [] }),
        listCovers: async () => [],
        listRecordViews: async () => [],
      },
    } as unknown as WardSharedConnection;
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={642}>
          <WardSharedAccess connection={connection}>
            <AccessSettings />
          </WardSharedAccess>
        </WardFlowProvider>
      </ToastProvider>,
    );
    const rows = await screen.findAllByTestId("ward-access-role-row");
    expect(rows).toHaveLength(2);
    // WF-34: the admin's own row offers no Remove at all; another person's row does.
    const remove = (index: number) => within(rows[index]!).queryByRole("button", { name: /Remove/ });
    expect(remove(0)).toBeNull();
    expect(remove(1)).not.toBeNull();
    expect(remove(1)).not.toHaveAttribute("aria-disabled", "true");
  });
});
