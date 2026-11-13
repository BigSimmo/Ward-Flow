// FM-11 (Ward notes item 9): a pulled bed on the Ward page's Every bed tiles names who it is for and
// the journey's stage ("For" above "Marrowvale, Gianna", then "Pulled · moving"), so it never reads as
// an occupied bed. Synthetic seed only.
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// One seeded pulled journey can be moved on to a later stage for a test, as the app would record it.
const stageFor = new Map<string, "handover_ready" | "moving">();
const restaged = new WeakMap<object, unknown>();
vi.mock("@/components/ward-management/ward-flow-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ward-management/ward-flow-provider")>();
  return {
    ...actual,
    useWardFlowSelect: (...keys: string[]) => {
      const picked = (actual.useWardFlowSelect as (...keys: string[]) => Record<string, unknown>)(...keys);
      const movements = picked.movements as { id: string; stage: string }[] | undefined;
      if (movements === undefined || stageFor.size === 0) return picked;
      if (!restaged.has(movements)) {
        restaged.set(
          movements,
          movements.map((movement) =>
            stageFor.has(movement.id) ? { ...movement, stage: stageFor.get(movement.id) } : movement,
          ),
        );
      }
      return { ...picked, movements: restaged.get(movements) };
    },
  };
});

import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";
import { pulledTileNote } from "@/components/ward-management/ward/ward-home-tab-today";
import { WardScreen } from "@/components/ward-management/ward/ward-screen";

const seed = seedWardFlowState();

function pulledTiles(unitId: string) {
  render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <WardScreen unitId={unitId} />
    </WardFlowProvider>,
  );
  return within(screen.getByRole("list", { name: /^Beds at / }))
    .getAllByRole("button")
    .filter((tile) => tile.getAttribute("data-status") === "incoming");
}

/** The seeded pulled stays on a ward and the journey each was pulled for, by the same link the board reads. */
function seededPulls(unitId: string) {
  return seed.admissions
    .filter((admission) => admission.unitId === unitId && admission.state === "pulled")
    .map((admission) => ({
      admission,
      movement: seed.movements.find(
        (movement) => movement.id === admission.movementId || movement.admissionId === admission.id,
      )!,
    }));
}

afterEach(() => stageFor.clear());

describe("FM-11: a pulled tile says who the bed is for and the journey's stage", () => {
  it("words the state line from the journey's own stage label, then the hold", () => {
    expect(pulledTileNote("moving", "2h 10m left")).toBe("Pulled · moving · 2h 10m left");
    expect(pulledTileNote("handover_ready", "2h 10m left")).toBe("Pulled · handover ready · 2h 10m left");
    // Still at the pulled stage: "Pulled" says it all, never "Pulled · pulled".
    expect(pulledTileNote("pulled", "2h 10m left")).toBe("Pulled · 2h 10m left");
    expect(pulledTileNote(undefined, undefined)).toBe("Pulled");
  });

  it("shows For, the person's name and Pulled on both seeded pulled beds at St John of God Midland", () => {
    const pulls = seededPulls("sjgm-adult-open");
    expect(pulls).toHaveLength(2);
    const tiles = pulledTiles("sjgm-adult-open");
    expect(tiles).toHaveLength(2);
    for (const tile of tiles) {
      const label = tile.getAttribute("aria-label") ?? "";
      const text = tile.textContent ?? "";
      // The visible words, in order: the quiet "For", then "Surname, Given", then the state line.
      expect(text).toMatch(/\bFor [^\s,]+, \s?\S/);
      expect(text).toMatch(/Pulled · \S/);
      // The accessible name reads the same words first (axe label-content-name-mismatch).
      expect(label).toMatch(/^Bed \d{2}, For [^,]+, [^,]+, Pulled/);
    }
    // Two different people, one per pulled bed.
    const names = tiles.map((tile) => /, For ([^,]+, [^,]+),/.exec(tile.getAttribute("aria-label") ?? "")?.[1]);
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(2);
  });

  it("adds the journey's stage once it moves on: Pulled · moving", () => {
    const [{ movement }] = seededPulls("bty-adult-secure");
    stageFor.set(movement.id, "moving");
    const tiles = pulledTiles("bty-adult-secure");
    expect(tiles).toHaveLength(1);
    const [tile] = tiles;
    expect(tile.textContent).toMatch(/For [^\s,]+, \s?\S.* Pulled · moving/);
    expect(tile.getAttribute("aria-label")).toMatch(/^Bed \d{2}, For [^,]+, [^,]+, Pulled · moving/);
    // "For" is its own quiet line above the name.
    expect(within(tile).getByText("For")).toHaveAttribute("aria-hidden", "true");
  });

  it("says handover ready at that stage", () => {
    const [{ movement }] = seededPulls("bty-adult-secure");
    stageFor.set(movement.id, "handover_ready");
    const [tile] = pulledTiles("bty-adult-secure");
    expect(tile.textContent).toMatch(/Pulled · handover ready/);
  });

  it("puts no For line on an occupied or free bed", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <WardScreen unitId="sjgm-adult-open" />
      </WardFlowProvider>,
    );
    const others = within(screen.getByRole("list", { name: /^Beds at / }))
      .getAllByRole("button")
      .filter((tile) => tile.getAttribute("data-status") !== "incoming");
    expect(others.length).toBeGreaterThan(0);
    for (const tile of others) expect(within(tile).queryByText("For")).toBeNull();
  });
});
