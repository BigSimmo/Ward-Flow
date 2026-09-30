import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import { roleRecordCounts, servicesWithNoRoleRecorded } from "@/components/ward-management/on-call/on-call-roster";
import { allEmergencyDepartments, siteByCode } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **WHAT A READER ACTUALLY SEES ON THE SCREEN THEY WOULD RING.**
 *
 * `ward-on-call-holds-no-people.test.ts` guards the SOURCE — the type, the values, and anything
 * phone-shaped in the folder. ⚠️ **This file guards the RENDER, and the two catch different things:**
 * source can be clean while the screen renders none of its disclosures, and a disclosure can exist in
 * the file while sitting behind a condition nobody meets.
 *
 * 🔴 **EVERY DISCLOSURE IS ASSERTED AS VISIBLE TEXT, NEVER AS AN ACCESSIBLE NAME.** An `sr-only`
 * region is invisible to eyes, to screenshots, and to a reader glancing at the screen at three in the
 * morning — **and it satisfies a `getByText` just as happily as a paragraph does.** The owner ruled
 * that a screen-reader-only disclosure does not count on this screen; `toBeVisible` is how that
 * ruling reaches the test rather than staying a sentence in a brief.
 *
 * ⚠️ **POPULATION.** jsdom at one viewport, over the real site fixture. Silent about layout and about
 * what a browser paints.
 */

function renderOnCall() {
  return render(<OnCallScreen />);
}

describe("the on-call screen", () => {
  it("🔴 ANTI-VACUITY — the fixture has departments and at least one service with nobody recorded", () => {
    expect(allEmergencyDepartments().length, "no departments, so the ED table walks nothing").toBeGreaterThan(1);
    expect(
      servicesWithNoRoleRecorded().length,
      "every service has a role recorded, so the 'nobody recorded' wording never renders and its " +
        "assertion below would pass by describing nothing",
    ).toBeGreaterThan(0);
  });

  it("carries the synthetic-data disclosure, as visible text", () => {
    renderOnCall();
    const banner = screen.getByText(/Roles and shifts are invented/iu);
    expect(
      banner,
      "the disclosure is not visible — an invisible one is worse than none, because it satisfies a " +
        "test while telling the reader nothing",
    ).toBeVisible();
    expect(banner.textContent ?? "", "the disclosure does not say contact details are absent").toMatch(
      /contact details are not held/iu,
    );
  });

  it("renders all operational on-call and liaison sections", () => {
    renderOnCall();
    for (const heading of ["On-call now", "ED liaison, by department", "Reaching a role"]) {
      expect(
        screen.getByRole("heading", { name: heading }),
        `"${heading}" is not a heading on this screen — it may have been renamed, or demoted to a ` +
          "div, which a test-id assertion would survive",
      ).toBeVisible();
    }
  });

  it("🔴 names every service that has nobody recorded, rather than leaving a blank", () => {
    renderOnCall();
    for (const service of servicesWithNoRoleRecorded()) {
      const said = screen.getByTestId(`ward-on-call-none-${service}`);
      expect(said, `${service} has no role recorded and the screen says nothing about it`).toBeVisible();
      /*
       * 🔴 **BOTH HALVES.** "Nobody is recorded" and "nobody is on call" are opposite claims: the
       * first is about this software, the second about the world, and only the first is knowable
       * here. A screen that quietly makes the second would tell a coordinator there is nobody to ring.
       */
      expect(said.textContent ?? "", `the ${service} note does not say this is about the prototype`).toMatch(
        /in this prototype/iu,
      );
      expect(said.textContent ?? "", `the ${service} note claims to know about the world`).toMatch(
        /Nothing here knows whether/iu,
      );
    }
  });

  it("counts roles from the roster rather than from a typed-in number", () => {
    renderOnCall();
    const counts = roleRecordCounts();
    expect(
      screen.getByTestId("ward-on-call-count").textContent ?? "",
      "the count on screen is not the count the roster derives — a hand-typed figure goes stale the " +
        "moment a role is added, and this screen's figures are the thing a reader trusts",
    ).toContain(`${counts.recorded} of ${counts.possible}`);
  });

  it("lists every emergency department against its REAL site and service", () => {
    renderOnCall();
    const departments = allEmergencyDepartments();
    for (const department of departments) {
      const row = within(screen.getByTestId(`ward-on-call-ed-row-${department.id}`));
      const site = siteByCode(department.siteCode);
      expect(row.getByText(department.name), `${department.id} is not listed`).toBeVisible();
      if (site !== undefined) {
        // ✅ Real data, from the same source every other ward screen reads — asserted so that a
        // later "tidy" replacing it with invented site names goes red.
        expect(row.getByText(site.name), `${department.id} is not shown against its real site`).toBeVisible();
      }
    }
  });

  /**
   * 🔴 **THE ONE THAT MATTERS AT THREE IN THE MORNING.** The static guard reads the FILES; this reads
   * what was actually painted, which is what a person acts on.
   */
  it("🔴 renders nothing anywhere on the screen that could be rung or written to", () => {
    const { container } = renderOnCall();
    const painted = container.textContent ?? "";

    expect(painted, "a run of digits long enough to be a phone number is on this screen").not.toMatch(
      /(?<!\d)\d[\d\s-]{7,}\d(?!\d)/u,
    );
    expect(painted, "an email address is on this screen").not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/u);
    expect(painted, "an extension is on this screen").not.toMatch(/\bext\.?\s?\d/iu);

    // And nothing that would hand a number to a phone app or an address to a mail client.
    for (const anchor of Array.from(container.querySelectorAll("a"))) {
      const href = anchor.getAttribute("href") ?? "";
      expect(
        /^(?:tel|callto|mailto|sms):/iu.test(href),
        `a link on this screen has the scheme ${JSON.stringify(href.split(":")[0])} — it would start ` +
          "a call or a message, and this screen holds nobody to start one with",
      ).toBe(false);
    }
  });
});
