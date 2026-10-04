import { redirect } from "next/navigation";

/**
 * The front page. Ward Flow is the only app left since the former clinical app was removed (25 September 2026),
 * and "/" had no page, so it showed "not found". Josh, 26 September 2026 (item 9, "Yes to all
 * recommendation"): the front page opens the Coordinator view.
 */
export default function RootRedirect() {
  redirect("/mockups/ward-flow");
}
