"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface ContoursProps extends AsciiSceneProps {
  /** The index lines, and the high ground in `truecolor` mode. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The ordinary lines, and the low ground in `truecolor` mode. Default: `ink` at 45% over `paper`. */
  lineColor?: AsciiColor;
  /** The map behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once: paper, then low to high. Wins over `ink`, `lineColor` and `paper`. */
  palette?: AsciiPalette;
  /** How many contour lines from the lowest ground to the highest, 4 to 32. Default 12. */
  lines?: number;
  /** Size of the hills. Higher values pack more of them in. Default 1. */
  scale?: number;
  /** Every how many lines one is drawn heavier, as on a survey map. 0 draws them all the same. Default 5. */
  index?: number;
  /** How strongly the slopes facing away from the light are shaded, 0 to 1. Default 0.4. */
  relief?: number;
  /** Line weight in samples, 0.6 (hairline) to 3. Default 1.2. */
  weight?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// The map is sized to the box height, so a glyph grid of any density
// shows the same hills. The line test divides by the local slope, so every
// line is `weight` samples wide on steep and gentle ground alike.
const FIELD = `
float contoursHeight(vec2 p, float t) {
  // Low-frequency noise only, so lines stay unbroken; detail comes from the warp.
  vec2 q = p + vec2(4.3 + t * 0.008, 2.9 + t * 0.003);
  q += 0.3 * vec2(snoise(q * 0.45 + vec2(1.7, t * 0.008)), snoise(q * 0.45 + vec2(8.3, -t * 0.006)));
  return 0.5 + 0.34 * snoise(q * 0.85) + 0.14 * snoise(q * 1.9 + 4.1);
}

float contoursLine(float h, float hx, float hy, float count, float width) {
  float v = h * count;
  float offset = abs(fract(v + 0.5) - 0.5);
  float perSample = max(length(vec2(hx - h, hy - h)) * count, 1e-4);
  float d = offset / perSample;
  float line = 1.0 - smoothstep(width * 0.5 - 0.5, width * 0.5 + 0.5, d);
  return line * (1.0 - smoothstep(0.08, 0.14, offset));
}

vec3 contoursSample(vec2 uv, vec2 res, float t) {
  // One sample row in map units, for the slope that keeps lines even.
  float unit = 1.4 * contoursScale / res.y;
  vec2 p = (uv - 0.5) * res * unit;
  vec2 e = vec2(unit, 0.0);
  float h = contoursHeight(p, t);
  return vec3(h, contoursHeight(p + e.xy, t), contoursHeight(p + e.yx, t));
}

float field(vec2 uv, vec2 res, float t) {
  vec3 s = contoursSample(uv, res, t);
  float h = s.x;

  // Ordinary lines sit at mid tone and index lines at full, so glyph
  // ramps draw the index lines denser, like a heavier pen.
  float tone = contoursLine(h, s.y, s.z, contoursLines, contoursWeight) * 0.55;
  if (contoursIndex > 0.5) {
    float nearest = floor(h * contoursLines + 0.5);
    float isIndex = 1.0 - step(0.5, mod(nearest, contoursIndex));
    float heavy = contoursLine(h, s.y, s.z, contoursLines, contoursWeight * 1.8);
    tone = mix(tone, heavy, isIndex);
  }

  // Hillshade, lit from the top left: slopes facing away pick up the
  // lightest glyphs, so the hills read in relief between the lines.
  float unit = 1.4 * contoursScale / res.y;
  vec2 grad = vec2(s.y - h, s.z - h) / unit;
  vec3 n = normalize(vec3(-grad * 0.9, 1.0));
  float lit = dot(n, normalize(vec3(-0.6, 0.6, 0.6)));
  float shade = contoursRelief * 0.22 * smoothstep(0.6, 0.15, lit);
  return max(tone, shade);
}
`;

// Hypsometric tint: low ground takes the line colour, high ground the ink.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float h = contoursSample(uv, res, t).x;
  return paletteColor(smoothstep(0.15, 0.85, h)).rgb;
}
`;

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Faint concentric rings in CSS, shown without WebGL. */
const fallbackImage = (palette: AsciiPalette) => {
  const ink = cssColor(palette.at(-1) ?? palette[1]);
  const line = `color-mix(in oklab, ${ink} 30%, transparent)`;
  return `repeating-radial-gradient(ellipse 120% 90% at 35% 40%, transparent 0 22px, ${line} 22px 24px)`;
};

/**
 * A topographic map drawn in glyphs: contour lines over slowly drifting
 * hills, with heavier index lines and a light hillshade. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Contours = ({
  ink = "--ascii-ink",
  lineColor,
  paper = "--ascii-paper",
  palette,
  lines = 12,
  scale = 1,
  index = 5,
  relief = 0.4,
  weight = 1.2,
  charset = "braille",
  colorMode = "palette",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 6,
  ...props
}: ContoursProps) => {
  const colors = palette ?? [
    paper,
    lineColor ??
      `color-mix(in oklch, ${cssColor(ink)} 45%, ${cssColor(paper)})`,
    ink,
  ];

  return (
    <AsciiShader
      {...props}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, colors.at(-1) ?? ink, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={{
        contoursIndex: Math.max(0, Math.round(index)),
        contoursLines: clamp(lines, 4, 32),
        contoursRelief: clamp(relief, 0, 1),
        contoursScale: Math.max(0.1, scale),
        contoursWeight: clamp(weight, 0.6, 3),
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: cssColor(colors[0]),
            backgroundImage: fallbackImage(colors),
          }}
        />
      }
    />
  );
};
