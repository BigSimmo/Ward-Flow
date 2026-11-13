"use client";

import { Eye } from "lucide-react";

import { useExitDemoRole } from "@/components/ward-management/tools/ward-demo-roles";
import { useDemoControlsAvailable } from "@/components/ward-management/ward-flow-raise";
import { ACCESS_ROLE_LABELS } from "@/components/ward-management/ward-role-access";
import { useUnscopedWardFlow } from "./ward-access-context";
import { useWardAccessSnapshot } from "./ward-access-store";
import { accessPlaceLabel } from "./ward-access-labels";

import styles from "./ward-viewing-as-bar.module.css";

/**
 * The Viewing as bar itself: "Viewing as Dabakarn · Nurse in charge", and Back to coordinator, which
 * is See it as's own way back (`useExitDemoRole`): the desk the demo started from.
 */
export function WardViewingAsBarBody() {
  const { access } = useWardAccessSnapshot();
  const world = useUnscopedWardFlow();
  const enabled = useDemoControlsAvailable();
  const exit = useExitDemoRole(enabled);
  const place = accessPlaceLabel(access, world.units);
  return (
    <div className={styles.bar} data-testid="ward-viewing-as-bar" data-print-hide>
      <Eye aria-hidden="true" className={styles.icon} size={16} strokeWidth={1.75} />
      <p className={styles.text} title={`Viewing as ${place} · ${ACCESS_ROLE_LABELS[access.role]}`}>
        Viewing as{" "}
        <strong>
          {place} · {ACCESS_ROLE_LABELS[access.role]}
        </strong>
      </p>
      {/* An underlined link at the right of the strip (approved picture), so it reads as the way back,
          not another action. It stays a button: it changes the desk as well as the page. */}
      <button
        type="button"
        className={styles.back}
        disabled={!enabled}
        onClick={exit}
        data-testid="ward-viewing-as-back"
      >
        Back to coordinator
      </button>
    </div>
  );
}
