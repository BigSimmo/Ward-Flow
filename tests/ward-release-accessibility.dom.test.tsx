import { expect, it, vi } from "vitest";
import type { Page, TestInfo } from "playwright/test";
const analyze = vi.hoisted(() => vi.fn());
vi.mock("@axe-core/playwright", () => ({
  default: class {
    withTags() {
      return this;
    }
    disableRules() {
      return this;
    }
    withRules() {
      return this;
    }
    analyze() {
      return analyze();
    }
  },
}));
import { expectAccessible, waitForAccessibleReadiness } from "./helpers/ward-release-gate";
it("retains and fails the initial serious axe finding without a hidden retry", async () => {
  const violation = {
    id: "synthetic-serious",
    impact: "serious",
    help: "Synthetic failure",
    nodes: [{ target: ["button"] }],
  };
  analyze.mockResolvedValue({ violations: [] }).mockResolvedValueOnce({ violations: [violation] });
  const attach = vi.fn();
  const page = {
    evaluate: vi.fn().mockResolvedValue({ window: 0, column: 0 }),
    url: () => "http://localhost:3100/ward-flow",
    waitForTimeout: vi.fn(),
  } as unknown as Page;
  await expect(expectAccessible(page, { attach } as unknown as TestInfo, "initial scan")).rejects.toThrow(
    /accessibility violations/,
  );
  expect(analyze).toHaveBeenCalledTimes(2); // regular rules and the separate target-size scan
  expect(JSON.parse(attach.mock.calls[0][1].body).violations).toEqual([violation]);
  expect(page.waitForTimeout).not.toHaveBeenCalled();
});

it("waits for fonts, finite animation and stable layout before scanning", async () => {
  document.body.innerHTML = "<main></main>";
  let frames = 0;
  let animationComplete = false;
  const finished = Promise.resolve().then(() => {
    animationComplete = true;
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => [
      {
        playState: animationComplete ? "finished" : "running",
        effect: { getComputedTiming: () => ({ endTime: 100 }) },
        finished,
      },
    ],
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames += 1;
    queueMicrotask(() => callback(0));
    return frames;
  });
  const geometry = vi.spyOn(document.querySelector("main")!, "getBoundingClientRect").mockImplementation(() => {
    expect(animationComplete).toBe(true);
    // Frame 1 is the first rendering opportunity; geometry sampling starts at frame 2.
    return { x: frames === 2 ? 1 : 2, y: 0, width: 100, height: 100 } as DOMRect;
  });
  try {
    await waitForAccessibleReadiness({ evaluate: (callback: () => Promise<void>) => callback() } as unknown as Page);
    expect(geometry).toHaveBeenCalledTimes(5);
  } finally {
    vi.unstubAllGlobals();
    geometry.mockRestore();
  }
});

it("scans during the decorative undo countdown while waiting for toast entry motion", async () => {
  document.body.innerHTML =
    '<main></main><div data-undo="running"><span data-undo-bar aria-hidden="true"></span></div>';
  let entryComplete = false;
  let motionSamples = 0;
  let releaseEntry!: () => void;
  const entryFinished = new Promise<void>((resolve) => {
    releaseEntry = resolve;
  });
  const countdown = document.querySelector("[data-undo-bar]")!;
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => {
      motionSamples++;
      return [
        {
          playState: "running",
          effect: { target: countdown, getComputedTiming: () => ({ endTime: 8000 }) },
          // Never settles: readiness must observe the screen while Undo remains available.
          finished: new Promise(() => {}),
        },
        {
          get playState() {
            return entryComplete ? "finished" : "running";
          },
          effect: { target: countdown.parentElement, getComputedTiming: () => ({ endTime: 150 }) },
          finished: entryFinished.then(() => {
            entryComplete = true;
          }),
        },
      ];
    },
  });
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  vi.useFakeTimers();
  const frame = vi.fn((callback: FrameRequestCallback) => setTimeout(() => callback(0), 16));
  vi.stubGlobal("requestAnimationFrame", frame);
  const geometry = vi.spyOn(document.querySelector("main")!, "getBoundingClientRect");
  try {
    const readiness = waitForAccessibleReadiness({
      evaluate: (callback: () => Promise<void>) => callback(),
    } as unknown as Page);
    await vi.advanceTimersByTimeAsync(64);
    expect(motionSamples).toBeGreaterThan(0);
    expect(geometry).not.toHaveBeenCalled();
    releaseEntry();
    await vi.advanceTimersByTimeAsync(80);
    await readiness;
    expect(geometry).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
    geometry.mockRestore();
    vi.unstubAllGlobals();
  }
});

it.each([
  '<div data-undo="running"><span aria-hidden="true"></span></div>',
  '<div data-undo="running"><span data-undo-bar></span></div>',
  '<div><span data-undo-bar aria-hidden="true"></span></div>',
])("does not exempt finite motion without every countdown marker: %s", async (markup) => {
  document.body.innerHTML = markup;
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () => [
      {
        playState: "running",
        effect: { target: document.querySelector("span"), getComputedTiming: () => ({ endTime: 8000 }) },
        finished: new Promise(() => {}),
      },
    ],
  });
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(0), 16);
  });
  try {
    const readiness = waitForAccessibleReadiness({
      evaluate: (callback: () => Promise<void>) => callback(),
    } as unknown as Page);
    const rejected = expect(readiness).rejects.toThrow("Accessibility layout did not settle");
    // One frame to the first rendering opportunity, then the unchanged five-second budget.
    await vi.advanceTimersByTimeAsync(16 + 5000);
    await rejected;
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("starts the settle budget at the first rendered frame, not while a cold browser has not painted", async () => {
  document.body.innerHTML = "<main></main>";
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  Object.defineProperty(document, "getAnimations", { configurable: true, value: () => [] });
  vi.useFakeTimers();
  let frames = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    // The first frame arrives six seconds after load, later than the whole settle budget.
    return setTimeout(() => callback(0), frames++ === 0 ? 6000 : 16);
  });
  try {
    let settled = false;
    const readiness = waitForAccessibleReadiness({
      evaluate: (callback: () => Promise<void>) => callback(),
    } as unknown as Page).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(6000 + 16 * 4);
    await readiness;
    expect(settled).toBe(true);
  } finally {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

it("does not wait forever on a removed CSS transition's unsettled finished promise", async () => {
  document.body.innerHTML = "<main></main>";
  let frames = 0;
  Object.defineProperty(document, "fonts", { configurable: true, value: { ready: Promise.resolve() } });
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    value: () =>
      frames < 2
        ? [
            {
              playState: "running",
              effect: { getComputedTiming: () => ({ endTime: 150 }) },
              finished: new Promise(() => {}),
            },
          ]
        : [],
  });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames++;
    queueMicrotask(() => callback(0));
    return frames;
  });
  try {
    await waitForAccessibleReadiness({ evaluate: (callback: () => Promise<void>) => callback() } as unknown as Page);
    expect(frames).toBeGreaterThanOrEqual(5);
  } finally {
    vi.unstubAllGlobals();
  }
});
