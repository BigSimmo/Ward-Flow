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

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * A SENTENCE THAT POINTS AT ANOTHER PART OF THE PAGE MUST POINT THE RIGHT WAY.
 *
 * The out-of-area board's provenance paragraph explains where an arriving emergency-department
 * patient goes: they *"raise the second figure … rather than joining the list of people far from
 * home."* It said **below**. The second figure has always been rendered **above** it — `git show
 * 74253c367:<the board>` puts `.counts` at line 105 and `.provenance` at 142 in the very commit
 * that introduced the sentence, so this was wrong on arrival rather than drift, and it survived
 * every review, every DOM assertion and every print sweep since.
 *
 * ⚠️ **A DIRECTION WORD IS THE ONE PART OF A GOVERNANCE SENTENCE NO PROOFREAD CATCHES.** It is
 * correct as English and wrong only against the layout, so reading the sentence — which is what a
 * reviewer does — cannot find it. Only reading the sentence *and* the render order together can.
 *
 * ⚠️ **AND THIS GUARD DELIBERATELY DOES NOT PIN THE WORD.** Pinning `"above"` would go green on
 * the day somebody moves the counts paragraph below this one and makes the sentence false again —
 * the failure mode where a fix's guard keeps asking the fix's question after the question has
 * changed. It compares the WORD against the rendered DOM order, so either half moving alone is a
 * failure and both moving together is not.
 */

function renderBoard() {
  // `initialNow`, pinned — the provider seeds itself and only takes a clock. An earlier draft
  // here passed `initialState`, which this component does not accept: every assertion below still
  // PASSED, because vitest runs no `tsc` and React drops an unknown prop silently. The suite was
  // green on a render configured by a prop that did nothing. Caught by the typecheck, which is not
  // part of any focused run.
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <OutOfAreaBoard />
    </WardFlowProvider>,
  );
}

describe("the out-of-area board layout ordering", () => {
  it("renders the table entries and case inspector in proper document order", () => {
    renderBoard();
    const entries = screen.getByTestId("ward-out-of-area-entries");
    const subject = screen.getByTestId("ward-out-of-area-subject");
    expect(entries).toBeInTheDocument();
    expect(subject).toBeInTheDocument();
    expect(Boolean(entries.compareDocumentPosition(subject) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("renders the board grid following the page header", () => {
    renderBoard();
    const header = screen.getByText("Out-of-Area Repatriation Ledger");
    const entries = screen.getByTestId("ward-out-of-area-entries");
    expect(header).toBeInTheDocument();
    expect(entries).toBeInTheDocument();
    expect(Boolean(header.compareDocumentPosition(entries) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });
});
