"use client";

import { Suspense, useEffect, useLayoutEffect, useSyncExternalStore } from "react";

import { applyThemeToDocument } from "@/lib/theme-client";
import { WardAccessScope } from "@/components/ward-management/shell/ward-access";
import { dispatchPersonaSyncForRole } from "@/components/ward-management/settings/persona-sync";
import {
  readWardAccessSnapshot,
  sameDesk,
  setWardAccess,
  useWardAccessSnapshot,
} from "@/components/ward-management/shell/ward-access-store";
import {
  setWardFeatureFlagOnDevice,
  useWardFeatureFlag,
} from "@/components/ward-management/shell/ward-feature-flag-store";
import { TOUR_AUTO_DONE_STORAGE_KEY } from "@/components/ward-management/help/ward-tour-auto-start";
import { markWhatsNewSeen } from "@/components/ward-management/help/ward-whats-new";
import { HELP_HINTS_KEY } from "@/components/ward-management/help-content/ward-help-hints";
import { STATEWIDE_COORDINATOR, type WardAccess } from "@/components/ward-management/ward-role-access";

import { screenBySlug } from "./screens";
import { PreviewShell } from "./preview-shell";
import { MOCKUP_PAGES } from "./screen-components";
import { MOCKUP_POPUP_COMPONENTS } from "./popup-components";

const subscribeNothing = () => () => {};

export type PreviewTheme = "light" | "dark" | null;

/**
 * Preview only: one redesigned page, in the app's chrome unless the page draws without it. Drawn in
 * the browser only: the shell is told its address through the browser's copy of the router's
 * context, which the server render does not share. A theme from the viewer is applied to this
 * frame only and never saved.
 */
export function PreviewScreen({ slug, pop, theme }: { slug: string; pop: string | null; theme: PreviewTheme }) {
  const inBrowser = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  // The rail re-applies the stored theme on mount and again once its store hydrates, so the frame
  // holds its own theme whenever the root drifts from it. Nothing is saved.
  useEffect(() => {
    if (!theme || !inBrowser) return;
    const root = document.documentElement;
    const hold = () => {
      if (root.getAttribute("data-theme") !== theme || root.classList.contains("dark") !== (theme === "dark"))
        applyThemeToDocument(theme);
    };
    hold();
    const observer = new MutationObserver(hold);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => observer.disconnect();
  }, [theme, inBrowser]);
  const screen = screenBySlug(slug);
  const deskReady = usePreviewDesk(screen?.role);
  const Page = MOCKUP_PAGES[slug];
  if (!inBrowser || !screen || !deskReady) return null;
  const drawnPage = Page ? <Page openOnLoad={pop ?? undefined} /> : <NotDrawnYet label={screen.label} />;
  // A popup or state the preview draws itself (shell overlays, page popups, states): it is handed
  // the page and draws inside the shell, so it reads the same world and chrome as the page.
  const Popup = pop ? MOCKUP_POPUP_COMPONENTS[pop] : undefined;
  const page = Popup ? <Popup page={drawnPage} /> : drawnPage;
  const rolePrefix = screen.role ? slug.split("-").slice(0, -1).join("-") + "-" : undefined;
  // As in the app's layout, everything below (chrome included) reads the workspace scoped to the
  // desk's role and place. It does nothing for the statewide coordinator.
  return (
    <Suspense fallback={null}>
      <WardAccessScope>
        {screen.bare ? (
          page
        ) : (
          <PreviewShell appPath={screen.shellPath ?? screen.appPath} rolePrefix={rolePrefix}>
            {page}
          </PreviewShell>
        )}
      </WardAccessScope>
    </Suspense>
  );
}

/**
 * Preview only: draws a role's view as that desk, the way the Demo menu's "See it as" does (the
 * role-access safeguard on, the desk taken, the rail's persona matched). Every other mock-up puts the
 * statewide coordinator back. Nothing is shared; the desk lives in this browser only, so on the local
 * server it also sets the real app's own desk and role-access switch in the same browser.
 */
const TOUR_ROLES = "coordinator,bed_manager,ward,ed,community,officer,executive,admin";
// Every page's first-visit hint, read, for every desk ("role:topic", the hints' own key form).
const HINT_TOPICS =
  "command capacity movements referrals handover ward ed community officer statistics governance settings legal-forms downtime patient ed-board community-team bed-meeting-agenda";
const HINTS_SEEN = TOUR_ROLES.split(",")
  .flatMap((role) => HINT_TOPICS.split(" ").map((topic) => `${role}:${topic}`))
  .join(",");

function usePreviewDesk(role: WardAccess | undefined): boolean {
  const desk = role ?? STATEWIDE_COORDINATOR;
  const { access } = useWardAccessSnapshot();
  const roleAccessOn = useWardFeatureFlag("role-access");
  useLayoutEffect(() => {
    // The tour, the What's new note and each page's help hint offer themselves on a desk's first visit; a mock-up is
    // judged without them on top.
    try {
      localStorage.setItem(TOUR_AUTO_DONE_STORAGE_KEY, TOUR_ROLES);
      localStorage.setItem(HELP_HINTS_KEY, HINTS_SEEN);
    } catch {
      // Blocked storage: the tour then never offers itself anyway.
    }
    markWhatsNewSeen();
    if (role) setWardFeatureFlagOnDevice("role-access", true);
    if (!sameDesk(readWardAccessSnapshot().access, desk)) setWardAccess(desk);
    if (!role) setWardFeatureFlagOnDevice("role-access", null);
    const persona =
      desk.role === "admin" || desk.role === "executive" || desk.role === "bed_manager" ? "coordinator" : desk.role;
    dispatchPersonaSyncForRole(
      persona,
      desk.scope.kind === "ward" ? desk.scope.unitIds[0] : desk.scope.kind === "ed" ? desk.scope.edId : undefined,
    );
  }, [role, desk]);
  return sameDesk(access, desk) && (!role || roleAccessOn);
}

function NotDrawnYet({ label }: { label: string }) {
  return (
    <main id="main-content" style={{ padding: "var(--wf-s-6)", color: "var(--wf-ink-2)" }}>
      {label} is not rebuilt in React yet.
    </main>
  );
}
