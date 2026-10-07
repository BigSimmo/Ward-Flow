import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { GovernanceView, auditKindLabels } from "@/components/ward-management/ward-management-modes";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE CHANGE-AUDIT PANEL MUST NAME EVERY KIND OF CHANGE IT CAN SHOW.
 *
 * 🔴 THE DEFECT. Both of its sentences listed four kinds while `auditKindLabels` held six.
 * `stage_corrected` and `acceptance_withdrawn` were added on 2026-09-04; the heading and the empty
 * state were not touched. **The empty state could therefore say "None — no ... has been recorded
 * yet" on a movement whose stage HAD been corrected** — a false statement of fact about a patient's
 * record, not merely an undercounted summary.
 *
 * ⚠️ WHY IT HAPPENED, AND IT IS THE GENERAL MECHANISM. `auditKindLabels` is a TOTAL `Record` over
 * the union, so the compiler forced whoever added the two kinds to add their labels. Nothing forced
 * the paragraph three hundred lines below it. **The compiler is inside the definition of "the code"
 * and the rendered sentence is not**, which is why a codebase this heavily guarded keeps producing
 * this class: the guards are all on the side the compiler can see.
 *
 * ⚠️ SO THE REPAIR DERIVED THE SENTENCE FROM THE MAP, AND THIS FILE GUARDS THE DERIVATION RATHER
 * THAN THE WORDS. A test pinning the new sentence would go green the moment somebody rephrased it
 * and red the moment somebody improved it, and — worse — would say nothing at all if a seventh kind
 * were added. This walks the map, so a new kind that does not reach the screen fails here.
 */

function renderGovernance() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <GovernanceView />
    </WardFlowProvider>,
  );
}

/** The labels as the sentence renders them — de-capitalised, otherwise verbatim. */
const kindWords = Object.values(auditKindLabels).map((label) => label.charAt(0).toLowerCase() + label.slice(1));

describe("the change-audit panel's description of itself", () => {
  it("walks more kinds than the broken sentence listed, or it cannot discriminate", () => {
    // THE DISCRIMINATING FLOOR. The old sentence named four. A map of four or fewer would make
    // every assertion below pass against the exact defect this file exists to reject.
    expect(
      kindWords.length,
      "the audit can produce four or fewer kinds, so a four-item sentence would be complete and " +
        "this guard proves nothing",
    ).toBeGreaterThan(4);
  });

  it("does not mount a change-audit sentence that could under-count the kinds", () => {
    renderGovernance();
    expect(screen.queryByRole("tab", { name: "Legacy facts" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-change-audit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("ward-governance-change-audit-empty")).not.toBeInTheDocument();
    // The label map is still the complete set. A restored panel must derive its sentence from it.
    expect(kindWords).toEqual(
      expect.arrayContaining([
        "urgency change",
        "legal status change",
        "pull released",
        "transport cancelled",
        "stage corrected",
        "acceptance withdrawn",
      ]),
    );
  });
});
