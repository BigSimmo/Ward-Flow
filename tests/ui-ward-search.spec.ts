import { expect, test, type Locator, type Page } from "playwright/test";

/**
 * FIRST BROWSER COVERAGE OF THE WARD FLOW PATIENT SEARCH (`/mockups/ward-flow/search`).
 *
 * Until this file, `PatientTypeahead` and `PatientSearchPage` had only jsdom coverage
 * (`tests/ward-patient-typeahead.dom.test.tsx`, `tests/ward-patient-search.dom.test.tsx`). jsdom
 * computes NO layout and loads NO CSS Modules stylesheet, so every assertion below is checking a
 * class of defect no existing test could ever have seen: a column escaping its scroll container,
 * a popup row scrolled out of its own clipped box, a hit target shorter than its container, two
 * visual states that read as one because two selectors were merged. None of that is expressible
 * without a real rendered box.
 *
 * WHY THE FIXTURE MATTERS: the seeded patient list (`ward-patients-seed.ts`) deliberately carries
 * three near-spelling pairs — Halloway/Hallowin, Marrowby/Marrowbee, O'Quinn/Oquinn — that cannot
 * be told apart by name alone. The two facts that DO tell them apart, record number (`umrn`) and
 * date of birth, are exactly what test 2 below proves stays on screen for both rows of a matching
 * pair at the narrowest supported width. Wrong-patient selection on this screen is the harm this
 * whole component was built to prevent (see `patient-typeahead.tsx`'s own doc comment), and that
 * harm lives entirely in geometry a unit test cannot see.
 *
 * FIXTURE ARITHMETIC: "marrowb" matches EXACTLY Ines Marrowby (UM100003, on a ward) and Devan
 * Marrowbee (UM100004, waiting in ED) in the census and nobody else; "a" fills the census with rows.
 *
 * 9 Oct 2026 (PR #194): the Patients census replaced the caseload and the typeahead's popup on
 * this page. Rows are read from the painted `ward-patient-search-results-console` only, because a
 * visually hidden legacy block still carries the old testids for jsdom tests.
 */

async function gotoSearch(page: Page): Promise<void> {
  await page.goto("/mockups/ward-flow/search", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  // The same streamed-content guard every other Ward Flow spec in this repo uses (see
  // ui-ward-discharges.spec.ts, ui-ward-roles.spec.ts): React's streaming leaves a hidden staging
  // copy of the whole screen in the document for a moment, duplicating every testid and making
  // geometry measured against it meaningless even where it does not throw outright.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the whole screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(page.getByTestId("ward-patient-search")).toBeVisible({ timeout: 15_000 });
}

function typeaheadInput(page: Page): Locator {
  return page.getByTestId("ward-patient-typeahead-input");
}

/** The painted census rows (table rows on desktop, card rows on the phone), never the hidden legacy block. */
function censusRows(page: Page): Locator {
  return page
    .getByTestId("ward-patient-search-results-console")
    .locator('[data-testid^="ward-patient-search-case-"], [data-testid^="ward-patient-search-row-"]');
}

function tableRows(page: Page): Locator {
  return page.getByTestId("ward-patient-search-results-console").locator("tbody tr[data-id]");
}

test.describe("@mockup Ward patient search", () => {
  test.describe.configure({ timeout: 60_000 });

  /**
   * THE CONTROL. Confirms the harness, the dev server and the route itself all work before any of
   * the real geometric assertions below are trusted — method note from the task brief: an
   * assertion that has never been seen to pass against a healthy page is not evidence either way
   * about a red result from a broken one.
   */
  test("CONTROL: the search screen renders its composer and its results panel", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await gotoSearch(page);
    await expect(typeaheadInput(page)).toBeVisible();
    await expect(page.getByTestId("ward-patient-search-results")).toBeVisible();
  });

  /**
   * 1. WIDTH SWEEP. Five widths: 375 (phone), 641/700/760 (the band just past the phone breakpoint
   * at 40rem, where the layout hands over from the phone census to the table) and 820.
   *
   * Two properties, both geometric and both impossible in jsdom:
   *   - every column of the census table lies within its scroll wrapper's own SCROLLABLE extent, so
   *     a reader can reach it. Sideways scrolling to see a column is expected on a table pinned
   *     wider than its box and is not a defect; a column no scroll can reach is. At 375px the phone
   *     census has no table, so there every row card must sit inside the viewport instead;
   *   - the page's own `<html>` never gains horizontal scroll at any of the five widths.
   *
   * Guard the property, never the layout that happens to satisfy it today (the owner's 2026-09-05
   * standing rule). This test was retargeted twice: from the 22 Sept caseload cards, and on 9 Oct
   * to the Patients census (PR #194). The second property once caught a live defect: a `.sr-only`
   * header label with no positioned ancestor put 324px of horizontal scroll on `<html>`.
   */
  test("no column of the census table escapes its scroll container, and the page never scrolls sideways, at 375/641/700/760/820px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoSearch(page);

    // A search that matches a handful of people in more than one group, so the census renders rows
    // to measure rather than its empty state. A broad one like "a" paints hundreds of rows, and the
    // trace snapshot of each step then outlasts the test's own time limit.
    await typeaheadInput(page).fill("pallow");

    const console_ = page.getByTestId("ward-patient-search-results-console");
    for (const width of [375, 641, 700, 760, 820]) {
      await page.setViewportSize({ width, height: 900 });
      const phone = width <= 640;
      if (phone) {
        await expect(console_.locator("table"), `${width}px should show the phone census`).toHaveCount(0);
        const rows = censusRows(page);
        await expect(rows.first()).toBeVisible();
        const outside = await rows.evaluateAll((els, vw) => {
          return els
            .filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && (r.left < -0.5 || r.right > vw + 0.5);
            })
            .map((el) => `${el.dataset.testid} (${Math.round(el.getBoundingClientRect().right)}px)`);
        }, width);
        expect(outside, `phone census row(s) past the ${width}px viewport`).toEqual([]);
      } else {
        const table = console_.locator("table");
        await expect(table, `${width}px should show the census table`).toBeVisible();
        const measured = await table.evaluate((tableEl) => {
          const scroll = tableEl.parentElement!;
          const box = scroll.getBoundingClientRect();
          const reachableLeft = box.left - 1;
          const reachableRight = box.left + scroll.scrollWidth + 1;
          const cells = [...tableEl.querySelectorAll<HTMLElement>("thead th")];
          return {
            cells: cells.length,
            scrollWidth: Math.round(scroll.scrollWidth),
            clientWidth: Math.round(scroll.clientWidth),
            unreachable: cells
              .filter((cell) => {
                const r = cell.getBoundingClientRect();
                return r.left < reachableLeft || r.right > reachableRight;
              })
              .map(
                (cell) =>
                  `${(cell.textContent ?? "").trim()} (right edge ${Math.round(cell.getBoundingClientRect().right)} vs reachable ${Math.round(reachableRight)})`,
              ),
          };
        });
        expect(measured.cells, `${width}px: the census table rendered no columns to measure`).toBeGreaterThan(0);
        expect(
          measured.unreachable,
          `column(s) of the census table at ${width}px sit outside the scroll container's own scrollable ` +
            `extent (scrollWidth ${measured.scrollWidth}, clientWidth ${measured.clientWidth}), so no amount ` +
            `of scrolling reaches them`,
        ).toEqual([]);
      }

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(
        overflow,
        `the page itself scrolls horizontally at ${width}px (overflow ${overflow}px)`,
      ).toBeLessThanOrEqual(2);
    }
  });

  /**
   * 2. THE NEAR-SPELLING PAIR AT THE NARROWEST WIDTH. Ines Marrowby is on a ward and Devan
   * Marrowbee waits in ED, so the phone census, which shows one group at a time, once showed only
   * one of them for "marrowb". A search now lists every match across groups, and each matching row
   * carries the two facts that tell the pair apart: UMRN and date of birth.
   */
  test("both Marrowby/Marrowbee rows and their identifying details stay on screen at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await gotoSearch(page);

    await typeaheadInput(page).fill("marrowb");

    const rows = censusRows(page);
    await expect(rows, "exactly the two Marrow* patients, nobody else").toHaveCount(2);
    const row1 = rows.filter({ hasText: "Ines Marrowby" });
    const row2 = rows.filter({ hasText: "Devan Marrowbee" });
    await expect(row1).toBeVisible();
    await expect(row2).toBeVisible();

    const viewportWidth = 375;
    for (const [row, label] of [
      [row1, "Ines Marrowby's row"],
      [row2, "Devan Marrowbee's row"],
    ] as const) {
      const box = await row.boundingBox();
      expect(box, `${label} has no measurable box`).not.toBeNull();
      expect(box!.x, `${label} starts left of the viewport`).toBeGreaterThanOrEqual(0);
      expect(
        box!.x + box!.width,
        `${label} extends to ${box!.x + box!.width}px, past the ${viewportWidth}px viewport`,
      ).toBeLessThanOrEqual(viewportWidth + 1);
    }

    await expect(row1.getByText("UM100003", { exact: true })).toBeVisible();
    await expect(row1.getByText(/21\/07\/1995/)).toBeVisible();
    await expect(row2.getByText("UM100004", { exact: true })).toBeVisible();
    await expect(row2.getByText(/09\/01\/1974/)).toBeVisible();
  });

  /**
   * 3. KEYBOARD AND POINTER STATES READ APART. The census replaced the typeahead popup on this page
   * (its suggestions are off; the popup's own keyboard model stays covered in
   * `ward-patient-typeahead.dom.test.tsx`). The same harm applies to census rows: if the row the
   * keyboard chose looks like the row the pointer merely rests on, a coordinator opens the wrong
   * person. Hover must never select, and the keyboard-chosen row must render differently.
   */
  test("the keyboard-chosen census row reads as visually distinct from a merely-hovered one", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoSearch(page);

    const rows = tableRows(page);
    await expect(rows.nth(2), "needs at least three census rows").toBeAttached();
    const hoveredRow = rows.nth(0);
    const activeRow = rows.nth(2);

    await hoveredRow.hover();
    await rows.nth(1).focus();
    await page.keyboard.press("Tab");
    await expect(activeRow, "Tab from the second row must land on the third").toBeFocused();
    await page.keyboard.press("Enter");

    await expect(activeRow, "Enter must choose the focused row").toHaveAttribute("aria-selected", "true");
    await expect(hoveredRow, "hovering a row must never itself select it").toHaveAttribute("aria-selected", "false");

    const readStyle = (el: HTMLElement) => {
      const row = getComputedStyle(el);
      const cell = getComputedStyle(el.querySelector("td")!);
      return {
        outline: `${row.outlineStyle} ${row.outlineColor}`,
        background: cell.backgroundColor,
        edge: cell.boxShadow,
      };
    };
    const [hoveredStyle, activeStyle] = await Promise.all([
      hoveredRow.evaluate(readStyle),
      activeRow.evaluate(readStyle),
    ]);

    const propertiesDiffer =
      hoveredStyle.outline !== activeStyle.outline ||
      hoveredStyle.background !== activeStyle.background ||
      hoveredStyle.edge !== activeStyle.edge;
    expect(
      propertiesDiffer,
      `the hovered row and the keyboard-chosen row render identically: ${JSON.stringify({ hoveredStyle, activeStyle })}`,
    ).toBe(true);
  });

  /**
   * 4. THE END OF THE LIST STAYS IN REACH. The popup test this replaces proved the active option at
   * the list's end was scrolled into the popup's own visible box. On the census the equivalent harm
   * is choosing the last row by keyboard and having either the row or its details land off screen:
   * the details panel must stay in view beside a row chosen far down the page.
   */
  test("choosing the last census row by keyboard keeps the row and its details panel on screen", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoSearch(page);

    const rows = tableRows(page);
    await expect(rows.nth(8), "too few rows for the last one to sit far down the page").toBeAttached();
    const lastRow = rows.last();
    await rows.nth((await rows.count()) - 2).focus();
    await page.keyboard.press("Tab");
    await expect(lastRow).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(lastRow).toHaveAttribute("aria-selected", "true");

    const name = (await lastRow.locator("td").nth(1).locator("b").first().innerText()).split("\n")[0]!.trim();
    const panel = page.getByRole("region", { name: "Patient details" });
    await expect(panel).toContainText(name);

    const viewportHeight = 900;
    for (const [locator, label] of [
      [lastRow, "the chosen row"],
      [panel, "the details panel"],
    ] as const) {
      const box = await locator.boundingBox();
      expect(box, `${label} has no measurable box`).not.toBeNull();
      expect(box!.y, `${label}'s top (${Math.round(box!.y)}) is above the viewport`).toBeGreaterThanOrEqual(-1);
      expect(
        box!.y + box!.height,
        `${label}'s bottom (${Math.round(box!.y + box!.height)}) is below the ${viewportHeight}px viewport`,
      ).toBeLessThanOrEqual(viewportHeight + 1);
    }
  });

  /**
   * 5. THE 48PX TAP FLOOR AT 375PX. Every control a coordinator taps in the phone composer and the
   * census header: the search input, DOB, Clear, the five group pills, Highlight and History. The
   * old filter selects are gone from the screen (they sit in a visually hidden block), so the
   * census's own controls are what this now measures. Written against the 9 Oct census, it failed
   * first on a real defect: the phone input was 18px tall and Clear 36px.
   */
  test("every interactive control in the search composer and census header meets the 48px tap-target floor at 375px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await gotoSearch(page);

    const input = typeaheadInput(page);
    await input.fill("a"); // brings the Clear button into the DOM

    const form = page.locator('form[role="search"]');
    const console_ = page.getByTestId("ward-patient-search-results-console");
    const controls: Array<readonly [Locator, string]> = [
      [input, "the search input"],
      [form.getByRole("button", { name: "DOB" }), "the DOB switch"],
      [form.getByRole("button", { name: "Clear" }), "the Clear button"],
      [console_.getByRole("button", { name: /Highlight/ }), "the Highlight button"],
      [console_.getByRole("button", { name: /History/ }), "the History button"],
    ];
    const groups = console_.getByRole("radiogroup", { name: "Where patients are now" }).getByRole("radio");
    await expect(groups, "the phone census shows five group pills").toHaveCount(5);
    for (let i = 0; i < 5; i += 1) controls.push([groups.nth(i), `group pill ${i + 1}`]);

    const failures: string[] = [];
    for (const [control, label] of controls) {
      await expect(control, `${label} is not visible`).toBeVisible();
      const box = await control.boundingBox();
      expect(box, `${label} has no measurable box`).not.toBeNull();
      const smallerDimension = Math.min(box!.width, box!.height);
      if (smallerDimension < 48) {
        failures.push(`${label}: ${Math.round(box!.width)}x${Math.round(box!.height)}px`);
      }
    }

    expect(failures, "control(s) under the 48px production tap-target floor at 375px (width x height)").toEqual([]);
  });

  /**
   * 6. THE 48PX HIT AREA ON DESKTOP. The compact desktop pills keep their 26px/28px look, but an
   * invisible pseudo-element grows each hit area to 48px tall. A click 8px above or below the
   * visible pill must still land on the control (the visible box alone would miss it). The same
   * rule covers the record's 28px Watch and flow pills, which share the stylesheet block.
   */
  test("the compact desktop DOB and Clear controls keep a 48px-tall hit area at 1440px", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoSearch(page);
    await typeaheadInput(page).fill("a");

    const form = page.locator('form[role="search"]');
    const controls: Array<readonly [Locator, string]> = [
      [form.getByRole("button", { name: "DOB" }), "the DOB switch"],
      [form.getByRole("button", { name: "Clear" }), "the Clear button"],
    ];
    const failures: string[] = [];
    for (const [control, label] of controls) {
      await expect(control, `${label} is not visible`).toBeVisible();
      const misses = await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const probes = [rect.top - 8, rect.bottom + 8, rect.top + rect.height / 2];
        return probes
          .filter((y) => {
            const hit = document.elementFromPoint(x, y);
            return !(hit && (hit === element || element.contains(hit)));
          })
          .map((y) => Math.round(y - rect.top));
      });
      if (misses.length > 0) failures.push(`${label}: missed at y offsets ${misses.join(", ")}`);
    }
    expect(failures, "desktop control(s) whose hit area is under 48px tall").toEqual([]);
  });
});
