"use client";

import { useState, type ReactNode } from "react";

import { GroupHead } from "@/components/ward-management/alerts/alerts-queue";
import alertStyles from "@/components/ward-management/alerts/alerts.module.css";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";
import { formatInstantWithDay } from "@/components/ward-management/ward-clock";
import { useWardFlowClock } from "@/components/ward-management/ward-flow-provider";
import { Card, Segmented, StateLine, StatusGlyph } from "@/components/wf";

import styles from "./pop-state-empty.module.css";

type HomeView = "needs" | "queue";

/**
 * The Empty mock-up: Home when nothing needs a person. Built from today's My list card
 * (coordinator/my-list-card.tsx) and Everyone waiting (coordinator/priority-queue.tsx) with every
 * group empty, using their own words: "None firing now…", "No referral is waiting on a decision.",
 * "Nothing is waiting on a transport leg or an arrival." and "No open movements". Each empty group
 * is one calm line under its head (the shared StateLine), with the time the lists were checked.
 * The page itself is not drawn: an empty world cannot be made from the seeded one, so this stands in
 * its place inside the shell.
 */
export function PopStateEmpty({ page }: { page: ReactNode }) {
  void page;
  const now = useWardFlowClock();
  const [view, setView] = useState<HomeView>("needs");
  const checkedAt = formatInstantWithDay(now, now);

  return (
    <main id="main-content" className={styles.main} data-testid="pop-state-empty">
      <div className={styles.body}>
        <div className={styles.switchRow}>
          <Segmented
            label="Home list"
            size="md"
            value={view}
            onChange={setView}
            items={[
              { id: "needs", label: "My list", count: 0 },
              { id: "queue", label: "Everyone waiting", count: 0 },
            ]}
          />
          <span className={styles.checked}>Checked at {checkedAt}</span>
        </div>

        {view === "needs" ? (
          <Card className={styles.card} data-testid="home-my-list" aria-label="My list, 0 items">
            <section className={alertStyles.group} aria-label="Act now">
              <GroupHead tone="danger" label="Act now" count={0} aside="needs a person now" />
              <StateLine
                compact
                kind="clear"
                title="None firing now."
                reason="The checks run are named in the header."
                className={styles.emptyLine}
              />
            </section>
            <section className={alertStyles.group} aria-label="Referrals to decide">
              <GroupHead tone="info" label="Referrals to decide" count={0} aside="oldest first" />
              <StateLine
                compact
                kind="clear"
                title="No referral is waiting on a decision."
                className={styles.emptyLine}
              />
            </section>
            <section className={alertStyles.group} aria-label="Waiting on others">
              <GroupHead tone="warning" label="Waiting on others" count={0} aside="you may need to chase" />
              <StateLine
                compact
                kind="clear"
                title="Nothing is waiting on a transport leg or an arrival."
                className={styles.emptyLine}
              />
            </section>
            <div className={styles.foot}>
              <StatusGlyph tone="neutral" size={9} />
              <span>Oldest first within each group. Snoozed items return by themselves.</span>
            </div>
          </Card>
        ) : (
          <Card className={styles.card} aria-label="Everyone waiting, 0 open movements">
            <section className={alertStyles.group} aria-label="Patients">
              <GroupHead tone="neutral" label="Everyone waiting" count={0} />
              <StateLine compact kind="clear" title="No open movements" className={styles.emptyLine} />
            </section>
          </Card>
        )}
      </div>
      <WardPrototypeFooter className={styles.footer} />
    </main>
  );
}
