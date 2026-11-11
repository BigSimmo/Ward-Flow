import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { WardIdleLock } from "@/components/ward-management/shell/ward-access";
import { parseStoredAccess, resetWardAccessStoreForTests } from "@/components/ward-management/shell/ward-access-store";
import {
  WardShellAuthorityProvider,
  useWardShellAuthority,
} from "@/components/ward-management/shell/ward-shell-public-context";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { CLINICAL_VALUES } from "@/components/ward-management/ward-clinical-values";

const IDLE_MS = CLINICAL_VALUES.idleLock.value * 60_000;
const POLL_MS = 3_000;

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/ward-flow",
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  resetWardAccessStoreForTests();
  vi.useRealTimers();
});

/** What each shared poll hands the ward desk provider: a freshly parsed, equal copy (synthetic desk). */
function polledAccess(): WardAccess {
  const access = parseStoredAccess(JSON.stringify({ role: "coordinator", scope: { kind: "statewide" } }));
  if (!access) throw new Error("synthetic access did not parse");
  return access;
}

it("locks a signed-in desk after the idle time while the shared poll keeps re-rendering (WF-22)", () => {
  const tree = (access: WardAccess) => (
    <WardShellAuthorityProvider access={access}>
      <WardIdleLock />
    </WardShellAuthorityProvider>
  );
  const { rerender } = render(tree(polledAccess()));
  for (let elapsed = POLL_MS; elapsed <= IDLE_MS + POLL_MS; elapsed += POLL_MS) {
    act(() => vi.advanceTimersByTime(POLL_MS));
    rerender(tree(polledAccess()));
  }
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("keeps one authority object while the access is equal and hands over a new one when it changes", () => {
  const seen: (WardAccess | null)[] = [];
  function Probe() {
    seen.push(useWardShellAuthority());
    return null;
  }
  const tree = (access: WardAccess) => (
    <WardShellAuthorityProvider access={access}>
      <Probe />
    </WardShellAuthorityProvider>
  );
  const { rerender } = render(tree(polledAccess()));
  rerender(tree(polledAccess()));
  expect(seen[1]).toBe(seen[0]);
  const executive = parseStoredAccess(JSON.stringify({ role: "executive", scope: { kind: "statewide" } }));
  if (!executive) throw new Error("synthetic executive access did not parse");
  rerender(tree(executive));
  expect(seen.at(-1)).not.toBe(seen[0]);
  expect(seen.at(-1)).toEqual(executive);
});
