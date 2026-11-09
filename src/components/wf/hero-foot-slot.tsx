"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Something the shell adds at the foot of a page's band hero (Josh, 9 Nov 2026: the Quick bar sits
 * under the hero's act now row). Rendered in the hero's own tree, so the server and the browser draw
 * the same thing. A quiet or card hero leaves it out. Kept apart from the hero so the layout can
 * supply it without loading the hero's code on every page.
 */
const HeroFootSlotContext = createContext<ReactNode>(null);

export function HeroFootSlotProvider({ value, children }: { value: ReactNode; children: ReactNode }) {
  return <HeroFootSlotContext.Provider value={value}>{children}</HeroFootSlotContext.Provider>;
}

export function useHeroFootSlot(): ReactNode {
  return useContext(HeroFootSlotContext);
}
