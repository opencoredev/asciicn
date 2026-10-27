# Choosing a charset and a colour mode

The charset decides what the picture is made of; the colour mode decides how it is lit. Choose both for the subject, not by habit.

## Charsets

| Id          | Samples per cell | Glyphs                                 | Use it for                                                                   | Avoid it for                                 |
| ----------- | ---------------- | -------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------- |
| `standard`  | 1x1              | ` .:-=+*#%@`                           | Photos, portraits, classic ASCII art, anything people should read as "ASCII" | Fine lines (too coarse)                      |
| `dense`     | 1x1              | 70 glyphs, `.` to `$`                  | Smooth gradients, faces, fog and smoke                                       | Small cells under 10px (glyphs turn to mush) |
| `blocks`    | 1x1              | ` ░▒▓█`                                | Bold fills, bars, heatmaps, ANSI art, light-mode backgrounds                 | Detail                                       |
| `quadrants` | 2x2              | ` ▘▝▀▖▌▞▛▗▚▐▜▄▙▟█`                     | Solid shapes at twice the resolution: logos, pixel art, maps, terrain        | Soft gradients                               |
| `braille`   | 2x4              | `⠁` to `⣿`                             | Line charts, wireframes, contours, orbits, starfields, fine 3D               | Large filled areas (looks grey)              |
| `cp437`     | 1x1              | `·•○◘♠♣♥♦▲▼☺☻░▒▓█`                     | DOS, BBS and retro-PC moods                                                  | Corporate UI                                 |
| `petscii`   | 1x1              | `╱╲─│╭╮●◆▄▌█`                          | Commodore 64 moods, playful retro                                            | Photos                                       |
| `katakana`  | 1x1              | `ｱｳｴｵｶｷｼﾂｿﾝ` and digits                | Digital rain, cyberpunk signage                                              | Anything that should read as calm            |
| `dots`      | 1x1              | ` ·•●`                                 | Halftone print, newsprint, soft glows                                        | Text-like art                                |
| `edge`      | 1x1              | `- / \| \` on edges, `standard` inside | Line drawings, outlines of a photo or a 3D shape, blueprints                 | Flat fields with no edges                    |

Custom ramps: `chars=" .oO@"` (empty to dense, at least two glyphs) wins over `charset`. Use a custom ramp for a brand ("` -=≡`" for a minimal look, `" 01"` for binary). Order glyphs by how much ink they show in the font, or the tones will jump.

Rules of thumb:

- Braille and quadrants only show detail when the field has detail at sample scale. A soft glow in Braille looks like grey static; use `dots` or `standard` for soft things.
- On a light background, sparse charsets (`standard`, `dots`, `braille`) look faint. Prefer `blocks`, a larger `cell`, or `invert` for dark-on-light art.
- `edge` needs contrast in the field. It is best on images and on fields with clear shapes.
- Mixing charsets on one page is fine when each part has its own role: Braille for a chart, blocks for a progress bar, standard for a hero image.

## Colour modes

| Mode        | How a glyph is coloured                                                        | Use it for                                                |
| ----------- | ------------------------------------------------------------------------------ | --------------------------------------------------------- |
| `mono`      | Every glyph in `--ascii-ink`, or a `phosphor`                                  | Most UI, terminals, anything that should follow the theme |
| `palette`   | The tone picks a colour from `palette` (paper, then inks from faint to strong) | Theme-coloured backgrounds with depth, charts with series |
| `duotone`   | The tone picks a colour on a `ramp`, dark to bright                            | Moody backgrounds, heat, night scenes                     |
| `truecolor` | The source colour per glyph: a `colorField`, an image, a video                 | Photos, video, sunsets, neon, anything with real colour   |
| `ansi16`    | The source colour snapped to 16 terminal colours (`ansi="vga"` or `"xterm"`)   | ANSI art, terminal screenshots, `.ans` export             |

Phosphors for `mono`: `p1` green `#33ff66`, `p3` amber `#ffb000`, `ibm` white `#f4f4f5`, `blueprint` cyan `#38bdf8`. They are fixed colours, so give them a dark paper in light mode (wrap the section in `className="dark"` or set `paper`).

Duotone ramps: `mainframe`, `sodium`, `heliograph`, `infrared`, `outrun`, `orchid`, `glacier`, `ember`, `toxic`, `vapor`. Read `RAMPS` in `lib/ascii/palettes.ts` for the stops, or pass your own: `ramp={["#0b1020", "#3b82f6", "#e0f2fe"]}`.

## Grading

`grade={{ brightness, contrast, gamma, saturation }}` adjusts tones before the glyph is chosen. Raise `contrast` (1.2 to 1.6) when a field or image uses only a few glyphs. Lower `gamma` (0.7 to 0.9) to open up shadows in a photo. `invert` swaps dense and empty, for dark ink on a light page.

`dither="bayer4"` (or `"bayer8"`, `"blue-noise"`) blends neighbouring glyph levels in a fixed pattern. It smooths gradients in short ramps such as `blocks` and `dots`.

## Picking for common requests

| Request                               | Charset               | Colour mode                             |
| ------------------------------------- | --------------------- | --------------------------------------- |
| "Matrix" or digital rain              | `katakana`            | `mono` with `p1`, or `palette`          |
| A terminal or CRT panel               | `standard` + text     | `mono` with `p1` or `p3`, `fx={CRT_FX}` |
| A photo turned to ASCII               | `standard` or `dense` | `truecolor`, or `mono` for print        |
| A line chart or sparkline             | `braille`             | `mono` or `palette` per series          |
| A heatmap or bar chart                | `blocks`              | `palette`                               |
| A logo in ASCII                       | `quadrants`           | `mono`                                  |
| A starfield, orbit or wireframe globe | `braille`             | `mono` or `duotone`                     |
| Fire, plasma, a sunset                | `dense` or `blocks`   | `truecolor` with a `colorField`         |
| A blueprint or technical drawing      | `edge`                | `mono` with `blueprint`                 |
| Newsprint or a halftone portrait      | `dots`                | `mono`, `invert` on light pages         |
| Retro game or BBS screen              | `cp437` or `petscii`  | `ansi16`                                |
