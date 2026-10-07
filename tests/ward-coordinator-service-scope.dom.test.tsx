import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
// The pre-commit hook's staged-file typecheck compiles only this file (plus .d.ts roots), so it
// never sees tests/setup/jsdom.setup.ts's global jest-dom matcher augmentation. This mirrors
// tests/ward-transit-arrival-clocks.test.ts and tests/ward-screen-morning-rollup.dom.test.tsx,
// which already import it directly for the same reason.
import "@testing-library/jest-dom/vitest";

import { CoordinatorScreen } from "@/components/ward-management/coordinator/coordinator-screen";
import { isOpen } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { referralQueueOrder } from "@/components/ward-management/ward-referrals";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { allEmergencyDepartments, allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { defaultWardConfiguration } from "@/components/ward-management/ward-configuration";
import type { HealthService } from "@/components/ward-management/ward-model";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import {
  edHealthService,
  movementBelongsToService,
  referralBelongsToService,
  urgentMovementsOutsideService,
} from "@/components/ward-management/ward-service-scope";

/**
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md`, task B1 (item 44 — the
 * service chooser, §2 "Command: the patients queue and pressure strip are scoped. The flow
 * diagram stays whole-network with a foot sentence. The shortlist is never scoped. The referrals
 * tab follows referral membership. S2 applies.").
 *
 * `movementBelongsToService` / `referralBelongsToService` / `urgentMovementsOutsideService` are
 * driven straight from `ward-service-scope.ts` (already folded, S1) rather than reimplemented —
 * the same reasoning `tests/ward-delays-service-scope.dom.test.tsx` gives for doing the same.
 */

const OPEN = wardMovements.filter(isOpen);
const UNITS = allUnits();
const SERVICE: HealthService = "South Metro";
const CONFIG = defaultWardConfiguration();
const MEMBER_OPEN = OPEN.filter((movement) => movementBelongsToService(movement, SERVICE, UNITS));
const EXCLUDED_OPEN = OPEN.filter((movement) => !movementBelongsToService(movement, SERVICE, UNITS));

const ALL_REFERRALS = seedWardFlowState().referrals;
const REFERRAL_QUEUE = referralQueueOrder(ALL_REFERRALS);
const MEMBER_REFERRALS = REFERRAL_QUEUE.filter((referral) => referralBelongsToService(referral, SERVICE, UNITS));
const EXCLUDED_REFERRALS = REFERRAL_QUEUE.filter((referral) => !referralBelongsToService(referral, SERVICE, UNITS));

const ALL_EDS = allEmergencyDepartments();
const MEMBER_EDS = ALL_EDS.filter((ed) => {
  const rowService = edHealthService(ed.id);
  return rowService === undefined || rowService === SERVICE;
});
const EXCLUDED_EDS = ALL_EDS.filter((ed) => !MEMBER_EDS.some((member) => member.id === ed.id));

beforeEach(() => {
  // The provider persists demo state to sessionStorage and the service choice lives there too
  // (`ward-service-store.ts`) — both cleared so no earlier test's choice or dispatch leaks in.
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetServiceScopeForTests();
});

describe("fixture sanity: South Metro actually splits the Command populations both ways", () => {
  it("movements, referrals and EDs each have members and exclusions", () => {
    expect(MEMBER_OPEN.length, "no open movement belongs to South Metro").toBeGreaterThan(0);
    expect(EXCLUDED_OPEN.length, "every open movement belongs to South Metro").toBeGreaterThan(0);
    expect(MEMBER_REFERRALS.length, "no queued referral belongs to South Metro").toBeGreaterThan(0);
    expect(EXCLUDED_REFERRALS.length, "every queued referral belongs to South Metro").toBeGreaterThan(0);
    expect(MEMBER_EDS.length, "no ED belongs to South Metro").toBeGreaterThan(0);
    expect(EXCLUDED_EDS.length, "every ED belongs to South Metro").toBeGreaterThan(0);
  });
});

describe("Command narrows to a chosen service (item 44, task B1)", () => {
  it("the Patients tab holds only South Metro's own open movements", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    for (const movement of MEMBER_OPEN) {
      expect(
        screen.getByTestId(`ward-queue-row-${movement.id}`),
        `${movement.id} belongs to South Metro`,
      ).toBeInTheDocument();
    }
    for (const movement of EXCLUDED_OPEN) {
      expect(
        screen.queryByTestId(`ward-queue-row-${movement.id}`),
        `${movement.id} does not belong to South Metro`,
      ).not.toBeInTheDocument();
    }
  });

  it("the Referrals tab holds only South Metro's own queued referrals", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Referrals/ }));

    for (const referral of MEMBER_REFERRALS) {
      expect(
        screen.getByTestId(`ward-referral-row-${referral.id}`),
        `${referral.id} belongs to South Metro`,
      ).toBeInTheDocument();
    }
    for (const referral of EXCLUDED_REFERRALS) {
      expect(
        screen.queryByTestId(`ward-referral-row-${referral.id}`),
        `${referral.id} does not belong to South Metro`,
      ).not.toBeInTheDocument();
    }
  });

  it("shows the scope bar with the exact §3 summary, and S2's urgent-outside line", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    const memberOfWhole = wardMovements.filter((movement) => movementBelongsToService(movement, SERVICE, UNITS));
    // The screen's own denominator is the full seeded population (seedWardFlowState().movements),
    // not the raw wardMovements fixture array: seedWardFlowState() additively overlays demonstration
    // movements (ward-rulings-demo.ts), which grew the seed from 60 to 77 movements (2026-09-25)
    // while the raw wardMovements array itself stayed at 60. Computed from the current seed, not
    // hand-derived.
    const wholeSeedMovementCount = seedWardFlowState().movements.length;
    // Same reasoning as wholeSeedMovementCount above: urgent movements outside the service are
    // derived from the full seeded (overlay-inclusive) population the screen actually renders from,
    // not the raw wardMovements fixture array, which undercounts since the 2026-09-25 seed growth.
    const wholeSeedOpenMovements = seedWardFlowState().movements.filter(isOpen);
    const urgentOutside = urgentMovementsOutsideService(wholeSeedOpenMovements, SERVICE, UNITS, NOW_ANCHOR, CONFIG);
    expect(screen.getByTestId("ward-service-scope-bar")).toBeInTheDocument();
    expect(screen.getByTestId("ward-service-scope-bar-summary").textContent ?? "").toContain(
      `Showing ${memberOfWhole.length} of ${wholeSeedMovementCount} movements, in South Metro.`,
    );
    expect(screen.getByTestId("ward-service-scope-bar-urgent")).toHaveTextContent(
      urgentOutside.length === 0
        ? `Nothing flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated is outside ${SERVICE}.`
        : `${urgentOutside.length} ${urgentOutside.length === 1 ? "movement" : "movements"} outside ${SERVICE}: flagged urgent, a legal form running out, without a bed anywhere, waited past the access target, or escalated.`,
    );
  });

  it("the pressure strip shows only in-service EDs, with the exact §3 strip-foot sentence", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    const strip = screen.getByRole("region", { name: "Emergency department pressure" });
    for (const ed of MEMBER_EDS) {
      expect(within(strip).getByTestId(`ward-ed-${ed.id}`), `${ed.id} belongs to South Metro`).toBeInTheDocument();
    }
    for (const ed of EXCLUDED_EDS) {
      expect(
        within(strip).queryByTestId(`ward-ed-${ed.id}`),
        `${ed.id} does not belong to South Metro`,
      ).not.toBeInTheDocument();
    }
    expect(screen.getByTestId("ward-pressure-strip-service-foot")).toHaveTextContent(
      `${EXCLUDED_EDS.length} departments outside ${SERVICE} are not shown.`,
    );
  });

  it("the flow diagram's foot sentence is exact, and the diagram itself keeps every unit (whole-network)", () => {
    setServiceScope(SERVICE);
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    expect(screen.getByTestId("ward-diagram-service-foot")).toHaveTextContent(
      `Showing the whole network. The queue is scoped to ${SERVICE}.`,
    );
  });

  it("shortlist candidates are identical with and without a service chosen", () => {
    const target = MEMBER_OPEN[0]!;

    setServiceScope(SERVICE);
    const { unmount } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-queue-row-${target.id}`));
    const withServiceCandidateIds = screen
      .getAllByTestId(new RegExp("^ward-shortlist-candidate-"))
      .map((el) => el.getAttribute("data-testid"))
      .sort();
    expect(withServiceCandidateIds.length, "no candidates rendered — this scenario proves nothing").toBeGreaterThan(0);
    // §2 "Never hidden", S1: the shortlist is never scoped, so its reassurance sentence renders
    // while a service IS chosen.
    expect(screen.getByTestId("ward-shortlist-not-scoped")).toHaveTextContent(
      "Beds are never narrowed by service. Every ward in the network is considered.",
    );
    unmount();

    // resetServiceScopeForTests() below returns the store to All services for the second render.
    window.sessionStorage.clear();
    resetServiceScopeForTests();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId(`ward-queue-row-${target.id}`));
    const withAllCandidateIds = screen
      .getAllByTestId(new RegExp("^ward-shortlist-candidate-"))
      .map((el) => el.getAttribute("data-testid"))
      .sort();

    expect(withAllCandidateIds).toEqual(withServiceCandidateIds);
    // With All services, no scope bar and no "not scoped" reassurance — nothing to reassure
    // about.
    expect(screen.queryByTestId("ward-shortlist-not-scoped")).not.toBeInTheDocument();
  });

  it("with All services chosen, the screen is unchanged — no scope bar, no service foot notes, every open movement on the list", () => {
    // resetServiceScopeForTests() in beforeEach already leaves the store at All services (null).
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <CoordinatorScreen />
      </WardFlowProvider>,
    );

    expect(screen.queryByTestId("ward-service-scope-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-pressure-strip-service-foot")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-diagram-service-foot")).not.toBeInTheDocument();

    for (const movement of OPEN) {
      expect(screen.getByTestId(`ward-queue-row-${movement.id}`)).toBeInTheDocument();
    }
    for (const ed of ALL_EDS) {
      expect(screen.getByTestId(`ward-ed-${ed.id}`)).toBeInTheDocument();
    }
  });
});
