import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 16 Nov 2026 live demo walk, layout fixes: nothing cut at 1280 on the ED board tools, the officer
 * transport rows and Add patient's sex hint, and a tighter Referrals phone top. CSS contract only;
 * the look is checked in a browser.
 */
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

/** The first rule block for a selector, from the selector to its closing brace. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("ED handover tools at 1280", () => {
  const css = read("src/components/ward-management/ed/ed-handover.module.css");

  it("wraps the tool row instead of squeezing Export and Enlarge", () => {
    const tools = block(css, ".handoverTools");
    expect(tools).toContain("flex-wrap: wrap");
    expect(tools).toContain("justify-content: flex-end");
    expect(block(css, ".handoverTools > *")).toContain("flex-shrink: 0");
    expect(block(css, ".handoverHead")).toContain("flex-wrap: wrap");
  });

  it("lets only the search box give way", () => {
    expect(block(css, ".handoverTools > .handoverSearch")).toContain("flex: 0 1 15rem");
  });
});

describe("officer transport rows above phone width", () => {
  const css = read("src/components/ward-management/officer/officer.module.css");

  it("wraps the ETA and forms words rather than cutting them", () => {
    const media = css.slice(css.indexOf("16 Nov live walk: at 1280 the ETA cell"));
    expect(block(media, ".jobsTable .etaCell")).toContain("white-space: normal");
    expect(block(media, ".jobsTable .etaCell")).toContain("flex-wrap: wrap");
    expect(block(media, ".jobsTable .etaCell b")).toContain("white-space: nowrap");
    expect(block(media, ".jobsTable .formsCell > span:last-child")).toContain("white-space: normal");
  });

  it("gives the forms column 14% of the table", () => {
    expect(block(css, ".jobsTable th:nth-child(4)")).toContain("width: 14%");
  });
});

describe("Add patient sex hint", () => {
  it("wraps the hint in full, never with an ellipsis", () => {
    const hint = block(read("src/components/ward-management/patients/add-patient.module.css"), ".choiceHint");
    expect(hint).not.toContain("ellipsis");
    expect(hint).not.toContain("nowrap");
  });

  it("puts the sex choices on a row of their own", () => {
    expect(read("src/components/ward-management/patients/add-patient.tsx")).toContain(
      "cx(styles.choiceField, styles.spanAll)",
    );
  });
});

describe("Referrals phone top", () => {
  it("closes the gaps between the top's rows on a phone", () => {
    const css = read("src/components/ward-management/referrals/referral-board-top.module.css");
    const phone = css.slice(css.lastIndexOf("@media (max-width: 46.4375rem)"));
    expect(block(phone, ".heroTop.heroTop")).toContain("gap: var(--wf-s-3)");
    expect(block(phone, ".heroTop.heroTop")).toContain("margin-top: var(--wf-s-2)");
    expect(read("src/components/ward-management/referrals/referral-board-top.tsx")).toContain(
      "className={top.heroTop}",
    );
  });
});
