import { durMinutes } from "@/components/wf";

/**
 * A plain age in minutes (v10 content rule "Ages use the plain age, for example 5h"): the shared
 * duration with a whole hour's "00m" dropped, so 300 reads "5h" and 200 reads "3h 20m".
 * Page-local until the shared `dur` drops it itself (requested of the foundation owner).
 */
export function plainAge(minutes: number): string {
  return durMinutes(minutes).replace(/^(\d+h) 00m$/, "$1");
}
