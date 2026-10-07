import localFont from "next/font/local";
import type { Metadata } from "next";

import { WorkModeApp } from "./work-mode-app";
import "./work-mode.css";

const figtree = localFont({
  src: "../../../fonts/figtree-wght.ttf",
  variable: "--font-figtree",
  display: "swap",
  weight: "300 900",
});

export const metadata: Metadata = {
  title: "PsychSift work mode",
  description: "Synthetic work-mode phone for My Day, roster, teaching, assessments, CPD and admin.",
};

/** Interactive phone from the PsychSift work-mode HTML. Synthetic records only. */
export default function WorkModePage() {
  return (
    <div className={`${figtree.variable} wm-stage`}>
      <main className="wrap">
        <section className="intro">
          <h1>PsychSift work mode</h1>
          <p>
            The live phone for My Day, Roster, Teaching, Assessments, CPD and Admin. Swipe between the three tabs, or
            open More. All names, numbers and records are made up. The source gallery also lists extra states, such as
            offline and signed out, that this phone does not show.
          </p>
          <div className="rules">
            <span>Three tabs plus More on every area</span>
            <span>Swipe sideways between tabs</span>
            <span>Glass only on floating controls</span>
            <span>Most urgent item at the top</span>
            <span>Nothing is sent without a tap</span>
          </div>
        </section>
        <WorkModeApp />
      </main>
    </div>
  );
}
