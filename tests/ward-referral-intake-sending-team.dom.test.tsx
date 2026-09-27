import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The same mock every sibling intake suite carries, and for the same reason rather than by
// copying: `ReferralIntakeForm` reads the URL through `useSearchParams`, and the rail it renders
// derives its role from `usePathname` — jsdom provides an App Router context for neither. A
// whole-module mock WITHOUT `usePathname` makes that hook undefined, which throws at render
// instead of returning a wrong answer, so both members are required.
vi.mock("next/navigation", () => ({
  usePathname: () => "/mockups/ward-flow",
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { overLimitFreeTextFields, ReferralIntakeForm } from "@/components/ward-management/referrals/referral-intake";
import { SENDING_TEAM_NAME_LIMIT } from "@/components/ward-management/ward-model";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE SENDING-TEAM QUESTION ON THE REFERRAL FORM.
 *
 * The owner was asked directly, 2026-09-12, and answered *"Yes"*: add it to the form, **optional**,
 * **free text**, and shown wherever a referral's origin already appears.
 *
 * 🔴 **THE DEFECT THIS FILE EXISTS TO STOP IS A FORM THAT REFUSES TO SEND.** The reducer refuses a
 * present-but-blank `sendingTeamName` on purpose — `""` would be a third state meaning neither
 * *this team* nor *nobody recorded one*. ⚠️ **An untouched optional text input yields exactly
 * `""`**, so the naive wiring sends the refused shape on every referral that leaves the box empty,
 * which is most of them. **An optional question would have become a form that cannot send.**
 * Named by Lane B before it shipped; these cases are what keep it named.
 */

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ReferralIntakeForm />
    </WardFlowProvider>,
  );
}

describe("the sending-team question exists and is optional", () => {
  it("renders a text box, so every case below has something to type into", () => {
    renderForm();
    const box = screen.getByTestId("ward-referral-intake-sending-team");
    expect(box, "the form has no sending-team control").toBeInTheDocument();
    expect(box.tagName, "the sending team is not a free-text box").toBe("INPUT");
    expect(box.getAttribute("type")).toBe("text");
  });

  /**
   * 🔴 NO `maxLength`, AND IT IS THE SAME RULE THE HISTORY BOXES FOLLOW. `maxLength` stops the
   * keystroke, so a referrer pasting a long service name watches the end of it vanish with no
   * message — a silent truncation performed by the browser. **A truncated team name is a DIFFERENT
   * team's name**, which is exactly why the reducer refuses rather than shortens.
   */
  it("carries no maxLength, so the browser can never silently truncate a team name", () => {
    renderForm();
    expect(
      screen.getByTestId("ward-referral-intake-sending-team").getAttribute("maxLength"),
      "a maxLength would truncate a long service name silently, with no message to the referrer",
    ).toBeNull();
  });

  /**
   * ⚠️ NO ANSWERED/UNANSWERED BADGE. That badge means *"Send is waiting on this"*. This question
   * never blocks a send, so showing one would make an optional box read as an outstanding question
   * on every referral with no team to name — police, ambulance, an ED's own medical staff.
   */
  it("shows no outstanding-question badge beside it, because Send never waits on it", () => {
    renderForm();
    const card = screen.getByTestId("ward-referral-intake-sending-team").closest("div")?.parentElement;
    expect(card, "the control has no surrounding field card").not.toBeNull();
    expect(
      card!.querySelector('[data-testid^="ward-referral-intake-question-state"]'),
      "an optional question is showing the badge that means Send is waiting on it",
    ).toBeNull();
  });

  it("accepts typing, and holds exactly what was typed", () => {
    renderForm();
    const box = screen.getByTestId("ward-referral-intake-sending-team");
    fireEvent.change(box, { target: { value: "Armadale Community Mental Health Service" } });
    expect((box as HTMLInputElement).value).toBe("Armadale Community Mental Health Service");
  });
});

describe("the over-length rule blocks the send and never trims", () => {
  const base = { history: "", sendingTeamName: "" };

  it("says nothing while the name is within the limit", () => {
    expect(overLimitFreeTextFields({ ...base, sendingTeamName: "A".repeat(SENDING_TEAM_NAME_LIMIT) } as never)).toEqual(
      [],
    );
  });

  /**
   * ⚠️ THE LIMIT ITSELF MUST BE ACCEPTED. Without the case above, narrowing the field by one
   * character would pass every assertion here.
   */
  it("names the sending team once it is over the limit, in the same sentence as the history", () => {
    const over = overLimitFreeTextFields({
      ...base,
      sendingTeamName: "A".repeat(SENDING_TEAM_NAME_LIMIT + 1),
    } as never);
    expect(over, "an over-length team name did not block the send").toContain("Sending team");
  });

  /**
   * 🔴 ONE REASON SENTENCE, NOT TWO. A second over-length vocabulary would be a second wording for
   * one fact, and only one unavailability reason is announced with the button at a time.
   */
  it("puts it in the same list the history boxes use, rather than inventing a second reason", () => {
    const both = overLimitFreeTextFields({
      history: "h".repeat(9000),
      sendingTeamName: "A".repeat(SENDING_TEAM_NAME_LIMIT + 1),
    } as never);
    expect(both.length, "the two over-length reasons are not reported together").toBeGreaterThan(1);
    expect(both).toContain("Sending team");
  });
});
