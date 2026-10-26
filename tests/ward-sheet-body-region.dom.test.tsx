// Design re-score DR-12 (24 Oct 2026): a sheet body given a tab stop is a named region, so the
// phone Activity sheet's list can be reached and scrolled with the keyboard.
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Sheet } from "@/components/wf/sheet";

afterEach(cleanup);

describe("DR-12: a focusable sheet body is a named region", () => {
  it("gives the body a tab stop and a name when asked", () => {
    render(
      <Sheet open onClose={() => undefined} title="Activity" bodyTabIndex={0} bodyLabel="Activity list">
        <p>Synthetic event</p>
      </Sheet>,
    );
    const body = screen.getByRole("region", { name: "Activity list" });
    expect(body).toHaveAttribute("tabindex", "0");
    expect(body).toHaveTextContent("Synthetic event");
  });
});
