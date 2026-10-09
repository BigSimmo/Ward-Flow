import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnCallScreen } from "@/components/ward-management/on-call/on-call-screen";
import {
  buildOnCallDirectory,
  escalationChain,
  shiftWindow,
  SERVICE_ORDER,
} from "@/components/ward-management/on-call/on-call-directory";
import { NETWORK_ON_CALL_ROLES, SERVICE_ON_CALL_ROLES } from "@/components/ward-management/on-call/on-call-roster";
import { REFERENCE_TEAM_NAMES, referenceTeamDetail } from "@/components/ward-management/reference/ward-reference-teams";
import { WardFlowClockContext } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * 🔴 **WHAT A READER ACTUALLY SEES ON THE SCREEN THEY WOULD RING.**
 *
 * `ward-on-call-holds-no-people.test.ts` guards the source and the records. This file guards the
 * RENDER: the disclosure is visible text, every number on screen is a mock, nothing links to a
 * dialler or a mail client, highlights never hide a row, and the times shown come from the roster.
 *
 * ⚠️ **POPULATION.** jsdom at one viewport (the desktop tree; the phone tree renders under 48rem),
 * over the real site fixture with the board clock pinned at 10:42. Silent about paint and layout.
 */

const MOCK_NUMBER = /^08 0000 \d{4}$/u;

function renderOnCall() {
  return render(
    <WardFlowClockContext.Provider value={NOW_ANCHOR}>
      <OnCallScreen />
    </WardFlowClockContext.Provider>,
  );
}

const row = (id: string) => screen.getByTestId(`ward-on-call-row-${id}`);
const panel = () => within(screen.getByTestId("ward-on-call-role-panel"));
const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  window.localStorage.removeItem("ward-flow:on-call:favourites");
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the on-call screen", () => {
  it("🔴 ANTI-VACUITY — the directory has every section and every service", () => {
    const entries = buildOnCallDirectory();
    for (const section of ["hospitals", "community", "statewide"] as const) {
      expect(entries.filter((entry) => entry.section === section).length, `${section} is empty`).toBeGreaterThan(5);
    }
    for (const service of SERVICE_ORDER) {
      expect(
        entries.some((entry) => entry.service === service),
        `${service} has no contacts`,
      ).toBe(true);
    }
  });

  it("carries the synthetic-data and mock-number disclosure as visible text", () => {
    renderOnCall();
    const disclosure = screen.getByText(/Synthetic records\. Every number is a mock from an unassigned range/iu);
    expect(disclosure).toBeVisible();
    expect(disclosure.textContent).toMatch(/reserved\s+domain/iu);
  });

  it("names the page and opens on a contact card", () => {
    renderOnCall();
    const hud = screen.getByTestId("ward-on-call-hud-island");
    expect(within(hud).getByRole("heading", { level: 1, name: "On-call directory" })).toBeVisible();
    expect(panel().getByRole("heading", { level: 2, name: "Bed flow coordinator" })).toBeVisible();
    expect(panel().getByText("Not verified")).toBeVisible();
  });

  it("🔴 renders no number that is not a mock, and nothing that dials or sends", () => {
    const { container } = renderOnCall();
    const text = container.textContent ?? "";
    // Leaf by leaf, so two neighbouring values never read as one long number.
    const leaves = [...container.querySelectorAll("*")].filter((node) => node.children.length === 0);
    const runs = leaves.flatMap((node) => node.textContent?.match(/\d[\d ]{7,}\d/gu) ?? []);
    expect(runs.length, "no numbers rendered at all, so this case checks nothing").toBeGreaterThan(20);
    for (const run of runs) expect(run.trim(), `"${run}" is not an unassigned mock number`).toMatch(MOCK_NUMBER);
    const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/gu) ?? [];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) expect(email).toMatch(/@example\.invalid/u);
    expect(
      container.querySelector('a[href^="tel:"], a[href^="mailto:"], a[href^="sms:"], a[href^="callto:"]'),
    ).toBeNull();
  });

  it("never shows a published community team number", () => {
    const { container } = renderOnCall();
    fireEvent.click(screen.getByRole("tab", { name: /Community/u }));
    const text = container.textContent ?? "";
    const published = REFERENCE_TEAM_NAMES.map((name) => referenceTeamDetail(name)?.publishedPhone).filter(Boolean);
    expect(published.length).toBeGreaterThan(0);
    for (const phone of published) expect(text).not.toContain(phone);
  });

  it("takes every rostered window from the roster's own words", () => {
    const entries = buildOnCallDirectory();
    const byId = (id: string) => entries.find((entry) => entry.id === id)!;
    const bedDesk = NETWORK_ON_CALL_ROLES.find((role) => role.id === "bed-coordinator")!;
    expect(byId("sw-bfc").lines[1]!.window).toEqual(shiftWindow(bedDesk.shift));
    const north = SERVICE_ON_CALL_ROLES["North Metro"].find((role) => role.role === "Coordinator on call")!;
    expect(byId("nmhs-bfc").lines.at(-1)!.window).toEqual(shiftWindow(north.shift));
    // WACHS records no coordinator, so its bed flow line is office hours only and says where to go.
    expect(SERVICE_ON_CALL_ROLES.WACHS).toHaveLength(0);
    expect(byId("wachs-bfc").lines).toHaveLength(1);
    expect(byId("wachs-bfc").note).toMatch(/State bed desk/u);
  });

  it("states the time each number is available until, and what follows", () => {
    renderOnCall();
    const bedFlow = within(row("nmhs-bfc"));
    expect(bedFlow.getByText("20:00")).toBeVisible();
    expect(bedFlow.getByText("then on-call mobile")).toBeVisible();
    expect(panel().getByText(/Answering until/u)).toBeVisible();
  });

  it("shows cover at a later time, labelled as tomorrow when it has passed", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("radio", { name: "03:00" }));
    expect(screen.getByText("Who answers at 03:00 tomorrow")).toBeVisible();
    expect(within(row("nmhs-bfc")).getByText("08:00")).toBeVisible();
    expect(within(row("nmhs-bfc")).getByText("On-call mobile")).toBeVisible();
  });

  it("keeps the key lines in the hero with the anchor other pages link to", () => {
    const { container } = renderOnCall();
    const keys = within(screen.getByRole("group", { name: "Key lines" })).getAllByRole("button");
    expect(keys).toHaveLength(7);
    expect(container.querySelector("#ward-reach-bed")).toBe(screen.getByTestId("ward-on-call-key-sw-bfc"));
    expect(container.querySelector("#ward-reach-switchboard")).toBe(screen.getByTestId("ward-on-call-directory"));
    fireEvent.click(screen.getByTestId("ward-on-call-key-sw-mherl"));
    expect(panel().getByRole("heading", { name: "Mental Health Emergency Response Line" })).toBeVisible();
    expect(screen.getByRole("tab", { name: /Statewide/u })).toHaveAttribute("aria-selected", "true");
  });

  it("Call copies the number and says calling is not wired", async () => {
    renderOnCall();
    fireEvent.click(panel().getByRole("button", { name: /^Call 08 0000/u }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toMatch(MOCK_NUMBER);
    expect(await screen.findByTestId("ward-on-call-notice")).toHaveTextContent(/not wired in this prototype/iu);
  });

  it("highlights rows and never hides one", () => {
    renderOnCall();
    const table = screen.getByTestId("ward-on-call-dir-table");
    const before = table.querySelectorAll("tbody tr[data-testid]").length;
    fireEvent.click(screen.getByRole("button", { name: /^Has email/u }));
    expect(table.querySelectorAll("tbody tr[data-testid]").length).toBe(before);
    expect(row("nmhs-bfc").className).toMatch(/rowHighlight/u);
    expect(row("nmhs-scon").className).not.toMatch(/rowHighlight/u);
  });

  it("search highlights matches in place and lists them in the panel", () => {
    renderOnCall();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "EPIC" } });
    expect(panel().getByRole("heading", { name: "Matches" })).toBeVisible();
    expect(row("scgh-epic").className).toMatch(/rowHighlight/u);
    fireEvent.click(panel().getByRole("button", { name: "Clear" }));
    expect(panel().getByRole("heading", { name: "Bed flow coordinator" })).toBeVisible();
  });

  it("switches between hospitals, community teams and statewide lines", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("tab", { name: /Community/u }));
    expect(screen.getByText(REFERENCE_TEAM_NAMES[0]!)).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: /Statewide/u }));
    expect(row("sw-mherl")).toBeVisible();
    expect(screen.queryByTestId("ward-on-call-row-nmhs-bfc")).toBeNull();
  });

  it("groups by role so every EPIC sits together", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("button", { name: /^By role/u }));
    const heading = screen.getByRole("button", { name: /EPIC, emergency physician in charge/u });
    expect(heading).toHaveAttribute("aria-expanded", "true");
    expect(within(row("scgh-epic")).getByText("Sir Charles Gairdner Hospital")).toBeVisible();
  });

  it("collapses a group but keeps a highlighted row in view", () => {
    renderOnCall();
    const group = screen
      .getAllByRole("button", { name: /Sir Charles Gairdner Hospital/u })
      .find((button) => button.hasAttribute("aria-expanded"))!;
    fireEvent.click(group);
    expect(screen.queryByTestId("ward-on-call-row-scgh-sw")).toBeNull();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Switchboard" } });
    expect(row("scgh-sw")).toBeVisible();
  });

  it("orders the escalation ladder and labels it a preview", () => {
    const entries = buildOnCallDirectory();
    const ward = entries.find((entry) => entry.kind === "nurseInCharge" && entry.siteCode === "SCGH")!;
    expect(escalationChain(ward, entries).map((entry) => entry.kind)).toEqual(["bedFlow", "afterHours", "executive"]);
    renderOnCall();
    expect(panel().getByText("Preview order")).toBeVisible();
    expect(panel().getByText("State bed flow coordinator")).toBeVisible();
  });

  it("points a closed line at whoever answers now", () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("radio", { name: "03:00" }));
    fireEvent.click(within(row("nmhs-aml")).getByRole("button", { name: /^Aboriginal mental health liaison/u }));
    expect(panel().getByText(/Closed, opens/u)).toBeVisible();
    expect(panel().getByText(/Call now:/u)).toBeVisible();
  });

  it("marks Report change as not wired", () => {
    renderOnCall();
    const report = panel().getByRole("button", { name: /Report change/u });
    expect(report).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText("Not wired in this prototype.").length).toBeGreaterThan(0);
  });

  it("keeps My list as contact ids only, and restores it", async () => {
    const first = renderOnCall();
    fireEvent.click(within(row("nmhs-bfc")).getByRole("button", { name: /to My list/u }));
    expect(JSON.parse(localStorage.getItem("ward-flow:on-call:favourites")!)).toEqual(["nmhs-bfc"]);
    first.unmount();
    renderOnCall();
    await waitFor(() => expect(screen.getByRole("tab", { name: /My list/u })).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("tab", { name: /My list/u }));
    expect(row("nmhs-bfc")).toBeVisible();
  });

  it("rejects unknown saved ids and malformed preferences", async () => {
    localStorage.setItem("ward-flow:on-call:favourites", JSON.stringify(["nmhs-bfc", "not-a-contact", 7]));
    const first = renderOnCall();
    await waitFor(() => expect(screen.getByRole("tab", { name: /My list/u })).toHaveTextContent("1"));
    first.unmount();
    localStorage.setItem("ward-flow:on-call:favourites", "broken");
    renderOnCall();
    expect(screen.getByRole("tab", { name: /My list/u })).toHaveTextContent("0");
  });

  it("keeps My list for the visit when storage fails, and says so", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderOnCall();
    fireEvent.click(within(row("nmhs-bfc")).getByRole("button", { name: /to My list/u }));
    expect(screen.getByTestId("ward-on-call-notice")).toHaveTextContent(/this visit only/u);
    expect(screen.getByRole("tab", { name: /My list/u })).toHaveTextContent("1");
  });

  it("opens the downtime card with every key line and copies it as text", async () => {
    renderOnCall();
    fireEvent.click(screen.getByRole("button", { name: "Downtime card" }));
    const card = within(await screen.findByTestId("ward-on-call-downtime"));
    expect(card.getByText("State bed flow coordinator")).toBeVisible();
    fireEvent.click(card.getByRole("button", { name: "Copy as text" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toMatch(/State bed desk 08 0000 \d{4}, 08:00 to 20:00/u);
  });
});
