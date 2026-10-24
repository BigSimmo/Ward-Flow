import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APT_ARCHIVES, collectArchives, seedArchives } from "../scripts/ward-ci-public/apt-archive-cache.mjs";

const dir = (files: string[] = []) => {
  const path = mkdtempSync(join(tmpdir(), "ward-apt-"));
  for (const name of files) writeFileSync(join(path, name), name);
  return path;
};

describe("release gate system package cache", () => {
  it("keeps downloads and seeds only cached .deb files into apt's archive", () => {
    const cache = dir(["libflite1.deb", "notes.txt"]);
    const calls: [string, string[], string | undefined][] = [];
    const status = seedArchives(cache, {
      log: () => {},
      run(command, args, input) {
        calls.push([command, args, input]);
        return { status: 0 };
      },
    });
    expect(status).toBe(0);
    expect(calls[0][0]).toBe("tee");
    expect(calls[0][2]).toContain('APT::Keep-Downloaded-Packages "true";');
    expect(calls[1]).toEqual(["cp", ["-t", APT_ARCHIVES, join(cache, "libflite1.deb")], undefined]);
  });

  it("seeds nothing on a cold cache and fails when apt cannot be configured", () => {
    const run = (command: string) => ({ status: command === "tee" ? 0 : 1 });
    expect(seedArchives(join(tmpdir(), "ward-apt-missing"), { log: () => {}, run })).toBe(0);
    expect(seedArchives(dir(), { log: () => {}, run: () => ({ status: 1 }) })).toBe(1);
  });

  it("collects what apt fetched and reports the count for the save step", () => {
    const archives = dir(["libavcodec60.deb", "lock"]);
    const cache = join(dir(), "out");
    const output = join(dir(), "github-output");
    writeFileSync(output, "");
    expect(collectArchives(cache, { archives, log: () => {}, output })).toBe(0);
    expect(readdirSync(cache)).toEqual(["libavcodec60.deb"]);
    expect(readFileSync(output, "utf8")).toBe("count=1\n");
  });
});
