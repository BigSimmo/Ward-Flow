import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EdScreen } from "@/components/ward-management/ed/ed-screen";
import { knownEmergencyDepartment } from "@/components/ward-management/ward-known-places";
import { safeDecodeURIComponent } from "@/components/ward-management/ward-safe-url";

type Props = { params: Promise<{ edId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { edId } = await params;
  const id = safeDecodeURIComponent(edId);
  const ed = knownEmergencyDepartment(id);
  const site = ed?.name ?? id;
  return {
    title: `${site} — Ward Flow`,
    description: `Synthetic single-department emergency department view for ${site} in the Ward Flow prototype.`,
  };
}

export default async function EdDepartmentPage({ params }: Props) {
  const { edId } = await params;
  const id = safeDecodeURIComponent(edId);
  const ed = knownEmergencyDepartment(id);
  // DA-32: an address that names no emergency department shows "Page not found", not a page reporting success.
  if (!ed) notFound();
  return <EdScreen edId={ed.id} />;
}
