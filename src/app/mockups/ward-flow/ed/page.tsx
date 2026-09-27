import { redirect } from "next/navigation";

/**
 * Route backstop for `/mockups/ward-flow/ed`.
 *
 * Emergency departments in Ward Flow are dynamic routes (`/ed/[edId]`).
 * Visiting `/mockups/ward-flow/ed` directly redirects to Peel ED (`/mockups/ward-flow/ed/peel-ed`), the
 * same ED the rail's Emergency department entry opens, preventing 404 dead ends. (It used to name
 * `fremantle-ed`, which is not a seeded ED: Fremantle has none, so the redirect landed on "not found".)
 */
export default function WardEdDefaultRedirect() {
  redirect("/mockups/ward-flow/ed/peel-ed");
}
