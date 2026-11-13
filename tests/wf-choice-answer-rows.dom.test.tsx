/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Segmented } from "@/components/wf";

/*
 * Spec item 15 (C18, 13 Nov 2026): choice rows size to their words and wrap, never cut mid-word; a
 * row of four or more takes the full width; on a phone a long row becomes a one-per-line list of
 * 40px rows with a radio mark. Two-choice rows stay a switch.
 */

const css = (file: string) =>
  readFileSync(join(process.cwd(), "src/components", file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const MODES = ["Walk-in", "Ambulance (St John)", "Police", "Family or carer"].map((label) => ({
  id: label,
  label,
}));

describe("kit Segmented answer rows", () => {
  it("marks four or more answers as wrapping chips that list on a phone", () => {
    render(<Segmented label="Coming by" layout="answers" items={MODES} value="Police" onChange={() => {}} />);
    const group = screen.getByRole("radiogroup", { name: "Coming by" });
    expect(group.className).toMatch(/answers/u);
    expect(group.className).toMatch(/answerChips/u);
    expect(group.className).toMatch(/answerList/u);
    expect(screen.getByRole("radio", { name: "Police" })).toHaveAttribute("aria-checked", "true");
  });

  it("keeps two answers a switch, and leaves track rows alone", () => {
    const { rerender } = render(
      <Segmented
        label="Yes or no"
        layout="answers"
        items={[
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ]}
        value="yes"
      />,
    );
    const group = screen.getByRole("radiogroup", { name: "Yes or no" });
    expect(group.className).toMatch(/answers/u);
    expect(group.className).not.toMatch(/answerChips|answerList/u);
    rerender(<Segmented label="Window" items={MODES} value="Police" />);
    expect(screen.getByRole("radiogroup", { name: "Window" }).className).not.toMatch(/answer/u);
  });

  it("draws the phone list as 40px rows with a radio mark, and never cuts a word", () => {
    const kit = css("wf/choice.module.css");
    const phone = kit.slice(kit.lastIndexOf("@media (max-width: 46.4375rem)"));
    expect(phone).toMatch(/\.seg\.answerList\s*\{[^}]*flex-direction:\s*column/u);
    expect(phone).toMatch(/\.seg\.answerList \.segItem\s*\{[^}]*min-height:\s*var\(--wf-phone-seg-item-h, 40px\)/u);
    expect(phone).toMatch(/\.seg\.answerList \.segItem::before\s*\{[^}]*border-radius:\s*50%/u);
    expect(kit).toMatch(/\.answers \.segItem\s*\{[^}]*white-space:\s*normal/u);
  });
});

describe("screens that draw their own answer rows", () => {
  it("referral drawer: no answer is cut, four or more are chips across the row, a list on a phone", () => {
    const drawer = css("ward-management/referrals/ward-referral-drawer.module.css");
    expect(drawer).not.toMatch(/\.segmented > label\s*\{[^}]*text-overflow:\s*ellipsis/u);
    expect(drawer).toMatch(/\.radioField\[data-answers="chips"\]\s*\{[^}]*grid-column:\s*1 \/ -1/u);
    expect(drawer).toMatch(/\.segmented\[data-answers="chips"\] > label\s*\{[^}]*min-height:\s*40px/u);
  });

  it("Out of area: answers wrap, and three or more list one per line on a phone", () => {
    const board = css("ward-management/out-of-area/out-of-area-board.module.css");
    expect(board).toMatch(/\.choice\s*\{[^}]*flex-wrap:\s*wrap/u);
    expect(board).toMatch(/\.choice\[data-answers="list"\] \.choiceItem\s*\{[^}]*min-height:\s*40px/u);
  });
});
