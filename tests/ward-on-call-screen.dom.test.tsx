import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  window.localStorage.removeItem("ward-flow:on-call:service");
});

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

  it("renders the three useful directory sections without the removed controls", () => {
    renderOnCall();
    for (const heading of ["On-call roles", "ED liaison, by department", "Reaching a role"]) {
      expect(
        screen.getByRole("heading", { name: heading }),
        `"${heading}" is not a heading on this screen — it may have been renamed, or demoted to a ` +
          "div, which a test-id assertion would survive",
      ).toBeVisible();
    }
  });

  it("explains unrecorded services when selected without showing default warning banners", () => {
    renderOnCall();
    expect(screen.queryByText(/Coverage boundary note/iu)).not.toBeInTheDocument();
    for (const service of servicesWithNoRoleRecorded()) {
      fireEvent.click(screen.getByRole("button", { name: service }));
      expect(
        screen.getByText(
          `No on-call roles recorded for ${service} in this prototype. Use the current site directory to confirm cover.`,
        ),
      ).toBeVisible();
      expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("0 roles");
    }
  });

  it("counts roles from the roster rather than from a typed-in number", () => {
    renderOnCall();
    const counts = roleRecordCounts();
    expect(
      screen.getByTestId("ward-on-call-count").textContent ?? "",
      "the count on screen is not the count the roster derives — a hand-typed figure goes stale the " +
        "moment a role is added, and this screen's figures are the thing a reader trusts",
    ).toContain(`${counts.recorded} roles recorded`);
  });

  it("lists every emergency department against its REAL site and service", () => {
    renderOnCall();
    const departments = allEmergencyDepartments();
    for (const department of departments) {
      const row = within(screen.getByTestId(`ward-on-call-ed-row-${department.id}`));
      const site = siteByCode(department.siteCode);
      expect(row.getByRole("link", { name: `How to reach ${department.name}` })).toHaveAttribute(
        "href",
        "#ward-reach-ed",
      );
      if (site !== undefined) {
        // ✅ Real data, from the same source every other ward screen reads — asserted so that a
        // later "tidy" replacing it with invented site names goes red.
        expect(row.getByText(site.name), `${department.id} is not shown against its real site`).toBeVisible();
      }
    }
  });

  it("removes misleading Connect, escalation, handover and provenance controls", () => {
    renderOnCall();
    expect(screen.queryByRole("button", { name: /Connect|Trigger Tier 3/iu })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Data provenance and coverage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Handover" })).not.toBeInTheDocument();
    expect(screen.queryByText("Active Duty Roster")).not.toBeInTheDocument();
  });

  it("filters both tables by service and clears the selection", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("button", { name: "East Metro" }));
    expect(screen.getByRole("button", { name: "East Metro" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByTestId("ward-on-call-service-table")).getAllByRole("row")).toHaveLength(3);
    for (const row of within(screen.getByTestId("ward-on-call-ed-table")).getAllByRole("row").slice(1)) {
      expect(row).toHaveTextContent("East Metro");
    }
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent(`${roleRecordCounts().recorded} roles recorded`);
    expect(within(screen.getByTestId("ward-on-call-ed-table")).getAllByRole("row")).toHaveLength(
      allEmergencyDepartments().length + 1,
    );
  });

  it("searches sites and roles, shows no matches, and resets the search", () => {
    renderOnCall();
    const search = screen.getByRole("searchbox", { name: "Search roster and emergency departments" });
    fireEvent.change(search, { target: { value: "  Royal Perth  " } });
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("2 roles of 9");
    expect(within(screen.getByTestId("ward-on-call-ed-table")).getAllByRole("row")).toHaveLength(2);
    fireEvent.change(search, { target: { value: "no-such-site" } });
    expect(screen.getByText("No on-call roles match your search.")).toBeVisible();
    expect(screen.getByText("No emergency departments match the current filter or search.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search).toHaveValue("");
  });

  it("every reach-via link has a focusable guidance destination", () => {
    const { container } = renderOnCall();
    const links = screen.getAllByRole("link", { name: /^How to reach/iu });
    expect(links.length).toBe(roleRecordCounts().recorded + allEmergencyDepartments().length);
    for (const link of links) {
      const destination = container.querySelector(link.getAttribute("href")!);
      expect(destination).toHaveAttribute("tabindex", "-1");
      expect(destination).toBeVisible();
    }
  });

  it("filters role types without changing the ED directory and resets both filters", () => {
    renderOnCall();
    fireEvent.change(screen.getByRole("combobox", { name: "Filter on-call roles" }), {
      target: { value: "consultant" },
    });
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("3 roles of 9");
    const roster = within(screen.getByTestId("ward-on-call-service-table"));
    expect(roster.getAllByText("Duty consultant")).toHaveLength(3);
    expect(within(screen.getByTestId("ward-on-call-ed-table")).getAllByRole("row")).toHaveLength(
      allEmergencyDepartments().length + 1,
    );
    fireEvent.click(screen.getByRole("button", { name: "East Metro" }));
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("1 role of 9");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getByRole("combobox", { name: "Filter on-call roles" })).toHaveValue("all");
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("9 roles recorded");
  });

  it("finds statewide roles and searches by the reason for contact", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("button", { name: "Statewide" }));
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("2 roles of 9");
    expect(screen.getByText("Statewide bed placement")).toBeVisible();
    expect(screen.getByText("Senior operational escalation")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "specialist psychiatry advice" } });
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("3 roles of 9");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "enquiries" } });
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("1 role of 9");
    expect(screen.getByText("Private placement enquiries")).toBeVisible();
  });

  it("links every department to its own ED workspace and keeps contact preparation visible", () => {
    renderOnCall();
    for (const department of allEmergencyDepartments()) {
      expect(screen.getByRole("link", { name: `Open ${department.name} workspace` })).toHaveAttribute(
        "href",
        `/mockups/ward-flow/ed/${encodeURIComponent(department.id)}`,
      );
    }
    expect(screen.getByRole("heading", { name: "Before you contact a team" })).toBeVisible();
    expect(
      screen.getByText(/Have the movement reference, referring site, reason for contact and urgency ready/),
    ).toBeVisible();
  });

  it("remembers the service on remount and persists a clear-filters reset", async () => {
    const first = renderOnCall();
    fireEvent.click(screen.getByRole("button", { name: "East Metro" }));
    expect(window.localStorage.getItem("ward-flow:on-call:service")).toBe("East Metro");
    first.unmount();
    renderOnCall();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "East Metro" })).toHaveAttribute("aria-pressed", "true"),
    );
    expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("2 roles of 9");
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.localStorage.getItem("ward-flow:on-call:service")).toBe("all");
  });

  it("keeps filters usable when preference storage is unavailable", () => {
    renderOnCall();
    const writer = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Unavailable");
    });
    try {
      fireEvent.click(screen.getByRole("button", { name: "South Metro" }));
      expect(screen.getByRole("button", { name: "South Metro" })).toHaveAttribute("aria-pressed", "true");
      expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("2 roles of 9");
      fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(screen.getByTestId("ward-on-call-count")).toHaveTextContent("9 roles recorded");
    } finally {
      writer.mockRestore();
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
