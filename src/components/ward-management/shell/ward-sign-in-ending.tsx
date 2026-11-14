"use client";

import { useEffect, useState } from "react";
import { FRONT_DOOR_END_COOKIE, FRONT_DOOR_SIGN_IN_PATH } from "@/lib/front-door-pass";
import styles from "./ward-sign-in-ending.module.css";

/** R-STRUCT-43 and R-STRUCT-51: the strip shows this long before the sign-in limit (or demo code) ends. */
export const SIGN_IN_ENDING_WARNING_MS = 10 * 60_000;

export type SignInEnd = { kind: "account" | "demo"; endsAt: number };

/** Reads the pass's readable end cookie (`account.<ms>` or `demo.<ms>`). Null when absent or unreadable. */
export function readSignInEnd(cookieString: string): SignInEnd | null {
  const entry = cookieString.split(/;\s*/).find((part) => part.startsWith(`${FRONT_DOOR_END_COOKIE}=`));
  const match = /^(account|demo)\.(\d{10,16})$/.exec(entry?.slice(FRONT_DOOR_END_COOKIE.length + 1) ?? "");
  return match ? { kind: match[1] as SignInEnd["kind"], endsAt: Number(match[2]) } : null;
}

/** The end to warn about now, or null when it is not within the warning window or already past. */
export function signInEndingSoon(end: SignInEnd | null, now: number): SignInEnd | null {
  if (!end) return null;
  const left = end.endsAt - now;
  return left > 0 && left <= SIGN_IN_ENDING_WARNING_MS ? end : null;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", hour12: false });
}

/** A neutral strip 10 minutes before the sign-in limit (8 hours for a demo code) ends the session. */
export function WardSignInEnding() {
  const [end, setEnd] = useState<SignInEnd | null>(null);
  useEffect(() => {
    const check = () => {
      try {
        setEnd(signInEndingSoon(readSignInEnd(document.cookie), Date.now()));
      } catch {
        setEnd(null);
      }
    };
    check();
    const timer = setInterval(check, 30_000);
    return () => clearInterval(timer);
  }, []);
  if (!end) return null;
  return (
    <p className={styles.strip} role="status" data-testid="ward-sign-in-ending">
      {end.kind === "demo" ? "The demo code ends" : "Your sign-in ends"} at {clock(end.endsAt)}. Save what you are
      doing, then <a href={FRONT_DOOR_SIGN_IN_PATH}>sign in again</a>.
    </p>
  );
}
