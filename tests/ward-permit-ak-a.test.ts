import { describe, expect, it } from "vitest";

import { commandRefusal, deskCommand, seedWorld } from "../backend/ward-flow/engine";
import {
  AK_A_DISAGREEMENTS,
  AK_A_ROWS,
  type AkAAnswer,
  type AkACell,
  type AkAPlaces,
  type AkARow,
} from "./fixtures/permission-ak-a";
import { wardPlaceLookup } from "@/components/ward-management/ward-access-places";
import { deskFor } from "@/components/ward-management/ward-desk";
import { EVENT_ROLE } from "@/components/ward-management/ward-flow-event-roles";
import type { WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { permit, recordedRole, UNKNOWN_CHANGE } from "@/components/ward-management/ward-permit";
import type { WardFlowEventType } from "@/components/ward-management/ward-role-permissions";
import type { WardAccess } from "@/components/ward-management/ward-role-access";
import { NOW_ANCHOR, siteByCode } from "@/components/ward-management/ward-sites";
import { COMMUNITY_TEAMS } from "@/components/ward-management/ward-teams";

/**
 * R-STRUCT-1, D-223 (Josh, 14 Nov 2026): the AK-A table (`tests/fixtures/permission-ak-a.ts`) is
 * the signed access rule. `permit()` and the shared server must both give AK-A's answer for every
 * cell, except the listed disagreements, which both must give the app's current answer for.
 */
const AT = new Date("2026-11-14T02:00:00Z");
const world = seedWorld(AT);
const state = world.state as unknown as WardFlowState;
const places = wardPlaceLookup(state.units);

function pickPlaces(): AkAPlaces {
  const unit = state.units[0];
  const service = unit && places.unitService(unit.id);
  const ed = state.units
    .map((candidate) => siteByCode(candidate.siteCode)?.emergencyDepartment)
    .find((candidate) => candidate !== undefined);
  if (!unit || !service || !ed?.siteCode) throw new Error("the seed has no ward or ED");
  return {
    unitId: unit.id,
    siteCode: unit.siteCode,
    service,
    edId: ed.id,
    edSiteCode: ed.siteCode,
    teamName: Object.values(COMMUNITY_TEAMS)[0]!,
  };
}

const PLACES = pickPlaces();
const ALL_TYPES = Object.keys(EVENT_ROLE) as WardFlowEventType[];

type Answers = { permit: ReturnType<typeof permit>; server: string | null; accepted: boolean };

/** What `permit` says, and what the server does with the same change sent from this membership. */
function answer(access: WardAccess, cell: AkACell): Answers {
  // A signed-in desk that cannot switch: every refusal is "never", as on the shared site.
  const desk = deskFor(access, { canSwitch: false });
  const fields = cell.fields?.(PLACES) ?? {};
  const answered = permit(desk, { type: cell.type, ...fields }, { state, places });
  const sent = deskCommand(access, {
    type: cell.type,
    role: recordedRole(desk, cell.type),
    now: NOW_ANCHOR,
    ...fields,
  }) as Record<string, unknown>;
  const server = commandRefusal(world, access, sent, AT);
  // The reducer's own first check: the recorded role must take this change.
  const accepted = server === null && (EVENT_ROLE[cell.type] as readonly string[]).includes(sent.role as string);
  return { permit: answered, server, accepted };
}

function expectedAnswer(row: AkARow, type: WardFlowEventType, akA: AkAAnswer | "not stated"): AkAAnswer {
  const disagreement = AK_A_DISAGREEMENTS.find((entry) => entry.row === row.id && entry.type === type);
  if (disagreement) return disagreement.app;
  if (akA === "not stated") throw new Error(`${row.id} ${type}: AK-A is silent, so the cell needs a disagreement row`);
  return akA;
}

function cellsOf(row: AkARow): { cell: AkACell; akA: AkAAnswer | "not stated" }[] {
  const named = row.groups.flatMap((group) =>
    group.cells.map((cell) => ({ cell: typeof cell === "string" ? { type: cell } : cell, akA: group.answer })),
  );
  if (!row.rest) return named;
  const covered = new Set(named.map(({ cell }) => cell.type));
  const rest = ALL_TYPES.filter((type) => !covered.has(type)).map((type) => ({ cell: { type }, akA: row.rest! }));
  return [...named, ...rest];
}

describe("permit() against the signed AK-A table (D-223)", () => {
  for (const row of AK_A_ROWS) {
    it(`${row.id}: ${row.membership}`, () => {
      const access = row.access(PLACES);
      for (const { cell, akA } of cellsOf(row)) {
        const expected = expectedAnswer(row, cell.type, akA);
        const { permit: answered, server, accepted } = answer(access, cell);
        expect(answered.kind, `${row.id} ${cell.type}: permit`).toBe(expected);
        expect(accepted, `${row.id} ${cell.type}: server (${server})`).toBe(expected === "allow");
        // Where the server refuses in words, permit refuses in the same words.
        if (server !== null && answered.kind !== "allow")
          expect(answered.refusal, `${row.id} ${cell.type}: words`).toBe(server);
      }
    });
  }

  it("lists each disagreement once, against a cell the table tests, with the app really differing", () => {
    const keys = AK_A_DISAGREEMENTS.map((entry) => `${entry.row} ${entry.type}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const entry of AK_A_DISAGREEMENTS) {
      const row = AK_A_ROWS.find((candidate) => candidate.id === entry.row);
      expect(row, entry.row).toBeDefined();
      expect(entry.akA, `${entry.row} ${entry.type}`).not.toBe(entry.app);
      const tested = cellsOf(row!).find(({ cell }) => cell.type === entry.type);
      expect(tested, `${entry.row} ${entry.type} is not a cell of the table`).toBeDefined();
      expect(tested!.akA, `${entry.row} ${entry.type}`).toBe(entry.akA);
    }
  });

  it("hides a step a desk can never take with the server's words and no 'who does this' line (Josh, 14 Nov)", () => {
    const ward = AK_A_ROWS.find((row) => row.id === "AK-A-04")!.access(PLACES);
    expect(permit(deskFor(ward), { type: "RAISE_PULL_NOW" })).toEqual({
      kind: "never",
      refusal: "This change is not part of your role.",
    });
    expect(permit(deskFor(ward), { type: "NOT_A_CHANGE" as WardFlowEventType })).toEqual({
      kind: "never",
      refusal: UNKNOWN_CHANGE,
    });
  });
});
