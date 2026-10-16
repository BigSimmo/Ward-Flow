import { describe, expect, it } from "vitest";

import {
  findExplanatoryDisabledButtonViolations,
  scanWardExplanatoryButtons,
} from "../scripts/ward-flow/check-explanatory-buttons.mjs";

describe("AUD-A11Y-02 / TASK-L6-07: explanatory disabled button static guard", () => {
  it("flags a <button> that combines native disabled with aria-describedby", () => {
    const badSample = `
      export function Example({ unavailable }: { unavailable: boolean }) {
        return (
          <button
            type="button"
            disabled={unavailable}
            aria-describedby="why-unavailable"
          >
            Accept in principle
          </button>
        );
      }
    `;
    const violations = findExplanatoryDisabledButtonViolations(badSample, "example.tsx");
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("example.tsx");
    expect(violations[0]?.line).toBe(4);
  });

  it("permits aria-disabled with aria-describedby, disabled identifiers inside {...}, URLs in props, and native disabled without aria-describedby", () => {
    const goodSample = `
      export function Example({ disabled }: { disabled: boolean }) {
        return (
          <>
            <button
              type="button"
              data-doc="https://wa.gov.au/ward-flow"
              aria-disabled={
                disabled
              }
              aria-describedby={disabled ? "why-unavailable" : undefined}
              className={disabled ? "is-disabled" : "is-ready"}
              onClick={() => {
                if (disabled) return;
              }}
            >
              Accept in principle
            </button>
            <button type="button" disabled={disabled}>
              Plain disabled without aria-describedby
            </button>
          </>
        );
      }
    `;
    expect(findExplanatoryDisabledButtonViolations(goodSample, "good.tsx")).toEqual([]);
  });

  it("scans all Ward Flow .tsx components with a non-vacuous file floor and zero violations", () => {
    const { scannedFiles, violations } = scanWardExplanatoryButtons();
    expect(scannedFiles).toBeGreaterThan(100);
    expect(violations).toEqual([]);
  });
});
