import type { Metadata } from "next";

import { WorkModeStage } from "./work-mode-stage";
import "./work-mode.css";

export const metadata: Metadata = {
  title: "Work mode",
  description: "Synthetic registrar phone for My Day, roster, teaching, assessments, CPD and admin.",
};

/** Three interactive work-mode phones on one shared synthetic record. */
export default function WorkModePage() {
  return (
    <div className="wm-stage">
      <main className="wrap">
        <WorkModeStage />
      </main>
    </div>
  );
}
