# Documentation assets

- `icon.svg` is an original vector mark drawn for this project's documentation. It
  contains no character artwork or imagery taken from an imported model.
- `screenshots/page-looks.png`, `page-companions.png`, and `page-settings.png` are
  captures of the actual studio interface running `scripts/ui-preview.mjs --docs`.
  Project names and agent states are illustrative fixture data. No Live2D model,
  texture, model thumbnail, Cubism runtime, or user settings were loaded.

The documentation fixture serves this icon instead of the local character-package
icon. Screenshots demonstrate the model-free interface and available controls;
character rendering requires the user's own compatible model and trusted runtime.

To reproduce the interface, run:

```sh
node scripts/ui-preview.mjs --docs
```

Open the printed URL at 1200×900. Capture Looks, then Desktop & behavior with a
project selected, then Settings. The fixture does not send commands to live agents.
