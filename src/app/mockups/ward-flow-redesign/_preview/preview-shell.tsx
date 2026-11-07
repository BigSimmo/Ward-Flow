"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NavigationPromisesContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { useIsPhone, useOptionalToast } from "@/components/wf";
import { NewChoice, type NewChoiceKind } from "@/components/ward-redesign/new-choice/new-choice";
import { PreviewBarMount as WardBarMount } from "@/components/ward-redesign/shell/preview-bar";
import { PreviewRail as WardRail } from "@/components/ward-redesign/shell/preview-rail";
// shell-next (30 Oct 2026): `?shell=next` draws the sidebar and header redesign instead.
import { NextBarMount } from "@/components/ward-redesign/shell-next/next-bar";
import { NextRail } from "@/components/ward-redesign/shell-next/next-rail";
import { WardGround } from "@/components/ward-management/ward-shell";

import layoutStyles from "../../../ward-flow/ward-flow-layout.module.css";
import { MOCKUP_BASE, mockupHrefForAppPath } from "./screens";

const NOT_DRAWN = "That page is not drawn in this mock-up.";
const NOT_DRAWN_FOR_ROLE = "That page is not drawn for this desk in the mock-up.";

/** A link from a page drawn in the redesigned frame stays in that frame. */
function keepShell(target: string | null, nextShell: boolean): string | null {
  return target && nextShell ? `${target}?shell=next` : target;
}

/** The app bar's and the phone dock's Activity buttons. */
const ACTIVITY_TRIGGERS = '[data-testid="ward-bar-activity-trigger"], [data-testid="ward-phone-menu-activity"]';

/**
 * A page that draws its own Activity panel (the Home and Activity mock-up) marks itself with this
 * attribute; the shell then sends this event instead of opening the bar's own drawer.
 */
const OWN_ACTIVITY_PANEL = "[data-mockup-activity-panel]";
const OPEN_ACTIVITY_EVENT = "wf-mockup:open-activity";

/**
 * Mock-up (7 Nov 2026): the bar's New referral button (the new-referral kind has no popup of its
 * own), the phone Create sheet's New referral and the phone menu's New referral open the New chooser
 * (Triage or Referral) instead of the referral slide-out.
 */
const NEW_TRIGGERS = [
  '[data-testid="ward-bar-primary-action"]:not([aria-haspopup])',
  '[data-testid="ward-phone-create-referral"]',
  '[data-testid="ward-phone-new-referral"]',
].join(", ");

/**
 * Preview only. Draws a redesigned page inside the app's own rail and header, so the mock-up is
 * judged in the real chrome rather than a copy of it. The shell finds its active page, title and
 * main action from the address, so this tells it the address the page will have once built
 * (`appPath`), and sends any link or router call back into the mock-ups instead of out to the
 * running app. Nothing below the shell knows it is in a preview.
 */
export function PreviewShell({
  appPath,
  rolePrefix,
  children,
}: {
  appPath: string;
  /** A role view's slug prefix (`as-ward-`), so its links stay in that role's views. */
  rolePrefix?: string;
  children: ReactNode;
}) {
  const realRouter = useRouter();
  // The shareable copy has no search-params context, so it reads the address itself.
  const shellParam =
    useSearchParams()?.get("shell") ??
    (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("shell"));
  const nextShell = shellParam === "next";
  const Rail = nextShell ? NextRail : WardRail;
  const BarMount = nextShell ? NextBarMount : WardBarMount;
  const toast = useOptionalToast();
  const isPhone = useIsPhone();
  // The New chooser, and the one click that must reach the shell's own New referral handler.
  const [chooser, setChooser] = useState<{ trigger: HTMLElement } | null>(null);
  const passNewClick = useRef(false);
  useEffect(() => {
    const trigger = chooser?.trigger;
    if (!trigger || isPhone) return;
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", "new-choice-menu");
    return () => {
      trigger.removeAttribute("aria-expanded");
      trigger.removeAttribute("aria-controls");
    };
  }, [chooser, isPhone]);
  const closeChooser = useCallback(
    (returnFocus: boolean) => {
      const trigger = chooser?.trigger;
      setChooser(null);
      // The phone Sheet hands focus back itself.
      if (returnFocus && !isPhone && trigger?.isConnected) trigger.focus();
    },
    [chooser, isPhone],
  );
  const chooseNew = (kind: NewChoiceKind) => {
    const trigger = chooser?.trigger;
    setChooser(null);
    if (kind === "triage") {
      realRouter.push(`${MOCKUP_BASE}/triage-risk?start=new${nextShell ? "&shell=next" : ""}`);
      return;
    }
    // Referral: the original button's own handler opens the slide-out exactly as today.
    window.setTimeout(() => {
      if (!trigger?.isConnected) return;
      passNewClick.current = true;
      try {
        trigger.click();
      } finally {
        passNewClick.current = false;
      }
    }, 0);
  };
  const router = useMemo<AppRouterInstance>(() => {
    const go = (href: string, replace: boolean) => {
      const target = keepShell(mockupHrefForAppPath(href, rolePrefix), nextShell);
      if (target) {
        if (replace) realRouter.replace(target);
        else realRouter.push(target);
      } else toast?.push({ tone: "info", title: rolePrefix ? NOT_DRAWN_FOR_ROLE : NOT_DRAWN });
    };
    return {
      ...realRouter,
      push: (href) => go(href, false),
      replace: (href) => go(href, true),
      prefetch: () => {},
    };
  }, [realRouter, toast, rolePrefix, nextShell]);

  const keepLinksInMockups = (event: MouseEvent<HTMLDivElement>) => {
    // Mock-up only: New referral opens the New chooser first (Triage or Referral).
    const newTrigger = (event.target as Element).closest?.<HTMLElement>(NEW_TRIGGERS);
    if (newTrigger && !passNewClick.current) {
      event.preventDefault();
      event.stopPropagation();
      setChooser((open) => (open?.trigger === newTrigger ? null : { trigger: newTrigger }));
      return;
    }
    // Mock-up only: the Activity button opens the page's redesigned panel when the page has one.
    if ((event.target as Element).closest?.(ACTIVITY_TRIGGERS) && document.querySelector(OWN_ACTIVITY_PANEL)) {
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(new Event(OPEN_ACTIVITY_EVENT));
      return;
    }
    const anchor = (event.target as Element).closest?.("a[href]");
    if (!anchor || event.defaultPrevented) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("/mockups/")) return;
    event.preventDefault();
    event.stopPropagation();
    const target = keepShell(mockupHrefForAppPath(href, rolePrefix), nextShell);
    if (target) realRouter.push(target);
    else toast?.push({ tone: "info", title: rolePrefix ? NOT_DRAWN_FOR_ROLE : NOT_DRAWN });
  };

  return (
    <AppRouterContext.Provider value={router}>
      <NavigationPromisesContext.Provider value={null}>
        <PathnameContext.Provider value={appPath}>
          <div className={layoutStyles.shellRow} onClickCapture={keepLinksInMockups}>
            <Rail />
            <div className={layoutStyles.shellContent} data-wf-scroller="">
              <BarMount />
              <WardGround>{children}</WardGround>
            </div>
          </div>
          {chooser ? (
            <NewChoice trigger={chooser.trigger} phone={isPhone} onClose={closeChooser} onChoose={chooseNew} />
          ) : null}
        </PathnameContext.Provider>
      </NavigationPromisesContext.Provider>
    </AppRouterContext.Provider>
  );
}
