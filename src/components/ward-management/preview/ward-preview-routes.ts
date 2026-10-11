import { teamHref, unitHref } from "@/components/ward-management/shell/ward-facade";

/**
 * Preview-only routes (device audit mockups, 11 Oct 2026). Each mockup under
 * `/mockups/ward-flow/preview/<topic>` stands in for one live page, so the shell titles it, picks
 * its primary and marks its nav entry as if it were that page. Live routes never match here.
 */

export const WARD_PREVIEW_ROOT = "/mockups/ward-flow/preview";

/** The mockup options every topic offers. */
export const WARD_PREVIEW_OPTIONS = ["A", "B", "C"] as const;
export type WardPreviewOption = (typeof WARD_PREVIEW_OPTIONS)[number];

/** `?option=` read leniently: anything unknown is option A. */
export function wardPreviewOption(value: string | string[] | undefined): WardPreviewOption {
  const raw = Array.isArray(value) ? value[0] : value;
  const upper = raw?.toUpperCase();
  return WARD_PREVIEW_OPTIONS.find((option) => option === upper) ?? "A";
}

/** The pages the phone shell mockup renders inside the shell, keyed by the route's `[page]`. */
export const PHONE_SHELL_PREVIEW_PAGES = {
  home: "/mockups/ward-flow",
  ward: unitHref("rph-adult-secure"),
  officer: "/mockups/ward-flow/transport/officer",
} as const;
export type PhoneShellPreviewPage = keyof typeof PHONE_SHELL_PREVIEW_PAGES;

const STAND_INS: readonly (readonly [prefix: string, standIn: string])[] = [
  ...Object.entries(PHONE_SHELL_PREVIEW_PAGES).map(
    ([page, standIn]) => [`${WARD_PREVIEW_ROOT}/phoneshell/${page}`, standIn] as const,
  ),
  [`${WARD_PREVIEW_ROOT}/communityteam`, teamHref("midland")],
  [`${WARD_PREVIEW_ROOT}/capacity`, "/mockups/ward-flow/capacity"],
];

/** The live page a preview route stands in for, or null for every other path. */
export function wardPreviewStandIn(pathname: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return STAND_INS.find(([prefix]) => path === prefix)?.[1] ?? null;
}

/**
 * The community team mockups keep New referral as the header's one primary (audit, App shell:
 * "keep New referral as the one primary everywhere"), where the live team page shows Contact a team.
 */
export function wardPreviewKeepsNewReferral(pathname: string): boolean {
  return wardPreviewStandIn(pathname) === teamHref("midland");
}
