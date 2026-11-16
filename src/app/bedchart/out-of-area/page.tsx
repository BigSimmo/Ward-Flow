import type { Metadata } from "next";

import { OutOfAreaBoard } from "@/components/ward-management/out-of-area/out-of-area-board";

export const metadata: Metadata = {
  title: "Out of area — BedChart",
  description:
    "Synthetic out-of-area ledger for the BedChart prototype — who is in a bed far from home, and how long since they arrived.",
};

export default function WardOutOfAreaPage() {
  return <OutOfAreaBoard />;
}
