import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AlertsScreen } from "@/components/ward-management/alerts/alerts-screen";
import { HandoverPage, resolveMovementPatient } from "@/components/ward-management/handover/handover-page";
import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { resolveSubjectPatient } from "@/components/ward-management/ward-patient-resolver";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * **A SCREEN NAMES A MOVEMENT'S PATIENT ONLY FROM THE RECORD.**
 *
 * Handover and Alerts each carried a typed-in table of 35 names and record numbers keyed by
 * movement id, and laid it over the model. Measured against the seed on 25 September 2026: 16 of
 * those rows put a real patient's name on a DIFFERENT patient's movement (WF-013 read "Gianna
 * Marrowvale", who is WF-014's patient), and the other 19 invented a person for a movement the
 * model links to nobody. None matched. On a handover sheet that is the wrong-patient error.
 *
 * The rule these tests hold: the name and record number beside a movement are whatever the
 * model's own links resolve to, and a movement linked to nobody says so.
 */

const seed = seedWardFlowState();
const expectedFor = (movementId: string) => {
  const movement = seed.movements.find((m) => m.id === movementId);
  if (!movement) throw new Error(`no seeded movement ${movementId}`);
  const info = resolveSubjectPatient(movement, {
    patients: seed.patients,
    referrals: seed.referrals,
    movements: seed.movements,
  });
  return { name: info.displayName, umrn: info.umrn };
};

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) found.push(full);
  }
  return found;
}

describe("a movement's patient comes from the record, never from a typed-in table", () => {
  it("handover resolves every seeded movement to exactly what the model links it to", () => {
    const mismatches = seed.movements
      .map((movement) => ({
        id: movement.id,
        shown: resolveMovementPatient(movement, seed.patients, seed.referrals),
        recorded: expectedFor(movement.id),
      }))
      .filter(({ shown, recorded }) => shown.name !== recorded.name || shown.umrn !== recorded.umrn);

    expect(seed.movements.length).toBeGreaterThan(30);
    expect(mismatches).toEqual([]);
  });

  it("handover cards show the recorded name and record number beside each movement", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <HandoverPage />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /ISBAR Cards/ }));

    const cards = screen.getAllByTestId(/^patient-card-/);
    expect(cards.length).toBeGreaterThan(5);
    let linked = 0;
    for (const card of cards) {
      const movementId = card.getAttribute("data-testid")!.replace("patient-card-", "");
      const recorded = expectedFor(movementId);
      if (recorded.name !== "Unknown Patient") linked += 1;
      expect(card.textContent, movementId).toContain(recorded.name);
      expect(card.textContent, movementId).toContain(recorded.umrn);
    }
    // Every seeded movement names a real record (Josh, 25 September 2026: demo data only as linked
    // patients), so every card is the linked kind. The unlinked kind is checked on a movement
    // linked to nobody in ward-unlinked-movement-says-not-recorded.dom.test.tsx.
    expect(linked).toBe(cards.length);
  });

  it("alert rows name the recorded patient for the movement they are about", () => {
    const { container } = render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const rows = [...container.querySelectorAll("li")].filter((li) => li.textContent?.includes("• Patient:"));
    expect(rows.length).toBeGreaterThan(3);
    for (const row of rows) {
      // The detail line opens with the movement id; the owner's name runs straight into it in
      // textContent, so no word boundary is anchored here.
      const movementId = row.textContent!.match(/(WF-[A-Z0-9-]+) ·/)?.[1];
      expect(movementId, row.textContent!).toBeDefined();
      const recorded = expectedFor(movementId!);
      const strong = [...row.querySelectorAll("strong")].map((el) => el.textContent);
      expect(strong.slice(0, 2), movementId).toEqual([recorded.name, recorded.umrn]);
    }
  });

  it("the alerts feed names no patient the seed does not hold", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <AlertsScreen />
      </WardFlowProvider>,
    );
    const feed = screen.getByRole("region", { name: /Operational Notices and Shift Communication Feed/ });
    expect(feed.textContent).not.toMatch(/Luke Davies/);
    expect(feed.textContent).not.toMatch(/WF-0\d\d/);
  });

  it("no ward file keeps a typed-in table of movement personas", () => {
    const offenders = walk("src/components/ward-management").filter((file) =>
      /KNOWN_MOVEMENT_PERSONAS/.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
