"use client";

import { Button } from "@/components/wf";

import compare from "./statistics-compare-redesign.module.css";

/** Redesign: each chart lists its first eight rows, the rest behind Show all. */
export const FIRST_ROWS = 8;

export function ShowAllRow({
  total,
  noun,
  showAll,
  onToggle,
}: {
  total: number;
  noun: string;
  showAll: boolean;
  onToggle: () => void;
}) {
  if (total <= FIRST_ROWS) return null;
  return (
    <p className={compare.showRow}>
      <span>
        Showing <b>{showAll ? total : FIRST_ROWS}</b> of {total} {noun}
      </span>
      <Button variant="ghost" size="sm" aria-expanded={showAll} onClick={onToggle}>
        {showAll ? "Show fewer" : `Show all ${total}`}
      </Button>
    </p>
  );
}
