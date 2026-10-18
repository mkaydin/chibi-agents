# Type-H1 documentation review

Reviewed 18 October 2026 against our current renderer and local v2.0 package. Research only; runtime behavior and source model files were not changed.

## Findings from the creator

The model supports Cubism 5 software, although VTube Studio is the creator's primary tested host. Many capabilities are input-driven: mouse position moves the mouse prop, per-key expressions move keyboard hands, and controller inputs drive sticks/buttons. These are not all standalone motion clips. [Content and tracking reference](https://0xlive2dmodels.glycoproduction.com/models/type-h1/content/).

The release notes confirm v2.0 combines the four modes into one rig, expands accessory choices, and changes atlas layout. Older painted atlases therefore cannot be assumed interchangeable. They also flag VoiceSilence as necessary for correct mouth tracking in VTube Studio, and stick-contact priority over controller button presses. These require explicit adapter handling if implemented outside VTS. [Release notes](https://0xlive2dmodels.glycoproduction.com/models/type-h1/update-notes/).

The visual catalog identifies keyboard overall opacity, keyboard background opacity, keyboard color, and separate colors for expression eyes, glasses, Loading, Question and sleep effects. These could become a small set of coordinated theme presets. [Misc controls](https://0xlive2dmodels.glycoproduction.com/models/type-h1/customization-parameters/misc/).

For future texture editing, the creator supplies a neutral-color expression: it sets most RGB adjustments to 255. Mirrored parts can share atlas pixels, so painting one side can change both. [Texture information](https://0xlive2dmodels.glycoproduction.com/models/type-h1/important-information/).

The accessory catalog includes ear shape/position, horn dimensions, halo/mechanical accessory sizing, and wing/tail options. These are appearance selectors, not proof of independent expressive animation channels. [Accessories](https://0xlive2dmodels.glycoproduction.com/models/type-h1/customization-parameters/acc/).

## Comparison with our implementation

| Area | Current local implementation | Useful next improvement |
| --- | --- | --- |
| Work modes | Shuffled full/half keyboard setup, stable during work | Keep this policy; add authored transition blending |
| Mouse prop | Smoothed cursor drives ParamMouseX/Y | Verify direction and hand tracking visually in both work modes |
| Keyboard | Four symbolic key expressions repeat | Use a larger validated key pool, varied bursts and independent pauses |
| Face | Blink, gaze, head, brow-height and mouth-form offsets; temporary expressions | Add bounded brow form/angle and mouth shape combinations after rig validation |
| Controller | Available pose with a symbolic button accent | Add stick/contact/button coordination if controller behavior is wanted |
| Appearance | Coordinated presets and persistent accessory layer | Add a few matching keyboard/effect color themes |
| Accessories | Authored idle and physics retained | Audit dynamic channels before adding emotion-specific movement |
| Hover | Independent procedural notice layer | Verify on desktop; the documentation does not supply a ready-made hover animation |

## Local evidence and limitations

The shipped Type-H1.vtube.json maps MousePositionX/Y from [-1,1] to ParamMouseX/Y [-30,30]. Our current adapter uses those parameter IDs with runtime Core bounds, plus smoothing. VTS configuration is reference data; our renderer does not execute its hotkeys or tracking graph.

KeyA, KeyD and Key1 expression files pair ParamhandLX/LY offsets with individual key channels. Our automatic typing currently cycles Key1, Key2, KeyA and KeyD. Expanding the pool should validate all expression channels and release old keys at the end of every burst. Full-keyboard behavior should include both hands; half-keyboard behavior must preserve mouse-hand ownership. Do not simply randomize every expression filename, because the same directory also contains appearance presets and mode changes.

The two keyboard mode expressions include VTS_Add angle entries, which remain nonstandard for our Cubism expression loader. Continue translating supported mode parameters explicitly instead of enabling those files wholesale.

Our life adapter currently drives ParamBrowLY/RY and ParamMouthForm, but not a complete voice/viseme system. For future speech, inspect ParamVoiceSilence and the vowel channels together with mouth-open/jaw mappings and test neutral recovery. The VTS-specific warning alone does not establish the correct direct-Core neutral value.

The documentation is largely a visual catalog, not an exhaustive numeric API. It does not provide reliable selector ranges, defaults, dependency rules for every outfit, or parameter ownership for animation composition. Continue deriving bounds/defaults from Cubism Core, relationships from shipped presets and mappings, and final appearance from rendered verification.

## Recommended implementation order

1. Expand symbolic typing with validated left/right hand key pools, per-agent burst timing and release cleanup. Preserve the existing mouse-hand control in half-keyboard mode.
2. Build a small facial reaction palette using compatible brow, eye and mouth channels; preserve persistent appearance and the independent hover layer.
3. Add coordinated prop/effect themes without exposing hundreds of sliders.
4. Validate every combination on the actual desktop: both work modes, hover, blocked/error/completion, glasses, sleep/wake, and different accessories.
5. Treat controller input, speech visemes and manual texture editing as separate optional features.

No new assets were downloaded and no application tests were required for this documentation-only review.

## Implemented following this review

Expanded automatic typing to a validated letter/number pool with independently seeded bursts and pauses, preserving the mouse hand in half-keyboard mode. Added bounded brow-angle/form and mouth-shift reaction channels with authored-clip ownership. Added per-agent Original/Lavender/Mint/Amber keyboard and effect themes. Runtime source files remain unchanged. Desktop visual verification remains necessary; speech and controller input are still separate optional work.
