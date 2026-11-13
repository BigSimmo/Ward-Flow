import { act, fireEvent, render, screen, within } from "@testing-library/react";
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

import { WardFlowProvider, useWardFlow } from "@/components/ward-management/ward-flow-provider";
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

function renderWard() {
  render(
    <ToastProvider>
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <Capture />
        <WardScreen unitId={UNIT} />
      </WardFlowProvider>
    </ToastProvider>,
  );
  const movement = current!.movements.find(
    (candidate) =>
      candidate.acceptedUnitId === UNIT && candidate.stage === "accepted_awaiting_bed" && !candidate.closure,
  )!;
  expect(movement).toBeDefined();
  const row = screen.getByTestId(`ward-coming-row-${movement.id}`);
  return { movement, row };
}

describe("Ward: Confirm arrival with no pulled bed (F-2)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    current = undefined;
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
