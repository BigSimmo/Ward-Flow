/**
 * The shareable redesign preview is plain files: `index.html` (the viewer) and `frame.html` (one
 * page). A mock-up address becomes `frame.html?screen=...`; anything else stays as it is.
 */
const BASE = "/mockups/ward-flow-redesign";

export function staticHref(href: string): string {
  if (!href.startsWith(BASE)) return href;
  const [path = "", query = ""] = href.slice(BASE.length).split("?");
  const screen = path.replace(/^\//, "");
  if (!screen) return "index.html";
  const params = new URLSearchParams(query);
  params.set("screen", screen);
  const theme = new URLSearchParams(location.search).get("theme");
  if (theme && !params.has("theme")) params.set("theme", theme);
  return `frame.html?${params}`;
}
