import { afterEach, expect, it, vi } from "vitest";
import { browserErrorEvent, reportBrowserError } from "../src/components/ward-management/ward-client-errors";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("sends no diagnostic request while the feature is disabled", async () => {
  vi.stubEnv("NEXT_PUBLIC_WARD_CLIENT_ERROR_REPORTING", "false");
  const fetcher = vi.spyOn(globalThis, "fetch");
  await reportBrowserError(new Error("Synthetic disabled error"));
  expect(fetcher).not.toHaveBeenCalled();
});
it("keeps only a recognised class and built-asset coordinates before transmission", () => {
  const error = new TypeError("SYNTHETIC_PRIVATE_SENTINEL");
  error.stack =
    "TypeError: SYNTHETIC_PRIVATE_SENTINEL\n at handler (https://synthetic.invalid/_next/static/chunks/1234-abcd1234.js?note=SYNTHETIC_PRIVATE_SENTINEL:12:3)\n at https://synthetic.invalid/patients/SYNTHETIC_PRIVATE_SENTINEL:2:1";
  const event = browserErrorEvent(error);
  expect(JSON.stringify(event)).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
  expect(event.type).toBe("TypeError");
  expect(event.frames).toEqual([{ filename: "/_next/static/chunks/1234-abcd1234.js", lineno: 12, colno: 3 }]);
});
it("throttles repeated error classes and never retries a failed diagnostic request", async () => {
  vi.stubEnv("NEXT_PUBLIC_WARD_CLIENT_ERROR_REPORTING", "true");
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
  const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Offline synthetic collector"));
  const error = new RangeError("SYNTHETIC_PRIVATE_SENTINEL");
  await reportBrowserError(error);
  await reportBrowserError(new RangeError("A different synthetic message"));
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe("/api/client-error");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: "same-origin", redirect: "error" });
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain("SYNTHETIC_PRIVATE_SENTINEL");
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ type: "RangeError", frames: [] });
  clock.mockReturnValue(301_001);
  await reportBrowserError(error);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
