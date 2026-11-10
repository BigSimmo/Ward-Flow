// M115 (master audit, 10 Nov 2026): the drawer half. The saved-world half (two desks, scopeWorld) is
// in ward-audit-m115-transfer-moves-visibility.test.ts. Here ward A's Bed board has a patient's
// drawer open; the next poll brings a snapshot where that stay has moved to ward B. Synthetic seed only.

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardBoard } from "@/components/ward-management/board/ward-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowStateAt, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { WardSharedConnection } from "@/components/ward-management/ward-shared-access";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/board/x",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
const fake = { connection: null as WardSharedConnection | null };
afterEach(cleanup);

function connection(state: WardFlowState, revision: number): WardSharedConnection {
  return {
    enabled: true,
    signedIn: true,
    actorId: "synthetic-shared-account",
    access: { role: "coordinator", scope: { kind: "statewide" } },
    status: "ready",
    error: null,
    eventLog: [],
    receivedAt: Date.now(),
    snapshot: {
      accessContext: "a".repeat(64),
      dataMode: "prototype",
      revision,
      now: 642,
      payload: {
        version: 1,
        state: JSON.parse(JSON.stringify(state)),
        dayZero: "2026-10-07T00:00:00Z",
        startedAt: "2026-10-07T10:00:00Z",
      },
    },
    dispatch: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    retry: vi.fn(),
    pushApi: { pushKey: vi.fn(), pushStatus: vi.fn(), pushSubscribe: vi.fn(), pushUnsubscribe: vi.fn() },
  } as WardSharedConnection;
}

describe("M115: an open patient drawer on the old ward after the patient moves", () => {
  it("no longer shows the patient within one poll", async () => {
    const state = seedWardFlowStateAt(0);
    const stay = state.admissions.find((a) => a.state === "occupied" && a.patientId)!;
    const other = state.units.find((u) => u.id !== stay.unitId)!;
    fake.connection = connection(state, 1);
    const tree = () => (
      <WardFlowProvider sharedConnection={fake.connection!}>
        <WardBoard unitId={stay.unitId} />
      </WardFlowProvider>
    );
    const { container, rerender } = render(tree());
    const tile = container.querySelector<HTMLButtonElement>('[data-bed-kind="occupied"] button')!;
    fireEvent.click(tile);
    expect(screen.getByTestId("ward-board-detail-person"), "the drawer is open on a stay").toBeInTheDocument();

    // The next poll: that stay is now on ward B (same record, new ward), revision one higher.
    const moved: WardFlowState = {
      ...state,
      admissions: state.admissions.map((a) => ({ ...a, unitId: a.unitId === stay.unitId ? other.id : a.unitId })),
    };
    fake.connection = connection(moved, 2);
    const before = container.querySelectorAll("[data-bed-kind=occupied]").length;
    rerender(tree());
    await waitFor(() => expect(container.querySelectorAll("[data-bed-kind=occupied]").length).toBeLessThan(before));
    expect(screen.queryByTestId("ward-board-detail-person"), "the drawer on ward A has closed").toBeNull();
  });
});
