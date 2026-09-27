import { describe, expectTypeOf, it } from "vitest";

import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import type {
  _AssertNoUnreviewedRaiseReferralDraftFields,
  _AssertNoUnreviewedSafeEventPayloadFields,
  UnreviewedStringOrUnknownKeys,
} from "@/components/ward-management/ward-flow-persistence-classification";
import type { AssertNever } from "@/components/ward-management/ward-flow-provider";

/*
 * Opus adversarial review, 2026-09-17, P2 finding 2 (round 1) and P3 finding 7 (round 2):
 * `ward-flow-persistence-classification.ts`'s union-coverage guard test only ever checked event type
 * NAMES, never payload SHAPE — a safe-listed event whose payload later gained a bare `string` field
 * would still pass it. `UnreviewedStringOrUnknownKeys` and `AssertNever` are the compile-time guard
 * against exactly that, applied to the real `WardFlowEvent` union at
 * `ward-flow-persistence-classification.ts`'s own module scope (the two `_AssertNo…` type aliases
 * imported above).
 *
 * This file has THREE sentinels, each proving a different thing the guard could otherwise fail to
 * notice:
 *
 *   1. A SYNTHETIC, disconnected payload — proves the CHECK MACHINERY itself (`AssertNever` +
 *      `UnreviewedStringOrUnknownKeys`) can fail at all, isolated from the real union.
 *   2. A REAL safe event's payload, WIDENED with one injected field — proves the machinery works
 *      against the actual shapes this union produces, not only a hand-rolled mimic (P3 finding 7:
 *      the previous version only ever tested a synthetic type nothing in the real union resembles).
 *   3. A direct IMPORT of the real `_AssertNoUnreviewedSafeEventPayloadFields` /
 *      `_AssertNoUnreviewedRaiseReferralDraftFields` assertions from the classification file (P3
 *      finding 7: without this, deleting those two lines — or their `export` — from the source file
 *      would silently remove the real-world enforcement while every sentinel in THIS file kept
 *      passing, because none of them previously referenced the real assertions by name). Importing a
 *      type that no longer exists is a compile error ("has no exported member"), so this sentinel
 *      turns that deletion into a red `tsc` run rather than a silent gap.
 *
 * This is a compile-time-only proof: nothing in the `it` blocks below executes anything meaningful
 * at runtime — `expectTypeOf(...).toEqualTypeOf(...)` and `@ts-expect-error` are both resolved by
 * `tsc`, not by `vitest`'s runtime. `tsc -p tsconfig.typecheck.json --noEmit` is what actually
 * exercises this file; `vitest` merely gives it a home under `tests/` and describe/it labels a human
 * can find. (`expectTypeOf` itself performs no runtime check either — it is a no-op function whose
 * entire job is to give its type parameters somewhere to be written down.)
 */
describe("WARD_FLOW_TEXT_SAFE payload-shape compile-time guard", () => {
  it("sentinel 1 — a synthetic payload with an unreviewed string field: the CHECK MACHINERY can fail", () => {
    type SyntheticSafeLookingPayload = {
      type: "SYNTHETIC_EVENT_NOT_IN_THE_REAL_UNION";
      role: "demo";
      now: number;
      // A real, reviewed id-shaped key — present so the sentinel proves the OTHER field is what
      // trips the guard, not merely that any field at all does.
      movementId: string;
      // NOT on the reviewed-keys list — this is the deliberate violation.
      suspiciousFreeTextField: string;
    };

    // 🔴 P2 finding 2, replacing the tautology `expect(true).toBe(true)` this line used to be
    // (`tests/ward-no-tautological-cases.test.ts` flagged it): `expectTypeOf` makes a real, checked
    // claim about the TYPE `UnreviewedStringOrUnknownKeys<SyntheticSafeLookingPayload>` resolves
    // to — exactly the one unreviewed key — rather than an assertion against a hard-coded runtime
    // literal that could never fail.
    expectTypeOf<UnreviewedStringOrUnknownKeys<SyntheticSafeLookingPayload>>().toEqualTypeOf<"suspiciousFreeTextField">();

    // A synthetic payload with ONLY reviewed keys must compile with no error at all — the negative
    // control proving the sentinel above fails because of `suspiciousFreeTextField` specifically,
    // not because the machinery rejects every input.
    type SyntheticFullyReviewedPayload = {
      type: "SYNTHETIC_EVENT_NOT_IN_THE_REAL_UNION";
      role: "demo";
      now: number;
      movementId: string;
      unitId?: string;
    };
    expectTypeOf<UnreviewedStringOrUnknownKeys<SyntheticFullyReviewedPayload>>().toEqualTypeOf<never>();
  });

  it("sentinel 2 — a REAL safe event's payload, widened with one injected field: the guard works against actual union shapes, not only a synthetic mimic", () => {
    // `ADVANCE_CLOCK` is a real, currently-safe-listed event with a flat, entirely-reviewed payload
    // (`role`, `now`, `minutes`). Intersecting it with one extra `string` field simulates exactly
    // the regression this whole section exists to catch: a future edit widening a real event's
    // payload with a typed-text field, without anyone updating the reviewed-keys list.
    type WidenedRealSafeEventPayload = Extract<WardFlowEvent, { type: "ADVANCE_CLOCK" }> & {
      injectedUnreviewedField: string;
    };

    expectTypeOf<UnreviewedStringOrUnknownKeys<WidenedRealSafeEventPayload>>().toEqualTypeOf<"injectedUnreviewedField">();

    // @ts-expect-error — the same violation, expressed as a failed `AssertNever` assignment (the
    // actual mechanism `ward-flow-persistence-classification.ts`'s own real assertions use), so this
    // sentinel also proves THAT specific failure mode — not only the `expectTypeOf` one above — fires
    // for a widened real event.
    // The @ts-expect-error above is the entire proof; nothing references this alias afterward.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-time assertion
    type _RealEventWidenedSentinelMustNotCompile = AssertNever<UnreviewedStringOrUnknownKeys<WidenedRealSafeEventPayload>>;
  });

  it("sentinel 3 — importing the REAL assertions by name: deleting them from the source file is a compile error, not a silent gap", () => {
    // These two imports are the entire sentinel. If either declaration — or its `export` — is
    // removed from `ward-flow-persistence-classification.ts`, this file stops compiling with
    // "has no exported member", independently of every other check in this file. Referenced in a
    // tuple type below purely so they count as used (the underlying type alias in the source file
    // itself resolves to `never` when healthy, so there is nothing further to assert about VALUE
    // here — the import succeeding at all is the proof).
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- compile-time assertion
    type _RealAssertionsStillExported = [
      _AssertNoUnreviewedSafeEventPayloadFields,
      _AssertNoUnreviewedRaiseReferralDraftFields,
    ];

    // No runtime assertion here, deliberately — a `expect(true).toBe(true)` filler is exactly the
    // tautology this file's own fix 2 removed elsewhere (`tests/ward-no-tautological-cases.test.ts`
    // hunts for it). The two imports above compiling at all IS the entire proof for this sentinel;
    // `tsc` is what runs it, and vitest passing this `it` block with zero assertions is honest about
    // that rather than manufacturing a fake one.
  });
});
