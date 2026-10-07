"use client";

import { Sheet, type SheetProps } from "@/components/ui/sheet";

export { Sheet, type SheetProps };

/**
 * v6 drawer: the shared `Sheet` (thick glass over a scrim, focus trap, Escape closes the top-most
 * sheet first) docked to the right on desktop and rising from the bottom on a phone. Same API as
 * `Sheet`; only the placement default differs.
 */
export function Drawer({ placement = "responsive-right", ...props }: SheetProps) {
  return <Sheet placement={placement} {...(props as SheetProps)} />;
}
