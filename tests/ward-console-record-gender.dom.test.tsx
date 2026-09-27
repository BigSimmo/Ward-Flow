import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({
  back: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // Same reason as `tests/ward-console-controls.dom.test.tsx`: the sidebar derives its role from
  // the route, and a whole-module mock without a pathname makes `usePathname` undefined.
  usePathname: () => "/mockups/ward-flow",
  useRouter: () => router,
}));

// 🔴 T2r FIX ROUND, FINDING 5 (2026-09-17): WF-009 is no longer usable unpatched — see the doc
// comment below. Only `wardMovements` is overridden (WF-009's `gender` cleared, everything else,
// including its five declines and its `legalStatus`/`legalForm`, untouched); every other export
// of the module, including `movementById`, passes through from the real module. `seedWardFlowState`
// (`ward-flow-reducer.ts`) and this file's own `WardFlowProvider` both import `wardMovements` from
// this path, so the patched array is what the real reducer actually seeds from — this is the real
// engine running on one deliberately altered fixture row, not a hand-built state object.
vi.mock("@/components/ward-management/ward-movements", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-movements")>();
  return {
    ...actual,
    wardMovements: actual.wardMovements.map((movement) =>
      movement.id === "WF-009" ? { ...movement, gender: undefined } : movement,
    ),
  };
});

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardPatientWorkspace } from "@/components/ward-management/ward-management-console";
import { useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { type MovementId } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Opus review round 2, 17 September 2026 (P2): the `gender_designation` gate's own refusal says
 * "Record gender first", and until `RECORD_MOVEMENT_GENDER` existed nothing on the running app
 * could answer it — recorded only in `Movement.gender`, and only at the two referral-time events
 * that write the movement in the first place. This drives the real coordinator console, the real
 * provider and the real reducer, and reads the ranked-candidates panel back off the rendered page,
 * never off state directly — the same discipline `ward-console-controls.dom.test.tsx` holds to.
 *
 * WF-009 (seeded, `ward-movements.ts`) is Adult/Secure, carries no `gender` (patched, see the
 * module mock above) and no `acceptedUnitId` — so its "Other wards, ranked" panel ranks
 * `fsh-adult-secure`, the network's one Male-only ward, among its top candidates, genuinely
 * blocked by `gender_designation` alone (confirmed against the live ranking function before this
 * file was written, never assumed).
 *
 * 🔴 **T2r FIX ROUND, FINDING 5 (2026-09-17): WF-009's `gender` IS NOW PATCHED, NOT STOCK.** An
 * earlier T10 gap fix (2026-09-04, see `ward-movements.ts`'s own comment on WF-009's `gender`
 * field) deliberately gave WF-009 a recorded `gender: "Male"` to close a real gate gap — a fix
 * this file must not undo in the shared fixture. No other seeded movement reproduces WF-009's own
 * shape (its `legalStatus`/`legalForm` and its five declines are what make `rph`/`rgh`/`bty`
 * genuinely ineligible here, which is what pushes `fsh-adult-secure` into the top-3 ranked slots
 * in the first place — a fresh, undeclined Secure movement ranks `fsh` 4th and never appears,
 * checked against three candidates before writing this). The module mock above is WF-009's own
 * real fixture row with only `gender` cleared, so this test proves the same thing it always did —
 * "Record gender first" shown and then cleared — without touching the deliberately-recorded
 * `gender` the real app now ships.
 */
/** Surfaces the live `gender` value so the assertion below reads the MODEL, never an input's own
 *  transient value — the same discipline `LastMovementProbe` in the ED expiry suite holds to. */
function GenderProbe() {
  const { movements } = useWardFlow();
  const movement = movements.find((candidate) => candidate.id === "WF-009");
  return <p data-testid="gender-probe">{movement?.gender ?? "not-recorded"}</p>;
}

function renderWorkspaceWithProbe() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardPatientWorkspace movementId={"WF-009" as MovementId} />
      <GenderProbe />
    </WardFlowProvider>,
  );
}

// R7 (owner ruling, 25 September 2026): the unrecorded-gender refusal no longer says "Record gender
// first"; it says the ward needs a coordinator's recorded review. Recording a matching gender still
// clears it, which is what this file proves.
describe("coordinator console: recording gender clears the gender_designation refusal", () => {
  it("shows the refusal against the Male-only ward, then clears it once a matching gender is recorded", () => {
    renderWorkspaceWithProbe();

    expect(screen.getByTestId("gender-probe").textContent).toBe("not-recorded");

    const alternativesText = () => screen.getByTestId("ward-console-alternatives").textContent ?? "";
    expect(
      alternativesText(),
      "the seeded fixture must still rank the network's one Male-only ward for WF-009",
    ).toMatch(/FSH Adult Secure/);
    expect(
      alternativesText(),
      "the gender_designation gate's own refusal must be visible before anything is recorded",
    ).toMatch(/needs a coordinator's recorded review/);

    const control = screen.getByTestId("ward-console-record-gender");
    fireEvent.change(within(control).getByTestId("ward-console-record-gender-select"), {
      target: { value: "Male" },
    });
    fireEvent.click(within(control).getByTestId("ward-console-record-gender-submit"));

    expect(screen.getByTestId("gender-probe").textContent).toBe("Male");
    expect(alternativesText(), "recording a matching gender must clear the refusal from the ranked list").not.toMatch(
      /needs a coordinator's recorded review/,
    );
  });
});
