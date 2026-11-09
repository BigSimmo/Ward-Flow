import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  downtimePack,
  forgetDowntimePack,
  lastDowntimePack,
  rememberDowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/*
 * D-72 item 2 guard (Josh, 21 Oct 2026): "The downtime pack regenerates hourly and at each shift
 * change as a print or a saved file only. No board data is kept in the browser cache."
 *
 * The pack lives in this tab's memory and leaves the device only as a print or a file the person
 * saves. This file fails if the pack's code reaches for browser storage, or if taking and
 * remembering a pack writes anything to it. The service worker's own refusal to keep pages and data
 * is pinned in `ward-pwa-worker.test.ts`. Audit plan item 9 (issue #1572).
 */

const REPORTS_DIR = join(process.cwd(), "src/components/ward-management/reports");
const STORAGE_APIS =
  /\b(?:localStorage|sessionStorage|indexedDB)\b|\bcaches\s*\??\.|\bdocument\s*\??\.\s*cookie\b|\bnavigator\s*\??\.\s*storage\b/u;
const SYNTHETIC_NAME = "Synthetic person";

function downtimePackSources(): string[] {
  return readdirSync(REPORTS_DIR)
    .filter((name) => /^(downtime-pack[\w.-]*|use-take-downtime-pack)\.tsx?$/u.test(name))
    .map((name) => join(REPORTS_DIR, name));
}

/** Drops block and line comments so only live code is scanned. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, "").replace(/(^|[^:\\])\/\/.*$/gmu, "$1");
}

function storageCalls(source: string): string[] {
  return withoutComments(source)
    .split("\n")
    .filter((line) => STORAGE_APIS.test(line));
}

function takePack() {
  const state = seedWardFlowState();
  return downtimePack({
    units: state.units,
    bedUnits: state.units,
    admissions: state.admissions,
    bedReleases: state.bedReleases,
    leaveBeds: state.leaveBeds,
    movements: state.movements,
    now: NOW_ANCHOR,
    identify: () => SYNTHETIC_NAME,
  });
}

function storedText(storage: Storage): string {
  const parts: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key !== null) parts.push(key, storage.getItem(key) ?? "");
  }
  return parts.join("\n");
}

afterEach(() => {
  forgetDowntimePack();
  localStorage.clear();
  sessionStorage.clear();
});

describe("downtime pack keeps no board data on the device (D-72 item 2)", () => {
  it("finds the downtime pack's source files", () => {
    const names = downtimePackSources().map((path) => path.split(/[\\/]/u).pop());
    expect(names).toEqual(expect.arrayContaining(["downtime-pack.ts", "use-take-downtime-pack.ts"]));
  });

  it("flags a storage call when one is written (non-vacuity)", () => {
    expect(storageCalls('localStorage.setItem("ward-pack", json);')).toHaveLength(1);
    expect(storageCalls("await caches.open('pack');")).toHaveLength(1);
    expect(storageCalls("await caches?.open('pack');")).toHaveLength(1);
    expect(storageCalls("const jar = document?.cookie;")).toHaveLength(1);
    expect(storageCalls("await navigator?.storage.persist();")).toHaveLength(1);
    expect(storageCalls("await caches?.[name];")).toHaveLength(1);
    expect(storageCalls('localStorage.setItem("k", v); // keep')).toHaveLength(1);
    expect(storageCalls("// localStorage is never used here")).toHaveLength(0);
    expect(storageCalls("/*\n * sessionStorage stays unused\n */")).toHaveLength(0);
  });

  it("no downtime pack source calls browser storage", () => {
    const found = downtimePackSources().flatMap((path) =>
      storageCalls(readFileSync(path, "utf8")).map((line) => `${path}: ${line.trim()}`),
    );
    expect(found).toEqual([]);
  });

  it("taking and remembering a pack writes nothing to local or session storage", () => {
    const before = { local: storedText(localStorage), session: storedText(sessionStorage) };
    const pack = takePack();
    rememberDowntimePack(pack);

    expect(lastDowntimePack()).toBe(pack);
    expect(storedText(localStorage)).toBe(before.local);
    expect(storedText(sessionStorage)).toBe(before.session);
    expect(`${storedText(localStorage)}\n${storedText(sessionStorage)}`).not.toContain(SYNTHETIC_NAME);
  });

  it("forgets the pack from memory when asked, leaving nothing behind", () => {
    rememberDowntimePack(takePack());
    forgetDowntimePack();
    expect(lastDowntimePack()).toBeNull();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
