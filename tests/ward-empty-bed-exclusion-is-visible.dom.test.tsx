import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StatisticsWardScreen } from "@/components/ward-management/statistics/statistics-ward-screen";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Admission } from "@/components/ward-management/ward-admissions";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
import { allUnits, NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { wardStatistics } from "@/components/ward-management/ward-statistics";

/**
 * ═══ AN EXCLUSION NOBODY CAN SEE IS THE CLAMP THAT WAS REMOVED, WEARING A DIFFERENT NAME ═════════
 *
 * `emptyBedMinutes` used to return `number | null`, and that `null` meant three different things: a
 * missing instant, a non-finite one, and an IMPOSSIBLE one — an arrival earlier than the pull that
 * gave the person the bed. `wardStatistics` filtered all three out together, so an incoherent record
 * left the per-ward page with no figure, no sentence, and nothing at all on screen.
 *
 * 🔴 **THAT IS THE OUTCOME THE CLAMP WAS REMOVED TO PREVENT, REACHED BY A DIFFERENT ROUTE.** Ward
 * Lead's ruling of 2026-09-01: a clamp *"does not make a bad number safe, it makes it invisible"*.
 * The statistics home page states the consequence in its own words — the exclusion *"must be VISIBLE
 * or the exclusion is as invisible as the clamp it replaces"* — and renders
 * `pullToArrival.incoherentCount` accordingly.
 *
 * ⚠️ **THE PER-WARD PAGE HAD NO COUNTERPART, AND LOOKED COMPLIANT BECAUSE THE CLAMP REALLY HAD BEEN
 * REMOVED.** It is also the surface a coordinator opens about a NAMED ward, so it is the one where a
 * dropped record matters most. Nothing was red: dropping a record silently and having no such record
 * produce identical output is what made it invisible to the whole suite as well as to the reader.
 *
 * ## What this pins, and the part that is easy to get wrong
 *
 * Not the wording. It pins that an impossible record **changes what the page shows** — because the
 * defect's signature is precisely that it did not. The control below is the half that matters: the
 * same ward with the same admission made COHERENT must produce a different page, or the assertion
 * would pass against a screen that always prints the sentence regardless of the data.
 */

const UNIT = allUnits()[0];

/**
 * ⚠️ **CLONED FROM A SEEDED ADMISSION, NEVER BUILT FROM LITERALS.** `Instant` and `Sex` are branded,
 * so a hand-built object needs an `as Admission` cast to compile — and `vitest` does not typecheck,
 * so that cast passes the suite while `tsc` goes red. That exact mistake reached a commit on this
 * branch on 2026-09-07. Cloning a real admission and overriding only the fields under test is both
 * typesafe and a better fixture: it cannot drift out of shape when `Admission` gains a field.
 */
function withInstants(source: Admission, id: string, pulledOffset: number, arrivedOffset: number): Admission {
  return {
    ...source,
    id,
    unitId: UNIT.id,
    state: "occupied",
    pulledAt: (NOW_ANCHOR + pulledOffset) as Admission["pulledAt"],
    arrivedAt: (NOW_ANCHOR + arrivedOffset) as Admission["arrivedAt"],
    leftAt: null,
  };
}

const SEEDED = seedWardFlowStateAt(0).admissions.find(
  (admission) => admission.pulledAt !== null && admission.arrivedAt !== null,
)!;

// Arrival 60 minutes BEFORE the bed was given away. Cannot be true of anybody.
const IMPOSSIBLE = withInstants(SEEDED, "AD-IMPOSSIBLE", -100, -160);
// The control: the same admission with its two instants the right way round.
const COHERENT = withInstants(SEEDED, "AD-COHERENT", -160, -100);

function renderWith(admissions: Admission[]) {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <StatisticsWardScreen unitId={UNIT.id} units={[UNIT]} admissions={admissions} />
    </WardFlowProvider>,
  );
}

describe("an impossible empty-bed record is excluded AND said out loud", () => {
  it("the fixtures really are what they claim, or every assertion below is about nothing", () => {
    // THE FLOOR. If the "impossible" record were coherent, the screen would be right to say nothing
    // and this whole file would pass while measuring the wrong thing.
    expect(IMPOSSIBLE.arrivedAt! < IMPOSSIBLE.pulledAt!, "the impossible fixture is not impossible").toBe(true);
    expect(COHERENT.arrivedAt! > COHERENT.pulledAt!, "the control fixture is not coherent").toBe(true);
  });

  it("counts the impossible record instead of dropping it", () => {
    const derived = wardStatistics(UNIT.id, [IMPOSSIBLE], NOW_ANCHOR);
    expect(derived.emptyBedIncoherentCount).toBe(1);
    expect(
      derived.averageEmptyBedMinutes,
      "an impossible gap must not reach the average — folding it in as a wait of no time is the " +
        "clamp this was removed to prevent, and one such record measurably halved a real average",
    ).toBeNull();
  });

  it("renders that count on the ward page, where a coordinator would see it", () => {
    renderWith([IMPOSSIBLE]);
    const shown = screen.getByTestId("ward-stat-empty-bed-incoherent").textContent ?? "";
    expect(shown).toContain("1");
    expect(shown, "the page does not say the record was excluded").toMatch(/excluded/iu);
  });

  it("THE CONTROL — a coherent record produces a different page, so the sentence is not unconditional", () => {
    // Without this, a screen hard-coding the sentence would satisfy the test above. The defect being
    // guarded is "the data changed nothing", so the proof has to be that the data changes something.
    const coherent = wardStatistics(UNIT.id, [COHERENT], NOW_ANCHOR);
    expect(coherent.emptyBedIncoherentCount).toBe(0);
    expect(coherent.averageEmptyBedMinutes, "a coherent pair must be measured").not.toBeNull();

    renderWith([COHERENT]);
    expect(screen.getByTestId("ward-stat-empty-bed-incoherent").textContent ?? "").toContain("0");
  });

  it("the two populations never overlap — an impossible record is in exactly one of them", () => {
    const both = wardStatistics(UNIT.id, [IMPOSSIBLE, COHERENT], NOW_ANCHOR);
    expect(both.emptyBedIncoherentCount).toBe(1);
    // The average is over the coherent one alone. If the impossible record were also averaged, the
    // mean would differ from the single coherent gap.
    const coherentOnly = wardStatistics(UNIT.id, [COHERENT], NOW_ANCHOR);
    expect(both.averageEmptyBedMinutes).toBe(coherentOnly.averageEmptyBedMinutes);
  });

  it("the empty state names all three reasons there may be nothing to average", () => {
    // It used to say "no bed has yet gone from being given away to the person arriving in it",
    // which describes only the missing-instant case — while the figure is equally absent when every
    // such record is impossible. Those send a reader to opposite places: wait for data, or go and
    // fix a feed producing records that cannot be true.
    renderWith([IMPOSSIBLE]);
    const text = screen.getByTestId("ward-stat-empty-bed-minutes").textContent ?? "";
    expect(text, "the empty state still describes only the missing-instant case").toMatch(/not earlier than/iu);
  });
});
