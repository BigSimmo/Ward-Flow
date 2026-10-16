import { Blob as NodeBlob, resolveObjectURL } from "node:buffer";
import { URL as NodeURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadCsv } from "@/components/ward-management/statistics/statistics-csv";
import { downloadBlob } from "@/lib/download-blob";

describe("download URL lifetime", () => {
  const urls: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    // The real Node blob registry lets us read the file while its URL is valid, then proves
    // cleanup actually makes it unavailable. No native Safari download is simulated here.
    vi.stubGlobal("URL", NodeURL);
    vi.stubGlobal("Blob", NodeBlob);
  });

  afterEach(() => {
    for (const url of urls.splice(0)) NodeURL.revokeObjectURL(url);
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps CSV contents readable at the click and in the next task, then releases the URL", async () => {
    let clickedContent: Promise<string> | undefined;
    let deferredContent: Promise<string> | undefined;
    let filename: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      urls.push(this.href);
      filename = this.download;
      clickedContent = resolveObjectURL(this.href)?.text();
      window.setTimeout(() => {
        deferredContent = resolveObjectURL(this.href)?.text();
      }, 0);
    });

    downloadCsv("synthetic-figures.csv", [
      ["Figure", "Value"],
      ["Ready", 3],
      ["=SUM(A1)", 1],
    ]);
    const expected = '"Figure","Value"\r\n"Ready","3"\r\n"\'=SUM(A1)","1"';
    expect(filename).toBe("synthetic-figures.csv");
    expect(await clickedContent).toBe(expected);
    await vi.advanceTimersByTimeAsync(0);
    expect(await deferredContent).toBe(expected);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(resolveObjectURL(urls[0]!)).toBeUndefined();
  });

  it("releases the file even when the browser rejects starting its download", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      urls.push(this.href);
      throw new Error("download unavailable");
    });

    expect(() => downloadCsv("synthetic-figures.csv", [["Ready", 3]])).toThrow("download unavailable");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(resolveObjectURL(urls[0]!)).toBeUndefined();
    expect(document.querySelector('a[download="synthetic-figures.csv"]')).toBeNull();
  });

  it("preserves JSON files and cleans up overlapping downloads independently", async () => {
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      urls.push(this.href);
      names.push(this.download);
      expect(document.body.contains(this)).toBe(true);
    });

    downloadBlob(new Blob(['{"synthetic":true}'], { type: "application/json" }), "scenario.json");
    await vi.advanceTimersByTimeAsync(500);
    downloadBlob(new Blob(['{"ready":3}'], { type: "application/json" }), "rules.json");
    expect(names).toEqual(["scenario.json", "rules.json"]);
    expect(await resolveObjectURL(urls[0]!)?.text()).toBe('{"synthetic":true}');
    expect(await resolveObjectURL(urls[1]!)?.text()).toBe('{"ready":3}');
    expect(resolveObjectURL(urls[1]!)?.type).toBe("application/json");
    expect(document.querySelector("a[download]")).toBeNull();
    await vi.advanceTimersByTimeAsync(500);
    expect(resolveObjectURL(urls[0]!)).toBeUndefined();
    expect(await resolveObjectURL(urls[1]!)?.text()).toBe('{"ready":3}');
    await vi.advanceTimersByTimeAsync(500);
    expect(resolveObjectURL(urls[1]!)).toBeUndefined();
  });

  it("uses the originating URL API for deferred cleanup after browser shims are restored", async () => {
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      urls.push(this.href);
    });
    downloadBlob(new Blob(["synthetic export"]), "synthetic.txt");
    vi.unstubAllGlobals();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(resolveObjectURL(urls[0]!)).toBeUndefined();
  });
});
