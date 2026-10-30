"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";

import type { HelpView } from "@/components/ward-management/help/ward-help-events";
import { ShortcutsSheet } from "@/components/ward-redesign/pop-shortcuts/shortcuts-sheet";

import { HelpSheet } from "./help-sheet";

// The desk tour runs over the screen itself, as in the app; it loads only when asked for.
const WardTour = dynamic(() => import("@/components/ward-management/help/ward-tour").then((m) => m.WardTour));

type Open = { kind: "help"; view: HelpView } | { kind: "shortcuts" } | null;

/**
 * The Help mock-up, drawn over its page. `page` is the page it opens over. The rail's Help entry
 * opens This screen (`openWardHelp("screen")`), so this opens there. Take the tour runs the real
 * tour; Keyboard shortcuts opens the redesigned shortcuts sheet.
 */
export function PopHelp({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState<Open>({ kind: "help", view: "screen" });
  const close = () => setOpen(null);
  return (
    <>
      {page}
      {open?.kind === "help" && open.view === "tour" ? <WardTour onClose={close} /> : null}
      {open?.kind === "help" && open.view !== "tour" ? (
        <HelpSheet
          view={open.view}
          onView={(view) => setOpen({ kind: "help", view })}
          onClose={close}
          onShortcuts={() => setOpen({ kind: "shortcuts" })}
        />
      ) : null}
      {open?.kind === "shortcuts" ? <ShortcutsSheet onClose={close} /> : null}
    </>
  );
}
