"use client";

/**
 * PWA plan item 11 (Oct 2026): how to put Ward Flow on this device's Home Screen. Lives in Settings
 * only, so it never appears during a task. Hidden once Ward Flow runs as an installed app.
 *
 * - iPhone and iPad: Safari has no install button for a site, so the row gives the two taps.
 * - Browsers that offer an install sheet (`beforeinstallprompt`, Android Chrome and desktop
 *   Chromium): an Install button opens it.
 * - Anywhere else: nothing, rather than steps that do not apply.
 */
import { useSyncExternalStore } from "react";

import { iosDevice, standaloneApp } from "@/components/ward-management/shell/ward-phone-push";
import { promptInstall, useInstallPrompt } from "@/components/ward-management/shell/ward-pwa-install";
import { Button } from "@/components/wf";

import { SettingRow } from "./settings-rows";

import styles from "./settings.module.css";

type InstallPlatform = "installed" | "ios" | "other";

function platform(): InstallPlatform {
  if (standaloneApp()) return "installed";
  return iosDevice() ? "ios" : "other";
}

const noSubscription = () => () => {};

export function SettingsInstallHint() {
  // Read after hydration: the server cannot know the device, so it renders nothing here.
  const device = useSyncExternalStore(noSubscription, platform, () => "installed" as InstallPlatform);
  const installEvent = useInstallPrompt();

  if (device === "installed") return null;
  if (device === "ios") {
    return (
      <SettingRow
        setting="install"
        title="Add to Home Screen"
        sub="Tap Share, then Add to Home Screen"
        testId="setting-install-row"
      />
    );
  }
  if (!installEvent) return null;
  return (
    <SettingRow
      setting="install"
      title="Install Ward Flow"
      sub="Opens on its own, like an app"
      testId="setting-install-row"
    >
      <Button variant="sec" size="sm" className={styles.pill} onClick={() => void promptInstall()}>
        Install
      </Button>
    </SettingRow>
  );
}
