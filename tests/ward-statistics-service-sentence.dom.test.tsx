import { render, within } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * THE STATISTICS SCREENS ARE NEVER SCOPED BY THE SERVICE SELECTOR (item 44, §2 rule S4).
 *
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §2 "Never hidden — S3/S4" and
 * §3 "Statistics": the statistics home page and the overview section are whole-network pages, like
 * the bed board and the ward page. Choosing a service elsewhere in the shell must not narrow a
 * single figure here — it must only add ONE sentence, worded exactly, saying the figures already
 * include the chosen service, plus a link onward to that service's own statistics page.
 *
 * Two things this file proves, and only a rendered page can prove either:
 *
 *   1. **Every figure is byte-identical with and without a service chosen.** The whole rendered
 *      page's text is compared, not a hand-picked subset — the same discipline
 *      `tests/ward-statistics.dom.test.tsx`'s own placement test uses against a hand-picked table
 *      that had silently gone stale. A hand-picked list of "the figures that matter" is exactly the
 *      kind of list a later figure can be added outside of.
 *   2. **The sentence and link say exactly what §3 fixes**, and only while a service is chosen —
 *      not "All services", where there is nothing to reconcile with the figures below.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { StatisticsOverviewScreen } from "@/components/ward-management/statistics/statistics-overview-screen";
import { serviceStatisticsHref } from "@/components/ward-management/shell/ward-facade";
import { resetServiceScopeForTests, setServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { HealthService } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

const CHOSEN_SERVICE: HealthService = "South Metro";

/** Collapses the whitespace JSX introduces at line breaks, so a sentence can be pinned whole —
 *  same helper `ward-statistics.dom.test.tsx` uses for the same reason. */
function normalise(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

function renderScreen(Screen: ComponentType, service: HealthService | null, rootTestId: string) {
  if (service === null) {
    resetServiceScopeForTests();
  } else {
    setServiceScope(service);
  }
  const { container, unmount } = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <Screen />
    </WardFlowProvider>,
  );
  const root = within(container).getByTestId(rootTestId);
  return { container, root, unmount };
}

afterEach(() => {
  resetServiceScopeForTests();
});

describe.each([
  ["the statistics home page", StatisticsScreen, "ward-statistics-screen"],
  ["the statistics overview section", StatisticsOverviewScreen, "ward-statistics-overview-screen"],
] as const)("%s — service scope sentence", (_label, Screen, rootTestId) => {
  it("renders no scope sentence under All services", () => {
    const { root, unmount } = renderScreen(Screen, null, rootTestId);
    expect(within(root).queryByTestId("ward-statistics-service-scope-sentence")).toBeNull();
    unmount();
  });

  it("says the sentence and link exactly, per §3, while a service is chosen", () => {
    const { root, unmount } = renderScreen(Screen, CHOSEN_SERVICE, rootTestId);

    const sentence = within(root).getByTestId("ward-statistics-service-scope-sentence");
    expect(normalise(sentence.textContent)).toBe(
      `Set to ${CHOSEN_SERVICE}. This page is the whole network's own, so these figures already include ` +
        `${CHOSEN_SERVICE}. Open ${CHOSEN_SERVICE} statistics`,
    );

    const link = within(sentence).getByTestId("ward-statistics-service-scope-link");
    expect(normalise(link.textContent)).toBe(`Open ${CHOSEN_SERVICE} statistics`);
    expect(link).toHaveAttribute("href", serviceStatisticsHref(CHOSEN_SERVICE));

    unmount();
  });

  /**
   * ⚠️ **THE WHOLE PAGE, NOT A HAND-PICKED FIGURE LIST.** Choosing a service must change nothing
   * below the one sentence above — S3/S4's whole point. Rather than re-typing which figures "matter"
   * (the exact shape that let a placement test above go stale on this file once already), this diffs
   * every character of rendered text once the one legitimately-different node — the sentence itself
   * — is removed from both sides.
   */
  it("changes no figure anywhere on the page when a service is chosen", () => {
    const without = renderScreen(Screen, null, rootTestId);
    const withoutText = normalise(without.root.textContent);
    without.unmount();

    const withService = renderScreen(Screen, CHOSEN_SERVICE, rootTestId);
    const sentence = within(withService.root).getByTestId("ward-statistics-service-scope-sentence");
    sentence.remove();
    const withServiceText = normalise(withService.root.textContent);
    withService.unmount();

    expect(withServiceText).toBe(withoutText);
  });
});
