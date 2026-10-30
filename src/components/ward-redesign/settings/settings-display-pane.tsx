"use client";
// Settings round 3 (mock-up, 30 Oct 2026): the Display card, copied from DisplayPane in
// src/components/ward-management/settings/settings-panes.tsx. Shortcuts and Help and tour move to
// the Help and data tab, so this tab holds only how the app looks on this browser, beside the round 2
// profile card. Below it, three proposed personal settings that work in this preview only and are
// not saved anywhere; each is for Josh to keep or drop on review.

import { useState, type ReactNode } from "react";
import { Palette, Sparkles } from "lucide-react";

import type { Instant } from "@/components/ward-management/ward-clock";
import { currentShift } from "@/components/ward-management/ward-board-time-features";
import type { RowDensity } from "@/components/ward-management/settings/row-density";
import { THEME_CHOICES, type ThemeChoice } from "@/components/ward-management/settings/settings-panes";
import { Badge, Card, CardHead, Segmented, Select, SrOnly, Switch } from "@/components/wf";

import styles from "@/components/ward-management/settings/settings.module.css";
import rx from "./settings-redesign.module.css";
import { ScopeLine, SettingRow } from "./settings-rows";

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
  profileCard,
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
  startPages,
  now,
}: {
  profileCard: ReactNode;
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
  /** The pages this desk can open, for the proposed Open Ward Flow on. */
  startPages: readonly string[];
  now: Instant;
}) {
  // Proposals: held in this page only, never stored, so nothing outlives the preview.
  const [startPage, setStartPage] = useState(startPages[0] ?? "Home");
  const [followShift, setFollowShift] = useState(false);
  const [textSize, setTextSize] = useState<"standard" | "larger">("standard");
  const shift = currentShift(now);
  const nightNow = shift.name === "Night Shift";

  return (
    <>
      <ScopeLine kind="live" />
      <div className={styles.columns}>
        <div className={styles.column}>
          <Card aria-labelledby="display-title">
            <CardHead iconPlain id="display-title" icon={Palette} title="Display" />
            <SettingRow setting="theme" title="Theme" testId="ward-settings-appearance">
              <Segmented<ThemeChoice>
                className={styles.pillSeg}
                label="Theme"
                items={[...THEME_CHOICES]}
                value={theme}
                onChange={onThemeChange}
              />
            </SettingRow>
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
          </Card>

          <Card aria-labelledby="proposals-title" data-setting="proposals" data-testid="ward-settings-proposals">
            <CardHead
              iconPlain
              id="proposals-title"
              icon={Sparkles}
              title="Proposed for this browser"
              meta="Works in this preview. Not saved"
            />
            <SettingRow
              setting="start-page"
              title={
                <>
                  Open Ward Flow on <Badge size="sm">Proposal</Badge>
                </>
              }
              sub="The page this browser opens first"
            >
              <Select
                aria-label="Open Ward Flow on"
                value={startPage}
                onChange={(event) => setStartPage(event.target.value)}
              >
                {startPages.map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </Select>
            </SettingRow>
            <SettingRow
              setting="theme-follows-shift"
              title={
                <>
                  Theme follows the shift <Badge size="sm">Proposal</Badge>
                </>
              }
              sub={
                followShift
                  ? `Now ${shift.name.replace(" Shift", "").toLowerCase()} shift: ${nightNow ? "Dark" : "Light"}. Dark from 23:00 to 07:00`
                  : "Dark on the night shift, light by day"
              }
            >
              <RowSwitch name="Theme follows the shift" checked={followShift} onCheckedChange={setFollowShift} />
            </SettingRow>
            <SettingRow
              setting="text-size"
              title={
                <>
                  Text size <Badge size="sm">Proposal</Badge>
                </>
              }
              sub={
                <span className={textSize === "larger" ? rx.textLarger : undefined}>
                  {textSize === "larger" ? "Every page one step larger, like this line" : "The app's standard sizes"}
                </span>
              }
            >
              <Segmented<"standard" | "larger">
                className={styles.pillSeg}
                label="Text size"
                items={[
                  { id: "standard", label: "Standard" },
                  { id: "larger", label: "Larger" },
                ]}
                value={textSize}
                onChange={setTextSize}
              />
            </SettingRow>
          </Card>
        </div>

        <div className={styles.column}>{profileCard}</div>
      </div>
    </>
  );
}
