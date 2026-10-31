import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ShowMoreRow, SHOW_MORE_MIN_HIDDEN, foldHidden, foldLimit } from "@/components/wf";

// Josh, 31 October 2026 (answer 21): fold a list only when at least two rows would be hidden, so
// there is never a "Show 1 more". Synthetic rows only.
describe("kit fold rule for Show more", () => {
  it("needs at least two hidden rows to fold", () => {
    expect(SHOW_MORE_MIN_HIDDEN).toBe(2);
    expect(foldLimit(9, 8)).toBe(9);
    expect(foldHidden(9, 8)).toBe(0);
    expect(foldLimit(10, 8)).toBe(8);
    expect(foldHidden(10, 8)).toBe(2);
    expect(foldLimit(8, 8)).toBe(8);
    expect(foldHidden(8, 8)).toBe(0);
    expect(foldLimit(3, 8)).toBe(3);
    expect(foldHidden(3, 8)).toBe(0);
    expect(foldLimit(0, 0)).toBe(0);
  });

  function List({ total }: { total: number }) {
    const [open, setOpen] = useState(false);
    const rows = Array.from({ length: total }, (_, index) => `Row ${index + 1}`);
    const shown = open ? rows : rows.slice(0, foldLimit(total, 8));
    const hidden = foldHidden(total, 8);
    return (
      <>
        <ul>
          {shown.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
        {hidden > 0 && !open ? <ShowMoreRow onClick={() => setOpen(true)}>Show {hidden} more</ShowMoreRow> : null}
      </>
    );
  }

  it("shows all nine rows with no Show more row", () => {
    render(<List total={9} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /show/i })).toBeNull();
  });

  it("folds ten rows behind Show 2 more", () => {
    render(<List total={10} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Show 2 more" })).toBeTruthy();
  });
});
