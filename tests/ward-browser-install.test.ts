import { describe, expect, it } from "vitest";
import { installChromium } from "../scripts/ward-ci-public/install-chromium.mjs";

describe("bounded release browser setup", () => {
  it("installs both required engines on a cold runner", () => {
    const commands: string[][] = [];
    expect(
      installChromium({
        browsers: ["chromium", "webkit"],
        log: () => {},
        execute(_command, args) {
          commands.push(args.slice(1));
          return { status: 0 };
        },
      }),
    ).toBe(0);
    expect(commands).toEqual([["install", "--with-deps", "chromium", "webkit"]]);
  });

  it("still checks both binaries and installs system dependencies after a cache hit", () => {
    const commands: string[][] = [];
    installChromium({
      browsers: ["chromium", "webkit"],
      cacheHit: true,
      log: () => {},
      execute(_command, args) {
        commands.push(args.slice(1));
        return { status: 0 };
      },
    });
    expect(commands).toEqual([
      ["install-deps", "chromium", "webkit"],
      ["install", "chromium", "webkit"],
    ]);
  });

  it("refuses an unsupported or empty engine selection without invoking a command", () => {
    const execute = () => {
      throw new Error("must not start an installation");
    };
    expect(() => installChromium({ browsers: [], execute })).toThrow(/browser selection/);
    expect(() => installChromium({ browsers: ["remote-engine"], execute })).toThrow(/browser selection/);
  });
});
