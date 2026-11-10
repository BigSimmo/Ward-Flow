"use client";

import { useState } from "react";

import type { Instant } from "@/components/ward-management/ward-clock";

import type { WardTvSheet } from "./tv-derivations";
import { nextTvChangeMarks, tvChangeMarkText, type TvChangeMarks, type TvTileFigure } from "./tv-change-marks";

/**
 * TV "changed at" marks (plan item 43, D-137): remembers each tile's figure from the last refresh and
 * gives the "Changed 14:32" line for a tile that changed. Adjusted during render, as the TV's own
 * frozen snapshot is, so no effect runs and the mark shows on the same paint as the new figure.
 */
export function useTvChangeMarks(
  screen: string,
  figures: Readonly<Record<string, TvTileFigure>>,
  now: Instant,
  frozen: boolean,
): (key: string) => string | null {
  const [marks, setMarks] = useState<TvChangeMarks | null>(null);
  const next = nextTvChangeMarks(marks, screen, figures, now, frozen);
  if (next !== marks) setMarks(next);
  return (key) => tvChangeMarkText(next, key, now);
}

/** The ward TV's five tiles, keyed as `WardTvView` asks for them. */
export function useWardTvChangeMarks(sheet: WardTvSheet, scenario: string, now: Instant, frozen: boolean) {
  const { capacity, incoming, discharges } = sheet;
  return useTvChangeMarks(
    `ward:${sheet.unit.id}:${scenario}`,
    {
      ready: capacity.ready,
      asked: sheet.askedCount,
      incoming: incoming.total,
      going: discharges.heldUp + discharges.confirmed + discharges.expected,
      overdue: sheet.overdue.length,
    },
    now,
    frozen,
  );
}

/** The mark itself: plain small text in the caller's own style. Nothing moves or flashes. */
export function TvChangeMark({ text, testId, className }: { text: string | null; testId: string; className?: string }) {
  if (text === null) return null;
  return (
    <span className={className} data-testid={testId} data-tv-change-mark="">
      {text}
    </span>
  );
}
