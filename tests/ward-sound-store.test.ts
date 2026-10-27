import { afterEach, describe, expect, it, vi } from "vitest";

import { getAudioBuzzPreference, setAudioBuzzPreference } from "@/components/ward-management/shell/ward-sound-store";

const STORAGE_KEY = "ward-flow-audio-buzz-pref";

function stubWindow(storage: Pick<Storage, "getItem" | "setItem">) {
  vi.stubGlobal("window", {
    localStorage: storage,
    dispatchEvent: () => true,
  });
}

function mapStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio buzz preference store (H-0306)", () => {
  it("reads another tab's storage change after a local toggle", () => {
    const storage = mapStorage();
    stubWindow(storage);

    setAudioBuzzPreference(false);
    expect(getAudioBuzzPreference()).toBe(false);

    // Another tab turns the sound back on; only storage changes here.
    storage.values.set(STORAGE_KEY, "true");
    expect(getAudioBuzzPreference()).toBe(true);
  });

  it("keeps the in-memory choice when storage throws", () => {
    stubWindow({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    setAudioBuzzPreference(false);
    expect(getAudioBuzzPreference()).toBe(false);
    setAudioBuzzPreference(true);
    expect(getAudioBuzzPreference()).toBe(true);
  });

  it("keeps a choice whose write failed even though storage still reads", () => {
    const storage = mapStorage();
    storage.values.set(STORAGE_KEY, "true");
    stubWindow({
      getItem: storage.getItem,
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });

    setAudioBuzzPreference(false);
    expect(getAudioBuzzPreference()).toBe(false);
  });
});
