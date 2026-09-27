/**
 * Shared types for the third-edition shell (`docs/ward-flow/plans/2026-09-10-third-edition-build-
 * master-plan.md` §1.3, item 1.1). Kept separate from the four components so a future consumer
 * (the mounting task, a lane's screen) can import a type without pulling in a client component.
 */

/**
 * One row of the shell's reconciliation check array (standard §8.7: "There is one check array on
 * the page, and the shell appends to it and never creates it").
 *
 * 🔴 **REWRITTEN 2026-09-12 — O-9 MADE THE PARAGRAPH THAT STOOD HERE FALSE.** It said every
 * consumer takes `checks` as a REQUIRED PROP and that the host page owns the array. **Neither is
 * true now**, and it is rewritten rather than left: a comment describing a prop that no longer
 * exists is read as current by the next person who opens this file.
 *
 * **What is true instead:** the screen PUBLISHES its checks to a module store
 * (`ward-checks.ts`) and the rail and the bar both READ it. **The screen is their SIBLING and
 * cannot hand anything to either of them** — they are its SIBLINGS in `layout.tsx`, not its
 * ancestors, and siblings cannot pass props in either direction. ⚠️ **An earlier version of this
 * paragraph said "upward", which was the same wrong picture of the tree that four other files
 * carried.** That is why it was never a prop the host could supply, and why
 * `layout.tsx` passed `[]` on every ward route for as long as the prop existed.
 *
 * ⚠️ **AND THE STORE'S TYPE IS A UNION, NOT AN ARRAY, DELIBERATELY.** Owner ruling D-40 says an
 * empty array must never read as "every check passed"; until O-9 nothing could distinguish **a
 * screen published zero checks** from **no screen has published anything**. `??` and `|| []`
 * cannot flatten a union — that is the whole reason it is one.
 */
export type WardReconciliationCheck = {
  /** What was compared, in words — e.g. "Emergency department pressure sums to the total". */
  label: string;
  ok: boolean;
};

/** One figure in the Activity drawer's live tally for the page currently mounting the shell. */
export type WardActivityTile = {
  label: string;
  value: string;
  tone?: "danger" | "warning" | "good";
};

/** Category tag for Activity feed rows — drives the drawer's category chips. */
export type WardActivityCategory = "escalation" | "decline" | "referral" | "transfer" | "other";

/** One row in the Activity drawer's recent-changes feed. */
export type WardActivityChange = {
  id: string;
  /** Already formatted by the caller's own clock formatter — this file names no time format. */
  time: string;
  text: string;
  /**
   * Optional on page-supplied activity. Missing means "other" for chip filtering so the four
   * named chips never falsely include an untagged row; All still shows every row.
   */
  category?: WardActivityCategory;
};

/**
 * The Activity drawer's content seam (brief: "the page's own tally and recent changes, from the
 * same check array"). `ward-bar.tsx` is the SHARED shell, mounted once ahead of every one of the
 * sixteen screens — it cannot know a page's own tally without this seam, and inventing one here
 * would be exactly the kind of figure-with-no-producer this project's `docs/agents/dead-code-
 * deletion.md` neighbours warn against. Absent (`undefined`) renders an honest "not available"
 * state (standard §8.2: absence is stated, never blank) rather than a fabricated tile.
 */
export type WardActivityContent = {
  pageTitle: string;
  tiles: readonly WardActivityTile[];
  changes: readonly WardActivityChange[];
};

/** The three appearance states, standard §7.5. */
export type WardAppearance = "auto" | "light" | "dark";

/**
 * The bar's one primary action (brief: "The bar's primary action comes from
 * `WARD_PRIMARY_ACTIONS` in `ward-nav.ts`. That does not exist yet — another task builds it.
 * Design `ward-bar.tsx` to consume it and leave a typed seam; do not invent the list, and do not
 * type route strings.").
 *
 * `ward-bar.tsx` takes a single resolved `WardPrimaryAction | undefined` as a prop — never a
 * lookup table, never a hard-coded destination — so this file invents neither the list nor any
 * one entry in it.
 *
 * 🔴 **UPDATE, BRIEF-mount-wiring.md item 3: `WARD_PRIMARY_ACTIONS` now exists** (`ward-nav.ts`,
 * landed by Task 7, `a858d970f1`) — the sentence above is a historical quote of the phase-1.1
 * brief and is kept as a quote, not corrected in place, but it no longer describes the present.
 *
 * ⚠️ **UPDATE, D-16 (`docs/ward-flow/owner-decisions-2026-09-1x.md`): THE SEAM IS RESOLVED, AND THE
 * RESOLUTION IS THAT THIS FILE STOPS DEFINING ITS OWN `WardPrimaryAction` AT ALL.** The paragraph
 * this replaces recorded a real blocker: this file's own `{ id, label, href }` shape and
 * `ward-nav.ts`'s five-kind discriminated union shared a name but could not be resolved into one
 * another — three of the five kinds (`"record-decision"`, `"contact-team"`, `"export-figures"`)
 * carry no `href` at all, and inventing one to fill this file's `href` field is exactly what the
 * historical paragraph above already forbade ("never a hard-coded destination"). D-16's ruling was
 * that standard §8.6 had already answered what an unwired control does — it renders as a working
 * control that says "Not wired in this prototype." in its own words — so nothing about THIS type
 * needed a product decision after all; it only needed to stop insisting every action has a
 * destination. **The type below is `ward-nav.ts`'s own `WardPrimaryAction`, re-exported rather
 * than duplicated** — the two-types-one-name trap is closed by there being exactly one definition,
 * not by translating between two. `ward-bar.tsx` renders each of the five kinds directly: the
 * `"new-referral"` menu's three real hrefs (never invented, never retyped — see `ward-nav.ts`'s
 * own comment on `WARD_NEW_REFERRAL_MENU`), the three undestined kinds as working buttons that
 * carry no `href` attribute anywhere, and `"none"` as no button at all.
 */
export type { WardPrimaryAction } from "@/components/ward-management/ward-nav";
