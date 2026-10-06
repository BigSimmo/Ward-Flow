"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  NETWORK_ON_CALL_ROLES,
  SERVICE_ON_CALL_ROLES,
  servicesWithNoRoleRecorded,
} from "@/components/ward-management/on-call/on-call-roster";
import { onCallHref } from "@/components/ward-management/shell/ward-facade";
import { HEALTH_SERVICES } from "@/components/ward-management/ward-model";

import styles from "./ward-bar.module.css";

/** Shift roster for the tools drawer. Numbers stay in Directory, never on this list. */
export function ToolsOnCallPanel({ onNavigate }: { onNavigate: () => void }) {
  const unrecorded = servicesWithNoRoleRecorded();

  return (
    <div className={styles.onCallPanel}>
      <p className={styles.toolsContext}>
        Who is rostered on this synthetic shift. Reach them through Directory. This list holds roles, not people.
      </p>
      <Link href={onCallHref()} className={styles.toolItem} onClick={onNavigate}>
        <ArrowRight aria-hidden="true" />
        <span>
          On-call board<em>Open the full roster and how to reach a role</em>
        </span>
      </Link>
      <section className={styles.toolsSection}>
        <h3 className={styles.toolsHeading}>Network</h3>
        <ul className={styles.onCallList}>
          {NETWORK_ON_CALL_ROLES.map((role) => (
            <li key={role.id}>
              <strong>{role.role}</strong>
              <span>{role.shift}</span>
            </li>
          ))}
        </ul>
      </section>
      {HEALTH_SERVICES.map((service) => {
        const roles = SERVICE_ON_CALL_ROLES[service];
        return (
          <section key={service} className={styles.toolsSection}>
            <h3 className={styles.toolsHeading}>
              {service} <span>{roles.length === 0 ? "Not recorded" : roles.length}</span>
            </h3>
            {roles.length === 0 ? (
              <p className={styles.directoryNote}>No on-call role is recorded for {service} in this prototype.</p>
            ) : (
              <ul className={styles.onCallList}>
                {roles.map((role) => (
                  <li key={role.id}>
                    <strong>{role.role}</strong>
                    <span>{role.shift}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {unrecorded.length > 0 ? (
        <p className={styles.directoryNote}>
          Not recorded here: {unrecorded.join(", ")}. That is a gap in this prototype, not a statement that nobody is on
          call.
        </p>
      ) : null}
    </div>
  );
}
