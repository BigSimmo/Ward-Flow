/**
 * A refused protected-record step says what happened and what to do, never only "Request could not
 * be completed" (stress test 25 Oct 2026). Synthetic only.
 */
import { describe, expect, it } from "vitest";

import { PROTECTED_REFUSAL_REASONS } from "@/components/ward-management/ward-flow-protected-record-events";

describe("protected-record refusal wording", () => {
  it("gives every reason a full sentence that says nothing was changed", () => {
    for (const [code, reason] of Object.entries(PROTECTED_REFUSAL_REASONS)) {
      expect(reason, code).toMatch(/^[A-Z].*\.$/);
      expect(reason, code).toMatch(/Nothing was changed\.$/);
      expect(reason, code).not.toMatch(/could not be completed|workflow requirements/i);
    }
  });

  it("says the same for a record outside the desk's place and one that does not exist", () => {
    expect(PROTECTED_REFUSAL_REASONS.scope).toBe(PROTECTED_REFUSAL_REASONS["missing-or-inaccessible"]);
  });

  it("tells a stale save to check the board", () => {
    expect(PROTECTED_REFUSAL_REASONS.revision).toMatch(/Check the board/);
    expect(PROTECTED_REFUSAL_REASONS.generation).toMatch(/Check the board/);
  });
});
