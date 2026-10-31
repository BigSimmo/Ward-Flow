"use client";

import type { ReactNode } from "react";

import { HelpFlow } from "./help-flow";

/**
 * The Help mock-up, drawn over its page. `page` is the page it opens over. Final round (D-91): the
 * sidebar's Help opens on How do I…, with this screen's tasks first. Show me lights the control on the
 * page behind; Take the tour runs the tour mock-up; Keyboard shortcuts opens the shortcuts mock-up.
 */
export function PopHelp({ page }: { page: ReactNode }) {
  return (
    <>
      {page}
      <HelpFlow initial={{ kind: "help", view: "tasks" }} />
    </>
  );
}
