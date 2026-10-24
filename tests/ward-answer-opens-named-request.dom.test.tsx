// Codex P1 on #585 (22 Oct 2026): a Notices "Open request" link names its request in `?movement=`, and
// the Answer view opens on that request, not on the oldest one waiting. Synthetic seed data only.
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

import { encodeRecordAddress } from "@/components/ward-management/shell/ward-record-address";
import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { Movement } from "@/components/ward-management/ward-model";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const UNIT_ID = "fsh-older-adult";
const OLDEST = "WF-002";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

// A second request waiting on the same ward, opened after the seed's own.
const LATER = seedWardFlowState().movements.find(
  (movement) => movement.id !== OLDEST && movement.closure === undefined,
)!.id;
function withSecondRequest(movements: Movement[]): Movement[] {
  const oldest = movements.find((movement) => movement.id === OLDEST)!;
  return movements.map((movement) =>
    movement.id === LATER
      ? { ...oldest, id: LATER, openedAt: oldest.openedAt + 30, referredUnitIds: [UNIT_ID] }
      : movement,
  );
}

function Harness({ children }: { children: ReactNode }) {
  const state = useWardFlow();
  return (
    <WardFlowOverride value={{ ...state, movements: withSecondRequest(state.movements) }}>{children}</WardFlowOverride>
  );
}

function renderAnswerAt(search: string) {
  window.history.replaceState(null, "", `/ward-flow/ward/${UNIT_ID}/answer${search}`);
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Harness>
        <WardScreen unitId={UNIT_ID} presentation="answer" />
      </Harness>
    </WardFlowProvider>,
  );
}

const shownId = async () =>
  (await screen.findByTestId(/^ward-incoming-/)).dataset.testid!.replace("ward-incoming-", "");

describe("ward answer view opens the request a link names", () => {
  it("lands on the oldest request when no request is named", async () => {
    renderAnswerAt("");
    expect(await shownId()).toBe(OLDEST);
  });

  it("opens the named request rather than the oldest", async () => {
    renderAnswerAt(`?movement=${encodeURIComponent(encodeRecordAddress(LATER))}`);
    expect(await shownId()).toBe(LATER);
  });

  it("falls back to the oldest when the name is not a request waiting here", async () => {
    renderAnswerAt("?movement=not-a-record");
    expect(await shownId()).toBe(OLDEST);
  });
});
