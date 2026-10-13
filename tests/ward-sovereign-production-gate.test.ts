// shell-20 (Josh, 13 Oct 2026): the design showcase is a developer reference only. Production
// builds answer not found; development keeps it.
import { afterEach, describe, expect, it, vi } from "vitest";

const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/navigation", () => ({ notFound }));

import SovereignShowcasePage from "@/app/mockups/ward-flow/sovereign/page";

afterEach(() => {
  vi.unstubAllEnvs();
  notFound.mockClear();
});

describe("/sovereign production gate", () => {
  it("answers not found in a production build", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WARD_FLOW_SHOWCASE", "");
    expect(() => SovereignShowcasePage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("answers not found when NODE_ENV is unset", () => {
    vi.stubEnv("NODE_ENV", undefined);
    vi.stubEnv("WARD_FLOW_SHOWCASE", "");
    expect(() => SovereignShowcasePage()).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("renders in the offline test build, which alone sets WARD_FLOW_SHOWCASE", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WARD_FLOW_SHOWCASE", "1");
    expect(SovereignShowcasePage()).not.toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("still renders in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(SovereignShowcasePage()).not.toBeNull();
    expect(notFound).not.toHaveBeenCalled();
  });
});
