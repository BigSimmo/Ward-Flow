"use client";

import { Check, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef } from "react";

import { Button, OverlayPortal } from "@/components/wf";
import { HEALTH_SERVICES, type HealthService } from "@/components/ward-management/ward-model";
import { useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { waitingInEds } from "@/components/ward-management/ward-shared-figures";
import { setServiceScope, useServiceScope } from "@/components/ward-management/shell/ward-service-store";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import {
  SERVICE_SCOPE_NOTE,
  SERVICE_SCOPE_SHEET_LINE,
  SERVICE_SWATCH_KEY,
} from "@/components/ward-management/shell/ward-bar-model";

import styles from "./pop-service-picker.module.css";

/**
 * Mock-up of the app bar's Service picker (`shell/ward-bar-controls.tsx`, `WardBarServiceControl`).
 * Same choices, the same `waitingInEds` counts and the same store write (`setServiceScope`) and
 * announcement as `selectService` in `ward-bar.tsx`. Design changes: the "narrows the lists" line
 * shows on desktop too, Statewide carries its total, each count is a number with a quiet "waiting"
 * rather than a mono phrase, a service with nobody waiting reads "None" in grey, and on a phone it is
 * a bottom sheet with 48px rows. Escape, the scrim, a press outside and Close all close it.
 */
export function ServicePickerMock({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const service = useServiceScope();
  const { movements, now } = useWardFlowSelect("movements", "now");
  const waiting = useMemo(() => waitingInEds(movements, now), [movements, now]);

  useLayoutEffect(() => {
    // Under the bar's Service button on desktop, straight on the element (no state). The phone
    // sheet is placed by its CSS.
    let frame = 0;
    let tries = 0;
    const place = () => {
      const node = panel.current;
      if (!node) return;
      const trigger = document.querySelector('[data-testid="ward-bar-service-trigger"]');
      const rect = trigger && trigger.getClientRects().length > 0 ? trigger.getBoundingClientRect() : null;
      node.style.setProperty("--pick-top", `${rect ? rect.bottom + 8 : 64}px`);
      node.style.setProperty("--pick-left", `${Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - 348))}px`);
      node.dataset.placed = "";
      if (!rect && tries++ < 60) frame = window.requestAnimationFrame(place);
    };
    place();
    return () => window.cancelAnimationFrame(frame);
  });

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
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

  function choose(next: HealthService | null) {
    onClose();
    window.requestAnimationFrame(() => window.setTimeout(() => setServiceScope(next), 0));
    announceToWardShell(next ? `Service set to ${next}.` : "Service set to all.");
  }

  const option = (key: string, label: string, count: number, pressed: boolean, value: HealthService | null) => (
    <button key={key} type="button" className={styles.option} aria-pressed={pressed} onClick={() => choose(value)}>
      <span className={styles.dot} data-service={key} aria-hidden="true" />
      <span className={styles.name}>{label}</span>
      <span className={styles.count} data-none={count === 0 || undefined}>
        {count > 0 ? (
          <>
            <b>{count}</b> waiting
          </>
        ) : (
          "None waiting"
        )}
      </span>
      <Check className={styles.check} aria-hidden="true" data-visible={pressed || undefined} strokeWidth={2} />
    </button>
  );

  return (
    <OverlayPortal layer="popover" name="service-picker">
      <div className={styles.scrim} aria-hidden="true" />
      <div
        ref={panel}
        className={styles.panel}
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={`${titleId}-note`}
        data-testid="ward-bar-service-panel"
      >
        <header className={styles.head}>
          <span className={styles.headText}>
            <strong id={titleId}>Service</strong>
            <em>{SERVICE_SCOPE_SHEET_LINE}</em>
          </span>
          <Button variant="ghost" size="sm" iconOnly icon={X} aria-label="Close Service" onClick={onClose} />
        </header>
        <p id={`${titleId}-note`} className="sr-only">
          {SERVICE_SCOPE_NOTE}
        </p>
        <div className={styles.list}>
          {option("statewide", "Statewide", waiting.total, service === null, null)}
          <p className={styles.groupLabel}>One service</p>
          {HEALTH_SERVICES.map((candidate) =>
            option(
              SERVICE_SWATCH_KEY[candidate],
              candidate,
              waiting.byService.get(candidate) ?? 0,
              service === candidate,
              candidate,
            ),
          )}
        </div>
        <p className={styles.foot}>Each count is people waiting in that service&rsquo;s emergency departments.</p>
      </div>
    </OverlayPortal>
  );
}
