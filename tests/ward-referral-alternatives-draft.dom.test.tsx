import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isAlternativeMarks } from "@/components/ward-management/referrals/referral-alternatives";
import { useReferralAlternatives } from "@/components/ward-management/referrals/use-referral-alternatives";

describe("alternatives to admission in the referral sheet (feature 26)", () => {
  it("starts again with no marks when another person is chosen, so answers never cross patients", () => {
    const { result, rerender } = renderHook(({ key }) => useReferralAlternatives(true, key, null), {
      initialProps: { key: "WF-001" },
    });
    act(() => result.current.setMark("crisis_team_home_visit", "declined"));
    expect(result.current.eventField).toEqual({
      alternativesConsidered: [{ option: "crisis_team_home_visit", outcome: "declined" }],
    });
    rerender({ key: "WF-002" });
    expect(result.current.marks).toEqual({});
    expect(result.current.eventField).toEqual({});
    expect(result.current.draftField).toEqual({});
  });

  it("brings a kept draft's marks back for its own person, and puts them in the draft", () => {
    const kept = { activePatientKey: "WF-001", alternatives: { short_stay_unit: "tried" as const } };
    const { result } = renderHook(() => useReferralAlternatives(true, "WF-001", kept));
    expect(result.current.marks).toEqual({ short_stay_unit: "tried" });
    expect(result.current.draftField).toEqual({ alternatives: { short_stay_unit: "tried" } });
  });

  it("accepts only listed options with listed outcomes in a kept draft", () => {
    expect(isAlternativeMarks({ crisis_team_home_visit: "tried" })).toBe(true);
    expect(isAlternativeMarks({})).toBe(true);
    expect(isAlternativeMarks({ crisis_team_home_visit: "maybe" })).toBe(false);
    expect(isAlternativeMarks({ invented_service: "tried" })).toBe(false);
    expect(isAlternativeMarks([])).toBe(false);
  });
});
