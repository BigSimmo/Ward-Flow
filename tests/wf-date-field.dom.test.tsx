/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DATE_FIELD_ERROR,
  DateField,
  DateTimeField,
  Field,
  TIME_FIELD_ERROR,
  TimeField,
  isoDateAsTyped,
  parseTypedDate,
  parseTypedTime,
  type DateFieldProps,
} from "@/components/wf";

describe("kit typed date box (DD/MM/YYYY)", () => {
  it("retains controlled unfinished text through hiding and clears it only on explicit reset", () => {
    function Harness() {
      const [value, setValue] = useState("");
      const [rawText, setRawText] = useState("");
      const [open, setOpen] = useState(true);
      return (
        <>
          {open ? (
            <DateField
              aria-label="Unfinished date"
              value={value}
              onValueChange={setValue}
              rawText={rawText}
              onRawTextChange={setRawText}
            />
          ) : null}
          <button onClick={() => setOpen(!open)}>Toggle date</button>
          <button
            onClick={() => {
              setValue("");
              setRawText("");
            }}
          >
            Reset date
          </button>
        </>
      );
    }
    render(<Harness />);
    fireEvent.change(screen.getByRole("textbox", { name: "Unfinished date" }), { target: { value: "12/" } });
    fireEvent.click(screen.getByRole("button", { name: "Toggle date" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle date" }));
    expect(screen.getByRole("textbox", { name: "Unfinished date" })).toHaveValue("12/");
    fireEvent.click(screen.getByRole("button", { name: "Reset date" }));
    expect(screen.getByRole("textbox", { name: "Unfinished date" })).toHaveValue("");
  });

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
    // PR #1474 review: with no separator it takes exactly four digits, never "143" as 01:43.
    expect(parseTypedTime("143")).toBeNull();
    expect(parseTypedTime("2:30 pm")).toBeNull();
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

// Spec item 13 (C05, 13 Nov 2026): an impossible typed date or time says so under the box.
describe("default error words under the kit date and time boxes", () => {
  function Pair({ dateError }: { dateError?: string }) {
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    return (
      <>
        <Field label="Date" hint="DD/MM/YYYY" error={dateError}>
          <DateField value={date} onValueChange={setDate} />
        </Field>
        <Field label="Time" hint="HH:MM">
          <TimeField value={time} onValueChange={setTime} />
        </Field>
      </>
    );
  }

  it("shows the default words in the Field, tied to the box, and clears them once fixed", () => {
    render(<Pair />);
    const date = screen.getByRole("textbox", { name: "Date" });
    const time = screen.getByRole("textbox", { name: "Time" });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(date, { target: { value: "31/02/2026" } });
    fireEvent.change(time, { target: { value: "25:70" } });
    const dateError = screen.getByText(DATE_FIELD_ERROR);
    const timeError = screen.getByText(TIME_FIELD_ERROR);
    expect(DATE_FIELD_ERROR).toBe("Type a real date, DD/MM/YYYY");
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date.getAttribute("aria-describedby")?.split(" ")).toContain(dateError.id);
    expect(time.getAttribute("aria-describedby")?.split(" ")).toContain(timeError.id);
    fireEvent.change(date, { target: { value: "28/02/2026" } });
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
  });

  // F-139 (PR E review): unfinished text says so once the person leaves the box, never while typing.
  it("marks an unfinished date on leaving the box, and clears it once typing resumes", () => {
    render(<Pair />);
    const date = screen.getByRole("textbox", { name: "Date" });
    for (const unfinished of ["1/1/26", "1/1", "31/10/202"]) {
      fireEvent.change(date, { target: { value: unfinished } });
      expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
      expect(date).not.toHaveAttribute("aria-invalid", "true");
      fireEvent.blur(date);
      expect(screen.getByText(DATE_FIELD_ERROR)).toBeInTheDocument();
      expect(date).toHaveAttribute("aria-invalid", "true");
      expect(date.getAttribute("aria-describedby")?.split(" ")).toContain(screen.getByText(DATE_FIELD_ERROR).id);
    }
    fireEvent.change(date, { target: { value: "1/1/202" } });
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
    fireEvent.change(date, { target: { value: "1/1/2026" } });
    fireEvent.blur(date);
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
    fireEvent.change(date, { target: { value: "" } });
    fireEvent.blur(date);
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
    expect(date).not.toHaveAttribute("aria-invalid", "true");
  });

  it("marks an unfinished date in a date-and-time pair on leaving the date box", () => {
    render(<DateTimeField label="Written" data-testid="pair" />);
    const date = screen.getByTestId("pair-date");
    fireEvent.change(date, { target: { value: "1/1/26" } });
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
    fireEvent.blur(date);
    expect(screen.getByText(DATE_FIELD_ERROR)).toBeInTheDocument();
    expect(date).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(date, { target: { value: "1/1/2026" } });
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
  });

  it("lets the caller's own words win", () => {
    render(<Pair dateError="Date written cannot be in the future" />);
    fireEvent.change(screen.getByRole("textbox", { name: "Date" }), { target: { value: "31/02/2026" } });
    expect(screen.getByText("Date written cannot be in the future")).toBeInTheDocument();
    expect(screen.queryByText(DATE_FIELD_ERROR)).toBeNull();
  });

  it("draws its own line outside a Field, and one line under a date-and-time pair", () => {
    function Bare() {
      const [time, setTime] = useState("");
      return <TimeField aria-label="Bare time" value={time} onValueChange={setTime} />;
    }
    const { unmount } = render(<Bare />);
    const box = screen.getByRole("textbox", { name: "Bare time" });
    fireEvent.change(box, { target: { value: "2:30 pm" } });
    expect(box.getAttribute("aria-describedby")).toBe(screen.getByText(TIME_FIELD_ERROR).id);
    unmount();

    render(<DateTimeField label="Written" data-testid="pair" />);
    fireEvent.change(screen.getByTestId("pair-date"), { target: { value: "31/02/2026" } });
    fireEvent.change(screen.getByTestId("pair-time"), { target: { value: "25:70" } });
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText(DATE_FIELD_ERROR)).toBeInTheDocument();
    expect(screen.getByTestId("pair-time")).toHaveAttribute("aria-describedby", screen.getByText(DATE_FIELD_ERROR).id);
  });
});
