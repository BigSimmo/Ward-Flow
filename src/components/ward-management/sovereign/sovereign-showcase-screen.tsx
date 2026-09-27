"use client";

import { useMemo } from "react";
import {
  Activity,
  CheckCircle2,
  FileSpreadsheet,
  Layers,
  ListTodo,
  Settings2,
  Sliders,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { openWardDrawer } from "@/components/ward-management/shell/ward-drawer-bus";
import { announceToWardShell } from "@/components/ward-management/shell/ward-live-region";
import { useWardChecksPublisher } from "@/components/ward-management/shell/ward-checks";
import type { WardReconciliationCheck } from "@/components/ward-management/shell/ward-shell-types";
import { WardPrototypeFooter } from "@/components/ward-management/shell/ward-prototype-footer";

import styles from "./sovereign-showcase.module.css";

const SHOWCASE_CHECKS: readonly WardReconciliationCheck[] = [
  { label: "Universal header, bar, and rail mounted", ok: true },
  { label: "Four off-canvas sovereign drawers connected to client bus", ok: true },
  { label: "Design tokens aligned with sovereign platinum standard", ok: true },
];

export function SovereignShowcaseScreen() {
  useWardChecksPublisher(SHOWCASE_CHECKS);

  function handleOpenDrawer(drawer: "referral" | "tasks" | "activity" | "tools" | "service", name: string) {
    openWardDrawer(drawer);
    announceToWardShell(`Opening ${name}.`);
  }

  return (
    <main className={styles.workspace} id="main-content" aria-label="Sovereign Chrome and Drawers Suite Showcase">
      <section className={styles.heroBanner} aria-labelledby="sovereign-hero-title">
        <div className={styles.heroText}>
          <h1 id="sovereign-hero-title">Sovereign Chrome, Navigation Rail &amp; Drawers Suite</h1>
          <p>
            This perfected showcase integrates the universal <b>Header</b>, the collapsible <b>Navigation Rail</b>{" "}
            (264px ↔ 72px), the <b>Tasks Drawer</b> (facts vs commitments), the <b>Activity Drawer</b> (feed vs tally),
            the <b>Tools Drawer</b>, and the brand-new <b>Referral Side Drawer</b> under the 100-Point Design System.
          </p>
        </div>
        <div className={styles.heroActions} role="toolbar" aria-label="Showcase Drawer Triggers">
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => handleOpenDrawer("referral", "Urgent Referral Side Drawer")}
            title="Open the 48rem off-canvas referral drawer"
          >
            <UserPlus aria-hidden="true" size={14} />
            <span>Open Referral Drawer</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => handleOpenDrawer("tasks", "Tasks and recorded commitments drawer")}
            title="Open the outstanding tasks drawer"
          >
            <ListTodo aria-hidden="true" size={14} />
            <span>Open Tasks Drawer</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => handleOpenDrawer("activity", "Real-Time Activity Drawer")}
            title="Open the real-time activity and tally drawer"
          >
            <Activity aria-hidden="true" size={14} />
            <span>Open Activity Drawer</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => handleOpenDrawer("tools", "Demonstration Tools Drawer")}
            title="Open the prototype demonstration tools drawer"
          >
            <Sliders aria-hidden="true" size={14} />
            <span>Open Tools Drawer</span>
          </button>
        </div>
      </section>

      <div className={styles.demoGrid}>
        <article className={styles.demoCard} aria-labelledby="card-header-title">
          <div className={styles.demoCardHead}>
            <h3 id="card-header-title">Header &amp; Service Dropdown</h3>
            <span className={styles.badgePill}>Universal</span>
          </div>
          <div className={styles.demoCardBody}>
            <p>
              The universal header provides place grounding, keyboard-driven universal patient search (shortcut{" "}
              <code>/</code>), service scoping with individual health service color dots, and direct trigger anchors for
              all operational drawers.
            </p>
            <div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => handleOpenDrawer("service", "Health Service Scope Selector")}
              >
                <Layers aria-hidden="true" size={14} />
                <span>Toggle Service Dropdown</span>
              </button>
            </div>
          </div>
        </article>

        <article className={styles.demoCard} aria-labelledby="card-referral-title">
          <div className={styles.demoCardHead}>
            <h3 id="card-referral-title">Referral Side Drawer</h3>
            <span className={styles.badgePill}>48rem Stage Flow</span>
          </div>
          <div className={styles.demoCardBody}>
            <p>
              Coordinators can now draft, evaluate, and dispatch a patient referral directly from an off-canvas drawer
              without navigating away from their active worklist or bed board.
            </p>
            <div>
              <button
                type="button"
                className={styles.btnPrimary}
                onClick={() => handleOpenDrawer("referral", "Urgent Referral Side Drawer")}
              >
                <UserPlus aria-hidden="true" size={14} />
                <span>Test Referral Drawer</span>
              </button>
            </div>
          </div>
        </article>

        <article className={styles.demoCard} aria-labelledby="card-statutory-title">
          <div className={styles.demoCardHead}>
            <h3 id="card-statutory-title">Recorded form worklists</h3>
            <span className={styles.badgePill}>Recorded forms</span>
          </div>
          <div className={styles.demoCardBody}>
            <p>
              The Tasks drawer adheres strictly to the clinical invariant: statutory facts (Form 1A expirations,
              transport delays) require explicit acknowledgement, while operational commitments can be marked done.
            </p>
            <div>
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => handleOpenDrawer("tasks", "Tasks and recorded commitments drawer")}
              >
                <CheckCircle2 aria-hidden="true" size={14} />
                <span>Review Tasks Inbox</span>
              </button>
            </div>
          </div>
        </article>
      </div>
      <WardPrototypeFooter testId="ward-sovereign-governance" />
    </main>
  );
}
