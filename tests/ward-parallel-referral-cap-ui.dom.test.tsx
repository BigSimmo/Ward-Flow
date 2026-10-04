// tests/ward-parallel-referral-cap-ui.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same two mocks as every sibling dom suite that renders the ward-flow sidebar/intake form (e.g.
// tests/ward-referral-destinations.dom.test.tsx): a pathname so ward-nav-role-order.ts can derive
// a role, and a plain <a> so next/link never requires an App Router context jsdom cannot provide.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardAdmissions } from "@/components/ward-management/ward-admissions-seed";

const LOWERED_CAP = 2;

/**
 * Task 7 of the audit-wiring plan, 2026-09-16: dispatches SET_CONFIGURATION once with
 * `parallelReferralCap` lowered to `LOWERED_CAP`, before its children ever render against it.
 * Every other field keeps its default — this test is about the cap alone.
 */
function ConfigureLoweredCap({ children }: { children: ReactNode }) {
  const { dispatch, now } = useWardFlow();
  const configured = useRef(false);
  useEffect(() => {
    if (configured.current) return;
    configured.current = true;
    dispatch({
      type: "SET_CONFIGURATION",
      role: "coordinator",
      now,
      payload: { ...defaultWardConfiguration(), parallelReferralCap: LOWERED_CAP },
    });
  }, [dispatch, now]);
  return <>{children}</>;
}

describe("coordinator/shortlist-panel.tsx reads the configured parallel referral cap", () => {
  function ShortlistHarness({ movementId }: { movementId: string }) {
    const { movements, units, bedReleases, leaveBeds, referrals, now, dispatch, configuration } = useWardFlow();
    const [selectedUnitId, setSelectedUnitId] = useState<string | undefined>(undefined);
    return (
      <ShortlistPanel
        movement={movements.find((candidate) => candidate.id === movementId)}
        now={now}
        units={units}
        bedReleases={bedReleases}
        leaveBeds={leaveBeds}
        admissions={wardAdmissions}
        referrals={referrals}
        selectedUnitId={selectedUnitId}
        onSelectUnit={setSelectedUnitId}
        dispatch={dispatch}
        parallelReferralCap={configuration.parallelReferralCap}
      />
    );
  }

  it('shows "of 2 parallel" and refuses a third selection once the cap is configured to 2', () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfigureLoweredCap>
          <ShortlistHarness movementId="WF-009" />
        </ConfigureLoweredCap>
      </WardFlowProvider>,
    );

    expect(screen.getByText(/of 2 parallel/)).toBeInTheDocument();

    const candidates = screen.getAllByTestId(/^ward-shortlist-candidate-/);
    expect(
      candidates.length,
      "WF-009 needs at least three candidate wards for this test to prove anything",
    ).toBeGreaterThanOrEqual(3);

    fireEvent.click(candidates[0]);
    fireEvent.click(candidates[1]);
    expect(candidates[0]).toHaveAttribute("aria-pressed", "true");
    expect(candidates[1]).toHaveAttribute("aria-pressed", "true");

    // The third click is refused — a no-op, never silently swapping out an earlier choice.
    fireEvent.click(candidates[2]);
    expect(candidates[2]).toHaveAttribute("aria-pressed", "false");
    expect(candidates[0]).toHaveAttribute("aria-pressed", "true");
    expect(candidates[1]).toHaveAttribute("aria-pressed", "true");
  });
});

describe("referral-intake.tsx reads the configured parallel referral cap", () => {
  it('names "choose up to 2" once the cap is configured to 2', () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfigureLoweredCap>
          <ReferralIntakeForm />
        </ConfigureLoweredCap>
      </WardFlowProvider>,
    );

    expect(screen.getByText(/choose up to 2, in one act/)).toBeInTheDocument();
  });
});

describe("statistics-screen.tsx reads the configured parallel referral cap", () => {
  it('ward-statistics-refused-so-far-cap reads "2" once the cap is configured to 2', () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ConfigureLoweredCap>
          <StatisticsScreen />
        </ConfigureLoweredCap>
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-statistics-refused-so-far-cap")).toHaveTextContent("2");
  });
});
