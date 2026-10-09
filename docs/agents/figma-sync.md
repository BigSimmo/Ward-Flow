# Figma sync

Push code changes to the Figma file "Ward Flow v6 live", or pull Figma edits back into code. The
repository ships no `.claude` or `.agents` folder, so this procedure lives here; a personal Claude
skill named `figma-sync` can point at it.

Code is the source of truth. Figma Professional has no Code Connect or Variables REST API, so
Claude runs the sync on request through the Figma MCP (`use_figma`, `get_variable_defs`,
`get_metadata`, `get_design_context`, `get_screenshot`). The Figma MCP tools work from the cloud
container, but image uploads (`upload_assets`) post to `mcp.figma.com`, which the cloud network
policy must allow; otherwise run uploads through Remote Control on Josh's device.

Phone screens live on the Figma page "Phone · 8 Oct" as captures of the app at 390px (2x, sliced
into tiles of at most 2000px so Figma keeps full resolution). The editable phone bar is the
`Shell/Phone header` component set (State Top and Scrolled).

- Map: `design/figma/figma-sync.json` (file key, collections, naming rule, component and screen map).
- Tokens: `node scripts/figma-tokens.mjs --export | --diff <file> | --apply <file>`.
- Source CSS: `src/app/ward-flow-tokens.css`. Components: `src/components/wf/`.
- Load the `figma-use` skill before any `use_figma` call. Synthetic data only.

Figma variables: collection **Colour** (modes Day, Night) and **Size**. Each variable's WEB code
syntax is `var(--wf-name)`, which is the key in the token JSON. Skip `alpha/*` and
`status/*-tint|edge`; they are Figma-only helpers that code derives with `color-mix`.

## Push (code to Figma)

1. `node scripts/figma-tokens.mjs --export` writes `design/figma/tokens.json`.
2. `use_figma` on file `UfpjjBWlvb3NMp3Nuvktzu`: for each variable whose WEB code syntax names a
   token in the JSON, set its value per mode (`variable.setValueForMode`). Colours go in as
   `{ r, g, b, a }` floats 0 to 1, sizes as numbers. Create a missing variable in the matching group
   with its WEB code syntax set. Report counts changed, created and unmatched.
3. For each component or screen whose code changed, find it in `figma-sync.json`, open the route
   on the live site or `npm run ensure`, and update that Figma component or section with
   `use_figma`. Check it with `get_screenshot`.

## Pull (Figma to code)

1. Read the variables with `use_figma` (or `get_variable_defs` for a selection) into the token JSON
   shape and save it outside the repo, for example `figma-pull.json`:

   ```js
   const out = { Colour: { Day: {}, Night: {} }, Size: {} };
   for (const c of await figma.variables.getLocalVariableCollectionsAsync()) {
     const group = c.name === "Colour" ? "Colour" : c.name === "Size" ? "Size" : null;
     if (!group) continue;
     for (const id of c.variableIds) {
       const v = await figma.variables.getVariableByIdAsync(id);
       const name = v?.codeSyntax?.WEB?.match(/^var\((--wf-[\w-]+)\)$/)?.[1];
       if (!name) continue;
       for (const m of c.modes) {
         const value = v.valuesByMode[m.modeId];
         if (value?.type === "VARIABLE_ALIAS") continue;
         if (group === "Size") out.Size[name] = value;
         else out.Colour[m.name][name] = value;
       }
     }
   }
   return out;
   ```

2. `node scripts/figma-tokens.mjs --diff figma-pull.json` and show Josh the changed tokens.
3. `node scripts/figma-tokens.mjs --apply figma-pull.json`, then
   `npx vitest run tests/figma-tokens.test.ts` and `npm run format -- --files src/app/ward-flow-tokens.css`.
   Invalid collection shapes, sizes or colours fail before any CSS is written. Writes replace the
   complete file atomically; a malformed pull leaves source CSS unchanged. Partial valid pulls
   are allowed. Figma helper variables remain ignored.
   A skipped line means the CSS has no separate value for that mode; edit it by hand if Josh wants it.
4. Layout or component edits: find the changed node with `get_metadata`, map it to code through
   `figma-sync.json`, read it with `get_design_context` (load `figma-design-to-code` first), and
   change the existing component or screen using `src/components/wf` and `--wf-*` tokens only.
5. Open the result as a draft PR on a task branch. Nothing merges without Josh.

## Keep the map current

When a screen, route or component is added or renamed, update `figma-sync.json` in the same PR.
`tests/figma-tokens.test.ts` fails if a mapped file or route no longer exists, or a mapped ward/service
example does not resolve a current operational record. Reference ward IDs are not operational unit IDs.
