import type { ReactNode } from "react";
import { headers } from "next/headers";

import {
  OverlayScope,
  ToastProvider,
  WfServerPhoneProvider,
  guessPhoneFromRequest,
  guessTabletFromRequest,
} from "@/components/wf";
import { WardAccessibility } from "@/components/ward-management/shell/ward-accessibility";
import { WardActNowNotifier } from "@/components/ward-management/shell/ward-act-now-notifier";
import { WardPwaRegistration } from "@/components/ward-management/shell/ward-pwa-registration";
import { WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WARD_EARLY_TAP_SCRIPT } from "@/components/ward-management/shell/ward-early-tap";
import { WardFirstDocumentOnly } from "@/components/ward-management/shell/ward-first-document-only";
import { WARD_RAIL_EARLY_SCRIPT } from "@/components/ward-management/shell/ward-rail-early";
import { WardPhoneDesktopOnly } from "@/components/ward-management/shell/ward-phone-desktop-only";
import { WardBroadcastBanner } from "@/components/ward-management/shell/ward-broadcast-banner";
import { WardOfflineBanner } from "@/components/ward-management/shell/ward-offline-banner";
import { WardDowntimePackLine } from "@/components/ward-management/shell/ward-downtime-pack-line";
import { WARD_OFFLINE_SAVED_NOTE } from "@/components/ward-management/ward-offline-copy";
import { WardDemoNotSavedNote } from "@/components/ward-management/shell/ward-demo-saving";
import { WardRecoveryNotice } from "@/components/ward-management/shell/ward-recovery-notice";
import { WardFeatureFlagLink } from "@/components/ward-management/shell/ward-feature-flag-store";
import { WardOfflineLinks } from "@/components/ward-management/shell/ward-offline-links";
import { WardLiveRegion } from "@/components/ward-management/shell/ward-live-region";
import { WardRail } from "@/components/ward-management/shell/ward-rail-lazy";
import { WardMainFocusTarget } from "@/components/ward-management/shell/ward-main-focus-target";
import { WardSkipToActNow } from "@/components/ward-management/shell/ward-skip-to-act-now";
import { TvLockGuard } from "@/components/ward-management/bed-meeting/tv-lock-guard";
import {
  WardWorkspaceHost,
  WardExecutiveChromeMount,
  WardPreviewChrome,
} from "@/components/ward-management/shell/ward-workspace-host";
import { demoDayZero } from "@/components/ward-management/ward-clock";
import {
  WardAccessBanner,
  WardAccessGate,
  WardAccessScope,
  WardIdleLock,
  WardPrintFooter,
} from "@/components/ward-management/shell/ward-access";
import { WardRowDensity } from "@/components/ward-management/settings/row-density";
import { WardGround } from "@/components/ward-management/ward-shell";
import { WardDeskPendingClear } from "@/components/ward-management/shell/ward-access-hold";
import { WARD_DESK_EARLY_SCRIPT } from "@/components/ward-management/shell/ward-desk-early";

import styles from "./ward-flow-layout.module.css";

/**
 * Holds the shared reducer state and clock above every ward route, same as the
 * pre-move layout. There is no access gate: the developer key was removed on 28 September 2026
 * at Josh's request, so Ward Flow (synthetic data only) opens without one. No
 * screen wires the provider itself: a route rendered without this layout in its
 * path must throw via `useWardFlow` rather than render a substituted empty world.
 *
 * `WardGround` wraps `children` here — the whole of every route's own output, `<main>` included
 * — because this is the only place in the tree that is an ancestor of every route's content
 * (docs/superpowers/plans/2026-09-04-ward-flow-navigation-shell.md, Task 6, ruling
 * 2026-09-04: the ground was originally meant to mount inside `ClinicalRail`, which is a SIBLING
 * of `<main>` at every one of its call sites and could never reach it).
 *
 * **Shared chrome mounts HERE and nowhere else, and that is the whole argument.** The owner's
 * approved header promises that a coordinator never has to open a screen to see how bad the day
 * is — so it cannot be something each screen opts into. `ClinicalRail` was mounted by the screens
 * themselves, in dozens of separate places; **anything added there is global only by repetition and
 * goes missing from whichever screen forgot it.** This layout is an ancestor of every renderable
 * route, which is what makes the promise keepable rather than merely intended.
 *
 * ⚠️ **A COUNT OF THOSE MOUNTS WAS TYPED INTO THIS COMMENT TWICE AND WAS WRONG BOTH TIMES.**
 * It is zero now (`grep -rn "<ClinicalRail" src --include=*.tsx`), and the argument never
 * depended on the count, so no replacement number is recorded here either.
 *
 * 🔴 **THE THIRD-EDITION SHELL MOUNTS HERE — `WardBar` and `WardRail`
 * (`src/components/ward-management/shell/`).** `WardRail` is written as a flex ITEM
 * (`ward-rail.module.css`'s own header: an explicit width, `height: 100%`) and needs a flex-row
 * ancestor with a real height to size against — mounted as a bare sibling of the route's content
 * with no such ancestor, it would fall back to block layout and stack above the page rather than
 * beside it. `ward-flow-layout.module.css`'s `.shellRow`/`.shellContent` supply that ancestor,
 * mirroring the approved drawing's own outermost shape
 * (`design/third-edition-mockups/command-third-edition.html`'s `.app`/`.frame`) rather than inventing a
 * new one. `WardBar` renders inside `.shellContent`, ahead of `WardGround`, as this route tree's
 * header; `WardLiveRegion` (the shell's one polite announcer, `shell/ward-live-region.tsx`) mounts
 * once at the top, because both `WardRail` and `WardBar` call `announceToWardShell` and something
 * has to render what they say.
 *
 * 🔴 **THE `checks` PROPS ARE GONE — O-9, 2026-09-12 — AND THIS PARAGRAPH DESCRIBED THEM FOR THE
 * LIFE OF THAT COMMIT.** It used to say both were `[]` because nothing under `src/` built a
 * `WardReconciliationCheck[]`. **Both halves are false now**: the props were removed from the two
 * lines below, and `MovementsScreen` builds one. ⚠️ **The same commit took credit for rewriting the
 * identical staleness in `ward-shell-types.ts` and left this one standing, in the file it was
 * editing.** **The rail and the bar read the publication store themselves.**
 *
 * 🔴 **D-16, THE PRIMARY-ACTION SEAM: `WardBar` BECAME `WardBarMount` HERE.** The bar's own
 * `primaryAction` prop needs `WARD_PRIMARY_ACTIONS` resolved against the current route
 * (`resolveWardPrimaryAction`, `ward-nav.ts`) — a lookup this layout cannot perform itself despite
 * being the file the brief names for it: this file is a Server Component, so it cannot call
 * `usePathname()`.
 * `WardBarMount` (`shell/ward-bar.tsx`, exported alongside `WardBar` itself) is the thin Client
 * Component that does that one resolution and passes the result into `WardBar` as a prop — see its
 * own doc comment for the full reasoning. This layout's own composition is otherwise unchanged.
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────────
 * 🔴 **THE SECOND-EDITION CHROME IS RETIRED IN THE SAME CHANGE, AND THAT PAIRING IS NOT
 * OPTIONAL.** `WardChromeHeader` (with `WardChromeSearch` inside it) and `WardShellHeader` used to
 * mount here, between `WardGround` and `{children}`. Master plan §1.3 item 1.2 says the shell
 * mounts *"in place of `WardChromeHeader` + `WardShellHeader`"*, and owner question Q-6 — *"the
 * third-edition bar replaces the header you approved on 2026-09-06... may that spec be retired in
 * favour of the third-edition shell test?"* — was answered **Yes**.
 *
 * ⚠️ **AN EARLIER PASS MOUNTED THE SHELL AND LEFT THE OLD CHROME STANDING, AND THE FOLD WAS
 * REVERTED WITHIN THE HOUR** (`fbfc2bb00f`, reverting `961ab6117a`). Both rendered
 * `WardGlobalSearch`, so every one of the thirty-six ward routes carried **two search boxes, two
 * task controls, and — on the three routes that resolve a place — two place labels**. A
 * coordinator would have had two places to type and no way to know which one the screen was
 * listening to. **Half of this pair is worse than neither half**: before that fold each screen had
 * one working header, after it each had two competing ones.
 *
 * 🔴 **NEITHER THE OFFLINE SUITE NOR `tsc` COULD SEE IT.** Both were green throughout; a
 * duplicated DOM node is invisible to a type checker and to every jsdom test that renders one
 * component at a time. The catcher is a COUNT on a rendered page, never a presence check — a
 * presence check passed happily while there were two of everything. It lives in
 * `tests/ui-ward-chrome-header.spec.ts` ("exactly one of each shell control"), which is also where
 * the 2026-09-06 header's own eleven properties were re-pointed at this owner rather than deleted.
 *
 * ⚠️ **WHAT THE RETIREMENT COSTS, STATED RATHER THAN GLOSSED.** `WardChromeHeader` also carried a
 * figures toggle and panel (`WardStatsToggle`/`WardStatsPanel`), a board-freshness sentence and a
 * role-adaptive action link. The third-edition bar carries none of those: its Activity drawer is
 * the figures surface and takes an `activity` prop nothing builds yet, and its primary action
 * takes a `WardPrimaryAction` nothing resolves yet (see `shell/ward-bar.tsx`'s own header for both
 * seams and why neither was invented here). So this change removes those three surfaces from the
 * app rather than moving them. That is what §1.3 item 1.2 asks for, in the order it asks for it;
 * `ward-chrome-header.tsx`, `ward-chrome-search.tsx` and `ward-standing-strip.tsx` are left on
 * disk with their unit tests intact and are declared unreachable by name in
 * `tests/ward-component-reachability.test.ts` — deleting a module is `docs/agents/dead-code-
 * deletion.md`'s decision, not this task's.
 */
export default async function WardFlowMockupLayout({ children }: { children: ReactNode }) {
  // The strict script-src needs the per-request nonce (src/proxy.ts) on our own inline script.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  // A1-17 (audit 13 Oct 2026): draw the phone layout first on a phone, so slow signal does not show
  // a different, desktop-shaped page for many seconds before the code loads.
  const userAgent = requestHeaders.get("user-agent");
  const clientHintMobile = requestHeaders.get("sec-ch-ua-mobile");
  const phone = guessPhoneFromRequest(userAgent, clientHintMobile);
  const tablet = guessTabletFromRequest(userAgent, clientHintMobile);
  // Serialize the calendar origin with the HTML so hydration does not choose a different Perth day.
  const initialDayZero = demoDayZero(new Date()).getTime();
  const executiveShell = (
    <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
      <OverlayScope className={styles.overlayScope} />
      <WardFirstDocumentOnly>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: WARD_EARLY_TAP_SCRIPT }} />
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: WARD_DESK_EARLY_SCRIPT }} />
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: WARD_RAIL_EARLY_SCRIPT }} />
      </WardFirstDocumentOnly>
      <WardAccessibility />
      <WardRowDensity />
      <WardLiveRegion />
      <WardPwaRegistration />
      <WardOfflineLinks />
      <WardFeatureFlagLink />
      <WardExecutiveChromeMount>{children}</WardExecutiveChromeMount>
    </ToastProvider>
  );
  return (
    <WfServerPhoneProvider phone={phone} tablet={tablet}>
      <WardWorkspaceHost initialDayZero={initialDayZero} executiveChildren={executiveShell}>
        {/* Role access plan PR 1: everything below reads the workspace scoped to the desk's role and
          place, chrome included. Does nothing while the role-access flag is off (shell/ward-access.tsx). */}
        <WardAccessScope>
          <WardPreviewChrome executiveChildren={executiveShell}>
            {/* Remembers a header tap made before the app is ready, for the header to press once it is
          (ward-early-tap.ts). It sits ahead of the header so it runs before the header is drawn. */}
            <WardFirstDocumentOnly>
              <script
                nonce={nonce}
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: WARD_EARLY_TAP_SCRIPT }}
              />
              {/* H-0111: marks a first load whose stored desk is not the coordinator's (ward-desk-early.ts). */}
              <script
                nonce={nonce}
                suppressHydrationWarning
                dangerouslySetInnerHTML={{ __html: WARD_DESK_EARLY_SCRIPT }}
              />
            </WardFirstDocumentOnly>
            {/* v10 pass 2: one ToastProvider for every ward route, so `useToast` (Undo toasts) works on
          any page without each screen mounting its own region. */}
            <ToastProvider offlineNote={WARD_OFFLINE_SAVED_NOTE}>
              {/* Sheets, dialogs and toasts are portalled outside `.shellRow`, so they take the Ward tokens from here. */}
              <OverlayScope className={styles.overlayScope} />
              <WardAccessibility />
              <WardRowDensity />
              <WardLiveRegion />
              <WardActNowNotifier />
              <WardPwaRegistration />
              <WardOfflineLinks />
              {/* A demo link's `?flags=` switches feature flags on this device (ward-feature-flags.ts). */}
              <WardFeatureFlagLink />
              {/* WS-18: Home's second skip link, straight after the page's "Skip to main content". */}
              <WardSkipToActNow />
              {/* P073: "Skip to main content" moves focus into the page's main. */}
              <WardMainFocusTarget />
              <div className={styles.shellRow}>
                <WardRail />
                {/* Gives the rail its stored or tablet shape before the first paint (ward-rail-early.ts),
              so the sidebar does not fold and slide the page once the app loads. */}
                <WardFirstDocumentOnly>
                  <script
                    nonce={nonce}
                    suppressHydrationWarning
                    dangerouslySetInnerHTML={{ __html: WARD_RAIL_EARLY_SCRIPT }}
                  />
                </WardFirstDocumentOnly>
                <div className={styles.shellContent} data-wf-scroller="">
                  <WardBarMount />
                  {/* A1-17: until the page's code is running, taps do nothing; say so rather than look
                ready. Hidden once the header is ready (`data-wf-bar-ready`, ward-early-tap.ts). */}
                  <p className={styles.loadingNote} role="status" data-testid="ward-loading-note" data-print-hide>
                    Loading, not live yet. Taps work once this goes.
                  </p>
                  <WardRecoveryNotice />
                  {/* `data-wf-bar-notes`: the band counts these notes as part of the header (wf/band.ts), so a
                page still opens on its hero band while a note is showing. */}
                  <div className={styles.bannerHolder} data-wf-bar-notes="">
                    <WardBroadcastBanner />
                    <WardOfflineBanner />
                    {/* Fix plan item 9: retakes the downtime pack hourly and at shift change, and offers it to print or save. */}
                    <WardDowntimePackLine />
                    <WardDemoNotSavedNote />
                    <WardAccessBanner />
                  </div>
                  <WardPhoneDesktopOnly />
                  {/* A closed screen replaces the whole ground, which it draws itself (shell/ward-access.tsx).
                H-0111: a stored desk other than the coordinator's keeps the page area hidden on first
                load until it is drawn for that desk (shell/ward-desk-early.ts). */}
                  <WardAccessGate>
                    <WardGround>{children}</WardGround>
                  </WardAccessGate>
                  <WardDeskPendingClear />
                  <WardPrintFooter />
                  <WardIdleLock />
                  {/* A11: a browser locked as a TV shows only TV views until someone unlocks it. */}
                  <TvLockGuard />
                </div>
              </div>
            </ToastProvider>
          </WardPreviewChrome>
        </WardAccessScope>
      </WardWorkspaceHost>
    </WfServerPhoneProvider>
  );
}
