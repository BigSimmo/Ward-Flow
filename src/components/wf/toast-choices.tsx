"use client";

import { buttonClass } from "./button";
import { cx } from "./cx";
import { Menu } from "./menu";
import styles from "./overlay.module.css";
import type { ToastChoices } from "./toast";

/**
 * The toast's follow-up choice menu (D-148). Its own file, loaded only when a toast offers choices,
 * so the kit menu stays off the first load of every page that shows toasts.
 */
export default function ToastChoicesMenu({ choices, onDone }: { choices: ToastChoices; onDone?: () => void }) {
  return (
    <Menu
      label={choices.label}
      align="end"
      items={choices.items.map((item) => ({
        id: item.id,
        label: item.label,
        onSelect: () => {
          // A blocked choice (Undo unavailable while the board reconnects) keeps the toast and its
          // Undo, so the person can try again.
          if (choices.onChoose(item.id) === false) return;
          onDone?.();
        },
      }))}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cx(buttonClass({ variant: "ghost", size: "sm" }), styles.toastAction)}
          data-testid="toast-choices"
        >
          {choices.label}
        </button>
      )}
    />
  );
}
