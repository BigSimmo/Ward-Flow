import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Field, TextInput } from "@/components/wf";

afterEach(cleanup);

function input(value: string, maxLength?: number) {
  return render(
    <Field label="Suburb">
      <TextInput value={value} maxLength={maxLength} onChange={() => {}} />
    </Field>,
  );
}

describe("a capped text input (WF-30)", () => {
  it("shows nothing while well under the cap, or with no cap", () => {
    input("Perth", 100);
    expect(screen.queryByTestId("wf-input-limit")).not.toBeInTheDocument();
    cleanup();
    input("x".repeat(500));
    expect(screen.queryByTestId("wf-input-limit")).not.toBeInTheDocument();
    cleanup();
    // Short fixed-format fields (a 10-character date) fill to the cap as normal entry.
    input("25/10/2026", 10);
    expect(screen.queryByTestId("wf-input-limit")).not.toBeInTheDocument();
  });

  it("shows the count near the cap and says when the cap is reached", () => {
    const view = input("x".repeat(85), 100);
    expect(screen.getByTestId("wf-input-limit")).toHaveTextContent("85/100");
    // The status region is there, empty, before the cap, so the message is announced when it arrives.
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    view.rerender(
      <Field label="Suburb">
        <TextInput value={"x".repeat(100)} maxLength={100} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Limit of 100 characters reached");
  });

  it("counts an uncontrolled input from its default value and what is typed", () => {
    render(
      <Field label="Note">
        <TextInput defaultValue={"x".repeat(85)} maxLength={100} />
      </Field>,
    );
    expect(screen.getByTestId("wf-input-limit")).toHaveTextContent("85/100");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(100) } });
    expect(screen.getByRole("status")).toHaveTextContent("Limit of 100 characters reached");
  });
});
