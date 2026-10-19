import { redirect } from "next/navigation";

/**
 * The Network screen was retired on 19 October 2026 (Josh's decision): it repeated Home and
 * Capacity, and its one unique part, ready beds by road time, moved to Capacity. The route stays as
 * a bookmark backstop so an old link opens Home rather than a 404.
 */
export default function WardNetworkRedirect() {
  redirect("/ward-flow");
}
