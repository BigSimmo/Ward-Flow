"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

import { preloadWhenIdle } from "@/components/ward-management/preload-when-idle";

import styles from "./front-door.module.css";

/**
 * The app's own front door, loaded only when it shows. Every page carries the shared access shell,
 * but only the signed-in site ever signs in there, so the sign-in screens stay out of the phone's
 * first load (about 15 KB gzipped on every page otherwise). The signed-in site fetches them once the
 * page is idle, so a sign-out normally finds them already there.
 */
const loadFrontDoor = () => import("./front-door");

/** The navy screen alone, while the sign-in code arrives, so nothing of the app shows meanwhile. */
function Hold() {
  return <div className={styles.screen} aria-busy="true" />;
}

export const FrontDoor = dynamic(() => loadFrontDoor().then((module) => module.FrontDoor), {
  ssr: false,
  loading: Hold,
});

export const FrontDoorStatus = dynamic(() => loadFrontDoor().then((module) => module.FrontDoorStatus), {
  ssr: false,
  loading: Hold,
});

/** A way on from a `FrontDoorStatus` screen: the one primary button, or a plain link. */
export function FrontDoorStatusButton({
  onClick,
  primary,
  children,
}: {
  onClick: () => void;
  primary?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className={primary ? `${styles.btn} ${styles.btnPrimary}` : styles.link} onClick={onClick}>
      {children}
    </button>
  );
}

if (process.env.NEXT_PUBLIC_WARD_SHARED_ENABLED === "true") preloadWhenIdle(loadFrontDoor);
