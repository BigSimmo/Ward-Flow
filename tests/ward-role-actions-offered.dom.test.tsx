// Access test fixes (26 Oct 2026, #800, #801, #814): a desk is not offered an action its role cannot take.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
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
    return screen.getAllByRole("button", { name: /^Broadcast/ })[0]!;
  }

  it("is disabled for an ED desk", () => {
    expect(broadcastButton("ed")).toHaveAttribute("aria-disabled", "true");
  });

  it("stays available to a bed manager", () => {
    expect(broadcastButton("bed_manager")).not.toHaveAttribute("aria-disabled", "true");
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
    const remove = (index: number) => rows[index]!.querySelector("button")!;
    expect(remove(0)).toHaveAttribute("aria-disabled", "true");
    expect(remove(1)).not.toHaveAttribute("aria-disabled", "true");
  });
});
