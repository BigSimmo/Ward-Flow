import { describe, expect, it } from "vitest";

import { validSharedCommand } from "../backend/ward-flow/command-schemas";
import { cancelledMoveCheck } from "@/components/ward-management/loop-checks/ward-loop-checks";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import type { WardFlowEvent } from "@/components/ward-management/ward-flow-events";
import { seedWardFlowState, wardFlowReducer, type WardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { WARD_FLOW_ROLE_LABELS } from "@/components/ward-management/ward-flow-roles";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/**
 * Closing the loop, package D (#713), through the SHARED path. The package's own tests
 * (`ward-loop-checks.test.ts`, `ward-loop-checks.dom.test.tsx`) only ever call the reducer in local
 * synthetic mode, so nothing proved a loop-check record survives a shared save: the schema gate the
 * shared server applies, the JSON round trip, and the snapshot the client adopts afterwards.
 *
 * One feature, end to end: marking an item on a cancelled move (`MARK_CANCELLED_MOVE_CHECK`). The
 * stub server is the real reducer behind the real schema check, so nothing here is a copy of the
 * engine's behaviour; no network, no timers, one fixed command id.
 */

const NOW = NOW_ANCHOR;
/** The demo seed's cancelled move. It carries `receiving_notice` and `transport_booking` marks. */
const CANCELLED_MOVEMENT_ID = "WF-008";
/** Unmarked in the seed, so a successful save is visible rather than a replacement of a like mark. */
const ITEM = "escort" as const;

const markEscort = {
  type: "MARK_CANCELLED_MOVE_CHECK",
  role: "coordinator",
  now: NOW,
  movementId: CANCELLED_MOVEMENT_ID,
  item: ITEM,
  mark: "not_applicable",
} as const satisfies WardFlowEvent;

const movementOf = (state: WardFlowState, id: string) => state.movements.find((movement) => movement.id === id)!;
const marksOn = (state: WardFlowState) => movementOf(state, CANCELLED_MOVEMENT_ID).cancellationChecks ?? [];
const escortMarkOn = (state: WardFlowState) => cancelledMoveCheck(movementOf(state, CANCELLED_MOVEMENT_ID), ITEM);

/**
 * A shared workspace whose server is the reducer: a read returns the current board, a command is
 * checked by the shared schema, applied, and answered with the next revision.
 */
function sharedWorkspace() {
  let state = seedWardFlowState();
  let revision = 1;
  const bodies: Array<Record<string, unknown>> = [];
  const refusedBySchema: Array<Record<string, unknown>> = [];
  let view: SharedView | undefined;

  const snapshot = (): SharedSnapshot => ({
    dataMode: "prototype",
    revision,
    now: NOW,
    // Serialised as the server stores and returns it, so a record that cannot survive JSON fails here.
    payload: {
      version: 1,
      state: JSON.parse(JSON.stringify(state)) as WardFlowState,
      dayZero: "2026-10-24T00:00:00Z",
      startedAt: "2026-10-24T10:00:00Z",
    },
  });

  const client = new SharedWorkspaceClient({
    baseUrl: "https://example.test",
    token: async () => "synthetic-token",
    commandId: () => "synthetic-command-1",
    changed: (next) => {
      view = next;
    },
    fetch: async (_url, init) => {
      if (!init?.body) return Response.json({ snapshot: snapshot() });
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      bodies.push(body);
      // The gate the real shared server applies before the reducer sees a command.
      if (!validSharedCommand(body.event)) {
        refusedBySchema.push(body);
        return Response.json({ snapshot: snapshot(), error: "Synthetic schema refusal" }, { status: 422 });
      }
      const next = wardFlowReducer(state, body.event as WardFlowEvent);
      if (next === state || next.rejections.length > state.rejections.length)
        return Response.json({ snapshot: snapshot(), error: "Synthetic engine refusal" }, { status: 422 });
      state = next;
      revision += 1;
      return Response.json({ outcome: "accepted", snapshot: snapshot() });
    },
  });

  return {
    client,
    bodies,
    refusedBySchema,
    server: () => state,
    view: () => view!,
  };
}

describe("closing the loop in shared mode", () => {
  it("saves a cancelled-move mark through the shared path and reads it back on the board", async () => {
    const shared = sharedWorkspace();
    try {
      await shared.client.refresh();
      expect(shared.view().status).toBe("ready");
      expect(escortMarkOn(shared.view().snapshot!.payload.state)).toBeUndefined();

      const outcome = await shared.client.dispatchConfirmed(markEscort);

      // The shared server's schema never refused it, and it went as one command, not a local write.
      expect(shared.refusedBySchema).toEqual([]);
      expect(outcome.status).toBe("accepted");
      expect(shared.bodies).toHaveLength(1);
      expect(shared.bodies[0]).toMatchObject({
        commandId: "synthetic-command-1",
        classification: "synthetic",
        dataMode: "prototype",
        event: markEscort,
      });

      // The record the server kept: one new mark, by the acting role, at the command's own time.
      const saved = escortMarkOn(shared.server());
      expect(saved).toMatchObject({
        item: ITEM,
        mark: "not_applicable",
        at: NOW,
        by: WARD_FLOW_ROLE_LABELS.coordinator,
      });
      expect(marksOn(shared.server())).toHaveLength(3);

      // And the board every desk now reads, adopted from the server rather than derived here.
      const adopted = shared.view().snapshot!;
      expect(adopted.revision).toBe(2);
      expect(escortMarkOn(adopted.payload.state)).toEqual(saved);
      expect(isValidStoredWardFlowState(adopted.payload.state)).toBe(true);
    } finally {
      shared.client.dispose();
    }
  });
});
