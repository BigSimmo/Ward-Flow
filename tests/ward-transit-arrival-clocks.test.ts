/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React, { type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock next/link for jsdom
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) =>
    React.createElement("a", { href, ...rest }, children),
}));

import { PriorityQueue } from "@/components/ward-management/coordinator/priority-queue";
import { ShortlistPanel } from "@/components/ward-management/coordinator/shortlist-panel";
import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const NOW = NOW_ANCHOR;
const seeded = seedWardFlowState();
const baseMovement = seeded.movements[0];
if (!baseMovement) {
  throw new Error("Fixture precondition: seedWardFlowState has no movements");
}

const movementEta: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-ETA",
  stage: "accepted_awaiting_bed",
  originEdId: "jhc-ed",
  arrivalDetails: {
    mode: "ambulance",
    modeOfArrival: "St John Ambulance",
    estimatedArrivalAt: NOW + 45,
    recordedAt: NOW - 10,
    recordedBy: "coordinator",
  },
};

const movementOverdue: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-OVERDUE",
  stage: "accepted_awaiting_bed",
  originEdId: "jhc-ed",
  arrivalDetails: {
    mode: "ambulance",
    modeOfArrival: "RFDS",
    estimatedArrivalAt: NOW - 125,
    recordedAt: NOW - 200,
    recordedBy: "coordinator",
  },
};

const movementHoldArrival: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-HOLD-ARR",
  stage: "accepted_awaiting_bed",
  originEdId: "jhc-ed",
  arrivalDetails: {
    mode: "self",
    modeOfArrival: "Self Arrival",
    estimatedArrivalAt: undefined as unknown as number,
    recordedAt: NOW - 5,
    recordedBy: "coordinator",
  },
};

const movementPulled: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-PULLED",
  stage: "pulled",
  originEdId: "jhc-ed",
  arrivalDetails: undefined,
};

const movementPulledWithArrival: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-PULLED-WITH-ARR",
  stage: "pulled",
  originEdId: "jhc-ed",
  acceptedUnitId: allUnits()[0]?.id,
  arrivalDetails: {
    mode: "ambulance",
    modeOfArrival: "St John Ambulance",
    trackingNumber: "SJA-7788",
    estimatedArrivalAt: NOW + 30,
    recordedAt: NOW - 10,
    recordedBy: "coordinator",
  },
};

const movementPulledOverdue: Movement = {
  ...baseMovement,
  id: "WF-TRANSIT-PULLED-OVERDUE",
  stage: "pulled",
  originEdId: "jhc-ed",
  acceptedUnitId: allUnits()[0]?.id,
  arrivalDetails: {
    mode: "police",
    modeOfArrival: "Police Escort",
    estimatedArrivalAt: NOW - 120,
    recordedAt: NOW - 180,
    recordedBy: "coordinator",
  },
};

const mockContext = {
  ...seeded,
  movements: [
    ...seeded.movements,
    movementEta,
    movementOverdue,
    movementHoldArrival,
    movementPulled,
    movementPulledWithArrival,
    movementPulledOverdue,
  ],
  now: NOW,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlow: () => mockContext,
    useWardFlowClock: () => mockContext.now,
  };
});

describe("Coordinator & ED Transit Clocks and Telemetry", () => {
  afterEach(cleanup);

  describe("Priority Queue transit clocks", () => {
    it("renders active ETA countdown pill when arrivalDetails has future estimatedArrivalAt", () => {
      render(
        React.createElement(PriorityQueue, {
          movements: [movementEta],
          now: NOW,
          selectedId: undefined,
          onSelect: () => {},
          filterEdId: undefined,
          onClearFilter: () => {},
        }),
      );

      const pill = screen.getByTestId(`ward-queue-transit-eta-${movementEta.id}`);
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent("⏱ ETA in 45m · St John Ambulance");
    });

    it("renders overdue warning pill when now > estimatedArrivalAt + 60", () => {
      render(
        React.createElement(PriorityQueue, {
          movements: [movementOverdue],
          now: NOW,
          selectedId: undefined,
          onSelect: () => {},
          filterEdId: undefined,
          onClearFilter: () => {},
        }),
      );

      const pill = screen.getByTestId(`ward-queue-transit-overdue-${movementOverdue.id}`);
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent("⚠ Overdue ETA (+2h) · RFDS");
    });

    it("renders transit hold pill when arrivalDetails has no estimatedArrivalAt", () => {
      render(
        React.createElement(PriorityQueue, {
          movements: [movementHoldArrival],
          now: NOW,
          selectedId: undefined,
          onSelect: () => {},
          filterEdId: undefined,
          onClearFilter: () => {},
        }),
      );

      const pill = screen.getByTestId(`ward-queue-transit-eta-${movementHoldArrival.id}`);
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent("⏱ Transit: 4h hold (Self Arrival)");
    });

    it("renders default 4h hold pill when movement.stage is pulled without arrivalDetails", () => {
      render(
        React.createElement(PriorityQueue, {
          movements: [movementPulled],
          now: NOW,
          selectedId: undefined,
          onSelect: () => {},
          filterEdId: undefined,
          onClearFilter: () => {},
        }),
      );

      const pill = screen.getByTestId(`ward-queue-transit-hold-${movementPulled.id}`);
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent("⏱ Pulled · 4h hold clock active");
    });
  });

  describe("Shortlist Panel telemetry card", () => {
    it("renders transit card for pulled movement with arrival details", () => {
      render(
        React.createElement(ShortlistPanel, {
          movement: movementPulledWithArrival,
          now: NOW,
          units: allUnits(),
          bedReleases: [],
          leaveBeds: [],
          referrals: [],
          selectedUnitId: undefined,
          onSelectUnit: () => {},
          dispatch: () => {},
          parallelReferralCap: 3,
        }),
      );

      const card = screen.getByTestId("ward-shortlist-transit-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent(/Inbound Transit & Arrival Telemetry/i);
      expect(screen.getByTestId("ward-shortlist-transit-accepting-ward")).toHaveTextContent(allUnits()[0]?.name ?? "");
      expect(screen.getByTestId("ward-shortlist-transit-mode")).toHaveTextContent("St John Ambulance");
      expect(screen.getByTestId("ward-shortlist-transit-tracking")).toHaveTextContent("SJA-7788");
      expect(screen.getByTestId("ward-shortlist-transit-countdown")).toHaveTextContent("ETA in 30m");
    });

    it("renders overdue alert when now > ETA + 60m", () => {
      render(
        React.createElement(ShortlistPanel, {
          movement: movementPulledOverdue,
          now: NOW,
          units: allUnits(),
          bedReleases: [],
          leaveBeds: [],
          referrals: [],
          selectedUnitId: undefined,
          onSelectUnit: () => {},
          dispatch: () => {},
          parallelReferralCap: 3,
        }),
      );

      const card = screen.getByTestId("ward-shortlist-transit-card");
      expect(card).toBeInTheDocument();
      const overdueAlert = screen.getByTestId("ward-shortlist-transit-overdue");
      expect(overdueAlert).toBeInTheDocument();
      expect(overdueAlert).toHaveTextContent(/Overdue alert/i);
      expect(screen.getByTestId("ward-shortlist-transit-countdown")).toHaveTextContent("Overdue (+2h)");
    });

    it("renders transit card for pulled movement without arrival details", () => {
      render(
        React.createElement(ShortlistPanel, {
          movement: movementPulled,
          now: NOW,
          units: allUnits(),
          bedReleases: [],
          leaveBeds: [],
          referrals: [],
          selectedUnitId: undefined,
          onSelectUnit: () => {},
          dispatch: () => {},
          parallelReferralCap: 3,
        }),
      );

      const card = screen.getByTestId("ward-shortlist-transit-card");
      expect(card).toBeInTheDocument();
      expect(screen.getByTestId("ward-shortlist-transit-countdown")).toHaveTextContent("4h countdown active (4h hold)");
    });
  });

  describe("Emergency Department pressure screen transit badge", () => {
    it("renders transit badge for pulled movement in ED patient table row", () => {
      render(React.createElement(EdScreen, { edId: "jhc-ed" }));

      const badge = screen.getByTestId(`ward-ed-transit-badge-${movementPulled.id}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent(/4h hold clock active/i);
    });

    it("renders transit badge with active ETA and arrival mode when arrivalDetails present", () => {
      render(React.createElement(EdScreen, { edId: "jhc-ed" }));

      const badge = screen.getByTestId(`ward-ed-transit-badge-${movementEta.id}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("⏱ ETA in 45m · St John Ambulance");
    });

    it("renders overdue transit warning badge when overdue past 60m", () => {
      render(React.createElement(EdScreen, { edId: "jhc-ed" }));

      const badge = screen.getByTestId(`ward-ed-transit-badge-${movementOverdue.id}`);
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent("⚠ Overdue ETA (+2h) · RFDS");
    });
  });
});
