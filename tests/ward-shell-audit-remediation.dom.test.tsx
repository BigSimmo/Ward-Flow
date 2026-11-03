import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/wf/dialog";
import { Menu } from "@/components/wf/menu";
import { Sheet } from "@/components/wf/sheet";
import { bedMeetingAgenda } from "@/components/ward-management/bed-meeting/bed-meeting-agenda";
import { seedWardFlowState } from "@/components/ward-management/ward-flow-reducer";
import type { Movement } from "@/components/ward-management/ward-model";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("agenda physical presence", () => {
  it("includes pulled people still in ED and excludes other origins, outcomes and departures", () => {
    const seed = seedWardFlowState();
    const template = seed.movements.find((movement) => movement.originEdId !== undefined)!;
    expect(template).toBeDefined();
    const waiting: Movement = {
      ...template,
      id: "WF-audit-wait",
      sourceAdmissionId: undefined,
      closure: undefined,
      edOutcome: undefined,
      leftDepartmentAt: undefined,
      transport: undefined,
      stageChanges: [],
      stage: "pulled",
      openedAt: NOW_ANCHOR - 200,
    };
    const movements: Movement[] = [
      waiting,
      { ...waiting, id: "WF-audit-community", originEdId: undefined, stage: "placement_requested" },
      { ...waiting, id: "WF-audit-transfer", sourceAdmissionId: "audit-stay", stage: "placement_requested" },
      { ...waiting, id: "WF-audit-outcome", edOutcome: "for_discharge", stage: "placement_requested" },
      { ...waiting, id: "WF-audit-left", leftDepartmentAt: NOW_ANCHOR - 10, stage: "placement_requested" },
      {
        ...waiting,
        id: "WF-audit-moving",
        stage: "placement_requested",
        stageChanges: [{ to: "moving", at: NOW_ANCHOR - 10, by: "officer" }],
      },
    ];
    expect(bedMeetingAgenda({ ...seed, movements }, NOW_ANCHOR)[0]!.items.map((item) => item.subject.id)).toEqual([
      waiting.id,
    ]);
  });

  it("reports the full population while keeping only the oldest five rows", () => {
    const seed = seedWardFlowState();
    const template = seed.movements.find((movement) => movement.originEdId !== undefined)!;
    const movements: Movement[] = Array.from({ length: 8 }, (_, index) => ({
      ...template,
      id: `WF-audit-wait-${index}`,
      openedAt: NOW_ANCHOR - index,
      sourceAdmissionId: undefined,
      closure: undefined,
      edOutcome: undefined,
      leftDepartmentAt: undefined,
      transport: undefined,
      stageChanges: [],
      stage: "placement_requested",
    }));
    const section = bedMeetingAgenda({ ...seed, movements }, NOW_ANCHOR)[0]!;
    expect(section.items.map((item) => item.subject.id)).toEqual(
      movements
        .slice(3)
        .reverse()
        .map((item) => item.id),
    );
    expect(section).toHaveProperty("total", 8);
  });
});

it("cancels an interrupted Sheet drag without dismissing, then permits a normal dismissal", () => {
  const close = vi.fn();
  render(
    <Sheet open title="Audit sheet" onClose={close}>
      <button type="button">Inside</button>
    </Sheet>,
  );
  const panel = screen.getByRole("dialog");
  const grip = panel.querySelector<HTMLElement>('div[aria-hidden="true"]')!;
  expect(grip).not.toBeNull();
  grip.setPointerCapture = vi.fn();
  const pointer = (type: string, clientY: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientY });
    Object.defineProperty(event, "pointerId", { value: 1 });
    fireEvent(grip, event);
  };
  pointer("pointerdown", 100);
  pointer("pointermove", 300);
  pointer("pointercancel", 300);
  expect(close).not.toHaveBeenCalled();
  expect(panel.style.transform).toBe("");
  pointer("pointerdown", 100);
  pointer("pointerup", 300);
  expect(close).toHaveBeenCalledTimes(1);
});

it.each([false, true])("closes a menu on Tab inside a modal without losing focus, reverse=%s", (reverse) => {
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockImplementation(function () {
    return Object.assign([new DOMRect(0, 0, 100, 20)], { item: () => new DOMRect(0, 0, 100, 20) });
  });
  render(
    <Dialog open title="Audit dialog" onClose={() => {}}>
      <button type="button">Before</button>
      <Menu
        label="Audit choices"
        items={[
          { id: "first", label: "First", onSelect: () => {} },
          { id: "second", label: "Second", onSelect: () => {} },
        ]}
        trigger={(props) => (
          <button type="button" {...props}>
            Options
          </button>
        )}
      />
      <button type="button">After</button>
    </Dialog>,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: "Options" }), { key: "ArrowDown" });
  const item = screen.getByRole("menuitem", { name: "First" });
  item.focus();
  fireEvent.keyDown(item, { key: "Tab", shiftKey: reverse });
  expect(screen.queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: reverse ? "Options" : "After" }));
});
