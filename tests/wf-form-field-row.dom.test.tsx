/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Field, TextInput } from "@/components/wf";

/*
 * Spec item 17 (C32, 13 Nov 2026): the kit Field's error and help lines always sit under the box, at
 * the full width of the answer. The row layout puts the label beside the answer and keeps the lines
 * in the answer column; a reserved line keeps the room so an error appearing moves nothing.
 */
describe("kit Field lines under the box", () => {
  it("keeps the error and help with the box in the row layout's answer column", () => {
    render(
      <Field label="Depart" layout="row" error="Type a 24-hour time, HH:MM" help="Leave blank if not booked">
        <TextInput data-testid="depart" />
      </Field>,
    );
    const box = screen.getByTestId("depart");
    const field = box.closest("[data-layout]")!;
    const answer = screen.getByRole("alert").parentElement!;
    expect(field).toHaveAttribute("data-layout", "row");
    expect(answer.parentElement).toBe(field);
    expect(answer).toContainElement(box);
    // Label row first, then one answer column holding the box, the error and the help, in that order.
    expect(field.children).toHaveLength(2);
    expect(field.children[0]).toContainElement(screen.getByText("Depart"));
    const error = screen.getByRole("alert");
    const help = screen.getByText("Leave blank if not booked");
    expect(answer).toContainElement(error);
    expect(answer).toContainElement(help);
    expect(box.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(error.compareDocumentPosition(help) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Depart" })).toHaveAccessibleDescription(/Type a 24-hour time, HH:MM/u);
  });

  it("keeps the stack layout's structure: label row, box, then lines", () => {
    render(
      <Field label="CAD number" error="Not a CAD number">
        <TextInput data-testid="cad" />
      </Field>,
    );
    const field = screen.getByRole("alert").parentElement!;
    expect(field).toHaveAttribute("data-layout", "stack");
    expect(field.lastElementChild).toBe(screen.getByRole("alert"));
  });

  it("reserves one line under the box while there is nothing to say", () => {
    const { container, rerender } = render(
      <Field label="Depart" reserveLine>
        <TextInput />
      </Field>,
    );
    const field = container.querySelector('[data-layout="stack"]')!;
    const before = field.children.length;
    expect(field.lastElementChild).toHaveAttribute("aria-hidden", "true");
    rerender(
      <Field label="Depart" reserveLine error="Type a 24-hour time, HH:MM">
        <TextInput />
      </Field>,
    );
    // The error takes the reserved line's place, so nothing below moves.
    expect(field.children).toHaveLength(before);
    expect(field.lastElementChild).toHaveAttribute("role", "alert");
  });
});
