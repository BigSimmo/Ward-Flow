import { type Page, type TestInfo } from "playwright/test";

/** Chromium-only advisory: timings never decide whether a journey passed. Synthetic counts only. */
export async function attachBusyPhoneBaseline(page: Page, info: TestInfo) {
  const session = await page.context().newCDPSession(page);
  const previousViewport = page.viewportSize();
  await page.setViewportSize({ width: 390, height: 844 });
  await session.send("Network.enable");
  await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await session.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 200_000,
    uploadThroughput: 93_750,
  });
  let phase = "navigation";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const measure = async () => {
      const snapshot = page
        .waitForResponse(
          (response) => {
            const url = new URL(response.url());
            return url.pathname === "/v1/workspace" && !url.searchParams.has("since") && response.ok();
          },
          { timeout: 25_000 },
        )
        .catch(() => null);
      const started = performance.now();
      await page.goto("/ward-flow", { waitUntil: "domcontentloaded" });
      phase = "full workspace response";
      const response = await snapshot;
      if (!response) throw new Error("Full workspace response unavailable");
      phase = "workspace payload";
      const state = (await response.json()).snapshot?.payload?.state;
      const fixture = {
        movements: Array.isArray(state?.movements) ? state.movements.length : null,
        admissions: Array.isArray(state?.admissions) ? state.admissions.length : null,
        units: Array.isArray(state?.units) ? state.units.length : null,
      };
      phase = "usable coordinator screen";
      await page.getByTestId("ward-coordinator").waitFor({ state: "visible" });
      await page
        .getByTestId("ward-shared-status-bar")
        .filter({ hasText: "Coordinator · shared synthetic workspace" })
        .waitFor();
      const usableMs = performance.now() - started;
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        const paints = performance.getEntriesByType("paint");
        return {
          domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
          loadMs: nav?.loadEventEnd || null,
          firstContentfulPaintMs: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null,
          transferBytes: nav?.transferSize ?? null,
        };
      });
      await info.attach("slow-phone advisory baseline", {
        body: JSON.stringify(
          {
            measuredAt: new Date().toISOString(),
            browser: "pinned Chromium",
            viewport: "390x844",
            cpuSlowdown: 4,
            latencyMs: 150,
            downloadBytesPerSecond: 200_000,
            uploadBytesPerSecond: 93_750,
            fixture,
            busyFixture: (fixture.movements ?? 0) >= 20,
            usableMs,
            ...timing,
            limitation:
              "Desktop CPU and network emulation; warm local server; no physical-device or absolute speed verdict.",
          },
          null,
          2,
        ),
        contentType: "application/json",
      });
    };
    await Promise.race([
      measure(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Measurement deadline")), 25_000);
      }),
    ]);
  } catch {
    await info.attach("slow-phone advisory unavailable", {
      body: JSON.stringify(
        {
          measuredAt: new Date().toISOString(),
          available: false,
          phase,
          limitMs: 25_000,
          reason: "The local measurement did not complete within its bounded attempt. No speed verdict is available.",
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  } finally {
    clearTimeout(timer);
    await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await session.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    await session.detach();
    if (previousViewport) await page.setViewportSize(previousViewport);
  }
}
