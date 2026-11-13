"use client";

import { Suspense, lazy } from "react";
import { Button } from "./button";
import styles from "./overlay.module.css";
import type { ToastChoices } from "./toast";

/**
 * PR #1626 review: until the menu's code arrives, or if it cannot load, plain buttons keep
 * the choice open within the Undo window.
 *
 * This file is loaded only when a toast offers choices (D-148), so the buttons and the kit menu
 * stay off every page's first load.
 */
function PlainChoices({ choices, onDone }: { choices: ToastChoices; onDone?: () => void }) {
  return (
    <span role="group" aria-label={choices.label}>
      {choices.items.map((item) => (
        <Button
          key={item.id}
          variant="ghost"
          size="sm"
          className={styles.toastAction}
          onClick={() => {
            if (choices.onChoose(item.id) !== false) onDone?.();
          }}
        >
          {item.label}
        </Button>
      ))}
    </span>
  );
}

const ToastChoicesMenu = lazy(() => import("./toast-choices").catch(() => ({ default: PlainChoices })));

export default function ToastChoicesSlot({ choices, onDone }: { choices: ToastChoices; onDone?: () => void }) {
  return (
    <Suspense fallback={<PlainChoices choices={choices} onDone={onDone} />}>
      <ToastChoicesMenu choices={choices} onDone={onDone} />
    </Suspense>
  );
}
