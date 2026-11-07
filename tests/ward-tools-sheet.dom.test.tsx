import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WardFlowOverride, WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { ToolFormTimes } from "@/components/ward-management/tools/ward-tool-form-times";
import { WardToolsSheet } from "@/components/ward-management/tools/ward-tools-sheet";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { resetWardAccessStoreForTests, setWardAccess } from "@/components/ward-management/shell/ward-access-store";
import { setWardFeatureFlagOnDevice } from "@/components/ward-management/shell/ward-feature-flag-store";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { typeDate } from "./helpers/type-date-time";
import {
  DEFAULT_BED_FINDER_FILTERS,
  findBeds,
  WardBedFinder,
} from "@/components/ward-management/tools/ward-bed-finder";

vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function renderSheet(isPhone = false, twoPane = false) {
  const onNavigate = vi.fn();
  const onNewReferral = vi.fn();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardToolsSheet
        isPhone={isPhone}
        twoPane={twoPane}
        roleLabel="Bed coordinator"
        onNavigate={onNavigate}
        onNewReferral={onNewReferral}
      />
    </WardFlowProvider>,
  );
  return { onNavigate, onNewReferral };
}

/** Tools polish (3 Nov 2026): long groups show five rows, then Show more. Opens every group. */
function showAllRows() {
  for (const more of screen.queryAllByRole("button", { name: /^Show \d+ more$/u })) fireEvent.click(more);
}

describe("Tools sheet mockup (Tools review, 15 Oct 2026)", () => {
  it("is one sheet in the reviewed groups, with the repeated items gone", () => {
    renderSheet();
    // Tools redesign (approved 31 Oct 2026): three groups; More pages folds into Look up.
    for (const group of ["Do now", "Look up", "Print and share"]) {
      expect(screen.getByRole("region", { name: group })).toBeTruthy();
    }
    expect(screen.queryByRole("region", { name: "More pages" })).toBeNull();
    for (const gone of [
      "Service now",
      "Figures at a glance",
      "Appearance",
      "Ward Flow Digest",
      "Shift desk",
      "Utilities",
      "Directory",
    ]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    expect(screen.queryByRole("link", { name: /Settings/u })).toBeNull();
  });

  it("keeps working tools only on a desktop, as change 8 mocked (D-77)", () => {
    renderSheet();
    showAllRows();
    // Each has its own place already. The new frame (Josh, 31 Oct 2026) drops the header's Synthetic
    // pill, so the Demo controls sit at the foot of Tools on a desktop too (the board clock opens them).
    expect(screen.getByRole("region", { name: "Demo" })).toBeTruthy();
    expect(screen.getByTestId("ward-tools-toggle-demo")).toBeTruthy();
    for (const gone of [/New referral/u, /Handover sheet/u, /Out of area/u]) {
      expect(screen.queryByRole("button", { name: gone })).toBeNull();
      expect(screen.queryByRole("link", { name: gone })).toBeNull();
    }
    expect(screen.getByRole("link", { name: /Log a delay/u })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Legal forms/u })).toBeTruthy();
  });

  it("starts a referral from Do now on a phone, which has no Synthetic pill and keeps its Tools", () => {
    const { onNewReferral } = renderSheet(true);
    showAllRows();
    expect(screen.getByRole("region", { name: "Demo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Handover sheet/u })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Out of area/u })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /New referral/u }));
    expect(onNewReferral).toHaveBeenCalledTimes(1);
    expect(onNewReferral).toHaveBeenCalledWith();
  });

  it("starts a community referral from a Suburb lookup result", () => {
    const { onNewReferral } = renderSheet();
    // Tools overhaul (2 Nov 2026): Catchment lookup is now Suburb lookup, drawn by the shared card (D-91).
    fireEvent.click(screen.getByTestId("ward-tools-toggle-catchment"));
    const card = screen.getByTestId("suburb-lookup-card");
    fireEvent.change(within(card).getByRole("searchbox", { name: "Suburb or postcode" }), {
      target: { value: "Morley" },
    });
    fireEvent.click(within(card).getAllByRole("button", { name: "Refer to this team" })[0]!);
    expect(onNewReferral).toHaveBeenCalledTimes(1);
    expect(onNewReferral).toHaveBeenCalledWith("community");
  });

  // Josh, 6 Nov 2026: below two panes a tool opens as its own page, with All tools to go back.
  it("opens a tool as its own page and goes back to the list", () => {
    renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-bed-finder"));
    const page = screen.getByTestId("ward-tools-page");
    expect(page.getAttribute("aria-label")).toBe("Find a bed");
    // The list steps aside while the page shows, so nothing expands inside it.
    expect(screen.queryByRole("region", { name: "Look up" })).toBeNull();
    // Audit 24-1 decision 1: no legal status is assumed, so the tool opens asking for one.
    expect(within(screen.getByTestId("ward-tools-bed-finder")).getByRole("status").textContent).toMatch(
      /Choose a legal status to list wards/u,
    );
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    expect(screen.queryByTestId("ward-tools-page")).toBeNull();
    expect(screen.getByRole("region", { name: "Look up" })).toBeTruthy();
  });

  it("goes back from a tool page with Escape before the sheet closes", () => {
    renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-form-times"));
    expect(screen.getByTestId("ward-form-times")).toBeTruthy();
    // The Sheet's window listener skips an Escape that is already handled (defaultPrevented).
    let handled: boolean | null = null;
    const outside = (event: KeyboardEvent) => {
      handled = event.defaultPrevented;
    };
    window.addEventListener("keydown", outside);
    fireEvent.keyDown(screen.getByTestId("ward-tools-page"), { key: "Escape" });
    window.removeEventListener("keydown", outside);
    expect(screen.queryByTestId("ward-tools-page")).toBeNull();
    expect(handled).toBe(true);
  });

  it("lets a menu inside a tool page take Escape first", () => {
    renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-contacts"));
    const page = screen.getByTestId("ward-tools-page");
    fireEvent.click(within(page).getByRole("button", { name: /^Contact list:/u }));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("ward-tools-page")).toBeTruthy();
  });

  it("keeps one tool open at a time, so opening another closes the first (Q310)", () => {
    renderSheet();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-bed-finder"));
    expect(screen.getByTestId("ward-tools-bed-finder")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    fireEvent.click(screen.getByTestId("ward-tools-toggle-form-times"));
    expect(screen.getByTestId("ward-form-times")).toBeTruthy();
    expect(screen.queryByTestId("ward-tools-bed-finder")).toBeNull();
    expect(screen.getAllByTestId("ward-tools-page")).toHaveLength(1);
  });

  // Audit 24-1 decision 1 replaced the six-ward shortlist: every ward in scope is listed.
  it.each([6, 7])("lists all %i wards in scope, with no shortlist", (count) => {
    function MatchingWards() {
      const flow = useWardFlow();
      const template = findBeds(flow.units, [], [], { ...DEFAULT_BED_FINDER_FILTERS, legalStatus: "voluntary" })[0]
        ?.unit;
      if (!template) throw new Error("the fixture needs one matching adult ward");
      const units = Array.from({ length: count }, (_, index) => ({
        ...template,
        id: `finder-${index + 1}`,
        name: `Finder ward ${index + 1}`,
      }));
      // An override reaches the finder's field reads as well as whole-value readers.
      return (
        <WardFlowOverride value={{ ...flow, units, bedReleases: [] }}>
          <WardBedFinder onNavigate={vi.fn()} />
        </WardFlowOverride>
      );
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <MatchingWards />
      </WardFlowProvider>,
    );
    const finder = screen.getByTestId("ward-tools-bed-finder");
    fireEvent.click(
      within(within(finder).getByRole("group", { name: "Legal status" })).getByRole("button", { name: "Voluntary" }),
    );
    expect(within(finder).getByRole("status")).toHaveTextContent(`${count} wards`);
    expect(
      within(within(finder).getByRole("list", { name: "Ready beds by ward" })).getAllByRole("listitem"),
    ).toHaveLength(count);
    expect(within(finder).queryByText(/Showing 6 of/u)).not.toBeInTheDocument();
  });

  // Josh, 6 Nov 2026: the TV board joins Tools on every size (it left in D-77 change 8).
  it("offers no unbuilt rows", () => {
    renderSheet(true);
    // Escalation check stays out until its trigger values are signed (Tools polish, 15 Oct 2026).
    expect(screen.queryByRole("button", { name: /Escalation check/u })).toBeNull();
    expect(screen.queryByText("Not wired in this prototype.")).toBeNull();
  });

  it("opens a requested tool once, then tells the parent so a later open starts closed", async () => {
    const onRequestHandled = vi.fn();
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone
          roleLabel="Bed coordinator"
          onNavigate={vi.fn()}
          onNewReferral={vi.fn()}
          openRequest={{ tool: "demo", seq: 1 }}
          onRequestHandled={onRequestHandled}
        />
      </WardFlowProvider>,
    );
    expect(await screen.findByTestId("ward-tools-demo-panel")).toBeTruthy();
    await vi.waitFor(() => expect(onRequestHandled).toHaveBeenCalledTimes(1));
  });

  it("keeps the phone's demo controls together behind one Demo row", () => {
    renderSheet(true);
    fireEvent.click(screen.getByTestId("ward-tools-toggle-demo"));
    const panel = screen.getByTestId("ward-tools-demo-panel");
    expect(within(panel).getByRole("group", { name: "Demo scenario" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "+15 min" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Reset demo" })).toBeTruthy();
    // The one tap Demo reset (#298) lives in the same panel, behind its own flag.
    expect(within(panel).getByTestId("ward-demo-reset-winter-surge")).toBeTruthy();
    // Its three scenarios load from the reset, after a confirm, so the picker does not repeat them.
    const picker = within(panel).getByRole("group", { name: "Demo scenario" });
    expect(within(picker).queryByRole("button", { name: /Winter surge/u })).toBeNull();
    expect(within(picker).getByRole("button", { name: /Standard day/u })).toBeTruthy();
  });

  it("shows every row on phone and tablet (Josh, 6 Nov 2026)", () => {
    renderSheet(true);
    expect(screen.queryByRole("button", { name: /^Show \d+ more$/u })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Look up" })).getByRole("link", { name: /Legal forms/u }),
    ).toBeTruthy();
  });

  it("adds Find a patient, Bed meeting agenda and TV board for the coordinator", () => {
    renderSheet(true);
    expect(screen.getByRole("link", { name: /Find a patient.*opens its page/u }).getAttribute("href")).toBe(
      "/ward-flow/search",
    );
    expect(screen.getByRole("link", { name: /Bed meeting agenda/u }).getAttribute("href")).toBe(
      "/ward-flow/bed-meeting/agenda",
    );
    expect(screen.getByRole("link", { name: /TV board/u }).getAttribute("href")).toBe("/ward-flow/bed-meeting");
  });

  it("shows five rows of a long group in two panes, then Show more", async () => {
    renderSheet(false, true);
    const lookUp = screen.getByRole("region", { name: "Look up" });
    const more = within(lookUp).getByRole("button", { name: /^Show \d+ more$/u });
    expect(within(lookUp).queryByRole("link", { name: /Legal forms/u })).toBeNull();
    fireEvent.click(more);
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });
    // Focus moves to the first revealed row, not lost with the button.
    expect(lookUp.contains(document.activeElement)).toBe(true);
    expect(within(lookUp).getByRole("link", { name: /Legal forms/u })).toBeTruthy();
    expect(within(lookUp).queryByRole("button", { name: /^Show \d+ more$/u })).toBeNull();
  });

  it("opens a Recent tool even when its row sits under Show more", () => {
    renderSheet(true);
    showAllRows();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-form-times"));
    cleanup();
    renderSheet(true);
    const recent = screen.getByRole("region", { name: "Recent" });
    fireEvent.click(within(recent).getByRole("button", { name: /Form times/u }));
    expect(screen.getByTestId("ward-form-times")).toBeTruthy();
    // Going back shows the row again, so focus is not lost.
    fireEvent.click(screen.getByRole("button", { name: "All tools" }));
    expect(screen.getByTestId("ward-tools-toggle-form-times")).toBeTruthy();
  });

  it("puts the Hospital feed under Do now and Find a bed, then Legal forms, under Look up", () => {
    renderSheet();
    showAllRows();
    const doNow = screen.getByRole("region", { name: "Do now" });
    expect(within(doNow).getByTestId("ward-tools-toggle-feed")).toBeTruthy();
    const lookUp = screen.getByRole("region", { name: "Look up" });
    const rows = within(lookUp).getAllByRole("button").concat(within(lookUp).getAllByRole("link"));
    expect(within(lookUp).getAllByRole("button")[0]).toBe(screen.getByTestId("ward-tools-toggle-bed-finder"));
    expect(rows.some((row) => /Legal forms/u.test(row.textContent ?? ""))).toBe(true);
    // A row that opens a page says so; a row that opens here is a plain button with no disclosure state.
    expect(within(lookUp).getByRole("link", { name: /Legal forms.*opens its page/u })).toBeTruthy();
    expect(screen.getByTestId("ward-tools-toggle-bed-finder").hasAttribute("aria-expanded")).toBe(false);
  });

  it("finds a tool by its name or line, keeps its group, and says when nothing matches", () => {
    renderSheet();
    const search = screen.getByRole("searchbox", { name: "Search tools" });
    fireEvent.change(search, { target: { value: "bed" } });
    // By name (Find a bed) and by its short line (Key figures: "Beds, flow and waits").
    expect(screen.getByTestId("ward-tools-toggle-bed-finder")).toBeTruthy();
    expect(screen.getByTestId("ward-tools-toggle-figures")).toBeTruthy();
    expect(screen.queryByTestId("ward-tools-toggle-form-times")).toBeNull();
    // The Recent or Suggested row steps aside too, so a match is never listed twice.
    expect(screen.queryByRole("region", { name: /^(Recent|Suggested)$/u })).toBeNull();
    // The Demo foot steps aside while a search is typed.
    expect(screen.queryByRole("region", { name: "Demo" })).toBeNull();
    fireEvent.change(search, { target: { value: "postcode" } });
    expect(screen.getByTestId("ward-tools-toggle-catchment")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Do now" })).toBeNull();
    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No tool matches “zzz”.");
    expect(within(screen.getByRole("status")).getByRole("button", { name: "Search Ward Flow" })).toBeTruthy();
    // With no header search on the page (Patients is the search), the sheet stays open and says so.
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Search Ward Flow" }));
    expect(screen.getByRole("status")).toHaveTextContent("Search is not on this page. Open Patients to search.");
    fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Clear" }));
    expect(search).toHaveValue("");
    expect(screen.getByRole("region", { name: "Do now" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Demo" })).toBeTruthy();
  });

  it("clears the search on Escape, and empties the side pane when nothing matches", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardToolsSheet
          isPhone={false}
          twoPane
          roleLabel="Bed coordinator"
          onNavigate={vi.fn()}
          onNewReferral={vi.fn()}
        />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByTestId("ward-tools-toggle-figures"));
    expect(screen.getByRole("region", { name: "Key figures" })).toBeTruthy();
    const search = screen.getByRole("searchbox", { name: "Search tools" });
    fireEvent.change(search, { target: { value: "zzz" } });
    // No match: the old tool leaves the pane rather than sitting beside "No tool matches".
    expect(screen.queryByRole("region", { name: "Key figures" })).toBeNull();
    expect(screen.getByText("Choose a tool.")).toBeTruthy();
    // Escape with words typed clears the box and is marked handled, so the sheet stays open.
    const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      search.dispatchEvent(escape);
    });
    expect(escape.defaultPrevented).toBe(true);
    expect(search).toHaveValue("");
    expect(screen.getByRole("region", { name: "Key figures" })).toBeTruthy();
    // An empty box leaves Escape alone, for the sheet to close.
    const again = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    act(() => {
      search.dispatchEvent(again);
    });
    expect(again.defaultPrevented).toBe(false);
  });

  it("opens every figure in place without repeating the headline figures (simplification A2)", () => {
    renderSheet();
    expect(screen.queryByTestId("ward-tools-service-now")).toBeNull();
    fireEvent.click(screen.getByTestId("ward-tools-toggle-figures"));
    const figures = screen.getByTestId("ward-stats-drawer-content");
    // Key figures (Q321): four headline figures, everything else one link away on Statistics.
    for (const label of ["Beds ready", "Occupancy", "Open ED movements", "Waiting in ED"]) {
      expect(within(figures).getByText(label)).toBeTruthy();
    }
    expect(
      within(figures)
        .getByRole("link", { name: /See all on Statistics/u })
        .getAttribute("href"),
    ).toBe("/ward-flow/statistics");
  });
});

describe("Tools offers each desk only the tools its role may use (audit, 1 Nov 2026)", () => {
  const NETWORK_FIGURE_TOOLS = ["bed-finder", "figures", "messages"] as const;

  function atDesk(access: WardAccess) {
    act(() => setWardFeatureFlagOnDevice("role-access", true));
    act(() => setWardAccess(access));
  }

  afterEach(() => {
    act(() => setWardFeatureFlagOnDevice("role-access", null));
    resetWardAccessStoreForTests();
  });

  it("gives the coordinator Find a bed, Key figures, Messages and Log a delay", () => {
    renderSheet();
    for (const id of NETWORK_FIGURE_TOOLS) expect(screen.getByTestId(`ward-tools-toggle-${id}`)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Log a delay/u })).toBeTruthy();
  });

  it.each([
    ["transport officer", { role: "officer", scope: { kind: "jobs" } }],
    ["access admin", { role: "admin", scope: { kind: "statewide" } }],
  ] as const)("leaves the network bed figures out for the %s (Decision 47)", (_name, access) => {
    atDesk(access as WardAccess);
    renderSheet();
    for (const id of NETWORK_FIGURE_TOOLS) expect(screen.queryByTestId(`ward-tools-toggle-${id}`)).toBeNull();
    // Exact names, so the Hospital feed's "Messages to confirm" line cannot stand in for them.
    for (const name of ["Find a bed", "Key figures", "Messages"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
    // A search cannot bring them back.
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), { target: { value: "bed" } });
    for (const id of NETWORK_FIGURE_TOOLS) expect(screen.queryByTestId(`ward-tools-toggle-${id}`)).toBeNull();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), { target: { value: "messages" } });
    expect(screen.queryByTestId("ward-tools-toggle-messages")).toBeNull();
  });

  it("offers Log a delay only to a desk whose role may record a delay", () => {
    // The site bed manager may open the Waiting list but may not record a blocker there (Q97 audit
    // item 9), so it is not offered the row. It keeps the network bed figures.
    atDesk({ role: "bed_manager", scope: { kind: "site", siteCode: "FSH" } });
    let canOpenWaiting: boolean | undefined;
    function Probe() {
      canOpenWaiting = useCanOpenHref()("/ward-flow/waiting");
      return null;
    }
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Probe />
        <WardToolsSheet isPhone={false} roleLabel="Site bed manager" onNavigate={vi.fn()} onNewReferral={vi.fn()} />
      </WardFlowProvider>,
    );
    expect(canOpenWaiting).toBe(true);
    expect(screen.queryByRole("link", { name: /Log a delay/u })).toBeNull();
    expect(screen.getByTestId("ward-tools-toggle-bed-finder")).toBeTruthy();
  });

  it("keeps Log a delay for a ward desk, which may record one", () => {
    atDesk({ role: "ward", scope: { kind: "ward", unitIds: ["rph-adult-secure"] } });
    renderSheet();
    expect(screen.getByRole("link", { name: /Log a delay/u })).toBeTruthy();
  });
});

describe("Form times on the Perth clock", () => {
  afterEach(() => vi.useRealTimers());

  function pickForm(name: RegExp) {
    fireEvent.click(screen.getByTestId("ward-form-times-form"));
    fireEvent.click(screen.getByRole("menuitemradio", { name }));
  }

  it("starts with no form, date or time, and shows a result only once all three are entered", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolFormTimes onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    // Owner rule (19 Oct 2026): no MHA form type or form time is prefilled, and rule D5: the
    // result shows only what the person entered.
    expect(screen.getByTestId("ward-form-times-form")).toHaveTextContent("Choose a form");
    expect(screen.getByLabelText("Date on form")).toHaveValue("");
    expect(screen.getByLabelText("Time on form")).toHaveValue("");
    const result = screen.getByTestId("ward-form-times-result");
    expect(result.textContent).toBe("Not recorded");
    fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "09:15" } });
    typeDate(screen.getByLabelText("Date on form"), "2026-09-26");
    expect(result.textContent).toBe("Not recorded");
    // Any form a Legal forms record can carry, not only the ones with a clock.
    fireEvent.click(screen.getByTestId("ward-form-times-form"));
    expect(screen.getByRole("menuitemradio", { name: /^Form 4A/u })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitemradio", { name: /^Form 1A/u }));
    expect(result).toHaveTextContent("09:15");
    expect(result).toHaveTextContent("as typed");
  });

  it("shows nothing for a cleared time rather than reading it as midnight", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolFormTimes onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    pickForm(/^Form 1A/u);
    typeDate(screen.getByLabelText("Date on form"), "2026-09-26");
    fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "09:15" } });
    fireEvent.change(screen.getByLabelText("Time on form"), { target: { value: "" } });
    expect(screen.getByTestId("ward-form-times-result").textContent).toBe("Not recorded");
  });
});
