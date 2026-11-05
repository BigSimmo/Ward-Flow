import { redirect } from "next/navigation";

/**
 * PL1 (Josh, 3 Nov 2026): Community folded into Places as its Catchments tab and left the sidebar.
 * The index URL stays as a redirect so old links and a coordinator who trims a team id from the
 * address bar still land on the list; each team's own page stays at `community/[teamId]`.
 * The literal path matches `PLACES_CATCHMENTS_HREF` in `hub/places-hrefs.ts`.
 */
export default function CommunityIndexPage() {
  redirect("/ward-flow/hub/catchments");
}
