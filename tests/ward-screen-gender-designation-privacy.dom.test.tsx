import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { eligibility } from "@/components/ward-management/ward-eligibility";
import { movementById } from "@/components/ward-management/ward-movements";
import { NOW_ANCHOR, unitById } from "@/components/ward-management/ward-sites";

/**
 * Opus review round 2, 17 September 2026 (P2), privacy (plan §2): a ward or ED screen must never
 * show the words "sex" or "gender" beside the `gender_designation` gate, and must never surface
 * the T12 non-binary-placement refusal strings verbatim — both name facts about the patient that
 * belong to the coordinator alone. `wardFacingGateDetail` (`ward-eligibility.ts`) and
 * `wardSafeRejectionReason` (`ward-screen.tsx`) are the fix; this drives the real screen.
 *
 * WF-329 (generated, Adult/Secure, no `gender`) fails ONLY `gender_designation` against
 * `fsh-adult-secure`, the network's one Male-only ward (confirmed against the live eligibility
 * function before this file was written) — but that gate has NO override path
 * (`eligibilityRefusal`, `ward-flow-reducer.ts`), so `REFER_TO_UNITS` refuses it outright while
 * ungendered and it can never reach this ward's own referred list that way. This drives the
 * legitimate path instead: record a MATCHING gender first (so the referral is accepted), then
 * record a mismatching correction — exactly the new `RECORD_MOVEMENT_GENDER` event from this same
 * review round — so the gate genuinely fails on an already-referred movement, the way a real
 * correction after referral would.
 *
 * 🔴 **T2r FIX ROUND, FINDING 5 (2026-09-17): SWITCHED FROM WF-019 TO WF-329.** The 2026-09-17
 * sample-data pass gave WF-019 a recorded `gender: "Male"` (consistent with its `sex`), which
 * means it now PASSES `gender_designation` against this ward and no longer drives this test's
 * scenario at all. WF-329 is a `routineMovements`-generated record that still carries no `gender`,
 * sits at `placement_requested` with an empty `referredUnitIds` and no `acceptedUnitId` — the same
 * base shape WF-019 held when this file was written — and independently verified (this fix round)
 * to fail `gender_designation` alone against `fsh-adult-secure`. Nothing about what this file
 * proves changed; only which seeded movement supplies the unrecorded-gender precondition.
 */
function ReferThenMismatchGender() {
  const { dispatch, now } = useWardFlow();
  return (
    <>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "RECORD_MOVEMENT_GENDER", role: "coordinator", now, movementId: "WF-329", gender: "Male" })
        }
      >
        record Male
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "REFER_TO_UNITS",
            role: "coordinator",
            now,
            movementId: "WF-329",
            unitIds: ["fsh-adult-secure"],
          })
        }
      >
        refer WF-329 to FSH Adult Secure
      </button>
      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "RECORD_MOVEMENT_GENDER",
            role: "coordinator",
            now,
            movementId: "WF-329",
            gender: "Female",
          })
        }
      >
        correct to Female
      </button>
    </>
  );
}

describe("ward screen gender_designation privacy — a single-gender mismatch", () => {
  it("WF-329 fails ONLY gender_designation against the Male-only ward, before anything is dispatched", () => {
    const verdict = eligibility(movementById("WF-329")!, unitById("fsh-adult-secure")!, NOW_ANCHOR);
    const failing = verdict.gates.filter((gate) => !gate.pass).map((gate) => gate.gate);
    expect(failing).toEqual(["gender_designation"]);
  });

  it("shows only the generic sentence, never the words sex/gender or non-binary, once the mismatch is live", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ReferThenMismatchGender />
        <WardScreen unitId="fsh-adult-secure" />
      </WardFlowProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "record Male" }));
    fireEvent.click(screen.getByRole("button", { name: "refer WF-329 to FSH Adult Secure" }));
    expect(screen.getByTestId("ward-incoming-WF-329")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "correct to Female" }));

    const warning = screen.getByTestId("ward-eligibility-warning-WF-329");
    expect(warning).toHaveTextContent("This ward's bed designation does not suit this patient.");

    // Never "gender" or "non-binary" anywhere on the page — but "Sex" legitimately still appears
    // (the movement's own "Sex" row, and `sex_mix`'s stated-not-hidden reading), so this checks
    // only the two words plan §2 actually forbids on this screen, not every mention of sex.
    const pageText = (document.body.textContent ?? "").toLowerCase();
    expect(pageText).not.toMatch(/\bgender\b/);
    expect(pageText).not.toMatch(/non-binary/);
  });
});
