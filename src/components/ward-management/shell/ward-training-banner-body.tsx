"use client";

import { GraduationCap } from "lucide-react";

import { WardTrainingSwitch } from "@/components/ward-management/demo-reset/ward-training-switch";

import styles from "./ward-training-banner.module.css";

/** Feature 47: the training banner itself, loaded only while this tab is in training. */
export function WardTrainingBannerBody() {
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
