/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DateField,
  DateTimeField,
  isoDateAsTyped,
  parseTypedDate,
  parseTypedTime,
  type DateFieldProps,
} from "@/components/wf";

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

describe("kit typed date and time (DD/MM/YYYY plus HH:MM)", () => {
  it("reads a 24-hour time as typed and refuses one that does not exist", () => {
    expect(parseTypedTime("14:30")).toBe("14:30");
    expect(parseTypedTime("9:05")).toBe("09:05");
    expect(parseTypedTime("1430")).toBe("14:30");
    expect(parseTypedTime("24:00")).toBeNull();
    expect(parseTypedTime("12:60")).toBeNull();
    expect(parseTypedTime("2pm")).toBeNull();
  });

  it("joins both boxes as YYYY-MM-DDTHH:MM only once each is real, and carries it in a named form", () => {
    const seen: string[] = [];
    const { container } = render(
      <form>
        <label htmlFor="when">When</label>
        <DateTimeField id="when" name="when" label="When" onValueChange={(v) => seen.push(v)} />
      </form>,
    );
    const date = screen.getByLabelText("When");
    const time = screen.getByRole("textbox", { name: "When time, HH:MM 24-hour" });
    const hidden = container.querySelector<HTMLInputElement>('input[type="hidden"][name="when"]');
    expect(date).toHaveAttribute("placeholder", "DD/MM/YYYY");
    expect(time).toHaveAttribute("placeholder", "HH:MM");

    fireEvent.change(date, { target: { value: "01/11/2026" } });
    expect(seen.at(-1)).toBe("");
    fireEvent.change(time, { target: { value: "25:00" } });
    expect(seen.at(-1)).toBe("");
    expect(time).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(time, { target: { value: "16:05" } });
    expect(seen.at(-1)).toBe("2026-11-01T16:05");
    expect(hidden?.value).toBe("2026-11-01T16:05");
  });

  it("shows a value the caller loads, and nothing is filled in on its own", () => {
    function Host() {
      const [value, setValue] = useState("");
      return (
        <>
          <label htmlFor="written">Written</label>
          <DateTimeField id="written" label="Written" value={value} onValueChange={setValue} />
          <button type="button" onClick={() => setValue("2026-03-12T08:30")}>
            Load
          </button>
        </>
      );
    }
    render(<Host />);
    const date = screen.getByLabelText("Written");
    const time = screen.getByRole("textbox", { name: "Written time, HH:MM 24-hour" });
    expect(date).toHaveValue("");
    expect(time).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(date).toHaveValue("12/03/2026");
    expect(time).toHaveValue("08:30");
  });
});
