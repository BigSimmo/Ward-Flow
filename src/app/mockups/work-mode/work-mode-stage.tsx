"use client";

import { useReducer } from "react";
import { RotateCcw, Sun } from "lucide-react";

import { Button, IconTile } from "@/components/wf";

import { initialStageState, reduceStage } from "./stage";
import { WorkModeApp } from "./work-mode-app";

const PHONES = [
  { label: "My Day", meta: "My Day, today" },
  { label: "Needs you", meta: "Shares state with My Day" },
  { label: "Roster swap", meta: "Answer by 17:00" },
] as const;

/**
 * v6 Work mode (7 October 2026, `design/pages-v6/WorkMode.png`): one bar, then three phones side by
 * side on one shared record. Reset puts every phone back to its opening screen.
 */
export function WorkModeStage() {
  const [phones, dispatch] = useReducer(reduceStage, initialStageState);

  return (
    <div className="wm-v6">
      <header className="wm-bar">
        <IconTile icon={Sun} />
        <div className="wm-bar-text">
          <h1>Work mode</h1>
          <p>Registrar phone, synthetic records</p>
        </div>
        <Button variant="sec" size="sm" icon={RotateCcw} onClick={() => dispatch({ type: "reset" })}>
          Reset
        </Button>
      </header>
      <div className="wm-phones">
        {PHONES.map((phone, index) => (
          <section className="wm-col" key={phone.label} aria-labelledby={`wm-cap-${index}`}>
            <div className="wm-cap">
              <h2 id={`wm-cap-${index}`}>{phone.label}</h2>
              <span>{phone.meta}</span>
            </div>
            <WorkModeApp
              label={`${phone.label} phone`}
              state={phones[index]!}
              dispatch={(action) => dispatch({ type: "phone", phone: index, action })}
            />
          </section>
        ))}
      </div>
    </div>
  );
}
