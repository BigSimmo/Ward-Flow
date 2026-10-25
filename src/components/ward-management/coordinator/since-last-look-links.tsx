import Link from "next/link";

import { dischargeHref, movementHref } from "@/components/ward-management/shell/ward-facade";

import type { ChangesSinceLastLook } from "./since-last-look";
import styles from "./since-last-look-links.module.css";

/**
 * Closing-the-loop features (24 Oct 2026, package E): the record links under "acceptance withdrawn"
 * and "discharge date moved". Each names the ward and the synthetic record id, never a person.
 */
export type SinceRecordLink = { href: string; label: string };

export function acceptanceWithdrawnLinks(changes: ChangesSinceLastLook): SinceRecordLink[] {
  return (changes.acceptanceWithdrawn ?? []).map((row) => ({
    href: movementHref(row.movementId),
    label: `${row.unitName ?? "Ward not recorded"}, ${row.movementId}`,
  }));
}

export function dischargeMovedLinks(changes: ChangesSinceLastLook): SinceRecordLink[] {
  return (changes.dischargeDatesMoved ?? []).map((row) => ({
    href: dischargeHref(row.admissionId),
    label: `${row.unitName ?? row.unitId}, ${row.admissionId}`,
  }));
}

export function SinceRecordLinks({ links, label }: { links: readonly SinceRecordLink[]; label: string }) {
  if (links.length === 0) return null;
  return (
    <ul className={styles.links} aria-label={label}>
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className={styles.link}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
