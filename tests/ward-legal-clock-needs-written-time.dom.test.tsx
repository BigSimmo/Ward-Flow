import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as the sibling ward dom suites (ward-ed-screen.dom.test.tsx and others):
// `ClinicalRail` renders next/link anchors and this suite never checks routing, so a plain <a>
// avoids an App Router context jsdom cannot provide.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

/**
 * 🔴 **A DELIBERATE REPLACEMENT, RECORDED IN `diff-integrity.json` — NOT A FIX TO THE OLD
 * ASSERTIONS, BECAUSE THE CODE PATH THEY PINNED IS DELETED.**
 *
 * Until 2026-09-17 this file guarded a narrower rule: when nobody had recorded WHEN a Form 1A or
 * 3D was written (`formedAt` absent), the screen's 72h countdown must say "Time written not
 * recorded" / "Start time not recorded" rather than fall back to `openedAt` — because falling back
 * always OVERSTATED how much of the statutory window was left. That countdown, and the constants
 * it counted down from (`FORM_1A_VALIDITY_HOURS` and friends), are gone:
 * `docs/ward-flow/plans/2026-09-17-build-plan-legal-clinical.md` item 1, on owner answer 1 (17
 * September 2026) — *"the timer that starts when a patient arrives is separate to forms... the app
 * works out no limits itself"* — so Task T1 deleted the computed window entirely rather than
 * fixing its fallback. There is no countdown left for a missing `formedAt` to corrupt.
 *
 * **The rule this file protects is now the stronger version of the same idea: `formedAt` must
 * never feed the form-expiry line AT ALL, present or absent, so its value cannot make any
 * difference to what the screen shows.** Both fixtures below still exist for exactly the reason
 * the original comment gave (the two cases the front door can and cannot reach), so this file
 * keeps them and re-points the assertions at that property instead of at a deleted countdown.
 *
 * ⚠️ **THE FORM 3D HALF IS STILL MOCKED, FOR THE SAME REASON.** No fixture movement in
 * `ward-movements.ts` carries a Form 3D at all, and `RAISE_REFERRAL` — the only runtime writer of
 * `movement.legalForm` — deliberately never stamps `formedAt`. So no seeded state and no reachable
 * dispatch sequence can ever put a Form 3D movement WITH a recorded `formedAt` in front of a
 * department. The hand-built pair below is unchanged from the file it replaces.
 *
 * The two Form 1A cases use real seeded movements and need no mock at all: `WF-001` (arm-ed)
 * carries a Form 1A with no `formedAt`, and `WF-005` (peel-ed) carries a Form 1A WITH a recorded
 * `formedAt` — the only such row in the fixture. Neither carries a `legalForm.dueAt`.
 */
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return { ...actual, useWardFlow: () => mockContext, useWardFlowClock: () => mockContext.now };
});

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const FORM_1A_NOT_FORMED_ID = "WF-001";
const FORM_1A_FORMED_ID = "WF-005";
const FORM_3D_NOT_FORMED_ID = "WF-TEST-3D-NOT-FORMED";
const FORM_3D_FORMED_ID = "WF-TEST-3D-FORMED";

const originalSeed = seedWardFlowState();
// Explicit paper expiries entered through the real action, never a duration calculated from formedAt.
const seeded = [FORM_1A_NOT_FORMED_ID, FORM_1A_FORMED_ID].reduce(
  (state, movementId) =>
    wardFlowReducer(state, {
      type: "RECORD_LEGAL_FORM_EXPIRY",
      role: "coordinator",
      now: NOW_ANCHOR,
      movementId,
      dueAt: 1000,
    }),
  originalSeed,
);

/**
 * Every field `Movement` requires, none invented: `cohort`/`security`/`sex`/`legalStatus`/`stage`
 * are real values already used elsewhere in `ward-movements.ts` (WF-005, WF-010), so this object
 * cannot drift from the type without a compile error.
 */
const form3DNotFormed: Movement = {
  id: FORM_3D_NOT_FORMED_ID,
  originEdId: "peel-ed",
  openedAt: NOW_ANCHOR - 200,
  flaggedUrgent: false,
  urgency: 2,
  cohort: "Adult",
  security: "Open",
  sex: "Female",
  specialling: false,
  highAcuity: false,
  legalStatus: "Detained awaiting examination",
  legalForm: { code: "3D" },
  statusChanges: [],
  urgencyChanges: [],
  overrides: [],
  stage: "placement_requested",
  owner: "ED mental health team",
  referredUnitIds: [],
  declines: [],
  blocker: "Awaiting coordinator referral",
  withdrawnReferrals: [],
  unwinds: [],
  stageChanges: [],
  // formedAt deliberately absent — this is the shape RAISE_REFERRAL itself produces at runtime.
};

/** Same movement, but with a `formedAt` recorded — the control case the reducer can never reach. */
const form3DFormed: Movement = {
  ...form3DNotFormed,
  id: FORM_3D_FORMED_ID,
  formedAt: NOW_ANCHOR - 200 - 150,
};

const mockContext = {
  ...seeded,
  movements: [...seeded.movements, form3DNotFormed, form3DFormed],
  now: NOW_ANCHOR,
  dispatch: vi.fn(),
  focusMovementId: undefined,
  setFocusMovementId: vi.fn(),
};

describe("the ED screen's form-expiry line never reads formedAt", () => {
  afterEach(cleanup);

  it("fixture precondition: WF-001 carries a Form 1A with a typed written expiry", () => {
    expect(originalSeed.movements.find((row) => row.id === FORM_1A_NOT_FORMED_ID)?.legalForm?.dueAt).toBeUndefined();
    expect(seeded.rejections).toEqual(originalSeed.rejections);
    const movement = seeded.movements.find((candidate) => candidate.id === FORM_1A_NOT_FORMED_ID);
    expect(movement, `${FORM_1A_NOT_FORMED_ID} is missing from the fixture`).toBeDefined();
    expect(movement?.originEdId).toBe("arm-ed");
    expect(movement?.legalForm?.code).toBe("1A");
    expect(
      movement?.legalForm?.dueAt,
      `${FORM_1A_NOT_FORMED_ID} must carry a typed dueAt so the row can show the written expiry`,
    ).toBeDefined();
  });

  it("fixture precondition: WF-005 carries a Form 1A with a typed written expiry", () => {
    expect(originalSeed.movements.find((row) => row.id === FORM_1A_FORMED_ID)?.legalForm?.dueAt).toBeUndefined();
    const movement = seeded.movements.find((candidate) => candidate.id === FORM_1A_FORMED_ID);
    expect(movement, `${FORM_1A_FORMED_ID} is missing from the fixture`).toBeDefined();
    expect(movement?.originEdId).toBe("peel-ed");
    expect(movement?.legalForm?.code).toBe("1A");
    expect(
      movement?.legalForm?.dueAt,
      `${FORM_1A_FORMED_ID} must carry a typed dueAt so the row can show the written expiry`,
    ).toBeDefined();
  });

  it("Form 1A with a typed dueAt: shows the written expiry, never a computed statutory window", () => {
    render(<EdScreen edId="arm-ed" />);
    const row = screen.getByTestId(`ward-ed-form-expiry-${FORM_1A_NOT_FORMED_ID}`);
    expect(row).toHaveTextContent(/Expiry written on the form:/);
    expect(row.textContent ?? "", "the line must never invent a 72h or 24h statutory figure from formedAt").not.toMatch(
      /\b(72|24)h\b|remaining \(/,
    );
  });

  it("Form 1A with dueAt still shows the written expiry — formedAt does not invent a different figure (control)", () => {
    render(<EdScreen edId="peel-ed" />);
    const row = screen.getByTestId(`ward-ed-form-expiry-${FORM_1A_FORMED_ID}`);
    expect(row).toHaveTextContent(/Expiry written on the form:/);
    expect(row.textContent ?? "").not.toMatch(/\b(72|24)h\b|remaining \(/);
  });

  it("Form 3D, no formedAt, no dueAt: shows 'No expiry recorded from the form.', never a computed figure", () => {
    render(<EdScreen edId="peel-ed" />);
    const row = screen.getByTestId(`ward-ed-form-expiry-${FORM_3D_NOT_FORMED_ID}`);
    expect(row).toHaveTextContent("No expiry recorded from the form.");
    expect(row.textContent ?? "").not.toMatch(/\b(72|24)h\b|remaining \(/);
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${FORM_3D_NOT_FORMED_ID}`)).not.toBeInTheDocument();
  });

  it("Form 3D, formedAt present but still no dueAt: reads identically — formedAt makes no difference (control)", () => {
    render(<EdScreen edId="peel-ed" />);
    const row = screen.getByTestId(`ward-ed-form-expiry-${FORM_3D_FORMED_ID}`);
    expect(row).toHaveTextContent("No expiry recorded from the form.");
    expect(row.textContent ?? "").not.toMatch(/\b(72|24)h\b|remaining \(/);
    expect(screen.queryByTestId(`ward-ed-form-expiry-warning-${FORM_3D_FORMED_ID}`)).not.toBeInTheDocument();
  });
});
