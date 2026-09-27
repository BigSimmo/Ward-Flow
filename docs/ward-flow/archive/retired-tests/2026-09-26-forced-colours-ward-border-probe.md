# Retired check: does repointing `--ward-border` under forced colours change what is painted?

**Retired 26 September 2026. Josh chose "Retire" on a decision card (project chat, 16:39 UTC,
25 Sept): archive the test with a written reason, nothing deleted, nothing else changes.**

It lived in `tests/ui-ward-forced-colors.spec.ts`. Its full text is below, unchanged.

## Why it was retired

The check compared a border painted with `--ward-border` (repointed under forced colours on the
search screen) against one painted with `--ward-divider` (not repointed there), after a control that
the two match in ordinary colours. It could only ever answer "the tokens differ" or "they match".

Since 5 September 2026 a shared layer sets **both** tokens to the same value on every Ward Flow
screen: `ward-tokens.module.css` (`.wardTokens.wardTokens`, 0,2,0, added in d5f0fcc056) sets both
to `CanvasText` under forced colours, and the shell bridge in `ward-flow-shell-tokens.module.css`
(added in 883ecfdfb4, 16 Sept) sets both to `var(--line)`. The screen-local repoint blocks
(0,1,0) never win on their own element. So there is nothing left for the check to tell apart:
wherever it finds its elements it reports "both identical" and passes, measuring nothing.
Separately, since 22 Sept (f93703edee) the search screen paints no visible `--ward-divider` border
at all, so the check could not find its elements and failed.

An Opus helper looked for another screen that paints both tokens visibly (handover, discharges)
and found none; moving the probe would have carried the same "measures nothing" result.

## The measurement that confirmed it (26 Sept 2026, review server on 662eca1656)

One page read, `getComputedStyle(...).getPropertyValue(...)` on each screen's root element, headless
Chromium, with and without `emulateMedia({ forcedColors: "active" })`:

| Screen                        | Forced colours | `--ward-border`     | `--ward-divider`    |
| ----------------------------- | -------------- | ------------------- | ------------------- |
| /mockups/ward-flow/search     | none           | rgba(22,30,40,0.11) | rgba(22,30,40,0.11) |
| /mockups/ward-flow/handover   | none           | rgba(22,30,40,0.11) | rgba(22,30,40,0.11) |
| /mockups/ward-flow/discharges | none           | rgba(22,30,40,0.11) | rgba(22,30,40,0.11) |
| /mockups/ward-flow/search     | active         | CanvasText          | CanvasText          |
| /mockups/ward-flow/handover   | active         | CanvasText          | CanvasText          |
| /mockups/ward-flow/discharges | active         | CanvasText          | CanvasText          |

## The question it leaves open (not decided here)

Whether the screen-local forced-colours repoint blocks are now dead code, because the shared
layers override them by specificity. That is a separate clean-up question for Ward Lead.

## The retired check, word for word

```ts
/**
 * 🔴 ROUND THREE ON --ward-border VS --ward-divider, AND THE FIRST VERSION THAT CAN DISTINGUISH.
 *
 * ⚠️ ASSERTION 4 ABOVE DOES NOT SETTLE THIS AND MUST NOT BE READ AS DOING SO. It compares a
 * panel's outline with that panel's header rule. `.panel` composes `wardTokens`, declaring both
 * tokens on its own element; `.panelHeader` composes nothing and INHERITS from it. So NEITHER
 * value comes from a screen's forced-colors repoint — both are author hexes taking the identical
 * force-adjustment, and their agreeing is consistent with either answer. Verified by reading
 * ward-panel.module.css: `.panelHeader` has zero `composes` lines.
 *
 * The question is whether repointing a token inside `@media (forced-colors: active)` does anything.
 * It matters because `globals.css` maps `--border` to the system keyword `ButtonBorder` in that
 * block, and a system keyword is PRESERVED rather than force-adjusted — so a repointed token and
 * an unrepointed author hex travel two different resolution paths, not one.
 *
 * `search.module.css` is the natural experiment and is deliberately left carrying it: its
 * forced-colors block repoints `--ward-border` (line ~376) and never `--ward-divider`, which it
 * uses at three sites. Both live on screen-owned elements that inherit from `.screen`, where the
 * repoint lands — unlike the primitives, which shadow it.
 *
 * ⚠️ THE STAKES ARE SYMMETRIC. If the two differ, `--ward-divider` lacks a repoint in six files
 * and there is a real gap. If they match, five files carry a repoint that does nothing, above
 * comments quoting measured contrast ratios and calling it "not optional" — five cargo-cult blocks
 * that would go on being copied.
 *
 * ⚠️ AND THE CONTROL RUNS FIRST, in ordinary colours, where the two MUST be identical. If they
 * differ there, the two elements never shared a colour and the forced-colors comparison says
 * nothing about the tokens.
 */
test("@mockup does repointing --ward-border under forced colours change what is painted?", async ({ page }) => {
  const probe = async () =>
    page.evaluate(() => {
      /*
       * ⚠️ **SCOPED TO THE PATIENT-SEARCH SCREEN, NOT "the first text input on the page".** The
       * unscoped version went red on 2026-09-07 with the screen working perfectly: a SECOND box
       * also labelled "Search" now renders above this one (page-level search chrome), so the first
       * input in document order stopped being this screen's filter. **A positional selector keeps
       * its name and silently changes its subject** — the probe went on measuring, against the
       * wrong element, which is worse than not finding one.
       */
      const input = document.querySelector(
        '[data-testid="ward-patient-search"] input[type=text]',
      ) as HTMLElement | null;
      /*
       * 🔴 `closest("form")`, NOT `closest("div")`. The first version walked up from the input
       * looking for a div and the chain is
       *
       *     INPUT -> LABEL.field -> FORM.filters -> MAIN.main -> DIV.screen -> DIV.shell
       *
       * so the first DIV it met was `.screen` ITSELF, and `.parentElement` from there was the
       * SHELL — one level ABOVE the element carrying the repoint, and itself composing wardTokens.
       * It therefore read `--ward-border: var(--neutral-500)` = #667085 every time, which could
       * never have been anything else. The reading was fully explained by measuring one level too
       * high, and the trailing comment saying "the filter strip" is what stopped anyone checking.
       */
      const strip = input?.closest("form") ?? null;
      /*
       * 🔴 THE SECOND ROW, NOT THE FIRST. `.peopleList li:first-child` sets `border-top: 0`,
       * because the panel header already draws that line. A zero-width border has no painted
       * colour, so `borderTopColor` falls back to `currentColor` — the TEXT colour — and the probe
       * compares a border against a piece of text.
       *
       * The control caught exactly this: in ordinary colours the two came back rgb(102,112,133)
       * and rgb(27,37,51), and they must be identical there or the forced-colours comparison
       * means nothing. That is the control doing its whole job.
       */
      const rows = document.querySelectorAll('[data-testid^="ward-patient-search-person-"]');
      const row = (rows[1] ?? null) as HTMLElement | null; // a row that actually draws its top border
      if (!strip || !row) return null;
      /*
       * ⚠️ ASSERT THE DOM SHAPE THIS PROBE ASSUMES, so a layout change fails loudly instead of
       * silently measuring a different element. The previous version resolved to *something* at
       * every step, so nothing was empty and nothing complained — the same shape as the
       * `[class*=screen]` fallthrough before it.
       */
      const forms = document.querySelectorAll("form").length;
      const stripIsUnderMain = Boolean(strip.closest("main"));
      // ⚠️ The border being measured must actually be PAINTED. A zero-width border reports a
      // colour it never draws, which is how the first version compared a border against text.
      const rowBorderWidth = getComputedStyle(row).borderTopWidth;
      const stripBorderWidth = getComputedStyle(strip).borderTopWidth;
      /*
       * ⚠️ TOKENS READ OFF THE MEASURED ELEMENTS THEMSELVES, NOT OFF A "SCREEN ROOT".
       *
       * The first version selected the root with `[class*=screen]`. CSS-module class names keep the
       * source filename in dev and DROP it in a production build, so in the run that matters it
       * matched nothing, fell through to `body > div`, and both tokens came back EMPTY STRINGS —
       * making the verdict it printed worthless. That is the fourth time in one night this
       * repository has been bitten by a dev-only selector, and it happened inside the spec written
       * because of the first three.
       *
       * Custom properties inherit, so reading them from the very elements whose borders are being
       * compared is both correct and immune to how the root is named.
       */
      return {
        borderToken: getComputedStyle(strip).getPropertyValue("--ward-border").trim(),
        dividerToken: getComputedStyle(row).getPropertyValue("--ward-divider").trim(),
        forms,
        stripIsUnderMain,
        rowBorderWidth,
        stripBorderWidth,
        rowCount: rows.length,
        paintedFromBorder: getComputedStyle(strip).borderTopColor,
        paintedFromDivider: getComputedStyle(row).borderTopColor,
      };
    });

  const search = async () => {
    // Scoped for the reason given on the probe above: a second "Search" box now renders above this
    // screen's own filter, so `input[type=text]").first()` types into the wrong one and no patient
    // row ever appears — a failure that reads exactly like the search being broken.
    await page.getByTestId("ward-patient-search").locator("input[type=text]").first().fill("hallow");
    await expect(page.locator('[data-testid^="ward-patient-search-person-"]').first()).toBeVisible({
      timeout: 15_000,
    });
  };

  await page.emulateMedia({ forcedColors: "none" });
  await page.goto("/mockups/ward-flow/search", { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await expect(page.locator('div[hidden][id^="S:"]')).toHaveCount(0, { timeout: 15_000 });
  await search();
  const control = await probe();
  expect(control, "could not find the filter strip and a person row in the control run").not.toBeNull();
  expect(
    control!.paintedFromDivider,
    `CONTROL: in ordinary colours the two borders must already match, or this comparison means ` +
      `nothing. border-painted ${control!.paintedFromBorder}, divider-painted ${control!.paintedFromDivider}`,
  ).toBe(control!.paintedFromBorder);

  await open(page, "/mockups/ward-flow/search");
  await search();
  const forced = await probe();
  expect(forced, "could not find the filter strip and a person row under forced colours").not.toBeNull();

  /*
   * ⚠️ THE VERDICT IS THREE-WAY, NOT TWO-WAY, and the first version's wording was wrong for the
   * outcome that actually occurred. Painted-same with tokens-DIFFERENT does not mean the block has
   * no effect — it means the block ran, produced a genuinely different token, and the user agent
   * collapsed both to the same ink anyway. Reporting that as "no effect" would have been an
   * overreach in the opposite direction from the last one.
   */
  const tokensDiffer = forced!.borderToken !== forced!.dividerToken;
  const paintedSame = forced!.paintedFromBorder === forced!.paintedFromDivider;
  const verdict = !tokensDiffer
    ? "INCONCLUSIVE — both tokens identical, so the repoint did not apply and nothing is being compared"
    : paintedSame
      ? "REPOINT APPLIES BUT DOES NOT CHANGE THE PAINT — the token becomes a system keyword while the " +
        "unrepointed one stays an author hex, and the UA force-adjusts both to the same ink under THIS palette"
      : "REPOINT IS LOAD-BEARING — the two paths paint differently, and --ward-divider lacks a repoint";
  console.log(
    `[forced-colors divider] tokens: --ward-border=${forced!.borderToken} --ward-divider=${forced!.dividerToken} | ` +
      `painted: from-border ${forced!.paintedFromBorder}, from-divider ${forced!.paintedFromDivider} | ${verdict}`,
  );

  // Records the measurement; asserts only that a reading was obtained. Nobody acts on either answer
  // tonight, so no preference is encoded into a gate.
  expect(
    control!.rowBorderWidth !== "0px" && control!.stripBorderWidth !== "0px",
    `a border being compared is not painted: strip ${control!.stripBorderWidth}, row ` +
      `${control!.rowBorderWidth}. A zero-width border reports currentColor, not its own colour.`,
  ).toBe(true);

  expect(
    forced!.forms === 1 && forced!.stripIsUnderMain,
    `the probe's DOM assumption no longer holds: ${forced!.forms} form(s), under main = ` +
      `${forced!.stripIsUnderMain}. It may be measuring a different element than intended.`,
  ).toBe(true);

  // ⚠️ ANTI-VACUITY: an empty token string means the probe failed, not that the tokens agree. The
  // first run of this test reported "SAME" off two empty strings; fail loudly rather than repeat it.
  expect(
    forced!.borderToken.length > 0 && forced!.dividerToken.length > 0,
    `token probe returned nothing (--ward-border="${forced!.borderToken}", ` +
      `--ward-divider="${forced!.dividerToken}") — the painted comparison above cannot be interpreted`,
  ).toBe(true);
  expect(typeof forced!.paintedFromBorder === "string" && forced!.paintedFromBorder.length > 0).toBe(true);
});
```
