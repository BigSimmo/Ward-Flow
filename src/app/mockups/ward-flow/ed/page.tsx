import type { Metadata } from "next";

import { EdIndex } from "@/components/ward-management/ed/ed-index";

export const metadata: Metadata = {
  title: "Emergency departments — Ward Flow",
  description:
    "Synthetic statewide emergency department index for the Ward Flow prototype — every ED with the people waiting there for a bed, each linking to its own ED screen.",
};

/**
 * `/mockups/ward-flow/ed`: every emergency department, the way All wards lists every ward. It was
 * a redirect to Peel ED until 9 Oct 2026, which left the rail's Emergency entry opening one
 * arbitrary department with no way to see the others side by side.
 */
export default function EdIndexPage() {
  return <EdIndex />;
}
