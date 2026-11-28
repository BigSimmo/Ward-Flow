"use client";
// Settings by role (Josh, 3 Nov 2026, ST1): the Display section. Help, the tour and the shortcut list
// live in Help. The Sidebar row and Page tips switch were removed in audit two (#68, #46). The round 3 "New for this browser" proposals
// (Open Ward Flow on, Text size) are not built: nothing in the app reads them yet (D-72).
// Settings overhaul (Josh, 16 Nov 2026): a phone has no "On this phone" block any more, so Theme and
// Row density live here on every device, stacked full width on a phone.

import { Palette } from "lucide-react";

import type { RowDensity } from "@/components/ward-management/settings/row-density";
import { THEME_CHOICES, type ThemeChoice } from "@/components/ward-management/settings/settings-panes";
import { Button, Card, CardHead, Segmented, SrOnly, Switch } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-layout.module.css";
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
}: {
  theme: ThemeChoice;
  onThemeChange: (next: ThemeChoice) => void;
  reducedMotion: boolean;
  onReducedMotionChange: (next: boolean) => void;
  highContrast: boolean;
  onHighContrastChange: (next: boolean) => void;
  rowDensity: RowDensity;
  onRowDensityChange: (next: RowDensity) => void;
  characterShortcuts: boolean;
  onCharacterShortcutsChange: (next: boolean) => void;
  /** On a phone the choices stack full width and the computer-only rows (shortcuts) are left out. */
  phoneQuick?: boolean;
  /** Opens the restore dialog for this browser only. The rules are restored from the Rules tab (audit two #44). */
  onRestore: () => void;
}) {
  return (
    <Card aria-labelledby="display-title">
      <CardHead iconPlain id="display-title" icon={Palette} title="Display" />
      <SettingRow setting="theme" title="Theme" stacked={phoneQuick} testId="ward-settings-appearance">
        <Segmented<ThemeChoice>
          className={phoneQuick ? rx.phoneSeg : styles.pillSeg}
          size={phoneQuick ? "md" : undefined}
          label="Theme"
          items={[...THEME_CHOICES]}
          value={theme}
          onChange={onThemeChange}
        />
      </SettingRow>
      <SettingRow setting="density" title="Row density" stacked={phoneQuick} testId="ward-settings-density">
        <Segmented<RowDensity>
          className={phoneQuick ? rx.phoneSeg : styles.pillSeg}
          size={phoneQuick ? "md" : undefined}
          label="Row density"
          items={[
            { id: "comfortable", label: "Comfortable" },
            { id: "compact", label: "Compact" },
          ]}
          value={rowDensity}
          onChange={onRowDensityChange}
        />
      </SettingRow>
      {/* Round 3: the sub line was a sentence; the keys still on are said once, in the Shortcuts list.
          ST1 (3 Nov 2026): a phone has no keyboard to use them, so the row stays on a computer. */}
      {phoneQuick ? null : (
        <SettingRow setting="character-shortcuts" title="Single-key shortcuts" sub="Esc and Ctrl+K always work">
          <RowSwitch
            name="Single-key shortcuts"
            checked={characterShortcuts}
            onCheckedChange={onCharacterShortcutsChange}
          />
        </SettingRow>
      )}
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
        title="Restore this browser"
        sub="Puts every setting on this device back. The rules are restored from the Rules tab."
      >
        <Button variant="sec" onClick={onRestore} aria-haspopup="dialog" data-testid="btn-restore-baseline">
          Restore…
        </Button>
      </SettingRow>
    </Card>
  );
}
