# Documentation assets

- `icon.svg` is an original vector mark drawn for this project's documentation. It
  contains no character artwork or imagery taken from an imported model.
- `screenshots/page-looks.png`, `page-companions.png`, and `page-settings.png` are
  captures of the actual studio interface running `scripts/ui-preview.mjs --docs`.
  Project names and agent states are illustrative fixture data. No Live2D model,
  texture, model thumbnail, Cubism runtime, or user settings were loaded.

The documentation fixture serves this icon instead of the local character-package
icon. The three fixture screenshots demonstrate the model-free interface and controls;
character rendering requires the user's own compatible model and trusted runtime.

To reproduce the interface, run:

```sh
node scripts/ui-preview.mjs --docs
```

Open the printed URL at 1200×900. Capture Looks, then Desktop & behavior with a
project selected, then Settings. The fixture does not send commands to live agents.

## Attributed model examples

- `screenshots/example-looks.png` and `example-preview-narrow.png` are existing
  GUI captures from the dark-theme review. They show customized Type-H1 looks,
  including the character artwork used by the local app mark.
- **Live2D model by 0x4682B4** — https://0x4682b4.com/
- Product: https://0x4682b4.booth.pm/items/4991289
- License: https://0xlive2dmodels.glycoproduction.com/license/

These screenshots contain rasterized model artwork, not runtime model files or
texture atlases. They carry no license to reuse the underlying character artwork.
The original model files remain in ignored local folders.

The app imports and renders the model locally and plays its authored animations
and expressions. Coding-agent status signals select reactions. Model assets are
not used for AI training or edited with generative AI. The screenshots document
this rendering and playback; the artist’s license continues to govern the model
and artwork. No artist endorsement is claimed.
