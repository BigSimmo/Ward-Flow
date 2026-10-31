"use client";

/**
 * MOCK-UP for Josh's approval (D-74, D-75): search and forms, built from the app's own components
 * and synthetic data. Nothing here changes a `/ward-flow` screen. Resize the window to see each
 * device; every control works against the synthetic world.
 */
import { useState } from "react";

import { Button, Card, CardBody, CardHead, Segmented, ToastProvider } from "@/components/wf";
import { REFERRAL_CONTACT_OUTCOMES } from "@/components/ward-management/referrals/referral-owner-and-calls";
import { WardFlowProvider, useWardFlowSelect } from "@/components/ward-management/ward-flow-provider";
import { siteByCode } from "@/components/ward-management/ward-sites";

import { PageSearchField } from "./page-search-field";
import { SearchPopOut, SearchPopOutBody } from "./search-pop-out";
import styles from "./search-review-page.module.css";
import { TimePresetsField } from "./time-presets";

function Notes({ today, proposed }: { today: readonly string[]; proposed: readonly string[] }) {
  return (
    <div className={styles.notes}>
      <div>
        <h4>Today</h4>
        <ul>
          {today.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div>
        <h4>Proposed</h4>
        <ul>
          {proposed.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Mockup() {
  const { units } = useWardFlowSelect("units");
  const [popOpen, setPopOpen] = useState(false);
  const [outcome, setOutcome] = useState<string>("");
  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Mock-up for review · not built into Ward Flow</p>
        <h1>Search and forms</h1>
        <p>
          Built from the running app&rsquo;s own components and synthetic data. Approving one part does not approve the
          others. Resize the window to see phone, tablet and computer.
        </p>
      </header>

      <Card>
        <CardHead title="1. The main search as a pop-out" />
        <CardBody>
          <Notes
            today={[
              "Phone: the bar's search icon turns the bar into a field, with results in a full page under it.",
              "Tablet: the field takes its own row in the bar; in portrait it folds to a magnifier.",
              "Computer: a glass popover under the field, with a preview beside the list.",
            ]}
            proposed={[
              "Phone: the icon (and a Search button in the bottom bar) opens a full-height sheet, as Help does, with the field pinned at the top and Cancel to close.",
              "Before typing: a few tappable examples of what search answers, including a Help question.",
              "Tablet and computer: the same contents as a centred pop-out; matched words are marked in each row.",
              "Kind chips: All, People, Places, Contacts and Help, each with its count.",
            ]}
          />
          <div className={styles.actions}>
            <Button onClick={() => setPopOpen(true)}>Open the pop-out</Button>
          </div>
          <div className={styles.inlineFrame} aria-label="The pop-out's contents, drawn in the page">
            <SearchPopOutBody initialQuery="how do I book transport" />
          </div>
          <SearchPopOut open={popOpen} onClose={() => setPopOpen(false)} />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="2. One page search box" />
        <CardBody>
          <Notes
            today={[
              "About 18 page boxes are hand-made, each with its own style; two draw their own magnifier and one uses a text glyph.",
              "Several phone boxes have no clear button, and two placeholders promised fields that were not searched (fixed in this branch).",
            ]}
            proposed={[
              "Every page box uses the kit field: magnifier, clear button, the / hint on a computer.",
              "A count line under it: “4 of 23 wards”.",
              "It sits just above the list it narrows; on a phone it spans the width and stays pinned while the list scrolls.",
            ]}
          />
          <PageSearchField
            items={units}
            fieldsOf={(unit) => [unit.name, unit.siteCode, siteByCode(unit.siteCode)?.name, unit.cohort]}
            label="Find a ward"
            placeholder="Ward, hospital or cohort"
            noun="wards"
            render={(unit) => (
              <li key={unit.id} className={styles.listRow}>
                <strong>{unit.name}</strong> <span>{siteByCode(unit.siteCode)?.name ?? unit.siteCode}</span>
              </li>
            )}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHead title="3. Forms: quick times and one-tap answers" />
        <CardBody>
          <Notes
            today={[
              "Six screens each have their own time buttons; most typed time fields have none, and time is entered three different ways.",
              "Short fixed lists (two to five answers) are drop-down menus: two taps and a scroll.",
              "The ED board's patient field is a browser list that behaves poorly on an iPhone.",
            ]}
            proposed={[
              "One row of time buttons (Now, +15m, +30m, +1h) beside a typed time, reading the board's clock. Only for a time someone writes down, never a legal expiry.",
              "Typed times take 14:30 or 1430 everywhere.",
              "Lists of five or fewer answers become one-tap choices with nothing chosen first. The answers themselves are unchanged.",
              "The ED board's patient field uses the same people search as the rest of the app.",
            ]}
          />
          <div className={styles.formDemo}>
            <TimePresetsField label="Time the form was written" />
            <div>
              <p className={styles.fieldLabel}>Call outcome</p>
              <Segmented
                label="Call outcome"
                value={outcome}
                onChange={setOutcome}
                size="md"
                items={REFERRAL_CONTACT_OUTCOMES.map((choice) => ({ id: choice.id, label: choice.label }))}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="4. Merges left for this review" />
        <CardBody>
          <Notes
            today={[
              "Statistics has two “Open a unit” finders (the main page and Compare).",
              "“Find a ward” is a separate list in Ask more wards and in the patient record's transit panel.",
              "Three suburb lookups (Community, the ward's Discharges tab, Tools) now share one engine and all take a postcode.",
            ]}
            proposed={[
              "Compare uses the main page's finder (the #1118 mock-up also moves it into the tab row).",
              "One ward picker for both places.",
              "One suburb lookup card, with the team links and contested readings the three have between them.",
            ]}
          />
        </CardBody>
      </Card>
    </main>
  );
}

export function SearchReviewPage() {
  return (
    <ToastProvider>
      <WardFlowProvider>
        <Mockup />
      </WardFlowProvider>
    </ToastProvider>
  );
}
