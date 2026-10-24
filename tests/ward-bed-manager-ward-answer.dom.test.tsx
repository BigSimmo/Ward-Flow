import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

/** The ward answers its own referrals: the site bed manager sees them on the ward page but has no Accept (D-80). */
const WARD = unitById("bty-adult-secure")!;

function renderAs(role: "bed_manager" | "ward") {
  act(() => {
    setWardFeatureFlagOnDevice("role-access", true);
    setWardAccess(
      role === "bed_manager"
        ? { role, scope: { kind: "site", siteCode: WARD.siteCode } }
        : { role, scope: { kind: "ward", unitIds: [WARD.id] } },
    );
  });
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={WARD.id} />
    </WardFlowProvider>,
  );
}

describe("a ward's referrals on the site bed manager's ward page (D-80)", () => {
  afterEach(() => {
    cleanup();
    act(() => {
      setWardFeatureFlagOnDevice("role-access", null);
      resetWardAccessStoreForTests();
    });
  });

  it("shows the referral with Accept in principle unavailable, saying the ward answers it", () => {
    renderAs("bed_manager");
    expect(screen.getByTestId("ward-incoming-WF-017")).toBeInTheDocument();
    const accept = screen.getByTestId("ward-accept-WF-017");
    expect(accept).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("ward-incoming-WF-017")).toHaveTextContent(`${WARD.name} answers its own referrals.`);
  });

  it("leaves Accept in principle available to the ward itself", () => {
    renderAs("ward");
    expect(screen.getByTestId("ward-accept-WF-017")).not.toHaveAttribute("aria-disabled", "true");
  });
});
