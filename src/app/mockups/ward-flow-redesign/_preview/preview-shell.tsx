"use client";

import { useMemo, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { NavigationPromisesContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

import { useOptionalToast } from "@/components/wf";
import { WardBarMount } from "@/components/ward-management/shell/ward-bar";
import { WardRail } from "@/components/ward-management/shell/ward-rail-lazy";
import { WardGround } from "@/components/ward-management/ward-shell";

import layoutStyles from "../../../ward-flow/ward-flow-layout.module.css";
import shellFix from "./preview-shell.module.css";
import { mockupHrefForAppPath } from "./screens";

const NOT_DRAWN = "That page is not drawn in this mock-up.";

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
  const toast = useOptionalToast();
  const router = useMemo<AppRouterInstance>(() => {
    const go = (href: string, replace: boolean) => {
      const target = mockupHrefForAppPath(href, rolePrefix);
      if (target) {
        if (replace) realRouter.replace(target);
        else realRouter.push(target);
      } else toast?.push({ tone: "info", title: NOT_DRAWN });
    };
    return {
      ...realRouter,
      push: (href) => go(href, false),
      replace: (href) => go(href, true),
      prefetch: () => {},
    };
  }, [realRouter, toast, rolePrefix]);

  const keepLinksInMockups = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as Element).closest?.("a[href]");
    if (!anchor || event.defaultPrevented) return;
    const href = anchor.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("/mockups/")) return;
    event.preventDefault();
    event.stopPropagation();
    const target = mockupHrefForAppPath(href, rolePrefix);
    if (target) realRouter.push(target);
    else toast?.push({ tone: "info", title: NOT_DRAWN });
  };

  return (
    <AppRouterContext.Provider value={router}>
      <NavigationPromisesContext.Provider value={null}>
        <PathnameContext.Provider value={appPath}>
          <div className={`${layoutStyles.shellRow} ${shellFix.row}`} onClickCapture={keepLinksInMockups}>
            <WardRail />
            <div className={layoutStyles.shellContent} data-wf-scroller="">
              <WardBarMount />
              <WardGround>{children}</WardGround>
            </div>
          </div>
        </PathnameContext.Provider>
      </NavigationPromisesContext.Provider>
    </AppRouterContext.Provider>
  );
}
