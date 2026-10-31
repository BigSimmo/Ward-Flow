// Closing-the-loop features (24 Oct 2026, package E): "On-call directory last checked". Each entry
// says when it was last checked and by which desk, a factual note past the directory's threshold,
// and a check recorded now replaces the synthetic one. Contacts stay mocks.
import { describe, expect, it } from "vitest";

import {
  checkIsDue,
  lastCheckOf,
  lastCheckText,
  notCheckedNote,
  withRecordedChecks,
} from "@/components/ward-management/on-call/on-call-checks";
import { buildOnCallDirectory, CHECK_DUE_DAYS } from "@/components/ward-management/on-call/on-call-directory";
import { seedWardFlowState, wardFlowReducer } from "@/components/ward-management/ward-flow-reducer";
import { isValidStoredWardFlowState } from "@/components/ward-management/ward-flow-storage-validation";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

describe("on-call directory last checked", () => {
  const entries = buildOnCallDirectory();

  it("gives every seeded entry a desk and an age, and some entries are past the threshold in the demo", () => {
    expect(entries.every((entry) => entry.checkedBy && entry.checkedDaysAgo > 0)).toBe(true);
    const due = entries.filter((entry) => checkIsDue({ daysAgo: entry.checkedDaysAgo }));
    expect(due.length).toBeGreaterThan(0);
    const check = lastCheckOf(due[0]!, undefined, NOW_ANCHOR);
    expect(notCheckedNote(check)).toBe(`Not checked in over ${CHECK_DUE_DAYS} days`);
    expect(lastCheckText(check)).toMatch(/^Checked \d+ days ago by /);
  });

  it("records a check now with the desk, and the entry reads checked today with no note", () => {
    const entry = entries.find((candidate) => checkIsDue({ daysAgo: candidate.checkedDaysAgo }))!;
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_DIRECTORY_CHECK",
      role: "bed_manager",
      now: NOW_ANCHOR,
      entryId: entry.id,
    });
    expect(state.directoryChecks).toEqual([{ entryId: entry.id, at: NOW_ANCHOR, by: "bed_manager" }]);
    const updated = withRecordedChecks(entries, state.directoryChecks, NOW_ANCHOR);
    const after = updated.find((candidate) => candidate.id === entry.id)!;
    expect(after).toMatchObject({ checkedDaysAgo: 0, checkedBy: "bed_manager" });
    expect(lastCheckText(lastCheckOf(after, undefined, NOW_ANCHOR))).toBe("Checked today by Site bed manager");
    expect(notCheckedNote(lastCheckOf(after, undefined, NOW_ANCHOR))).toBeUndefined();
    // Order unchanged: the directory is never re-sorted by checks.
    expect(updated.map((candidate) => candidate.id)).toEqual(entries.map((candidate) => candidate.id));
    // A second check keeps one record per entry.
    const again = wardFlowReducer(state, {
      type: "RECORD_DIRECTORY_CHECK",
      role: "coordinator",
      now: NOW_ANCHOR + 5,
      entryId: entry.id,
    });
    expect(again.directoryChecks).toEqual([{ entryId: entry.id, at: NOW_ANCHOR + 5, by: "coordinator" }]);
    expect(isValidStoredWardFlowState(JSON.parse(JSON.stringify(again)))).toBe(true);
  });

  it("refuses an entry id that is not a short slug", () => {
    const state = wardFlowReducer(seedWardFlowState(), {
      type: "RECORD_DIRECTORY_CHECK",
      role: "coordinator",
      now: NOW_ANCHOR,
      entryId: "a name with spaces",
    });
    expect(state.directoryChecks ?? []).toEqual([]);
  });
});
