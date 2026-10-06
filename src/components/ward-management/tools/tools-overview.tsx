"use client";

import Link from "next/link";
import { ChevronRight, FileText, Monitor, Moon, Plus, Settings, Sun } from "lucide-react";

import type { WardAppearance } from "@/components/ward-management/shell/ward-shell-types";
import { digestHref, handoverHref, settingsHref } from "@/components/ward-management/shell/ward-facade";

import type { ToolsFigureGroup, ToolsFiguresModel } from "./tools-figures-model";
import styles from "./tools-workspace.module.css";

export function ToolsOverview({
  model,
  appearance,
  onAppearance,
  onOpenFigures,
  onOpenDue,
  onRaiseReferral,
  onNavigate,
}: {
  model: ToolsFiguresModel;
  appearance: WardAppearance;
  onAppearance: (appearance: WardAppearance) => void;
  onOpenFigures: (group: ToolsFigureGroup) => void;
  onOpenDue: () => void;
  onRaiseReferral: () => void;
  onNavigate: () => void;
}) {
  const due = model.duePassed + model.dueSoon;
  const themes: readonly { id: WardAppearance; label: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Dark theme", icon: Moon },
    { id: "light", label: "Light theme", icon: Sun },
    { id: "auto", label: "System", icon: Monitor },
  ];
  return (
    <div className={styles.bento}>
      <div className={styles.metrics} aria-label="Live figures">
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
          <span>Due</span> <strong>{due}</strong>
        </button>
      </div>

      <section className={styles.appearanceBar}>
        <h3 className={styles.moduleTitle}>Appearance</h3>
        <div className={styles.segment} role="group" aria-label="Appearance theme">
          {themes.map((theme) => {
            const Icon = theme.icon;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={appearance === theme.id}
                onClick={() => onAppearance(theme.id)}
              >
                <Icon aria-hidden="true" />
                {theme.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.actions} aria-label="Quick actions">
        <Link href={handoverHref()} onClick={onNavigate}>
          <FileText aria-hidden="true" />
          <span>
            Handover sheet<small>Review and print the current handover</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
        <button type="button" onClick={onRaiseReferral}>
          <Plus aria-hidden="true" />
          <span>
            Raise a referral<small>Review details and choose a destination</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
        <Link href={settingsHref()} onClick={onNavigate}>
          <Settings aria-hidden="true" />
          <span>
            Settings<small>Configuration and preferences</small>
          </span>
          <ChevronRight aria-hidden="true" />
        </Link>
      </div>
      <a href={digestHref()} className={styles.quiet}>
        Ward Flow Digest
      </a>
    </div>
  );
}
