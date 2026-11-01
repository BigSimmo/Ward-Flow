"use client";

import { FrontDoorPage } from "@/components/ward-management/front-door/front-door-page";

/**
 * WARD FLOW — SIGN IN.
 *
 * Josh, 1 November 2026 (Q164 to Q166): this page is the front door's own sign-in card, with
 * Username and Password, in place of the old "Sign in and role" chooser. It signs in to a real
 * Ward Flow account with the same sign-in the /sign-in page uses (`useFrontDoorAuth`), so each
 * account then opens at its own role's home with only that role's access; an access admin gives
 * each account its role. The username is the account's work email, as accounts sign in today.
 * "Explore the demo" under the card opens the public demo, which asks for its usual demo code; the
 * code is never built into this page.
 *
 * A site without account sign-in set up (the local demo) says so on the card rather than pretending
 * to sign anyone in. Nothing here keeps the password: the card clears it as soon as it is sent.
 *
 * A sibling of `/ward-flow`, not a child of it, so it carries no rail or bar: a person who has not
 * signed in has no rail to stand in and no bar to read.
 */
export function WardFlowSignInScreen() {
  return <FrontDoorPage next="/ward-flow" mode="account" tv={false} accountLabel="Username" />;
}
