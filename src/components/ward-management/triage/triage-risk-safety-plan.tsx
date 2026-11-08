"use client";

/**
 * Build safety plan (Josh approved the build, 9 Nov 2026; wording held for his sign-off): the six
 * Stanley–Brown steps and reasons for living, each in the person's own words, added under the
 * plan's Safety plan headings. Step 4 offers the record's contacts and step 5 the services list as
 * tap-to-add chips; step 6 starts from the means safety rows that are answered. The draft lives in
 * React state only, like every typed box on the form. Synthetic data only.
 */
import { useState } from "react";

import {
  Button,
  ChipGroup,
  Checkbox,
  DrawerFootRow,
  Field,
  FilterChip,
  PanelDrawer,
  TextInput,
  phoneRows,
} from "@/components/wf";

import type { FormApi } from "./triage-risk-parts";
import { contactsFor } from "./triage-risk-pops";
import {
  BLANK_SAFETY_PLAN,
  SAFETY_PLAN_SERVICES,
  SAFETY_PLAN_STEPS,
  applySafetyPlan,
  hasItem,
  serviceText,
  stepsFilled,
  toggleItem,
  type SafetyPlanDraft,
} from "./triage-risk-safety";
import styles from "./triage-risk-form.module.css";

/** "Marrowby, Rosa" to "Rosa": the given name, for the drawer's title. */
const givenName = (name: string) => (name.split(",")[1] ?? name).trim().split(/\s+/)[0] || name;

export function SafetyPlanDrawer({
  form,
  open,
  onClose,
  prefillSafer,
}: {
  form: FormApi;
  open: boolean;
  onClose: () => void;
  /** The answered means safety rows, to start step 6 when it is empty. */
  prefillSafer: string;
}) {
  const { state } = form;
  const [draft, setDraft] = useState<SafetyPlanDraft>(BLANK_SAFETY_PLAN);
  const [wasOpen, setWasOpen] = useState(open);
  // On opening, step 6 starts from the means safety rows when it is still empty.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && !draft.safer.trim() && prefillSafer) setDraft((d) => ({ ...d, safer: prefillSafer }));
  }
  const contacts = contactsFor(state.person.id);
  const filled = stepsFilled(draft);
  const anything = SAFETY_PLAN_STEPS.some((step) => draft[step.key].trim()) || draft.withPerson;
  const set = (key: keyof SafetyPlanDraft, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }));
  const add = () => {
    form.setText("rp", applySafetyPlan(state.text.rp, draft));
    form.say("Safety plan added under the plan headings.");
    onClose();
  };
  const chips = (key: "people" | "services", label: string, items: readonly (readonly [string, string])[]) => (
    <ChipGroup label={label} className={phoneRows.chipRow}>
      {items.map(([item, chipLabel]) => (
        <FilterChip
          key={item}
          className={phoneRows.chip}
          pressed={hasItem(draft[key], item)}
          onPressedChange={() => set(key, toggleItem(draft[key], item))}
        >
          {chipLabel}
        </FilterChip>
      ))}
    </ChipGroup>
  );
  return (
    <PanelDrawer
      open={open}
      onClose={onClose}
      title={`Safety plan with ${givenName(state.person.name)}`}
      subtitle="In their words. Short lines are fine."
      testId="triage-safety-plan-sheet"
      bodyClassName={styles.sheetBody}
      foot={
        <>
          <span className={styles.footText} data-testid="triage-safety-plan-count">
            {filled} of 6 steps
          </span>
          <DrawerFootRow>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="pri"
              disabledReason={anything ? undefined : "Fill in at least one step first"}
              reasonDisplay="tooltip"
              onClick={add}
            >
              Add to plan
            </Button>
          </DrawerFootRow>
        </>
      }
    >
      <div className={styles.pane}>
        {SAFETY_PLAN_STEPS.map((step) => (
          <div key={step.key} className={styles.stack}>
            <Field label={step.n ? `${step.n} ${step.label}` : step.label}>
              <TextInput
                placeholder={step.placeholder}
                value={draft[step.key]}
                onChange={(event) => set(step.key, event.target.value)}
              />
            </Field>
            {step.key === "people" ? (
              contacts.length ? (
                chips(
                  "people",
                  "Contacts on the record",
                  contacts.map((c) => [
                    `${c.name} (${(c.relationship ?? c.role).toLowerCase()})${c.phone ? ` ${c.phone}` : ""}`,
                    `${c.name} · ${c.relationship ?? c.role}`,
                  ]),
                )
              ) : (
                <span className={styles.quiet}>No contacts on the record.</span>
              )
            ) : null}
            {step.key === "services"
              ? chips(
                  "services",
                  "Services",
                  SAFETY_PLAN_SERVICES.map((service) => [serviceText(service), service[0]]),
                )
              : null}
          </div>
        ))}
        <Checkbox
          label="Made with the person"
          checked={draft.withPerson}
          onChange={(event) => set("withPerson", event.target.checked)}
        />
      </div>
    </PanelDrawer>
  );
}
