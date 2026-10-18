# Companion Studio interface

Companion Studio is a local Electron tool for importing Live2D character packages,
customizing a studio preview, saving looks, and controlling project companions.
The interface serves repeated editing and configuration tasks. Character artwork
is the primary visual content; labels and controls should stay quiet and legible.

## Visual direction

A quiet anime character studio, explicitly requested by the user: matte charcoal
surfaces, soft off-white typography, dusty-rose actions, and a subdued blue-charcoal
preview stage. Existing chibi artwork carries the anime identity. No neon, glow,
gloss, glass effects, decorative gradients, animated backgrounds, or display-font
costumes. The interface should feel comfortable during a long evening session.

The source tokens live in `web/style.css` under `body.controls`: canvas, surface,
subtle surface, ink, muted text, line, accent, hover, selected, field, control line,
pressed, focus, and stage. Body controls remain 14px, secondary copy 13px, headings
17px, and the app heading 26px. Buttons and fields have at least 42px height. Selected
looks combine a quiet mauve fill with a crisp outline. Status colors are desaturated
and always paired with words. Native form controls use the dark color scheme.

This is a theme refinement of the established editing layout. The library/preview
split, visible editing target, narrow-window shortcuts, and controls remain in
place. The Settings banner now describes its own task. Primary actions use a flat light rose fill with dark text; most
controls use dark surfaces. Repeated section headings have a slightly smaller scale.

## Layout and interaction

- Header, primary navigation, and editing target precede task-specific controls.
- Desktop Looks pairs the library with the preview and style editor.
- Below 900px, a library shortcut and import action precede the preview. The library
  follows in the same scroll view. The shortcut moves to the actual library.
- Project companion cards expose the selected target. When the studio is selected
  on the behavior page, explicit guidance directs users to a project companion.
- Advanced controls remain disclosures. Presets expose `aria-pressed`; navigation
  exposes `aria-current`; connection and saved state use status announcements.
- Empty libraries explain how to import or save a look.
- Motion is limited to 160ms button color/border feedback, disabled for reduced
  motion. No page-entry choreography delays the editing task.
- Desktop avatar transparency and drag behavior remain scoped separately. Only
  the embedded studio preview's solid background follows the dark stage.

## Skills

Installed and applied the requested skills from their upstream repositories:

- [Impeccable 4.6.0](https://github.com/pbakaus/impeccable), installed as `impeccable`.
- [Oil UI 0.23.8](https://github.com/oil-oil/oil-ui), installed as `oil-ui`.

These are installed user-level Codex skills. The Impeccable
launcher could not execute (permission denied), so product context was read from
existing code and documentation; its Operate and craft guidance was applied
manually. Oil UI supplied the visual hierarchy guidance and screenshot tooling.

## Verification and review

Evidence is local and ignored by Git:

- `artifacts/design-before/`: original empty-library desktop baseline.
- `artifacts/design-final/`: all three views at 1200×900 and 390×844, using existing
  project character thumbnails in an isolated fixture.
- `artifacts/design-navigation/`: narrow library shortcut and full-page capture.
- `artifacts/design-interactions-final/`: preset/disclosure and agent/settings
  navigation walkthroughs.

One independent visual review identified narrow-screen library discoverability
and ambiguity of the studio target on the behavior page. Both were corrected.
Final screenshots were checked for loading failures, console errors, contrast,
readability, and horizontal overflow. Existing syntax and control-wiring checks
passed. Repeated oversized labels above headings were removed; instructions that
explain editing scope and saves were retained. Agent inventory's redundant outer
panel was removed while preserving its individually selectable cards.

The preview harness uses fixture state and existing thumbnails, not a running
Cubism renderer or live agent data. Native file dialogs, real saves/reloads,
Herdr integration, and live preview compositing were not exercised by this UI
verification. The project test suite was not run in full for this visual change.

## Anime dark theme verification

The follow-up dark theme uses the user's explicit aesthetic direction. Impeccable's
Operate/craft-floor guidance and Oil UI's visual-language guidance were applied to
contrast, hierarchy, restrained state colors, spacing, and actual screenshot review.

- `artifacts/anime-dark/`: Looks, Desktop & behavior, and Settings at 1200×900 and
  390×844. Screenshot checks passed with no console errors, horizontal overflow,
  unloaded images, or reported text-contrast/readability findings.
- Syntax check and the existing control-wiring check passed.
- Motion remains the existing 160ms button feedback, with reduced-motion support.
  No new animation or visual effects were added.
- No copy was removed in this theme pass; existing instructions are already concise.
- Screenshots use existing character artwork and fixture state. Live saves, native
  dialogs, and Cubism compositing were not tested by this theme pass.

One independent review of this theme found a stale Looks instruction in the
Settings banner; it now describes connections, runtime, and rendering. No other
material visual issues were reported. A manual contrast calculation also raised
normal control borders from 2.34:1 to 3.18:1 against their field surface.
