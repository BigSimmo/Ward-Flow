import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no App Router context for next/link.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const UNIT = "rph-adult-secure";

// The ward desk for this ward: arrival rows offer Confirm arrival beside Pull the bed.
vi.mock("@/components/ward-management/shell/ward-access-store", async (original) => ({
  ...(await original<typeof import("@/components/ward-management/shell/ward-access-store")>()),
  useEffectiveWardAccess: () => ({ role: "ward", scope: { kind: "ward", unitIds: [UNIT] } }),
}));

// Review P4-2/P4-3: a test may change the seeded world before the provider reads it (synthetic only).
const seedPatch = vi.hoisted(() => ({
  current: undefined as
    undefined | ((state: import("@/components/ward-management/ward-flow-reducer").WardFlowState) => void),
}));
vi.mock("@/components/ward-management/ward-flow-reducer", async (original) => {
  const actual = await original<typeof import("@/components/ward-management/ward-flow-reducer")>();
  return {
    ...actual,
    seedWardFlowStateAt: (...args: Parameters<typeof actual.seedWardFlowStateAt>) => {
      const state = actual.seedWardFlowStateAt(...args);
      seedPatch.current?.(state);
      return state;
    },
  };
});

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOT_RECORDED_OBSERVATION, observationLevelName } from "@/components/ward-management/ward-observation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";
import { pullMadeHere } from "@/components/ward-management/ward/ward-pull-then-arrive";
import { ToastProvider } from "@/components/wf";

/**
 * Review F-2, ruling 11 and approved build answer (d) (D-191): on the Ward page, Confirm arrival on
 * a row with no pulled bed opens the pull step first. It asks which ready bed (only this ward's
 * ready beds, never a closed one), pulls with the existing PULL_PATIENT, records the chosen bed and
 * then opens the arrival. Ruling 3: the row then keeps "Undo pull · until HH:MM", which releases
 * exactly that pull as made in error. Synthetic seed data only.
 */
let current: ReturnType<typeof useWardFlow> | undefined;
function Capture() {
  const flow = useWardFlow();
  useEffect(() => {
    current = flow;
  });
  return null;
}

/** The row the tests use: this ward's first accepted person still waiting for a bed. */
const awaiting = (movement: WardFlowState["movements"][number]) =>
  movement.acceptedUnitId === UNIT && movement.stage === "accepted_awaiting_bed" && !movement.closure;

/** Changes that seeded person before the page reads the world. */
function patchAwaiting(change: (movement: WardFlowState["movements"][number]) => void) {
  seedPatch.current = (state) => {
    const movement = state.movements.find(awaiting);
    if (movement) change(movement);
  };
}

function renderWard() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        <WardScreen unitId={UNIT} />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const movement = current!.movements.find(awaiting)!;
  expect(movement).toBeDefined();
  const row = screen.getByTestId(`ward-coming-row-${movement.id}`);
  return { movement, row };
}

describe("Ward: Confirm arrival with no pulled bed (F-2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    current = undefined;
    seedPatch.current = undefined;
  });

  it("asks which ready bed, never offers a closed bed, pulls into it, then opens the arrival with an inline Undo", async () => {
    const { movement, row } = renderWard();
    fireEvent.click(within(row).getByRole("button", { name: /^Confirm arrival/u }));
    const step = screen.getByTestId("ward-pull-then-arrive");
    // Nothing happens to the record until a bed is chosen.
    expect(current!.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("accepted_awaiting_bed");
    const beds = within(step).getAllByRole("radio");
    expect(beds.length).toBeGreaterThan(0);
    expect(beds.every((bed) => !(bed as HTMLInputElement).checked)).toBe(true);
    const pullButton = within(step).getByRole("button", { name: /^Pull the bed/u });
    expect(pullButton).toHaveAttribute("aria-disabled", "true");

    const chosen = beds[beds.length - 1] as HTMLInputElement;
    const bedNumber = Number(chosen.value);
    fireEvent.click(chosen);
    await act(async () => {
      fireEvent.click(within(step).getByRole("button", { name: /^Pull the bed/u }));
    });

    const pulled = current!.movements.find((candidate) => candidate.id === movement.id)!;
    expect(pulled.stage).toBe("pulled");
    const admission = current!.admissions.find((stay) => stay.id === pulled.admissionId)!;
    expect(admission.bedNumber).toBe(bedNumber);
    expect(screen.queryByTestId("ward-pull-then-arrive")).toBeNull();
    // The arrival opened: the Coming in list is the active tab.
    expect(document.getElementById("tab-coming")).toHaveAttribute("data-active", "true");

    const undo = within(screen.getByTestId(`ward-coming-row-${movement.id}`)).getByRole("button", {
      name: /^Undo pull · until \d\d:\d\d for /u,
    });
    await act(async () => {
      fireEvent.click(undo);
    });
    const released = current!.movements.find((candidate) => candidate.id === movement.id)!;
    expect(released.stage).toBe("accepted_awaiting_bed");
    expect(released.closure).toBeUndefined();
    // Review FA-2: focus moves to the restored row's Pull the bed, not to the page.
    const restored = screen.getByTestId(`ward-coming-row-${movement.id}`);
    expect(document.activeElement).toBe(within(restored).getByRole("button", { name: /^Pull the bed/u }));
  });

  it("never lists a closed bed and sends nothing on Cancel", () => {
    const { movement, row } = renderWard();
    fireEvent.click(within(row).getByRole("button", { name: /^Confirm arrival/u }));
    const step = screen.getByTestId("ward-pull-then-arrive");
    const unit = current!.units.find((candidate) => candidate.id === UNIT)!;
    const offered = within(step)
      .getAllByRole("radio")
      .map((bed) => Number((bed as HTMLInputElement).value));
    for (const bedNumber of offered) {
      expect(bedNumber).toBeGreaterThanOrEqual(1);
      expect(bedNumber).toBeLessThanOrEqual(unit.beds);
      // A bed somebody occupies or holds is not ready, so it is never offered either.
      expect(
        current!.admissions.some(
          (stay) =>
            stay.unitId === UNIT &&
            stay.bedNumber === bedNumber &&
            (stay.state === "occupied" || stay.state === "pulled"),
        ),
      ).toBe(false);
    }
    // A closed bed is named as not listed, and never offered.
    const closedBed = /Bed (\d+) is closed and not listed\./u.exec(step.textContent ?? "");
    if (closedBed) expect(offered).not.toContain(Number(closedBed[1]));
    fireEvent.click(within(step).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByTestId("ward-pull-then-arrive")).toBeNull();
    expect(current!.movements.find((candidate) => candidate.id === movement.id)!.stage).toBe("accepted_awaiting_bed");
  });
});

describe("pullMadeHere", () => {
  it("names only the first pull after the send, while it is still the latest step", () => {
    const base = { closure: undefined, stage: "pulled" } as const;
    const change = (to: string, at: number) => ({ at, from: "accepted_awaiting_bed", to, by: "ward" });
    const made = { ...base, stageChanges: [change("accepted_awaiting_bed", 1), change("pulled", 5)] };
    expect(pullMadeHere(made as never, 1)).toEqual({ stageIndex: 1, at: 5 });
    const repulled = {
      ...base,
      stageChanges: [
        change("accepted_awaiting_bed", 1),
        change("pulled", 5),
        change("accepted_awaiting_bed", 6),
        change("pulled", 7),
      ],
    };
    // Released and pulled again since: not the pull made here.
    expect(pullMadeHere(repulled as never, 1)).toBeUndefined();
    expect(pullMadeHere({ ...made, stage: "accepted_awaiting_bed" } as never, 1)).toBeUndefined();
  });
});

describe("Ward pulls ask for an observation level the record does not hold (D-188, review P4-2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    current = undefined;
    seedPatch.current = undefined;
  });

  const stored = (id: string) => current!.movements.find((candidate) => candidate.id === id)!;

  it("a row's Pull the bed with a recorded level pulls at once, as before", async () => {
    const { movement, row } = renderWard();
    expect(movement.observation.level).not.toBe("not_recorded");
    await act(async () => {
      fireEvent.click(within(row).getByRole("button", { name: /^Pull the bed/u }));
    });
    expect(screen.queryByTestId("ward-pull-then-arrive")).toBeNull();
    expect(stored(movement.id).stage).toBe("pulled");
    expect(stored(movement.id).observation).toEqual(movement.observation);
  });

  it("a row's Pull the bed asks for the level first, pulls nothing until one is chosen, then records it", async () => {
    patchAwaiting((movement) => {
      movement.observation = { ...NOT_RECORDED_OBSERVATION };
    });
    const { movement, row } = renderWard();
    expect(movement.observation.level).toBe("not_recorded");
    fireEvent.click(within(row).getByRole("button", { name: /^Pull the bed/u }));
    const step = screen.getByTestId("ward-pull-then-arrive");
    expect(stored(movement.id).stage).toBe("accepted_awaiting_bed");
    // Only the level is asked on this path: no bed choice.
    expect(within(step).queryByRole("group", { name: /^Bed/u })).toBeNull();
    const group = within(step).getByTestId("ward-pull-then-arrive-observation");
    expect(group).toHaveTextContent("Not recorded");
    const levels = within(group).getAllByRole("radio");
    expect(levels.every((level) => !(level as HTMLInputElement).checked)).toBe(true);
    const pull = () => within(step).getByRole("button", { name: /^Pull the bed/u });
    expect(pull()).toHaveAttribute("aria-disabled", "true");
    expect(step).toHaveTextContent("Choose observation level");
    await act(async () => {
      fireEvent.click(pull());
    });
    expect(stored(movement.id).stage).toBe("accepted_awaiting_bed");

    // Intermittent needs "Check every" before the pull, as the Home form does.
    fireEvent.click(within(group).getByRole("radio", { name: observationLevelName("intermittent") }));
    expect(pull()).toHaveAttribute("aria-disabled", "true");
    expect(step).toHaveTextContent("Choose how often to check");
    const interval = within(step).getByTestId("ward-pull-then-arrive-interval") as HTMLSelectElement;
    const minutes = Number(interval.options[interval.options.length - 1]!.value);
    fireEvent.change(interval, { target: { value: String(minutes) } });
    await act(async () => {
      fireEvent.click(pull());
    });

    const pulled = stored(movement.id);
    expect(pulled.stage).toBe("pulled");
    expect(pulled.observation.level).toBe("intermittent");
    expect(pulled.observation.intervalMinutes).toBe(minutes);
    expect(screen.queryByTestId("ward-pull-then-arrive")).toBeNull();
  });

  it("Confirm arrival asks for the level and the bed, and the pull carries the chosen level", async () => {
    patchAwaiting((movement) => {
      movement.observation = { ...NOT_RECORDED_OBSERVATION };
    });
    const { movement, row } = renderWard();
    fireEvent.click(within(row).getByRole("button", { name: /^Confirm arrival/u }));
    const step = screen.getByTestId("ward-pull-then-arrive");
    const group = within(step).getByTestId("ward-pull-then-arrive-observation");
    const beds = within(step)
      .getAllByRole("radio")
      .filter((radio) => !group.contains(radio));
    const chosen = beds[beds.length - 1] as HTMLInputElement;
    fireEvent.click(chosen);
    const pull = () => within(step).getByRole("button", { name: /^Pull the bed/u });
    // A bed alone is not enough while the level is not recorded.
    expect(pull()).toHaveAttribute("aria-disabled", "true");
    await act(async () => {
      fireEvent.click(pull());
    });
    expect(stored(movement.id).stage).toBe("accepted_awaiting_bed");

    fireEvent.click(within(group).getByRole("radio", { name: observationLevelName("within_sight") }));
    await act(async () => {
      fireEvent.click(pull());
    });
    const pulled = stored(movement.id);
    expect(pulled.stage).toBe("pulled");
    expect(pulled.observation.level).toBe("within_sight");
    const admission = current!.admissions.find((stay) => stay.id === pulled.admissionId)!;
    expect(admission.bedNumber).toBe(Number(chosen.value));
    expect(admission.observation.level).toBe("within_sight");
  });
});

describe("Ward pull step keeps a bed already held for the person (review P4-3)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    current = undefined;
    seedPatch.current = undefined;
  });

  it("offers the held bed first, chosen and marked Held for them, and pulls them into it", async () => {
    // First learn a ready bed that fits, then hold it for this person in a fresh world.
    const first = renderWard();
    fireEvent.click(within(first.row).getByRole("button", { name: /^Confirm arrival/u }));
    const offered = within(screen.getByTestId("ward-pull-then-arrive"))
      .getAllByRole("radio")
      .map((bed) => Number((bed as HTMLInputElement).value));
    const heldBed = offered[offered.length - 1]!;
    cleanup();
    window.localStorage.clear();
    window.sessionStorage.clear();
    patchAwaiting((movement) => {
      movement.heldBedNumber = heldBed;
    });

    const { movement, row } = renderWard();
    expect(movement.heldBedNumber).toBe(heldBed);
    fireEvent.click(within(row).getByRole("button", { name: /^Confirm arrival/u }));
    const step = screen.getByTestId("ward-pull-then-arrive");
    const beds = within(step).getAllByRole("radio") as HTMLInputElement[];
    expect(Number(beds[0]!.value)).toBe(heldBed);
    expect(beds[0]!.checked).toBe(true);
    expect(beds[0]!.closest("label") ?? beds[0]!.parentElement).toHaveTextContent("Held for them");
    expect(beds.filter((bed) => Number(bed.value) === heldBed)).toHaveLength(1);
    await act(async () => {
      fireEvent.click(within(step).getByRole("button", { name: /^Pull the bed/u }));
    });
    const pulled = current!.movements.find((candidate) => candidate.id === movement.id)!;
    expect(pulled.stage).toBe("pulled");
    expect(current!.admissions.find((stay) => stay.id === pulled.admissionId)!.bedNumber).toBe(heldBed);
  });
});
