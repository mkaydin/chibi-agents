# Integrated desktop chibi behavior plan

18 October 2026. This replaces the remaining integration work described in the earlier animation plan. Models remain local and are never bundled. Current default rig: Type-H1 v2.0; legacy recovery source: the extracted v1.4 package.

## Signal contract

The public avatar label retains the real Herdr status. The richer activity label is an intent, not a new authoritative agent status. Terminal-inferred events never change Herdr state or prove that a command succeeded.

| Signal | What it establishes | Integration |
| --- | --- | --- |
| Snapshot `agent_status` | Working, blocked, idle, done, unknown | Authoritative state and sleep eligibility |
| `completion_seq` | Completed work during an idle transition | One completion accent per new sequence, including after a working snapshot with null completion sequence |
| `state_labels`, named activity/phase tokens | More specific reported activity | Thinking/reading/searching/editing/testing/running intents |
| Working → idle without a completion counter | Likely completion on older producers | Conservative transition fallback; no startup celebration |
| Pane lifecycle and status events | Inventory/state invalidation | Debounced authoritative refresh; two-second recovery polling |
| `pane.output_matched` | A matching terminal status line | Optional inferred accent, five-second per-agent throttle, working agents only |
| MCP `avatar_animate` | Explicit bounded semantic action from the bound agent | 200–15000 ms reaction, then newest Herdr state |
| Local `report-activity.mjs` hook | Explicit intent from that Herdr pane | Same authenticated gateway/MCP actions; no global pane targeting |
| No additional signals while working | Only continuing broad work | Restrained independent 18–30-second work accents, not invented task results |

Installed Herdr protocol 22 schema was inspected locally. The adapter now preserves bounded metadata and completion counters previously discarded. Output subscriptions are separate from state subscriptions: an output-subscription failure does not disable authoritative state reconciliation. Only matched-line classification is consumed; terminal text is not retained in logs or used as executable content. Events are invalidations, not blindly replayed snapshots, following [Herdr event recovery guidance](https://herdr.dev/docs/socket-api/).

## Situation-to-animation specification

| Situation | Continuous posture | Short reaction | Return / priority |
| --- | --- | --- | --- |
| Initial avatar/model load | Selected appearance, independent blink/drift/breath | Neutral; do not replay historical completion | Current snapshot |
| Idle | Standing, quiet gaze and body sway | No repeated symbols | Optional delayed rest |
| Work begins | Random keyboard-only or keyboard + mouse setup, steadier gaze | Loading/focus accent | Work continues after effect expires |
| Thinking/planning | Focused gaze; configured working prop | Restrained tilt + Loading/Idea | 1.8 s, then work |
| Reading/reviewing | Keep the work session’s selected setup | Brief Loading/Question | Resume quiet reading posture |
| Searching/research | Keep selected setup; mouse prop follows desktop pointer | Question/Loading + tilt | 1.8 s, then work |
| Editing/writing | Keep selected setup; paced authored key/hand accents | Loading/Idea | No per-token or per-keystroke IPC |
| Shell/build/tool running | Configured working prop | Brief Loading/focus | Periodic subtle accent only |
| Tests running | Configured working prop | Loading/Sweating | Test completion is a separate event |
| Tests pass / work completes | Herdr's newest continuous posture | Idea/Star + nod | ~2.2 s; never keep celebration indefinitely |
| Error/failure | Keep current authoritative posture | Prefer Sweating/Sigh, slight recoil | Short concern; error text inference is not authoritative |
| Permission / user input needed | Standing; attentive, not sleepy | Question + tilt | Waiting remains awake |
| Message received | Current appearance and props | Classified brief nod/question/concern | Throttled; no fake continuous talking |
| Explicit greeting / celebration | Current appearance | Blush/Star/Idea + nod | Bounded MCP lease |
| Long inactivity | Quiet drift before configured rest delay | Sleep clip only after delay | Wake on working/blocked state |
| Rest with a fixed keyboard/controller pose | Matching recovered sleep variant | No competing procedural eye driver | Blend back; newest state wins |
| Agent resumes | Appropriate work/standing posture | Wake transition | No stuck sleepy brows/mouth |
| Herdr disconnect | Quiet disconnected posture; no invented work | Existing supported disconnected expression if available | Reconcile on reconnect; optional rest after delay |
| Pane closes / occupant changes | Destroy old avatar and bindings | No reused old occupant commands | New occupant gets independent timing |
| Manual prop selection | Standing/full keyboard/half keyboard/controller/microphone | Symbolic key/controller accents only during work | Per-agent preference; unavailable pose falls back to standing |
| Manual recovered pose preview | Requested prop and normal/sleep clip | Four-second local preview | Return automatically; Reset cancels it |
| Still mode | No automatic life, symbols or automatic props | Explicit manual pose preview remains possible | Selected appearance remains intact |
| Hidden preview | Stop its renderer ticker | None | Resume without catching up animation time |
| Resize / click-through | Keep model animation independent of desktop geometry | No window movement as an animation | Existing resize/click-through behavior |
| Unsupported clip or channel | Keep loading the base character | Disable incompatible recovered clip | No blank model caused by a bad overlay |

Priority: explicit manual/MCP reaction → important authoritative transition → completion/structured activity → inferred output accent → periodic work accent → background life. Inferred hints never interrupt a blocked/disconnected state or an active explicit lease. There is no unbounded reaction queue. Expressions expire into the latest status while saved appearance and glasses persist.

## Asset integration and parameter ownership

All twelve missing v1.4 clips, plus v1.1’s alternate tail idle, are now available as an opt-in overlay, automatically connected for the local Type-H1 package when the extracted v1.4 Expressions folder exists. Removing the overlay persists an explicit opt-out.

- Alternate tail idle: the distinct v1.1 `idle copy` is combined with v2.0 accessory curves and offered as a four-second manual preview.
- Six mouse clips: original scalar press/release curves, non-looping; press variants include release by 250 ms.
- Six pose clips: full keyboard, half keyboard and controller, each awake and asleep. Legacy parameter curves are combined with current v2.0 normal/sleep curves, preserving new ear-wing and tail channels. Obsolete PartOpacity mode switching is discarded.
- v2.0 `ModeChange`, keyboard-position and arm-pose controls select the props explicitly. Unsupported `VTS_Add` expressions themselves remain disabled. The pose adapter uses ordinary validated numeric controls rather than pretending `VTS_Add` is supported by Cubism.
- Normal typing accents use the local model's existing Key1/Key2/KeyA/KeyD expression parameter values with a short envelope. Mouse/controller button accents are bounded and symbolic, not recordings of the user's input.
- Each recovered clip's parameter IDs and values are validated against actual Core bounds. Incompatible clips are disabled individually. Existing authored idle and physics remain active on their nonconflicting channels.
- The old expression/preset names all exist in v2.0. Existing preset discovery remains in use; do not overwrite newer presets with obsolete ear/pupil selectors. Legacy textures remain with their own rig, rather than being blindly attached to different UV layouts.

The animation layer runs inside the renderer before physics. No per-frame GPU readbacks or IPC are added. Rest clips own their eye/head channels. Ending a pose clears orphaned motion channels, while transient-expression cleanup preserves persistent appearance and glasses.

## Always-on-top on KDE Wayland

Electron documents `setAlwaysOnTop` as unsupported on native Wayland ([BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window)). Merely repeating that call cannot fix this compositor restriction.

Implemented a temporary KWin script through `qdbus6` and the [KWin scripting API](https://develop.kde.org/docs/plasma/kwin/api/). It sets `keepAbove` only for exact avatar titles belonging to the current Electron process family, handles newly mapped windows, respects each avatar's toggle, and unloads when the app exits. Avatar titles are protected from document-title changes. The controls window and other apps are excluded. No persistent KWin configuration is installed or rewritten.

The GUI reports helper loading or a D-Bus failure. On other Wayland compositors this KDE helper is unavailable. Fullscreen surfaces and compositor overlays remain subject to compositor policy. The build environment cannot access the user's D-Bus session, so live stacking behavior must be checked on the desktop after restart. Tests verify script targeting and lifecycle, not actual compositor stacking.

## Controls and hooks

Use Agents → Activity props for automatic or fixed props. Still/Calm/Lively, temperament, blink/look-around, rest and cursor controls stay per agent. “Infer activity from terminal status lines” is a shared Herdr toggle. Recent activity records signal sources and semantic actions without retaining terminal text. Recovered clips remain available in Manual animation.

For an explicit tool hook running in an agent's Herdr pane:

```bash
node /absolute/path/to/waifu-agents-mcp/scripts/report-activity.mjs testing 3000
node /absolute/path/to/waifu-agents-mcp/scripts/report-activity.mjs done 2200
node /absolute/path/to/waifu-agents-mcp/scripts/report-activity.mjs error 2500
node /absolute/path/to/waifu-agents-mcp/scripts/report-activity.mjs idle
```

Hooks require the existing `HERDR_PANE_ID` / `HERDR_SOCKET_PATH` environment and a running companion service. They authenticate the current occupant, deliver one bounded action, and release the temporary binding. MCP `avatar_animate` now supports thinking, reading, searching, editing, testing, running, done and error alongside existing actions. No agent configuration was silently rewritten; tool-specific hook installation can build on this adapter when needed.

## Validation and remaining desktop qualification

Implemented deterministic coverage for completion counters (including null during work), metadata priority, work-pulse throttling, terminal hint scoping, recovered curve parsing/composition, prop fallback and release, and KWin process/title targeting and lifecycle. The real local Core loaded 587 parameters, and all thirteen recovered clips passed its channel/value checks. This is stronger than CDI-only inspection, but not a visual test.

After restart, check all five agents during work, completion, blocked input, reconnect and rest/wake. Test each fixed prop and confirm glasses/pupil styling survives reactions. Open a browser over the desktop and verify keep-above; check the GUI helper status if it fails. Run Settings → Measure 10 seconds with the five agents visible. Actual desktop rendering, compositor stacking, stylized-eye appearance and GPU performance remain user-desktop qualification, not claims made by unit tests.

## Desktop refinement — position, project identity and distinct reactions

Added per-agent `windowPosition` preferences with monitor-aware restoration, including negative monitor coordinates and disconnected-monitor recovery. X11 uses Electron move events; KDE Wayland uses compositor frame geometry through a temporary Python D-Bus relay. The KWin helper retains its process/title scoping and reports window-relative hover coordinates and normalized virtual desktop coordinates to its own avatars, including when the pointer is outside them. Geometry reports are coalesced before settings writes. The relay authenticates the current KWin D-Bus owner and a session token; no global pointer history is stored. System requirements for this optional KDE path: python3, dbus-python, PyGObject and qdbus6. These were found locally; the desktop D-Bus connection itself is unavailable in this environment.

Avatar titles now prioritize project/repository names. Explicit project metadata or workspace repository metadata wins; otherwise the app resolves a nearby Git root or project manifest from the agent working directory. A smaller second title line keeps agent kind, pane and activity distinguishable when multiple agents share a project.

Hover notice is enabled by default, can be disabled independently, and uses a brief head lift, brows and directed glance with a four-second cooldown. It works with look-around disabled, avoids interrupting stronger error reactions, and is suppressed by Still. KDE's cursor relay supports hover while click-through is enabled; X11 uses the shared cursor sampler.

Replaced first-regex expression matching with ordered choices and distinct procedural reaction profiles. Reading uses a scanning gaze, searching scans side to side, thinking looks up with a restrained tilt, editing concentrates downward, testing uses an asymmetric brow/glance, running turns toward its work, completion nods, waiting questions and errors recoil. No symbol is preferable to showing Loading for every activity. Expressions and gestures return to the current saved face and newest state.

GUI changes: connection badge, selected-project context bar, visible preset thumbnail grid, project cards with state badges, separate movement/placement/reaction/signal panels, and compact activity history. Screenshot review was attempted but could not be completed: the computer-use CLI was unavailable, localhost listening was rejected by the sandbox, and browser security blocked file URLs. The isolated GUI fixture is generated as `artifacts/gui-review.html`; it is not the running app and does not modify agent settings. Visual quality and compositor integration remain explicitly unverified on the real desktop.

Current verification: 83 tests and syntax checks pass, including saved per-agent placement, monitor fallback, compositor-local hover relay, distinct reaction profiles and GUI ID wiring. This does not substitute for a real desktop screenshot or live KWin check.


Work setup selection now shuffles balanced pairs of keyboard-only and keyboard + mouse poses. Each agent retains its setup while working; status changes within work do not reroll it. Mouse props use smoothed actual pointer position through ParamMouseX/Y, without recording clicks or keys. Hover uses an independent 1.1-second notice layer with a four-second entry cooldown, preserving the current status reaction. Desktop pointer reports prevent native drag regions or click-through mode from swallowing the hover signal on KDE/X11.
