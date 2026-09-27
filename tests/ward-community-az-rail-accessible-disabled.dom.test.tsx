// tests/ward-community-az-rail-accessible-disabled.dom.test.tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CommunityIndex } from "@/components/ward-management/community/community-index";
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE A–Z JUMP RAIL'S EMPTY-LETTER BUTTONS — `aria-disabled`, never native `disabled`.
 *
 * A letter with no team must still stay in the Tab order so a keyboard or screen-reader-by-Tab
 * user can reach it and learn WHY it is unavailable; native `disabled` removes a control from the
 * tab order entirely, which is the exact defect this file exists to catch a regression back to.
 * `tests/ward-community-gateway.dom.test.tsx` still asserts the OLD native-`disabled` behaviour at
 * its "disables an absent letter" case and is expected to go red until that file's owner updates
 * it to match this same behaviour change — see the fix's own report for that pointer.
 */
function renderGateway() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <CommunityIndex />
    </WardFlowProvider>,
  );
}

describe("Community gateway — the A-Z rail marks an empty letter accessibly-disabled, not natively", () => {
  it("an empty letter's button is aria-disabled, stays focusable, and activating it changes nothing", () => {
    renderGateway();

    const presentLetters = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name.charAt(0).toUpperCase()));
    const missingLetter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find((letter) => !presentLetters.has(letter));
    expect(missingLetter, "every letter has at least one team — the empty-letter case below is vacuous").toBeDefined();
    if (!missingLetter) return;

    const rail = screen.getByRole("navigation", { name: "Jump to letter" });
    const emptyButton = [...rail.querySelectorAll("button")].find((button) =>
      button.textContent?.trim().startsWith(missingLetter),
    );
    expect(emptyButton, `no rail button renders the empty letter "${missingLetter}"`).toBeDefined();
    if (!emptyButton) return;

    // Accessibly disabled, never natively disabled.
    expect(emptyButton.getAttribute("aria-disabled")).toBe("true");
    expect(emptyButton).not.toBeDisabled();
    expect(emptyButton.hasAttribute("disabled")).toBe(false);

    // Still reachable by keyboard: a native `disabled` control cannot receive focus at all.
    emptyButton.focus();
    expect(document.activeElement).toBe(emptyButton);

    // The reason is spoken, not just visual.
    const describedById = emptyButton.getAttribute("aria-describedby");
    expect(describedById, "the empty letter carries no aria-describedby reason").not.toBeNull();
    const reasonNode = describedById ? document.getElementById(describedById) : null;
    expect(reasonNode?.textContent).toBeTruthy();

    // Activating it changes nothing: no heading anywhere gains focus, and nothing throws.
    const activeElementBefore = document.activeElement;
    fireEvent.click(emptyButton);
    expect(document.activeElement).toBe(activeElementBefore);
    expect(screen.queryAllByRole("heading", { level: 3 }).some((heading) => document.activeElement === heading)).toBe(
      false,
    );
  });

  it("a populated letter's button stays a plain, fully-enabled control and still jumps on click", () => {
    renderGateway();

    const presentLetters = new Set(COMMUNITY_TEAM_PAGES.map((team) => team.name.charAt(0).toUpperCase()));
    const [enabledLetter] = [...presentLetters].sort();
    expect(enabledLetter, "no letter is present at all — the populated-letter case below is vacuous").toBeDefined();
    if (!enabledLetter) return;

    const enabledButton = screen.getByRole("button", { name: enabledLetter });
    expect(enabledButton.getAttribute("aria-disabled")).toBeNull();
    expect(enabledButton.hasAttribute("disabled")).toBe(false);
    expect(enabledButton).toBeEnabled();

    fireEvent.click(enabledButton);
    const heading = screen.getByRole("heading", { level: 3, name: enabledLetter });
    expect(document.activeElement).toBe(heading);
  });
});
