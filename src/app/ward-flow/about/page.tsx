import type { Metadata } from "next";

import { AboutDemoScreen } from "@/components/ward-management/about/about-demo-screen";

export const metadata: Metadata = {
  title: "About this demo — Ward Flow",
  description:
    "Synthetic prototype: what this demo is, that every record is invented, what the browser keeps and sends, and how to leave.",
};

/** F-77 (Audit 15, A15-25): a short "About this demo" page behind the demo code. Linked from Settings, About. */
export default function WardAboutDemoPage() {
  return <AboutDemoScreen />;
}
