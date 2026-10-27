"use client";

import { cssColor, resolveCharset } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

/** A point in the box: x from the left, y from the top, both 0 to 1. */
export type HalftonePoint = readonly [number, number];

interface NoiseSource {
  /** Soft, slowly drifting clouds. */
  source?: "noise";
  center?: never;
  radius?: never;
  direction?: never;
}

interface RadialSource {
  /** Dots are largest at `center` and shrink away from it. */
  source: "radial";
  /** Where the dots are largest. Default `[0.5, 0.5]`. */
  center?: HalftonePoint;
  /** Where the dots run out. 1 reaches the farthest corner. Default 1. */
  radius?: number;
  direction?: never;
}

interface LinearSource {
  /** Dots grow across the box in one direction. */
  source: "linear";
  /** Direction the dots grow towards, in degrees as in CSS: 0 is up. Default 0. */
  direction?: number;
  center?: never;
  radius?: never;
}

export type HalftoneSource = NoiseSource | RadialSource | LinearSource;

/** Two or three inks, printed as separate screens that overlap like CMYK. */
export type HalftoneChannels =
  | readonly [AsciiColor, AsciiColor]
  | readonly [AsciiColor, AsciiColor, AsciiColor];

interface MonoInk {
  /** Colour of the dots: a palette name such as `"blue"`, a CSS variable name, or any CSS colour. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  channels?: never;
}

interface MultiInk {
  /**
   * Two or three inks, each on its own screen turned 30° from the last.
   * Where dots overlap, their colours mix. Shows in `truecolor` mode.
   */
  channels: HalftoneChannels;
  ink?: never;
}

export type HalftoneInk = MonoInk | MultiInk;

export type HalftoneProps = AsciiSceneProps &
  HalftoneSource &
  HalftoneInk & {
    /** Colour behind the dots. Default `"--ascii-paper"`. */
    paper?: AsciiColor;
    /** Distance between dot centres, in glyph rows. Below 1.5 every glyph is its own dot. Default 3. */
    pitch?: number;
    /** Screen angle in degrees. Extra channels add 30° each. Default 45. */
    angle?: number;
    /** Size of the noise clouds. Noise source only. Default 1. */
    scale?: number;
    /** Size of the largest dot, 0 to 1. At 1 the biggest dots just touch. Default 0.95. */
    intensity?: number;
    /** How fast the screen slides along its angle, so dots swell and shrink as they cross the source. 0 holds it still. Default 1. */
    drift?: number;
    /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
    interaction?: Interaction;
  };

// Distances are in sample rows (`halftoneGrid` samples per glyph row), so a
// dot spans the same number of glyphs in every charset: in `braille` it is
// a crisp disc of dots, in `dots` a cluster of ● fading to · at its edge.
const FIELD = `
float halftoneSource(vec2 uv, float aspect, float t, float channel) {
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 phase = vec2(3.7, 1.9) * channel;
  if (halftoneMode < 0.5) {
    // Two broad octaves only: wide, soft swells give the dots room to grade.
    vec2 q = p * 1.1 * halftoneScale + phase;
    float n = snoise(q + vec2(t * 0.05, -t * 0.03)) * 0.75
      + snoise(q * 2.1 + vec2(-t * 0.04, t * 0.06) + 7.3) * 0.25;
    return smoothstep(-0.35, 0.8, n);
  }
  float drift = (fbm(p * 1.4 + phase + vec2(t * 0.04, -t * 0.03)) - 0.5) * 0.22;
  if (halftoneMode < 1.5) {
    vec2 c = vec2((halftoneCenter.x - 0.5) * aspect, 0.5 - halftoneCenter.y);
    vec2 corner = vec2(aspect * 0.5 + abs(c.x), 0.5 + abs(c.y));
    return clamp(1.0 - length(p - c) / (length(corner) * halftoneRadius) + drift, 0.0, 1.0);
  }
  float a = radians(halftoneDirection);
  vec2 dir = vec2(sin(a), cos(a));
  float extent = abs(dir.x) * aspect * 0.5 + abs(dir.y) * 0.5;
  return clamp(dot(p, dir) / (2.0 * extent) + 0.5 + drift, 0.0, 1.0);
}

// How much of this sample one channel's screen covers, 0 to 1, with a
// one-sample soft edge that glyph ramps draw as smaller glyphs.
float halftoneScreen(vec2 uv, vec2 res, float t, float channel) {
  float aspect = res.x / res.y;
  if (halftonePitch < 1.5) {
    float value = halftoneSource(uv, aspect, t, channel);
    return value * halftoneIntensity;
  }
  float pitch = halftonePitch * halftoneGrid;
  vec2 px = vec2(uv.x * aspect, uv.y) * res.y;
  float a = radians(halftoneAngle + 30.0 * channel);
  mat2 toGrid = mat2(cos(a), -sin(a), sin(a), cos(a));
  mat2 fromGrid = mat2(cos(a), sin(a), -sin(a), cos(a));
  vec2 slide = fromGrid * vec2(t * halftoneDrift * 1.5 * halftoneGrid, 0.0);
  vec2 q = toGrid * (px + slide) / pitch;
  vec2 id = floor(q) + 0.5;
  vec2 local = q - id;

  // Each dot takes one value, sampled at its centre, as in print.
  vec2 centre = (fromGrid * (id * pitch) - slide) / res.y;
  centre.x /= aspect;
  float value = halftoneSource(centre, aspect, t, channel);
  float radius = 0.5 * sqrt(value) * halftoneIntensity;
  return clamp((radius - length(local)) * pitch + 0.5, 0.0, 1.0);
}

float field(vec2 uv, vec2 res, float t) {
  float ink = halftoneScreen(uv, res, t, 0.0);
  if (halftoneChannels > 1.5) {
    ink = max(ink, halftoneScreen(uv, res, t, 1.0));
  }
  if (halftoneChannels > 2.5) {
    ink = max(ink, halftoneScreen(uv, res, t, 2.0));
  }
  return ink;
}
`;

// Each channel's ink is its share of the palette ramp; overlaps blend.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float last = max(halftoneChannels - 1.0, 1.0);
  vec3 sum = paletteColor(0.0).rgb * (halftoneScreen(uv, res, t, 0.0) + 1e-4);
  float weight = halftoneScreen(uv, res, t, 0.0) + 1e-4;
  if (halftoneChannels > 1.5) {
    float w = halftoneScreen(uv, res, t, 1.0);
    sum += paletteColor(1.0 / last).rgb * w;
    weight += w;
  }
  if (halftoneChannels > 2.5) {
    float w = halftoneScreen(uv, res, t, 2.0);
    sum += paletteColor(1.0).rgb * w;
    weight += w;
  }
  return sum / weight;
}
`;

const MODES = { linear: 2, noise: 0, radial: 1 } as const;
const CENTRE: HalftonePoint = [0.5, 0.5];

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** CSS dot screens, one per ink, shown without WebGL. */
const Fallback = ({
  paper,
  inks,
  angle,
}: {
  paper: AsciiColor;
  inks: readonly AsciiColor[];
  angle: number;
}) => (
  <div
    className="absolute inset-0 overflow-hidden"
    style={{ backgroundColor: cssColor(paper) }}
  >
    {inks.map((ink, index) => (
      <div
        key={index}
        className="absolute -inset-1/2"
        style={{
          backgroundImage: `radial-gradient(circle, ${cssColor(ink)} 30%, transparent 32%)`,
          backgroundSize: "2.25rem 2.25rem",
          maskImage: "radial-gradient(closest-side, #000, transparent)",
          mixBlendMode: index > 0 ? "screen" : undefined,
          transform: `rotate(${angle + 30 * index}deg)`,
        }}
      />
    ))}
  </div>
);

/**
 * A print halftone built from glyphs: round dots on a rotated screen that
 * grow with a noise, radial or linear source, in one ink or two to three
 * overlapping channels. The screen slides slowly so dots swell and shrink
 * as they travel. Decorative and full-bleed: size it with `className`,
 * usually `absolute inset-0`.
 */
export const Halftone = (props: HalftoneProps) => {
  const {
    pitch = 3,
    angle = 45,
    scale = 1,
    intensity = 0.95,
    drift = 1,
    ink = "--ascii-ink",
    channels,
    paper = "--ascii-paper",
    source = "noise",
    center = CENTRE,
    radius = 1,
    direction = 0,
    charset = "braille",
    chars,
    colorMode = "truecolor",
    cell = 12,
    interaction = "none",
    interactive = true,
    phosphor,
    ...shaderProps
  } = props;
  const inks = channels ?? [ink];
  const palette: AsciiPalette = channels ? [paper, ...channels] : [paper, ink];

  return (
    <AsciiShader
      {...shaderProps}
      charset={charset}
      chars={chars}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, inks[0], paper)}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={palette}
      uniforms={{
        halftoneAngle: angle,
        halftoneCenter: center,
        halftoneChannels: inks.length,
        halftoneDirection: direction,
        halftoneDrift: drift,
        halftoneGrid: resolveCharset(charset, chars).grid[1],
        halftoneIntensity: clamp(intensity, 0, 1),
        halftoneMode: MODES[source],
        halftonePitch: Math.max(1, pitch),
        halftoneRadius: Math.max(0.01, radius),
        halftoneScale: Math.max(0.05, scale),
      }}
      fallback={<Fallback paper={paper} inks={inks} angle={angle} />}
    />
  );
};
