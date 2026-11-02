/**
 * HELP SUGGESTIONS LIST (Josh, 2 Nov 2026): the rows `suggestHelp` returns, drawn as a listbox under
 * Help's field, and the ghost text that shows the rest of the top suggestion inside the field.
 * Presentational only: it holds no state and stores nothing. Mounted by ward-help-sheet.tsx.
 *
 * Wiring (ward-help-sheet.tsx, later): the field is a combobox (`role="combobox"`,
 * `aria-autocomplete="both"`, `aria-controls={`${idPrefix}-list`}`, `aria-expanded`), keeps focus,
 * and points `aria-activedescendant` at `helpSuggestionId(idPrefix, activeIndex)`. Arrow keys move
 * `activeIndex`; Enter picks the active row; Tab or → at the end of the field accepts `completion`.
 * Put the field and `GhostCompletion` in one `position: relative` box and give the ghost the field's
 * padding through `className`, so the remainder sits exactly after the typed letters.
 */
import {
  BookA,
  BookOpen,
  Footprints,
  Keyboard,
  LayoutDashboard,
  MessageCircleQuestion,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { completionRest, type HelpSuggestion, type HelpSuggestionKind } from "./ward-help-suggest";

import s from "./ward-help-suggest.module.css";

const ICON: Readonly<Record<HelpSuggestionKind, LucideIcon>> = {
  job: BookOpen,
  walk: Footprints,
  question: MessageCircleQuestion,
  word: BookA,
  screen: LayoutDashboard,
  shortcut: Keyboard,
};

/** The quiet word at the end of each row: what picking it does. */
const HELP_SUGGESTION_HINT: Readonly<Record<HelpSuggestionKind, string>> = {
  job: "How to",
  walk: "Show me",
  question: "Answer",
  word: "Meaning",
  screen: "Go to",
  shortcut: "Shortcut",
};

/** The id of row `index`, for the field's `aria-activedescendant`. */
export function helpSuggestionId(idPrefix: string, index: number): string {
  return `${idPrefix}-${index}`;
}

/** `text` with each matched range in bold. */
function Matched({ text, matched }: { text: string; matched: HelpSuggestion["matched"] }): ReactNode {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const [start, end] of matched) {
    if (start > at) parts.push(text.slice(at, start));
    parts.push(<b key={start}>{text.slice(start, end)}</b>);
    at = end;
  }
  if (at < text.length) parts.push(text.slice(at));
  return parts;
}

export function HelpSuggestList({
  suggestions,
  activeIndex,
  onPick,
  idPrefix,
  label = "Suggestions",
}: {
  suggestions: readonly HelpSuggestion[];
  /** The row the arrow keys are on; -1 for none. */
  activeIndex: number;
  onPick: (suggestion: HelpSuggestion) => void;
  /** Unique on the page; row ids are `${idPrefix}-${index}` and the list is `${idPrefix}-list`. */
  idPrefix: string;
  label?: string;
}) {
  if (suggestions.length === 0) return null;
  return (
    <ul className={s.list} role="listbox" id={`${idPrefix}-list`} aria-label={label}>
      {suggestions.map((suggestion, index) => {
        const Icon = ICON[suggestion.kind];
        return (
          <li
            key={suggestion.key}
            id={helpSuggestionId(idPrefix, index)}
            className={s.row}
            role="option"
            aria-selected={index === activeIndex}
            // Keep focus in the field, so typing carries on after a pointer press.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(suggestion)}
            // The field keeps focus and handles the keys; this covers a row focused some other way.
            onKeyDown={(event) => {
              if (event.key === "Enter") onPick(suggestion);
            }}
          >
            <Icon className={s.icon} size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className={s.text}>
              <Matched text={suggestion.text} matched={suggestion.matched} />
            </span>
            <span className={s.hint}>{HELP_SUGGESTION_HINT[suggestion.kind]}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The rest of `completion` after what is typed, drawn faintly over the field (aria-hidden: the
 * listbox already says it). The typed letters are drawn invisibly first, so the rest lines up after
 * them. Nothing is drawn when the completion does not continue the typed text.
 */
export function GhostCompletion({
  typed,
  completion,
  className,
}: {
  typed: string;
  completion: string | undefined;
  /** The field's own padding and font, so the ghost lines up with the typed letters. */
  className?: string;
}) {
  const rest = completionRest(typed, completion);
  if (!rest) return null;
  return (
    <span className={className ? `${s.ghost} ${className}` : s.ghost} aria-hidden="true" data-testid="help-ghost">
      <span className={s.ghostTyped}>{typed}</span>
      {rest}
    </span>
  );
}
