import { describe, expect, it } from "vitest";
import { EventEmitter } from "node:events";
import { sharedModeEnvironment, sharedNextCommands, waitForChild } from "../scripts/ward-flow/shared-mode-support.mjs";
describe("production shared-mode runner", () => {
  const settings = {
    relativeRoot: ".next-playwright/shared-fixture",
    apiBaseUrl: "https://127.0.0.1:3201",
    authOrigin: "https://synthetic.invalid",
    publishableKey: "synthetic",
  };
  it("bakes shared flags and HTTPS into a provider-scrubbed production build", () => {
    const environment = sharedModeEnvironment(
      { OPENAI_API_KEY: "must-be-cleared", SENTRY_DSN: "must-be-cleared", WARD_GATE_BUILD: "1" },
      settings,
    );
    expect(environment).toMatchObject({
      NODE_ENV: "production",
      OPENAI_API_KEY: "",
      SENTRY_DSN: "",
      WARD_GATE_BUILD: "",
      NEXT_PUBLIC_WARD_SHARED_ENABLED: "true",
      NEXT_PUBLIC_DEMO_MODE: "false",
      NEXT_PUBLIC_WARD_API_BASE_URL: settings.apiBaseUrl,
    });
    expect(() => sharedModeEnvironment({}, { ...settings, apiBaseUrl: "http://127.0.0.1:3201" })).toThrow(/HTTPS/);
    expect(() => sharedModeEnvironment({}, { ...settings, apiBaseUrl: "https://hosted.invalid" })).toThrow(/HTTPS/);
  });
  it("builds with webpack before serving the compiled app", () => {
    expect(sharedNextCommands("next-cli", 3200)).toEqual({
      build: ["next-cli", "build", "--webpack"],
      start: ["next-cli", "start", "--hostname", "127.0.0.1", "--port", "3200"],
    });
  });
  it("does not accept a signalled or failed build as production evidence", async () => {
    const child = new EventEmitter();
    const result = waitForChild(child, "shared build");
    child.emit("close", null, "SIGTERM");
    await expect(result).rejects.toThrow(/shared build failed/);
  });
});
