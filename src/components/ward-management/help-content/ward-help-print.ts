import { DESK_GUIDES } from "../help/ward-help-guide";
import { ROLE_REFERENCE } from "../help/ward-help-roles";
import { COLOUR_LEGEND } from "../help/ward-help-legend";
import { KEYBOARD_SHORTCUTS, SCREEN_HELP, shortcutsForDesk } from "../help/ward-help-content";
import { HOW_TOS, showMeSteps } from "../help/ward-help-howto";
import { aroundPagePurpose, SCREEN_TOURS } from "../help/ward-help-screen-tours";

/** Printable guides use exactly the same jobs, limits, names, legend and keys as in-app Help. */
export function printHelpGuides() {
  return ROLE_REFERENCE.map((role) => {
    const guide = role.id === "tv" ? undefined : DESK_GUIDES[role.id];
    return {
      id: role.id,
      title: role.name,
      homeName: guide?.homeName ?? "TV board",
      summary: guide?.summary ?? role.summary,
      source: "in-app Help",
      jobs: guide
        ? guide.jobs.slice(0, 3).map((job) => `${job.job}. ${job.how}`)
        : [SCREEN_HELP.capacity.questions?.[0]?.answer ?? role.summary],
      limits: guide?.limits ?? [role.summary],
      legend: COLOUR_LEGEND.map((item) => `${item.shape}: ${item.meaning.toLocaleLowerCase("en-AU")}.`),
      // The same keys as the desk's shortcuts sheet (audit finding 11); the TV only closes.
      shortcuts: (role.id === "tv"
        ? KEYBOARD_SHORTCUTS.filter((key) => key.keys === "Esc")
        : shortcutsForDesk(role.id)
      ).map((key) => `${key.keys}: ${key.action}`),
    };
  });
}

/**
 * One printable page per screen (2 Nov 2026), from the same walk round Show me plays
 * (`ward-help-screen-tours.ts`), the screen's own help, and the jobs done there. For training and for
 * the paper pack; it says the same as the app and nothing more.
 */
const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function printScreenGuides() {
  return SCREEN_TOURS.map((tour) => {
    const screen = tour.around!;
    const help = SCREEN_HELP[screen];
    const desk = showMeSteps(tour, "desk");
    const phoneOnly = showMeSteps(tour, "phone").filter((step) => step.device === "phone");
    return {
      id: screen,
      title: help?.title ?? capitalised(tour.title.replace(/^Show me around (this )?/, "")),
      purpose: help?.purpose ?? aroundPagePurpose(screen) ?? "",
      source: "in-app Help",
      parts: desk.map((step) => `${step.title}. ${step.body}`),
      onPhone: phoneOnly.map((step) => `${step.title}. ${step.body}`),
      jobs: HOW_TOS.filter((howTo) => !howTo.around && howTo.go === screen).map(
        (howTo) => `${howTo.title}. ${howTo.answer}`,
      ),
    };
  });
}
