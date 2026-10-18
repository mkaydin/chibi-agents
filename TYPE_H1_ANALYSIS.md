# Type-H1 v2.0 inspection

Inspected the local package on 2026-10-17. No model files were changed. Asset validation passed through `inspectModel`; visual rendering was not tested.

## What this package is

One compiled, customizable Live2D character rig, with interchangeable appearance presets and texture artwork. JSON controls the existing rig; it cannot create new meshes or add unrigged hairstyles or clothes.

| File or directory | Purpose |
| --- | --- |
| `Type-H1/Type-H1.model3.json` | Runtime entry point: compiled model, three atlases, physics, display metadata |
| `Type-H1/Type-H1.moc3` | Compiled geometry, deformation and parameter behavior |
| `Type-H1/Type-H1.cdi3.json` | 587 parameter labels, 35 groups, 89 part labels, six paired parameter definitions; not parameter ranges/defaults |
| `Type-H1/Type-H1.physics3.json` | Physics rig |
| `Type-H1/Type-H1.vtube.json` | VTube Studio configuration: 54 input mappings, 81 hotkeys, UI preferences, physics and model-position settings |
| `Type-H1/Expressions/` | 79 expressions, including nine appearance presets (`Preset0x`, `Preset1` through `Preset8`) |
| `Type-H1/Motions/` | `idle` and `idle_sleep` motion files |
| `Sample Characters/` | Nine preset expression files and five texture sets, with PNG/PSD artwork |

The manifest omits expression/motion catalogs, but our existing folder discovery correctly finds 79 expressions and two motions. VTube Studio's bare expression/motion filenames refer to files in these subfolders, not missing assets.

## Customization capabilities

Labeled controls cover skin tone; brows, eye shape and pupil patterns; separate eye colors; front, side and back hair; hair length; hairbands; ahoge; halos; mechanical accessories; horns; animal ears; neck accessories; tops, coats, ties, bottoms, socks and shoes; wings; tails; keyboard/controller artwork; and numerous color channels.

Examples include `ParamSkinTone`, `ParamHairFront`, `ParamHairBackLength`, `ParamTop`, `ParamCoat`, `ParamWingSize`, `OddEyeSwitch`, and `C_EyeR/G/B`. Names suggest functions, but valid ranges/defaults must come from the loaded Cubism Core model. Some entries are credits or section separators rather than useful editing controls. Do not assume every selector uses integers: supplied presets contain fractional values.

Preset JSON files contain parameter offsets using `Blend: Add`, not complete absolute character definitions. For example, Preset1 has 28 entries and Preset8 has 142. Applying these values directly as absolute slider values would produce incorrect results. Preserve unspecified defaults and interpret blend modes. Six entries across the expression library use the VTube Studio-specific `VTS_Add` blend; these require an explicit compatibility review rather than silently treating them as standard Cubism expressions.

Texture presets supply replacement artwork for the same atlas slots. They should be paired with the corresponding parameter preset when provided. Changing a preset expression alone does not switch the textures. Original atlases are 4096×4096, 8192×8192 and 2048×2048 despite the folder name `Type-H1.4096`. Raw RGBA storage is about 336 MiB per full-resolution atlas set before mipmaps and other GPU resources. Our current 4096 hardware cap reduces this, at a detail cost; multiple instances need profiling.

## Fit with our application

Already supported: model import, physics loading, discovered expressions/motions, and runtime parameter sliders. This is structural compatibility, not a verified visual result with the selected Core version.

Missing for a good character editor:

1. Parse display metadata to show named, grouped controls and search names as well as IDs. Retain credits and avoid displaying separator parameters as ordinary sliders.
2. Store an independent appearance profile for each agent: local model reference, atlas selection, parameter values, and schema version. Keep source model files unchanged.
3. Separate persistent appearance from temporary expressions, idle animation, gaze/blink, and physics. Currently an expression preset occupies the expression manager, and another reaction can replace it. Reset also clears parameter overrides. Appearance must survive reactions, resets and restarts.
4. Convert preset offsets against the appropriate base values, with validation and clamping against runtime ranges. Review nonstandard blend entries and expression fade behavior.
5. Add a validated texture-set importer. Current containment rules intentionally reject sibling `Sample Characters` paths; explicitly import a permitted texture set into local derived storage rather than weakening path checks.
6. Offer save/load/duplicate profiles, then assign a profile per Herdr agent. MCP reactions should affect the temporary layer rather than rewriting the saved appearance.

VTube Studio configuration is useful reference data but is not an executable configuration for Pixi. Its hotkeys, tracking mappings, and UI customizations do not automatically work in our renderer. Empty manifest EyeBlink/LipSync groups also mean those capabilities should not be inferred from the manifest alone.

## Included license and repository handling

The local `LICENSE.txt` requires lawful purchase for a license, prohibits redistribution, requires attribution, permits modifications, and discusses software integration subject to asset protection. Section 4.5 explicitly lists generative AI systems and AI-generated content systems among restricted uses. Whether displaying this model as an agent companion is covered needs clarification from the creator before adopting it for that use. This inspection does not establish permission.

The creator listed in the package is 0x4682B4, with website `https://0x4682b4.com/`. Review the supplied license for exact terms and attribution requirements.

The entire `Type-H1_v2.0/` folder is now ignored, including PNGs, PSDs and VTube Studio configuration, which the extension-based ignores alone did not cover. Keep it out of repository publication and release packages.

Recommendation: build a generic local character-profile editor from this structure, while keeping model assets user supplied. Resolve this model's AI-use permission separately from implementing the generic customization features.
