import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  downtimePack,
  forgetDowntimePack,
  lastDowntimePack,
  rememberDowntimePack,
} from "@/components/ward-management/reports/downtime-pack";
import { lastPackPrintedAt } from "@/components/ward-management/ward-downtime-pack-prints";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
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

/**
 * Batch 4 items 24 and 25 (Josh approved the drawing 11 Nov 2026, D-142): the screens outside
 * reports/ that read pack print times or the outage catch-up.
 */
const PACK_TIME_READERS = [
  // The print time record sits at the ward root, shared by the coordinator, ward and reports screens.
  "src/components/ward-management/ward-downtime-pack-prints.ts",
  "src/components/ward-management/use-outage-catch-up.ts",
  "src/components/ward-management/ward/ward-pack-printed-line.tsx",
  "src/components/ward-management/ward/ward-outage-catch-up-card.tsx",
  "src/components/ward-management/coordinator/home-outage-catch-up.tsx",
].map((path) => join(process.cwd(), path));

function downtimePackSources(): string[] {
  return [
    ...readdirSync(REPORTS_DIR)
      .filter((name) => /^(downtime-pack[\w.-]*|use-take-downtime-pack)\.tsx?$/u.test(name))
      .map((name) => join(REPORTS_DIR, name)),
    ...PACK_TIME_READERS,
  ];
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
    referrals: state.referrals,
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
    expect(names).toEqual(
      expect.arrayContaining([
        "downtime-pack.ts",
        "use-take-downtime-pack.ts",
        // Batch 4 item 24 (10 Nov 2026): the print time record and the hook that sends it.
        "ward-downtime-pack-prints.ts",
        "downtime-pack-print-hook.ts",
        // D-142 (11 Nov 2026): the old packs band, Record an outage, and their readers elsewhere.
        "downtime-pack-old-band.tsx",
        "downtime-pack-record-outage.tsx",
        "use-outage-catch-up.ts",
        "ward-pack-printed-line.tsx",
        "ward-outage-catch-up-card.tsx",
        "home-outage-catch-up.tsx",
      ]),
    );
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

  // Batch 4 item 24 (10 Nov 2026): the shared record keeps only when each ward's pack was printed.
  it("recording a print keeps ward ids and a time only, and writes nothing to the device", () => {
    const before = { local: storedText(localStorage), session: storedText(sessionStorage) };
    const pack = takePack();
    rememberDowntimePack(pack);
    const unitIds = pack.wards.map((ward) => ward.unitId);
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_DOWNTIME_PACK_PRINTED",
      role: "coordinator",
      now: NOW_ANCHOR,
      unitIds,
    });

    expect(lastPackPrintedAt(state.downtimePackPrints, unitIds[0]!)).toBe(NOW_ANCHOR);
    for (const record of state.downtimePackPrints ?? [])
      expect(Object.keys(record).sort()).toEqual(["at", "by", "unitId"]);
    expect(JSON.stringify(state.downtimePackPrints)).not.toContain(SYNTHETIC_NAME);
    expect(storedText(localStorage)).toBe(before.local);
    expect(storedText(sessionStorage)).toBe(before.session);
  });
});
