import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * stats-6 (audit 13 Oct 2026): on a phone the Statistics pinned action ("Print the report",
 * "Open the ward") ended 24px above the dock, and the list scrolled visibly through the gap. It now
 * seats on the dock's flat edge with the same rule Handover's sticky bar uses.
 */
const css = readFileSync(
  path.join(process.cwd(), "src/components/ward-management/statistics/statistics-phone-body.module.css"),
  "utf8",
);
const handover = readFileSync(
  path.join(process.cwd(), "src/components/ward-management/handover/handover-phone.module.css"),
  "utf8",
);

function rule(source: string, selector: string): string {
  const start = source.indexOf(`${selector} {`);
  expect(start).toBeGreaterThan(-1);
  const body = source.slice(start);
  return body.slice(0, body.indexOf("\n}"));
}

const bottomOf = (block: string) => /bottom:\s*([^;]+);/u.exec(block)?.[1];

describe("Statistics pinned action on phone", () => {
  it("rests on the dock's flat edge, as Handover's bar does", () => {
    const pinned = rule(css, ".pinned");
    expect(pinned).not.toMatch(/bottom:\s*0;/u);
    expect(bottomOf(pinned)).toBe(bottomOf(rule(handover, ".sticky")));
  });
});
