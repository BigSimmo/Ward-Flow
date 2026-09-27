import { createElement, type ComponentProps, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vi } from "vitest";

/**
 * "ADMISSIONS TODAY" AND "DISCHARGES TODAY" ARE CALENDAR-DAY COUNTS, NOT STATE COUNTS.
 *
 * Build plan `docs/ward-flow/plans/2026-09-17-build-plan-screens.md` §1 "reports defect" (owner
 * answer 32): `statistics-screen.tsx` used to count every `"occupied"` or `"pulled"` admission as
 * an admission "today" and every `"departed"` one as a discharge "today", with no day bound at
 * all — a person admitted weeks ago and still on the ward counted as an admission today forever.
 * §3 fixes the wording to count `arrivedAt`/`leftAt` within the CALENDAR day `now` falls on, per
 * `dayOf` (`ward-clock.ts`) — the same rolling-calendar-day convention owner answer 32 gives for
 * reports, distinct from `releaseBand`'s rolling-24-hours convention.
 *
 * This is a `.test.ts`, so it collects under `vitest.config.mts`'s **node** project rather than
 * jsdom — the "SSR-string component test" pattern `tests/ward-facade-agrees-with-screens.test.ts`
 * and `tests/ward-landmarks.test.ts` already establish. `renderToStaticMarkup` renders the real
 * `StatisticsScreen` to an HTML string; the figure this page reads is parsed back out of the
 * markup — the digit a coordinator would read on the page — rather than recomputed by calling the
 * screen's own arithmetic a second time, which could never fail for a wrong formula.
 *
 * `WardFlowProvider` is used UNMOCKED, pinned with `initialNow={NOW_ANCHOR}`: with `initialNow`
 * set, the provider never reads `sessionStorage`/`localStorage` and never touches the wall clock
 * (see that file's own guards), so it renders deterministically under Node with no DOM. The
 * admissions under test are handed to `StatisticsScreen` through its own `admissions` override
 * prop — the same seam `tests/ward-statistics.dom.test.tsx` uses — so this file needs no seeded
 * fixture and no reducer mutation, only the two instants the fix reads.
 */

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string; [key: string]: unknown }) =>
    createElement("a", { href, ...rest }, children),
}));

import { StatisticsScreen } from "@/components/ward-management/statistics/statistics-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { MINUTES_PER_DAY } from "@/components/ward-management/ward-clock";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

function admission(overrides: Partial<Admission>): Admission {
  return {
    id: "AD-TEST-01",
    unitId: "unit-under-test",
    specialling: false,
    highAcuity: false,
    referralId: null,
    movementId: null,
    patientId: null,
    sex: "Female",
    homeRegion: "Perth Metropolitan",
    tentativeDiagnosis: null,
    state: "occupied",
    pulledAt: null,
    arrivedAt: null,
    awayAtEmergencyDepartmentSince: null,
    expectedDischargeAt: null,
    dischargeDateMoves: 0,
    dischargeDateSetAt: null,
    dischargeDateSetBy: null,
    dischargeConfirmedAt: null,
    dischargeConfirmedBy: null,
    blockReason: null,
    leavingDestination: null,
    leftAt: null,
    followUp: null,
    ...overrides,
  };
}

function markupFor(admissions: Admission[]): string {
  // `WardFlowProvider`'s own props type requires `children` (never exported from
  // ward-flow-provider.tsx, so read back via `ComponentProps` rather than duplicated here) — the
  // `createElement(Component, props, ...children)` overload does not fold trailing children
  // arguments into a REQUIRED `children` field the way JSX does, so `children` has to sit in the
  // props object itself for this to type-check at all.
  const providerProps: ComponentProps<typeof WardFlowProvider> = {
    initialNow: NOW_ANCHOR,
    children: createElement<{ admissions?: Admission[] }>(StatisticsScreen, { admissions }),
  };
  return renderToStaticMarkup(createElement(WardFlowProvider, providerProps));
}

/** Reads `<dd data-testid="…">N</dd>` back out of the rendered markup — the digit on the page,
 *  never a second call to the screen's own arithmetic. */
function extractCount(markup: string, testId: string): number {
  const match = markup.match(new RegExp(`data-testid="${testId}"[^>]*>(\\d+)<`));
  if (!match) throw new Error(`could not find a numeric count for ${testId} in the rendered markup`);
  return Number(match[1]);
}

function extractText(markup: string, testId: string): string {
  const match = markup.match(new RegExp(`data-testid="${testId}"[^>]*>([^<]*)<`));
  if (!match) throw new Error(`could not find ${testId} in the rendered markup`);
  return match[1];
}

const YESTERDAY_ARRIVAL = admission({
  id: "AD-YESTERDAY-ARRIVAL",
  state: "occupied",
  arrivedAt: NOW_ANCHOR - MINUTES_PER_DAY,
});
const TODAY_ARRIVAL = admission({ id: "AD-TODAY-ARRIVAL", state: "occupied", arrivedAt: NOW_ANCHOR - 100 });

// Both carry an arrival well before today, so neither can leak into "Admissions today" while the
// discharge fixtures are under test — the two figures must stay independently provable.
const OLD_ARRIVAL = NOW_ANCHOR - 3 * MINUTES_PER_DAY;
const YESTERDAY_DISCHARGE = admission({
  id: "AD-YESTERDAY-DISCHARGE",
  state: "departed",
  arrivedAt: OLD_ARRIVAL,
  leftAt: NOW_ANCHOR - MINUTES_PER_DAY,
});
const TODAY_DISCHARGE = admission({
  id: "AD-TODAY-DISCHARGE",
  state: "departed",
  arrivedAt: OLD_ARRIVAL,
  leftAt: NOW_ANCHOR - 30,
});

describe("Admissions today and Discharges today are bound to the calendar day, not the state alone", () => {
  it("does not count an arrival from yesterday, and does count one from today", () => {
    const markup = markupFor([YESTERDAY_ARRIVAL, TODAY_ARRIVAL]);

    expect(extractCount(markup, "ward-statistics-admissions-today-count")).toBe(1);
    // Neither fixture has a `leftAt`, so this is also a sanity check that admissions do not leak
    // into the discharge figure just because they are `"occupied"`.
    expect(extractCount(markup, "ward-statistics-discharges-today-count")).toBe(0);
  });

  it("does not count a departure from yesterday, and does count one from today", () => {
    const markup = markupFor([YESTERDAY_DISCHARGE, TODAY_DISCHARGE]);

    expect(extractCount(markup, "ward-statistics-discharges-today-count")).toBe(1);
    // Both fixtures arrived three days ago, so this also proves the two figures are independent:
    // a `"departed"` admission is not being counted as an admission just because it once was one.
    expect(extractCount(markup, "ward-statistics-admissions-today-count")).toBe(0);
  });

  it("counts a same-day admission and discharge in both figures — they are independent events, not exclusive states", () => {
    const sameDay = admission({
      id: "AD-SAME-DAY",
      state: "departed",
      arrivedAt: NOW_ANCHOR - 200,
      leftAt: NOW_ANCHOR - 50,
    });
    const markup = markupFor([sameDay]);

    expect(extractCount(markup, "ward-statistics-admissions-today-count")).toBe(1);
    expect(extractCount(markup, "ward-statistics-discharges-today-count")).toBe(1);
  });

  it("a bed pulled but not yet arrived (arrivedAt null) is not counted as an admission today", () => {
    const pulled = admission({ id: "AD-PULLED", state: "pulled", arrivedAt: null });
    const markup = markupFor([pulled]);

    expect(extractCount(markup, "ward-statistics-admissions-today-count")).toBe(0);
  });

  it("adds a caption naming the calendar day and its midnight-to-midnight bound, on both figures", () => {
    const markup = markupFor([TODAY_ARRIVAL]);

    const admissionsCaption = extractText(markup, "ward-statistics-admissions-today-caption");
    const dischargesCaption = extractText(markup, "ward-statistics-discharges-today-caption");

    expect(admissionsCaption).toMatch(/^[A-Za-z]+ \d{1,2} [A-Za-z]+, midnight to midnight, across all wards$/);
    expect(dischargesCaption).toBe(admissionsCaption);
  });
});
