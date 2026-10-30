"use client";

import { Check, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Button, OverlayPortal } from "@/components/wf";
import { hubEntries } from "@/components/ward-management/hub/hub-derivations";
import { useWardFlowSelect, useWardNetwork } from "@/components/ward-management/ward-flow-provider";
import { unitHealthService } from "@/components/ward-management/ward-service-scope";
import { useCanOpenHref } from "@/components/ward-management/shell/ward-access";
import { unitHref } from "@/components/ward-management/shell/ward-facade";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";

import styles from "./pop-ward-switcher.module.css";

/** The ward the My ward mock-up draws, used when the address does not name one. */
const FALLBACK_UNIT_ID = "rph-adult-secure";
/** Rows shown under "Elsewhere" before Show more (owner rule: long lists show the first rows). */
const FIRST_ROWS = 6;

/**
 * Mock-up of the My ward "Switch ward" menu (`wardSwitchMenu` in `ward/ward-screen.tsx`). The real
 * one lists only the other wards on the same hospital site, as bare names with a site code, or the
 * service's wards when the site has none. This keeps the same wards, access filter (`canOpenHref`)
 * and navigation (`router.push(unitHref(...))`), and adds: this ward at the top, ticked; the same
 * hospital first, then the rest of the health service under "Elsewhere in ..."; and each ward's
 * cohort, security and beds ready from `hubEntries`, the figures the Wards page shows.
 */
export function WardSwitcherMock({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const canOpenHref = useCanOpenHref();
  const network = useWardNetwork();
  const { units, bedReleases, admissions, leaveBeds, now } = useWardFlowSelect(
    "units",
    "bedReleases",
    "admissions",
    "leaveBeds",
    "now",
  );
  const [showAll, setShowAll] = useState(false);
  const currentId = /\/ward\/([^/?#]+)/u.exec(pathname)?.[1] ?? FALLBACK_UNIT_ID;
  const unit = units.find((candidate) => candidate.id === decodeURIComponent(currentId));

  const figures = useMemo(
    () =>
      new Map(
        hubEntries({ units, bedReleases, admissions, leaveBeds, now, sites: network.sites })
          .filter((entry) => entry.kind === "ward")
          .map((entry) => [entry.id, entry]),
      ),
    [units, bedReleases, admissions, leaveBeds, now, network],
  );

  useLayoutEffect(() => {
    let frame = 0;
    let tries = 0;
    const place = () => {
      const node = panel.current;
      if (!node) return;
      const trigger = document.querySelector('[data-testid="ward-switch-btn"]');
      const rect = trigger && trigger.getClientRects().length > 0 ? trigger.getBoundingClientRect() : null;
      node.style.setProperty("--pick-top", `${rect ? rect.bottom + 8 : 120}px`);
      node.style.setProperty("--pick-left", `${Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - 408))}px`);
      node.dataset.placed = "";
      if (!rect && tries++ < 90) frame = window.requestAnimationFrame(place);
    };
    place();
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>(`.${styles.list} button`)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const onDown = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [onClose]);

  if (!unit) return null;
  const service = unitHealthService(unit);
  const others = units.filter((candidate) => candidate.id !== unit.id && canOpenHref(unitHref(candidate.id)));
  const sameSite = others.filter((candidate) => candidate.siteCode === unit.siteCode);
  const elsewhere = others.filter(
    (candidate) =>
      candidate.siteCode !== unit.siteCode && service !== undefined && unitHealthService(candidate) === service,
  );
  const shownElsewhere = showAll ? elsewhere : elsewhere.slice(0, FIRST_ROWS);
  const siteName = figures.get(unit.id)?.site ?? unit.siteCode;

  function go(id: string, name: string) {
    onClose();
    announceToWardShell(`${name}.`);
    router.push(unitHref(id));
  }

  const row = (candidate: (typeof units)[number], here = false) => {
    const figure = figures.get(candidate.id);
    // The hospital is named only for a ward on another site; its group heading names this one's.
    const otherSite = candidate.siteCode !== unit.siteCode;
    // A ward whose name already ends in its security ("SJGM Adult Open") does not say it twice.
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
          <button type="button" className={styles.row} onClick={() => go(candidate.id, candidate.name)}>
            {body}
          </button>
        )}
      </li>
    );
  };

  return (
    <OverlayPortal layer="popover" name="ward-switcher">
      <div className={styles.scrim} aria-hidden="true" />
      <div ref={panel} className={styles.panel} role="dialog" aria-labelledby={titleId}>
        <header className={styles.head}>
          <strong id={titleId}>Switch ward</strong>
          <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close Switch ward" onClick={onClose} />
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
            <section aria-label={`Elsewhere in ${service}`}>
              <p className={styles.group}>Elsewhere in {service}</p>
              <ul className={styles.list}>{shownElsewhere.map((candidate) => row(candidate))}</ul>
              {elsewhere.length > FIRST_ROWS ? (
                <button type="button" className={styles.more} onClick={() => setShowAll((was) => !was)}>
                  {showAll ? "Show fewer" : `Show ${elsewhere.length - FIRST_ROWS} more`}
                </button>
              ) : null}
            </section>
          ) : null}
          {sameSite.length === 0 && elsewhere.length === 0 ? (
            <p className={styles.none}>No other ward in {service ?? "this service"} that this desk can open.</p>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
