import type { ReactNode } from "react";

import { WardTable } from "@/components/ward-management/ward-table/ward-table";

import a from "./referral-board.module.css";
import styles from "./referral-queue.module.css";

/** The queue as a table, while it has room. A phone gets `ReferralQueueCards` instead. */
export function ReferralQueueTable({ children }: { children: ReactNode }) {
  return (
    <WardTable className={a.table} wrapperClassName={styles.tableScroll} testId="ward-referral-board-queued-table">
      {children}
    </WardTable>
  );
}

/** The queue as cards, shown only on a phone. */
export function ReferralQueueCards({ children }: { children: ReactNode }) {
  return (
    <ul className={styles.cards} data-testid="ward-referral-board-queued-cards">
      {children}
    </ul>
  );
}
