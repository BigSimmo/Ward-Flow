import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "@/components/ward-management/ward-shared-client";
import { seedWardFlowStateAt } from "@/components/ward-management/ward-flow-reducer";
const state = seedWardFlowStateAt(0);
const snapshot = (revision: number): SharedSnapshot => ({
  dataMode: "prototype",
  revision,
  now: 642,
  payload: { version: 1, state, dayZero: "2026-10-07T00:00:00Z", startedAt: "2026-10-07T10:00:00Z" },
});
describe("authoritative workspace identity", () => {
  it.each([
    ["workspace-a", "workspace-b"],
    [undefined, "workspace-b"],
    ["workspace-a", undefined],
  ])(
    "retires old snapshot and detail when endpoint workspace identity changes %s → %s",
    async (beforeWorkspace, nextWorkspace) => {
      const views: SharedView[] = [];
      let reads = 0;
      const patientId = state.patients[0]!.id;
      let lateResolve!: (response: Response) => void;
      const late = new Promise<Response>((resolve) => {
        lateResolve = resolve;
      });
      let detailReads = 0;
      const client = new SharedWorkspaceClient({
        baseUrl: "https://synthetic.test",
        token: async () => "synthetic",
        changed: (view) => views.push(view),
        fetch: async (input) => {
          const url = String(input);
          if (url.includes("record-access")) {
            if (++detailReads === 1)
              return Response.json({
                opened: patientId,
                generation: state.worldGeneration,
                detail: { address: "Synthetic previous workspace address" },
              });
            return late;
          }
          reads++;
          if (reads === 1) return Response.json({ workspaceId: beforeWorkspace, snapshot: snapshot(5) });
          if (reads === 2)
            return Response.json({ workspaceId: nextWorkspace, notModified: true, revision: 5, now: 642 });
          expect(url).toBe("https://synthetic.test/v1/workspace");
          return Response.json({ workspaceId: nextWorkspace, snapshot: snapshot(1) });
        },
      });
      try {
        await client.refresh();
        expect(await client.logRecordView(patientId, "patient")).toBe(true);
        const pendingDetail = client.logRecordView(patientId, "patient");
        await new Promise((resolve) => setTimeout(resolve, 0));
        await client.refresh();
        for (let count = 0; count < 20 && views.at(-1)?.status !== "ready"; count++)
          await new Promise((resolve) => setTimeout(resolve, 0));
        expect(reads).toBe(3);
        expect(views.some((view) => view.workspaceId === nextWorkspace && view.snapshot === null)).toBe(true);
        expect(views.at(-1)?.workspaceId).toBe(nextWorkspace);
        expect(views.at(-1)?.snapshot?.revision).toBe(1);
        expect(
          views.at(-1)?.snapshot?.payload.state.patients.find((patient) => patient.id === patientId)?.address,
        ).not.toBe("Synthetic previous workspace address");
        lateResolve(
          Response.json({
            opened: patientId,
            generation: state.worldGeneration,
            detail: { address: "Synthetic late previous workspace address" },
          }),
        );
        expect(await pendingDetail).toBe(false);
        expect(
          views.at(-1)?.snapshot?.payload.state.patients.find((patient) => patient.id === patientId)?.address,
        ).not.toBe("Synthetic late previous workspace address");
      } finally {
        client.dispose();
      }
    },
  );
});
