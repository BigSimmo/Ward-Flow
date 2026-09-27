/**
 * **THE ONE DEFINITION OF "A PANEL, IN ORDER" FOR EVERY WARD SCREEN — Ward Lead's ruling,
 * 2026-09-12.**
 *
 * 🔴 **MECHANISM A, AND THE OTHER THREE WERE MEASURABLY WORSE.** Seven of 32 ward screens asserted
 * panel order and they used FOUR incompatible mechanisms that disagreed about what a panel even is:
 *
 * ```
 * A  every [data-ward-primitive="panel"], compared as an EXACT ORDERED ARRAY   ← this
 * B  every <h2>, compared as an array          ties the definition to a heading level, so a panel
 *                                              that stops using one vanishes from the test silently
 * C  all headings FILTERED to a named list     an allow-list can only check what is already on it,
 *                                              so a NEW panel is invisible by construction
 * D  every [data-testid], pairwise "is later"  cannot see a panel SPLICED IN between two others
 * ```
 *
 * ✅ **A is the only one that names a panel STRUCTURALLY rather than by what it happens to render,
 * and the only one where an addition, a removal AND a move all fail.**
 *
 * ⚠️ **IMPORTED, NEVER COPIED — and that is not tidiness.** This lived as two byte-identical copies
 * in the Movements and Delays suites, under a comment claiming that copying meant they *could not*
 * disagree. **Copying is precisely how they can**: either file editing its own copy splits the
 * definition silently and both suites stay green.
 *
 * 🔴 **AND IT CANNOT BE ADOPTED ESTATE-WIDE WITHOUT A PRODUCTION CHANGE — measured 2026-09-12.**
 * Of the six screens that assert order, **three do not use `WardPanel` at all** (the coordinator
 * home, the discharge board and the handover page render plain `<section>`s), so this helper returns
 * an EMPTY ARRAY on them. ⚠️ **Converting those three to it would replace a weak assertion with a
 * vacuous one** — a test comparing `[]` to `[]` passes against any screen, including a blank one.
 * **Whether those screens should adopt the panel primitive is a production decision, and it is
 * reported rather than taken here.**
 */
export function panelTitlesInOrder(root: ParentNode = document): (string | null)[] {
  return Array.from(root.querySelectorAll('[data-ward-primitive="panel"]')).map((panel) =>
    panel.getAttribute("aria-label"),
  );
}
