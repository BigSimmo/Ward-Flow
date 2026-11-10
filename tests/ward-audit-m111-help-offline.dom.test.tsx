/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * M111 (master audit list, 10 Nov 2026): Help works offline for each desk.
 *
 * With the device offline, each desk's Show me runs either work or say they need a connection. A run
 * on the screen already open needs nothing from the network, and works. A run that opens another
 * screen calls the router; offline, a router fetch for a page it does not hold falls back to a full
 * load, which leaves the running app for the browser's "No internet" page, or for the static offline
 * page where the service worker is installed (the A1-18 finding that `shell/ward-offline-links.tsx`
 * fixed for links). Show me does not go through that guard, so today it neither stops nor says it
 * needs a connection.
 *
 * DEFECT (non-clinical, reported to Josh 10 Nov 2026): the "opens another screen" cases are written as
 * `it.fails`, so they pass while the defect stands and turn red once Show me says it needs a
 * connection. Then flip them to `it`. Synthetic data only.
 */

const route = vi.hoisted(() => ({ pathname: "/ward-flow" }));
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const login = vi.hoisted(() => ({ role: "coordinator" as string }));
vi.mock("@/components/ward-management/help/ward-help-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ward-management/help/ward-help-store")>()),
  useTourRole: () => login.role,
}));

vi.mock("@/components/ward-management/help/ward-tour-facts", () => ({
  useTourFacts: () => ({ facts: {}, home: "/ward-flow", deskHome: "/ward-flow" }),
}));

import { EVERY_LOGIN } from "@/components/ward-management/help/ward-help-access";
import { howToHref } from "@/components/ward-management/help/ward-help-href";
import { canShowMe } from "@/components/ward-management/help/ward-help-howto";
import type { WardTourRole } from "@/components/ward-management/help/ward-help-store";
import { tasksForDesk } from "@/components/ward-management/help/ward-help-task-list";
import { WardShowMe } from "@/components/ward-management/help/ward-show-me";

function goOffline(): void {
  vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
}

/** A desk's first Show me task that opens a screen, with that screen's address. */
function taskThatOpensAScreen(role: WardTourRole): { id: string; path: string } | undefined {
  for (const howTo of tasksForDesk(role)) {
    if (!canShowMe(howTo, false) || !howTo.go) continue;
    const href = howToHref(howTo.go, role, "/ward-flow");
    if (href) return { id: howTo.id, path: href.split("#")[0]! };
  }
  return undefined;
}

const NEEDS_CONNECTION = /offline|connection/i;

beforeEach(() => {
  push.mockReset();
  goOffline();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  login.role = "coordinator";
  route.pathname = "/ward-flow";
});

describe("M111: each desk's Show me, offline", () => {
  it("has a Show me task that opens a screen for every desk (control)", () => {
    for (const role of EVERY_LOGIN) expect(taskThatOpensAScreen(role), role).toBeDefined();
  });

  it.each(EVERY_LOGIN)("%s: a run on the screen already open works without the network", (role) => {
    login.role = role;
    const task = taskThatOpensAScreen(role)!;
    route.pathname = task.path;
    render(<WardShowMe id={task.id} onClose={() => {}} onBack={() => {}} />);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByTestId("ward-show-me-card")).toBeInTheDocument();
  });

  it.fails.each(EVERY_LOGIN)(
    "%s: DEFECT M111, a run that opens another screen says it needs a connection instead of leaving the app",
    (role) => {
      login.role = role;
      const task = taskThatOpensAScreen(role)!;
      route.pathname = "/ward-flow/m111-somewhere-else";
      render(<WardShowMe id={task.id} onClose={() => {}} onBack={() => {}} />);
      expect(push, "offline, Show me must not send the router to a page it may not hold").not.toHaveBeenCalled();
      expect(screen.getByTestId("ward-show-me-card")).toHaveTextContent(NEEDS_CONNECTION);
    },
  );
});
