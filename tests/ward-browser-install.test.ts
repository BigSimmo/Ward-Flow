import { describe, expect, it } from "vitest";
import { installChromium, withoutDowngrades } from "../scripts/ward-ci-public/install-chromium.mjs";

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

  it("installs cached system packages without the network and stops once every browser launches", () => {
    const commands: string[][] = [];
    expect(
      installChromium({
        browsers: ["chromium", "webkit"],
        cacheHit: true,
        cachedDebs: ["/var/cache/apt/archives/a.deb", "/var/cache/apt/archives/b.deb"],
        log: () => {},
        execute(command, args) {
          commands.push([command, ...args]);
          return { status: 0 };
        },
      }),
    ).toBe(0);
    expect(commands).toHaveLength(3);
    expect(commands[0]).toEqual([
      "sudo",
      "apt-get",
      "install",
      "-y",
      "--no-download",
      "--no-install-recommends",
      "/var/cache/apt/archives/a.deb",
      "/var/cache/apt/archives/b.deb",
    ]);
    expect(commands[1].slice(2)).toEqual(["install", "chromium", "webkit"]);
    expect(commands[2][1]).toBe("-e");
    expect(commands[2].slice(-2)).toEqual(["chromium", "webkit"]);
    expect(commands.flat()).not.toContain("install-deps");
    expect(commands.flat()).not.toContain("--with-deps");
  });

  it("falls back to the apt mirror when a browser does not launch after the offline install", () => {
    const commands: string[][] = [];
    expect(
      installChromium({
        cachedDebs: ["/var/cache/apt/archives/a.deb"],
        log: () => {},
        execute(command, args) {
          commands.push([command, ...args]);
          return { status: args[0] === "-e" ? 1 : 0 };
        },
      }),
    ).toBe(0);
    expect(commands).toHaveLength(4);
    expect(commands[3].slice(2)).toEqual(["install", "--with-deps", "chromium"]);
  });

  it("leaves out a cached package older than the installed one, so apt is never asked to downgrade", () => {
    const dir = "/var/cache/apt/archives";
    const installed = new Map([
      ["libnss3 amd64", "2:3.98-1build1"],
      ["fonts-liberation all", "1:1.07.4-11"],
    ]);
    const older = (a: string, b: string) => a < b;
    expect(
      withoutDowngrades(
        [
          `${dir}/libnss3_2%3a3.90-1_amd64.deb`,
          `${dir}/fonts-liberation_1%3a1.07.4-11_all.deb`,
          `${dir}/libwoff1_1.0.2-2build1_amd64.deb`,
        ],
        installed,
        older,
      ),
    ).toEqual([`${dir}/fonts-liberation_1%3a1.07.4-11_all.deb`, `${dir}/libwoff1_1.0.2-2build1_amd64.deb`]);
  });

  it("refuses an unsupported or empty engine selection without invoking a command", () => {
    const execute = () => {
      throw new Error("must not start an installation");
    };
    expect(() => installChromium({ browsers: [], execute })).toThrow(/browser selection/);
    expect(() => installChromium({ browsers: ["remote-engine"], execute })).toThrow(/browser selection/);
  });
});
