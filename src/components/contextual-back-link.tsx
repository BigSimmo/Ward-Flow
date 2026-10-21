"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";

type NavigationCapability = {
  canGoBack?: boolean;
};

type WindowWithNavigation = Window & {
  navigation?: NavigationCapability;
};

function canNavigateBack(): boolean {
  if (typeof window === "undefined") return false;
  const canGoBack = (window as WindowWithNavigation).navigation?.canGoBack;
  return typeof canGoBack === "boolean" ? canGoBack : window.history.length > 1;
}

export function navigateContextuallyBack(
  router: Pick<ReturnType<typeof useRouter>, "back" | "replace">,
  fallbackHref: string,
  canUseHistory: () => boolean,
  onFallback?: () => void,
  /** Return false to stay put. Only the fallback needs it: a history step is guarded on popstate. */
  confirmFallback?: () => boolean,
) {
  if (canUseHistory() && canNavigateBack()) {
    router.back();
    return;
  }
  if (confirmFallback && !confirmFallback()) return;
  onFallback?.();
  router.replace(fallbackHref);
}

function isUnmodifiedPrimaryClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey &&
    (!event.currentTarget.target || event.currentTarget.target === "_self")
  );
}

export type ContextualBackLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onClick"> & {
  fallbackHref: string;
  /** Return false to keep the user on the current page. */
  onBeforeNavigate?: () => boolean;
  /** Return false to go to the fallback even when the tab has history (it may lead off the app). */
  canUseHistory?: () => boolean;
  /** Called just before the fallback replaces the current page. */
  onFallback?: () => void;
  onClick?: ComponentProps<typeof Link>["onClick"];
};

/**
 * A real fallback link for deep links/new tabs that otherwise follows the
 * current tab's browser history. Modified clicks keep normal link semantics.
 */
export function ContextualBackLink({
  fallbackHref,
  onBeforeNavigate,
  canUseHistory = () => true,
  onFallback,
  onClick,
  children,
  ...props
}: ContextualBackLinkProps) {
  const router = useRouter();

  return (
    <Link
      {...props}
      href={fallbackHref}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (onBeforeNavigate && !onBeforeNavigate()) {
          event.preventDefault();
          return;
        }
        if (!isUnmodifiedPrimaryClick(event)) return;
        event.preventDefault();
        navigateContextuallyBack(router, fallbackHref, canUseHistory, onFallback);
      }}
    >
      {children}
    </Link>
  );
}
