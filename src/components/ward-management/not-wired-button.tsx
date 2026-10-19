import type { ComponentPropsWithRef } from "react";
import type { LucideIcon } from "lucide-react";
import type { ButtonSize, ButtonVariant } from "@/components/wf";

type NotWiredButtonProps = Omit<ComponentPropsWithRef<"button">, "children" | "onClick"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Icon only: `label` becomes the accessible name. */
  iconOnly?: boolean;
  /** The control's own words. */
  label: string;
  /** What the control would be called in an announcement, when `label` alone is too short. */
  name?: string;
  /** Class for the wrapper the control used to sit in. */
  wrapClassName?: string;
};

/**
 * A control the prototype does not connect. It renders nothing.
 *
 * Simplification A5 / design audit DA-29 (Josh, 19 Oct 2026): "nothing on screen does nothing".
 * These controls used to stay pressable and open a "Not wired in this prototype." popover (D-16);
 * that later answer retires them from the screen. Call sites keep naming the control so the place
 * a future feature belongs is still recorded in the page that will own it.
 */
export function NotWiredButton(props: NotWiredButtonProps): null {
  void props;
  return null;
}
