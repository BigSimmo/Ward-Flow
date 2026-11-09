"use client";

// The layout's Quick bar slot (Josh, 8-9 Nov 2026). The Quick bar's code loads only on the desk's
// home, where it is drawn, so no other page's first download grows (9 Nov 2026 budget check).
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { HeroFootSlotProvider } from "@/components/wf";
import { useDeskHomeHref } from "@/components/ward-management/shell/ward-access";

const WardQuickHeroSlot = dynamic(() => import("./ward-quick-bar").then((m) => m.WardQuickHeroSlot));

function QuickSlotOnHome() {
  const pathname = usePathname();
  const home = useDeskHomeHref();
  return pathname === home ? <WardQuickHeroSlot /> : null;
}

export function WardQuickHeroProvider({ children }: { children: ReactNode }) {
  return <HeroFootSlotProvider value={<QuickSlotOnHome />}>{children}</HeroFootSlotProvider>;
}
