import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeWardSheet } from "@/components/ward-management/coordinator/home-phone-sheets";
import { fitKind } from "@/components/ward-management/coordinator/home-fit";
import { queueWaitThresholds } from "@/components/ward-management/coordinator/priority-queue";
import { bedStates } from "@/components/ward-management/ward-bed-states";
import { isOpen, shortlistCandidates } from "@/components/ward-management/ward-derivations";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import type { Movement, Unit } from "@/components/ward-management/ward-model";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * The v10 Home phone ward sheet: the ward's beds as a bar and four facts, who fits it in queue
 * order, and one primary at the foot (Offer to a fit with a bed, or Open a person whose fit needs a
 * review). Rendered inside the real provider over the synthetic seed, so names resolve as on screen.
 */

const STATE = seedWardFlowState();
const QUEUE = STATE.movements.filter(isOpen);
const unitById = (id: string) => STATE.units.find((unit) => unit.id === id)!;
const nameOf = (movement: Movement) => resolveSubjectPatient(movement, STATE);

/** Who the sheet lists for a ward: the first six bed or review fits, in queue order. */
function fitsFor(unit: Unit, queue: readonly Movement[] = QUEUE) {
  const found: { movement: Movement; kind: "bed" | "review" }[] = [];
  for (const movement of queue) {
    const candidate = shortlistCandidates(movement, [unit], NOW_ANCHOR)[0];
    if (!candidate) continue;
    const kind = fitKind(candidate, movement);
    if (kind === "bed" || kind === "review") found.push({ movement, kind });
    if (found.length >= 6) break;
  }
  return found;
}

/** A ward whose first fit has the given kind and whose list holds the other kind too. */
function wardLeadingWith(kind: "bed" | "review") {
  const unit = STATE.units.find((candidate) => {
    const fits = fitsFor(candidate);
    return fits[0]?.kind === kind && fits.some((fit) => fit.kind !== kind);
  });
  if (!unit) throw new Error(`The seed has no ward whose first fit is ${kind}`);
  return unit;
}

function renderSheet(props: Partial<Parameters<typeof HomeWardSheet>[0]> = {}) {
  const handlers = { onClose: vi.fn(), onOffer: vi.fn(), onOpenPatient: vi.fn() };
  const view = render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <HomeWardSheet
        unitId={undefined}
        units={STATE.units}
        admissions={STATE.admissions}
        bedReleases={STATE.bedReleases}
        leaveBeds={STATE.leaveBeds}
        queue={QUEUE}
        now={NOW_ANCHOR}
        {...handlers}
        {...props}
      />
    </WardFlowProvider>,
  );
  return { ...view, ...handlers };
}

describe("HomeWardSheet", () => {
  it("renders nothing without a ward, or for a ward id the network does not hold", () => {
    renderSheet();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    renderSheet({ unitId: "no-such-ward" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("names the ward, its cohort, bed count and health service, with its bed bar and four facts", () => {
    const unit = wardLeadingWith("bed");
    renderSheet({ unitId: unit.id });

    const sheet = screen.getByRole("dialog", { name: unit.name });
    expect(sheet).toHaveAttribute("data-testid", "ward-home-ward-sheet");
    expect(sheet).toHaveAccessibleDescription(new RegExp(`^${unit.cohort} · ${unit.beds} beds · .+$`, "u"));
    expect(sheet).not.toHaveAccessibleDescription(/Health service not resolved/u);
    expect(within(sheet).getByRole("img", { name: new RegExp(`^${unit.name} beds`, "u") })).toBeInTheDocument();

    const states = bedStates(unit, STATE.admissions, STATE.bedReleases, STATE.leaveBeds);
    const fact = (term: string) => within(sheet).getByText(term, { selector: "dt" }).nextElementSibling;
    expect(fact("Ready")).toHaveTextContent(String(states.ready));
    expect(fact("Being made ready")).toHaveTextContent(String(states.beingMadeReady));
    expect(fact("Pulled")).toHaveTextContent(String(states.pulled));
    expect(fact("Closed")).toHaveTextContent(String(states.closed));
  });

  it("lists who fits in queue order, the first chosen, and offers the ward to a fit with a bed", () => {
    const unit = wardLeadingWith("bed");
    const fits = fitsFor(unit);
    const { onOffer, onOpenPatient } = renderSheet({ unitId: unit.id });

    const heading = screen.getByRole("heading", { name: /^Who fits, in queue order/u });
    expect(heading).toHaveTextContent(String(fits.length));
    const picks = within(screen.getByRole("radiogroup", { name: "Who fits" })).getAllByRole("radio");
    expect(picks).toHaveLength(fits.length);
    fits.forEach((fit, index) => {
      expect(picks[index]).toHaveTextContent(nameOf(fit.movement).formalName);
      expect(picks[index]).toHaveTextContent(fit.kind === "bed" ? "Fits" : "Review");
      expect(picks[index]).toHaveAttribute("data-fit", fit.kind);
      expect(picks[index]).toHaveAttribute("aria-checked", index === 0 ? "true" : "false");
    });

    fireEvent.click(screen.getByRole("button", { name: `Offer to ${nameOf(fits[0]!.movement).displayName}` }));
    expect(onOffer).toHaveBeenCalledWith(fits[0]!.movement, unit);
    expect(onOpenPatient).not.toHaveBeenCalled();
  });

  it("switches the foot to Open when the chosen person's fit needs a review", () => {
    const unit = wardLeadingWith("bed");
    const fits = fitsFor(unit);
    const review = fits.find((fit) => fit.kind === "review")!;
    const { onOffer, onOpenPatient } = renderSheet({ unitId: unit.id });

    const pick = screen.getByRole("radio", { name: new RegExp(nameOf(review.movement).formalName, "u") });
    fireEvent.click(pick);
    expect(pick).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("button", { name: /^Offer to / })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Open ${nameOf(review.movement).displayName}` }));
    expect(onOpenPatient).toHaveBeenCalledWith(review.movement.id);
    expect(onOffer).not.toHaveBeenCalled();
  });

  it("leads with Open on a ward whose first fit is a review, and Offer once a bed fit is picked", () => {
    const unit = wardLeadingWith("review");
    const fits = fitsFor(unit);
    const bed = fits.find((fit) => fit.kind === "bed")!;
    const { onOffer } = renderSheet({ unitId: unit.id });

    expect(screen.getByRole("button", { name: `Open ${nameOf(fits[0]!.movement).displayName}` })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(nameOf(bed.movement).formalName, "u") }));
    fireEvent.click(screen.getByRole("button", { name: `Offer to ${nameOf(bed.movement).displayName}` }));
    expect(onOffer).toHaveBeenCalledWith(bed.movement, unit);
  });

  it("says no one fits, with an empty pick list, when the queue holds no fit for the ward", () => {
    const unit = STATE.units.find((candidate) => fitsFor(candidate).length === 0)!;
    expect(unit, "the seed needs a ward nobody fits").toBeDefined();
    renderSheet({ unitId: unit.id });

    expect(screen.getByText("No one in the queue fits this ward now.")).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: /^Who fits, in queue order/u })).toHaveTextContent("0");
    expect(screen.queryByRole("button", { name: /^(Offer to|Open) / })).not.toBeInTheDocument();
  });

  it("reads each person's tier and wait, overdue past the tier's target and waiting before it", () => {
    const unit = wardLeadingWith("bed");
    const [first, second] = fitsFor(unit);
    const long = { ...first!.movement, openedAt: NOW_ANCHOR - queueWaitThresholds(first!.movement.urgency).overdue };
    const fresh = { ...second!.movement, openedAt: NOW_ANCHOR };
    renderSheet({ unitId: unit.id, queue: [long, fresh] });

    const picks = screen.getAllByRole("radio");
    expect(picks).toHaveLength(2);
    expect(picks[0]).toHaveTextContent(new RegExp(`T${long.urgency} · .+ overdue`, "u"));
    expect(picks[1]).toHaveTextContent(new RegExp(`T${fresh.urgency} · .+ waiting`, "u"));
  });

  it("lists at most six people even when more fit", () => {
    const unit = wardLeadingWith("bed");
    const everyFit = QUEUE.filter((movement) => {
      const candidate = shortlistCandidates(movement, [unit], NOW_ANCHOR)[0];
      const kind = candidate ? fitKind(candidate, movement) : "no";
      return kind === "bed" || kind === "review";
    });
    expect(everyFit.length, "the ward must fit more than six people").toBeGreaterThan(6);
    renderSheet({ unitId: unit.id });
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("heading", { name: /^Who fits, in queue order/u })).toHaveTextContent("6");
  });

  it("says the health service is not resolved for a ward at an unknown site", () => {
    const unit = { ...unitById(wardLeadingWith("bed").id), siteCode: "ZZZ" } as Unit;
    renderSheet({ unitId: unit.id, units: [unit] });
    expect(screen.getByRole("dialog", { name: unit.name })).toHaveAccessibleDescription(
      /· Health service not resolved$/u,
    );
  });

  it("closes on Escape and from its close button", () => {
    const unit = wardLeadingWith("bed");
    const { onClose } = renderSheet({ unitId: unit.id });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
