// #804, #797 (multi-account test, 26 Oct 2026): a sign-in lands on whatever page the tab last
// showed, often another account's. A page closed to the new desk opens that desk's home instead of
// "Not part of your role". Moving on clears the mark, so a later closed page is refused as before.
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/ward-flow/transport/officer", replace: vi.fn() }));

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
import {
  markSignInLanding,
  resetWardAccessStoreForTests,
  setWardAccess,
} from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const WARD2: WardAccess = { role: "ward", scope: { kind: "ward", unitIds: ["fsh-adult-secure"] } };

function renderGate() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardAccessScope>
        <WardAccessGate>
          <p>Page body</p>
        </WardAccessGate>
      </WardAccessScope>
    </WardFlowProvider>,
  );
}

function signInAs(access: WardAccess, landedOn: string) {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(access, { fromServer: true });
    markSignInLanding(landedOn);
  });
}

afterEach(() => {
  cleanup();
  nav.pathname = "/ward-flow/transport/officer";
  nav.replace.mockReset();
  act(() => {
    setWardFeatureFlagOnDevice("role-access", null);
    resetWardAccessStoreForTests();
  });
});

describe("a sign-in that lands on a page closed to the new desk", () => {
  it("opens the desk's own home, not the refusal (#804)", () => {
    signInAs(WARD2, "/ward-flow/transport/officer");
    renderGate();
    expect(nav.replace).toHaveBeenCalledWith("/ward-flow/ward/fsh-adult-secure");
    expect(screen.getByText("Opening your home")).toHaveAttribute("role", "status");
    expect(screen.queryByText("Not part of your role")).toBeNull();
  });

  it("still refuses a closed page the person moves to later", () => {
    signInAs(WARD2, "/ward-flow/somewhere-else");
    renderGate();
    expect(screen.getByText("Not part of your role")).toBeInTheDocument();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
