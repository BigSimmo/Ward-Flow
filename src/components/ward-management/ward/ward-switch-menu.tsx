"use client";

// My ward's Switch ward chip and its list (redesign approved 31 Oct 2026). It keeps today's rules:
// the wards it lists are the caller's (the same hospital, or the health service when the hospital has
// no other ward this desk can open), and choosing one goes to that ward's page. New: this ward sits at
// the top, ticked, and each ward shows its cohort, security and "n of N ready", from the Wards page's
// own figures. Desktop: a popover under the chip. Phone: a bottom sheet.

import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import type { Unit } from "@/components/ward-management/ward-model";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { ShowMoreRow } from "@/components/ward-redesign/parts/show-more-row";
import { Button, OverlayPortal } from "@/components/wf";

import styles from "./ward-switch-menu.module.css";

/** Rows shown under "Elsewhere" before Show more (owner rule: long lists show the first rows). */
const FIRST_ROWS = 6;

export function WardSwitchMenu({
  unit,
  switchUnits,
  onChoose,
}: {
  /** The ward this page shows. */
  unit: Unit;
  /** The other wards this desk may switch to, already filtered by today's access rule. */
  switchUnits: readonly Unit[];
  /** Goes to the chosen ward's page. */
  onChoose: (unitId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Switch ward, now ${unit.name}`}
        data-testid="ward-switch-btn"
        onClick={() => setOpen((was) => !was)}
      >
        <span>Switch ward</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <WardSwitchPanel
          unit={unit}
          switchUnits={switchUnits}
          triggerRef={triggerRef}
          onClose={(returnFocus) => {
            setOpen(false);
            if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
          }}
          onChoose={(id, name) => {
            setOpen(false);
            announceToWardShell(`${name}.`);
            onChoose(id);
          }}
        />
      ) : null}
    </>
  );
}

function WardSwitchPanel({
  unit,
  switchUnits,
  triggerRef,
  onClose,
  onChoose,
}: {
  unit: Unit;
  switchUnits: readonly Unit[];
  triggerRef: RefObject<HTMLButtonElement | null>;
  onClose: (returnFocus: boolean) => void;
  onChoose: (unitId: string, name: string) => void;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const network = useWardNetwork();
  const { units, bedReleases, admissions, leaveBeds, now } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "now",
  );
  const [showAll, setShowAll] = useState(false);
  const figures = useMemo(
    () =>
      new Map(
        hubEntries({ units, bedReleases, admissions, leaveBeds, now, sites: network.sites })
          .filter((entry) => entry.kind === "ward")
          .map((entry) => [entry.id, entry]),
      ),
    [units, bedReleases, admissions, leaveBeds, now, network],
  );

  // Desktop: the popover opens under the chip, kept on screen.
  useLayoutEffect(() => {
    const node = panel.current;
    if (!node) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    node.style.setProperty("--pick-top", `${rect ? rect.bottom + 8 : 120}px`);
    node.style.setProperty("--pick-left", `${Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - 408))}px`);
    node.dataset.placed = "";
  }, [triggerRef]);

  // The latest close handler, so a re-render of the page behind never re-runs the effects below.
  const closeRef = useRef(onClose);
  useLayoutEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>(`.${styles.list} button`)?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current(true);
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panel.current?.contains(target) || triggerRef.current?.contains(target)) return;
      closeRef.current(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [triggerRef]);

  const service = unitHealthService(unit);
  const sameSite = switchUnits.filter((candidate) => candidate.siteCode === unit.siteCode);
  const elsewhere = switchUnits.filter((candidate) => candidate.siteCode !== unit.siteCode);
  const shownElsewhere = showAll ? elsewhere : elsewhere.slice(0, FIRST_ROWS);
  const siteName = figures.get(unit.id)?.site ?? unit.siteCode;

  const row = (candidate: Unit, here = false) => {
    const figure = figures.get(candidate.id);
    // The hospital is named only for a ward on another site; its group heading names this one's.
    const otherSite = candidate.siteCode !== unit.siteCode;
    // A ward whose name already ends in its security ("Adult Open") does not say it twice.
    const security =
      figure?.security && !candidate.name.toLowerCase().endsWith(figure.security.toLowerCase())
        ? figure.security
        : null;
    const detail = [candidate.cohort, security, otherSite ? figure?.site : null].filter(Boolean).join(" · ");
    const ready = figure?.ready ?? 0;
    const body = (
      <>
        <span className={styles.text}>
          <span className={styles.name}>{candidate.name}</span>
          <span className={styles.detail}>{detail}</span>
        </span>
        <span className={styles.ready} data-none={ready === 0 || undefined}>
          <b>{ready}</b> of {figure?.beds ?? candidate.beds} ready
        </span>
        {here ? <Check aria-hidden="true" className={styles.check} strokeWidth={2} /> : null}
      </>
    );
    return (
      <li key={candidate.id}>
        {here ? (
          <span className={styles.row} aria-current="page">
            {body}
            <span className="sr-only">, you are here</span>
          </span>
        ) : (
          <button type="button" className={styles.row} onClick={() => onChoose(candidate.id, candidate.name)}>
            {body}
          </button>
        )}
      </li>
    );
  };

  return (
    <OverlayPortal layer="popover" name="ward-switcher">
      <div className={styles.scrim} aria-hidden="true" />
      <div ref={panel} className={styles.panel} role="dialog" aria-labelledby={titleId} data-testid="ward-switch-menu">
        <header className={styles.head}>
          <strong id={titleId}>Switch ward</strong>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            icon={X}
            aria-label="Close Switch ward"
            onClick={() => onClose(true)}
          />
        </header>
        <div className={styles.scroll}>
          <ul className={styles.list} aria-label="This ward">
            {row(unit, true)}
          </ul>
          {sameSite.length > 0 ? (
            <section aria-label={`At ${siteName}`}>
              <p className={styles.group}>At {siteName}</p>
              <ul className={styles.list}>{sameSite.map((candidate) => row(candidate))}</ul>
            </section>
          ) : null}
          {elsewhere.length > 0 ? (
            <section aria-label={`Elsewhere in ${service ?? "this service"}`}>
              <p className={styles.group}>Elsewhere in {service ?? "this service"}</p>
              <ul className={styles.list}>{shownElsewhere.map((candidate) => row(candidate))}</ul>
              {elsewhere.length > FIRST_ROWS ? (
                <ShowMoreRow expanded={showAll} onClick={() => setShowAll((was) => !was)}>
                  {showAll ? "Show fewer" : `Show ${elsewhere.length - FIRST_ROWS} more`}
                </ShowMoreRow>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
