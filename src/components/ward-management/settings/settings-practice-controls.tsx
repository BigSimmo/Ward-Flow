"use client";

import { WardDemoControls } from "@/components/ward-management/ward-demo-controls";
import { WardRoleSwitcher } from "@/components/ward-management/ward-role-switcher";

import styles from "../tools/tools-workspace.module.css";

/** Practice clock and Change view. Tools used to host these; Settings is now their only mount. */
export function SettingsPracticeControls() {
  return (
    <div className={styles.practice}>
      <WardDemoControls />
      <WardRoleSwitcher />
    </div>
  );
}
