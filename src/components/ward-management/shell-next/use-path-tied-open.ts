"use client";

import { useCallback, useState } from "react";

/**
 * WF-42: open state tied to the path it was opened on. A route change clears it so Forward
 * cannot reopen the sheet; setOpen(true) on the new path opens fresh.
 */
export function usePathTiedOpen(pathname: string): [boolean, (open: boolean) => void] {
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [epoch, setEpoch] = useState(pathname);
  if (epoch !== pathname) {
    setEpoch(pathname);
    if (openPath !== null) setOpenPath(null);
  }
  const setOpen = useCallback((open: boolean) => setOpenPath(open ? pathname : null), [pathname]);
  return [openPath === pathname, setOpen];
}
