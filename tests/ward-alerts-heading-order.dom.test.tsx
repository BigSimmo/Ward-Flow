import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { GroupHead } from "@/components/ward-management/alerts/alerts-queue";

// P073: Alerts and Home jump from the page h1 straight to these group heads, so they must be
// level 2, not level 3, for screen-reader heading navigation to keep its order.
describe("Alerts group heads keep heading order", () => {
  it("renders each group head as a level 2 heading", () => {
    render(<GroupHead tone="danger" label="Act now" count={2} />);
    expect(screen.getByRole("heading", { level: 2, name: /Act now/ })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });
});
