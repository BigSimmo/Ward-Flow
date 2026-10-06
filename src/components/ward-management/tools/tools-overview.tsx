"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, FileText, Monitor, Moon, Plus, Settings, Sun } from "lucide-react";

import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { digestHref, handoverHref, settingsHref } from "@/components/ward-management/shell/ward-facade";

import type { ToolsFigureGroup, ToolsFiguresModel } from "./tools-figures-model";
import shell from "../shell/ward-bar.module.css";
import styles from "./tools-workspace.module.css";

export function ToolsOverview({
  model,
  flaggedSummary,
  appearance,
  onAppearance,
  onOpenFigures,
  onOpenDue,
  onRaiseReferral,
  onNavigate,
}: {
  model: ToolsFiguresModel;
  flaggedSummary: string;
  appearance: WardAppearance;
  onAppearance: (appearance: WardAppearance) => void;
  onOpenFigures: (group: ToolsFigureGroup) => void;
  onOpenDue: () => void;
  onRaiseReferral: () => void;
  onNavigate: () => void;
}) {
  const due = model.duePassed + model.dueSoon;
  return (
    <div className={styles.stack}>
      <button
        type="button"
        className={styles.glance}
        data-testid="ward-bar-figures-trigger"
        onClick={() => onOpenFigures("beds")}
      >
        <span>
          <strong>Figures</strong>
          <small>{flaggedSummary}</small>
        </span>
        <BarChart3 aria-hidden="true" />
      </button>
      <div className={styles.strip} aria-label="Live figures">
        <button type="button" className={styles.metric} onClick={() => onOpenFigures("beds")}>
          <span>Ready</span>
          <strong>{model.beds.find((row) => row.id === "ready")?.value ?? "—"}</strong>
        </button>
        <button type="button" className={styles.metric} onClick={() => onOpenFigures("beds")}>
          <span>Occupied</span>
          <strong>{model.occupancy.percent}</strong>
        </button>
        <button type="button" className={styles.metric} onClick={() => onOpenFigures("pressure")}>
          <span>Waiting</span>
          <strong>
            {model.pressure.find((row) => row.id === "waiting" || row.id === "waiting-here")?.value ?? "—"}
          </strong>
        </button>
        <button type="button" className={styles.metric} data-flagged={due > 0} onClick={onOpenDue}>
          <span>Due</span>
          <strong>{due}</strong>
        </button>
      </div>

      <section className={shell.toolsSection}>
        <h3 className={shell.toolsHeading}>Appearance</h3>
        <div className={shell.appearanceTrack} role="group" aria-label="Appearance theme">
          <button
            type="button"
            className={shell.segBtn}
            aria-pressed={appearance === "dark"}
            onClick={() => onAppearance("dark")}
          >
            <Moon aria-hidden="true" /> Dark theme
          </button>
          <button
            type="button"
            className={shell.segBtn}
            aria-pressed={appearance === "light"}
            onClick={() => onAppearance("light")}
          >
            <Sun aria-hidden="true" /> Light theme
          </button>
          <button
            type="button"
            className={shell.segBtn}
            aria-pressed={appearance === "auto"}
            onClick={() => onAppearance("auto")}
          >
            <Monitor aria-hidden="true" /> System
          </button>
        </div>
      </section>

      <section className={shell.toolsSection}>
        <h3 className={shell.toolsHeading}>Quick actions</h3>
        <Link href={handoverHref()} className={shell.toolItem} onClick={onNavigate}>
          <FileText aria-hidden="true" />
          <span>
            Handover sheet<em>Review and print the current handover</em>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
        <button type="button" className={shell.toolItem} onClick={onRaiseReferral}>
          <Plus aria-hidden="true" />
          <span>
            Raise a referral<em>Review details and choose a destination</em>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <Link href={settingsHref()} className={shell.toolItem} onClick={onNavigate}>
          <Settings aria-hidden="true" />
          <span>
            Settings<em>Configuration and preferences</em>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
        <a href={digestHref()} className={styles.quiet}>
          Ward Flow Digest
        </a>
      </section>
    </div>
  );
}
