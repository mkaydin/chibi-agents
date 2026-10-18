# Type-H1 archive comparison

Compared local packages on 18 October 2026. All five archives were extracted separately under `live2d-assets/older-versions/`; ZIPs and v2.0 source files were preserved. No older files have been merged into the active model.

## Findings

**There are useful omitted animation files, but no missing older expression or preset filenames.** v2.0 has 79 expressions and only two motion clips; v1.4 has 72 expressions and 14 clips. v2.0 expands the rig substantially. Older artwork is not automatically interchangeable with its compiled model.

| Package | Expressions¹ | Presets | Motions | CDI parameters² | CDI parts² | Physics settings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Type-H1 | 69 | 5 | 9 | 280 | 46 | 47 |
| Type-H1_v1.1 | 71 | 5 | 10 | 314 | 55 | 47 |
| Type-H1_v1.2 | 72 | 5 | 9 | 327 | 60 | 47 |
| Type-H1_v1.3 | 72 | 5 | 10 | 349 | 69 | 47 |
| Type-H1_v1.4 | 72 | 5 | 14 | 351 | 64 | 47 |
| Type-H1_v2.0 | 79 | 9 | 2 | 587 | 89 | 48 |

¹ Runtime expression files, deduplicated by filename within the rig; sample-character copies are not counted twice. ² Display-info declarations, not runtime Core bounds or exhaustive compiled-mesh evidence.

## Missing animations worth recovering

The following are present in v1.4 and absent from v2.0:

| File | Duration | Likely use |
| --- | ---: | --- |
| `MouseL_OFF.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `MouseL_ON.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `MouseM_OFF.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `MouseM_ON.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `MouseR_OFF.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `MouseR_ON.motion3.json` | 0.05 s | Mouse press/release; ParamMouseClick and sometimes ParamMouseButton |
| `idle Controller.motion3.json` | 3.78 s | Controller pose/sleep |
| `idle Controller_sleep.motion3.json` | 3.78 s | Controller pose/sleep |
| `idle FULL.motion3.json` | 3.78 s | Full-keyboard pose/sleep |
| `idle FULL_sleep.motion3.json` | 3.78 s | Full-keyboard pose/sleep |
| `idle HALF.motion3.json` | 3.78 s | Half-keyboard pose/sleep |
| `idle HALF_sleep.motion3.json` | 3.78 s | Half-keyboard pose/sleep |

v1.1 additionally contains `idle copy.motion3.json`. Treat this as an alternate clip, not an extra feature based on its name alone. Earlier versions repeat the keyboard/mouse clips; v1.3 adds controller variants and v1.4 adds sleep variants, consistent with their included update notes.

**Compatibility:** every Parameter curve ID in the twelve missing v1.4 clips appears in v2.0 CDI. The six pose clips also animate PartOpacity IDs `Part`, `Part11` and `arms`, which remain declared. This makes them candidates for adaptation, not verified drop-in clips: Core ranges, updated part semantics, mode switching and rendered results still need checking. The six mouse clips are the smallest first experiment.

v2.0 normal/sleep clips retain the shared v1.4 curves unchanged, remove the three legacy PartOpacity curves, and add hand curves, ear-wing movement and a 15-channel tail chain. Replacing v2.0 idle wholesale would lose these additions. A compatible implementation should retain v2.0 accessory curves and explicitly compose pose-mode channels.

## Expressions and presets

Every older expression filename exists in v2.0. The old five appearance presets (`Preset0x`, `Preset1`–`Preset4`) remain, and v2.0 adds `Preset5`–`Preset8`. It also adds `Mode Controller`, `Mode Keyboard-Full` and `Mode Keyboard-Half` expression files.

The five raw JSON differences between v1.4 and v2.0 are:

- `Key0`: same parameter values/blends; additional metadata only.
- `Preset0x`: same parameter values/blends, reordered and additional metadata.
- `Preset2`: replaces `ParamCatEars` with `ParamAnimalEars`; adds eye/pupil outline color channels.
- `Preset3`: removes old cat-ear selector and changes pupil-pattern value.
- `Preset4`: replaces bear-ear selector with `ParamAnimalEars` and changes pupil-pattern value.

Earlier releases have additional preset/metadata differences; exact names and payloads are retained in the local JSON audit. Do not restore their preset JSON over the v2.0 equivalents: ear and pupil selectors evolved.

The new mode expressions still contain unsupported `VTS_Add` for head/body-angle adjustments. Copying old motions alone does not implement those semantics. Existing disabled mode expressions should remain disabled until an explicit pose adapter is tested.

## Artwork and other assets

Older archives contain full atlas variants under `Type-H1.4096/Default`, `Preset0x` and `Preset1`–`Preset4`, plus incremental `Updates/V1_1`, `V1_2`, `V1_3`, and `V1_4` patches as applicable. The v1.3/v1.4 patch assets include controller art named `texture_00_PS.png`, `texture_00_NS.png`, and `texture_00_XBOX.png`. Legacy `icon_FULL.png`, `icon_HALF.png`, and `icon_Controller.png` are also absent as identical files from v2.0.

These old PNGs have different SHA-256 contents from every v2.0 file. That establishes different files, not missing visible designs: packing, art revisions or encoding can change hashes. Atlas UV compatibility cannot be established from matching texture dimensions or filenames. Keep old atlases with their matching `.moc3`, or visually inspect and deliberately port individual designs. Do not use update patch textures as complete preset atlas sets.

No PSD files were found in the old archives; v2.0 includes eleven. No extra animation format was found beyond the JSON motion clips. VTube Studio configuration and legacy update notes remain available in the extracted folders for input/pose mapping research.

## Rig changes

v2.0 has 587 declared parameters versus 351 in v1.4 and 48 physics settings versus 47. The old ear selectors, old cat-ear physics IDs and old strip rotation chain are no longer declared; they are not proof that the corresponding visual accessory was removed. Old/new mappings must be resolved by current Core capabilities and physics definitions.

Parameters declared in v1.4 but not v2.0:

`Hexose0x4682B4`, `ParamBearEars`, `ParamBunnyrEars`, `ParamCatEars`, `Param_Angle_Rotation_1_strip_2`, `Param_Angle_Rotation_2_strip_2`, `Param_Angle_Rotation_3_strip_2`, `Param_Angle_Rotation_4_strip_2`, `Param_Angle_Rotation_5_strip_2`, `Param_Angle_Rotation_6_strip_2`, `Param_Angle_Rotation_7_strip_2`, `Param_Angle_Rotation_8_strip_2`, `Param_Angle_Rotation_9_strip_2`, `PhyCatearLX`, `PhyCatearRX`.

## Recommended next work

1. Keep v2.0 as the default rig and preserve all older packages independently.
2. Add a local imported-motion overlay/catalog, with runtime Core parameter/part validation and explicit ownership. Preserve source packages.
3. Trial the six mouse clips with explicit press/release cleanup. Use synthetic agent activity only; no desktop input interception is necessary.
4. Build keyboard/controller modes from current v2.0 mode selectors and validated legacy pose channels, retaining its latest tail/ear-wing animation. Keep props optional and return cleanly to the current neutral appearance.
5. Qualify each mode against all coordinated looks, glasses, transient reactions and rest/wake before enabling automatic agent behavior.

## Paths and method

- Type-H1: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/older-versions/Type-H1`
- Type-H1_v1.1: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/older-versions/Type-H1_v1.1`
- Type-H1_v1.2: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/older-versions/Type-H1_v1.2/Type-H1_v1.2`
- Type-H1_v1.3: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/older-versions/Type-H1_v1.3/Type-H1_v1.3/Type-H1_v1.3`
- Type-H1_v1.4: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/older-versions/Type-H1_v1.4/Type-H1_v1.4/Type-H1_v1.4`
- Type-H1_v2.0: `/run/media/mka/21a17bf0-b299-4fc4-b7ad-d1ae185d2d922/Code/waifu-agents-mcp/live2d-assets/Type-H1_v2.0/Type-H1`

Local detailed audit: `artifacts/type-h1-version-comparison.json` contains parsed expression/motion/physics inventories, full file SHA-256 hashes, CDI data and per-version differences. Comparison used archive contents, normalized JSON, channel sets, file hashes and author update notes. No rendering or GPU compatibility claim is made.

Because the source folder moved, any existing library entry that still points to the old location should be relinked through the GUI to `live2d-assets/Type-H1_v2.0`. This audit did not edit saved user assignments.

## Recovery implementation — first increment

Added an opt-in, per-session recovered mouse catalog through the Agents GUI. Six known short scalar clips are parsed and snapshotted into memory, served through model-scoped routes, and persisted by local source-folder reference. Press curves are extended with their paired release values and made non-looping. The candidate renderer validates their channels and values against actual Core bounds before replacing a model; the life adapter tracks imported channel ownership and clears orphaned values when the clip ends or is interrupted. Existing v2.0 idle definitions and source files are unchanged. Imported mouse clips cannot be selected as looping idles. Keyboard/controller idle adaptation and visual prop-mode qualification remain pending.

For the extracted v1.4 archive, select:
`live2d-assets/older-versions/Type-H1_v1.4/Type-H1_v1.4/Type-H1_v1.4/Expressions`
