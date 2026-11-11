import { describe, expect, it } from "vitest";

import {
  TV_CHANGE_MARK_MINUTES,
  nextTvChangeMarks,
  tvChangeMarkText,
} from "@/components/ward-management/bed-meeting/tv-change-marks";

/** Plan item 43 (D-137): a TV tile whose figure changed says when, for 15 minutes, then the mark goes. */
const AT = 14 * 60 + 32; // 14:32 on the app's clock

describe("TV change marks", () => {
  it("shows for 15 minutes, as Josh ruled (D-137)", () => {
    expect(TV_CHANGE_MARK_MINUTES).toBe(15);
  });

  it("shows nothing on first sight: there is nothing to compare against", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3, asked: 1 }, AT, false);
    expect(tvChangeMarkText(first, "ready", AT)).toBeNull();
    expect(tvChangeMarkText(first, "asked", AT)).toBeNull();
  });

  it("marks a changed figure with the time it changed, and leaves an unchanged one alone", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3, asked: 1 }, AT - 5, false);
    const second = nextTvChangeMarks(first, "ward:a", { ready: 2, asked: 1 }, AT, false);
    expect(tvChangeMarkText(second, "ready", AT)).toBe("Changed 14:32");
    expect(tvChangeMarkText(second, "asked", AT)).toBeNull();
  });

  it("keeps the same marks object when nothing changed, so the screen does not re-render for it", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT, false);
    expect(nextTvChangeMarks(first, "ward:a", { ready: 3 }, AT + 1, false)).toBe(first);
  });

  it("stays until just before 15 minutes and clears at exactly 15", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT - 1, false);
    const marks = nextTvChangeMarks(first, "ward:a", { ready: 4 }, AT, false);
    expect(tvChangeMarkText(marks, "ready", AT + TV_CHANGE_MARK_MINUTES - 1)).toBe("Changed 14:32");
    expect(tvChangeMarkText(marks, "ready", AT + TV_CHANGE_MARK_MINUTES)).toBeNull();
    expect(tvChangeMarkText(marks, "ready", AT + TV_CHANGE_MARK_MINUTES + 60)).toBeNull();
  });

  it("restarts the time when the figure changes again", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT - 10, false);
    const once = nextTvChangeMarks(first, "ward:a", { ready: 4 }, AT - 10, false);
    const twice = nextTvChangeMarks(once, "ward:a", { ready: 5 }, AT, false);
    expect(tvChangeMarkText(twice, "ready", AT + 10)).toBe("Changed 14:32");
  });

  it("records no change while the screen is frozen", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT, false);
    const frozen = nextTvChangeMarks(first, "ward:a", { ready: 9 }, AT + 2, true);
    expect(frozen).toBe(first);
    expect(tvChangeMarkText(frozen, "ready", AT + 2)).toBeNull();
  });

  it("starts again with no marks on another screen or scenario", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT, false);
    const other = nextTvChangeMarks(first, "ward:b", { ready: 7 }, AT + 1, false);
    expect(tvChangeMarkText(other, "ready", AT + 1)).toBeNull();
  });

  it("starts again with no marks when the screen changes while frozen", () => {
    const first = nextTvChangeMarks(null, "ward:a", { ready: 3 }, AT - 1, false);
    const marked = nextTvChangeMarks(first, "ward:a", { ready: 4 }, AT, false);
    const other = nextTvChangeMarks(marked, "ward:b", { ready: 7 }, AT + 1, true);
    expect(other.screen).toBe("ward:b");
    expect(tvChangeMarkText(other, "ready", AT + 1)).toBeNull();
  });

  it("formats the time on the app's 24 hour clock, wrapping past midnight", () => {
    const first = nextTvChangeMarks(null, "s", { ed: 1 }, 1440 + 9 * 60 + 5 - 1, false);
    const marks = nextTvChangeMarks(first, "s", { ed: 2 }, 1440 + 9 * 60 + 5, false);
    expect(tvChangeMarkText(marks, "ed", 1440 + 9 * 60 + 5)).toBe("Changed 09:05");
  });
});
