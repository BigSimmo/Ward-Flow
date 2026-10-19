import { redirect } from "next/navigation";

/**
 * Phase 2 retired the constellation command view into the coordinator screen and the network
 * diagram, and the Network screen itself was retired on 19 October 2026. The route stays as a
 * bookmark/deep-link backstop, so it now opens Home directly.
 */
export default function WardConstellationRedirect() {
  redirect("/ward-flow");
}
