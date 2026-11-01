"use client";

// The Alerts screen's broadcast composer. Alerts redesign (1 Nov 2026, BUILD-SPEC "Broadcast
// composer"): a 960px side sheet with the form on the left, what each desk sees on the right and the
// action bar along the bottom; one column in a bottom sheet on phone. Built from the approved mock-up
// (`mockups/alerts/alerts-redesign/mock.js`, `composer()`).
import type { RefObject } from "react";
import { BedDouble, Check, ChevronDown, Info, Megaphone, Radio, Send, Sparkles, X } from "lucide-react";

import { Button, Checkbox, Field, Segmented, StatusGlyph, TextInput, Textarea, cx, useIsPhone } from "@/components/wf";
import type { Instant } from "@/components/ward-management/ward-clock";
import { formatInstant } from "@/components/ward-management/ward-clock";

import { WA_BROADCAST_TEMPLATES, type BroadcastKind, type BroadcastSeverity } from "./ward-broadcast-model";
import {
  QUICK_STARTS,
  audienceRecipients,
  type AudienceGroup,
  type AudienceMode,
  type BroadcastAudience,
} from "./broadcast-audience";
import css from "./broadcast.module.css";

const SEVERITIES: { id: BroadcastSeverity; label: string; tone: "neutral" | "warning" | "danger"; hint: string }[] = [
  { id: "advisory", label: "Advisory", tone: "neutral", hint: "For information. No action needed." },
  { id: "warning", label: "Warning", tone: "warning", hint: "Needs attention today." },
  { id: "critical", label: "Critical", tone: "danger", hint: "Needs action now. Use only for safety or gridlock." },
];
const DURATIONS = [
  [30, "30m"],
  [60, "1h"],
  [120, "2h"],
  [240, "4h"],
  [480, "8h"],
  [720, "12h"],
] as const;
const AUDIENCE_ITEMS: { id: AudienceMode; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "groups", label: "By group" },
  { id: "pick", label: "Choose units" },
];
const units = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;
const quickStartName = (id: string) =>
  id === "custom" ? "Blank" : (WA_BROADCAST_TEMPLATES.find((tmpl) => tmpl.id === id)?.name ?? id);

export type LiveBedCall = { id: string; label: string; minutesLeft: string };

export function BroadcastComposer({
  modalRef,
  modalCloseRef,
  onClose,
  refusedFeedback,
  kind,
  onSelectKind,
  templateId,
  onSelectTemplate,
  audience,
  setAudience,
  groups,
  wardsWithBedNow,
  severity,
  setSeverity,
  durationMinutes,
  setDurationMinutes,
  title,
  setTitle,
  message,
  setMessage,
  confirmed,
  setConfirmed,
  sending,
  liveBedCall,
  onExtendLive,
  senderName,
  now,
  onSend,
}: {
  modalRef: RefObject<HTMLDivElement | null>;
  modalCloseRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  /** The refusal to show at the top of the form, or null. */
  refusedFeedback: string | null;
  kind: BroadcastKind;
  onSelectKind: (kind: "bed_call" | "directive") => void;
  templateId: string;
  onSelectTemplate: (templateId: string) => void;
  audience: BroadcastAudience;
  setAudience: (audience: BroadcastAudience) => void;
  groups: readonly AudienceGroup[];
  wardsWithBedNow: readonly string[];
  severity: BroadcastSeverity;
  setSeverity: (severity: BroadcastSeverity) => void;
  durationMinutes: number;
  setDurationMinutes: (minutes: number) => void;
  title: string;
  setTitle: (title: string) => void;
  message: string;
  setMessage: (message: string) => void;
  confirmed: boolean;
  setConfirmed: (confirmed: boolean) => void;
  /** A send is still waiting on its verdict. */
  sending: boolean;
  /** A bed call already live to some of the same wards, offered to extend instead. */
  liveBedCall: LiveBedCall | undefined;
  onExtendLive: (alertId: string) => void;
  senderName: string;
  now: Instant;
  onSend: () => void;
}) {
  const isPhone = useIsPhone();
  const ask = kind === "bed_call";
  const list = audienceRecipients(audience, groups, wardsWithBedNow);
  const n = list.length;
  const sev = SEVERITIES.find((item) => item.id === severity) ?? SEVERITIES[0];
  const endsAt = formatInstant(now + durationMinutes);
  const block = !n
    ? "Choose who gets it"
    : !title.trim() || !message.trim()
      ? "Add a title and message"
      : !confirmed
        ? "Tick the box to send"
        : sending
          ? "Still sending"
          : "";
  const setMode = (mode: AudienceMode) =>
    setAudience({
      ...audience,
      mode,
      // Choose units starts from whoever the audience reached until now.
      picked: mode === "pick" && audience.mode !== "pick" ? list.map((desk) => desk.id) : audience.picked,
    });
  const toggle = <T extends string>(ids: T[], id: T) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  const kindCard = (id: "bed_call" | "directive", KindIcon: typeof BedDouble, name: string, sub: string) => (
    <button type="button" role="radio" aria-checked={kind === id} className={css.kind} onClick={() => onSelectKind(id)}>
      <span className={css.iconTile} data-tone={kind === id ? "accent" : undefined} aria-hidden="true">
        <KindIcon size={18} aria-hidden="true" />
      </span>
      <span>
        <strong>{name}</strong>
        <small>{sub}</small>
      </span>
    </button>
  );

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a backdrop click closes it for the pointer, and the shared modal focus helper closes it on Escape
    <div
      className={isPhone ? css.pscrim : css.scrim}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={isPhone ? css.psheet : css.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="broadcast-title"
        aria-describedby="broadcast-desc"
        tabIndex={-1}
      >
        {isPhone ? <div className={css.grab} aria-hidden="true" /> : null}
        <div className={css.head}>
          <span className={css.iconTile} data-tone="accent" aria-hidden="true">
            <Radio size={16} aria-hidden="true" />
          </span>
          <h2 id="broadcast-title">New broadcast</h2>
          <span id="broadcast-desc" className="sr-only">
            Records a synthetic broadcast in this prototype. No external alert is sent.
          </span>
          <Button
            ref={modalCloseRef}
            iconOnly
            icon={X}
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
          />
        </div>
        <div className={css.body}>
          <div className={css.form}>
            {refusedFeedback ? (
              <div className={css.note} role="alert" aria-label="Broadcast feedback">
                <StatusGlyph tone="danger" />
                <span>{refusedFeedback}</span>
              </div>
            ) : null}
            <section className={css.step}>
              <h3>
                <span className={css.stepN}>1</span>What do you need?
              </h3>
              <div className={css.kinds} role="radiogroup" aria-label="Broadcast type">
                {kindCard(
                  "bed_call",
                  BedDouble,
                  "Ask wards for beds",
                  "Wards answer: can take, after a discharge, or can't",
                )}
                {kindCard("directive", Megaphone, "Tell areas something", "Desks acknowledge they have seen it")}
              </div>
              <div className={css.field}>
                <span className={css.fieldLabel} id="broadcast-start">
                  Start from
                </span>
                <div className={css.chips} role="group" aria-labelledby="broadcast-start">
                  {QUICK_STARTS[ask ? "bed_call" : "directive"].map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={css.chip}
                      aria-pressed={templateId === id}
                      onClick={() => onSelectTemplate(id)}
                    >
                      {quickStartName(id)}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={css.step}>
              <h3>
                <span className={css.stepN}>2</span>Who gets it<span className={css.stepAside}>{units(n)}</span>
              </h3>
              <Segmented
                items={AUDIENCE_ITEMS}
                value={audience.mode}
                onChange={setMode}
                label="Audience"
                size="md"
                className={css.fullSeg}
              />
              {audience.mode === "all" ? (
                <p className={css.hint}>Every inpatient ward and ED desk in the state network.</p>
              ) : audience.mode === "groups" ? (
                <div className={css.groupGrid}>
                  {ask ? (
                    <button
                      type="button"
                      className={css.gchip}
                      data-suggest=""
                      aria-pressed={audience.bedNow}
                      onClick={() => setAudience({ ...audience, bedNow: !audience.bedNow })}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      <span>Wards with a bed now</span>
                      <b>{wardsWithBedNow.length}</b>
                    </button>
                  ) : null}
                  {groups.map((group) => {
                    const on = audience.groups.includes(group.id);
                    return (
                      <button
                        key={group.id}
                        type="button"
                        className={css.gchip}
                        aria-pressed={on}
                        onClick={() => setAudience({ ...audience, groups: toggle(audience.groups, group.id) })}
                      >
                        {on ? <Check size={14} aria-hidden="true" /> : null}
                        <span>{group.label}</span>
                        <b>{group.desks.length}</b>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className={css.unitPick}>
                  {groups.map((group) => {
                    const on = group.desks.filter((desk) => audience.picked.includes(desk.id)).length;
                    const all = on === group.desks.length;
                    return (
                      <fieldset key={group.id}>
                        <legend>
                          <span>{group.label}</span>
                          <button
                            type="button"
                            className={css.linkBtn}
                            aria-label={`${all ? "Clear" : "All"} ${group.label}`}
                            onClick={() => {
                              const ids = group.desks.map((desk) => desk.id);
                              setAudience({
                                ...audience,
                                picked: all
                                  ? audience.picked.filter((id) => !ids.includes(id))
                                  : [...new Set([...audience.picked, ...ids])],
                              });
                            }}
                          >
                            {all ? "Clear" : "All"}
                          </button>
                          <small>
                            {on} of {group.desks.length}
                          </small>
                        </legend>
                        {group.desks.map((desk) => (
                          <div key={desk.id} className={css.unit}>
                            <Checkbox
                              label={desk.name}
                              checked={audience.picked.includes(desk.id)}
                              onChange={() => setAudience({ ...audience, picked: toggle(audience.picked, desk.id) })}
                            />
                            {ask && wardsWithBedNow.includes(desk.id) ? (
                              <span className={css.tag} data-tone="success">
                                Bed now
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </fieldset>
                    );
                  })}
                </div>
              )}
              {ask && liveBedCall ? (
                <div className={css.note}>
                  <Info size={14} aria-hidden="true" />
                  <span>
                    A bed call to {liveBedCall.label} is already live, with {liveBedCall.minutesLeft} left. Extend it
                    instead of sending a second one?
                  </span>
                  <Button size="sm" onClick={() => onExtendLive(liveBedCall.id)}>
                    Extend that one
                  </Button>
                </div>
              ) : null}
            </section>

            <section className={css.step}>
              <h3>
                <span className={css.stepN}>3</span>Message
              </h3>
              <div className={css.field}>
                <span className={css.fieldLabel}>How urgent</span>
                <Segmented
                  items={SEVERITIES.map(({ id, label, tone }) => ({ id, label, tone }))}
                  value={severity}
                  onChange={setSeverity}
                  label="Severity"
                  size="md"
                  className={css.fullSeg}
                />
                <p className={css.hint}>{sev.hint}</p>
              </div>
              <Field label="Title" id="alerts-broadcast-title">
                <TextInput
                  value={title}
                  maxLength={60}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Short and specific"
                />
              </Field>
              <Field label="Message" id="alerts-broadcast-message">
                <Textarea
                  rows={3}
                  maxLength={240}
                  placeholder="What should they do?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  data-gramm="false"
                  data-enable-grammarly="false"
                  spellCheck={false}
                  autoComplete="off"
                />
              </Field>
              <div className={css.field}>
                <span className={css.fieldLabel}>Ends after</span>
                <Segmented
                  items={DURATIONS.map(([minutes, label]) => ({ id: String(minutes), label }))}
                  value={String(durationMinutes)}
                  onChange={(id) => setDurationMinutes(Number(id))}
                  label="Ends after"
                  size="md"
                  className={css.fullSeg}
                />
                <p className={css.hint}>Ends at {endsAt}, or when you stand it down.</p>
              </div>
            </section>
          </div>

          <aside className={css.side} aria-label="Preview">
            <h3 className={css.secHead}>What each desk sees</h3>
            <div className={css.banner} data-tone={sev.tone === "neutral" ? undefined : sev.tone}>
              <div className={css.bnTop}>
                <StatusGlyph tone={sev.tone} size={10} />
                <span>
                  {ask ? "Bed call" : "Message"} · {sev.label}
                </span>
                <span className={css.bnFrom}>
                  {senderName} · {formatInstant(now)}
                </span>
              </div>
              <strong>{title.trim() || <span className={css.dim}>Title</span>}</strong>
              <p>{message.trim() || <span className={css.dim}>Message</span>}</p>
              <div className={css.bnActs} aria-hidden="true">
                {ask ? (
                  <>
                    <span className={css.fakeBtn} data-on="">
                      Can take <ChevronDown size={14} aria-hidden="true" />
                    </span>
                    <span className={css.fakeBtn}>After a discharge</span>
                    <span className={css.fakeBtn}>Can&apos;t</span>
                  </>
                ) : (
                  <span className={css.fakeBtn} data-on="">
                    Acknowledge
                  </span>
                )}
                <span className={css.bnEnds}>until {endsAt}</span>
              </div>
            </div>
            <h3 className={css.secHead}>
              Shows on {n} {n === 1 ? "screen" : "screens"}
            </h3>
            <div className={css.tagWrap}>
              {n ? (
                <>
                  {list.slice(0, 6).map((desk) => (
                    <span key={desk.id} className={css.tag}>
                      {desk.name}
                    </span>
                  ))}
                  {n > 6 ? (
                    <span className={css.tag} data-more="">
                      +{n - 6} more
                    </span>
                  ) : null}
                </>
              ) : (
                <span className={css.dim}>No one chosen yet</span>
              )}
            </div>
            <p className={css.hint}>
              {ask
                ? "You'll see each answer as it comes in, on the Broadcast tab."
                : "You'll see who has acknowledged on the Broadcast tab."}
            </p>
          </aside>
        </div>
        <div className={css.foot}>
          <Checkbox
            id="alerts-broadcast-safeguard"
            className={css.check}
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            label={`I'm authorised to send this to ${units(n)}.`}
          />
          <div className={css.acts}>
            {block ? (
              <span className={css.why} id="alerts-broadcast-waits">
                <Info size={14} aria-hidden="true" /> {block}
              </span>
            ) : null}
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="pri"
              icon={Send}
              className={cx(css.send)}
              data-testid="ward-alerts-broadcast-confirm"
              aria-disabled={block ? true : undefined}
              aria-describedby={block ? "alerts-broadcast-waits" : undefined}
              onClick={() => {
                if (!block) onSend();
              }}
            >
              {ask ? `Send bed call to ${units(n)}` : `Send to ${units(n)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
