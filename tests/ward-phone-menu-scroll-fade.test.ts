import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * P108 (Josh, 27 Oct 2026, option A): the phone Menu sheet (with More at its end) can be longer than
 * the screen. A soft fade at the bottom edge shows while more of the list is below, with no text,
 * and goes once the end of the list is reached. CSS only: a `scroll`-attached fade at the bottom of
 * the scroller, covered by a `local` surface patch that travels with the content's end.
 */
const css = readFileSync(
  join(process.cwd(), "src/components/ward-management/shell/ward-phone-menu.module.css"),
  "utf8",
);

function rule(selector: string): string {
  const match = css.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("P108 phone menu scroll fade", () => {
  it("fades the bottom edge only while more of the list is below", () => {
    const body = rule(".body");
    expect(body).toMatch(/background-attachment:\s*local,\s*scroll/);
    expect(body).toMatch(/background-image:[^;]*linear-gradient[^;]*linear-gradient/);
  });
});
