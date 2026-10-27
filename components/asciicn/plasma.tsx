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

export interface PlasmaProps extends AsciiSceneProps {
  /** The paper behind the glyphs. Default `"--ascii-paper"`. Ignored when `palette` is set. */
  paper?: AsciiColor;
  /**
   * The colours the waves cycle through, in order. In `truecolor` mode the
   * hue follows the wave phase; in `palette` mode the glyph tone picks
   * them. Default `["purple", "ink", "orange"]`.
   */
  colors?: readonly [AsciiColor, ...AsciiColor[]];
  /** Paper first, then the wave colours. Wins over `paper` and `colors`. */
  palette?: AsciiPalette;
  /** Size of the blobs. Higher values pack more of them in. Default 1. */
  scale?: number;
  /** How far slow noise bends the interference pattern, 0 to 1. Default 0.3. */
  warp?: number;
  /** How many times the tones cycle across one wave. Default 2. */
  bands?: number;
  /** How hard each band's edge is, 0 (a smooth swell) to 1 (a sharp crest). Default 0.5. */
  crest?: number;
  /** The brightest tone, 0 to 1. Lower it to sit text on top. Default 1. */
  intensity?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// plasmaWave returns the tone and the wave phase, so the colour field can
// cycle hue at a different rate from the glyph density.
const FIELD = `
vec2 plasmaWave(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * 7.5 * plasmaScale;

  // A slow noise warp keeps the classic sine pattern from looking mechanical.
  vec2 warp = vec2(
    fbm(p * 0.35 + vec2(t * 0.05, 0.0)),
    fbm(p * 0.35 + vec2(3.7, 1.9) - vec2(0.0, t * 0.04))
  ) - 0.5;
  p += warp * 3.0 * plasmaWarp;

  float v = sin(p.x * 0.9 + t * 0.31);
  v += sin(p.y * 1.1 - t * 0.23);
  v += sin((p.x * 0.6 + p.y * 0.8) * 1.2 + t * 0.17);
  vec2 orbit = vec2(sin(t * 0.13) * 1.6, cos(t * 0.11) * 1.2);
  v += sin(length(p - orbit) * 1.4 - t * 0.29);

  float wave = 0.5 + 0.5 * sin(v * 0.785398 * plasmaBands);
  // Crests sharpen the top of each band so the densest glyphs gather in
  // clear ridges, with open troughs between them.
  float lo = mix(0.0, 0.25, plasmaCrest);
  float tone = smoothstep(lo, 1.0, wave);
  tone = pow(tone, mix(1.1, 2.2, plasmaCrest));
  return vec2(tone * plasmaIntensity, v);
}

float field(vec2 uv, vec2 res, float t) {
  return plasmaWave(uv, res, t).x;
}
`;

// A triangle wave over the phase walks the palette forward and back, so
// neighbouring bands always share a colour edge.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float v = plasmaWave(uv, res, t).y;
  float phase = fract(v * 0.125 + t * 0.02);
  return paletteColor(abs(phase * 2.0 - 1.0)).rgb;
}
`;

const PLASMA_COLORS = [
  "purple",
  "ink",
  "orange",
] as const satisfies readonly AsciiColor[];

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Soft overlapping blobs in the palette's colours, shown without WebGL. */
const fallbackImage = (palette: AsciiPalette, intensity: number) => {
  const top = cssColor(palette.at(-1) ?? palette[1]);
  const mid = cssColor(palette[1]);
  const paper = cssColor(palette[0]);
  const fade = `${Math.round(intensity * 70)}%`;
  return [
    `radial-gradient(ellipse 45% 55% at 28% 35%, color-mix(in oklab, ${top} ${fade}, transparent), transparent 70%)`,
    `radial-gradient(ellipse 50% 45% at 72% 68%, color-mix(in oklab, ${mid} ${fade}, transparent), transparent 70%)`,
    `linear-gradient(${paper}, ${paper})`,
  ].join(", ");
};

/**
 * Classic demoscene plasma drawn in glyphs: overlapping sine waves that
 * flow into each other while the colour cycles through a palette.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Plasma = ({
  paper = "--ascii-paper",
  colors = PLASMA_COLORS,
  palette,
  scale = 1,
  warp = 0.3,
  bands = 2,
  crest = 0.5,
  intensity = 1,
  charset = "standard",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 9,
  ...props
}: PlasmaProps) => {
  const [first, ...rest] = colors;
  const ramp: AsciiPalette = palette ?? [paper, first, ...rest];

  return (
    <AsciiShader
      {...props}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, ramp.at(-1) ?? first, ramp[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={ramp}
      stillTime={stillTime}
      uniforms={{
        plasmaBands: Math.max(0.1, bands),
        plasmaCrest: clamp(crest, 0, 1),
        plasmaIntensity: clamp(intensity, 0, 1),
        plasmaScale: Math.max(0.05, scale),
        plasmaWarp: Math.max(0, warp),
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{ backgroundImage: fallbackImage(ramp, intensity) }}
        />
      }
    />
  );
};
