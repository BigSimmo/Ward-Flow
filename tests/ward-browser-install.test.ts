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

  it("falls back to the runner's own system packages when the apt mirror cannot be reached", () => {
    const commands: string[][] = [];
    expect(
      installChromium({
        cacheHit: true,
        log: () => {},
        execute(_command, args) {
          commands.push(args[0] === "-e" ? ["launch probe"] : args.slice(1));
          return { status: args[1] === "install-deps" ? 124 : 0 };
        },
      }),
    ).toBe(0);
    expect(commands).toEqual([
      ["install-deps", "chromium"],
      ["install-deps", "chromium"],
      ["install", "chromium"],
      ["launch probe"],
    ]);
  });

  it("on a cold runner installs the browser alone, and fails when it will not launch", () => {
    const commands: string[][] = [];
    expect(
      installChromium({
        log: () => {},
        execute(_command, args) {
          commands.push(args[0] === "-e" ? ["launch probe"] : args.slice(1));
          return { status: args.includes("--with-deps") || args[0] === "-e" ? 1 : 0 };
        },
      }),
    ).toBe(1);
    expect(commands).toEqual([
      ["install", "--with-deps", "chromium"],
      ["install", "--with-deps", "chromium"],
      ["install", "chromium"],
      ["launch probe"],
    ]);
  });

  it("does not fall back when the browser download itself fails", () => {
    expect(
      installChromium({
        cacheHit: true,
        log: () => {},
        execute: (_command, args) => ({ status: args[1] === "install" ? 1 : 0 }),
      }),
    ).toBe(1);
  });
});
