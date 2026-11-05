import { describe, expect, it } from "vitest";
import {
  LEGACY_COMMAND_RECOVERY_KEY,
  removeCommandRecovery,
  readCommandRecovery,
  writeCommandRecovery,
  type RecoveryEntry,
} from "../src/components/ward-management/ward-command-recovery";

const first = "11111111-1111-4111-8111-111111111111";
const second = "22222222-2222-4222-8222-222222222222";
const entry = (commandId = first): RecoveryEntry => ({
  commandId,
  receiptScope: "opaque-desk",
  expiresAt: 9000,
  phase: "sent",
});
function memory() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

describe("metadata-only command recovery", () => {
  it("retains ordered identities while excluding every extra payload field", () => {
    const storage = memory();
    expect(
      writeCommandRecovery(storage, [
        Object.assign(entry(), { event: { note: "SYNTHETIC_PRIVATE_SENTINEL" } }),
        entry(second),
      ]),
    ).toBe(true);
    expect(readCommandRecovery(storage).entries).toEqual([entry(), entry(second)]);
    expect([...storage.values.values()].join()).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
  });
  it("reads and migrates the legacy sent identity without losing it", () => {
    expect(LEGACY_COMMAND_RECOVERY_KEY).toBe("wardflow:pending-command-v1");
    const storage = memory();
    storage.setItem(
      LEGACY_COMMAND_RECOVERY_KEY,
      JSON.stringify({ commandId: first, receiptScope: "opaque-desk", expiresAt: 9000 }),
    );
    expect(readCommandRecovery(storage).entries).toEqual([entry()]);
    expect(writeCommandRecovery(storage, [entry()])).toBe(true);
    expect(storage.getItem("wardflow:pending-command-v1")).toBeNull();
  });
  it("refuses malformed or duplicate identities rather than authorising a recovery request", () => {
    const storage = memory();
    storage.setItem("wardflow:pending-commands-v2", JSON.stringify({ version: 2, entries: [entry(), entry()] }));
    expect(readCommandRecovery(storage)).toMatchObject({ entries: [], invalid: true });
    expect(writeCommandRecovery(storage, [{ ...entry(), commandId: "../private" }])).toBe(false);
    storage.setItem("wardflow:pending-commands-v2", "{truncated");
    expect(readCommandRecovery(storage)).toEqual({ entries: [], invalid: true });
  });
  it("reports denied storage and never claims durable recovery succeeded", () => {
    const storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {},
    };
    expect(readCommandRecovery(storage).unavailable).toBe(true);
    expect(writeCommandRecovery(storage, [entry()])).toBe(false);
  });
});

it("preserves every stored identity when per-command cleanup cannot read the journal", () => {
  const storage = memory();
  writeCommandRecovery(storage, [entry(), entry(second)]);
  const before = [...storage.values];
  const denied = {
    ...storage,
    getItem: () => {
      throw new Error("Synthetic read denial");
    },
  };
  expect(removeCommandRecovery(denied, first)).toBe(false);
  expect([...storage.values]).toEqual(before);
});
