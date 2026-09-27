# The ward journey — the map of what Ward Flow can actually do

🔴 **This is the master tool for mapping Ward Flow's flow and behaviour** (owner instruction,
18 September 2026). New behaviour goes on here. "What can happen at this point?" is answered from
here, not from a screen and not from memory.

**Open [`ward-journey-explorer.html`](ward-journey-explorer.html) to read it.** Serve it rather
than opening it as a bare file — like every other drawing in `docs/ward-flow/`, it builds itself
in JavaScript:

```bash
node docs/ward-flow/journey/serve.mjs
```

## What it is

One page with seven tabs: the route map, state machines, bed decision gates, accepted actions,
closed word lists, refusal coverage and recorded gaps.

The vocabulary is extracted from `src/components/ward-management/`. The route wording and action
descriptions are curated in `rebuild-map.mjs`, `actions.json` and `machines.json`; builders check
structure and event coverage, but a reviewer must still compare prose and controls with the engine
and rendered screens. The coverage tab is historical until a fresh full coverage run is available.

## Re-running it

```bash
npm run ward:journey
```

No dependencies, plain Node. It runs seven steps in order and stops at the first that refuses.

| Step                   | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `extract-vocab.mjs`    | reads every exported word list straight out of the engine → `vocabularies.json` |
| `rebuild-map.mjs`      | lays the route map out from its edge specification → `stages.json`              |
| `build-explorer.mjs`   | builds the page, and checks every claim on it → `ward-journey-explorer.html`    |
| `build-bpmn.mjs`       | emits the pathway as BPMN 2.0 for Camunda Modeler / bpmn.io                     |
| `make-inventory.mjs`   | writes `MAP-INVENTORY.md`, a flat list a reviewer can diff against source       |
| `refusal-coverage.mjs` | says which refusals no test ever reaches → `refusal-coverage.json`              |
| `what-changed.mjs`     | reports what moved since the last run → `WHAT-CHANGED.md`                       |

`actions.json` and `machines.json` are the **hand-curated** inputs — what each event does, refuses
and demands. They are the only things here written by a person, and the build refuses if any of
them names a box that does not exist.

## 🔴 Every check here can refuse, and refusing is the point

This tooling makes a claim — _this is everything the ward journey can do_. A drawing that quietly
omits something is worse than no drawing, because somebody will trust it. So the builders check
their own output and **exit non-zero rather than write a file that is wrong**.

`rebuild-map.mjs` refuses if two boxes overlap, or if a line runs behind a box it does not join.
`build-explorer.mjs` refuses if an action is modelled nowhere, if a line is not the colour of the
box it leads to, if a box is neither continued nor terminated, if a filter controls nothing, if a
colour has no sentence saying what it means, or if a lane on the map is not named in the legend.

**A check nobody has seen fail is a check nobody has seen**, so each one is proved against a
deliberately broken input:

```bash
npm run ward:journey:prove
```

Each proof breaks an input, checks the build refuses _and names the offender_, then restores it.
They must not run beside a normal build.

## ⚠️ The trap this tooling keeps falling into

**A rule stated in a comment but implemented as a list.** Three separate rules here — which boxes
get a terminating bar, which lines route around a box, which colour a line takes — each started as
a hand-written list of ids under a comment claiming it was one rule. Every one of them was wrong
the next time a box was added, and two of them were only caught because a later check refused.

If you add behaviour here: derive it from the node list, and run the derivation **after** the node
list is complete. A list that happens to be right today is the defect, not the fix.

## Adding behaviour

1. Add the box and its links to `rebuild-map.mjs` — position is `{x, y, w, h}`, routing is
   computed, so do not hand-draw a path.
2. Add or extend the action in `actions.json`, pointing `nodes` at the box.
3. Run `npm run ward:journey`. Read what it refuses; it names the box, line or action.
4. Say in the box's own text what the engine actually does, in the words a clinician uses. A box
   that states a behaviour more confidently than the source supports is the failure mode here —
   check the reducer case before you write the sentence, and cite it in the commit.

## What it deliberately does not do

It changes no behaviour. It is a drawing and a set of checks. Where the engine has a gap — a
stretch with no record at all, a screen whose buttons dispatch nothing — the map **states the
absence** rather than leaving a blank or filling it in with something plausible.

Every person, ward and figure named anywhere in it is invented.
