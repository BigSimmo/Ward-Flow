import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { FocusPanel } from "@/components/ward-management/legal-forms/legal-forms-panel";
import {
  instantFromDateAndTimeInputs,
  isOwnedLegalFormCode,
} from "@/components/ward-management/legal-forms/legal-forms-view";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const DAY_ZERO = new Date("2026-09-23T00:00:00");

/**
 * Bug list row 24 (31 Oct 2026): the side panel's "Record the time written" used the browser's
 * time picker, which shows a 12-hour clock in some browsers. It is now the typed 24-hour HH:MM
 * field Record a form uses, read by the same parser. Synthetic seed only.
 */
describe("Record the time written takes a typed 24-hour time", () => {
  it("is a plain HH:MM text box, and a typed time is saved as written", () => {
    const seed = seedWardFlowState();
    const base = seed.movements.find((movement) => isOwnedLegalFormCode(movement.legalForm?.code));
    if (!base) throw new Error("the seed needs a movement on an owned legal form");
    const movement = { ...base, formedAt: undefined };
    const onSaveWritten = vi.fn();
    render(
      <WardFlowProvider>
        <FocusPanel
          movement={movement}
          name="Synthetic, Person"
          umrn="UM000000"
          edName="Synthetic ED"
          wardName={null}
          now={NOW_ANCHOR}
          dayZero={DAY_ZERO}
          tab="now"
          onTab={() => {}}
          onClose={() => {}}
          focusGap={null}
          refusal={undefined}
          onSaveWritten={onSaveWritten}
          onMarkReceived={() => {}}
          onExtend={() => {}}
          onRecordNext={() => {}}
          onRequirements={() => {}}
          onCopy={() => {}}
          copied={false}
        />
      </WardFlowProvider>,
    );
    const form = screen.getByTestId(`ward-legal-forms-written-form-${movement.id}`);
    const time = within(form).getByLabelText("Time");
    expect(time).not.toHaveAttribute("type", "time");
    expect(time).toHaveAttribute("placeholder", "HH:MM");
    expect(time).toHaveAttribute("inputmode", "numeric");
    // Nothing is filled in for the person (no pre-selection).
    expect(time).toHaveValue("");

    // Typed as the form says, 24-hour, with or without the colon.
    // Date written is the kit DD/MM/YYYY box (Legal forms redesign, 31 Oct 2026).
    fireEvent.change(within(form).getByLabelText("Date written"), { target: { value: "23/09/2026" } });
    fireEvent.change(time, { target: { value: "0005" } });
    fireEvent.click(within(form).getByRole("button", { name: /Save time written/ }));
    expect(onSaveWritten).toHaveBeenCalledOnce();
    expect(onSaveWritten.mock.calls[0][0].writtenAt).toBe(
      instantFromDateAndTimeInputs("2026-09-23", "00:05", DAY_ZERO),
    );
  });
});
