"use client";

/**
 * "What to cover" lives as the first tab of the How to drawer (one help panel, not two). The two
 * notes (Assessment and the risk plan) each register their heading handler here; the one drawer in
 * the form calls the handler of the guide that opened it, so a tapped heading still lands in the
 * right note and puts the cursor under it.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";

export type GuideId = "note" | "rp";

type GuideRegistry = {
  /** Opens the drawer on What to cover for this guide. */
  open: (id: GuideId) => void;
  /** Registers a note's heading handler; returns the way to unregister it. */
  register: (id: GuideId, onHeading: (heading: string) => void) => () => void;
  /** Adds a heading to the note of this guide. */
  insert: (id: GuideId, heading: string) => void;
};

const GuideContext = createContext<GuideRegistry | null>(null);

export function TriageGuideProvider({ onOpen, children }: { onOpen: (id: GuideId) => void; children: ReactNode }) {
  const handlers = useRef<Partial<Record<GuideId, (heading: string) => void>>>({});
  const openRef = useRef(onOpen);
  useEffect(() => {
    openRef.current = onOpen;
  });
  const value = useMemo<GuideRegistry>(
    () => ({
      open: (id) => openRef.current(id),
      register: (id, onHeading) => {
        handlers.current[id] = onHeading;
        return () => {
          if (handlers.current[id] === onHeading) delete handlers.current[id];
        };
      },
      insert: (id, heading) => handlers.current[id]?.(heading),
    }),
    [],
  );
  return <GuideContext.Provider value={value}>{children}</GuideContext.Provider>;
}

export function useTriageGuides(): GuideRegistry | null {
  return useContext(GuideContext);
}
