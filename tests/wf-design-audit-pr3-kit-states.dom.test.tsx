import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useRef, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Checkbox,
  FilterChip,
  ListPicker,
  Radio,
  Segmented,
  Select,
  Switch,
  TextInput,
  TimeField,
} from "@/components/wf";
import { DateField } from "@/components/wf/date-field";
import { Sheet } from "@/components/wf/sheet";

/**
 * Design audit PR 3 (5 Nov 2026): kit, focus and states. Synthetic values only.
 */
const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

/** One CSS rule block, from its selector to its closing brace. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("K11: kit controls that cannot be changed now carry their reason", () => {
  const REASON = "Only the bed coordinator can change this";

  function described(element: HTMLElement): string {
    const ids = element.getAttribute("aria-describedby") ?? "";
    return ids
      .split(/\s+/u)
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");
  }

  it("Segmented: aria-disabled options keep their tab stop, refuse presses and name the reason", () => {
    const onChange = vi.fn();
    render(
      <Segmented
        label="Shift"
        value="am"
        onChange={onChange}
        disabledReason={REASON}
        items={[
          { id: "am", label: "Morning" },
          { id: "pm", label: "Evening" },
        ]}
      />,
    );
    const evening = screen.getByRole("radio", { name: "Evening" });
    expect(evening).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(evening);
    expect(onChange).not.toHaveBeenCalled();
    expect(described(screen.getByRole("radiogroup", { name: "Shift" }))).toContain(REASON);
    expect(screen.getByText(REASON)).toBeVisible();
  });

  it("FilterChip: refuses the press and names the reason", () => {
    const onPressedChange = vi.fn();
    render(
      <FilterChip pressed={false} onPressedChange={onPressedChange} disabledReason={REASON}>
        Over 85%
      </FilterChip>,
    );
    const chip = screen.getByRole("button", { name: "Over 85%" });
    fireEvent.click(chip);
    expect(onPressedChange).not.toHaveBeenCalled();
    expect(chip).toHaveAttribute("aria-disabled", "true");
    expect(described(chip)).toContain(REASON);
  });

  it("ListPicker: the field keeps its tab stop, does not open, and names the reason", () => {
    render(
      <ListPicker
        label="Site"
        value={null}
        onChange={() => {}}
        options={[{ value: "a", label: "Synthetic site A" }]}
        disabledReason={REASON}
      />,
    );
    const field = screen.getByRole("combobox", { name: "Site" });
    expect(field).not.toBeDisabled();
    expect(field).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(field);
    expect(field).toHaveAttribute("aria-expanded", "false");
    expect(described(field)).toContain(REASON);
  });

  it("TextInput and DateField: read only with aria-disabled and the reason", () => {
    render(
      <>
        <TextInput aria-label="Escort" defaultValue="" disabledReason={REASON} />
        <DateField aria-label="Date written" value="" onValueChange={() => {}} disabledReason={REASON} />
      </>,
    );
    for (const name of ["Escort", "Date written"]) {
      const box = screen.getByRole("textbox", { name });
      expect(box).toHaveAttribute("readonly");
      expect(box).toHaveAttribute("aria-disabled", "true");
      expect(described(box)).toContain(REASON);
    }
  });

  it("Select: keeps its tab stop and refuses a change", () => {
    function Harness() {
      const [value, setValue] = useState("a");
      return (
        <Select
          aria-label="Ward"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabledReason={REASON}
        >
          <option value="a">Synthetic ward A</option>
          <option value="b">Synthetic ward B</option>
        </Select>
      );
    }
    render(<Harness />);
    const select = screen.getByRole("combobox", { name: "Ward" });
    expect(select).not.toBeDisabled();
    expect(select).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(select, { target: { value: "b" } });
    expect(select).toHaveValue("a");
    expect(described(select)).toContain(REASON);
  });

  it("Checkbox, Radio and Switch: refuse the change and name the reason", () => {
    const onCheckedChange = vi.fn();
    render(
      <>
        <Checkbox label="Escort booked" disabledReason={REASON} />
        <Radio label="Locked bed" name="bed" disabledReason={REASON} />
        <Switch label="Show closed" checked={false} onCheckedChange={onCheckedChange} disabledReason={REASON} />
      </>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "Escort booked" });
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(described(checkbox)).toContain(REASON);
    const radio = screen.getByRole("radio", { name: "Locked bed" });
    fireEvent.click(radio);
    expect(radio).not.toBeChecked();
    const toggle = screen.getByRole("switch", { name: "Show closed" });
    fireEvent.click(toggle);
    expect(onCheckedChange).not.toHaveBeenCalled();
    expect(toggle).toHaveAttribute("aria-disabled", "true");
    expect(described(toggle)).toContain(REASON);
  });
});

describe("W14: the kit typed time box", () => {
  function Harness({ initial = "" }: { initial?: string }) {
    const [time, setTime] = useState(initial);
    return (
      <>
        <TimeField aria-label="Arrival time" value={time} onValueChange={setTime} />
        <output data-testid="time-value">{time}</output>
      </>
    );
  }

  it("is a text box, not the browser time picker, and gives HH:MM once the time is real", () => {
    render(<Harness />);
    const box = screen.getByRole("textbox", { name: "Arrival time" });
    expect(box).toHaveAttribute("type", "text");
    expect(box).toHaveAttribute("placeholder", "HH:MM");
    fireEvent.change(box, { target: { value: "14" } });
    expect(screen.getByTestId("time-value")).toHaveTextContent(/^$/u);
    expect(box).toHaveValue("14");
    fireEvent.change(box, { target: { value: "1430" } });
    expect(screen.getByTestId("time-value")).toHaveTextContent("14:30");
    expect(box).toHaveValue("1430");
  });

  it("marks a finished time that is not real, and keeps a value given by the caller", () => {
    render(<Harness initial="09:05" />);
    const box = screen.getByRole("textbox", { name: "Arrival time" });
    expect(box).toHaveValue("09:05");
    fireEvent.change(box, { target: { value: "25:00" } });
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("time-value")).toHaveTextContent(/^$/u);
  });
});

describe("K1 and K3: kit controls grow with large text in every engine", () => {
  it("buttons, options and fields use a floor (min-height) with an auto height, calc-size only as an extra", () => {
    const button = read("src/components/wf/button.module.css");
    for (const selector of [".b", ".sm", ".lg"]) {
      const rule = block(button, selector);
      expect(rule, selector).toMatch(/min-height: var\(--wf-h-(md|sm|lg)\);\s*height: auto;\s*height: calc-size/u);
      expect(rule, selector).not.toMatch(/\n\s*height: var\(/u);
    }
    const choice = read("src/components/wf/choice.module.css");
    expect(block(choice, ".segItem")).toMatch(/min-height: var\(--wf-target\);\s*height: auto;/u);
    expect(block(choice, ".tab")).toContain("min-height: 34px");
    expect(choice).not.toMatch(/html\) \.segItem\.segItem,\s*:global\(html\) \.ptItem\.ptItem \{\s*height: 30px/u);
    const form = read("src/components/wf/form.module.css");
    expect(block(form, ".in")).toMatch(/min-height: max\(var\(--wf-h-md\), var\(--wf-tablet-tap, 0px\)\);/u);
    expect(block(form, ".in")).not.toMatch(/\n\s*height: var\(--wf-h-md\)/u);
    expect(block(form, ".control")).toContain("align-self: stretch");
    for (const [file, selector] of [
      ["src/components/wf/badge.module.css", ".bd"],
      ["src/components/wf/v10-pass2.module.css", ".pill"],
      ["src/components/wf/live.module.css", ".lv"],
      ["src/components/wf/show-more-row.module.css", ".row"],
      ["src/components/wf/time-presets.module.css", ".preset"],
      ["src/components/wf/feed.module.css", ".upToDate"],
    ] as const) {
      expect(block(read(file), selector), `${file} ${selector}`).toMatch(/\n\s*min-height: /u);
      expect(block(read(file), selector), `${file} ${selector}`).not.toMatch(/\n\s*height: \d/u);
    }
  });
});

describe("chip strip edge fade", () => {
  it("writes the scroll-driven fade as longhands, so the CSS build cannot fold it into a shorthand Chrome drops", () => {
    for (const file of ["src/components/wf/choice.module.css", "src/components/wf/v10-pass2.module.css"]) {
      const css = read(file);
      expect(css, file).not.toMatch(/animation: wfRowFade/u);
      expect(css, file).toMatch(/animation-name: wfRowFade;\s*animation-duration: 1ms;/u);
    }
  });
});

describe("K2: fields outside the kit take the kit focus ring", () => {
  it("draws a 2px solid ring with a 2px gap, from the kit token", () => {
    const globals = read("src/app/globals.css");
    const start = globals.indexOf(':where(input:not([type="checkbox"])');
    const rule = globals.slice(start, globals.indexOf("}", start));
    expect(rule).toContain("outline: 2px solid var(--wf-focus-ring, var(--focus));");
    expect(rule).toContain("outline-offset: 2px;");
    expect(rule).not.toContain("outline: 1px");
  });
});

describe("K15: Ward Flow's own z-index tokens", () => {
  it("declares the scale in the v9 tokens with the legacy values, and the kit reads it", () => {
    const tokens = read("src/app/ward-flow-v9-tokens.css");
    for (const [name, value] of [
      ["base", 0],
      ["raised", 10],
      ["chrome", 60],
      ["overlay", 80],
      ["popover", 95],
      ["modal", 100],
      ["toast", 110],
    ] as const) {
      expect(tokens).toContain(`--wf-z-${name}: ${value};`);
      expect(read("src/app/ckb-v2-tokens.css")).toMatch(new RegExp(`--z-${name}: ${value};`, "u"));
    }
    for (const file of ["dialog.module.css", "list-picker.module.css", "overlay.module.css", "phone.module.css"]) {
      expect(read(`src/components/wf/${file}`), file).not.toMatch(/var\(--z-/u);
    }
    expect(read("src/components/ward-management/ed/ed-handover.module.css")).not.toContain("var(--z-overlay, 60)");
  });
});

describe("states", () => {
  it("ST4: the first-load note rests at the foot of the window at every width", () => {
    const note = block(read("src/app/ward-flow/ward-flow-layout.module.css"), ".loadingNote");
    expect(note).toContain("bottom: 0.75rem");
    expect(note).not.toContain("top:");
  });

  it("ST8: the offline note rests at the foot of the window, above the dock on a phone", () => {
    const css = read("src/components/ward-management/shell/ward-offline-banner.module.css");
    const banner = block(css, ".banner");
    expect(banner).toContain("position: fixed");
    expect(banner).toContain("bottom: 0.75rem");
    expect(css).toMatch(/\.banner \{\s*bottom: calc\(var\(--wf-dock-clear/u);
  });

  it("ST6: the route error panel is drawn from kit tokens, not host classes", () => {
    const panel = read("src/app/ward-flow/ward-flow-error-panel.tsx");
    expect(panel).not.toMatch(/--surface-lux|--text-heading|--danger-soft|primaryControl/u);
    expect(panel).toContain('from "@/components/wf"');
    expect(read("src/app/ward-flow/ward-flow-error-panel.module.css")).not.toMatch(/#[0-9a-f]{3,6}\b|rgb\(/iu);
  });

  it("D7: the Bed alerts tag shrinks and wraps, so the chevron stays inside the card", () => {
    const rule = block(
      read("src/components/ward-management/shell-next/next-rail.module.css"),
      ".capacityHead > :nth-child(2)",
    );
    expect(rule).toContain("min-width: 0");
    expect(rule).toContain("white-space: normal");
  });

  it("W34: a confirm whose dialog code fails to load keeps editing, never the browser box", () => {
    const confirm = read("src/components/wf/confirm-dialog.tsx");
    expect(confirm).toMatch(/function keepEditing\(current: Pending\) \{\s*settle\(current, false\);/u);
    // The only browser box left is the no-host fallback (a test or a page outside the app frame).
    expect(confirm.match(/window\.confirm\(/gu)).toHaveLength(1);
  });
});

describe("D3: a closed pop-up whose opener has gone hands focus to the shell's Menu button", () => {
  // The Help sheet opened from the phone Menu: the menu item that opened it has gone with the menu.
  function Harness() {
    const [menuOpen, setMenuOpen] = useState(true);
    const [helpOpen, setHelpOpen] = useState(false);
    const openerRef = useRef<HTMLElement | null>(null);
    return (
      <>
        <button type="button" data-wf-focus-fallback="">
          Menu
        </button>
        {menuOpen ? (
          <button
            type="button"
            ref={(node) => {
              if (node) openerRef.current = node;
            }}
            onClick={() => {
              setMenuOpen(false);
              setHelpOpen(true);
            }}
          >
            Help
          </button>
        ) : null}
        <Sheet open={helpOpen} onClose={() => setHelpOpen(false)} title="Help" returnFocusRef={openerRef}>
          <button type="button" onClick={() => setHelpOpen(false)}>
            Close help
          </button>
        </Sheet>
      </>
    );
  }

  it("returns focus to the Menu button, not the page body", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Help" }));
    await user.click(await screen.findByRole("button", { name: "Close help" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus());
  });

  it("never takes focus that has landed somewhere else", async () => {
    function Elsewhere() {
      const [open, setOpen] = useState(true);
      const otherRef = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button" data-wf-focus-fallback="">
            Menu
          </button>
          <button type="button" ref={otherRef}>
            Other
          </button>
          <Sheet open={open} onClose={() => setOpen(false)} title="Help">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                otherRef.current?.focus();
              }}
            >
              Close to other
            </button>
          </Sheet>
        </>
      );
    }
    const user = userEvent.setup();
    render(<Elsewhere />);
    await user.click(await screen.findByRole("button", { name: "Close to other" }));
    await new Promise((done) => setTimeout(done, 80));
    expect(screen.getByRole("button", { name: "Menu" })).not.toHaveFocus();
  });
});
