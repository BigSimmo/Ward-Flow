import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { wardFlowLogsRoot, wardSignOutFile } from "../scripts/ward-flow/logs-root.mjs";

describe("shared Ward Flow notes location", () => {
  it("keeps Josh's Windows folder and never points another OS at a literal D: path", () => {
    expect(wardFlowLogsRoot({}, "win32")).toBe("D:/Repos/ward-flow-logs");
    expect(wardFlowLogsRoot({}, "darwin")).toBe(path.join(os.homedir(), "ward-flow-logs"));
    expect(wardFlowLogsRoot({}, "linux")).not.toMatch(/^D:/);
  });

  it("lets WARD_FLOW_LOGS and WARD_SIGNOUT_FILE override the default", () => {
    expect(wardFlowLogsRoot({ WARD_FLOW_LOGS: "/srv/notes" }, "win32")).toBe("/srv/notes");
    expect(wardSignOutFile({ WARD_FLOW_LOGS: "/srv/notes" }, "linux")).toBe("/srv/notes/sign-out.md");
    expect(wardSignOutFile({ WARD_SIGNOUT_FILE: "/tmp/log.md" }, "linux")).toBe("/tmp/log.md");
  });
});
