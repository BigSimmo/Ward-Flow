"use client";

import { useState } from "react";

import { ShortcutsSheet } from "@/components/ward-redesign/pop-shortcuts/shortcuts-sheet";
import { TourMock } from "@/components/ward-redesign/pop-tour/tour";

import { HelpSheet, type MockHelpView } from "./help-sheet";
import { HelpShowMe } from "./help-show-me";

export type HelpOpen =
  | { kind: "help"; view: MockHelpView; task?: string }
  | { kind: "show-me"; id: string }
  | { kind: "tour" }
  | { kind: "shortcuts" }
  | null;

/**
 * Help and everything it opens, for the mock-ups: the Help sheet, Show me over the page, the tour and
 * the shortcuts sheet, one at a time, as `WardHelpHost` swaps them in the app. Show me's Back to Help
 * returns to How do I… with its task open; the tour's last step and the shortcuts' More in Help lead
 * back into Help. `onDone` hears when the last of them closes.
 */
export function HelpFlow({ initial, onDone }: { initial: HelpOpen; onDone?: () => void }) {
  const [open, setOpenState] = useState<HelpOpen>(initial);
  const setOpen = (next: HelpOpen) => {
    setOpenState(next);
    if (!next) onDone?.();
  };
  const close = () => setOpen(null);
  if (!open) return null;
  if (open.kind === "tour") {
    return <TourMock onClose={close} onTasks={() => setOpen({ kind: "help", view: "tasks" })} />;
  }
  if (open.kind === "shortcuts") {
    return <ShortcutsSheet onClose={close} onHelp={() => setOpen({ kind: "help", view: "screen" })} />;
  }
  if (open.kind === "show-me") {
    return (
      <HelpShowMe
        key={open.id}
        id={open.id}
        onClose={close}
        onBack={() => setOpen({ kind: "help", view: "tasks", task: open.id })}
      />
    );
  }
  return (
    <HelpSheet
      view={open.view}
      openTask={open.task}
      onView={(view) => setOpen({ kind: "help", view })}
      onClose={close}
      onTour={() => setOpen({ kind: "tour" })}
      onShortcuts={() => setOpen({ kind: "shortcuts" })}
      onShowMe={(id) => setOpen({ kind: "show-me", id })}
    />
  );
}
