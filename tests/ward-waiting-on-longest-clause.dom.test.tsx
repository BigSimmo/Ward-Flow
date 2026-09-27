import { readFileSync } from "node:fs";

import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/" }));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { BED_RELEASE_WAITING_ON } from "@/components/ward-management/ward-model";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * ═══ OWNER RULING R7, 2026-09-06 — ONE HOLD-UP, AND THE SCREEN MUST SAY WHICH ONE ═══
 *
 * He confirmed a ward is routinely waiting on more than one thing, and chose to keep recording
 * exactly ONE — *"defined as the one that will take longest. Say so on screen, or a reader will
 * think the others are unknown."*
 *
 * ⚠️ **THE DISTINCTION IS UNRECORDED VERSUS UNKNOWN.** A single value with no explanation reads as
 * the ward's complete answer; it is the ward's LONGEST answer. Silence here would make the screen
 * state something more definite than the data supports — the same class as the referral banner that
 * said "right now" about a shortage that was never about beds.
 *
 * ⚠️ **AND R6's TWO NEW ENTRIES MUST ACTUALLY REACH THE PICKER.** A list extended in the model and
 * not offered on screen is the shape this project keeps finding: complete, tested, unreachable.
 */

const unitId = allUnits()[0]?.id ?? "";

function renderWard() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
}

describe("the waiting-on picker", () => {
  it("offers every entry the owner's list holds, including the two added on 2026-09-06", () => {
    renderWard();
    const picker = screen.getByLabelText(/^Waiting on$/i);
    const offered = within(picker)
      .getAllByRole("option")
      .map((option) => option.textContent?.trim())
      .filter((text) => text !== "Choose what it is waiting on");

    // ⚠️ Every member, by name — not a count. A count would pass an entry silently reworded, and
    // these words go in front of a coordinator as fact.
    expect(offered).toEqual([...BED_RELEASE_WAITING_ON]);
    expect(offered).toContain("Awaiting legal or Mental Health Act process");
    expect(offered).toContain("Awaiting transport");
  });

  it("🔴 says the recorded one is the LONGEST, so a reader does not read it as the only one", () => {
    renderWard();
    const hint = screen.getByTestId("ward-bed-release-waiting-on-hint");
    expect(hint).toHaveTextContent(/the one that will take longest/i);
    // The half that names the situation: a ward is often waiting on several. Without it the clause
    // reads as an instruction to the ward and says nothing to whoever reads the record.
    expect(hint).toHaveTextContent(/often waiting on several/i);
  });

  it("says it on the revert picker too — checked in the source, because that picker does not render here", () => {
    /*
     * 🔴 **THIS WAS A VACUOUS DOM ASSERTION AND MEASURING IT IS HOW I KNOW.** It counted rendered
     * hints and required more than nought. **Exactly ONE renders**: the revert picker appears only
     * against an existing bed release in a revertable state, which the seeded ward has none of. So
     * a test that read as "both pickers carry the ruling" proved it of one and was silent about the
     * other — while looking like coverage.
     *
     * Two pickers write this field and the owner's ruling binds both. The property is checked where
     * it is actually decidable: **one constant, referenced twice**, so the two cannot drift into
     * different wordings of his sentence.
     */
    const source = readFileSync("src/components/ward-management/ward/ward-screen.tsx", "utf8");
    const declarations = source.match(/const WAITING_ON_LONGEST\b/gu) ?? [];
    const uses = source.match(/\{WAITING_ON_LONGEST\}/gu) ?? [];
    expect(declarations, "the clause is declared more than once, so the two pickers can drift").toHaveLength(1);
    expect(uses, "the clause reaches fewer than the two pickers that write this field").toHaveLength(2);

    // ⚠️ And the one that DOES render carries the same constant's text, so the static check above
    // is about the string a ward actually reads rather than about an unused declaration.
    renderWard();
    expect(screen.getAllByText(/the one that will take longest/i)).toHaveLength(1);
  });

  it("control: the clause is not simply printed on every screen regardless", () => {
    /*
     * ⚠️ Without this, the assertions above would pass against a clause hard-coded into a layout
     * and rendered everywhere — which would read as a rule about whatever the reader happened to be
     * looking at. It belongs to the waiting-on question and nowhere else.
     */
    renderWard();
    const hint = screen.getByTestId("ward-bed-release-waiting-on-hint");
    const picker = screen.getByLabelText(/^Waiting on$/i);
    // Same form region: the clause sits with the control it qualifies.
    expect(hint.closest("form") ?? hint.parentElement).toBe(
      picker.closest("form") ?? picker.parentElement?.parentElement,
    );
    cleanup();
  });
});
