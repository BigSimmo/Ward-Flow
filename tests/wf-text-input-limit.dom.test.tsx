import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  });

  it("shows the count near the cap and says when the cap is reached", () => {
    const view = input("x".repeat(85), 100);
    expect(screen.getByTestId("wf-input-limit")).toHaveTextContent("85/100");
    expect(screen.getByRole("status")).toHaveTextContent("");
    view.rerender(
      <Field label="Suburb">
        <TextInput value={"x".repeat(100)} maxLength={100} onChange={() => {}} />
      </Field>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Limit of 100 characters reached");
  });
});
