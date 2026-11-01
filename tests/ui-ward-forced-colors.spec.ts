import { expect, test, type Page } from "playwright/test";

/**
 * ⚠️ THE FIRST TIME ANY WARD FLOW SCREEN HAS BEEN RENDERED UNDER FORCED COLOURS.
 *
 * Windows High Contrast is a real setting for a real user of clinical software, and until this
 * spec nothing in this repository had ever drawn a ward screen in it. What we had instead was a
 * ratio: 28 of the ward stylesheets carry a `@media (forced-colors: active)` block and the six
 * Board-layer files carry none. That ratio is not evidence of a defect, and this spec exists so
 * nobody has to keep arguing from it.
 *
 * ⚠️ AND THE RATIO CANNOT BE FIXED FROM A SCREEN, WHICH IS WHY THE LAYER HAD TO BE LOOKED AT
 * DIRECTLY. `.panel`, `.chip` and `.figureStrip` each `composes: wardTokens`, which declares
 * `--ward-border` ON THE PRIMITIVE'S OWN ELEMENT. A same-element custom-property declaration beats
 * an inherited one, so a screen's forced-colors block repointing `--ward-border` on an ancestor
 * cannot reach them. Measured on the page 2026-09-04: setting `--ward-border` on the search
 * screen's root left the panel's own value and its rendered border colour unchanged.
 *
 * So the primitives have no forced-colors handling from any source, and no screen could have given
 * them one. Whether that COSTS anything is what the three assertions below answer.
 *
 * Two screens, chosen because between them they render all three primitives — counted on the page
 * rather than assumed:
 *   /ward/rph-adult-secure   5 panels, 3 chips, 0 figures
 *   /people/PT-001           6 panels, 0 chips, 6 figures
 *
 * 🔴 SELECT BY `data-ward-primitive`, NEVER BY CLASS NAME. The first version of this file used
 * `[class*="ward-panel-module"]`, which is a DEV-ONLY hook: CSS-module class names keep the source
 * filename in the dev server and drop it in a production build. All three assertions found ZERO
 * elements on a page that had rendered perfectly — and the runner builds production, which is the
 * build that matters. The anti-vacuity guards are what turned that into "no panel on this screen"
 * instead of an incomprehensible contrast number, which is the whole reason they are there.
 */

/** WCAG 2.1 non-text contrast (1.4.11). A border that carries structure has to clear this. */
const MIN_NON_TEXT_CONTRAST = 3;
/** WCAG 2.1 contrast minimum (1.4.3) for body text. */
const MIN_TEXT_CONTRAST = 4.5;

type Measured = { readonly found: number; readonly ratio: number; readonly fg: string; readonly bg: string };

/**
 * Reads a colour pair off the first matching element and returns its contrast ratio.
 *
 * `which: "border"` compares the border against the background BEHIND it, walking up for the
 * first ancestor that actually paints one — a chip's own background is `transparent`, so
 * comparing a border against its own element would compare it against nothing and produce a
 * meaningless number rather than a failure.
 */
async function measure(page: Page, selector: string, which: "border" | "text"): Promise<Measured> {
  return page.evaluate(
    ([sel, mode]) => {
      const relativeLuminance = (colour: string): number => {
        const parts = (colour.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number);
        const channels = parts.map((raw) => {
          const v = raw / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
      };
      const opaque = (colour: string): boolean => colour !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/u.test(colour);

      const elements = document.querySelectorAll(sel);
      const element = elements[0] as HTMLElement | undefined;
      if (!element) return { found: 0, ratio: 0, fg: "", bg: "" };

      const style = getComputedStyle(element);
      const fg = mode === "border" ? style.borderTopColor : style.color;

      let bg = style.backgroundColor;
      let parent: HTMLElement | null = mode === "border" ? element.parentElement : element;
      while (parent && !opaque(bg)) {
        bg = getComputedStyle(parent).backgroundColor;
        parent = parent.parentElement;
      }

      const a = relativeLuminance(fg);
      const b = relativeLuminance(bg);
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      return { found: elements.length, ratio, fg, bg };
    },
    [selector, which] as const,
  );
}

async function open(page: Page, path: string): Promise<void> {
  /*
   * ⚠️ `emulateMedia`, NOT `test.use({ forcedColors })`. The `use` form does not type-check against
   * this repo's pinned Playwright — `'forcedColors' does not exist in type 'Fixtures<...>'` — and
   * the failure surfaced only in the runner's production TYPE CHECK, long after the spec ran
   * happily in an editor. `page.emulateMedia` is the form already proven here, in
   * `tests/answer-progress-ui-smoke.spec.ts`. It is set BEFORE navigation so the first paint is
   * already in forced colours rather than a re-render into it.
   */
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto(path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  // React streams a hidden staging copy of the whole screen into the document for a moment, so
  // every locator resolves to two elements until it is gone. The ward specs all wait it out
  // rather than relaxing to `.first()`, which would measure whichever copy came first — possibly
  // the inert server-rendered one.
  await expect(
    page.locator('div[hidden][id^="S:"]'),
    "React's streamed content is still staged, so the screen is duplicated in the document",
  ).toHaveCount(0, { timeout: 15_000 });
}

/**
 * ⚠️ THE CONTROL, AND WITHOUT IT ALL THREE ASSERTIONS BELOW ARE VACUOUS. If forced-colors
 * emulation silently failed to apply, every measurement would be taken in ordinary colours and
 * every one of them would pass — reporting a clean bill of health for a mode nobody had entered.
 * This project has been caught by exactly that shape repeatedly: a check whose scope does not
 * match the claim it is taken to support.
 */
test("@mockup forced colours is actually active, or nothing below means anything", async ({ page }) => {
  await open(page, "/ward-flow/ward/rph-adult-secure");
  const active = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
  expect(active, "forced-colors emulation did not apply; the assertions in this file are vacuous").toBe(true);
});

test("@mockup a panel's border survives forced colours", async ({ page }) => {
  await open(page, "/ward-flow/ward/rph-adult-secure");
  const panel = await measure(page, '[data-ward-primitive="panel"]', "border");

  expect(panel.found, "no panel on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    panel.ratio,
    `panel border ${panel.fg} on ${panel.bg} = ${panel.ratio.toFixed(2)}:1 — a panel whose border ` +
      `vanishes in high contrast is a screen with no visible structure`,
  ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
});

test("@mockup a chip's border survives forced colours, and its words carry the state either way", async ({ page }) => {
  await open(page, "/ward-flow/ward/rph-adult-secure");
  const chip = await measure(page, '[data-ward-primitive="chip"]', "border");

  expect(chip.found, "no chip on this screen — the assertion below would be vacuous").toBeGreaterThan(0);

  /*
   * ⚠️ THE WORDS ARE THE REAL SAFEGUARD AND THEY ARE ASSERTED FIRST. Forced colours overrides
   * border-color AND color to system values, so every chip's border becomes the same colour and
   * the state distinction carried by colour is gone by design — that is the mode working, not a
   * defect. It is survivable only because a chip must also say its state in words. If that ever
   * stops being true, this is where it shows up.
   */
  const wordless = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-ward-primitive="chip"]')].filter(
        (chipElement) => !chipElement.textContent?.trim(),
      ).length,
  );
  expect(wordless, "a chip with no words is invisible in high contrast, not merely weak").toBe(0);

  expect(chip.ratio, `chip border ${chip.fg} on ${chip.bg} = ${chip.ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
    MIN_NON_TEXT_CONTRAST,
  );
});

/**
 * ⚠️ THE ASSERTION THIS FILE EXISTS FOR, AND IT WAS MISSING FROM THE FIRST VERSION.
 *
 * `--ward-border` is re-aliased inside `@media (forced-colors: active)` by five stylesheets on this
 * branch. `--ward-divider` is declared exactly ONCE in all of `src/` and re-aliased NOWHERE. The
 * two are identical in the normal cascade, which is why they read as interchangeable — and they
 * stop agreeing precisely when a user turns high contrast on.
 *
 * A panel draws its OUTLINE with `--ward-border` and its header's under-rule with `--ward-divider`,
 * one element apart. So this compares them in the only situation where they can differ.
 *
 * A pass means the user agent overrides both to the same system colour and the token divergence
 * costs nothing on screen. A failure means we have SEEN the defect rather than deduced it — and
 * the message says which colours, so the fix arrives with evidence attached.
 */
test("@mockup a panel's outline and its header rule agree under forced colours", async ({ page }) => {
  await open(page, "/ward-flow/ward/rph-adult-secure");

  const pair = await page.evaluate(() => {
    const panel = document.querySelector('[data-ward-primitive="panel"]');
    const header = document.querySelector('[data-ward-primitive="panel-header"]');
    if (!panel || !header) return null;
    return {
      outline: getComputedStyle(panel).borderTopColor,
      rule: getComputedStyle(header).borderBottomColor,
    };
  });

  expect(pair, "no panel or panel header on this screen — the assertion below would be vacuous").not.toBeNull();
  expect(
    pair!.rule,
    `panel outline (--ward-border) is ${pair!.outline} and the header rule (--ward-divider) is ` +
      `${pair!.rule}. They are the same colour in normal cascade; a difference here is the ` +
      `divergence itself, visible only to a high-contrast user`,
  ).toBe(pair!.outline);
});

/*
 * RETIRED 26 Sept 2026 (Josh chose "Retire"): the "does repointing --ward-border under forced colours
 * change what is painted?" check. It is archived word for word, with the reason and the measurement,
 * in docs/ward-flow/archive/retired-tests/2026-09-26-forced-colours-ward-border-probe.md, kept in
 * commit 26d0987 before the 15 Oct 2026 docs trim (docs/ward-flow/ARCHIVE-NOTE.md).
 */

/**
 * 🔴 PRINTING THE PATIENT SEARCH SILENTLY DROPPED TWO COLUMNS.
 *
 * Measured at A4 portrait with 43 rows: `.tableScroll` clientWidth 637 against scrollWidth 704,
 * so 67px sat outside the box. "Since arrival" and "Open" were cut — the elapsed time being the
 * column a coordinator prints the list to read.
 *
 * ⚠️ HORIZONTAL OVERFLOW DOES NOT EXIST ON PAPER. Vertical overflow paginates onto the next sheet;
 * horizontal overflow is not paginated, not ruled, and leaves no ellipsis. The reader sees six
 * columns, takes them for the whole table, and never learns there were eight. That is why this is
 * a defect rather than a cosmetic issue, and why it needs a guard rather than a one-time fix.
 *
 * ⚠️ RETARGETED TO THE VISIBLE CASELOAD. On 22 Sept (`f93703edee`) the results table stopped being
 * what this screen shows and moved into a hidden `sr-only` block that is never painted; on 9 Oct
 * the Patients census (PR #194) replaced the cards and dense rows with one census table grouped by
 * where each person is now. The rows keep the `ward-patient-search-case-*` (movement or referral)
 * and `ward-patient-search-row-*` (ward bed or no open episode) testids. The question is unchanged:
 * does anything a coordinator can see fall off the printed sheet?
 */
test("@mockup printing the patient search keeps every census row on the sheet", async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1123 }); // A4 portrait at 96dpi
  await page.goto("/ward-flow/search", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

  // A broad query, so the census rows are a search result rather than the idle board. Scoped to
  // this screen's own field: unscoped, this typed into the page-level search box instead. D-91: the
  // field is the kit's SearchField, a searchbox named for what it finds.
  await page
    .getByTestId("ward-patient-search")
    .getByRole("searchbox", { name: "Find a person by name, UMRN or place" })
    .fill("a");
  await page.keyboard.press("Escape");

  /*
   * ⚠️ A ROW INSIDE THE SHEET CAN STILL BE CUT. The old table was lost inside its own scroll box,
   * not off the edge of the paper, and the census sits in boxes that clip too (its `.scroll`
   * wrapper scrolls sideways). So the limit for each row is the narrowest of the sheet and every
   * clipping ancestor, and every painted piece of the row, not just its outer box, must sit inside
   * it. Rows are read from the painted results console only, never the hidden legacy block.
   */
  const measure = () =>
    page.evaluate(() => {
      const items = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-testid="ward-patient-search-results-console"] [data-testid^="ward-patient-search-case-"], ' +
            '[data-testid="ward-patient-search-results-console"] [data-testid^="ward-patient-search-row-"]',
        ),
      ];
      const sheetRight = document.documentElement.clientWidth;
      const offenders: string[] = [];
      let painted = 0;
      for (const item of items) {
        const box = item.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        painted += 1;
        let left = 0;
        let right = sheetRight;
        for (let a = item.parentElement; a; a = a.parentElement) {
          if (getComputedStyle(a).overflowX === "visible") continue;
          const r = a.getBoundingClientRect();
          left = Math.max(left, r.left);
          right = Math.min(right, r.right);
        }
        for (const el of [item, ...item.querySelectorAll<HTMLElement>("*")]) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.left < left - 0.5 || r.right > right + 0.5) {
            offenders.push(
              `${item.dataset.testid} <${el.tagName.toLowerCase()}> ${r.left.toFixed(0)}–${r.right.toFixed(0)}px ` +
                `outside ${left.toFixed(0)}–${right.toFixed(0)}px`,
            );
            break;
          }
        }
      }
      return { found: items.length, painted, sheetRight, offenders };
    });

  await page.emulateMedia({ media: "print" });
  await expect(
    page.getByTestId("ward-patient-search-results-console").locator('[data-testid^="ward-patient-search-"]').first(),
  ).toBeVisible({ timeout: 15_000 });
  const measured = await measure();

  // ⚠️ ANTI-VACUITY: a census with nothing painted proves nothing about what prints.
  expect(measured.painted, "no census row painted — the assertion below would be vacuous").toBeGreaterThan(2);
  expect(
    measured.offenders,
    `census rows extend past the printed sheet (${measured.sheetRight}px) or a box that clips them — ` +
      `on paper that content is simply gone, with no ellipsis and no rule`,
  ).toEqual([]);
});

test("@mockup a figure's value is readable under forced colours", async ({ page }) => {
  // ⚠️ **RETARGETED.** `/people/PT-001` used to render `PersonScreen`, which composed `WardFigure`.
  // That route now renders `PatientNowScreen` by default (the people/[patientId] route only falls
  // back to `PersonScreen` on `?view=governed`/`?view=legacy`), and the new screen carries no
  // `WardFigure` at all — a real, deliberate redesign, not a regression to work around. A community
  // team's own page (`community-screen.tsx`) still composes several `WardFigure`s unconditionally,
  // so the contrast property this test protects is checked there instead. "Midland" is a real
  // catchment-table clinic name (`ward-movements.ts` raises referrals against it by that exact
  // name), so its slug is a genuine, routable team page rather than an invented id.
  //
  // ⚠️ **RETARGETED AGAIN** (locked community design, Josh 1 Nov 2026): the team page's figure strip
  // is gone, replaced by the hero's at-a-glance strip, whose bold values are now the page's figures.
  await open(page, "/ward-flow/community/midland");
  const figure = await measure(page, '[data-testid="ward-community-glance"] b', "text");

  expect(figure.found, "no figure on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    figure.ratio,
    `figure text ${figure.fg} on ${figure.bg} = ${figure.ratio.toFixed(2)}:1 — a figure nobody can ` +
      `read is a number a coordinator will guess at`,
  ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
});
