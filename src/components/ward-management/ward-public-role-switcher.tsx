"use client";

import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import type { ComponentProps } from "react";
import { WardRoleSwitcher as OperationalWardRoleSwitcher } from "./ward-role-switcher";
import { useExecutiveStatisticsControl } from "./statistics/executive-statistics-context";
import { useWardShellAuthority, useWardShellPublic } from "./shell/ward-shell-public-context";
import { useCanOpenHref } from "./shell/ward-access";
import styles from "./ward-role-switcher.module.css";

/** Keep the published operational switcher unchanged; aggregate desks use the public host action. */
export function WardRoleSwitcher(props: ComponentProps<typeof OperationalWardRoleSwitcher> = {}) {
  const authority = useWardShellAuthority();
  const reporting = useExecutiveStatisticsControl();
  const shell = useWardShellPublic();
  const canOpen = useCanOpenHref();
  if (authority?.role !== "executive" && !reporting.executive) return <OperationalWardRoleSwitcher {...props} />;
  return (
    <div className={styles.switcher}>
      <button
        type="button"
        className={styles.trigger}
        data-words={props.withWords || undefined}
        aria-haspopup="dialog"
        aria-label="Change view"
        title="Go to a desk"
        disabled={!shell?.switchRole}
        onClick={() => shell?.switchRole?.()}
      >
        <ArrowLeftRight aria-hidden="true" />
        {props.withWords ? (
          <span className={styles.triggerWords} aria-hidden="true">
            Change view
          </span>
        ) : null}
      </button>
      {props.nextStep && canOpen(props.nextStep.href) ? (
        <Link
          href={props.nextStep.href}
          className={styles.trigger}
          data-testid="ward-role-switcher-next-step"
          onClick={() => props.nextStep?.onSelect?.()}
        >
          {props.nextStep.label}
        </Link>
      ) : null}
    </div>
  );
}
