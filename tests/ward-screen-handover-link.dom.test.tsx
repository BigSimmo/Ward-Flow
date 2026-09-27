import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { handoverScopeValue, parseHandoverScope } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **THE WARD'S PRINT CONTROL LINKS THE ONE HANDOVER SHEET. IT DOES NOT DRAW A SECOND ONE.**
 *
 * Owner ruling on Q-12. ⚠️ **His REASON is what this file exists to defend, because it is the
 * argument against the thing somebody will propose later:** *a second sheet is a second thing to keep
 * truthful as the app changes, and the two will drift.*
 *
 * **"Just draw a small one on the ward screen" is the tempting version** — it looks like less work,
 * it avoids a navigation, and it would immediately be a second place where a bed census can go
 * stale. **The assertions below are what make that change go red instead of looking like an
 * improvement.**
 *
 * 🔴 **THE HREF IS BUILT FROM `handoverScopeValue`, NEVER TYPED.** A hand-written `?scope=ward:xyz`
 * would be a second encoding of what a scope is, and the two would drift the moment either changed.
 * The test computes the expected value the same way and compares — so a change to the wire format
 * moves both sides together, and a change to only one of them fails here.
 *
 * ⚠️ **POPULATION.** The `WardScreen` component in jsdom over several seeded units. It says nothing
 * about what the handover page then renders — that is `ward-handover-scope-from-url.dom.test.tsx` —
 * and nothing about printing, which jsdom cannot reach.
 */

const WALKED = allUnits().slice(0, 3);

function renderWard(unitId: string) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the ward screen's handover link", () => {
  it("has several distinctly-named units, so a hard-coded ward could not pass", () => {
    expect(new Set(WALKED.map((unit) => unit.id)).size).toBe(WALKED.length);
  });

  it("links the handover sheet, scoped to THIS ward, on every ward walked", () => {
    for (const unit of WALKED) {
      renderWard(unit.id);
      const link = screen.getByTestId("ward-handover-link");
      const href = link.getAttribute("href") ?? "";

      // Computed, never typed — see the file header.
      const expected = handoverScopeValue({ kind: "ward", id: unit.id });
      const scope = new URLSearchParams(href.split("?")[1] ?? "").get("scope");

      expect(
        scope,
        `${unit.name}'s handover link carries scope ${JSON.stringify(scope)}, not its own ward — a ` +
          "coordinator would print another ward's sheet",
      ).toBe(expected);
      expect(href, "the link does not point at the one handover page").toContain("/mockups/ward-flow/handover");

      // 🔴 And it must round-trip back to THIS ward, not merely look right as a string.
      expect(parseHandoverScope(scope ?? "")).toEqual({ kind: "ward", id: unit.id });
      cleanup();
    }
  });

  it("🔴 draws no sheet of its own — no second bed census on this screen", () => {
    renderWard(WALKED[0].id);

    /*
     * The ruling's whole point. A second sheet would announce itself the way the real one does — a
     * printed-at stamp, or a heading calling itself a handover. Neither belongs on the ward screen,
     * which links to the one sheet instead.
     */
    expect(
      screen.queryByTestId("ward-handover-taken-at"),
      "the ward screen has grown its own printed-at stamp — that is a second handover sheet, and the " +
        "owner ruled one sheet because two drift",
    ).toBeNull();
    expect(
      screen.queryByTestId("ward-handover-scope-summary"),
      "the ward screen is rendering the handover sheet's own scope summary — it has become a second sheet",
    ).toBeNull();
  });

  it("says what the sheet holds, so the link is not a blind jump", () => {
    renderWard(WALKED[0].id);
    const panel = screen.getByTestId("ward-handover-block").textContent ?? "";

    // The owner's answer on contents, in the screen's own words — a reader should know what they are
    // about to print before they navigate away from the ward.
    expect(panel, "the link does not say what the sheet contains").toMatch(/bed census|beds|movements/iu);
    expect(
      panel,
      "the link does not say what it withholds — the owner's answer was explicit that nothing " +
        "identifying goes beyond what this ward's screen already shows",
    ).toMatch(/nothing about a person beyond|already shows/iu);
  });
});
