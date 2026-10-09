import type { ReactNode } from "react";

import { WardAccessibility } from "@/components/ward-management/shell/ward-accessibility";
import { WardActNowNotifier } from "@/components/ward-management/shell/ward-act-now-notifier";
import { WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WardPhoneDesktopOnly } from "@/components/ward-management/shell/ward-phone-desktop-only";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { WardRail } from "@/components/ward-management/shell/ward-rail";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { WardGround } from "@/components/ward-management/ward-shell";

import styles from "./ward-flow-layout.module.css";

/**
 * Holds the shared reducer state and clock above every ward route, same as the
 * pre-move layout. There is no access gate: the developer key was removed on 28 September 2026
 * at Josh's request, so Ward Flow (synthetic data only) opens without one. No
 * screen wires the provider itself: a route rendered without this layout in its
 * path must throw via `useWardFlow` rather than render a substituted empty world.
 *
 * `WardGround` wraps `children` here â€” the whole of every route's own output, `<main>` included
 * â€” because this is the only place in the tree that is an ancestor of every route's content
 * (docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, Task 6, ruling
 * 2026-09-04: the ground was originally meant to mount inside `ClinicalRail`, which is a SIBLING
 * of `<main>` at every one of its call sites and could never reach it).
 *
 * **Shared chrome mounts HERE and nowhere else, and that is the whole argument.** The owner's
 * approved header promises that a coordinator never has to open a screen to see how bad the day
 * is â€” so it cannot be something each screen opts into. `ClinicalRail` was mounted by the screens
 * themselves, in dozens of separate places; **anything added there is global only by repetition and
 * goes missing from whichever screen forgot it.** This layout is an ancestor of every renderable
 * route, which is what makes the promise keepable rather than merely intended.
 *
 * âš ï¸ **A COUNT OF THOSE MOUNTS WAS TYPED INTO THIS COMMENT TWICE AND WAS WRONG BOTH TIMES.**
 * It is zero now (`grep -rn "<ClinicalRail" src --include=*.tsx`), and the argument never
 * depended on the count, so no replacement number is recorded here either.
 *
 * ðŸ”´ **THE THIRD-EDITION SHELL MOUNTS HERE â€” `WardBar` and `WardRail`
 * (`src/components/ward-management/shell/`).** `WardRail` is written as a flex ITEM
 * (`ward-rail.module.css`'s own header: an explicit width, `height: 100%`) and needs a flex-row
 * ancestor with a real height to size against â€” mounted as a bare sibling of the route's content
 * with no such ancestor, it would fall back to block layout and stack above the page rather than
 * beside it. `ward-flow-layout.module.css`'s `.shellRow`/`.shellContent` supply that ancestor,
 * mirroring the approved drawing's own outermost shape
 * (`docs/ward-flow/mockups/command-third-edition.html`'s `.app`/`.frame`) rather than inventing a
 * new one. `WardBar` renders inside `.shellContent`, ahead of `WardGround`, as this route tree's
 * header; `WardLiveRegion` (the shell's one polite announcer, `shell/ward-live-region.tsx`) mounts
 * once at the top, because both `WardRail` and `WardBar` call `announceToWardShell` and something
 * has to render what they say.
 *
 * ðŸ”´ **THE `checks` PROPS ARE GONE â€” O-9, 2026-09-12 â€” AND THIS PARAGRAPH DESCRIBED THEM FOR THE
 * LIFE OF THAT COMMIT.** It used to say both were `[]` because nothing under `src/` built a
 * `WardReconciliationCheck[]`. **Both halves are false now**: the props were removed from the two
 * lines below, and `MovementsScreen` builds one. âš ï¸  **The same commit took credit for rewriting the
 * identical staleness in `ward-shell-types.ts` and left this one standing, in the file it was
 * editing.** **The rail and the bar read the publication store themselves.**
 *
 * ðŸ”´ **D-16, THE PRIMARY-ACTION SEAM: `WardBar` BECAME `WardBarMount` HERE.** The bar's own
 * `primaryAction` prop needs `WARD_PRIMARY_ACTIONS` resolved against the current route
 * (`resolveWardPrimaryAction`, `ward-nav.ts`) â€” a lookup this layout cannot perform itself despite
 * being the file the brief names for it: this file is a Server Component, so it cannot call
 * `usePathname()`.
 * `WardBarMount` (`shell/ward-bar.tsx`, exported alongside `WardBar` itself) is the thin Client
 * Component that does that one resolution and passes the result into `WardBar` as a prop â€” see its
 * own doc comment for the full reasoning. This layout's own composition is otherwise unchanged.
 *
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * ðŸ”´ **THE SECOND-EDITION CHROME IS RETIRED IN THE SAME CHANGE, AND THAT PAIRING IS NOT
 * OPTIONAL.** `WardChromeHeader` (with `WardChromeSearch` inside it) and `WardShellHeader` used to
 * mount here, between `WardGround` and `{children}`. Master plan Â§1.3 item 1.2 says the shell
 * mounts *"in place of `WardChromeHeader` + `WardShellHeader`"*, and owner question Q-6 â€” *"the
 * third-edition bar replaces the header you approved on 2026-09-06... may that spec be retired in
 * favour of the third-edition shell test?"* â€” was answered **Yes**.
 *
 * âš ï¸ **AN EARLIER PASS MOUNTED THE SHELL AND LEFT THE OLD CHROME STANDING, AND THE FOLD WAS
 * REVERTED WITHIN THE HOUR** (`fbfc2bb00f`, reverting `961ab6117a`). Both rendered
 * `WardGlobalSearch`, so every one of the thirty-six ward routes carried **two search boxes, two
 * task controls, and â€” on the three routes that resolve a place â€” two place labels**. A
 * coordinator would have had two places to type and no way to know which one the screen was
 * listening to. **Half of this pair is worse than neither half**: before that fold each screen had
 * one working header, after it each had two competing ones.
 *
 * ðŸ”´ **NEITHER THE OFFLINE SUITE NOR `tsc` COULD SEE IT.** Both were green throughout; a
 * duplicated DOM node is invisible to a type checker and to every jsdom test that renders one
 * component at a time. The catcher is a COUNT on a rendered page, never a presence check â€” a
 * presence check passed happily while there were two of everything. It lives in
 * `tests/ui-ward-chrome-header.spec.ts` ("exactly one of each shell control"), which is also where
 * the 2026-09-06 header's own eleven properties were re-pointed at this owner rather than deleted.
 *
 * âš ï¸ **WHAT THE RETIREMENT COSTS, STATED RATHER THAN GLOSSED.** `WardChromeHeader` also carried a
 * figures toggle and panel (`WardStatsToggle`/`WardStatsPanel`), a board-freshness sentence and a
 * role-adaptive action link. The third-edition bar carries none of those: its Activity drawer is
 * the figures surface and takes an `activity` prop nothing builds yet, and its primary action
 * takes a `WardPrimaryAction` nothing resolves yet (see `shell/ward-bar.tsx`'s own header for both
 * seams and why neither was invented here). So this change removes those three surfaces from the
 * app rather than moving them. That is what Â§1.3 item 1.2 asks for, in the order it asks for it;
 * `ward-chrome-header.tsx`, `ward-chrome-search.tsx` and `ward-standing-strip.tsx` are left on
 * disk with their unit tests intact and are declared unreachable by name in
 * `tests/ward-component-reachability.test.ts` â€” deleting a module is `docs/agents/dead-code-
 * deletion.md`'s decision, not this task's.
 */
export default function WardFlowMockupLayout({ children }: { children: ReactNode }) {
  return (
    <WardFlowProvider>
      <WardAccessibility />
      <WardLiveRegion />
      <WardActNowNotifier />
      <div className={styles.shellRow}>
        <WardRail />
        <div className={styles.shellContent}>
          <WardBarMount />
          <WardBroadcastBanner />
          <WardPhoneDesktopOnly />
          <WardGround>{children}</WardGround>
        </div>
      </div>
    </WardFlowProvider>
  );
}
