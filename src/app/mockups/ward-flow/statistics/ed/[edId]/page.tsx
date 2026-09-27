import type { Metadata } from "next";

import { StatisticsEdScreen } from "@/components/ward-management/statistics/statistics-ed-screen";
import { edById } from "@/components/ward-management/ward-sites";

export const metadata: Metadata = {
  title: "Emergency department statistics — Ward Flow",
  description: "Synthetic single-department statistics section for the Ward Flow prototype.",
};

/**
 * One route serving every emergency department, not a page per department.
 *
 * `params` is a Promise in this version of Next and is awaited here; `decodeURIComponent` undoes
 * the encoding `edStatisticsHref` applies on the way out. An id that resolves to no department is
 * the screen's own honest not-found state — never a fallback to a different department.
 */
export default async function WardStatisticsEdPage({ params }: { params: Promise<{ edId: string }> }) {
  const { edId } = await params;
  const id = decodeURIComponent(edId);
  const ed = edById(id);
  return <StatisticsEdScreen edId={ed ? ed.id : id} />;
}
