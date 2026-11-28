import type { WardLoadingShapePaths } from "@/components/ward-management/shell/ward-loading-shape";

/*
 * The loading boundary's page lists (audit four build clean-up, 28 Nov 2026). Constants only: the
 * boundary loads on every navigation, so this file imports nothing at run time and cannot read the
 * pages themselves. `tests/ward-loading-routes.test.ts` checks that every page folder under
 * `src/app/bedchart` sits in exactly one list (a folder with its own loading.tsx is left out), so a
 * new page fails that test until someone decides its loading look.
 */

/** The three pages whose placeholder takes their shape. */
export const SHAPED_PAGES: WardLoadingShapePaths = {
  home: "/bedchart",
  capacity: "/bedchart/capacity",
  waiting: "/bedchart/waiting",
};

/**
 * Audit four #83 (28 Nov 2026): the other pages whose loaded top is the navy hero band (mapped from
 * their page components, each drawing the kit Hero or its page-top band). Their placeholder draws a
 * hero-coloured band joined to the status row over the plain rows. The pages in `PALE_PAGES` keep the
 * pale skeleton. Bed meeting has its own loading.tsx.
 */
export const HERO_PAGES: readonly string[] = [
  "/bedchart/about",
  "/bedchart/alerts",
  "/bedchart/community",
  "/bedchart/delays",
  "/bedchart/discharges",
  "/bedchart/ed",
  "/bedchart/governance",
  "/bedchart/handover",
  "/bedchart/leave",
  "/bedchart/legal-forms",
  "/bedchart/movements",
  "/bedchart/night",
  "/bedchart/on-call",
  "/bedchart/out-of-area",
  "/bedchart/privacy",
  "/bedchart/referrals",
  "/bedchart/reports",
  "/bedchart/review",
  "/bedchart/search",
  "/bedchart/seclusion",
  "/bedchart/settings",
  "/bedchart/statistics",
  "/bedchart/transport",
  "/bedchart/triage",
  "/bedchart/ward",
  "/bedchart/wards",
];

/**
 * The pages whose loaded top is not the navy hero band, so their placeholder stays the pale
 * skeleton (Help, the patient page, the bed board and the rest).
 */
export const PALE_PAGES: readonly string[] = [
  "/bedchart/activity",
  "/bedchart/board",
  "/bedchart/command",
  "/bedchart/constellation",
  "/bedchart/escalation",
  "/bedchart/exceptions",
  "/bedchart/help",
  "/bedchart/hub",
  "/bedchart/network",
  "/bedchart/people",
  "/bedchart/queue",
];
