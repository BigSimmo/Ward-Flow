import { describe, expect, it } from "vitest";
import {
  SharedWorkspaceClient,
  type SharedSnapshot,
  type SharedView,
} from "../src/components/ward-management/ward-shared-client";
import { parseRecordDetail, withRecordDetail } from "../src/components/ward-management/ward-shared-record-detail";
import { seedWardFlowStateAt } from "../src/components/ward-management/ward-flow-reducer";

// H-0731 (Josh, 27 Oct 2026): the shared board carries no address or interpreter language. The
// server sends them for one patient with a record opening it has logged, and the client puts them
// back for that patient only, until the desk changes.
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const seed = copy(seedWardFlowStateAt(0)) as SharedSnapshot["payload"]["state"];
const sentState = (): SharedSnapshot["payload"]["state"] => {
  const state = copy(seed);
  for (const patient of state.patients) {
    delete patient.address;
    delete patient.interpreterLanguage;
  }
  return state;
};
const payloadOf = (state: SharedSnapshot["payload"]["state"]): SharedSnapshot["payload"] => ({
  version: 1,
  state,
  dayZero: "2026-10-07T00:00:00Z",
  startedAt: "2026-10-07T10:00:00Z",
});
const withAddress = seed.patients.find((patient) => patient.address !== undefined)!;

describe("record detail from a logged opening", () => {
  it("reads only plain detail fields", () => {
    expect(parseRecordDetail({ address: "No. 7, Ashfield" })).toEqual({ address: "No. 7, Ashfield" });
    expect(parseRecordDetail({ address: "No. 7", umrn: "X" })).toBeNull();
    expect(parseRecordDetail({ address: 7 })).toBeNull();
    expect(parseRecordDetail(null)).toBeNull();
    expect(parseRecordDetail(["address"])).toBeNull();
  });

  it("puts the detail back for that patient only", () => {
    const payload = payloadOf(sentState());
    expect(withRecordDetail(payload, new Map())).toBe(payload);
    const merged = withRecordDetail(payload, new Map([[withAddress.id, { address: "No. 7, Ashfield" }]]));
    const index = payload.state.patients.findIndex((patient) => patient.id === withAddress.id);
    expect(merged.state.patients[index]!.address).toBe("No. 7, Ashfield");
    expect(merged.state.patients.filter((patient) => patient.address !== undefined)).toHaveLength(1);
    expect(merged.state.patients[index === 0 ? 1 : 0]).toBe(payload.state.patients[index === 0 ? 1 : 0]);
  });

  it("shows the detail the server sent with the opening, and drops it for another desk", async () => {
    let view: SharedView | undefined;
    const asked: string[] = [];
    let accessContext = "a".repeat(64);
    const client = new SharedWorkspaceClient({
      baseUrl: "https://example.test",
      token: async () => "test",
      changed: (next) => {
        view = next;
      },
      fetch: async (input, init) => {
        const path = new URL(String(input)).pathname;
        if (path === "/v1/workspace/record-access") {
          asked.push(String(init?.body));
          return Response.json({
            logged: true,
            opened: withAddress.id,
            detail: { address: "No. 7, Ashfield" },
          });
        }
        return Response.json({
          snapshot: { dataMode: "prototype", revision: 1, now: 642, accessContext, payload: payloadOf(sentState()) },
        });
      },
    });
    const shown = () => view?.snapshot?.payload.state.patients.find((patient) => patient.id === withAddress.id);
    try {
      await client.refresh();
      expect(shown()?.address).toBeUndefined();
      await client.logRecordView(withAddress.id, "patient");
      expect(asked).toHaveLength(1);
      expect(shown()?.address).toBe("No. 7, Ashfield");
      // A later poll of the same board keeps it.
      await client.refresh();
      expect(shown()?.address).toBe("No. 7, Ashfield");
      // Another desk: the server's access context names the account, desk and place.
      accessContext = "b".repeat(64);
      client.switchRole();
      await client.refresh();
      expect(shown()?.address).toBeUndefined();
    } finally {
      client.dispose();
    }
  });
});
