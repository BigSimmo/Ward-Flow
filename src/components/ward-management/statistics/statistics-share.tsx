"use client";

// One Share menu per Statistics page (simplification mock-up, 26 Nov 2026). Each output a page
// offers (the hero's figures, a chart's CSV, a printable report) registers here. They leave their own
// buttons and sit as items of one ghost "Share" menu at the right end of the tabs row, above the
// ticked Example history item (audit two #97). A desk with no tabs row keeps each direct button.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Clock, Copy, Download, Printer, Share2, type LucideIcon } from "lucide-react";

import { buttonClass, cx, folderTabClasses, type MenuItem } from "@/components/wf";
import { EarlyMenu } from "@/components/ward-management/menu-early";
import { setStatisticsSamples, useStatisticsSamples } from "./statistics-samples";

/** The item order in the menu: Copy, then each CSV, then Print. */
export type ShareKind = "copy" | "csv" | "print";

const KIND_ORDER: Record<ShareKind, number> = { copy: 0, csv: 1, print: 2 };
const KIND_ICON: Record<ShareKind, LucideIcon> = { copy: Copy, csv: Download, print: Printer };

type ShareEntry = {
  id: string;
  kind: ShareKind;
  label: string;
  order: number;
  disabled: boolean;
  /** The page always carries Share (Network: its views change which outputs exist, the menu stays). */
  pinned: boolean;
};

type ShareRegistry = {
  entries: ShareEntry[];
  register: (entry: ShareEntry, run: () => void) => () => void;
  run: (id: string) => void;
  /** How many Share menus are drawn; an output leaves its own button only when one is. */
  hosts: number;
  setHosts: (change: (count: number) => number) => void;
};

const ShareContext = createContext<ShareRegistry | null>(null);

// Audit two (#97, 27 Nov 2026): the Example history switch is a ticked item of the Share menu, so
// the menu is on every page whose tabs row draws it, and every output joins it (two items or more).

/** Holds every Statistics page's outputs; mounted once by the statistics layout. */
export function StatisticsShareProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ShareEntry[]>([]);
  const runs = useRef(new Map<string, () => void>());
  const register = useCallback((entry: ShareEntry, run: () => void) => {
    runs.current.set(entry.id, run);
    setEntries((current) => [...current.filter((each) => each.id !== entry.id), entry]);
    return () => {
      runs.current.delete(entry.id);
      setEntries((current) => current.filter((each) => each.id !== entry.id));
    };
  }, []);
  const run = useCallback((id: string) => runs.current.get(id)?.(), []);
  const [hosts, setHosts] = useState(0);
  const value = useMemo(() => ({ entries, register, run, hosts, setHosts }), [entries, register, run, hosts]);
  return <ShareContext.Provider value={value}>{children}</ShareContext.Provider>;
}

/**
 * Offers one output to the page's Share menu. Returns true when the menu carries it, so the owner
 * leaves its own button out; false (keep the button) on a single-output page or outside the layout.
 */
export function useShareOutput(
  output: { id: string; kind: ShareKind; label: string; order?: number; disabled?: boolean; pinned?: boolean } | null,
  run: () => void,
): boolean {
  const registry = useContext(ShareContext);
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  });
  const id = output?.id;
  const kind = output?.kind;
  const label = output?.label;
  const order = output?.order ?? 0;
  const disabled = output?.disabled ?? false;
  const pinned = output?.pinned ?? false;
  const register = registry?.register;
  useEffect(() => {
    if (!register || id === undefined || kind === undefined || label === undefined) return;
    return register({ id, kind, label, order, disabled, pinned }, () => runRef.current());
  }, [register, id, kind, label, order, disabled, pinned]);
  if (!registry || id === undefined) return false;
  return registry.hosts > 0 && registry.entries.some((entry) => entry.id === id);
}

/**
 * True when the tabs row draws the Share menu, so Example history is one of its items and a page
 * leaves out its own Example history chip. False on a desk with no tabs row (its own place only).
 */
export function useShareMenuHosted(): boolean {
  const registry = useContext(ShareContext);
  return Boolean(registry && registry.hosts > 0);
}

/** The ghost "Share" menu for the tabs row: the page's outputs, then Example history. */
export function StatisticsShareMenu() {
  const registry = useContext(ShareContext);
  const samples = useStatisticsSamples();
  const setHosts = registry?.setHosts;
  useEffect(() => {
    if (!setHosts) return;
    setHosts((count) => count + 1);
    return () => setHosts((count) => count - 1);
  }, [setHosts]);
  if (!registry) return null;
  const outputs: MenuItem[] = [...registry.entries]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.order - b.order || a.label.localeCompare(b.label))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      icon: KIND_ICON[entry.kind],
      disabled: entry.disabled,
      onSelect: () => {
        if (!entry.disabled) registry.run(entry.id);
      },
    }));
  const items: MenuItem[] = [
    ...outputs,
    ...(outputs.length > 0 ? [{ kind: "separator" as const, id: "history-rule" }] : []),
    {
      id: "history",
      label: "Example history",
      icon: Clock,
      checked: samples,
      closeOnSelect: true,
      onSelect: () => setStatisticsSamples(!samples),
    },
  ];
  return (
    <EarlyMenu
      label="Share"
      align="end"
      items={items}
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cx(buttonClass({ variant: "ghost", size: "sm" }), folderTabClasses.more)}
          data-testid="ward-statistics-share"
        >
          <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
          Share
        </button>
      )}
    />
  );
}
