import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

// The ward screen renders next/link anchors and jsdom cannot provide an App Router context.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { ToastProvider } from "@/components/wf/toast-provider";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";

/**
 * Audit 24-1 (24 Oct 2026), B-01 and B-02: a person's displayed bed number never changes unless
 * that person is moved. Two Bed board moves shifted two untouched people up one bed (B-01), and
 * ending one pulled bed moved the other pulled person to a new bed (B-02). Read from the bed cards
 * the ward screen draws, so the roster, not only `seatStays`, is checked. Synthetic demo data only.
 */

type Api = ReturnType<typeof useWardFlow>;
const latest: { api?: Api } = {};

function Probe() {
  const flow = useWardFlow();
  useEffect(() => {
    latest.api = flow;
  });
  return null;
}

function renderWard(unitId: string) {
  cleanup();
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <ToastProvider>
        <Probe />
        <WardScreen unitId={unitId} />
      </ToastProvider>
    </WardFlowProvider>,
  );
  fireEvent.click(document.querySelector<HTMLElement>("#tabBtn-board")!);
}

type Card = { bed: number; state: string; admissionId?: string; text: string };

function cards(): Card[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-testid^='ward-bed-card-']")).map((card) => ({
    bed: Number(card.dataset.testid!.replace("ward-bed-card-", "")),
    state: card.dataset.state ?? "",
    admissionId: card.dataset.admissionId,
    text: card.textContent ?? "",
  }));
}

/** Who sits in each bed: an admission id, or a pulled card's own text when it carries none. */
function bedsByStay(): Map<string, number> {
  return new Map(
    cards().flatMap((card) =>
      card.admissionId !== undefined
        ? [[card.admissionId, card.bed] as const]
        : card.state === "incoming"
          ? [[`pulled:${card.text}`, card.bed] as const]
          : [],
    ),
  );
}

function card(bed: number): Card {
  return cards().find((candidate) => candidate.bed === bed)!;
}

function dispatch(event: Record<string, unknown>) {
  act(() => {
    latest.api!.dispatch({ now: NOW_ANCHOR, ...event } as never);
  });
}

function placeInBed(unitId: string, admissionId: string, bedNumber: number) {
  dispatch({ type: "PLACE_IN_BED", role: "ward", admissionId, bedNumber, actingUnitId: unitId });
}

/** Every stay seen before, except those acted on or gone, keeps its bed. */
function movedStays(before: Map<string, number>, except: readonly string[]): string[] {
  const after = bedsByStay();
  return [...before].flatMap(([stay, bed]) =>
    except.includes(stay) || !after.has(stay) || after.get(stay) === bed
      ? []
      : [`${stay}: bed ${bed} -> ${after.get(stay)}`],
  );
}

describe("bed numbers stay put (audit 24-1)", () => {
  it("B-01: two successive Bed board moves leave every untouched stay in its bed", () => {
    const unit = "sjgs-adult-open";
    renderWard(unit);
    const before = bedsByStay();
    const first = card(3).admissionId!;
    const firstTarget = cards().find((candidate) => candidate.state === "ready")!.bed;
    placeInBed(unit, first, firstTarget);
    expect(bedsByStay().get(first)).toBe(firstTarget);
    expect(card(3).state).toBe("ready");

    const second = card(6).admissionId!;
    placeInBed(unit, second, 3);
    expect(bedsByStay().get(second)).toBe(3);
    expect(movedStays(before, [first, second])).toEqual([]);
    expect(card(6).state, "the bed the second person left is the one that is free").toBe("ready");
  });

  it("B-02: ending one pulled bed leaves the other pulled person in her bed", () => {
    const unit = "sjgm-adult-open";
    renderWard(unit);
    const withdrawn = latest.api!.movements.find((movement) => movement.id === "WF-311")!;
    const pulledCards = cards().filter((candidate) => candidate.state === "incoming");
    expect(pulledCards, "the demo ward has two pulled beds").toHaveLength(2);
    const before = bedsByStay();
    const closedBefore = cards()
      .filter((candidate) => candidate.state === "closed")
      .map((candidate) => candidate.bed);

    dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", movementId: withdrawn.id, actingPlaceId: withdrawn.originEdId });
    expect(latest.api!.movements.find((movement) => movement.id === withdrawn.id)?.closure).toBeDefined();

    const stillPulled = cards().filter((candidate) => candidate.state === "incoming");
    expect(stillPulled).toHaveLength(1);
    expect(movedStays(before, [])).toEqual([]);
    const freed = pulledCards.find((candidate) => !stillPulled.some((left) => left.text === candidate.text))!;
    expect(card(freed.bed).state, "only the withdrawn person's bed becomes free").toBe("ready");
    // Closed beds that are still closed keep their numbers (the count itself is below).
    for (const bed of closedBefore) expect(["closed", "occupied"]).toContain(card(bed).state);
  });

  // `releasePulledBedAndAdmission` now gives back the physical empty bed a seeded pull (admission
  // with no `movementId`) held, so `bedStates` no longer re-counts the closed bed as occupied.
  it("B-02: the closed bed stays closed and no unnamed occupied tile appears", () => {
    const unit = "sjgm-adult-open";
    renderWard(unit);
    const withdrawn = latest.api!.movements.find((movement) => movement.id === "WF-311")!;
    const closedBefore = cards()
      .filter((candidate) => candidate.state === "closed")
      .map((candidate) => candidate.bed);
    dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", movementId: withdrawn.id, actingPlaceId: withdrawn.originEdId });
    for (const bed of closedBefore) expect(card(bed).state).toBe("closed");
    expect(
      cards().filter((candidate) => candidate.state === "occupied" && candidate.admissionId === undefined),
    ).toEqual([]);
  });

  it("property: across the seed wards, one move, departure or withdrawal moves nobody else", () => {
    renderWard("sjgs-adult-open");
    const unitIds = latest.api!.units.filter((unit) => unit.beds > 0).map((unit) => unit.id);
    const failures: string[] = [];
    let applied = 0;

    for (const unitId of unitIds) {
      renderWard(unitId);
      const initial = cards();
      const movable = initial.filter((candidate) => candidate.admissionId !== undefined && candidate.state !== "ready");
      const free = initial.filter((candidate) => candidate.state === "ready").map((candidate) => candidate.bed);
      const cases: { label: string; acted: string[]; run: () => boolean }[] = [];

      const picks = [...new Set([movable[0], movable[movable.length - 1]].filter(Boolean))];
      const targets = [...new Set([free[0], free[free.length - 1]].filter((bed) => bed !== undefined))];
      for (const pick of picks) {
        for (const target of targets) {
          cases.push({
            label: `${unitId} move ${pick.admissionId} to bed ${target}`,
            acted: [pick.admissionId!],
            run: () => {
              placeInBed(unitId, pick.admissionId!, target);
              return (
                latest.api!.admissions.find((admission) => admission.id === pick.admissionId)?.bedNumber === target
              );
            },
          });
        }
      }
      const leaver = movable.find((candidate) => candidate.state === "occupied");
      if (leaver) {
        cases.push({
          label: `${unitId} departure of ${leaver.admissionId}`,
          acted: [leaver.admissionId!],
          run: () => {
            dispatch({
              type: "RECORD_LEAVING",
              role: "ward",
              admissionId: leaver.admissionId,
              actingUnitId: unitId,
              leavingDestination: "discharged-to-the-community",
            });
            return (
              latest.api!.admissions.find((admission) => admission.id === leaver.admissionId)?.state !== "occupied"
            );
          },
        });
      }
      for (const movement of latest.api!.movements.filter(
        (candidate) =>
          candidate.acceptedUnitId === unitId && candidate.admissionId !== undefined && candidate.closure === undefined,
      )) {
        cases.push({
          label: `${unitId} withdrawal of ${movement.id}`,
          acted: [movement.admissionId!],
          run: () => {
            dispatch(
              movement.originEdId
                ? {
                    type: "WITHDRAW_REFERRAL",
                    role: "ed",
                    movementId: movement.id,
                    actingPlaceId: movement.originEdId,
                  }
                : {
                    type: "WITHDRAW_REFERRAL",
                    role: "coordinator",
                    movementId: movement.id,
                    actingPlaceId: "coordinator",
                  },
            );
            return latest.api!.movements.find((candidate) => candidate.id === movement.id)?.closure !== undefined;
          },
        });
      }

      for (const testCase of cases) {
        renderWard(unitId);
        const before = bedsByStay();
        if (!testCase.run()) continue;
        applied += 1;
        failures.push(...movedStays(before, testCase.acted).map((moved) => `${testCase.label}: ${moved}`));
      }
    }

    expect(applied, "the sweep actually changed records").toBeGreaterThan(10);
    // CS2-03 (fixed): this list held one shift, the later pulled person after WF-016's withdrawal.
    expect(failures).toEqual([]);
  }, 240_000);

  // CS2-03: withdrawing a referral deletes its pulled admission, so the seat replay forgot that it
  // held a bed and re-seated a later pull one bed lower. The unit now keeps the released span.
  it("withdrawing the earlier of two pulled beds leaves the later pulled person in her bed", () => {
    const unit = "sjgm-adult-open";
    renderWard(unit);
    const earlier = latest.api!.movements.find((movement) => movement.id === "WF-016")!;
    const before = bedsByStay();
    dispatch({ type: "WITHDRAW_REFERRAL", role: "ed", movementId: earlier.id, actingPlaceId: earlier.originEdId });
    expect(latest.api!.movements.find((movement) => movement.id === earlier.id)?.closure).toBeDefined();
    expect(movedStays(before, [])).toEqual([]);
    // The engine keeps the released span, and a world carrying it still passes the reload check.
    const after = wardFlowReducer(seedWardFlowState(), {
      type: "WITHDRAW_REFERRAL",
      role: "ed",
      movementId: earlier.id,
      actingPlaceId: earlier.originEdId!,
      now: NOW_ANCHOR,
    });
    expect(after.units.find((candidate) => candidate.id === unit)?.releasedPullSpans).toEqual([
      expect.objectContaining({ admissionId: earlier.admissionId, leftAt: NOW_ANCHOR }),
    ]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify({ ...after, rejections: [] })))).toBe(true);
  });
});
