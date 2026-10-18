# Customizable chibi companions — implementation plan

Prepared 17 October 2026 against the current Electron/Pixi companion implementation and the locally inspected Type-H1 v2.0 package.

## Product direction

Replace the default Mk6/Ayla/sample-character workflow with a local customizable chibi character library. Users import a base package, choose one of its supplied presets, edit the appearance visually, save a named character, and assign it to agents. Different agents can use different appearances from the same base rig.

Keep Herdr tracking, MCP reactions, transparent desktop windows, NVIDIA rendering, tray recovery and per-agent desktop controls. Ayla application integration is deferred. Existing imported models remain available as a compatibility path, but onboarding, examples and default assignment use chibi character profiles. Do not delete existing user assets or overwrite assignments during migration.

All model assets, textures, imported presets, generated thumbnails and saved user appearances remain local and excluded from Git and releases. Type-H1 provides a concrete package layout to support; the editor must also work with other compatible customizable rigs. Chibi proportions come from the supplied artwork/rig, not an automatic conversion of arbitrary models.

## User journeys and GUI

Replace the narrow scrolling controls window with a resizable character studio: initial target about 1160×800, usable down to 900×640, with a compact layout below that width. Use consistent spacing, readable labels, restrained purple accents and clear selected/unsaved/error states. Remove the oversized introductory heading and Ayla branding from primary controls.

Main areas:

| Area | Contents and behavior |
| --- | --- |
| Left navigation | Characters, Agents, Settings; collapsible when space is limited |
| Characters library | Saved-character cards with thumbnails, base-model name, edit/duplicate/assign actions, search, and Import package |
| Center editor | One live preview, neutral checkerboard/solid/transparent preview toggle, zoom and recenter controls, current character name and unsaved indicator |
| Right inspector | Presets, Face, Hair, Outfit, Accessories, Colors; Advanced contains remaining parameters and IDs |
| Bottom editor actions | Undo, Redo, Revert changes, Save, Save as new character, Assign to agent |
| Agents page | Live agent cards with state, assigned character selector, visibility, and desktop settings; clear disconnected/overflow states |
| Settings | Cubism runtime, model-library locations, NVIDIA/graphics diagnostics, texture quality/FPS, Herdr connection, credits and local asset locations |

First-run flow: choose trusted Cubism Core if missing → import base package folder → choose a supplied preset or base appearance → save the first character → choose it as the default for new agents. No hardcoded path to Mk6 or downloaded sample models.

Selecting an agent must not apply unfinished editor changes to its desktop avatar. Edit a draft in the preview, then Save and explicitly apply it to assigned agents. If the character is shared, show how many agents will be affected. Save as new creates an independent character. Switching away from a dirty draft offers Save, Discard or Cancel. An explicit “Preview on desktop” toggle can be added after the embedded preview works; it stays off by default.

The supplied presets appear as cards under Presets, distinct from saved user characters. Selecting one replaces the draft appearance from a clean base rather than accumulating offsets. Cards indicate whether they include a matching texture set. Texture choice is visible and separately editable.

Use keyboard-accessible controls, visible focus, text labels for icons, a non-color-only indication of agent state, and inline validation. Connection and rendering errors stay visible without replacing the editor. Herdr socket paths and raw parameter IDs belong in Settings/Advanced.

## Package and preset import

Add `lib/character-package.mjs` with read-only, bounded folder inspection and a library registry under the application data directory. Keep `inspectModel` as the runtime-file validator.

Import supports both a package root and an explicitly selected `.model3.json`. The folder scanner checks a limited depth/file count, discovers candidate manifests and asks the user to select a base if several exist. Do not recursively traverse unrelated directories or follow escaping symlinks.

For Type-H1, discover:

- `Type-H1/Type-H1.model3.json`, its display metadata, physics and atlas references.
- `Type-H1/Expressions/`: separate appearance presets (`Preset0x`, `Preset1`–`Preset8`) from reactions and controller/keyboard expressions.
- `Type-H1/Motions/`: two idle animations, with explicit selection of normal and tracking-lost roles where supported.
- `Sample Characters/`: preset expression copies and optional corresponding texture folders. Deduplicate identical preset files by content; retain different files with clear provenance instead of assuming identical names mean identical settings.
- Five texture sets named for Preset0x through Preset4. Match by a normalized name and atlas-slot inventory, then validate dimensions/aspect ratios against the original slots. Show unmatched/ambiguous texture choices for manual pairing. Do not invent textures for Preset5–8.

Package recognition rules live in a small optional Type-H1 adapter, with generic expression/texture import available for other rigs. Never treat every `.exp3.json` as an appearance preset: Angry and Loading are reactions, and keyboard modes are feature controls. Users can reclassify an imported entry without modifying source files.

Register each approved source root and each file it may serve. Sibling preset textures require their own approved import root/file inventory; preserve current containment protections. Derived preview images go in managed local cache. Check finite numbers, supported blends, file sizes, parameter counts and JSON structure before registering anything. Import failures leave the existing library and running avatars intact.

External local paths can disappear. Track fingerprints for the manifest/compiled model and selected textures; on change require revalidation, on missing files offer Relink. Do not import PSDs into the renderer or execute any package script. The existing trusted runtime selection remains separate from model import.

## Character data and persistence

Add versioned library, character and assignment records. A saved character references a base rig and texture-set identifier and stores sparse absolute appearance values against known defaults. It is independent of the runtime instance UUID and the agent session token.

Example record, illustrative parameter values only:

```json
{
  "schemaVersion": 1,
  "id": "local-character-uuid",
  "name": "Purple mechanic",
  "baseModelId": "local-model-uuid",
  "baseFingerprint": "sha256:...",
  "textureSetId": "local-texture-set-uuid",
  "sourcePresetId": "local-preset-uuid",
  "appearance": {
    "parameters": { "ParamHairFront": 1.5 }
  },
  "reactionProfileId": "local-reaction-profile-uuid"
}
```

Store library metadata, characters, reaction profiles and assignments in separate versioned files with atomic writes. Debounce draft autosaves; commit saved characters only on Save. A recovered draft must not automatically replace a saved appearance. Preserve the last valid version on write/parse failures. Undo/redo is scoped to the draft; group a slider drag into one edit. Reset one field/group uses the chosen base appearance; “Use rig defaults” is a separate explicit action.

Profiles contain local references, so initial profile export is a settings-only JSON with model fingerprint and relative asset identifiers, never textures or compiled data. Validate everything again on import and require a compatible local rig. Do not present such exports as automatically permitted by every model license; keep profile sharing outside the first delivery if permission is unclear.

Assignments reference a saved character ID. Maintain a user-selected default character and the existing stable Herdr preference identity. Reconnecting the same agent restores its assignment. Newly discovered agents use the default unless explicitly assigned. Duplicating a character copies settings, not the base assets. Keep assignments isolated so an update to one draft cannot modify another agent's appearance.

## Runtime appearance and animation layers

Add `lib/appearance-profile.mjs` for validated preset conversion and `web/appearance-controller.js` for frame application. First inspect the actual Pixi/Cubism update sequence to choose hooks around parameter save/load, motion, expressions and physics; do not assume the current `beforeModelUpdate` override is sufficient.

Required behavior:

1. Begin each frame from a stable model baseline; apply persistent appearance without accumulating additive values.
2. Evaluate idle motion, gaze/blink and temporary reactions with explicit ownership of overlapping parameters.
3. Run dependent physics against the intended inputs; avoid freezing physics outputs with blanket overrides.
4. Reset temporary animation independently of appearance. Reacting, expiring an MCP command, changing agent state and recovering a renderer must preserve the saved character.

Establish parameter roles: appearance, expression, tracking/input, physics output, separators/credits and unknown/advanced. CDI names/groups inform the UI but do not reliably define all runtime semantics. Read actual IDs, min/max/defaults from Cubism Core; use adapter annotations for ambiguous roles. Keep unknown controls in Advanced rather than guessing.

Convert supplied preset Add/Multiply/Overwrite operations against the documented base/default state, clamp to runtime bounds, then store resolved appearance values. Do not apply the offset again every frame or every preset selection. For appearance presets, save only appearance-role values; flag unexpected animation/physics controls for inspection.

Six Type-H1 expression entries use `VTS_Add`. Resolve their intended behavior before enabling those controller/keyboard mode expressions; until then show them as unsupported. Do not silently translate unknown blends. Empty EyeBlink/LipSync manifest groups require verified parameter mappings rather than assuming automatic support.

MCP keeps its existing agent-scoped capabilities/animate/message/reset/status contract. Capabilities report the selected character's supported reactions. Commands remain unable to modify saved appearances or switch arbitrary local files. Automatic reactions select only reaction entries, never appearance presets. Add the currently omitted done-state mapping alongside working, blocked, idle and disconnected, with a bounded celebration if supported.

## Customization controls

Use display metadata labels and grouping, with both label and ID search. Build controls only for actual runtime parameters. Hide separators from editing while preserving credits in the package information view.

Provide sliders plus numeric inputs, field/group resets, and a conditional “link left/right” option only when the adapter identifies a real pair. Do not round all selectors to integers: Type-H1 presets use fractional values. Show style buttons/dropdowns only for verified discrete ranges/options; otherwise retain a slider.

Offer color pickers for verified RGB triplets, keeping multiply, screen, outline and highlight colors distinct. Map UI colors through the rig's actual numeric ranges, which may include negative offsets and may not be 0–1 or 0–255. Do not assume suffix matching proves a color channel is editable. Accessories get toggles only where the on/off values are established; all controls retain an Advanced numeric view.

Persist inspector expansion/search within the editor without rebuilding 587 controls on every Herdr status event. Throttle preview changes to at most one update per animation frame and send batches for presets. Saving and agent updates are separate from high-frequency slider traffic.

## Preview, NVIDIA and resource handling

Embed one isolated preview renderer in the studio using a sandboxed child webContents and the existing narrow bridge, with a fixed editor-only session identity. The controls page never receives unrestricted filesystem access. Resolve parent/child positioning and resize behavior in the Electron layer; scope existing global CSS so desktop-avatar styles do not leak into the studio.

The embedded preview replaces the always-open extra desktop preview by default. Editing must therefore keep three connected agents at three desktop avatars, plus one preview only while the editor is active. Stop its ticker/release its model when the editor is inactive after a bounded delay; retain the draft in application state.

Continue NVIDIA mode and actual WebGL renderer verification for every rendering context. Keep software as an explicit fallback. Use 2048/4096 configurable atlas caps initially; original quality is an advanced option after measured GPU-memory validation. Cache resized texture bytes by source fingerprint, quality and atlas slot across sessions, but do not assume GPU textures can be shared between webContents.

Build a candidate model/texture set and wait for a healthy rendered frame before replacing the current one. Cancel stale imports/loads when the user changes selection quickly. Dispose the previous candidate on success, and failed/canceled candidates on failure. Bound caches and account for the temporary memory spike during swaps. Avoid GPU readback in ordinary rendering; thumbnails are generated on explicit save/import and cached.

## Files and implementation sequence

| Phase | Main changes | Completion evidence |
| --- | --- | --- |
| 1. Package library | Add package scanner/adapter and versioned registry; extend `lib/model-library.mjs` with validated display metadata; add library IPC in `electron/main.mjs` and preload | Local Type-H1 inventory shows nine appearance presets, five texture sets, 79 expressions and two motions; traversal/invalid files rejected |
| 2. Appearance engine | Add profile resolver and renderer layer; extend `electron/avatar-session.mjs` with character references and independent temporary state | Reapplying a preset is idempotent; reactions, reset and reload preserve appearance; unsupported VTS blends are explicit |
| 3. Presets and saved characters | Import deduplication, texture pairing, save/duplicate/relink, atomic persistence and assignments | Two agents show distinct appearances from one rig; editing one draft does not alter either until applied |
| 4. Studio GUI | Rebuild `web/control.html`, `web/control.js`, scoped `web/style.css`; add editor modules and embedded preview; move connection/runtime diagnostics into Settings | Complete keyboard-accessible import → preset → customize → save → assign flow at compact and standard sizes |
| 5. Agent behavior | Character selectors on agent cards, default character, reaction classification and done mapping; preserve MCP scope | Three agents react independently; appearance survives MCP expiry and Herdr disconnect/reconnect |
| 6. Migration and hardening | Settings migration, missing-asset recovery, resource cleanup, startup docs and neutral branding | Existing configuration migrates without asset deletion; NVIDIA rendering and click-through remain functional |

Each phase should remain runnable. Build the package scanner and deterministic appearance engine before the visual redesign depends on them. The first reviewable milestone is a library inventory plus one chibi preset rendered with persistent appearance and an independent reaction. The second is the complete studio and per-agent assignment flow.

## Migration and release handling

Back up the existing settings before writing the new schema. Preserve existing model paths/desktop preferences as legacy entries and explicitly offer switching assignments to the new default character. Do not silently replace running agents during migration. New installs open the character-import flow; existing installations retain their working setup until a replacement is saved and assigned.

Remove Mk6-specific arm correction from the generic renderer path; retain it only in a legacy adapter if necessary to preserve existing imports. Update README and Herdr launch instructions to avoid a hardcoded Ayla model path. Retain the user-selected Cubism Core because it is still required for the new models.

Keep `Type-H1_v2.0/` and `.local/` ignored. Build release artifacts from an explicit source allowlist, not by archiving the working directory. Verify that PNG/PSD/compiled model files, caches and imported profiles are absent from public artifacts. Generic synthetic test fixtures may be committed; proprietary package fixtures must stay local.

The supplied Type-H1 license has an AI-related restriction, as recorded in `TYPE_H1_ANALYSIS.md`. Continue generic library/editor development independently. Clarify permission with its creator before designating Type-H1 as the project's supported agent-companion asset or publishing demonstrations using it. No need to block model-independent code or UI work on that clarification.

## Validation and acceptance

Use synthetic fixtures for parser bounds, symlink containment, malformed/missing references, deduplication, blend conversion and schema migration. Cover repeated preset selection, transitions A→B→A, reset semantics, profile isolation and interrupted atomic saves. Check that texture-slot failures preserve the previous avatar and stale async loads cannot replace a newer selection.

Manual desktop verification must cover:

- The complete preset catalog and correct parameter/texture combinations, especially the texture sets with different artwork.
- Fractional selectors, color ranges and appearance surviving idle motion, physics, reactions, reset and restart.
- Three agent avatars plus an editor preview on RTX 4060, with actual NVIDIA renderer logs, GPU memory, frame timing and sustained swap behavior recorded. Set performance targets after measuring this rig; a 30 FPS setting alone is not proof of sustained 30 FPS.
- Native Wayland click-through, dragging, tray recovery, mixed DPI, window resize and missing/relinked model folders.
- No disk writes to source assets, no asset access through MCP, no cross-agent command effects, and no models in a release archive.

The feature is complete when users can import a permitted chibi package, browse its supplied presets, customize and save distinct characters, assign them to agents, and retain each character's appearance through automatic/MCP reactions and restarts using the redesigned GUI.


## Implementation progress — 17 October 2026

First milestone is user-verified: package import, supplied parameter presets/texture choices, persistent appearance, saved characters and per-agent assignment.

Second milestone implemented: isolated embedded studio renderer with a desktop fallback; hide/tab/viewport ticker suspension; grouped undo/redo and revert checkpoints; numeric, field/group reset and normalized RGB controls; character thumbnails, duplication and explicit overwrite; done-state reaction mapping. These changes have automated coverage but still need user desktop verification.

Remaining work includes a fully separate recovered draft versus saved-character workflow with unsaved navigation handling, embedded preview background choices, richer preset thumbnail browsing, asset relinking/fingerprints, model-specific color/discrete-option refinement, texture-cache bounds, and measured multi-avatar GPU/performance qualification. Existing source model files and assignments are preserved.

## Implementation completion — 17 October 2026

The six development phases are now implemented. Earlier “remaining work” notes above describe the intermediate milestones, not the current code status.

| Phase | Delivered implementation |
| --- | --- |
| Package library | Bounded folder discovery, display metadata, preset classification/deduplication, sibling-only preset admission, five validated texture sets, fingerprints and explicit refresh/relink |
| Appearance engine | Absolute values resolved from preset blends, stable appearance baseline before expression/physics updates, unsupported-blend errors, independent reactions, atomic initial-appearance validation before model replacement |
| Characters | Named save/overwrite/duplicate/remove, default/per-agent assignment, settings-only import/export, compatibility fingerprints, separate saved workspace and recovery draft, navigation decisions and undo history |
| Studio | Embedded isolated preview and fallback, backgrounds/zoom, supplied-preset browser with generated thumbnails/progress/cancel, grouped numeric/color/paired controls, field/group resets, search, keyboard navigation and agent cards |
| Agent behavior | Independent scoped MCP/Herdr reactions, done mapping, normal/sleep idle selection, preserved appearances and stable assignment preferences |
| Hardening | Content-addressed immutable variants, integrity repair, pinned LRU disk pruning, shared bounded resized-texture cache, frame-batched edits, load cancellation, settings backups/recovery, graceful save on quit, explicit source-only packaging and performance telemetry |

Validation performed in this environment:

- Unit/integration checks cover the filesystem, parser, history, settings, cache, isolated sessions, cancellation and frame-summary contracts.
- The actual Type-H1 package was inspected and a Preset1 texture variant materialized in a temporary folder. It retained 79 expressions, nine appearance presets and two motions, with no duplicate names; repeated materialization reused the same content-addressed path. Temporary validation assets were removed afterward.
- GUI IDs and preload/handler wiring were inspected; browser modules are served with the appropriate JavaScript MIME type.
- Source packaging was exercised and inspected for asset exclusion.

Desktop acceptance remains a separate verification step: visually inspect all preset/texture combinations and animation layering, check native Wayland controls and mixed-DPI layout, and measure three agents plus the active preview on the RTX 4060. The Settings performance tool records the relevant runtime measurements; this sandbox cannot certify actual NVIDIA device access or sustained FPS. No hardware-performance or compositor success is claimed from unit tests alone.

Compatibility boundaries are intentional: unknown discrete style names retain numeric controls, nonstandard VTS_Add expressions remain unsupported, and model-specific tracking/color behavior is not fabricated. These do not block the completed local customization workflow.


## User-directed simplification

The primary UI now favors coordinated full looks. Detailed controls remain collapsed. Optional hair/outfit choices are filtered to a shared texture set and validated server-side. Above-head titles, native/corner-handle desktop resizing, GUI size controls, per-agent activity logs, and state/message-driven expression behavior extend the completed implementation.
