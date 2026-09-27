/**
 * 🔴 **RETIRED 2026-09-06 — OWNER RULING: THE ELEVEN REPLACED WARD SCREENS ARE FINISHED WITH.**
 *
 * ⚠️ **AMENDED 2026-09-07: "these 8 cases" is now THREE.** The ruling below is about
 * `EscalationBoardPage` and always was — but the file was skipped whole, so five of those eight
 * cases were about the LIVE referral board and went off with it. The split at `LIVE_BANNERS` /
 * `RETIRED_BANNERS` puts that right; today the file runs 5 and skips 3.
 *
 * **The count is corrected here rather than left standing, because a stale number inside the
 * paragraph that JUSTIFIES a skip is what makes the skip look wider than its reason.** Anyone
 * auditing this file would have read "8 cases" against a retirement covering one board and had no
 * reason to look further — the number was the thing that made the scope seem settled.
 *
 * `EscalationBoardPage` is reached by no route. Those cases are skipped, not deleted: the
 * source stays, and every case's own words are recorded in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md` so the cover is recoverable if the
 * screen is ever revived. ⚠️ **A retired test with no record of its subject is a deletion
 * wearing a softer word.**
 *
 * ⚠️ **THE COMPONENT IS NOT DELETED BY THIS RULING, AND THAT IS DELIBERATE.** This repository
 * forbids removing an exported symbol on a "nothing imports it" basis, and three of the defects
 * found on 2026-09-06 were held in place BY unreachability — which is more fragile than a live
 * defect, not less. **An unreachable wrong screen is a fix, not a delete.** What closes here is
 * the false coverage, which was the actual harm.
 *
 * **Do not un-skip these to make a number go up.** `tests/ward-component-reachability.test.ts`
 * reddens if this component becomes reachable again, and that is the signal to restore cover —
 * from the record, deliberately, not by deleting a `.skip`.
 */
/**
 * ⚠️ **NO ROUTE REACHES THE SCREEN THIS FILE RENDERS.** `EscalationBoardPage` — /escalation redirects to /delays
 * (measured 2026-09-06, `docs/ward-flow/unreachable-ward-screens-2026-09-06.md`).
 *
 * **These cases passed and always would have. They were not coverage of anything a coordinator
 * could open.** ⚠️ **The line above this one used to say nothing here was skipped or retired.
 * That stopped being true on 2026-09-06 and is corrected rather than left standing.**
 *
 * ⚠️ **THIS COMMENT IS A POINTER, NOT THE GUARANTEE.** A comment saying a screen is
 * unreachable stays exactly as true-looking on the day it becomes reachable again.
 * `tests/ward-component-reachability.test.ts` holds the property: it reddens if this file
 * starts rendering a newly orphaned component, AND it reddens if the component comes back,
 * naming the declaration to delete. **If the two ever disagree, believe the guard.**
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { EscalationBoardPage } from "@/components/ward-management/escalation/escalation-board";
import { ReferralBoard } from "@/components/ward-management/referrals/referral-board";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * THE REASON A BOARD GIVES FOR NOT BEING A MEDICAL DEVICE MUST STILL BE TRUE TOMORROW.
 *
 * 🔴 THE DEFECT, and it was a governance one rather than a wording one. Three boards supported
 * "not a medical device" with a promise that the software NEVER RANKS wards or NEVER SUGGESTS which
 * bed is best. The owner has since asked for exactly that capability, and the product ranks wards by
 * fit today on four surfaces. So the stated REASON for the device claim became false, in front of a
 * clinician, on screens about placing patients.
 *
 * ⚠️ WHY THE REPLACEMENT IS "IT PLACES NOBODY" AND NOT "IT DOES NOT RANK". Measured: none of these
 * screens sorts by suitability, so "this board does not rank" would have been TRUE of each of them.
 * It was rejected anyway — a per-screen truth that reads as a claim about the product is the same
 * trap as a disclaimer that survives strict parsing while misleading the person reading it. "It
 * places nobody" is checkable against the reducer, does not expire when matching ships, and the
 * software may rank and suggest as much as the owner wants without making it false.
 *
 * ⚠️ AND "ONE AT A TIME" IS LOAD-BEARING, NOT DECORATION. `ACCEPT_IN_PRINCIPLE` and
 * `ACCEPT_REFERRAL` each carry a single `unitId`, so no event in the reducer can place more than one
 * patient or accept more than one unit in a single act. It is also literally the owner's row-by-row
 * ruling rather than a paraphrase of it.
 *
 * This file pins the REASON and pins the withdrawn form as an ABSENCE, so the old promise cannot
 * return quietly. `referral-match.tsx`'s own banner is pinned in `ward-referral-screens.dom.test.tsx`
 * beside the comparative-language rule it used to be exempt from.
 */

afterEach(cleanup);

const WITHDRAWN = /never ranks|never suggests|never allocates|does not yet rank/i;

function renderIn(node: ReactNode) {
  render(<WardFlowProvider initialNow={NOW_ANCHOR}>{node}</WardFlowProvider>);
}

const BANNERS = [
  { name: "escalation board", testId: "ward-escalation-governance", node: <EscalationBoardPage /> },
  { name: "referral board", testId: "ward-referral-board-governance", node: <ReferralBoard /> },
] as const;

/**
 * 🔴 **SPLIT 2026-09-07 — THIS FILE HAS TWO SUBJECTS AND ONLY ONE OF THEM IS RETIRED.**
 *
 * The whole suite carried `describe.skip` from the 2026-09-06 retirement, and the header above
 * says *"no route reaches the screen this file renders"* — **singular, and written as though the
 * file had one subject.** It has two. `EscalationBoardPage` is retired; **`ReferralBoard` is live,
 * rendered by `/mockups/ward-flow/referrals`, and was never in scope for that ruling.**
 *
 * 🔴 **So switching off the escalation board's cover switched off the referral board's
 * medical-device check too — on a board a coordinator opens every day — and NOTHING COULD GO RED
 * ABOUT IT.** `ward-component-reachability` correctly does not list `referral-board.tsx` as
 * unreachable, so it has nothing to assert; and no guard anywhere reads a `.skip`. The retirement
 * comment stayed true about escalation the entire time, which is exactly why it was not
 * questioned.
 *
 * ⚠️ **THE GENERAL SHAPE, because this is the second instance in one night** (the first was
 * `StatFootnote`, whose declaration was deleted while its suite stayed skipped): **a `.skip` is
 * invisible to every guard in this repository, so whenever one is applied to a whole file, it
 * silently takes with it every subject in that file — including the ones the ruling never
 * mentioned.** Scope a retirement to the cases about the retired thing, never to the file that
 * happens to contain them.
 *
 * The escalation cases stay skipped, from the same record and for the same reason. The referral
 * cases run.
 */
const LIVE_BANNERS = BANNERS.filter((banner) => banner.name === "referral board");
const RETIRED_BANNERS = BANNERS.filter((banner) => banner.name === "escalation board");

describe("a live board's stated reason for not being a medical device", () => {
  /**
   * ⚠️ **THE FLOOR IS ON THE POPULATION, NOT ON THE MATCHES.** Every case below is "this banner
   * says that". A split that accidentally selected nothing would satisfy all of them perfectly,
   * and a rename of `banner.name` is enough to produce one.
   */
  it("walks the live boards, so nothing below can pass on an empty set", () => {
    expect(LIVE_BANNERS.length, "the live-board split selected nothing").toBe(1);
    expect(RETIRED_BANNERS.length, "the retired-board split selected nothing").toBe(1);
    expect(LIVE_BANNERS.length + RETIRED_BANNERS.length, "a banner fell out of both halves").toBe(BANNERS.length);
  });

  for (const banner of LIVE_BANNERS) {
    it(`${banner.name}: still claims not to be a medical device`, () => {
      renderIn(banner.node);
      expect(screen.getByTestId(banner.testId)).toHaveTextContent(/not a medical device/i);
    });

    it(`${banner.name}: gives a reason that survives the software ranking`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(
        text,
        "the device claim must not be left unsupported — the reason is that a human places every " +
          "patient, which stays true however much the software ranks or suggests",
      ).toMatch(/places nobody/i);
      expect(text, "the owner's ruling is row by row, and the sentence should say so").toMatch(/one at a time/i);
    });

    it(`${banner.name}: does not promise the software will never rank or suggest`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(
        text,
        "the product ranks wards by fit today, so any form of this promise is false — including " +
          '"does not yet rank", which claims a future it does not have',
      ).not.toMatch(WITHDRAWN);
    });

    it(`${banner.name}: carries the withdrawn promise nowhere on the page`, () => {
      renderIn(banner.node);
      const root = document.body.textContent ?? "";
      expect(root, `${banner.name} carries the withdrawn promise somewhere outside its banner`).not.toMatch(WITHDRAWN);
    });
  }
});

/**
 * RETIRED 2026-09-06, unchanged in substance — see the file header. `EscalationBoardPage` is
 * reached by no route; the cases are recorded in
 * `docs/ward-flow/retired-coverage-record-2026-09-06.md` and are recoverable from it.
 * `ward-component-reachability` reddens if the component comes back, and that is the signal to
 * restore these — deliberately, from the record, never by deleting a `.skip`.
 */
describe.skip("a retired board's stated reason for not being a medical device", () => {
  for (const banner of RETIRED_BANNERS) {
    it(`${banner.name}: still claims not to be a medical device`, () => {
      renderIn(banner.node);
      expect(screen.getByTestId(banner.testId)).toHaveTextContent(/not a medical device/i);
    });

    it(`${banner.name}: gives a reason that survives the software ranking`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(text).toMatch(/places nobody/i);
      expect(text).toMatch(/one at a time/i);
    });

    it(`${banner.name}: does not promise the software will never rank or suggest`, () => {
      renderIn(banner.node);
      const text = screen.getByTestId(banner.testId).textContent ?? "";
      expect(text).not.toMatch(WITHDRAWN);
    });
  }
});
