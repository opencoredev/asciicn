"use client";

import { cssColor, resolveCharset } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface MatrixProps extends AsciiSceneProps {
  /** The rain colour. Default `"green"`, the theme's phosphor green. */
  color?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the stream heads last. Wins over `color` and `paper`. */
  palette?: AsciiPalette;
  /** Share of columns with a stream falling at any moment, 0 to 1. Default 0.7. */
  density?: number;
  /** Average stream length in rows. Default 16. */
  length?: number;
  /** How often a glyph changes as it falls, in changes per second. Default 4. */
  mutation?: number;
  /** Strength of the far, slower layer behind the main rain, 0 to 1. Default 0.5. */
  depth?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

/**
 * Columns of glyphs falling at their own speeds. The field pass draws one
 * fragment per sample, so `gl_FragCoord` gives the exact sample, and
 * `matrixGrid` (samples per glyph: 2x4 for Braille) turns it into a glyph
 * column. Every sample of a glyph column shares one stream. Heads step in
 * whole sample rows, so they tick down like a terminal; speeds and lengths
 * are scaled to count glyphs.
 *
 * `matrixRain` returns the tone in x, and in y 1 on a head, -1 on the far
 * layer, 0 elsewhere.
 */
const FIELD = `
float matrixHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

vec2 matrixLayer(vec2 res, float t, float seed, float pace) {
  float column = floor(gl_FragCoord.x / matrixGrid.x);
  float fromTop = floor(res.y - gl_FragCoord.y);
  float h = matrixHash(vec2(column, seed));
  float speed = mix(7.0, 20.0, matrixHash(vec2(column, seed + 3.7))) * pace * matrixGrid.y;
  float len = matrixLength * matrixGrid.y * mix(0.45, 1.6, matrixHash(vec2(column, seed + 9.1)));
  // A gap of up to most of a screen between passes, so columns go quiet.
  float period = res.y + len + res.y * mix(0.05, 0.7, h);
  float travel = t * speed + h * period;
  float pass = floor(travel / period);
  // Each pass rolls again whether the column rains at all.
  if (matrixHash(vec2(column + pass * 17.0, seed + 1.3)) > matrixDensity) {
    return vec2(0.0);
  }
  float head = floor(mod(travel, period));
  float behind = head - fromTop;
  if (behind < 0.0 || behind > len) {
    return vec2(0.0);
  }
  float fade = 1.0 - behind / len;
  // Every glyph flips to a neighbour on the ramp a few times a second, on
  // its own clock, so the tail shimmers with changing characters.
  float clock = floor(t * matrixMutation * mix(0.5, 1.5, matrixHash(vec2(column, fromTop))) + matrixHash(vec2(fromTop, column)) * 7.0);
  float flip = (matrixHash(vec2(column * 1.7 + clock, fromTop + seed)) - 0.5) * 0.2;
  float isHead = step(behind, 0.5);
  // Tails stay in the dense part of the ramp (katakana, not punctuation)
  // and fade through colour; heads sit at the very top.
  float tone = mix(0.34, 0.86, pow(fade, 1.2)) + flip;
  return vec2(mix(tone, 0.94 + flip * 0.3, isHead), isHead);
}

vec2 matrixRain(vec2 uv, vec2 res, float t) {
  vec2 near = matrixLayer(res, t, 0.0, 1.0);
  vec2 far = matrixLayer(res, t, 41.0, 0.55);
  // The far layer is slower and only shows between near streams. Its
  // glyphs stay readable; colour and a lower tone make it recede.
  if (near.x > 0.0 || matrixDepth < 0.01) {
    return near;
  }
  return vec2(far.x * mix(0.5, 0.8, matrixDepth), far.x > 0.0 ? -1.0 : 0.0);
}

float field(vec2 uv, vec2 res, float t) {
  return clamp(matrixRain(uv, res, t).x, 0.0, 1.0);
}
`;

// Tails read through the palette by tone, heads take its last colour and
// the far layer its dimmest.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 rain = matrixRain(uv, res, t);
  float fade = clamp((rain.x - 0.2) / 0.7, 0.0, 1.0);
  if (rain.y > 0.5) {
    return paletteColor(1.0).rgb;
  }
  return paletteColor(rain.y < -0.5 ? fade * 0.2 * matrixDepth : fade * fade * 0.75).rgb;
}
`;

/** Ink and paper for the shader, unless a phosphor brings its own. */
const glass = (
  phosphor: string | undefined,
  ink: AsciiColor,
  paper: AsciiColor
): { ink?: AsciiColor; paper?: AsciiColor } =>
  phosphor === undefined ? { ink, paper } : {};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** `color` mixed into `base` at `share` percent. */
const mix = (color: AsciiColor, share: number, base: AsciiColor) =>
  `color-mix(in oklch, ${cssColor(color)} ${share}%, ${cssColor(base)})`;

/** Faint vertical streaks in CSS, shown without WebGL. */
const MatrixFallback = ({ palette }: { palette: AsciiPalette }) => {
  const rain = cssColor(palette.at(-2) ?? palette[1]);
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: `repeating-linear-gradient(90deg, transparent 0 22px, color-mix(in oklab, ${rain} 18%, transparent) 22px 30px, transparent 30px 47px, color-mix(in oklab, ${rain} 9%, transparent) 47px 55px, transparent 55px 71px), linear-gradient(to bottom, transparent, ${cssColor(palette[0])})`,
      }}
    />
  );
};

/**
 * Digital rain: columns of glyphs falling at their own speeds, each with a
 * bright head and a fading tail of characters that keep changing, over a
 * dimmer, slower layer behind. Katakana by default. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Matrix = ({
  color = "green",
  paper = "--ascii-paper",
  palette,
  density = 0.7,
  length = 16,
  mutation = 4,
  depth = 0.5,
  charset = "katakana",
  colorMode = "truecolor",
  cell = 14,
  interaction = "none",
  interactive = true,
  stillTime = 9,
  ...props
}: MatrixProps) => {
  // Samples per glyph: Braille is 2x4, quadrants 2x2, ramps 1x1.
  const { grid } = resolveCharset(charset, props.chars);
  const colors = palette ?? [
    paper,
    mix(color, 30, paper),
    mix(color, 62, paper),
    color,
    mix(color, 45, "--ascii-ink"),
  ];

  return (
    <AsciiShader
      {...props}
      cell={cell}
      charset={charset}
      colorMode={colorMode}
      {...glass(props.phosphor, colors.at(-2) ?? color, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={{
        matrixDensity: clamp(density, 0, 1),
        matrixDepth: clamp(depth, 0, 1),
        matrixGrid: grid,
        matrixLength: clamp(length, 2, 80),
        matrixMutation: clamp(mutation, 0, 30),
      }}
      fallback={<MatrixFallback palette={colors} />}
    />
  );
};
