// DA-17 (overall review, 20 Oct 2026): hospital, service and ward codes carry their full name.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SpelledCodes, codeName } from "@/components/ward-management/ward-abbreviations";

describe("codes on screen are spelt out", () => {
  it("names a hospital site and a health service from the app's own lists", () => {
    expect(codeName("SCGH")).toBe("Sir Charles Gairdner Hospital");
    expect(codeName("WACHS")).toBe("WA Country Health Service");
    expect(codeName("ED")).toBeUndefined();
    expect(codeName("XYZ")).toBeUndefined();
  });

  it("marks each known code with its full name and leaves the rest of the words as written", () => {
    const { container } = render(<SpelledCodes text="SCGH Adult Acute from RPH ED, XYZ" />);
    const abbrs = [...container.querySelectorAll("abbr")];
    expect(abbrs.map((abbr) => [abbr.textContent, abbr.getAttribute("title")])).toEqual([
      ["SCGH", "Sir Charles Gairdner Hospital"],
      ["RPH", "Royal Perth Hospital"],
    ]);
    // Screen readers hear the full name too, since an <abbr> hint is not reliably read.
    expect(container.textContent).toBe(
      "SCGH (Sir Charles Gairdner Hospital) Adult Acute from RPH (Royal Perth Hospital) ED, XYZ",
    );
  });

  it("renders plain text untouched when there is no code", () => {
    const { container } = render(<SpelledCodes text="North Metro" />);
    expect(container.innerHTML).toBe("North Metro");
  });
});
