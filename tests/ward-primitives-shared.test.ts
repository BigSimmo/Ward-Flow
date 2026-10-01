// tests/ward-primitives-shared.test.ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = "src/components/ward-management";
const PRIMITIVES = join(ROOT, "ward-shared.module.css");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((e) => {
    const full = join(dir, e);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}
const CSS = walk(ROOT).filter((f) => f.endsWith(".css"));

/** Named, not derived from the file. A set read out of the stylesheet under test would agree with
 *  it by construction and could never disagree — the baseline must not come from the subject. */
const SHARED = ["field", "hint", "pending", "step", "wardName", "hero", "heroFigures"] as const;

/**
 * Does this stylesheet declare a rule for `.name`?
 *
 * ⚠️ NOT `css.includes(".name {")`. That was the first draft and it missed every real way a
 * redeclaration is written — reviewed 2026-09-04, four surviving mutations, each of which genuinely
 * redeclares the hoisted class:
 *
 *     .wardName, .other { }     a selector list
 *     .wardName:hover { }       a pseudo-class
 *     .wardName::before { }     a pseudo-element
 *     .wardName\n{ }            a newline before the brace
 *
 * `String.raw` is load-bearing: a plain template literal turns `\s` into `s` and `\w` into `w`.
 */
function declares(css: string, name: string): boolean {
  return new RegExp(String.raw`\.${name}(?![\w-])\s*[,:.{]`, "u").test(css);
}

/**
 * ⚠️ PINNED, NOT CAPPED — corrected 2026-09-04. The third assertion below legitimately names four
 * pre-existing screen stylesheets that declare a class this task hoists: `search`, `statistics`
 * and `statistics-sections` all declare `.field`, and `wards/ward-index` declares `.wardName`.
 * These are not a race with sibling tasks landing their own files — they are a real adoption
 * backlog for screens this task does not own and must not edit.
 *
 * Following Task 5's own pattern (`docs/superpowers/plans/2026-09-04-ward-flow-design-foundation.md`,
 * "A contract test that pins the language"): NOT a `<=` count, because a count stays green when a
 * violation moves from one file to another, or when a broken walk returns fewer files — the second
 * of which gets greener as coverage collapses. NOT a path allowlist either, because a path allowlist
 * stops failing on a rename. A named list of `file: .class` pairs fails on either.
 *
 * The assertion is "no member outside this list", not "exactly this list" — hoisting one of these
 * four out of its screen file is progress and must not itself go red.
 */
const KNOWN_BACKLOG = [
  /*
   * STAYS EVEN THOUGH SEARCH HAS ADOPTED THE SHARED CLASS. `search/.field` now `composes:` the
   * shared rule and keeps only its own `color`, but composition does not remove a declaration —
   * the local `.field` rule is still there, so this scan still sees the name in two places and is
   * right to. Only deleting the local rule clears the row, and search cannot: it has one property
   * the shared class does not carry.
   *
   * ⚠️ Which means "duplicate" is doing two jobs here: a second independent copy of a rule, and an
   * extension of the shared one by composition. They differ in what somebody must DO about them —
   * the first is a merge, the second is nothing at all. Flagged to Ward Lead 2026-09-04.
   */
  `${join(ROOT, "search", "search.module.css")}: .field`,
  // Recorded 2026-09-25 (test fixer): the arrival-time modal's own `.field`, added 22–25 Sept.
  // Backlog: moving it onto the shared rule has not been checked for any visual difference.
  `${join(ROOT, "referrals", "arrival-time-modal.module.css")}: .field`,
  // ⚠️ BOTH statistics rows were removed 2026-09-04 — `statistics.module.css: .field` here, and
  // `statistics-sections.module.css: .field` below. Two builders each renamed ONE of the two files
  // and each deleted only the row for the file they had fixed, so every single-sided resolution of
  // the fold left one stale row behind. MEASURED on the folded line: `.field {` count is 0 and
  // `.fieldName {` count is 1 in BOTH files, so both rows were stale.
  //
  // 🔴 THE TEST IS GREEN IN EVERY RESOLUTION, SO RUNNING IT CANNOT TELL YOU WHICH IS RIGHT. Only
  // re-injecting `.field` separates them, and the matrix is symmetric: keeping either row
  // re-permits the collision in that file, and keeping BOTH — the cautious-looking choice —
  // permits both. Verified here by injection after the fold, not inherited from the derivation:
  //
  //     inject .field into statistics-sections.module.css  -> RED
  //     inject .field into statistics.module.css           -> RED
  //
  // ⚠️ And an earlier check of this very state read the wrong answer because `grep` matched the
  // explanatory COMMENT below rather than a row, reporting the surviving row as removed and the
  // removed one as surviving. Count the rows, never the mentions.
  //
  // That class was renamed
  // `.fieldName` — it is an inline monospace badge wrapping a model field name, not a form-field
  // wrapper, and it never shared a component with the shared `.field` it collided with by name.
  // The row is deleted rather than left as harmless residue: this assertion is one-directional
  // (it forbids members OUTSIDE the list and cannot notice a member that no longer exists), so a
  // stale row here does not merely mis-describe the backlog — it would silently PERMIT a future
  // `.field` in that file, which is the collision the rename was for.
  `${join(ROOT, "wards", "ward-index.module.css")}: .wardName`,
];

describe("the seven classes every screen invented now live in one place", () => {
  it("is checking the stylesheets it thinks it is", () => {
    // Both halves matter: a walk returning sixteen WRONG files passes a length check alone.
    expect(CSS).toContain(PRIMITIVES);
    expect(CSS.length).toBeGreaterThan(15);
  });

  it("defines each shared class in the primitives file", () => {
    const css = readFileSync(PRIMITIVES, "utf8");
    const missing = SHARED.filter((c) => !declares(css, c));
    expect(missing, `not defined in primitives: ${missing.join(" ")}`).toEqual([]);
  });

  it("defines each shared class in no NEW Ward Flow stylesheet beyond the known backlog", () => {
    const offenders: string[] = [];
    for (const file of CSS) {
      if (file === PRIMITIVES) continue;
      const css = readFileSync(file, "utf8");
      for (const c of SHARED) {
        if (declares(css, c)) offenders.push(`${file}: .${c}`);
      }
    }
    const surprises = offenders.filter((o) => !KNOWN_BACKLOG.includes(o));
    expect(surprises, `new duplicate(s) not in KNOWN_BACKLOG: ${surprises.join("\n")}`).toEqual([]);
  });
});

describe("the breakpoint scale", () => {
  /**
   * Every `@media (min-width: …rem)` breakpoint in every Ward Flow stylesheet, as a bare rem
   * number.
   *
   * ⚠️ ANCHORED TO `@media`, corrected 2026-09-04. The first draft matched `min-width:\s*([\d.]+)rem`
   * as a bare CSS property, which also matched plain element `min-width` declarations — deliberate
   * horizontal-scroll table floors in `discharges` and `escalation`, each with a comment explaining
   * its exact pixel reasoning. That draft reported 17 "breakpoints", three of which (34, 68, 92rem)
   * never existed in these stylesheets at all; they were measured against the HTML prototypes, a
   * different population, and carried into this file as if they were the same one.
   */
  function breakpoints(): string[] {
    const found = new Set<string>();
    for (const file of CSS) {
      const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
      // ⚠️ QUALIFIED BY FILE, NOT A BARE NUMBER. The pin's comment used to claim it was "the same
      // shape as KNOWN_BACKLOG" and catch a breakpoint moving between files — and it did not,
      // because the entries were bare values: 40rem moving from panel to chip changed nothing in
      // the set. The protection described was not the protection implemented. Entries are now
      // `file: value`, so a move shows up as one surprise and one stale entry.
      // Separator normalised, or the pin is a Windows-only pin: every entry would miss on Linux
      // CI, `surprises` would list all twelve as new, and the gate would be red for everyone but
      // the machine it was written on.
      const key = file.replaceAll("\\", "/");
      for (const m of text.matchAll(/@media[^{]*\(\s*min-width:\s*([\d.]+)rem/gu)) {
        found.add(`${key}: ${m[1]}`);
      }
    }
    return [...found].sort();
  }

  it("finds breakpoints at all, so an empty pass cannot look like a clean one", () => {
    expect(breakpoints().length).toBeGreaterThan(0);
  });

  /**
   * ⚠️ PINNED, NOT CAPPED — corrected 2026-09-04. Measured with the `@media`-anchored regex above:
   * eight genuine breakpoints, all in stylesheets this task does not own —
   * 40, 40.0625, 52, 60, 64, 76, 84, 90rem. Collapsing these onto a four-value scale, as the
   * original "at most four" cap demanded, would rewrite documented, working layout in files outside
   * this task's scope. The assertion is "no NEW breakpoint", the same shape as KNOWN_BACKLOG above:
   * a count would stay green if a breakpoint moved between files, or if the walk silently narrowed.
   */
  const KNOWN_BREAKPOINTS = [
    // PR12 clinical metadata changes from two to four bounded columns at 52rem.
    "src/components/ward-management/referrals/referrals.module.css: 52",
    // ⚠️ ADDED 2026-09-04, AND THE GATE HAD BEEN RED SINCE THESE TWO FILES LANDED. `ed-home` (48)
    // and `ed-service-bands` (60) are part of the ED cluster's design-language adoption; both were
    // committed without their rows, so this assertion was failing on the integration line at the
    // same time as `COVERING_THE_GROUND`'s `freed` half in the sibling contract test. Two red gates,
    // neither noticed, because nobody's work happened to touch either file.
    //
    // ⚠️ AND `ed-service-bands.module.css` WAS ON NOBODY'S FILE LIST. It is a tenth file in a
    // cluster two separate surveys described as nine, which is exactly how its 60 went unpinned. A
    // walk and a hand-written brief disagreed and the walk was right.
    "src/components/ward-management/ed/ed-home.module.css: 48",
    "src/components/ward-management/ed/ed-service-bands.module.css: 60",
    "src/components/ward-management/board/board.module.css: 60",
    // Third-edition Bed board: the served drawing changes its fact band at 1200px. The app keeps
    // ten engine-derived facts rather than the drawing's nine, so this exact 75rem rung changes the
    // retained band from five-by-two to ten-across without deleting a fact to fit the reference.
    "src/components/ward-management/board/board.module.css: 75",
    "src/components/ward-management/board/board.module.css: 84",
    // MERGE 02 (2026-09-05): the Capacity screen two-column split. 64rem is already in this set;
    // the pin is per FILE, so a new stylesheet at an existing value still needs its own row.
    "src/components/ward-management/capacity/capacity.module.css: 64",
    // MERGE 03 (2026-09-05): the Movements screen two-column split, same value, new file.
    "src/components/ward-management/movements/movements.module.css: 64",
    // MERGE 01 (2026-09-07): the Delays screen three-column working surface — owner cards, the
    // person list, and a detail panel — built from the owner-locked mockup. Eighth file on the 64
    // scale, joining capacity and movements directly above; this stylesheet declared NO min-width
    // breakpoint at all before today, so the row is new even though the value is not.
    //
    // ⚠️ 64 RATHER THAN COORDINATOR'S 90, AND THE CHOICE IS NOT COSMETIC. Coordinator is the only
    // other genuinely three-column ward screen and it collapses at 90rem, because its middle column
    // holds a flow DIAGRAM that cannot usefully shrink. This screen's middle column is a list of
    // people, which reflows down to a phone, so it can hold three columns four rems earlier and does
    // not need a rung of its own. If a future change puts a fixed-width graphic in that column, this
    // reasoning expires and the value should be re-derived rather than inherited.
    "src/components/ward-management/delays/delays.module.css: 64",
    // 2026-09-12: the third-edition Legal forms screen, a two-column split (the ordered list beside
    // the breakdown panel). Ninth file on the 64 scale and the value is INHERITED rather than
    // derived — both its columns are text that reflows to a phone, so it is the capacity/movements
    // case exactly, not the coordinator case with a fixed-width diagram in the middle column.
    "src/components/ward-management/legal-forms/legal-forms.module.css: 64",
    // Third-edition Command's drawing changes from the stacked phone/tablet surface at 1000px to
    // its two-column laptop arrangement at 1001px. 62.5625rem is that literal 1001px boundary;
    // retaining the one-pixel separation keeps both media ranges unambiguous. Q004 applies that
    // same shell boundary to the reviewed page owners below. Keep every adopter file-qualified:
    // a bare-value exemption would let an unrelated stylesheet adopt the breakpoint silently.
    "src/components/ward-management/alerts/alerts.module.css: 62.5625",
    "src/components/ward-management/board/board.module.css: 62.5625",
    "src/components/ward-management/capacity/capacity.module.css: 62.5625",
    "src/components/ward-management/community/community-index.module.css: 62.5625",
    "src/components/ward-management/community/community.module.css: 62.5625",
    "src/components/ward-management/coordinator/coordinator.module.css: 62.5625",
    "src/components/ward-management/discharges/discharges-third-edition.module.css: 62.5625",
    "src/components/ward-management/ed/ed.module.css: 62.5625",
    "src/components/ward-management/governance-third-edition.module.css: 62.5625",
    "src/components/ward-management/handover/handover-third-edition.module.css: 62.5625",
    "src/components/ward-management/hub/hub.module.css: 62.5625",
    "src/components/ward-management/legal-forms/legal-forms.module.css: 62.5625",
    "src/components/ward-management/officer/officer.module.css: 62.5625",
    "src/components/ward-management/on-call/on-call.module.css: 62.5625",
    "src/components/ward-management/out-of-area/out-of-area-third-edition.module.css: 62.5625",
    "src/components/ward-management/referrals/referrals.module.css: 62.5625",
    "src/components/ward-management/search/search.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-community-third-edition.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-ed-third-edition.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-landing-third-edition.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-sections.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-service-third-edition.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-third-edition.module.css: 62.5625",
    "src/components/ward-management/statistics/statistics-ward-third-edition.module.css: 62.5625",
    "src/components/ward-management/ward-management-network-third-edition.module.css: 62.5625",
    "src/components/ward-management/ward-management-network.module.css: 62.5625",
    "src/components/ward-management/ward/ward.module.css: 62.5625",
    "src/components/ward-management/wards/ward-index.module.css: 62.5625",
    "src/components/ward-management/coordinator/coordinator.module.css: 64",
    // The same drawing introduces the full three-column, viewport-bounded Command surface at
    // 1400px. This app rule carries that exact 87.5rem design boundary; the older 90rem rules in
    // the module remain separately pinned because they govern legacy layout.
    "src/components/ward-management/coordinator/coordinator.module.css: 87.5",
    "src/components/ward-management/coordinator/coordinator.module.css: 90",
    "src/components/ward-management/referrals/referrals.module.css: 40",
    // The lower edge of the accepted Community tablet adaptation sits just above the existing
    // 40rem phone range. At 820px it produces the reviewed three-by-two layout for all six retained
    // engine figures; the fractional 40.001rem boundary avoids overlap without moving the design.
    "src/components/ward-management/community/community.module.css: 40.001",
    // ⚠️ ADDED 2026-09-05, AND THE NUMBER IS DERIVED RATHER THAN CHOSEN — the row exists to carry
    // that derivation, not to silence the gate. The community hub puts a 20rem rail beside its
    // content, and its own table declares `--ward-table-min-width: 34rem` (544px) because five
    // columns of duration text need real room. Measured on the rendered page:
    //
    //     at 64rem  the content column resolves to 561px  -> clears the 544px floor by 17px
    //     at 60rem  it resolves to ~497px                 -> 47px UNDER, so the table starts
    //                                                        scrolling sideways the moment the
    //                                                        rail appears
    //
    // ⚠️ THE SCALE-COMPLIANT ALTERNATIVE WAS BUILT AND MEASURED BEFORE THIS ROW WAS WRITTEN, which
    // is the part that makes this admissible rather than convenient. 60rem with the rail narrowed
    // to 17rem gives 545px against a 544px floor — ONE PIXEL — which renders today and breaks on
    // the next padding token, font change or scrollbar. One pixel is not a margin.
    //
    // And 64 is not a new number here: `coordinator.module.css: 64` is two rows above, and this
    // file's own note on the previous addition records that "64 is already a pinned breakpoint in
    // four other ward stylesheets, so it is the existing scale". This row joins that scale; it does
    // not widen it.
    "src/components/ward-management/community/community.module.css: 64",
    // ⚠️ ADDED 2026-09-06 with the search console's two-column layout (`.consoleLayout`: results
    // beside an in-flow preview pane). Sixth file on the 64 scale, joining capacity, movements,
    // coordinator, community and board — so this is the EXISTING breakpoint, not a new one on the
    // ladder. The pin is `file: value` rather than a bare number precisely so a row like this has
    // to be written down: the value was already known, the file was not, and that is the whole
    // distinction the qualified form exists to keep.
    "src/components/ward-management/search/search.module.css: 64",
    // ⚠️ ADDED 2026-09-07, AND IT IS A NEW RUNG ON PURPOSE. THIS ROW WAS BRIEFLY WRITTEN AS 64 AND
    // THAT WAS WRONG — recorded here rather than quietly corrected, because the reasoning that
    // produced the 64 is the reasoning the next person will produce.
    //
    // The argument for snapping to 64 was good on its face: `.hubShell` is a search list beside a
    // narrower rail, which is the decision `search.module.css` makes two lines above, and a shared
    // scale exists so that screens agree. What that argument could not see is that 68rem is not
    // decoration. 🔴 **68rem IS THE WIDTH AT WHICH THE OWNER'S OWN "2/3 SEARCH, 1/3 GLANCE" SPLIT
    // COLLAPSES TO ONE COLUMN** — his instruction, on a screen he has looked at. Moving it to 64
    // would not have been a lint fix; it would have moved where an approved design stops applying,
    // four rems early, with nobody re-photographing the proportion at the new width.
    //
    // So the honest option is to widen the scale by one rung rather than bend the screen to it.
    // All three of this file's queries carry the same 68 — `.hubShell`'s column collapse,
    // `.hubLeft`'s sticky gate, `.listScroll`'s height cap. They are ONE paired breakpoint, and any
    // future change must move all three together or the sticky pane and the scroll cap will
    // disagree with the column collapse across a band of viewport widths.
    //
    // ⚠️ **The general lesson, and why this comment is long: a breakpoint can be an owner decision
    // wearing the costume of a magic number, and nothing in the value distinguishes the two.**
    // Before snapping any rung to a neighbour, find out whether a human chose it.
    "src/components/ward-management/hub/hub.module.css: 68",
    // The third-edition Hub uses 68.001rem as the exclusive complement to the already-pinned 68rem
    // collapse: only above the accepted one-column boundary are its two panes height-bounded and
    // independently scrollable. This is the same design decision, not an unrelated new rung.
    "src/components/ward-management/hub/hub.module.css: 68.001",
    // ⚠️ ADDED 2026-09-05, and the row exists to make the PROVENANCE visible rather than to
    // silence the gate. This 64 arrived on the master line inside `70d4f1fa1`, a commit whose own
    // message reads "PARKED, NOT FOR FOLDING — the owner asked for a MOCKUP first and I went
    // straight to implementation… If the mockup takes a different direction, revert this."
    //
    // It is admissible because the three commits directly on top of it ARE that mockup and its
    // lock (`b91e87041` workspace mockup v3, `5830bbd8c` "lock the referral intake design (v4)"),
    // so the parking condition was met before it reached here — and because 64 is already a
    // pinned breakpoint in four other ward stylesheets, so it is the existing scale rather than a
    // new step.
    //
    // 🔴 WHAT IS NOT SETTLED, and it is with the owner: he asked for a mockup FIRST, and the v4
    // design that is now live was locked by a session rather than approved by him. This row does
    // not represent his approval of that screen. If v4 turns out to diverge from what he wants,
    // the parked commit's own instruction applies — revert it — and this row goes with it.
    //
    // ── and, from Ward Builder Three, how it went unnoticed and what this guard cannot see ──
    //
    // ⚠️ ADDED 2026-09-05, AND THIS GATE HAD BEEN RED SINCE 70d4f1fa1 LANDED — the same failure
    // the two `ed` rows above record, one commit later and in a file that commit's own author
    // owned. `git log -S "min-width: 64rem"` names it: the parked two-pane intake workspace, which
    // introduced a legitimate breakpoint (the form gains a second column at 64rem) and did not
    // bring its rows. Found only because an unrelated visual pass on the referral BOARD happened
    // to run this suite; nothing in the intake work would have run it, because a `readFileSync`
    // guard is never selected by a focused run over the files a diff touches.
    //
    // ⚠️ ONE ROW, THOUGH THE FILE DECLARES 64rem TWICE. I wrote two, and a comment asserting two
    // were needed, before running it with one and finding one is enough: `surprises` is a
    // membership filter, so it de-duplicates by construction and this list pins VALUES, not
    // occurrences. That means it cannot notice a breakpoint spreading to a second block in a file
    // that already declares it — a real, deliberate limit of this guard, and worth knowing before
    // anyone reads a green here as "these files declare exactly these breakpoints".
    "src/components/ward-management/referrals/referrals.module.css: 64",
    "src/components/ward-management/ward-figure.module.css: 52",
    "src/components/ward-management/ward-figure.module.css: 76",
    "src/components/ward-management/ward-management-modes.module.css: 64",
    // ⚠️ ADDED 2026-09-05, second-edition visual pass on QueueView/ExceptionsView/GovernanceView.
    // Not a new step in the scale: 60rem is already pinned twice above
    // (`board.module.css`, `ward-shared.module.css`) — this file's `.grid` two-column layout
    // (main panel + a narrower rail) reuses that existing value rather than introducing one.
    "src/components/ward-management/ward-modes-second-edition.module.css: 60",
    "src/components/ward-management/ward-management.module.css: 64",
    "src/components/ward-management/ward-shared.module.css: 60",
    "src/components/ward-management/ward-sidebar.module.css: 40.0625",
    "src/components/ward-management/ward-sidebar.module.css: 64",
    // ⚠️ ADDED — Task 2, fourth-edition statistics language port (wise-singing-thunder). Not a new
    // step in the scale: both rows below are `ward-figure.module.css`'s own two pinned values, two
    // rows above. `statistics-v4.module.css`'s new `.band` primitive is the same "a strip of
    // figures reflows its column count" decision `.figureStrip` already makes, so it reuses that
    // file's exact breakpoints (2-up -> 3-up at 52rem, 3-up -> 5-up at 76rem) rather than the
    // fourth-edition mockup's own `48rem`/`78rem`, which would have been two genuinely new steps.
    "src/components/ward-management/statistics/statistics-v4.module.css: 52",
    "src/components/ward-management/statistics/statistics-v4.module.css: 76",
    // Task 3's accepted Statistics overview uses the drawing's two independent panel columns and
    // becomes one column below 1000px. 62.5rem is that documented 1000px content boundary in the
    // opt-in third-edition module; Compare remains a full-width stack at every width.
    "src/components/ward-management/statistics/statistics-third-edition.module.css: 62.5",
    // Full-estate third-edition registrations. These pin the exact source boundaries; the served
    // 390/820/1440 matrices establish the surrounding layouts, but do not claim pixel-level proof
    // at every threshold between those sampled widths.
    "src/components/ward-management/alerts/alerts.module.css: 62.5",
    "src/components/ward-management/capacity/bed-map.module.css: 48",
    "src/components/ward-management/ed/ed.module.css: 80",
    "src/components/ward-management/legal-forms/legal-forms.module.css: 62.5",
    // Recorded 2026-09-25 (test fixer): the legal forms register layout's wide breakpoint.
    "src/components/ward-management/legal-forms/legal-forms.module.css: 68.0625",
    // Just above the 40rem phone range, the OOA register gains its tablet-only bounded scroller.
    "src/components/ward-management/out-of-area/out-of-area-third-edition.module.css: 40.0625",
    // The exclusive 48rem complements prevent the phone and tablet layouts applying together.
    "src/components/ward-management/patients/add-patient.module.css: 48.0625",
    "src/components/ward-management/patients/add-patient.module.css: 64",
    "src/components/ward-management/patients/person.module.css: 64",
    "src/components/ward-management/referrals/referrals.module.css: 48.0625",
    "src/components/ward-management/ward-management-network-third-edition.module.css: 64",
    "src/components/ward-management/ward/ward.module.css: 48.001",
    // Command's independently scrolling diagram and shortlist share its reviewed 1400px split.
    "src/components/ward-management/coordinator/flow-diagram.module.css: 87.5",
    "src/components/ward-management/coordinator/shortlist-panel.module.css: 87.5",
    // Bed board's stacked <=70rem composition becomes two bounded rows above that boundary.
    "src/components/ward-management/board/board.module.css: 70.001",
    // Network's existing <=80rem stacked layout must not inherit the wide-screen height lock.
    // This exclusive complement enables one bounded workspace row only above that collapse.
    "src/components/ward-management/ward-management-network.module.css: 80.001",
  ];

  it("introduces no breakpoint outside the known set", () => {
    // The shell boundary itself is checked here because the page-owner registrations above rely
    // on that shared 1000/1001px split rather than independently choosing a new number.
    const layout = readFileSync("src/app/mockups/ward-flow/ward-flow-layout.module.css", "utf8").replace(
      /\/\*[\s\S]*?\*\//gu,
      "",
    );
    const rail = readFileSync(join(ROOT, "shell/ward-rail.module.css"), "utf8").replace(/\/\*[\s\S]*?\*\//gu, "");
    expect(layout).toMatch(/@media\s*\(max-width:\s*1000px\)\s*\{\s*\.shellRow\s*\{\s*flex-direction:\s*column;/u);
    expect(rail).toMatch(/@media\s*\(max-width:\s*1000px\)/u);
    const bp = breakpoints();
    const surprises = bp.filter((v) => !KNOWN_BREAKPOINTS.includes(v));
    expect(surprises, `new breakpoint(s) not in KNOWN_BREAKPOINTS: ${surprises.join(" ")}`).toEqual([]);
  });
});
