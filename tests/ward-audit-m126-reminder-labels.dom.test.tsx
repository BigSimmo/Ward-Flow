import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR, allEmergencyDepartments } from "@/components/ward-management/ward-sites";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import { ToolRemindMe } from "@/components/ward-management/tools/ward-tool-remind-me";

/*
 * Audit M126, GNG row C3: Tools reminders keep a target label in localStorage, which outlives the
 * tab. The label must be place or bed text only. This sets a reminder on every open movement shown
 * (the target kind that belongs to a person; ward and bed labels are place text by construction),
 * and checks the stored value holds no
 * part of any seeded patient's name or record number. Rows C1 and C4 are owned by another thread.
 */
vi.mock("next/navigation", () => ({
  usePathname: () => "/ward-flow/capacity",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const KEY = "wf-mock-tools-reminders";
const seed = seedWardFlowState();

// Place names are allowed in a label, so a given name that is also part of a hospital name
// ("Fiona" in Fiona Stanley Hospital) is not counted as a person.
const PLACE_TEXT = JSON.stringify([
  seed.units.map((u) => u.name),
  allEmergencyDepartments().map((ed) => ed.name),
]).toLowerCase();

function personTokens(): string[] {
  const tokens = new Set<string>();
  for (const patient of seed.patients) {
    if (patient.umrn) tokens.add(patient.umrn.toLowerCase());
    for (const part of [patient.givenName, patient.familyName])
      for (const word of String(part ?? "").split(/[\s'-]+/)) if (word.length >= 3) tokens.add(word.toLowerCase());
  }
  return [...tokens].filter((token) => !PLACE_TEXT.includes(token));
}

function leaks(stored: string): string[] {
  const lower = stored.toLowerCase();
  return personTokens().filter((token) => new RegExp(`(^|[^a-z0-9])${token}([^a-z0-9]|$)`).test(lower));
}

beforeEach(() => window.localStorage.clear());

describe("M126 C3: reminder labels hold place or bed text only", () => {
  it("a movement reminder stores where the movement starts, never the person or record number", () => {
    render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <ToolRemindMe onNavigate={vi.fn()} />
      </WardFlowProvider>,
    );
    fireEvent.click(screen.getByRole("radio", { name: "Movement" }));
    const moves = within(screen.getByRole("list", { name: "Which movement" })).getAllByRole("button");
    expect(moves.length).toBeGreaterThan(0);
    // Every open movement shown, so a label built from any one of them is checked.
    for (const move of moves) {
      fireEvent.click(move);
      fireEvent.click(within(screen.getByRole("group", { name: "Reason" })).getByRole("button", { name: "Call back" }));
      fireEvent.click(screen.getByRole("button", { name: "Set reminder" }));
    }
    const stored = window.localStorage.getItem(KEY) ?? "";
    const saved: { kind: string; targetLabel: string }[] = JSON.parse(stored || "[]");
    expect(saved.filter((r) => r.kind === "movement").length).toBe(moves.length);
    for (const reminder of saved) expect(reminder.targetLabel).toMatch(/^Movement /);
    expect(leaks(stored)).toEqual([]);
  });

  it("the check can fail: a label with a seeded name in it is caught", () => {
    const patient = seed.patients.find((p) => !PLACE_TEXT.includes(p.familyName.toLowerCase()))!;
    expect(leaks(JSON.stringify([{ targetLabel: `Movement for ${patient.familyName}` }])).length).toBeGreaterThan(0);
    expect(leaks(JSON.stringify([{ targetLabel: `Movement for ${patient.umrn}` }])).length).toBeGreaterThan(0);
  });
});
