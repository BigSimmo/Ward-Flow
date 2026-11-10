/**
 * Master audit M96 (10 Nov 2026): typing survives live updates. While a person types in a form,
 * board updates keep arriving (the clock moves, a ward confirms its bed count). The field must
 * keep its text, the caret where it was, its scroll position and focus, and must not be remounted.
 * Covers the two main typed forms: Add a patient and the referral slide-out (Patient story).
 * Overlay focus return is covered elsewhere (tests/ward-modal-focus.dom.test.tsx). Synthetic data only.
 */
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { ConfirmHost } from "@/components/wf";
import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

/** Board updates, as a poll or another desk would deliver them. */
let pushUpdate: () => void = () => {};
function Updates() {
  const flow = useWardFlow();
  // Re-bound after every render, so each update starts from the board as it now stands.
  useEffect(() => {
    pushUpdate = () => {
      const unit = flow.units[0];
      void flow.dispatch({ type: "ADVANCE_CLOCK", role: "demo", now: flow.now, minutes: 1 } as WardFlowEvent);
      void flow.dispatch({
        type: "CONFIRM_CAPACITY",
        role: "ward",
        now: flow.now,
        unitId: unit.id,
        actingUnitId: unit.id,
        value: unit.allocatable.value,
        expectedRevision: unit.allocatable.revision ?? 0,
      } as unknown as WardFlowEvent);
    };
  });
  return <output data-testid="board-now">{flow.now}</output>;
}

/** Types `text` a character at a time at the caret, with a board update after every character. */
function typeWithUpdates(field: HTMLInputElement | HTMLTextAreaElement, text: string) {
  for (const character of text) {
    const at = field.selectionStart ?? field.value.length;
    const value = field.value.slice(0, at) + character + field.value.slice(field.selectionEnd ?? at);
    fireEvent.change(field, { target: { value } });
    field.setSelectionRange(at + 1, at + 1);
    act(() => pushUpdate());
  }
}

/** The rule itself: same node, same text, caret and scroll where the person left them, still focused. */
function expectTypingKept(find: () => HTMLInputElement | HTMLTextAreaElement, start: string, insert: string) {
  const field = find();
  field.focus();
  fireEvent.change(field, { target: { value: start } });
  // Put the caret in the middle, as when correcting a word, and scroll the field.
  const middle = Math.floor(start.length / 2);
  field.setSelectionRange(middle, middle);
  field.scrollTop = 24;
  const before = Number(screen.getByTestId("board-now").textContent);

  typeWithUpdates(field, insert);

  // Updates really arrived while typing, or nothing is proved.
  expect(Number(screen.getByTestId("board-now").textContent)).toBeGreaterThanOrEqual(before + insert.length);
  expect(find()).toBe(field);
  expect(field.isConnected).toBe(true);
  expect(field).toHaveFocus();
  expect(field.value).toBe(start.slice(0, middle) + insert + start.slice(middle));
  expect(field.selectionStart).toBe(middle + insert.length);
  expect(field.selectionEnd).toBe(middle + insert.length);
  expect(field.scrollTop).toBe(24);
}

describe("M96: typing survives live board updates", () => {
  it("Add a patient: the family name keeps its text, caret, scroll and focus", () => {
    render(
      <ToastProvider>
        <WardFlowProvider initialNow={NOW_ANCHOR}>
          <Updates />
          <AddPatientForm />
        </WardFlowProvider>
      </ToastProvider>,
    );
    expectTypingKept(() => screen.getByTestId("ward-add-patient-family-name") as HTMLInputElement, "Wrenson", "ab");
  });

  it("Referral slide-out: the patient story keeps its text, caret, scroll and focus", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Updates />
        <WardReferralDrawer onClose={vi.fn()} />
        <ConfirmHost />
      </WardFlowProvider>,
    );
    chooseSampleReferralPerson();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
    );
    expectTypingKept(
      () => screen.getByLabelText(/Patient story/u) as HTMLTextAreaElement,
      "Synthetic note line one. Line two.",
      " more",
    );
  });

  it("Referral slide-out: the doctor's note keeps its text, caret and focus", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Updates />
        <WardReferralDrawer onClose={vi.fn()} />
        <ConfirmHost />
      </WardFlowProvider>,
    );
    chooseSampleReferralPerson();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name: "Referral" }),
    );
    expectTypingKept(
      () => screen.getByPlaceholderText("Why this service is needed") as HTMLTextAreaElement,
      "Synthetic reason",
      "xy",
    );
  });
});
