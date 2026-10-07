import type { Metadata } from "next";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { edById } from "@/components/ward-management/ward-sites";
import { safeDecodeURIComponent } from "@/lib/safe-url";

type Props = { params: Promise<{ edId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edId } = await params;
  const id = safeDecodeURIComponent(edId);
  const ed = edById(id);
  const site = ed?.name ?? id;
  return {
    title: `${site} - Ward Flow`,
    description: `Synthetic single-department emergency department view for ${site} in the Ward Flow prototype.`,
  };
}

export default async function EdDepartmentPage({ params }: Props) {
  const { edId } = await params;
  const id = safeDecodeURIComponent(edId);
  const ed = edById(id);
  return <EdScreen edId={ed ? ed.id : id} />;
}
