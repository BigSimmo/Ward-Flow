import { DESK_GUIDES } from "../help/ward-help-guide";
import { ROLE_REFERENCE } from "../help/ward-help-roles";
import { COLOUR_LEGEND } from "../help/ward-help-legend";
import { KEYBOARD_SHORTCUTS, SCREEN_HELP, shortcutsForDesk } from "../help/ward-help-content";

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
