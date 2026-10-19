import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Field, SelectBox } from "@/components/ward-management/referrals/ward-referral-drawer-fields";
import { WardReferralDrawer } from "@/components/ward-management/referrals/ward-referral-drawer";
import { discardReferralDraft } from "@/components/ward-management/referrals/referral-draft-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { chooseSampleReferralPerson } from "./helpers/referral-drawer-person";

afterEach(() => {
  cleanup();
  discardReferralDraft();
});

async function setupDrawer() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardReferralDrawer onClose={vi.fn()} />
    </WardFlowProvider>,
  );
  await waitFor(() => expect(screen.getByRole("searchbox", { name: "Find a patient" })).toHaveFocus());
  chooseSampleReferralPerson();
}

function section(name: string) {
  return within(screen.getByRole("group", { name: "Referral sections" })).getByRole("button", { name });
}

describe("referral field semantics", () => {
  it.each(["input", "textarea", "select"] as const)(
    "describes a required %s through wrappers and clears only its resolved error",
    (kind) => {
      const control =
        kind === "select" ? (
          <SelectBox>
            <select id="answer" aria-describedby="existing">
              <option value="">Choose</option>
            </select>
          </SelectBox>
        ) : kind === "textarea" ? (
          <textarea id="answer" aria-describedby="existing" />
        ) : (
          <input id="answer" aria-describedby="existing" />
        );
      const view = render(
        <>
          <p id="existing">Existing help</p>
          <Field label="Answer" htmlFor="answer" required hint="Format hint" error="Choose an answer">
            {control}
          </Field>
        </>,
      );
      const answer = screen.getByLabelText("Answer");
      expect(answer).toBeRequired();
      expect(answer).toHaveAttribute("aria-required", "true");
      expect(answer).toHaveAttribute("aria-invalid", "true");
      expect(answer).toHaveAccessibleDescription("Existing help Format hint Choose an answer");
      view.rerender(
        <>
          <p id="existing">Existing help</p>
          <Field label="Answer" htmlFor="answer" required hint="Format hint">
            {control}
          </Field>
        </>,
      );
      expect(answer).not.toHaveAttribute("aria-invalid");
      expect(answer).toHaveAccessibleDescription("Existing help Format hint");
      expect(answer).not.toHaveAttribute("aria-describedby", expect.stringContaining("answer-error"));
    },
  );
});

describe("referral step recovery and keyboard focus", () => {
  it.each(["next", "send"])("returns to an invalid earlier step when %s is pressed", async (action) => {
    await setupDrawer();
    fireEvent.click(section(action === "next" ? "Clearance" : "Wards"));
    fireEvent.click(screen.getByRole("button", { name: action === "next" ? "Next, wards" : "Send referral" }));
    expect(section("Patient")).toHaveAttribute("aria-pressed", "true");
    const region = screen.getByLabelText("Home region");
    expect(region).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(region).toHaveFocus());
    fireEvent.change(region, { target: { value: "Perth Metropolitan" } });
    expect(region).toHaveFocus();
    expect(region).not.toHaveAttribute("aria-invalid");
  });

  it("leaves focus in a close guard opened before the recovery frame runs", async () => {
    await setupDrawer();
    fireEvent.click(section("Wards"));
    fireEvent.click(screen.getByRole("button", { name: "Send referral" }));
    fireEvent.click(screen.getByRole("button", { name: "Close referral side drawer" }));
    const keepEditing = screen.getByRole("button", { name: "Keep editing" });
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(keepEditing).toHaveFocus();
  });

  it("starts keyboard progression in the newly opened step after Next and Back", async () => {
    const user = userEvent.setup();
    await setupDrawer();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.change(screen.getByLabelText("Patient suburb"), { target: { value: "Perth" } });
    fireEvent.change(screen.getByLabelText("Search catchment"), { target: { value: "Inner City Clinic" } });
    fireEvent.change(screen.getByLabelText("Home region"), { target: { value: "Perth Metropolitan" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm catchment" }));
    screen.getByRole("button", { name: "Next, referral" }).focus();
    await user.keyboard("{Enter}");
    const referralHeading = screen.getByRole("heading", { level: 3, name: "From" });
    await waitFor(() => expect(referralHeading).toHaveFocus());
    await user.tab();
    expect(referralHeading.closest("section")).toContainElement(document.activeElement as HTMLElement);
    screen.getByRole("button", { name: "Back" }).focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("heading", { level: 3, name: "Patient" })).toHaveFocus());
  });
});
