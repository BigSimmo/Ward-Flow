"use client";

import { useEffect, useState, type ComponentType } from "react";

/**
 * A small Home card kept off the first load whose code is fetched as soon as Home's own code runs,
 * not when the browser is idle (11 Nov 2026). Home draws on the client after its data is ready, by
 * which time the card's code has normally arrived, so the card draws in Home's first frame instead
 * of arriving a second later and pushing the cards under it down (0.134 layout shift on a desktop,
 * over the 0.1 line). If the code is still on its way the card draws as soon as it lands, as
 * `next/dynamic` would. Errors are ignored: the card simply stays away.
 */
export function earlyHomeCard<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> {
  let loaded: ComponentType<P> | undefined;
  const pending =
    typeof window === "undefined"
      ? undefined
      : load().then(
          (component) => {
            loaded = component;
          },
          () => undefined,
        );
  function EarlyHomeCard(props: P) {
    const [Card, setCard] = useState<ComponentType<P> | undefined>(() => loaded);
    useEffect(() => {
      if (Card) return;
      let live = true;
      void pending?.then(() => {
        if (live && loaded) setCard(() => loaded);
      });
      return () => {
        live = false;
      };
    }, [Card]);
    return Card ? <Card {...props} /> : null;
  }
  return EarlyHomeCard;
}
