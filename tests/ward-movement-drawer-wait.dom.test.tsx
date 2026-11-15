import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MovementDrawer } from "@/components/ward-management/movements/movement-drawer";
import { type Movement } from "@/components/ward-management/ward-model";
import { wardMovements } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { installMatchMediaStub } from "./setup/jsdom.setup";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => null }));

function renderWait(waited: number, target = 1440, phone = false) {
  installMatchMediaStub(phone);
  const movement: Movement = { ...wardMovements[0], openedAt: NOW_ANCHOR - waited, closure: undefined };
  render(
    <MovementDrawer
      movement={movement}
      now={NOW_ANCHOR}
      units={[]}
      referrals={[]}
      patients={[]}
      edAccessTargetMinutes={target}
      dispatch={() => {}}
      onClose={() => {}}
    />,
  );
  return screen.getByRole("dialog");
}

describe("movement drawer total wait and target wording", () => {
  it("labels a seven-day total as time waited rather than seven days past its target", () => {
    const drawer = renderWait(7 * 1440 + 60);
    expect(drawer).toHaveTextContent(/7 d 1 h\s*waited · over the 1 d target/u);
    expect(drawer).not.toHaveTextContent("past the 1 d target");
  });

  it("uses the configured target alongside the unchanged total duration", () => {
    const drawer = renderWait(3 * 1440, 2160);
    expect(drawer).toHaveTextContent(/3 d\s*waited · over the 1 d 12 h target/u);
  });

  it("retains the ordinary wait wording before the severe-pressure mark", () => {
    expect(renderWait(60)).toHaveTextContent(/1 h 00 min\s*waited/u);
  });

  it("keeps the phone's explicitly labelled total wait unchanged", () => {
    const drawer = renderWait(7 * 1440 + 60, 1440, true);
    expect(drawer).toHaveTextContent("Waited7 d 1 h");
    expect(drawer).not.toHaveTextContent("past the 1 d target");
  });
});
