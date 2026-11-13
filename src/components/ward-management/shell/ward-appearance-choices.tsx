"use client";

import type { ReactNode } from "react";
import { RadioGroup } from "@/components/wf";
import { setGlarePreference, setThemePreference } from "@/lib/theme-client";
import { announceToWardShell } from "./ward-live-region";

/*
 * The theme choices shared by the live rail's Appearance pop-up and the executive desk's Appearance
 * sheet (spec item 14, C07, 13 Nov 2026; review E-11). One radio group: opening puts focus on the
 * current choice, arrows move without picking, Enter or Space picks, Escape closes and returns focus.
 */

// UX audit (21 Oct 2026): the same four themes as Settings, Display (settings-15 made Glare a fourth).
export const APPEARANCE_CHOICES = [
  { id: "auto", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "glare", label: "Bright light" },
] as const;

export type AppearanceChoice = (typeof APPEARANCE_CHOICES)[number]["id"];

/** The current choice: Bright light is its own preference and wins over the stored theme. */
export function appearanceChoice(prefs: { appearance: "auto" | "light" | "dark"; glare: boolean }): AppearanceChoice {
  return prefs.glare ? "glare" : prefs.appearance;
}

/** Glare is its own preference that uses light, so picking any other theme turns it off. */
export function chooseAppearance(next: AppearanceChoice) {
  // The real bar's `applyGlare` and `applyAppearance`, inlined so the rail does not import the bar.
  if (next === "glare") {
    setGlarePreference(true);
  } else {
    setGlarePreference(false);
    setThemePreference(next === "auto" ? "system" : next);
  }
  announceToWardShell(`Appearance set to ${next}.`);
}

/** The checked choice, which takes focus when its pop-up or sheet opens. */
export const CHECKED_APPEARANCE_SELECTOR = '[role="radio"][aria-checked="true"]';

type AppearanceRadioGroupProps = {
  value: AppearanceChoice;
  className?: string;
  buttonClassName?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Inside a kit `Sheet`: marks the current choice as the sheet's opening focus, not Close. */
  sheetAutofocus?: boolean;
  /** The inside of each choice; the label alone when absent. */
  renderChoice?: (choice: (typeof APPEARANCE_CHOICES)[number]) => ReactNode;
};

export function AppearanceRadioGroup({
  value,
  className,
  buttonClassName,
  sheetAutofocus = false,
  renderChoice,
  ...label
}: AppearanceRadioGroupProps) {
  return (
    <RadioGroup className={className} selectOnMove={false} {...label}>
      {APPEARANCE_CHOICES.map((choice) => (
        <button
          key={choice.id}
          type="button"
          role="radio"
          aria-checked={value === choice.id}
          data-sheet-autofocus={sheetAutofocus && value === choice.id ? "" : undefined}
          onClick={() => chooseAppearance(choice.id)}
          className={buttonClassName}
        >
          {renderChoice ? renderChoice(choice) : choice.label}
        </button>
      ))}
    </RadioGroup>
  );
}
