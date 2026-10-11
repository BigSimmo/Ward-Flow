import type { Metadata } from "next";

import { edById } from "@/components/ward-management/ward-sites";
import { parseEdPreviewOption } from "@/components/ward-management/preview/preview-option";
import { EdPagePreview } from "@/components/ward-management/preview/ed-page-preview";

export const metadata: Metadata = {
  title: "ED page mockup - Ward Flow",
  description: "Preview only: three options for the ED page board, Needs you and row actions, on synthetic records.",
};

/** Preview-only mockup route (device audit 11 Oct 2026). Not in the navigation. */
export default async function EdPagePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ option?: string; ed?: string }>;
}) {
  const query = await searchParams;
  const ed = edById(query?.ed ?? "peel-ed") ?? edById("peel-ed");
  return <EdPagePreview option={parseEdPreviewOption(query?.option)} edId={ed?.id ?? "peel-ed"} />;
}
