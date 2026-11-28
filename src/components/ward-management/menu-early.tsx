"use client";

import { useEffect, useRef, useSyncExternalStore, type ComponentProps } from "react";

import { cx } from "@/components/wf";
import type { Menu } from "@/components/wf/menu";
import overlay from "@/components/wf/overlay.module.css";

import { loadEarly } from "./load-early";

type MenuProps = ComponentProps<typeof Menu>;

/**
 * Phone script budget (PR #1742): the kit Menu, for a page whose only menu is one trigger at rest
 * (the ED index's phone Sort, the patient page's Copy, the Ward page's More). The trigger draws at once, exactly as the
 * Menu draws it; the Menu's code is fetched as soon as the page's code runs and replaces it in the
 * same spot. A press that lands before the code has arrived opens the menu once it has.
 */
const early = loadEarly(() => import("@/components/wf/menu").then((m) => m.Menu));
const ready = () => early.ready();
const notReady = () => false;

export function EarlyMenu(props: MenuProps) {
  const loaded = useSyncExternalStore(early.subscribe, ready, notReady);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const pressed = useRef(false);
  useEffect(() => {
    if (!loaded || !pressed.current) return;
    pressed.current = false;
    triggerRef.current?.click();
  }, [loaded]);
  if (loaded) {
    const { trigger, ...rest } = props;
    return (
      <early.Card
        {...rest}
        trigger={(triggerProps) =>
          trigger({
            ...triggerProps,
            ref: {
              get current() {
                return triggerProps.ref.current;
              },
              set current(node: HTMLButtonElement | null) {
                triggerProps.ref.current = node;
                triggerRef.current = node;
              },
            },
          })
        }
      />
    );
  }
  return (
    <span className={cx(overlay.anchor, props.className)}>
      {props.trigger({
        ref: triggerRef,
        "aria-haspopup": "menu",
        "aria-expanded": false,
        "aria-controls": undefined,
        onClick: () => {
          pressed.current = true;
          early.start();
        },
        onKeyDown: () => undefined,
      })}
    </span>
  );
}
