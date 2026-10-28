import { describe, expect, it } from "vitest";
import { isTypingTarget } from "@/components/ward-management/shell/ward-rail-preferences";

// Audit row P052: page shortcuts (J/K/?/[ and Shift+letter drawers) leave any text field alone.
function make(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe("isTypingTarget (P052)", () => {
  it.each([
    "<input />",
    "<textarea></textarea>",
    "<select><option>a</option></select>",
    '<div role="textbox" tabindex="0"></div>',
    '<div role="combobox" tabindex="0"></div>',
    '<div role="searchbox" tabindex="0"></div>',
    '<div role="combobox"><span tabindex="0">inner</span></div>',
  ])("treats %s as a field", (html) => {
    const el = make(html);
    const target = (el.querySelector("[tabindex]") as HTMLElement | null) ?? el;
    expect(isTypingTarget(target)).toBe(true);
  });

  it("treats a contenteditable child as a field", () => {
    const el = make('<div contenteditable="true"><b>x</b></div>');
    Object.defineProperty(el, "isContentEditable", { value: true });
    const child = el.querySelector("b") as HTMLElement;
    Object.defineProperty(child, "isContentEditable", { value: true });
    expect(isTypingTarget(child)).toBe(true);
  });

  it("leaves shortcuts on for buttons, links and the page itself", () => {
    expect(isTypingTarget(make("<button>Go</button>"))).toBe(false);
    expect(isTypingTarget(make('<a href="#x">x</a>'))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
