import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  WARD_FLOW_DEVICE_SETTING_KEYS,
  clearWardFlowBrowserData,
  isWardFlowStorageKey,
} from "@/components/ward-management/ward-browser-data";
import { SupabaseWardAuth, WARD_AUTH_STORAGE_KEY } from "@/components/ward-management/ward-supabase-auth";

/** A Storage stand-in with `key`/`length`, so the sweep can walk it. */
function memoryStorage(entries: Record<string, string>) {
  const values = new Map(Object.entries(entries));
  return {
    get length() {
      return values.size;
    },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
    keys: () => [...values.keys()].sort(),
  };
}

describe("sign-out clears Ward Flow browser data (overall review 2.8)", () => {
  it("removes every Ward Flow key, keeps device display settings and never touches other apps", () => {
    const local = memoryStorage({
      "ward-hub-pinned": "[]",
      "ward-hub-recent": "[]",
      "ward-flow:on-call:favourites": "[]",
      "ward-community-gateway-recent": "[]",
      ward_flow_choice_ed_index_order: "longest",
      "ward-flow-discreet-names": "on",
      "ward-flow-rail": "closed",
      "clinical-kb-theme": "dark",
      "clinical-kb-preferences": "{}",
      "sb-other-app": "x",
    });
    const session = memoryStorage({
      "ward-flow-demo-state-v1": "{}",
      "ward-flow-coordinator-last-look:scope:user:standard:1": "{}",
      ward_flow_home_ed_filter: "ed-1",
      "wardflow:census-bed-opener": "row",
      "wardflow:census-bed-opener-target": "unit:1",
      "wardflow:access-desk-v1": "{}",
      "wardflow:working-as-v1": "id",
      "ward-flow-service": "service",
      "wf-draft:v2:account:session:scenario:kind:subject": "{}",
      "wf-draft-session:v1": "{}",
      [WARD_AUTH_STORAGE_KEY]: "{}",
      "a-future-ward-flow-key-elsewhere": "kept",
    });
    clearWardFlowBrowserData([local, session]);
    expect(local.keys()).toEqual([
      "clinical-kb-preferences",
      "clinical-kb-theme",
      "sb-other-app",
      "ward-flow-discreet-names",
      "ward-flow-rail",
      "ward_flow_choice_ed_index_order",
    ]);
    expect(session.keys()).toEqual(["a-future-ward-flow-key-elsewhere"]);
  });

  it("keeps sweeping the other store when one store fails", () => {
    const broken = {
      length: 1,
      key: () => {
        throw new Error("blocked");
      },
      removeItem: () => undefined,
    };
    const session = memoryStorage({ "ward-flow-demo-state-v1": "{}" });
    expect(clearWardFlowBrowserData([broken, session])).toEqual(["ward-flow-demo-state-v1"]);
    expect(session.keys()).toEqual([]);
  });

  it("covers every storage key named in the app source", () => {
    // Guard for new keys: each literal passed to a storage call, or held in a *KEY constant that
    // looks like a storage key, must match a Ward Flow prefix (or be another app's known key).
    const otherApps = new Set(["clinical-kb-theme", "clinical-kb-glare", "clinical-kb-preferences"]);
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name)) files.push(path);
      }
    };
    walk(join(process.cwd(), "src/components/ward-management"));
    const literals = new Set<string>();
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/(?:local|session)Storage\.(?:getItem|setItem|removeItem)\(\s*"([^"$]+)"/g)) {
        literals.add(match[1]!);
      }
      const keyConstant =
        /\b(?:[A-Z_]*STORAGE_KEYS?|KEY|(?:PIN|RECENT|FAVOURITES|SESSION|ROUTINE_SEEN|[A-Z_]*FILTER)_KEY)\s*=\s*"([^"]+)"/g;
      for (const match of text.matchAll(keyConstant)) literals.add(match[1]!);
    }
    expect(literals.size).toBeGreaterThan(10);
    const uncovered = [...literals].filter((key) => !isWardFlowStorageKey(key) && !otherApps.has(key));
    expect(uncovered).toEqual([]);
  });

  it("lists only Ward Flow keys as device settings", () => {
    for (const key of WARD_FLOW_DEVICE_SETTING_KEYS) expect(isWardFlowStorageKey(key)).toBe(true);
  });
});

describe("the auth adapter reports a session ending", () => {
  const url = "https://zakzoemeedfepxcstsou.supabase.co";
  const user = { id: "12345678-1234-1234-1234-123456789abc" };
  const session = { access_token: "access", refresh_token: "refresh", expires_in: 3600, user };

  it("on sign-out, and on an expired session, but not on a first sign-in", async () => {
    const store = memoryStorage({});
    const onSessionEnded = vi.fn();
    const fetcher = vi.fn(async (u: RequestInfo | URL) =>
      String(u).includes("/logout")
        ? new Response(null, { status: 204 })
        : Response.json(String(u).endsWith("/user") ? user : session),
    );
    const auth = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: store,
      fetch: fetcher,
      onSessionEnded,
    });
    await auth.signIn("synthetic@example.invalid", "synthetic-password");
    expect(onSessionEnded).not.toHaveBeenCalled();
    await auth.signOut();
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
    auth.dispose();

    const expired = memoryStorage({
      [WARD_AUTH_STORAGE_KEY]: JSON.stringify({ ...session, expiresAt: 0, recovery: false }),
    });
    const ended = vi.fn();
    const refused = vi.fn(async () => new Response(null, { status: 400 }));
    const restored = new SupabaseWardAuth({
      url,
      publishableKey: "sb_publishable_test",
      storage: expired,
      fetch: refused,
      onSessionEnded: ended,
    });
    await expect(restored.restore()).rejects.toMatchObject({ kind: "session" });
    expect(refused).toHaveBeenCalledTimes(1);
    expect(ended).toHaveBeenCalledTimes(1);
    expect(expired.getItem(WARD_AUTH_STORAGE_KEY)).toBeNull();
    restored.dispose();
  });
});
