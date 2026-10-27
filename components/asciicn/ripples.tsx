"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

/** A point relative to the box: x from the left, y from the top. May lie outside 0 to 1. */
export type RipplesSource = readonly [number, number];

export interface RipplesProps extends AsciiSceneProps {
  /**
   * Where the rings start, as fractions of the box from the top left. One
   * to four points; rings from different points cross and interfere.
   * Default `[[0.28, 0.38], [0.74, 0.66]]`.
   */
  sources?: readonly RipplesSource[];
  /** The colour of the crests. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The colour of the second source's rings, in `truecolor` mode. Default `"blue"`. */
  secondColor?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the brightest crest last. Wins over `ink`, `secondColor` and `paper`. */
  palette?: AsciiPalette;
  /** How many rings fit in the height of the box. Default 10. */
  rings?: number;
  /** How quickly the rings fade away from their source. 0 keeps them strong across the box. Default 1. */
  decay?: number;
  /** The brightest tone, 0 to 1. Lower it to sit text on top. Default 1. */
  intensity?: number;
  /** What the pointer does to the glyphs. Default `"ripple"`: a click drops a new ring. */
  interaction?: Interaction;
}

const DEFAULT_SOURCES: readonly RipplesSource[] = [
  [0.28, 0.38],
  [0.74, 0.66],
];

/**
 * Each source sends out a train of rings, fading with distance. A crest
 * has a bright core and a dimmer shoulder on each side, so in any charset
 * a ring reads as a line with a soft edge rather than a band of one glyph.
 * `ripplesWater` returns the tone in x and how much of it came from the
 * second and later sources in y, for the colour.
 */
const FIELD = `
float ripplesRing(vec2 p, vec2 at, float aspect, float t, float phase) {
  vec2 o = vec2(at.x * aspect, 1.0 - at.y);
  float d = length(p - o);
  float wave = 0.5 + 0.5 * cos(d * ripplesRings * 6.2831853 - t * 0.8 + phase);
  float envelope = exp(-d * ripplesDecay * 3.0) * smoothstep(0.0, 0.05, d);
  float crest = smoothstep(0.86, 0.98, wave) * 0.65 + smoothstep(0.62, 0.86, wave) * 0.35;
  return crest * envelope;
}

vec2 ripplesWater(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // A slow swell bends the rings slightly, as on real water.
  p += 0.01 * vec2(snoise(p * 1.4 + vec2(t * 0.03, 0.0)), snoise(p * 1.4 + vec2(5.2, t * 0.025)));

  float first = ripplesRing(p, ripplesA.xy, aspect, t, 0.0);
  float rest = 0.0;
  if (ripplesCount > 1.5) rest += ripplesRing(p, ripplesA.zw, aspect, t, 2.1);
  if (ripplesCount > 2.5) rest += ripplesRing(p, ripplesB.xy, aspect, t, 4.2);
  if (ripplesCount > 3.5) rest += ripplesRing(p, ripplesB.zw, aspect, t, 1.3);
  float sum = first + rest;
  // Where two crests cross they add up to the densest glyphs.
  return vec2(ripplesIntensity * clamp(sum * 0.95, 0.0, 1.0), rest / max(sum, 1e-4));
}

float field(vec2 uv, vec2 res, float t) {
  return ripplesWater(uv, res, t).x;
}
`;

// The first source's rings run up the palette from the second colour;
// the others' rings take the colour just before the last.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 w = ripplesWater(uv, res, t);
  vec3 own = paletteColor(0.55 + 0.45 * w.x).rgb;
  vec3 other = paletteColor(0.25 * w.x).rgb;
  return mix(own, other, w.y);
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

const packSources = (sources: readonly RipplesSource[]) => {
  const [a = DEFAULT_SOURCES[0], b = a, c = a, d = a] = sources;
  return {
    ripplesA: [a[0], a[1], b[0], b[1]] as const,
    ripplesB: [c[0], c[1], d[0], d[1]] as const,
  };
};

/** Rings around each source in CSS, shown without WebGL. */
const RipplesFallback = ({
  palette,
  sources,
}: {
  palette: AsciiPalette;
  sources: readonly RipplesSource[];
}) => {
  const ink = cssColor(palette.at(-1) ?? palette[1]);
  const line = `color-mix(in oklab, ${ink} 25%, transparent)`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: sources
          .slice(0, 4)
          .map(
            ([x, y]) =>
              `repeating-radial-gradient(circle at ${(x * 100).toFixed(1)}% ${(y * 100).toFixed(1)}%, transparent 0 18px, ${line} 18px 21px, transparent 21px 36px)`
          )
          .join(", "),
      }}
    />
  );
};

/**
 * Concentric rings of glyphs spreading from one to four points, crossing
 * and interfering like drops on still water. A click drops another.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Ripples = ({
  sources = DEFAULT_SOURCES,
  ink = "--ascii-ink",
  secondColor = "blue",
  paper = "--ascii-paper",
  palette,
  rings = 10,
  decay = 1,
  intensity = 1,
  charset = "braille",
  colorMode = "palette",
  cell = 12,
  interaction = "ripple",
  interactive = true,
  stillTime = 5,
  ...props
}: RipplesProps) => {
  const colors = palette ?? [
    paper,
    mix(secondColor, 70, paper),
    mix(ink, 55, paper),
    ink,
  ];

  return (
    <AsciiShader
      {...props}
      cell={cell}
      charset={charset}
      colorMode={colorMode}
      {...glass(props.phosphor, colors.at(-1) ?? ink, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={{
        ...packSources(sources),
        ripplesCount: clamp(sources.length, 1, 4),
        ripplesDecay: Math.max(0, decay),
        ripplesIntensity: clamp(intensity, 0, 1),
        ripplesRings: Math.max(1, rings),
      }}
      fallback={<RipplesFallback palette={colors} sources={sources} />}
    />
  );
};
