"use client";

import { GraduationCap } from "lucide-react";

import { WardTrainingSwitch } from "@/components/ward-management/demo-reset/ward-training-switch";
import { useTrainingMode } from "@/components/ward-management/demo-reset/ward-training-mode";

import styles from "./ward-training-banner.module.css";

/**
 * Feature 47: while this tab is in the training sandbox, every Ward Flow page says so, above the
 * pinned notes, with the way out. Nothing renders outside training, so it costs one small hook.
 */
export function WardTrainingBanner() {
  const training = useTrainingMode();
  if (!training) return null;
  return (
    <div className={styles.banner} role="status" data-testid="ward-training-banner" data-print-hide>
      <GraduationCap aria-hidden="true" className={styles.icon} size={16} strokeWidth={1.75} />
      <p className={styles.text}>
        <strong>Training</strong> — practice patients only. Nothing you do here is saved for anyone else.
      </p>
      <WardTrainingSwitch testId="ward-training-banner" />
    </div>
  );
}
