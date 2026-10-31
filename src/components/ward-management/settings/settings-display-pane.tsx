"use client";
// Settings by login (Josh, 31 Oct 2026): the Display card of "This device", beside the alerts. Help,
// the tour and Shortcuts are their own Help section. The round 3 "New for this browser" proposals
// (Open Ward Flow on, Text size) are not built: nothing in the app reads them yet (D-72).
// On a phone, Theme and Row density sit on the page itself, so the sheet leaves them out.

import { Palette } from "lucide-react";

import type { RowDensity } from "@/components/ward-management/settings/row-density";
import { THEME_CHOICES, type ThemeChoice } from "@/components/ward-management/settings/settings-panes";
import { Button, Card, CardHead, Segmented, SrOnly, Switch } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import { SettingRow } from "./settings-rows";

function RowSwitch({
  name,
  checked,
  onCheckedChange,
}: {
  name: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return <Switch checked={checked} onCheckedChange={onCheckedChange} label={<SrOnly>{name}</SrOnly>} />;
}

export function SettingsDisplayPane({
  theme,
  onThemeChange,
  railOpen,
  onRailChange,
  reducedMotion,
  onReducedMotionChange,
  highContrast,
  onHighContrastChange,
  rowDensity,
  onRowDensityChange,
  characterShortcuts,
  onCharacterShortcutsChange,
  phoneQuick = false,
  onRestore,
  restoresRules,
}: {
  theme: ThemeChoice;
  onThemeChange: (next: ThemeChoice) => void;
  railOpen: boolean;
  onRailChange: (open: boolean) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (next: boolean) => void;
  highContrast: boolean;
  onHighContrastChange: (next: boolean) => void;
  rowDensity: RowDensity;
  onRowDensityChange: (next: RowDensity) => void;
  characterShortcuts: boolean;
  onCharacterShortcutsChange: (next: boolean) => void;
  /** On a phone Theme and Row density are on the page itself, so the sheet leaves them out. */
  phoneQuick?: boolean;
  /** Opens the restore dialog. Every desk can put this browser back; only the rule editor the rules. */
  onRestore: () => void;
  restoresRules: boolean;
}) {
  return (
    <Card aria-labelledby="display-title">
      <CardHead iconPlain id="display-title" icon={Palette} title="Display" />
      {phoneQuick ? null : (
        <SettingRow setting="theme" title="Theme" testId="ward-settings-appearance">
          <Segmented<ThemeChoice>
            className={styles.pillSeg}
            label="Theme"
            items={[...THEME_CHOICES]}
            value={theme}
            onChange={onThemeChange}
          />
        </SettingRow>
      )}
      <SettingRow
        setting="sidebar"
        title="Sidebar"
        sub={railOpen ? "Full, names and counts" : "Compact, icons only"}
        subTestId="ward-settings-rail-now"
        testId="ward-settings-rail"
      >
        <Segmented
          className={styles.pillSeg}
          label="Sidebar"
          items={[
            { id: "full", label: "Full" },
            { id: "compact", label: "Compact" },
          ]}
          value={railOpen ? "full" : "compact"}
          onChange={(choice) => onRailChange(choice === "full")}
        />
      </SettingRow>
      {phoneQuick ? null : (
        <SettingRow setting="density" title="Row density" testId="ward-settings-density">
          <Segmented<RowDensity>
            className={styles.pillSeg}
            label="Row density"
            items={[
              { id: "comfortable", label: "Comfortable" },
              { id: "compact", label: "Compact" },
            ]}
            value={rowDensity}
            onChange={onRowDensityChange}
          />
        </SettingRow>
      )}
      {/* Round 3: the sub line was a sentence; the keys still on are said once, in the Shortcuts list. */}
      <SettingRow setting="character-shortcuts" title="Single-key shortcuts" sub="Esc and Ctrl+K always work">
        <RowSwitch
          name="Single-key shortcuts"
          checked={characterShortcuts}
          onCheckedChange={onCharacterShortcutsChange}
        />
      </SettingRow>
      <SettingRow setting="reduce-motion" title="Reduce motion" sub="Stops slides and pulses">
        <RowSwitch name="Reduce motion" checked={reducedMotion} onCheckedChange={onReducedMotionChange} />
      </SettingRow>
      <SettingRow setting="high-contrast" title="High contrast" sub="Stronger edges and ink">
        <RowSwitch name="High contrast" checked={highContrast} onCheckedChange={onHighContrastChange} />
      </SettingRow>
      {/* Audit (31 Oct 2026): one restore, which puts back every setting this card and the alerts
                card keep in this browser, so no preference is left behind. */}
      <SettingRow
        setting="restore"
        title="Restore defaults"
        sub={restoresRules ? "Rules, and this browser if you choose" : "Every setting on this device"}
      >
        <Button variant="sec" onClick={onRestore} aria-haspopup="dialog" data-testid="btn-restore-baseline">
          Restore…
        </Button>
      </SettingRow>
    </Card>
  );
}
