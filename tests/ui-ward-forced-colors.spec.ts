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
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const active = await page.evaluate(() => window.matchMedia("(forced-colors: active)").matches);
  expect(active, "forced-colors emulation did not apply; the assertions in this file are vacuous").toBe(true);
});

test("@mockup a panel's border survives forced colours", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const panel = await measure(page, '[data-ward-primitive="panel"]', "border");

  expect(panel.found, "no panel on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    panel.ratio,
    `panel border ${panel.fg} on ${panel.bg} = ${panel.ratio.toFixed(2)}:1 — a panel whose border ` +
      `vanishes in high contrast is a screen with no visible structure`,
  ).toBeGreaterThanOrEqual(MIN_NON_TEXT_CONTRAST);
});

test("@mockup a chip's border survives forced colours, and its words carry the state either way", async ({ page }) => {
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
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
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");

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

/**
 * 🔴 ARE THE 28 FORCED-COLORS BLOCKS DOING ANYTHING AT ALL?
 *
 * 28 ward stylesheets carry `@media (forced-colors: active)` blocks whose entire content is a
 * custom-property re-point — `--ward-border: var(--border)` and similar. Every adopter is
 * instructed to preserve them. But if the user agent overrides author colours DOWNSTREAM of
 * custom-property resolution, re-pointing the variable changes nothing: the UA overwrites the
 * resolved value whichever token produced it, and 28 files carry a block that has never done
 * anything.
 *
 * ⚠️ THIS IS MEASURED RATHER THAN REASONED ON PURPOSE. Three people have now reasoned about
 * custom-property resolution under forced colours and two got it wrong in opposite directions —
 * one asserting a divergence that never reaches the screen, one ranking it a live accessibility
 * defect. Both asked what the CASCADE does with the variable and neither asked what the USER
 * AGENT does with the resolved value. A third round of reasoning would be the same instrument.
 *
 * The experiment: change `--ward-border` on the element that declares it, and see whether the
 * rendered border colour moves.
 *
 * ⚠️ AND THE CONTROL IS THE WHOLE TEST. "Nothing changed" is exactly what a failed injection also
 * looks like, so the same manipulation runs first WITHOUT forced colours and must move the colour.
 * Without that half, this test reports "inert" for a typo.
 */
/**
 * 🔴 PARKED, AND SKIPPED DELIBERATELY — THE CONTROL FAILED, SO THERE IS NO VERDICT.
 *
 * Run on 2026-09-04 against the production build: `CONTROL FAILED: re-pointing --ward-border did
 * not move the border even in ordinary colours (rgb(102,112,133) -> rgb(102,112,133))`. The other
 * five assertions passed in the same run.
 *
 * ⚠️ THAT IS THE TEST WORKING. It refused to report "inert" from an instrument that could not be
 * shown to work, which is the entire reason the control is here — "nothing changed" and "the
 * injection failed" are the same reading.
 *
 * The same manipulation succeeds in the dev server, measured by hand on the same screen:
 *
 *     before        --ward-border #667085   borderTopColor rgb(102, 112, 133)
 *     inline set    --ward-border rgb(255,0,0)   borderTopColor rgb(255, 0, 0)   <- moves
 *     on the PARENT instead                      borderTopColor unchanged        <- as expected,
 *                   because `composes: wardTokens` declares the token on the panel's OWN element
 *                   and a same-element declaration beats an inherited one
 *
 * So it works in dev and not in the production build, and I do not know why. A `void
 * el.offsetHeight` reflow between write and read is added below as the most likely fix and is
 * UNVERIFIED — it has never been run. Guessing further costs a full production build each time,
 * which is why this is parked rather than iterated.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 RE-RUN TWICE ON 2026-09-11. STILL NO VERDICT — BUT FOUR THINGS ARE NOW SETTLED, AND EACH
 * COST A PRODUCTION BUILD. START HERE RATHER THAN FROM "too expensive to iterate".
 *
 * **1 · THIS TEST'S TARGET DECAYED UNDER AN UNRELATED COMMIT. It was correct when written.**
 * The 2026-09-04 run above read `rgb(102,112,133)` — `#667085`, which IS `--ward-border` (see the
 * contrast table in `ward-tokens.module.css`). So the panel primitive DID paint from the token
 * under test. Then:
 *
 *     ward-panel.module.css, the .panel border line          (git log -L25,25:<that file>)
 *       36d514022b  created     border: 1px solid var(--ward-border)   ← what this probe was written against
 *       0a1d718d9a  2026-09-05  border: 1px solid var(--border)        ← "panels take the system's border+shadow"
 *
 * ⚠️ A styling commit with nothing to do with forced colours silently retargeted this test the day
 * after it was parked. **A parked test has no failing run to notice that, so the decay is invisible
 * by construction.** Re-running it unchanged in 2026-09 reads `rgb(230,235,242)` — a different
 * token — and the control fails for a reason that has nothing to do with the question.
 *
 * **2 · REPOINTING THE TARGET DOES NOT FIX IT.** Re-run against `[data-testid="ward-hero"]`
 * (`.entryHero`, `border: 0.0625rem solid var(--ward-border)`, on this same page): control failed
 * again, at `rgb(102,112,133)` — the token's own colour. **Two different elements, one of them
 * demonstrably painting from the property being set, both unchanged in the production build.**
 * So the production failure is NOT element-specific. Do not spend a build re-targeting it.
 *
 * **3 · THE METHOD IS NOT UNSOUND — IT WORKS IN DEV.** The hand-measurement recorded above still
 * stands: inline-setting the property on the dev server moves the border to `rgb(255,0,0)`.
 * ⚠️ The real open question is the narrow and strange one the original author already wrote down:
 * **an inline custom-property set moves the border in dev and does not in the production build.**
 * Whoever picks this up should start there, not at the selector.
 *
 * **4 · 🔴 THE QUESTION AS POSED HAS NO SINGLE ANSWER, because the blocks are two mechanisms.**
 * Classifying what all 63 re-points in ward CSS point TO:
 *
 *     var(--border) 41 + var(--border-strong) 9  = 50   alias an ORDINARY custom property
 *     CanvasText 6 + Canvas 4                    = 10   use a SYSTEM COLOUR KEYWORD
 *
 * Re-pointing to `CanvasText` is the correct forced-colours idiom and the UA honours it; aliasing
 * an ordinary author colour is exactly what this test suspects the UA overrides. **And
 * `ward.module.css`'s own forced-colors comment has already reasoned that the `CanvasText` block at
 * `.wardTokens.wardTokens` (0,2,0) is THE mechanism and the local ones are belt-and-braces.**
 * So the likely answer is *"the 50 ordinary-colour aliases are inert AND harmless"* — which is a
 * completely different conclusion from "dead code", and licenses nothing.
 *
 * ⚠️ **WHEN THIS IS REVIVED, REPORT WHICH MECHANISM WAS SAMPLED, not just a verdict.** A reading
 * taken on an ordinary-colour block says nothing about a system-keyword one.
 *
 * 🔴 **AND NOTHING IS DELETED ON THE STRENGTH OF ANY RESULT (Ward Lead, 2026-09-11).** A single
 * palette in one browser does not license a sweep of 46 stylesheets — and "inert in Chromium's
 * forced-colors emulation" is not "inert in Windows High Contrast". **The emulation is a rendering
 * of the feature, not the feature.**
 *
 * ✅ **DO NOT WEAKEN THE CONTROL TO GET A READING.** It is the only reason this test has never
 * produced a wrong answer: a probe pointed at the wrong element returns "no change", and "no
 * change" is exactly what INERT looks like. **The broken instrument's false negative agrees with
 * the hypothesis under test.** Twice now the control has been the thing standing between this file
 * and a confident, false, load-bearing conclusion.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 *
 * 🔴 THE QUESTION IT WOULD ANSWER IS STILL OPEN: 28 ward stylesheets carry forced-colors blocks
 * whose whole content is a custom-property re-point. If the user agent overrides author colours
 * downstream of custom-property resolution, every one of those blocks is inert and every adopter
 * has been preserving dead code. Nobody deletes a block on the strength of this being unanswered.
 */
test.skip("@mockup does re-pointing --ward-border do anything under forced colours?", async ({ page }) => {
  const probe = async () =>
    page.evaluate(() => {
      const panel = document.querySelector('[data-ward-primitive="panel"]') as HTMLElement | null;
      if (!panel) return null;
      const before = getComputedStyle(panel).borderTopColor;
      panel.style.setProperty("--ward-border", "rgb(255, 0, 0)");
      // UNVERIFIED: forcing a reflow between the write and the read is the most likely reason the
      // production run saw no change while the dev server did. Never executed — see the head note.
      void panel.offsetHeight;
      const after = getComputedStyle(panel).borderTopColor;
      panel.style.removeProperty("--ward-border");
      return { before, after, moved: before !== after };
    });

  // Control, in ordinary colours: the injection must actually reach the border.
  await page.emulateMedia({ forcedColors: "none" });
  await page.goto("/mockups/ward-flow/ward/rph-adult-secure", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  const control = await probe();
  expect(control, "no panel found in the control run").not.toBeNull();
  expect(
    control!.moved,
    `CONTROL FAILED: re-pointing --ward-border did not move the border even in ordinary colours ` +
      `(${control!.before} -> ${control!.after}). The measurement below would be meaningless.`,
  ).toBe(true);

  // The real question.
  await open(page, "/mockups/ward-flow/ward/rph-adult-secure");
  const forced = await probe();
  expect(forced, "no panel found in the forced-colors run").not.toBeNull();

  /*
   * NOT an assertion about which answer is correct — both are legitimate results and nobody is
   * acting on either tonight. This records the measurement in the failure message either way, and
   * only fails if the run produced no usable reading at all.
   */
  const verdict = forced!.moved
    ? "LIVE — the block does something; preserving it is justified"
    : "INERT under this palette — the UA overrides the resolved value, so re-pointing the token changes nothing";

  /*
   * ⚠️ PRINTED, NOT ONLY ASSERTED. An expect message is only shown when the test FAILS, so a
   * measurement recorded solely in one is unreadable on the green run — which is the run we
   * expect. The whole point of this test is the number it produces, so it goes to stdout where
   * the reporter shows it.
   */
  console.log(
    `[forced-colors inertness] control ${control!.before} -> ${control!.after} (moved) | ` +
      `forced ${forced!.before} -> ${forced!.after} (${forced!.moved ? "moved" : "unchanged"}) | ${verdict}`,
  );

  expect(
    typeof forced!.before === "string" && forced!.before.length > 0,
    `--ward-border re-point under forced colours: ${forced!.before} -> ${forced!.after}. ${verdict}. ` +
      `Control moved the colour in ordinary mode, so the injection works.`,
  ).toBe(true);
});

/*
 * RETIRED 26 Sept 2026 (Josh chose "Retire"): the "does repointing --ward-border under forced colours
 * change what is painted?" check. It is archived word for word, with the reason and the measurement,
 * in docs/ward-flow/archive/retired-tests/2026-09-26-forced-colours-ward-border-probe.md.
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
 * what this screen shows: the visible results became a caseload of cards, or dense two-line rows,
 * and the table moved into a hidden `sr-only` block that is never painted. This test used to pin
 * the table's print mechanism — `.tableScroll` overflow-x, the 44rem min-width, header nowrap. Those
 * checks were retired ONLY because that table is no longer on screen; measured on the hidden copy
 * they passed while measuring nothing (a 1px clipped box, client width 0). The question is unchanged:
 * does anything a coordinator can see fall off the printed sheet?
 */
test("@mockup printing the patient search keeps every caseload item on the sheet", async ({ page }) => {
  await page.setViewportSize({ width: 794, height: 1123 }); // A4 portrait at 96dpi
  await page.goto("/mockups/ward-flow/search", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });

  // A broad query, so the caseload actually fills. An empty caseload would make every assertion
  // below vacuous, which is why its presence is asserted rather than assumed.
  // Scoped to this screen's own filter — see the probe in the test above. Unscoped, this typed into
  // the page-level search box and the results never populated, making every measurement below a
  // measurement of nothing.
  await page.getByTestId("ward-patient-search").locator("input[type=text]").first().fill("a");
  // Close the typeahead the query opens: its option list otherwise sits over the view switch.
  await page.keyboard.press("Escape");

  /*
   * ⚠️ AN ITEM INSIDE THE SHEET CAN STILL BE CUT. The table was lost inside its own scroll box, not
   * off the edge of the paper, and the caseload sits in boxes that clip too (`.resultsPanel` is
   * `overflow: hidden`; `.patientList` and `.denseContainer` scroll). So the limit for each item is
   * the narrowest of the sheet and every clipping ancestor, and every painted piece of the item —
   * not just its outer box — must sit inside it. A long name that spills past a card whose own box
   * fits would otherwise pass.
   */
  const measure = () =>
    page.evaluate(() => {
      const items = [...document.querySelectorAll<HTMLElement>('[data-testid^="ward-patient-search-case-"]')];
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

  // Both visible presentations: the cards the screen opens on, then the dense rows.
  for (const mode of ["cards", "dense"] as const) {
    // The view switch is hidden on paper (print styles set it to display: none; measured on the
    // review server, 26 Sept 2026), so a coordinator chooses the view on screen and then prints.
    // Switch in screen media, then measure in print media.
    if (mode === "dense") {
      await page.emulateMedia({ media: "screen" });
      // v6 (7 Oct 2026): the view switch is the "Row density" segmented control, not #viewDenseBtn.
      const dense = page.getByRole("radiogroup", { name: "Row density" }).getByRole("radio", { name: "Dense" });
      await dense.click();
      await expect(dense).toHaveAttribute("aria-checked", "true");
    }
    await page.emulateMedia({ media: "print" });
    await expect(page.locator('[data-testid^="ward-patient-search-case-"]').first()).toBeVisible({
      timeout: 15_000,
    });
    const measured = await measure();

    // ⚠️ ANTI-VACUITY: a caseload with nothing painted proves nothing about what prints.
    expect(
      measured.painted,
      `${mode}: no caseload item painted — the assertion below would be vacuous`,
    ).toBeGreaterThan(2);
    expect(
      measured.offenders,
      `${mode}: caseload items extend past the printed sheet (${measured.sheetRight}px) or a box that ` +
        `clips them — on paper that content is simply gone, with no ellipsis and no rule`,
    ).toEqual([]);
  }
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
  await open(page, "/mockups/ward-flow/community/midland");
  const figure = await measure(page, '[data-ward-primitive="figure"]', "text");

  expect(figure.found, "no figure on this screen — the assertion below would be vacuous").toBeGreaterThan(0);
  expect(
    figure.ratio,
    `figure text ${figure.fg} on ${figure.bg} = ${figure.ratio.toFixed(2)}:1 — a figure nobody can ` +
      `read is a number a coordinator will guess at`,
  ).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
});
