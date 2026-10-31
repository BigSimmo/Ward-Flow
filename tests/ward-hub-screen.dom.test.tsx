/**
 * The Master Search Hub (`/ward-flow/hub`, `HubScreen`) — one place to search every ward,
 * emergency department and community team, with a preview pane. Built against the owner-approved
 * mockup at `scratchpad/fix-hub/fixhub_master_search.html` (its own footer records exactly what in
 * it is real fixture data and what is invented for the prototype).
 *
 * 🔴 **THIS FILE IS WRITTEN AGAINST A COMPONENT THAT DOES NOT EXIST YET.** `hub-screen.tsx` and
 * `hub-derivations.ts` are owned by two other agents building alongside this one, per the file-
 * ownership split for this task. Every case below will fail to *import* until both land — that is
 * expected and is reported as such, not stubbed around. The accessible shape asserted here (a
 * `searchbox` search field, a `tablist` of `All`/`Wards`/`EDs`/`Community`, one preview pane) is
 * taken directly from the approved mockup's own markup, which `hub-screen.tsx` is expected to
 * implement; if the shipped component names these differently, this file's queries — not the
 * clinical claims they guard — are what should move.
 *
 * ⚠️ **IT WAS `combobox` UNTIL 2026-09-06, AND THAT WAS THE COMPONENT'S BUG, NOT THIS FILE'S.** The
 * input declared `role="combobox"` with `aria-expanded="true"` hard-coded over a list with no
 * `option` roles and no key handler — announcing a widget that did not exist. The role was dropped
 * rather than the pattern faked, so these queries followed the fix. **A test that had asserted the
 * false role would have made removing it look like a regression**, which is how a wrong ARIA claim
 * survives review.
 *
 * ⚠️ **GUARDS THE CLAIM, NEVER THE RENDERING.** Nothing here asserts that an element or class
 * exists. Every case asserts a sentence that would be WRONG if the underlying behaviour broke —
 * search narrowing, the type filter, the "both numbers" ruling, zero-as-words, and a flag that
 * survives colour blindness.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// Same insurance ward-capacity-view.dom.test.tsx and ward-route-component-binding.test.ts take:
// the shared rail renders next/link anchors and, on some ward screens, reads next/navigation
// synchronously during render. Both are harmless no-ops if HubScreen never touches them.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const router = vi.hoisted(() => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  // The Ward Flow sidebar derives its role from the route (ward-nav-role-order.ts), so every
  // suite that renders a rail needs a pathname. A whole-module mock without one makes
  // `usePathname` undefined, which throws at render rather than returning a wrong answer.
  usePathname: () => "/ward-flow",
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(),
}));

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { GroupList, HubScreen } from "@/components/ward-management/hub/hub-screen";
import { unitCapacity } from "@/components/ward-management/ward-derivations";
import { allUnits, edById, NOW_ANCHOR, unitById, wardSites } from "@/components/ward-management/ward-sites";
import { MINUTES_PER_DAY, formatInstant, formatInstantWithDay } from "@/components/ward-management/ward-clock";
// The hub lists the real WA teams since 2026-09-18 (owner ruling Q-5); the ten region
// placeholders it used to show are retired. Pick a real one to assert against.
import { COMMUNITY_TEAM_PAGES } from "@/components/ward-management/community/community-derivations";

const A_REAL_TEAM = COMMUNITY_TEAM_PAGES[0].name;
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { edStatisticsHref, wardStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { WARD_CAPACITY_HREF } from "@/components/ward-management/ward-nav";

function renderHub() {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HubScreen />
    </WardFlowProvider>,
  );
}

/**
 * Review point 21 (Josh approved 31 Oct 2026): Places is a directory. The search NARROWS the list
 * (it no longer highlights and dims), services after the first two fold, in All the EDs and teams
 * fold to one row each, and a long group shows eight rows then Show more. These helpers read the
 * results list alone, because the preview (which now always shows a place on a wider screen)
 * repeats the selected place's name.
 */
const resultsList = () => {
  const list = document.getElementById("hub-results");
  if (list === null) throw new Error("the hub's results list (#hub-results) is not on the page");
  return list;
};
const results = () => within(resultsList());
const listed = (name: string) => results().queryByText(name);
/** Opens every fold and presses Show more until every row of the current view is on the list. */
function expandAll() {
  for (let round = 0; round < 50; round += 1) {
    const folded = Array.from(resultsList().querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'));
    const more = results().queryAllByRole("button", { name: /^show \d+ more$/i });
    const next = folded[0] ?? more[0];
    if (next === undefined) return;
    fireEvent.click(next);
  }
  throw new Error("the list never finished expanding");
}
function clickRow(name: string) {
  expandAll();
  fireEvent.click(results().getByText(name));
}
/** The number the list foot states ("12 of 96 match" or "22 of 96 listed"). */
function footCount(): number {
  const text = screen.getByTestId("hub-shown-count").textContent ?? "";
  const match = /^(\d+) of \d+/u.exec(text);
  if (match === null) throw new Error(`the list foot reads "${text}"`);
  return Number(match[1]);
}

/**
 * Mental Health Unit — chosen because its two capacity figures are BOTH non-zero and DISTINCT
 * (2 vs 3). A ward where the two numbers happen to be equal (e.g. Dabakarn, 1 and 1)
 * would pass a "shows two numbers" assertion even if the screen collapsed them into one and
 * happened to print that shared value twice — asymmetry is what gives the assertion teeth.
 */
const SCGH_ADULT_OPEN = unitById("scgh-adult-open");
const SCGH_CAPACITY = SCGH_ADULT_OPEN ? unitCapacity(SCGH_ADULT_OPEN, []) : undefined;

/** SJGS Adult Secure — locked AND not Mental Health Act authorised, per the fixture's own note
 *  that the two facts are independent (a unit can be both at once). Used for the flagged-state
 *  case: the flag must be readable as a WORD, not only as a colour. */
const SJGS_ADULT_SECURE = unitById("sjgs-adult-secure");

/** Joondalup's own emergency department genuinely serves no on-site mental health ward — the real
 *  network asymmetry the mockup's footer calls out by name. This is a REPORTED absence, not a
 *  missing figure, so the screen must say so in words rather than print a bare "0". */
const JOONDALUP_ED = edById("jhc-ed");
const JOONDALUP_SITE = wardSites.find((site) => site.code === "JHC");

/** v6: the category filter is a segmented radio group ("All 96", "Wards 22", …). */
const CATEGORY_LABEL: Record<string, RegExp> = {
  all: /^All\s*\d+$/u,
  ward: /^Wards\s*\d+$/u,
  ed: /^EDs\s*\d+$/u,
  // Round 2 of the redesign: the switch reads Teams.
  community: /^Teams\s*\d+$/u,
};
function categoryRadio(value: string): HTMLElement {
  const label = CATEGORY_LABEL[value];
  if (label === undefined) throw new Error(`no category radio for ${value}`);
  return screen.getByRole("radio", { name: label });
}

describe("Ward Flow Master Search Hub — fixture assumptions (floors the discriminating population)", () => {
  it("keeps Search hub as a place directory, not a second job board (Wave 4 item 14)", () => {
    renderHub();
    // v6: the h1 reads "Places, 22 wards, …" — the page name leads, the network sentence follows.
    expect(screen.getByRole("heading", { level: 1, name: /^Places\b/u })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Start of shift" })).not.toBeInTheDocument();
  });
  // The "both numbers" ruling now lives on Capacity and All wards (review point 21); this floor
  // stays because the fixture is shared with those pages' own guards.
  it("Mental Health Unit has two DIFFERENT non-zero capacity figures, so a collapsed-into-one screen has something to disagree with", () => {
    expect(SCGH_ADULT_OPEN, "fixture no longer has scgh-adult-open — re-point this case").toBeDefined();
    expect(SCGH_CAPACITY?.available, "Mental Health Unit's ready-to-admit figure moved").toBe(2);
    expect(SCGH_CAPACITY?.held, "Mental Health Unit's closed (empty, not offered) figure moved").toBe(3);
    expect(
      SCGH_CAPACITY?.available,
      "the two figures are now equal — this fixture can no longer tell 'two numbers' from 'one number shown twice'",
    ).not.toBe(SCGH_CAPACITY?.held);
  });

  it("SJGS Adult Secure is genuinely unauthorised, so the flag under test is a real fact and not an invented one", () => {
    expect(SJGS_ADULT_SECURE?.authorised).toBe(false);
  });

  it("Joondalup Health Campus's ED genuinely has no on-site ward — the case this fixture needs to exist for the unknown-in-words assertion to mean anything", () => {
    expect(JOONDALUP_ED, "fixture no longer has the jhc-ed emergency department").toBeDefined();
    expect(
      JOONDALUP_SITE?.units,
      "Joondalup now has an on-site unit — pick a different ED for the zero-as-words case",
    ).toEqual([]);
  });
});

describe("Ward Flow Master Search Hub — search and the type filter", () => {
  it("shows a result from every one of the three kinds when the search box is empty", () => {
    renderHub();
    // In All, the EDs and the teams start folded to one heading row each, with their count.
    expect(results().getByRole("button", { name: /^Emergency departments\s*\d+$/iu })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expandAll();
    // One name from each kind, each guaranteed present in the live fixture rather than invented.
    expect(listed("Dabakarn")).toBeInTheDocument();
    expect(listed(edById("peel-ed")?.name ?? "__missing-ed__")).toBeInTheDocument();
    expect(listed(A_REAL_TEAM)).toBeInTheDocument();
  });

  // Review point 21: the search narrows the list to what it matches, on every screen size.
  it("narrows the list to what the query actually matches", () => {
    renderHub();
    const search = screen.getByRole("searchbox", { name: /search/i });
    fireEvent.change(search, { target: { value: "Mental Health Unit" } });

    // The one item the query names is listed...
    expect(listed("Mental Health Unit")).toBeInTheDocument();
    // ...and an unrelated ward and an unrelated community team are not. A screen that ignored the
    // query would still list them.
    expect(listed("Dabakarn")).not.toBeInTheDocument();
    expect(listed(A_REAL_TEAM)).not.toBeInTheDocument();
    expect(screen.getByTestId("hub-shown-count")).toHaveTextContent(/of \d+ match/u);
  });

  it("says when nothing matches and offers Clear search, which brings the list back", () => {
    renderHub();
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), { target: { value: "zzzz-no-place" } });
    expect(screen.getByTestId("hub-no-match")).toHaveTextContent(/matches “zzzz-no-place”/);
    expect(results().queryAllByRole("listitem")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByTestId("hub-no-match")).not.toBeInTheDocument();
    expect(results().getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ **ASSERTED ON THE SCREEN, NOT BETWEEN TWO FUNCTIONS.** `hubCounts` delegates to `searchHub`,
   * so comparing them in a unit test would be true by construction and could not fail. The claim
   * worth guarding is the one a coordinator reads: the number printed ON a tab is how many rows
   * pressing that tab produces.
   *
   * 🔴 **THE QUERY IS "metro" AND IT WAS "fremantle", WHICH PROVED LESS THAN IT LOOKED.** "fremantle"
   * matches wards and nothing else, so "all matches" and "ward matches" were the same number. "metro"
   * matches wards AND emergency departments, and the floor below refuses to run the case at all if
   * a fixture change ever takes that property away.
   */
  // The tab counts do not follow the query; the search narrows the rows that tab lists.
  it("the count in the category filter option is how many rows selecting that category actually shows, and the search narrows them", () => {
    renderHub();
    const categoryOptionCount = (value: string) => {
      const match = categoryRadio(value).textContent?.match(/(\d+)$/u);
      return match ? Number(match[1]) : 0;
    };

    const claimed = categoryOptionCount("ward");
    fireEvent.click(categoryRadio("ward"));
    expect(footCount()).toBe(claimed);
    expandAll();
    expect(results().getAllByRole("listitem")).toHaveLength(claimed);

    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), { target: { value: "metro" } });
    // The tab's own count does not follow the query...
    expect(categoryOptionCount("ward")).toBe(claimed);
    // ...and the discriminating floor: "metro" keeps some wards and drops others.
    const matched = footCount();
    expect(matched).toBeGreaterThan(0);
    expect(matched).toBeLessThan(claimed);
    expandAll();
    expect(results().getAllByRole("listitem")).toHaveLength(matched);
  });

  it("restricts the list to one kind when that kind is selected in the category dropdown, with an empty query", () => {
    renderHub();
    fireEvent.click(categoryRadio("ward"));
    expandAll();

    // Wards are still there...
    expect(listed("Dabakarn")).toBeInTheDocument();
    expect(listed("Mental Health Unit")).toBeInTheDocument();
    // ...but no emergency department or community team survives the filter. A toggle that only
    // decorated itself as pressed, without actually filtering, would fail only this half.
    expect(listed(edById("peel-ed")?.name ?? "__missing-ed__")).not.toBeInTheDocument();
    expect(listed(A_REAL_TEAM)).not.toBeInTheDocument();
  });
});

/**
 * Review point 21 (Josh approved 31 Oct 2026): Places shows no bed figures of its own. The owner's
 * 2026-09-05 "both numbers, never one" ruling is guarded where the figures now live (Capacity's bed
 * map and All wards). This case replaced the one that read Ready and Closed out of this preview.
 */
describe("Ward Flow Master Search Hub — a directory with no bed figures of its own (review point 21)", () => {
  it("a ward's row and preview carry no bed figure, and the preview points to Capacity's bed map and All wards", () => {
    renderHub();
    clickRow("Mental Health Unit");

    const row = results().getByText("Mental Health Unit").closest("li");
    expect(row?.textContent ?? "").not.toMatch(/\bready\b|\bpulled\b|\bbeds\b/iu);

    const preview = within(screen.getByRole("region", { name: /^preview, mental health unit$/iu }));
    expect(preview.queryByText(/^ready to admit$/iu)).not.toBeInTheDocument();
    expect(preview.queryByText(/^Closed, not offered$/iu)).not.toBeInTheDocument();
    expect(preview.getByRole("link", { name: /capacity.s bed map/iu })).toHaveAttribute("href", WARD_CAPACITY_HREF);
    expect(preview.getByRole("link", { name: /^all wards$/iu })).toHaveAttribute("href", "/ward-flow/wards");
  });
});

describe("Ward Flow Master Search Hub — an unknown or an absence is stated in words, never as a bare 0", () => {
  it("an emergency department with no on-site ward says so in words rather than printing a bare 0", () => {
    renderHub();
    const edName = JOONDALUP_ED?.name ?? "__missing-ed__";
    clickRow(edName);

    const preview = document.body.textContent ?? "";
    // A screen that printed "0 on-site units" would fail this — the fact must read as a sentence
    // a coordinator can act on, not a digit they have to interpret.
    expect(preview).toMatch(/no\s+(?:on-site\s+)?(?:mental health\s+)?(?:ward\s+)?beds?|no beds on-site/i);
  });
});

/**
 * The selected ward's preview text ALONE — never `document.body.textContent`.
 *
 * 🔴 The whole-page read is why the authorisation case above was vacuous: an attention panel
 * elsewhere on the same screen names every unauthorised ward and the word "Voluntary", so the
 * phrases were always present whatever the preview said.
 *
 * Scoped through the preview's own heading rather than a `data-testid`, deliberately — adding a
 * hook to `hub-screen.tsx` would be editing a component this session does not own, to make a test
 * easier. The heading is the preview's identity: if it is not there, there is no preview.
 */
function previewTextFor(wardName: string): string {
  const heading = screen.getByRole("heading", { name: wardName });
  const container = heading.parentElement;
  if (container === null) throw new Error(`the preview heading for ${wardName} has no container to read`);
  return container.textContent ?? "";
}

describe("Ward Flow Master Search Hub — every flagged state carries a word, not only a colour", () => {
  it("an unauthorised ward states the Mental Health Act fact in words when selected", () => {
    renderHub();
    clickRow("SJGS Adult Secure");

    /*
     * Whatever colour or icon the screen also uses, the sentence itself must be readable — this is
     * the assertion a colour-only flag (never proven by jsdom, which does not render CSS) fails.
     *
     * 🔴 **THIS WAS ONE REGEX WITH A TOP-LEVEL `|` UNTIL 2026-09-07, AND THE TWO BRANCHES WERE
     * DIFFERENT CLINICAL FACTS RATHER THAN TWO SPELLINGS OF ONE.**
     *
     *     /not\s+(?:mha\s+)?authoris(?:ed|ation)|voluntary(?:\s+only)?/i
     *
     * The screen renders "Not authorised — voluntary admissions only", which satisfies BOTH
     * branches, so the alternation was invisible. But a rewording that dropped the authorisation
     * half and kept "voluntary admissions only" would still have passed — **losing the fact that
     * `hub-screen.tsx`'s own comment says "decides who may legally be admitted"**, on a test whose
     * name is "states the Mental Health Act fact in words".
     *
     * ⚠️ **Alternation is right for two SPELLINGS of one claim and wrong for two CLAIMS.** The same
     * shape let a defect back into `ward-statistics-service-screen.dom.test.tsx` earlier today,
     * where `(placed|accepted)` accepted the very word a correction had removed.
     *
     * Asserted as two separate expectations rather than one combined regex, so the failure names
     * WHICH half went missing — the reason to split is the message, not the logic.
     */
    expect(
      previewTextFor("SJGS Adult Secure"),
      "the selected ward's preview no longer states its Mental Health Act authorisation status",
    ).toMatch(/not\s+(?:mha\s+)?authoris(?:ed|ation)/iu);
    expect(
      previewTextFor("SJGS Adult Secure"),
      "the preview no longer states the consequence — voluntary admissions only",
    ).toMatch(/voluntary/iu);
  });

  it("THE CONTROL — an authorised ward's preview does NOT state it, which is what proves the scope is real", () => {
    /*
     * 🔴 **WITHOUT THIS CASE THE ONE ABOVE PASSES ON A SCREEN THAT SAYS NOTHING, AND IT DID.**
     *
     * The original assertion read `document.body.textContent` — the WHOLE PAGE. Elsewhere on that
     * page an attention panel renders "N wards are not authorised under the Mental Health Act —
     * <names>. Voluntary…" whenever any unauthorised ward exists. So both phrases were always
     * present regardless of what the selected ward's preview said, and the assertion could not
     * fail.
     *
     * ⚠️ **PROVEN, NOT REASONED.** Removing "Not authorised — " from the preview in `hub-screen.tsx`
     * and leaving "Voluntary admissions only" left all 21 cases GREEN. The clinical fact the test
     * is named after had been deleted and nothing objected.
     *
     * ⚠️ **AND THE FIRST REPAIR DID NOT FIX IT EITHER.** Splitting one `|` alternation into two
     * assertions was a real improvement to a different problem and changed nothing here, because
     * both halves still read the whole body. **The mutation is what separated the two, and reasoning
     * alone had already given the wrong answer once.**
     *
     * This control is what makes the scope checkable: if `previewTextFor` ever widens back to the
     * page, an authorised ward will pick up the attention panel's wording and this case goes red.
     * The positive case alone cannot notice that.
     */
    renderHub();
    clickRow("Dabakarn");

    expect(
      previewTextFor("Dabakarn"),
      "an AUTHORISED ward's preview claims it is not authorised — which means this assertion is " +
        "reading the whole page again, not the preview, and the positive case above is vacuous",
    ).not.toMatch(/not\s+(?:mha\s+)?authoris(?:ed|ation)/iu);
  });
});

/**
 * PHASE 4 — THE KEYBOARD, WHICH IS THE HALF OF "IT WORKS" NOBODY WATCHES.
 *
 * 🔴 **BEFORE 2026-09-06 THIS SCREEN ANNOUNCED TWO WIDGETS IT HAD NOT BUILT.** The search input
 * declared `role="combobox"` with `aria-expanded="true"` hard-coded, over a list with no `option`
 * roles and with no key handler at all; the filters declared `role="tablist"` with no roving
 * `tabIndex` and no arrow handling. Both are promises to assistive technology — *press arrows, they
 * will move you* — and both were false. **A false ARIA claim is worse than none: it tells a blind
 * user to press keys that do nothing, and there is no feedback to distinguish that from a broken
 * page.**
 *
 * ⚠️ **EVERY CASE BELOW ASSERTS A CONSEQUENCE, NEVER AN ATTRIBUTE.** `toHaveAttribute("tabindex")`
 * would pass against a roving index that never roves. What is asserted instead is what a person
 * would notice: a different ward previewed, a different list on screen, the search emptied.
 */
/**
 * 🔴 **THE SAME DEFECT HAS NOW APPEARED THREE TIMES ON THIS SCREEN, IN THREE DIFFERENT PLACES, AND
 * TWO OF THEM SHIPPED.** A figure computed over the SEARCH RESULTS was printed where a figure about
 * the NETWORK belonged:
 *
 *   1. the kind tabs read "Wards 23" beside a two-row list (fixed, and guarded above);
 *   2. the disclosure panel would have claimed two wards exist the moment somebody typed
 *      "fremantle" (caught before it shipped, only because I happened to re-read it);
 *   3. the "At a glance" subtitle said "2 wards, 0 EDs, 0 community teams" three lines above a
 *      section headed "Beds, network-wide" reading "303 beds across 23 wards".
 *
 * ⚠️ **NOTHING CAUGHT ANY OF THE THREE.** They are all type-correct, all render, and each is a true
 * sentence about SOMETHING — which is exactly why review slides past them. The only thing that
 * distinguishes right from wrong is which question the number is answering, and that is invisible
 * until two answers to the same question appear on one screen.
 *
 * So the assertion is INTERNAL CONSISTENCY UNDER A NARROWING QUERY, not a value. Any pane whose
 * content is network-wide must not disagree with itself about how big the network is.
 */
describe("Ward Flow Master Search Hub — a search must not change what the screen says the network is", () => {
  it("the glance pane states one ward count, not one filtered and one not, while a query is narrowing the list", () => {
    renderHub();
    // v6: the network sentence moved from the glance pane's subtitle to the hero. v10: the title
    // is the count plus noun ("96 places") and the kinds sit in the hero eyebrow.
    const networkSentence = () => document.querySelector<HTMLElement>("[data-wf-hero]")!;

    const initialSubtitle = networkSentence().textContent ?? "";
    expect(initialSubtitle).toMatch(/wards,.*EDs,.*teams/i);
    const initialWards = Number(/(\d+)\s+wards/i.exec(initialSubtitle)?.[1]);

    // Before any query the two are trivially equal, so this is measured only after narrowing —
    // and the narrowing is proven to have happened before anything is compared.
    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), { target: { value: "fremantle" } });
    const narrowed = footCount();
    expect(
      narrowed,
      'the query "fremantle" no longer narrows the list — this case can no longer tell a filtered figure from an unfiltered one',
    ).toBeLessThan(10);

    const subtitle = networkSentence().textContent ?? "";
    const subtitleWards = Number(/(\d+)\s+wards/i.exec(subtitle)?.[1]);

    expect(Number.isNaN(subtitleWards), `could not read a ward count from the glance subtitle: "${subtitle}"`).toBe(
      false,
    );
    expect(
      subtitleWards,
      "the glance pane gives a query-filtered count instead of network totals while a search is active",
    ).toBe(initialWards);
  });
});

describe("Ward Flow Master Search Hub — the keyboard reaches everything the mouse does", () => {
  const search = () => screen.getByRole("searchbox", { name: /search/i });
  // v6: the preview is its own card above "At a glance", which now stays on screen. Nothing
  // previewed reads as the overview alone.
  const previewed = () => {
    const preview = screen.queryByRole("region", { name: /^preview,/i });
    if (preview === null) return "at a glance";
    return within(preview)
      .getAllByRole("heading")
      .map((node) => node.textContent)
      .join(" | ");
  };

  it("arrow keys move the preview through the results, and the preview follows", () => {
    renderHub();
    // Review point 21 (no empty panels): on a wider screen the preview opens on the first place listed.
    const first = previewed();
    expect(first, "nothing is previewed on arrival").not.toMatch(/at a glance/i);

    fireEvent.keyDown(search(), { key: "ArrowDown" });
    const second = previewed();

    // Two different wards, not the same one twice — a handler that fired but never advanced the
    // cursor would fail this.
    expect(second, "the arrow key did not move the cursor").not.toBe(first);

    // ...and Up returns to exactly where Down started, which a one-directional handler fails.
    fireEvent.keyDown(search(), { key: "ArrowUp" });
    expect(previewed()).toBe(first);
  });

  it("Escape clears the search, restoring rows the query had left out", () => {
    renderHub();
    fireEvent.change(search(), { target: { value: "scgh" } });
    expect(listed("Dabakarn")).not.toBeInTheDocument();

    fireEvent.keyDown(search(), { key: "Escape" });
    expect((search() as HTMLInputElement).value).toBe("");
    expandAll();
    expect(listed("Dabakarn")).toBeInTheDocument();
  });

  it("with a search typed, the arrow keys step through the matches only", () => {
    renderHub();
    fireEvent.change(search(), { target: { value: "Mental Health Unit" } });
    fireEvent.keyDown(search(), { key: "ArrowDown" });
    expect(previewed()).toMatch(/Mental Health Unit/);
  });

  it("selecting different categories in the dropdown updates the list accordingly", () => {
    renderHub();
    fireEvent.click(categoryRadio("ward"));
    expandAll();
    expect(listed("Dabakarn")).toBeInTheDocument();

    fireEvent.click(categoryRadio("ed"));
    expandAll();
    expect(listed("Dabakarn")).not.toBeInTheDocument();
    expect(listed(edById("peel-ed")?.name ?? "__missing-ed__")).toBeInTheDocument();
  });

  it("the category control is in the tab order as a single focus stop", () => {
    renderHub();
    // v6: a radio group with roving focus — only the checked radio is a tab stop.
    const radios = within(screen.getByRole("radiogroup", { name: /^show$/i })).getAllByRole("radio");
    expect(radios.filter((radio) => radio.tabIndex === 0)).toHaveLength(1);
    expect(categoryRadio("all").tabIndex).toBe(0);
  });

  // Review point 21 replaced this case: "Ready beds only" and the hero bed chips are gone, and
  // Reset still clears what the reader chose.
  it("has no Ready beds only control or bed chips, and Reset clears a kind the reader chose", () => {
    renderHub();
    expect(screen.queryByRole("button", { name: /ready beds only/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^beds ready$/i)).not.toBeInTheDocument();

    fireEvent.click(categoryRadio("ward"));
    expect(categoryRadio("ward")).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: /reset all filters/i }));
    expect(categoryRadio("all")).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("button", { name: /reset all filters/i })).not.toBeInTheDocument();
  });
});

/**
 * PINNED AND RECENTLY OPENED — the two mockup features held back until the owner decided where the
 * memory lives (2026-09-07: this browser only).
 *
 * 🔴 **EVERY CASE HERE CLEARS `localStorage` FIRST.** These are the first tests in this file with
 * state that outlives a render, and jsdom keeps one `localStorage` for the whole file — so without
 * a reset, case order decides the result and a green run would depend on which test ran before it.
 * That is a check that passes for a reason unrelated to the code.
 *
 * ⚠️ **AND EACH ASSERTS A CONSEQUENCE, NEVER THE STORAGE.** Reading the key back would pass against
 * a screen that wrote it and rendered nothing. What is asserted is what a coordinator sees: a
 * section that appears, a name inside it, a star that reverses.
 */
/**
 * 🔴 **NOTHING GUARDED THIS AND IT IS AN OWNER RULING.** An audit of the merged screen found that no
 * test in any of the four hub files mentioned `formatInstant`, `formatInstantWithDay` or
 * `confirmedAt` — so a future edit could silently revert the bed-confirmation note to a bare clock
 * face and every suite would stay green.
 *
 * The defect that fix addressed was on screen and photographed before anyone named it: at 00:12 the
 * panel read **"Ready-to-admit confirmed 23:57"** — a previous-day time asserting today.
 *
 * ⚠️ **AND THE SAME FILE CALLS THE PLAIN FORMATTER CORRECTLY ELSEWHERE.** The "As at" readout takes
 * `now`, which is today by definition. Two calls to one family on one screen, one of which must NOT
 * change — so this asserts the CONSEQUENCE at each site rather than which function was called,
 * because a blanket sweep of `formatInstant` would satisfy a name-based check while breaking the
 * header.
 */
describe("Ward Flow Master Search Hub — a time from another day says so", () => {
  it("states the day on a bed confirmation that is not from today, and does not on the 'as at' readout", () => {
    const unit = unitById("scgh-adult-open");
    expect(unit, "fixture no longer has scgh-adult-open").toBeDefined();

    // A confirmation a full day back. NOW_ANCHOR is today; subtracting 1440 minutes puts this
    // reading squarely on the previous day, which is the case a bare clock face misrepresents.
    const confirmedAt = NOW_ANCHOR - MINUTES_PER_DAY;
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HubScreen />
      </WardFlowProvider>,
    );

    // The header takes `now`, so it must stay a bare clock face — no day qualifier.
    const asAt = screen.getByText(/^As at/).textContent ?? "";
    expect(asAt, "the 'as at' readout gained a day qualifier it does not need").not.toMatch(
      /yesterday|tomorrow|days ago/i,
    );
    expect(asAt, "the 'as at' readout is no longer a clock face").toMatch(/\d{2}:\d{2}/);

    // And the formatter the note uses must qualify a previous-day instant. Asserted against the
    // shared clock module rather than the rendered string, because the fixture's own confirmation
    // times are all from today and the screen therefore cannot show the case on demand.
    expect(
      formatInstantWithDay(confirmedAt, NOW_ANCHOR),
      "a confirmation from a previous day renders as a bare clock face, asserting today",
    ).toMatch(/yesterday|days ago/i);
    expect(formatInstant(confirmedAt), "the plain formatter would say the day, making the pair pointless").not.toMatch(
      /yesterday|days ago/i,
    );
  });
});

describe("Ward Flow Master Search Hub — pinned places and recently opened", () => {
  const clearMemory = () => {
    window.localStorage.clear();
    // The store caches its snapshot against the raw string, so a cleared key must also be
    // announced or a later render keeps serving the cached array.
    window.dispatchEvent(new Event("ward-hub-memory-change"));
  };

  const glance = () => within(screen.getByRole("complementary", { name: /at a glance/i }));
  const pinnedList = () => within(screen.getByRole("list", { name: "Pinned places" }));

  it("shows neither section until something is pinned or opened, so a fresh browser sees the screen unchanged", () => {
    clearMemory();
    renderHub();
    expect(glance().queryByRole("heading", { name: /^pinned/i })).not.toBeInTheDocument();
    expect(glance().queryByRole("heading", { name: /recently opened/i })).not.toBeInTheDocument();
  });

  it("pinning a ward puts it in the glance pane, and unpinning takes it away again", () => {
    clearMemory();
    renderHub();

    expandAll();
    fireEvent.click(screen.getByRole("button", { name: /^pin Mental Health Unit$/i }));
    const heading = glance().getByRole("heading", { name: /^pinned/i });
    expect(heading).toBeInTheDocument();
    expect(pinnedList().getByText("Mental Health Unit")).toBeInTheDocument();

    // The reverse half. A toggle that only ever added would pass the first half alone.
    fireEvent.click(screen.getByRole("button", { name: /^unpin Mental Health Unit$/i }));
    expect(glance().queryByRole("heading", { name: /^pinned/i })).not.toBeInTheDocument();
  });

  /**
   * ⚠️ **THE DISTINCTION THIS CASE EXISTS FOR.** Arrow keys move the preview through the results.
   * If a preview counted as a visit, holding Down for a second would stamp five wards into
   * "recently opened" that nobody chose — a list that fills itself is noise wearing the costume of
   * history. So previewing must NOT record, and only the control that actually navigates does.
   */
  it("previewing a ward does not put it in recently opened; opening it does", () => {
    clearMemory();
    renderHub();

    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search/i }), { key: "ArrowDown" });
    // 🔴 **THE ESCAPE IS NOT TIDINESS — WITHOUT IT THIS ASSERTION CANNOT FAIL.** ArrowDown selects,
    // and a selected pane shows the ward's detail instead of the overview, so "recently opened"
    // is absent whether or not the preview was recorded. Mutating `select()` to record a visit
    // left this case GREEN until the Escape was added. Returning to the overview is what makes
    // the absence mean "nothing was recorded" rather than "the section is not on screen".
    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search/i }), { key: "Escape" });
    expect(
      glance().queryByRole("heading", { name: /recently opened/i }),
      "an arrow-key preview was recorded as a visit",
    ).not.toBeInTheDocument();

    // Review point 21: with the choice cleared, the preview is back on the first place listed.
    const preview = screen.getByRole("region", { name: /^preview,/iu });
    const opened = within(preview).getByRole("heading", { level: 2 }).textContent ?? "";
    fireEvent.click(within(preview).getByRole("link", { name: /^open /i }));

    // ⚠️ **THE PANE IS SHOWING THE WARD'S DETAIL AT THIS POINT, NOT THE OVERVIEW**, so the list
    // cannot be seen until the selection is cleared. That is the screen's actual behaviour and
    // finding it here is why the hint under the search box now says Escape clears the preview as
    // well as the search — a reader told otherwise has no reason to press it while looking at a
    // ward, which is precisely when they need it.
    fireEvent.keyDown(screen.getByRole("searchbox", { name: /search/i }), { key: "Escape" });
    expect(glance().getByRole("heading", { name: /recently opened/i })).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Recently opened places" })).getByText(opened)).toBeInTheDocument();
  });

  /**
   * A stored id names something that may since have gone — a ward retired from the fixture, a
   * region renamed. Rendering the raw id would put a dead row on a clinical screen looking exactly
   * like a live one, so an unresolvable id is dropped.
   */
  it("a pinned id that no longer matches anything is dropped rather than rendered as a dead row", () => {
    clearMemory();
    window.localStorage.setItem("ward-hub-pinned", JSON.stringify(["scgh-adult-open", "ward-that-was-retired"]));
    window.dispatchEvent(new Event("ward-hub-memory-change"));
    renderHub();

    expect(pinnedList().getByText("Mental Health Unit")).toBeInTheDocument();
    expect(glance().queryByText(/ward-that-was-retired/)).not.toBeInTheDocument();
    // ...and the count beside the heading reports what is SHOWN, not what is stored — otherwise it
    // would claim two while displaying one, which is this screen's own recurring defect.
    expect(within(glance().getByRole("heading", { name: /^pinned/i })).getByText("1")).toBeInTheDocument();
  });

  it("survives localStorage being unreadable, rather than taking the screen down with it", () => {
    clearMemory();
    // 🔴 **A REAL VALUE IS STORED FIRST, AND THAT IS NOT SETUP NOISE.** The store caches its
    // snapshot against the last raw string it read. Starting from empty, a throwing `getItem` is
    // caught one layer up, the raw comes back `null`, the cache HITS on the previously-cached
    // `null`, and the parse path is never entered — so mutating that path's `try`/`catch` away left
    // this case green. Seeding a value makes the cached raw a string, so the throw produces a
    // genuine cache miss and the code this test claims to cover actually runs.
    window.localStorage.setItem("ward-hub-pinned", JSON.stringify(["scgh-adult-open"]));
    window.dispatchEvent(new Event("ward-hub-memory-change"));

    /**
     * 🔴 **`window.localStorage.getItem = fn` DOES NOT REPLACE THE METHOD, AND THIS TEST PASSED
     * VACUOUSLY UNTIL A MUTATION SAID OTHERWISE.** jsdom's `localStorage` is a Proxy whose `set`
     * trap writes a STORAGE ITEM — so that assignment quietly stored an entry called "getItem" and
     * left the real method untouched. Storage was never broken, the lists were empty because the
     * store was empty, and the assertion held for a reason unrelated to the code.
     *
     * It was invisible while the store started empty: with nothing stored, "the lists remember
     * nothing" is true whether or not reads throw. Seeding a real value first is what turned a
     * vacuous pass into a failure, and the spy below is what actually makes reads throw.
     */
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      // Private browsing in some browsers throws on access rather than returning null.
      throw new Error("SecurityError: access denied");
    });
    try {
      renderHub();
      // The screen still renders its actual job; the two lists simply remember nothing.
      expect(screen.getAllByText("Dabakarn").length).toBeGreaterThan(0);
      expect(
        glance().queryByRole("heading", { name: /^pinned/i }),
        "a pin seeded before storage broke is still on screen, so reads are not actually failing",
      ).not.toBeInTheDocument();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("Ward Flow Master Search Hub — the owner's activity sentence", () => {
  it("says nothing was reconciled, because nothing was — D-40", () => {
    renderHub();
    /*
     * 🔴 THIS EXPECTATION WAS CHANGED ON 2026-09-11 AND THE CHANGE OVERTURNS WHAT THIS FILE
     * PREVIOUSLY ASSERTED. Saying so here rather than letting a flipped string read as a rename.
     *
     * It used to require "Invented figures, reconciled with each other" on the rendered screen —
     * the owner's own words, 2026-09-10 §7, which superseded "Synthetic snapshot at <time>,
     * figures reconcile".
     *
     * ⚠️ THE OWNER'S RULING IS NOT OVERTURNED. It governs HOW the screen says the figures
     * reconcile. It does not require the screen to say they reconcile when nothing has been
     * compared — and nothing had been. The caller passed a hardcoded `0`, described in the
     * screen's own comment as "a placeholder for the shell's check array". The shell landed on
     * 2026-09-11 and the check array did not: nothing under `src/` builds a
     * `WardReconciliationCheck[]`, so `0` was never a count standing in for a measurement. It was
     * ZERO PROBLEMS OVER ZERO CHECKS, and the hub printed an agreement it had not tested.
     *
     * 🔴 AND IT PRINTED IT TWICE. `ward-rail.tsx` mounts `WardReconciliationLine` unconditionally
     * from the layout that wraps every ward route, and that component had the identical defect, so
     * /ward-flow/hub carried two agreeing sentences derived from no checks at all.
     *
     * WHERE THE OWNER'S WORDING IS STILL PINNED: `tests/ward-hub-reconciliation-line.test.ts`
     * exercises `hubReconciliationLine(0)`, `(1)` and `(2)` directly, so the reconciled branch and
     * its exact words are still guarded. The ruling moved from "what this screen renders today" to
     * "what this screen renders once it has something to reconcile" — which is the day standard
     * §8.7 defines how a screen supplies its checks, and the screen's own comment still instructs
     * that the literal be replaced with the count then.
     */
    expect(screen.getByText(/^As at/i)).toBeInTheDocument();
    expect(screen.queryByText(/No reconciliation is available for this page yet/i)).not.toBeInTheDocument();
    // The negative half, and it is the one that would have caught the defect: the screen must not
    // claim agreement while it has nothing to agree about.
    expect(
      screen.queryByText(/reconciled with each other/i),
      "the hub is asserting that invented figures reconcile, over a check array that does not exist",
    ).not.toBeInTheDocument();
    // v6: the hero's Live chip is the one "Live" on the page; nothing else may claim live figures.
    const liveChip = screen.getByRole("button", { name: /pause demo updates$/ }).parentElement;
    const outsideChip = (document.body.textContent ?? "").replace(liveChip?.textContent ?? "", "");
    expect(outsideChip).not.toMatch(/Live/);
  });

  it("carries no form of the retired snapshot wording", () => {
    renderHub();
    // ⚠️ THIS ASSERTION PASSES VACUOUSLY TODAY AND THE STEP BELOW SAYS SO. Nothing in `src/` carries
    // either form of the old sentence (measured; errata §B says the same). It is written anyway
    // because the guard's value is entirely in the future: it is what reddens if somebody restores
    // the retired wording from a drawing. Do not report it as evidence the change landed — the
    // assertion above is that evidence.
    expect(document.body.textContent).not.toMatch(/Synthetic snapshot at/i);
  });
});

/**
 * 🔴 **THE PLAN'S TASK 2 SAID "TWO LINKS ON EVERY ROW", AND THAT IS WRONG.** Only WARD and ED rows
 * resolve to a statistics page: `/ward-flow/statistics/ward/[unitId]` resolves against
 * `units.find`, and `/ward-flow/statistics/ed/[edId]` resolves against `edById` — both real
 * ids this hub's own entries already carry. A COMMUNITY row has no such id. `hubEntries()` builds
 * its community entries from `HOME_REGIONS`/`COMMUNITY_TEAMS`, a region-keyed placeholder
 * vocabulary; `/statistics/community/[teamId]` resolves against `communityTeamById`, built from
 * `communityTeamOptions()` — the clinic names a REFERRAL actually records. The two vocabularies
 * share no names (see the block comment above `communityHref` in `hub-derivations.ts`), so a link
 * built by slugifying a region would resolve to nothing and land a coordinator on "No community
 * team in this prototype has the address …" — an href that is not an arrival. So: ward and ED rows
 * gain a second link; a community row states the absence in words instead, and NEVER gets one.
 *
 * Every entry is checked, not a hand-picked sample — that is the whole point of the catcher: a
 * spot check would pass even if one kind's statistics link (or one kind's stated absence) were
 * silently missing, because a sample of one can never contain the missing case.
 */
describe("Ward Flow Master Search Hub — the statistics link ward/ED gain, and community never does", () => {
  // The same source `hubEntries()` itself reads (`allUnits()`, `bedReleases: []`) — never a second,
  // hand-typed list of ward/ED/community names that could drift from the real fixture.
  const ALL_ENTRIES = hubEntries({ units: allUnits(), bedReleases: [], now: NOW_ANCHOR, sites: wardSites });
  const WARD_ENTRIES = ALL_ENTRIES.filter((entry) => entry.kind === "ward");
  const ED_ENTRIES = ALL_ENTRIES.filter((entry) => entry.kind === "ed");
  const COMMUNITY_ENTRIES = ALL_ENTRIES.filter((entry) => entry.kind === "community");

  // Scoped to the results list only. Once an entry is selected, its name ALSO appears in the
  // preview heading (`selected.name` as the `<h2>`) — `screen.getByText` unscoped would then match
  // two elements and throw. The list carries `id="hub-results"` already, from the component's own
  // markup.
  // Review point 21: groups fold and long ones show Show more, so the row is revealed first.
  const clickResultRow = clickRow;

  const glance = () => within(screen.getByRole("complementary", { name: /at a glance/i }));

  it("gives every ward row both its place link and a statistics link built from its own id", () => {
    expect(WARD_ENTRIES.length).toBeGreaterThan(0);
    renderHub();
    fireEvent.click(categoryRadio("ward"));

    for (const entry of WARD_ENTRIES) {
      clickResultRow(entry.name);
      const placeLink = glance().getByRole("link", { name: /^open /i });
      expect(placeLink, `${entry.name} is missing its place link`).toHaveAttribute("href", entry.href);

      const statsLink = glance().getByRole("link", { name: /view statistics/i });
      // Built from `wardStatisticsHref` — the same route table `statistics-sections.ts` already
      // exports and the ward's own statistics page already uses — never a string assembled here.
      expect(statsLink, `${entry.name} is missing its statistics link`).toHaveAttribute(
        "href",
        wardStatisticsHref(entry.id),
      );
      expect(statsLink.getAttribute("href")).toContain(encodeURIComponent(entry.id));
    }
  });

  it("gives every ED row both its place link and a statistics link built from its own id", () => {
    expect(ED_ENTRIES.length).toBeGreaterThan(0);
    renderHub();
    fireEvent.click(categoryRadio("ed"));

    for (const entry of ED_ENTRIES) {
      clickResultRow(entry.name);
      const placeLink = glance().getByRole("link", { name: /^open /i });
      expect(placeLink, `${entry.name} is missing its place link`).toHaveAttribute("href", entry.href);

      const statsLink = glance().getByRole("link", { name: /view statistics/i });
      expect(statsLink, `${entry.name} is missing its statistics link`).toHaveAttribute(
        "href",
        edStatisticsHref(entry.id),
      );
      expect(statsLink.getAttribute("href")).toContain(encodeURIComponent(entry.id));
    }
  });

  it("gives no community row a statistics link, and states the absence in words instead", () => {
    expect(COMMUNITY_ENTRIES.length).toBeGreaterThan(0);
    renderHub();
    fireEvent.click(categoryRadio("community"));

    for (const entry of COMMUNITY_ENTRIES) {
      clickResultRow(entry.name);

      // The existing place link stays — it already, deliberately, points at the community index
      // rather than a per-team page (`communityHref` in `hub-derivations.ts`).
      const placeLink = glance().getByRole("link", { name: /^open /i });
      expect(placeLink, `${entry.name} is missing its place link`).toHaveAttribute("href", entry.href);

      // 🔴 THE DECIDING ASSERTION. No link whose accessible name mentions "statistics" may exist
      // anywhere in the preview pane for a community entry — not a narrower query for one
      // particular href, which a differently-worded stray link would slip past.
      expect(
        glance().queryByRole("link", { name: /statistics/i }),
        `${entry.name} carries a statistics link, but no COMMUNITY_TEAMS id resolves against ` +
          `communityTeamById — see the block comment above communityHref in hub-derivations.ts`,
      ).not.toBeInTheDocument();

      // And the absence is IN WORDS, never a blank or a dash.
      expect(
        glance().getByText(/statistics are unavailable for this regional entry/i),
        `${entry.name} does not state the statistics absence in words`,
      ).toBeInTheDocument();
    }
  });
});

describe("Ward Flow Master Search Hub — one search on the page", () => {
  /**
   * ONE SEARCH, AND THIS TEST WAS EXPECTED TO PASS ON THE DAY IT WAS WRITTEN.
   *
   * The standard's never-list forbids a second scope control, and the plan's Task 3 said: if this
   * already passes, say so and do not invent a change to look busy. It did. The guard is written
   * anyway because its value is future — the shell (Phase 1) grows a search of its own in the bar,
   * and the route table is meant to suppress it on this route. **If that suppression is ever
   * missed, this screen quietly acquires two searches and nothing else notices.** This is what
   * reddens then.
   *
   * ⚠️ Counted through the accessibility tree rather than by grepping the source. A `grep -c` for
   * `type="search"` in `hub-screen.tsx` returns TWO — one is inside a comment explaining why the
   * real one is a search input. A guard defeated by the prose written to justify it is a shape
   * this repository has hit more than once.
   */
  it("carries exactly one search control, the hub's own", () => {
    renderHub();
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });
});

describe("Ward Flow Master Search Hub — the preview and Enter follow what the list shows", () => {
  const search = () => screen.getByRole("searchbox", { name: /search/i });
  const preview = () => screen.getByRole("region", { name: /^preview,/i });
  const previewName = () => within(preview()).getAllByRole("heading")[0]?.textContent ?? "";

  it("a pinned place does not take over a search: the preview and Enter use the top match", () => {
    window.localStorage.setItem("ward-hub-pinned", JSON.stringify(["scgh-adult-open"]));
    window.dispatchEvent(new Event("ward-hub-memory-change"));
    router.push.mockClear();
    renderHub();
    // With nothing typed, the pinned place leads the preview.
    expect(previewName()).toMatch(/Mental Health Unit/);

    fireEvent.change(search(), { target: { value: "Dabakarn" } });
    expect(previewName(), "the pinned place stayed in the preview while the list showed another").toMatch(/Dabakarn/);
    const href = within(preview())
      .getByRole("link", { name: /^open /i })
      .getAttribute("href");
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(href);

    window.localStorage.clear();
    window.dispatchEvent(new Event("ward-hub-memory-change"));
  });

  it("Enter opens nothing when the search matches nothing", () => {
    router.push.mockClear();
    renderHub();
    fireEvent.change(search(), { target: { value: "zzqqxx no such place" } });
    fireEvent.keyDown(search(), { key: "Enter" });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("the arrow keys past the eighth team open the list down to the row they preview", () => {
    renderHub();
    fireEvent.click(categoryRadio("community"));
    for (let press = 0; press < 10; press += 1) fireEvent.keyDown(search(), { key: "ArrowDown" });
    const name = previewName();
    expect(name).not.toBe("");
    expect(listed(name), `the previewed team "${name}" is not on the list`).toBeInTheDocument();
  });
});

describe("Ward Flow Master Search Hub — a group folds only when two or more rows would be hidden", () => {
  const fixture = (count: number) =>
    Array.from({ length: count }, (_, index) => ({ id: `fixture-${index + 1}`, name: `Fixture place ${index + 1}` }));
  const renderGroup = (count: number) =>
    render(
      <GroupList
        id="fixture-group"
        entries={fixture(count) as never}
        renderRow={(entry) => <li key={entry.id}>{entry.name}</li>}
        selectedId={undefined}
      />,
    );

  it("shows a group of nine in full, with no Show more", () => {
    renderGroup(9);
    expect(screen.getAllByRole("listitem")).toHaveLength(9);
    expect(screen.queryByRole("button", { name: /^Show/u })).toBeNull();
  });

  it("folds a group of ten to eight with Show 2 more, which opens the rest", () => {
    renderGroup(10);
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Show 2 more" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /^Show/u })).toBeNull();
  });
});

describe("Ward Flow Master Search Hub — fold ids and fact lists stay valid for assistive technology", () => {
  it("names each fold's list with one id that has no space, so aria-controls points at it", () => {
    renderHub();
    const controls = Array.from(document.querySelectorAll("[aria-controls^='hub-fold']")).map(
      (node) => node.getAttribute("aria-controls") ?? "",
    );
    expect(controls.length).toBeGreaterThan(0);
    for (const id of controls) expect(id).not.toMatch(/\s/u);
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      "[aria-controls^='hub-fold'][aria-expanded='true']",
    ))
      expect(document.getElementById(button.getAttribute("aria-controls") ?? "")).not.toBeNull();
  });

  it("keeps only dt and dd inside each row of a ward's fact list", () => {
    renderHub();
    fireEvent.click(categoryRadio("ward"));
    const ward = hubEntries({ units: allUnits(), bedReleases: [], now: NOW_ANCHOR, sites: wardSites }).find(
      (entry) => entry.kind === "ward" && entry.confirmedAt !== undefined,
    );
    expect(ward, "no ward in the sample has a confirmed count, so the Confirmed row is not tested").toBeTruthy();
    clickRow(ward!.name);
    expect(screen.getByRole("button", { name: "Ask to confirm" })).toBeInTheDocument();
    const rows = document.querySelectorAll("dl > div");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) for (const child of row.children) expect(["DT", "DD"]).toContain(child.tagName);
  });
});
