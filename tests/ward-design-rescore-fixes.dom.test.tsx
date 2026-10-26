// Design re-score (24 Oct 2026) fixes:
// DR-06: a desk whose Home is closed, opening Ward Flow's own address (the app icon), is sent to its
// own home instead of reading "Not part of your role".
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow", replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: nav.replace, prefetch: vi.fn(), back: vi.fn() }),
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
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function renderGate() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <WardAccessGate>
          <p>Coordinator home</p>
        </WardAccessGate>
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

function asDesk(access: WardAccess) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access);
  });
}

afterEach(() => {
  cleanup();
  nav.pathname = "/ward-flow";
  nav.replace.mockReset();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("DR-06: Ward Flow's own address sends each desk to its own home", () => {
  it.each<[string, WardAccess, string]>([
    [
      "ward",
      { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } },
      "/ward-flow/ward/fsh-adult-secure",
    ],
    ["ED", { role: "ed", scope: { kind: "ed", edId: "fsh-ed" } }, "/ward-flow/ed/fsh-ed"],
    ["officer", { role: "officer", scope: { kind: "jobs" } }, "/ward-flow/transport/officer"],
    ["executive", { role: "executive", scope: { kind: "statewide" } }, "/ward-flow/statistics"],
  ])("the %s desk goes to its home, not the refusal", (_name, access, home) => {
    asDesk(access);
    renderGate();
    expect(nav.replace).toHaveBeenCalledWith(home);
    expect(screen.getByText("Opening your home")).toHaveAttribute("role", "status");
    expect(screen.queryByText("Not part of your role")).toBeNull();
    expect(screen.queryByText("Coordinator home")).toBeNull();
  });

  it("still refuses another closed screen", () => {
    asDesk({ role: "executive", scope: { kind: "statewide" } });
    nav.pathname = "/ward-flow/capacity";
    renderGate();
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
