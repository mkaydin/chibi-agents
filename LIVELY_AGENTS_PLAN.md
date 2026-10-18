# Livelier chibi agents — animation plan

Prepared 17 October 2026 from the current renderer, installed Pixi/Cubism integration, Type-H1 v2.0 runtime data, and the supplied screenshot. This is an implementation plan; no animation behavior was changed by this document.

## Intended result

Each agent should appear awake and attentive while remaining comfortable to keep on a desktop: natural blinks, small gaze shifts, breathing, gentle posture changes, and short meaningful reactions to activity. The four avatars should have independent timing and recognizable temperaments. Maintain their current size, above-head labels, coordinated appearances and simple GUI.

A still screenshot cannot establish whether an animation is running. It does show that strong eye styling and expressions need to remain readable at small sizes. Persistent pupil designs must be distinguished from temporary star/heart/error expressions; do not reset a user's chosen eye design when returning to neutral.

## Verified capabilities and current gaps

| Feature | Verified local evidence | Design consequence |
| --- | --- | --- |
| Blink | `ParamEyeLOpen`, `ParamEyeROpen`; manifest EyeBlink group has no IDs | Add an explicit blink driver. Simply adding IDs is insufficient: the current SDK skips its built-in blink update while a motion updates the model. |
| Gaze | `ParamEyeBallX/Y` | Smooth eye movements, then smaller delayed head turns; avoid permanent fixed stares. |
| Head and posture | `ParamAngleX/Y/Z`, body angle/position channels | Small continuous movement plus authored short nod/tilt gestures. Validate runtime bounds. |
| Breathing | `ParamBreath`; SDK already supplies breathing and head drift | Replace or coordinate this driver; adding another oscillation would double the motion. Give each agent independent phases. |
| Face | Eye smile/squint, brows, mouth form/open and cheek channels | Subtle emotion can use face controls without needing a large symbol overlay. |
| Expressions | Loading, Question, Idea, Star, Blush, Angry, Sigh, Sweating, special eye effects, Glasses and Mic | Classify these as reaction, persistent accessory, or prop mode instead of treating them all as interchangeable expressions. |
| Normal idle | 3.783 s looping clip, 57 curves | Mainly hands, wings, ears/effects, tears/loading and tail chains; it is not a complete eye/head behavior system. Keep compatible channels instead of replacing all of it. |
| Sleep idle | 3.783 s looping clip, 76 curves | Also owns head, eyes, brows and mouth. It needs exclusive ownership of those channels while sleeping. |
| Physics | 48 settings, including hair, fabric, arms, ear motion and facial effects | Feed head/breath/blink inputs before physics; do not overwrite physics outputs afterward. |
| Accessory style | Ears, wings, tail, halo, mechanical headwear and glasses | Keep selected identity; animate only supported, enabled parts. Do not create accessories merely to show activity. |

Type-H1's VTube Studio mappings include an eye-open output range of 0–2 and standard head-angle ranges. These are useful hints, not substitutes for actual Core defaults and min/max values. An open eye must use its proper baseline, not assume that 1 is always fully open.

## 1. Always-on life layer — first priority

### Blinking

- Independent scheduling per avatar, initially about 2.5–6.5 seconds between ordinary blinks, with randomized intervals and occasional double blinks. These are starting tuning values, not a fixed biological rule.
- Smooth asymmetric close/open phases, roughly 120–220 ms total, rather than snapping a checkbox.
- Apply closure as a multiplier of the current emotion/pose eye openness so squints and smiles survive. Preserve small left/right differences without making constant winks.
- Suppress ordinary blinking while asleep, while a gesture owns the eyelids, or when a stylized eye expression needs an alternate treatment. Resume naturally after interruption.
- Clamp all values; reset timers after long frame pauses so restoring the application does not produce a rapid blink burst.

### Breathing and posture

- A low-amplitude breath cycle, gentle weight shift and very small head drift. Each component has a different period and phase.
- Distinct seeds per agent, with a stable temperament but no synchronized starts when four agents load together.
- Default subtle intensity. Existing cloth, hair and ear physics should provide secondary motion from those inputs.
- Never move the desktop window to simulate breathing or swaying. Keep the character anchored and resize/drag behavior predictable.

### Gaze and head attention

- Alternate quiet center gaze with occasional smooth side glances. Eyes lead the head; the head follows gently and returns at a different speed.
- Offer optional cursor attention through the main process's desktop pointer coordinates, transformed into each avatar's own display/window coordinates. Handle DPI changes and negative monitor coordinates.
- Follow intermittently rather than chasing every mouse movement. Ignore distant cursor movement and suspend attention while dragging/resizing the avatar.
- Autonomous gaze remains available when global pointer access is unavailable. Cursor following is a toggle, with a rate-limited shared pointer sample rather than one polling process per avatar.

## 2. Activity-driven behavior director

A behavior is a small coordinated sequence: expression + head/eye gesture + optional supported effect + fade back to the current state. It is not just switching an expression file.

| Activity | Posture/gaze | Face/effect | Duration and return |
| --- | --- | --- | --- |
| Idle | Quiet look-around, occasional small tilt | Mostly neutral, rare soft smile | Continuous subtle baseline |
| Working | Slight focus toward a stable attention point; reduced wandering | Focused brows; Loading effect only periodically | Background state, not a permanent busy symbol |
| Waiting/blocked | One questioning tilt, glance toward the user | Question or raised brows | 1.5–3 s accent, then quiet waiting |
| Completed | Small nod or restrained bounce within the model | Star/Idea or smile | 1–2 s, then current state |
| Error | Small recoil/tilt and brief concerned gaze | Sweating, Sigh, or mild brow/mouth concern | 1.5–3 s; Angry only for an explicitly dramatic temperament |
| Received message | Brief attentive look or nod | Small smile/curious reaction | Short accent; no fake continuous speaking |
| Extended inactivity | Slower drift, relaxed eyelids | Drowsy transition if enabled | Sleep only after a configurable delay |
| Agent resumes | Eyes/head settle to attentive pose | Brief wake-up response | Blend to working/idle, never snap |

An ordinary idle status does not mean the agent is asleep. A disconnected agent should first show a quiet disconnected/waiting state; sleep is optional after sustained inactivity. A blocked agent waiting for user input should remain attentive.

Use authoritative Herdr state before message text inference. Coalesce repeated activity, rate-limit accents, and add cooldowns so a stream of logs does not produce flashing expressions. Maintain a small bounded queue with priorities; discard obsolete completion/error accents after a newer authoritative state makes them irrelevant.

Initial priorities: explicit user pause/pose lock → active sleep or exclusive manual gesture → bounded MCP/user reaction → important state transition → optional message accent → background life. A high-priority reaction interrupts cleanly and returns to the newest state, not the state when it started.

Do not add every blink or breath to the activity log. Log meaningful transitions such as “working → focused,” “task finished → nod + Star,” or a skipped unsupported reaction. Retain the current per-agent bounded log.

## 3. Expressions, accessories and props

### Expression compatibility

Create a Type-H1 expression catalog with channel ownership and exclusions:

- Emotion: mouth/brow/squint changes.
- Eye style/effect: normal eyes, hearts, stars, tears, dizzy, dark and TT variants; one conflicting eye-effect family at a time.
- Symbols: loading/question/idea/star accents, with a conservative default of one symbol accent at a time.
- Persistent accessories: glasses, alongside the saved appearance.
- Prop/pose mode: microphone or keyboard/controller configurations, enabled only after their relevant mappings are verified.

Preserve author-provided Add/Multiply/Overwrite behavior. Blend out to the underlying saved appearance and current emotion, rather than assigning all face parameters to zero. The supplied Reset expression does not reset every expression channel, so it must not be the only cleanup mechanism.

Normal blink can remain active with an ordinary smile, while TT closed-eye poses should own the eyelids and special pupil effects need a visually verified policy. Validate these combinations rather than assuming every eye effect can be layered arbitrarily.

### Accessories

- Keep appearance selectors (`ParamAnimalEars`, `ParamWings`, `ParamTail`, `ParamHalo`, etc.) persistent.
- Reuse the normal idle clip's wing/tail/effect animation when those parts are enabled. Avoid adding a second driver to the same wave channels.
- Ear twitch and hair movement should primarily come from the verified head/blink/breath physics inputs. Do not directly drive `Phy*` outputs.
- Glasses should stay on through Question/Loading reactions; they cannot rely on occupying the only transient expression slot.
- Offer simple accessory bundles compatible with the selected look. Start with existing glasses and verified enabled-part motion; do not add new artwork or alter the preset's texture selection.
- Halo/mechanical-headwear independent rotation or wobble is only available if the rig exposes appropriate channels. A style/size parameter is not a rotation animation.
- Microphone and keyboard/controller gestures are a later subphase. The existing VTS_Add mode expressions remain disabled until standard, tested parameter mappings replace or support them. Do not pretend the character is typing in response to terminal activity without a verified pose.

## 4. Runtime architecture and parameter ownership

Add a renderer-side `LifeController`, a pure timing/gesture core, a per-model capability adapter and a main-process `BehaviorDirector`. Run animation interpolation locally at the existing renderer frame rate; IPC delivers intent/state changes, not every parameter of every frame.

Each loaded model needs an ownership map for saved appearance, clip channels, procedural life, transient expressions, exclusive gestures and physics outputs. Cache the curve IDs in the selected idle/sleep clips; do not guess ownership from parameter names alone.

Verified update order in the installed SDK is:

`beforeMotionUpdate → motion → afterMotionUpdate → saveParameters → expression → optional built-in blink → focus → updateNaturalMovements → physics → pose → beforeModelUpdate → Core update → loadParameters`.

Integration approach:

1. Seed owned procedural channels from a stable baseline before motion evaluation to avoid accumulating values from the previous frame.
2. Evaluate the selected clip and existing saved-appearance layer.
3. Compose the expression, then blink and remaining procedural face/pose channels before physics.
4. Run physics and preserve its outputs. Keep the final manual-override facility explicit and separate.
5. Use a small version-checked renderer adapter around the existing `updateNaturalMovements` stage for the before-physics composition point. Disable the SDK's overlapping fixed breath/head driver when the new controller owns it. Restore wrappers on teardown. Avoid a broad SDK fork.

The adapter needs tests against the pinned SDK call order. If the stage contract changes, fail that feature clearly and fall back to the current stable idle rather than silently writing at the wrong stage.

A sleeping clip owns its head/eye/mouth channels. Pause conflicting procedural writers while sleeping. When waking, blend from the last pose into the baseline; do not start full-amplitude motion on the first resumed frame. Idle clip-owned accessories retain their authored motion while the controller supplies only nonconflicting channels.

Bounds/defaults come from Core. Verify parameter existence before enabling any behavior. Do not write source model JSON, saved appearance values, or physics output parameters as part of an animation.

## 5. Keep the GUI simple

Add one **Liveliness** panel under Agents:

- Mode: **Still / Calm / Lively**; default Calm.
- Temperament: **Relaxed / Curious / Focused / Playful**. These are restrained timing/intensity presets, not separate configuration pages.
- Toggles: **Blink**, **Look around**, **Notice cursor**, **React to activity**, **Accessory motion**.
- Optional **Rest when inactive**, with a small delay selector.
- A **Try reactions** row: think, question, celebrate, concerned, wake.

Keep current coordinated look selection. Accessory bundles belong next to the look, filtered to supported combinations. Detailed timing, channel IDs, custom reaction maps and troubleshooting stay in Advanced.

Per-agent settings can be copied to other agents, while random phases remain independent. “Still” disables the life controller and automatic accents without changing the saved appearance. Manual reactions and a clear Reset pose action remain available.

## 6. Delivery sequence

| Phase | Concrete work | Acceptance |
| --- | --- | --- |
| A. Audit and neutral baseline | Capability map, clip channel ownership, expression classifications, transient cleanup | Identify eye styling versus temporary effects; clearing a reaction restores the same saved character |
| B. Natural life | Blink, independent breathing/head drift, small gaze shifts; SDK overlap control | Four avatars blink/drift independently, including while normal idle animation runs |
| C. Behavior sequences | State-driven nod/tilt/focus, transient symbol effects, priorities/cooldowns | Working and waiting look different; reactions expire and honor the newest state |
| D. Accessory layers | Persistent glasses; clip/physics ownership; compatible accessory bundles | Glasses survive reactions; enabled ears/hair/tail/wings move without doubled drivers |
| E. Simple controls and attention | Liveliness/temperament presets, optional shared cursor sampling, rest/wake | Controls are compact; paused/click-through/resizing modes behave predictably |
| F. Qualification | Deterministic tests, local preview sequence, multi-avatar measurement and logs | No drift, stuck faces, synchronization, appearance changes or resource growth |

Start with A and B: blinking plus well-paced head/gaze movement will make the largest difference to the current lineup. Add symbol/prop variety afterward so it reinforces believable behavior instead of masking a static baseline.

## 7. Validation

- Seeded clock/randomness tests for blink envelopes, double-blink limits, independent phases, pause/resume and large time-step recovery.
- Channel ownership tests for normal idle, sleep, manual reactions and physics, including an expression that closes both eyes.
- Interrupt/expire tests: new working state arrives during celebration; error bursts are throttled; disconnect does not immediately sleep; a waiting agent stays attentive.
- Appearance/accessory tests: glasses persist through Question; preset-specific pupil shapes return after EyeStar; missing wing/tail channels disable only that behavior; texture selection remains unchanged.
- Visually review 30–60-second samples for each coordinated look, then a few minutes with all four agents. Check restrained motion, eye clipping, eyelid shapes, hair/ear physics and titles following the character without jitter.
- Measure frame pacing and CPU/GPU use against the current four-agent baseline at 30 FPS. Do not add per-frame GPU readbacks or cross-process parameter updates. Stop hidden preview tickers and keep event logs bounded.
- Preserve a one-toggle fallback to Still and the existing renderer if a model-specific adapter cannot validate its inputs.

Completion means the agents look alive even during quiet idle, respond clearly but briefly to meaningful activity, and retain their chosen appearances/accessories with no additional complexity in the main preset workflow.


## Implementation progress

Implemented the natural-life driver, per-agent seeds, blink/head/gaze/breath controls, SDK overlap suppression and before-physics adapter with contract coverage. Current normal/sleep clips are inspected for channel ownership. Ending a pose clears its orphaned facial channels without clearing physics outputs.

Also implemented initial state-linked head accents, transient reaction expiry, repeated-message cooldowns, temperament presets, optional local cursor attention (shared nearby cursor sampling on X11), configurable delayed rest/wake, and persistent glasses. These preserve the existing simple look workflow. Existing authored clip/physics animation supplies enabled wing/tail/hair/ear motion.

Remaining qualification: visual review of blink/eye-style combinations, accessory motion and rest/wake transitions across the supplied looks, plus real multi-agent CPU/GPU measurements. More elaborate gesture libraries and keyboard/controller/microphone mode adapters remain future extensions; unsupported VTS_Add behavior is not silently enabled.

### State posture follow-up — 18 October

Working now blends toward a steadier, slightly downward gaze with reduced wandering. Blocked/waiting blends into a small attentive head tilt without entering rest. Returning to idle smoothly releases these postures. Eyes lead head turns through a separate slower follower; subtle independent body-angle sway supplies secondary physics input where the model exposes those channels. Clip-owned channels still take precedence, and disabling head movement disables the added body sway too.

Validation: `npm run check` passes 62 tests, including deterministic state transitions, reduced working gaze travel, delayed head following, and bounded secondary posture. Desktop visual review and actual GPU measurements remain pending; these tests do not establish rendered quality. Prop adapters remain deferred until their poses and mappings are verified.
