"use client";

import Link from "next/link";
import { Copy } from "lucide-react";
import { useMemo, useState, type RefObject } from "react";

import { Button, Sheet, StatusGlyph } from "@/components/wf";
import { copyTextToClipboard } from "@/components/ward-management/ward-clipboard";
import { minuteOfDay, type Instant } from "@/components/ward-management/ward-clock";
import { useWardNetwork } from "@/components/ward-management/ward-flow-provider";

import { wardContactCard } from "./ward-contact-card";
import styles from "../staffing/staffing.module.css";

/**
 * Feature 32: the ward contact card. Every number is a synthetic mock from the on-call directory;
 * Copy puts it on the clipboard and nothing dials, as on the On-call page.
 */
export function WardContactSheet({
  open,
  onClose,
  unitId,
  now,
  returnFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  unitId: string;
  now: Instant;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const network = useWardNetwork();
  const minute = minuteOfDay(now);
  const card = useMemo(() => wardContactCard(unitId, minute, network.sites), [unitId, minute, network.sites]);
  const [said, setSaid] = useState("");
  const copy = async (number: string, label: string) => {
    try {
      await copyTextToClipboard(number);
      setSaid(`${label} number copied`);
    } catch {
      setSaid("Copy is unavailable in this browser. Select the number instead.");
    }
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={card ? `Contact ${card.wardName}` : "Ward contacts"}
      placement="responsive-right"
      mobilePlacement="bottom"
      returnFocusRef={returnFocusRef}
      testId="ward-contact-sheet"
    >
      {card ? (
        <>
          <p className={styles.contactHead}>{card.siteName} · synthetic numbers, nothing dials</p>
          <ul className={styles.contactList}>
            {card.rows.map((row) => (
              <li key={row.key} className={styles.contactRow} data-testid={`ward-contact-${row.key}`}>
                <span className={styles.contactWho}>
                  <span className={styles.contactLabel}>{row.label}</span>
                  <span className={styles.contactSub}>
                    {row.availability ? (
                      <>
                        <StatusGlyph tone={row.answering ? "success" : "neutral"} size={9} />
                        <span>
                          {row.line ? `${row.line} · ` : ""}
                          <span className={styles.mono}>{row.availability}</span>
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
                {row.number ? (
                  <span className={styles.actions}>
                    <span className={styles.contactNumber}>{row.number}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Copy}
                      iconOnly
                      aria-label={`Copy ${row.label.toLowerCase()} number`}
                      onClick={() => void copy(row.number!, row.label)}
                    />
                  </span>
                ) : (
                  <span className={styles.missing}>Not recorded</span>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className={styles.contactHead}>This ward is not in the on-call directory. Not recorded.</p>
      )}
      <div className={styles.contactFoot}>
        <span className={styles.status} role="status">
          {said}
        </span>
        <Link className={styles.link} href="/ward-flow/on-call" data-testid="ward-contact-all">
          All contacts
        </Link>
      </div>
    </Sheet>
  );
}
