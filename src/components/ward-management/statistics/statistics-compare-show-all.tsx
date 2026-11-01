"use client";

import { ChevronRight } from "lucide-react";

import { Button } from "@/components/wf";
import redesign from "@/components/ward-redesign/statistics/statistics-redesign.module.css";

import compare from "./statistics-compare.module.css";

/** each chart lists its first eight rows, the rest behind Show all. */
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

/** The card foot's "Show all 22" (statistics redesign, Josh 1 Nov 2026): a link-styled toggle. */
export function ShowAllLink({ total, showAll, onToggle }: { total: number; showAll: boolean; onToggle: () => void }) {
  if (total <= FIRST_ROWS) return null;
  return (
    <button type="button" className={redesign.link} aria-expanded={showAll} onClick={onToggle}>
      {showAll ? "Show fewer" : `Show all ${total}`}
      <ChevronRight size={14} aria-hidden="true" />
    </button>
  );
}
