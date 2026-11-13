import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroStat, PillTabs, Segmented, WindowWord } from "@/components/wf";

/**
 * Shared design parts item 2 (13 Nov 2026): a count can carry its time window, from one fixed list.
 * The word is drawn quiet after a middle dot (under the label in equal segments and on a phone),
 * the dot is hidden from screen readers, and the window is part of the spoken name. (jsdom joins
 * inline parts without the spaces a browser adds, so names are matched with `\s*`.)
 */
describe("count window words", () => {
  it("HeroStat speaks its figure, label and window", () => {
    render(<HeroStat value={14} label="Discharges" window="any date" onToggle={() => {}} command />);
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName(/^14\s*Discharges\s*any date$/u);
    expect(button.querySelector('[data-wf-window="any date"]')).not.toBeNull();
  });

  it("HeroStat without a window is unchanged", () => {
    render(<HeroStat value={3} label="Ready" onToggle={() => {}} command />);
    expect(screen.getByRole("button")).toHaveAccessibleName(/^3\s*Ready$/u);
    expect(screen.getByRole("button").querySelector("[data-wf-window]")).toBeNull();
  });

  it("Segmented puts the window in each option's name, label first", () => {
    render(
      <Segmented
        label="Ward flow list"
        value="referrals"
        onChange={() => {}}
        items={[
          { id: "referrals", label: "Referrals", count: 0, window: "now" },
          { id: "discharges", label: "Discharges", count: 14, window: "any date" },
        ]}
      />,
    );
    expect(screen.getByRole("radio", { name: /^Referrals/u })).toHaveAccessibleName(/^Referrals\s*0\s*now$/u);
    expect(screen.getByRole("radio", { name: /^Discharges/u })).toHaveAccessibleName(/^Discharges\s*14\s*any date$/u);
  });

  it("in running text, a count phrase and its window stay together with no dot of their own", () => {
    const { container } = render(
      <p>
        <WindowWord word="now" of="0 referrals" />
        {"\u00a0· "}
        <WindowWord word="any date" of="14 discharges" />
      </p>,
    );
    const words = [...container.querySelectorAll("[data-wf-window]")];
    expect(words.map((word) => word.parentElement?.textContent)).toEqual(["0 referrals now", "14 discharges any date"]);
    // The group is one unbreakable unit, so a wrap falls only between counts.
    expect(words.every((word) => word.parentElement !== container.firstElementChild)).toBe(true);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0);
  });

  it("pill tabs draw the window after a middle dot that screen readers skip", () => {
    render(
      <PillTabs
        label="Ward panel"
        value="ward"
        onChange={() => {}}
        items={[
          { id: "ward", label: "Ward" },
          { id: "discharges", label: "Discharges", count: 14, window: "any date" },
        ]}
      />,
    );
    const tab = screen.getByRole("tab", { name: /^Discharges/u });
    expect(tab).toHaveAccessibleName(/^Discharges\s*14\s*any date$/u);
    const word = tab.querySelector('[data-wf-window="any date"]') as HTMLElement;
    expect(word.textContent).toContain("·");
    expect(word.querySelector('[aria-hidden="true"]')?.textContent).toBe("·");
    expect(screen.getByRole("tab", { name: "Ward" })).toHaveAccessibleName("Ward");
  });
});
