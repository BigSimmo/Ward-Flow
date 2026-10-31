"use client";

import { useState, type ReactNode } from "react";

import { ShortcutsSheet } from "./shortcuts-sheet";

/**
 * The Keyboard shortcuts mock-up, drawn over its page. `page` is the page it opens over. In the app
 * "?" opens it from any screen (`WardHelpHost`); here it opens on load.
 */
export function PopShortcuts({ page }: { page: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      {page}
      {open ? <ShortcutsSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}
