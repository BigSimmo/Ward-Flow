import { redirect } from "next/navigation";

/**
 * Route alias for the primary command dashboard.
 * Redirects to the canonical home /mockups/ward-flow.
 */
export default function WardCommandRedirect() {
  redirect("/mockups/ward-flow");
}
