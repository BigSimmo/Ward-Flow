/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DateField, isoDateAsTyped, parseTypedDate, type DateFieldProps } from "@/components/wf";

describe("kit typed date box (DD/MM/YYYY)", () => {
  it("reads the day as written in Australia and refuses days that do not exist", () => {
    expect(parseTypedDate("31/10/2026")).toBe("2026-10-31");
    expect(parseTypedDate("1/9/2026")).toBe("2026-09-01");
    expect(parseTypedDate("31-10-2026")).toBe("2026-10-31");
    expect(parseTypedDate("31.10.2026")).toBe("2026-10-31");
    expect(parseTypedDate("31102026")).toBe("2026-10-31");
    expect(parseTypedDate("29/02/2028")).toBe("2028-02-29");
    expect(parseTypedDate("29/02/2027")).toBeNull();
    expect(parseTypedDate("31/02/2026")).toBeNull();
    expect(parseTypedDate("13/13/2026")).toBeNull();
    expect(parseTypedDate("10/31/2026")).toBeNull();
    expect(parseTypedDate("2026-10-31")).toBeNull();
    expect(isoDateAsTyped("2026-10-31")).toBe("31/10/2026");
    expect(isoDateAsTyped("")).toBe("");
  });

  it("starts empty, hands YYYY-MM-DD to the caller, and marks a finished wrong date", () => {
    const seen: string[] = [];
    // A page passes the kit's own prop type through, as a form wrapper would.
    const fieldProps = (value: string, setValue: (iso: string) => void): DateFieldProps => ({
      "aria-label": "Date written",
      value,
      onValueChange: (iso) => {
        seen.push(iso);
        setValue(iso);
      },
    });
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <>
          <DateField {...fieldProps(value, setValue)} />
          <button type="button" onClick={() => setValue("2026-01-05")}>
            Load record
          </button>
        </>
      );
    }
    render(<Harness />);
    const box = screen.getByRole("textbox", { name: "Date written" });
    expect(box).toHaveValue("");
    expect(box).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(box).toHaveAttribute("inputmode", "numeric");

    fireEvent.change(box, { target: { value: "31/10" } });
    expect(seen.at(-1)).toBe("");
    expect(box).not.toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveValue("31/10");

    fireEvent.change(box, { target: { value: "31/10/2026" } });
    expect(seen.at(-1)).toBe("2026-10-31");
    expect(box).toHaveValue("31/10/2026");

    fireEvent.change(box, { target: { value: "31/02/2026" } });
    expect(seen.at(-1)).toBe("");
    expect(box).toHaveAttribute("aria-invalid", "true");

    fireEvent.click(screen.getByRole("button", { name: "Load record" }));
    expect(box).toHaveValue("05/01/2026");
  });
});
