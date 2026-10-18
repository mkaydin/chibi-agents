# Companion Studio

Local customizable Live2D chibi characters for Herdr agents, with NVIDIA rendering, transparent desktop avatars and agent-scoped MCP reactions. Model assets stay on your computer and are excluded from source packages.

## Start

Requires Node 22.12+ and the installed npm dependencies. On this workspace the existing local dependency links can be recreated with `node scripts/use-local-dependencies.mjs`; a standalone checkout can use `npm install`.

```sh
npm start
```

The launcher detects Wayland on Linux and uses the saved model and Cubism runtime. Use `npm start -- --x11` to force X11. On first setup, choose a trusted Cubism Core runtime in Settings; its saved path is reused on subsequent launches. Runtime JavaScript executes in the avatar renderer: select only a trusted SDK runtime. Import character packages separately through Looks.

Linux defaults to NVIDIA PRIME offload. Actual `[graphics]` output must identify NVIDIA/RTX 4060 to verify the intended device; NVIDIA mode reports an error if WebGL chooses another vendor. `--graphics opengl`, `--graphics auto`, and explicit CPU fallback `--graphics software` are available. Restart the app to change the graphics backend. Native Wayland uses a compatible installed Electron runtime when available. `--desktop-preview` restores a separate studio preview window if needed.

## Create and assign characters

1. Open **Characters → Import package folder**. Select the entire `Type-H1_v2.0` folder, including `Type-H1` and `Sample Characters`.
2. Use **Edit preview character** to keep draft work separate from desktop agents.
3. Choose one of the package's supplied presets and its texture artwork, or use **Browse supplied presets**. Matching texture sets are selected automatically when available. Type-H1 contains nine appearance presets and five alternate texture sets.
4. Customize grouped controls. Fractional sliders, numeric inputs, per-field/group resets, RGB mixers, linked left/right fields and verified switch endpoints are available. Unknown styles retain numeric controls rather than invented option names.
5. Use **Save as new character**, or a saved card's explicit overwrite action. Saved cards also support edit, duplicate, settings import/export, model relinking and removal from the library. Removing a card never deletes model assets.
6. Select an agent and **Assign to selected window**, or use its card under **Agents & animation**. **Use as default** affects new agents without an existing assignment. Saved-character edits do not silently update running agents; assign the updated character explicitly.

**Generate preset thumbnails** renders the supplied appearances locally, with progress/cancel controls, then restores the studio editor, including undo history. The original package is never rewritten. Settings exports contain parameter values and local references, not model/texture files; importing requires the matching local package or explicit model relinking.

## Drafts and animation

Studio edits are autosaved as a recovery draft independently of the saved workspace and character library. Navigation away from a modified draft offers **Save workspace / Discard changes / Cancel**. On restart, a recovery notice offers restoring or discarding the previous draft. **Save workspace** retains the current editor baseline without changing a named library character. **Revert saved** restores the saved workspace/model and appearance.

Undo/redo groups a slider gesture into one step. Keyboard shortcuts outside text inputs: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl/Cmd+Y. Appearance survives automatic reactions, MCP overrides, motion resets and reloads. The parameter-preset dropdown changes parameters only; use the package card to pair a preset with alternate artwork.

RGB controls normalize the rig's real parameter ranges. Final visible colors also depend on source textures and multiply/screen channels. Appearance groups are inferred from display metadata and supplied presets; other model-specific values remain in Advanced controls. VTube Studio-specific `VTS_Add` expressions are reported as unsupported rather than silently reinterpreted.

Normal idle motion is selected automatically when a model supplies `idle`; a supplied `idle_sleep` can be enabled after sustained inactivity through Liveliness settings. An explicit idle selector can choose a different motion or disable idle animation. Reactions have separate mappings for working, blocked, done, idle and disconnected states.

## Preview and desktop

The studio preview uses an isolated sandboxed WebContentsView, separate from agent renderers. Choose solid, checkerboard or transparent preview backgrounds and adjust preview zoom. Its ticker pauses when the preview is hidden, scrolled out of view, or the studio is minimized. Desktop avatars remain independent.

Desktop controls include scale, visibility, centering, frame rate, topmost and whole-window click-through where supported. Drag a character while click-through is off; recover controls from the tray. Wayland behavior remains compositor-dependent. Each detected Herdr root agent gets its own avatar; the studio preview is separate. More avatars increase rendering and memory use.

## Assets, recovery and memory

The repository shares the application system, not character packages or the Cubism runtime. Keep all downloaded/imported Live2D packages (including textures, icons, thumbnails, and licenses) under `live2d-assets/` or `.local/`; these directories are excluded from Git. Model binaries, Cubism metadata, common atlas folders, asset archives, and SDK/runtime files are also ignored wherever they occur. Ordinary image files outside these directories are not universally ignored, so application UI artwork can still be versioned. Supply your own compatible models and trusted Cubism Core runtime.

**Refresh package** explicitly accepts changed source files after revalidation. **Relink folder** reconnects a moved package; saved character settings retain their asset references. **Relink model file** repairs an individual legacy character. Missing or incompatible files produce errors without replacing the last healthy avatar. Newer load requests cancel obsolete loads.

Settings retain a migration backup and last valid version; invalid files are preserved for recovery. The original `ayla-companions` user-data directory is retained for compatibility, unless `COMPANION_DATA_DIR` overrides it.

Texture variants use content-addressed local copies under user-data `character-variants`; repeated selections reuse them. Cache entries are integrity-checked and regenerated from valid source assets as needed. Managed unpinned variants are trimmed to a 1 GiB target, while active/baseline assets remain pinned; pinned data can exceed the target. Older unowned folders are preserved. Compressed resized textures share a bounded 128 MiB cache plus bounded per-loading-model buffers. PSDs are never loaded by the renderer.

**Settings → Rendering & diagnostics** provides 2048/4096/8192 atlas limits and 15/30/60 FPS. Quality applies on the next model load. Software mode caps atlases at 2048 regardless of the hardware-quality setting. Full-resolution textures consume more VRAM; original Type-H1 atlases total about 336 MiB of raw RGBA data per renderer before additional allocations.

**Measure 10 seconds** records actual frame pacing, selected models, GPU information and Electron process metrics in `artifacts/performance.json`. Paused/no-model renderers are identified separately. Normal rendering does not read back GPU pixels every frame; thumbnails and explicit diagnostics do.

## Herdr and MCP

See [integration setup](integrations/SETUP.md) for the plugin launcher and stdio MCP configuration. MCP capabilities, status, temporary animation, message and reset commands are scoped to the authenticated agent session. MCP cannot change saved appearances or select arbitrary local files. `--no-herdr` runs the studio alone.

## Validate and package

```sh
npm run check
npm run package:source
```

The source builder uses an explicit source allowlist and writes `dist/companion-studio-source`. It excludes models, textures, PSDs, Cubism Core, local profiles, caches, dependencies and diagnostics. It does not publish or upload anything.

Automated checks cover preset math, draft/history separation, cache bounds/integrity, source-preserving imports, migration/corruption recovery, canceled loads, per-agent isolation and renderer lifecycle contracts. The locally supplied Type-H1 package has also been inspected and materialized successfully with 79 expressions, nine appearance presets, two motions, five texture sets and no duplicate expression names.

Full KDE/Wayland window behavior, rendered appearance and sustained RTX 4060 performance still require desktop acceptance testing. These are not implied by passing unit tests. See [the implementation plan](CUSTOMIZABLE_CHIBI_PLAN.md) and [Type-H1 analysis](TYPE_H1_ANALYSIS.md).


## Simplified controls

The main workflow is now **complete look → assign to agent → resize**. Detailed customization and library maintenance are collapsed under Advanced/More. Full looks automatically use their matching texture artwork. Hair/outfit mixes are offered only among presets sharing the same texture set; incompatible artwork combinations are rejected by the backend as well as filtered in the GUI.

Desktop agent titles sit above the visible character geometry. Resize by dragging the corner handle (or native window edges), or use **Agents → Desktop size → Character size**. Sizes are bounded to the display and saved per agent. Disable click-through while dragging or resizing.

Working, blocked, done and disconnected states trigger compatible expressions. Received MCP messages can also trigger thinking/help/success/error expressions, without affecting the saved appearance. Recent state changes, messages and selected expressions appear in the per-agent activity log. This uses Herdr state and messages delivered to the companion; it does not scan arbitrary terminal log files.


## Natural life and reactions

Each agent now has its own blink timing, gaze targets, head drift and breathing phase. The driver runs before physics, so hair, ears and cloth follow the inputs naturally; it avoids channels owned by the current clip. Blink multiplies the current expression's eye openness and continues during ordinary idle clips. Sleep/manual pose channels take precedence.

Under **Agents → Liveliness**, choose **Still / Calm / Lively**. Movement options include temperament, blinking, looking around, head motion, breathing and optional rest after 1/5/15 minutes. Defaults are Calm, with rest disabled. A disconnected agent no longer immediately sleeps, and a blocked agent remains attentive. Four agents have independent timing even when using the same look.

Activity reactions include short nods/tilts, with cooldowns and fade-out for temporary symbols. Repeated message accents are throttled. Meaningful rest/wake transitions are logged; individual blinks and breaths are not. The Still option disables automatic movement/accents while retaining explicit manual reactions.

**Notice cursor** controls pointer attention. **Greet cursor** adds a brief independent nod, raised brows and glance when the pointer enters the character bounds, even during a status reaction. X11 uses a shared cursor sampler; KDE native Wayland uses the temporary KWin relay, including click-through windows. Other Wayland compositors use local pointer events.

A **Glasses** toggle appears for compatible models under Quick style. It is a persistent accessory layer, so Question/Loading reactions do not replace it. The existing authored idle clips continue animating supported wings, tails and effects, with hair/ear/fabric physics preserved. Nonstandard keyboard/controller mode expressions remain unsupported; no new artwork or unverified prop poses are synthesized.

The animation tests cover seeded independence, blink bounds, long-frame recovery, expression/clip ownership, rest/wake, reaction cooldowns, cursor limits, SDK update order and orphaned-pose cleanup. Visual tuning and multi-avatar GPU measurements still require the desktop session.

The local Type-H1 v1.4 archive now connects all twelve recovered mouse/keyboard/controller clips plus the v1.1 alternate tail idle automatically when its extracted folder is present. **Agents → Activity props** selects automatic working props, standing, full/half keyboard, controller or microphone. Unsupported poses fall back to standing. Automatic props shuffle keyboard-only and keyboard + mouse setups across agents, choosing again when a new work session starts and keeping the choice through activity changes. The mouse prop smoothly follows the pointer across the virtual desktop; mouse clicks and keystrokes are not captured. Manual pose previews return after four seconds. **Recovered animations** can import a different v1.4 Expressions folder or remove the overlay. Source assets remain unchanged.

Herdr integration now uses completion counters, structured activity metadata and optional throttled terminal status-line hints. MCP actions include thinking, reading, searching, editing, testing, running, done and error. For agent tool hooks, use `node scripts/report-activity.mjs testing 3000` from the agent’s Herdr pane. [Full behavior plan](LIVE_BEHAVIOR_PLAN.md) describes all situations, priorities and fallback behavior.

Native Wayland does not support Electron’s always-on-top API. On KDE the app now loads a temporary KWin keep-above helper for its own avatar windows, respecting each avatar’s checkbox. The GUI reports helper failures. This uses `qdbus6`, changes no persistent KWin configuration and unloads on exit; actual compositor stacking still needs desktop verification.

Desktop positions are remembered per agent and restored on restart. On KDE Wayland, the temporary KWin helper reads and restores placement; it also supplies local hover coordinates for click-through avatars. This uses the system's `python3`, `dbus-python` and PyGObject in addition to `qdbus6` (available on this machine). The relay accepts geometry/cursor reports only from KWin with a session token, retains no global pointer history and exits with the app. Helper errors appear under Desktop placement.

Desktop labels now show the project name, with agent kind, pane and activity on a smaller second line. Repository roots are preferred over nested source folders. **Greet the cursor on hover** controls a brief, throttled notice reaction independently of **Notice cursor** tracking. Reading, searching, thinking, editing, testing, running, waiting and completion use distinct gestures; phases without a suitable symbol use a gesture alone.

The app header, window icon and tray use the existing local `live2d-assets/Type-H1_v2.0/Type-H1/icon.png`. On Linux, startup creates/updates its own `companion-studio.desktop` entry in your user applications folder, with a matching [Electron desktop identity](https://www.electronjs.org/docs/latest/api/app#appsetdesktopnamename-linux) for the taskbar. The icon remains in the ignored local assets folder and is not bundled with source exports.

Typing uses a Core-validated pool of letter and number key expressions with independently seeded bursts, short key releases and longer thinking pauses. Full keyboard uses both hands; keyboard + mouse keeps right-hand key expressions out of the typing pool. No physical keys are read. Compatible models also gain temporary brow-angle/form and mouth-shift accents for agent reactions.

Under **Agents → Movement & attention → Keyboard & effect theme**, choose Original, Lavender, Mint or Amber. Supported keyboard, Loading and Question color channels receive the theme; Original restores the saved appearance colors. Themes are saved per agent and do not edit model assets.
