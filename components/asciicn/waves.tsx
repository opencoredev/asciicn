"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

interface OceanWaves {
  /** Rows of swells rolling towards the viewer below a glowing horizon. */
  variant?: "ocean";
  /** Height of the horizon, 0 (bottom) to 1 (top). Default 0.62. */
  horizon?: number;
}

interface LineWaves {
  /** Thin lines that swell in the middle and taper at the ends, like a sound wave. */
  variant: "lines";
  horizon?: never;
}

export type WavesVariant = OceanWaves | LineWaves;

export type WavesProps = AsciiSceneProps &
  WavesVariant & {
    /** The colour of the nearest crests. Default `"--ascii-ink"`. */
    ink?: AsciiColor;
    /** The colour of the far swells and the horizon glow. Default `"blue"`. */
    farColor?: AsciiColor;
    /** The surface behind the glyphs. Default `"--ascii-paper"`. */
    paper?: AsciiColor;
    /** Every colour at once, paper first and the nearest crests last. Wins over `ink`, `farColor` and `paper`. */
    palette?: AsciiPalette;
    /** How many waves, 2 to 8. Default 6. */
    layers?: number;
    /** Height of the waves. 1 is calm; 2 is rough. Default 1. */
    amplitude?: number;
    /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
    interaction?: Interaction;
  };

/**
 * `wavesSea` returns the tone in x and the distance of what is drawn in
 * y: 0 for the nearest wave (or line), 1 for the farthest and the sky.
 * Crests are one to two sample rows tall, so each reads as a line of the
 * densest glyphs over the dimmer body of its swell.
 */
const FIELD = `
float wavesHeight(float x, float fi, float k, float t) {
  float freq = mix(7.0, 2.2, k);
  float roll = sin(x * freq + t * (0.32 + 0.22 * k) + fi * 1.9);
  float chop = snoise(vec2(x * freq * 0.45 + fi * 5.0, t * 0.09 + fi));
  return roll * 0.62 + chop * 0.38;
}

vec2 wavesSea(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  float x = uv.x * aspect;
  float tone = 0.0;

  if (wavesMode < 0.5) {
    // Which swell covers this sample: -1 for the sky.
    float swell = -1.0;
    float above = uv.y - wavesHorizon;
    tone = above > 0.0 ? 0.42 * exp(-above * 11.0) : 0.0;
    float glint = exp(-pow((uv.x - 0.5) * 3.2, 2.0));
    for (int i = 0; i < 8; i++) {
      float fi = float(i);
      if (fi < wavesLayers) {
        float k = fi / max(wavesLayers - 1.0, 1.0);
        float base = wavesHorizon * pow(1.0 - fi / wavesLayers, 1.45);
        float amp = wavesAmplitude * mix(0.012, 0.085, k);
        float crest = base + amp * wavesHeight(x, fi, k, t);
        float depth = (crest - uv.y) * res.y;
        if (depth > 0.0) {
          float body = mix(0.24, 0.06, k) + 0.16 * glint * (1.0 - k);
          tone = body * (0.4 + 0.6 * exp(-depth * mix(0.5, 0.06, k)));
          if (depth < 1.6) {
            // Foam: the crest brightness wanders along its length, so a
            // crest is a run of different glyphs, not one repeated.
            float foam = 0.75 + 0.25 * snoise(vec2(x * 9.0 + fi * 3.0, t * 0.4));
            tone = mix(1.0, 0.62, k) * (0.8 + 0.2 * glint) * foam;
          }
          swell = k;
        }
      }
    }
    // k runs from the far swell (0, at the horizon) to the near one (1).
    return vec2(tone, swell < 0.0 ? 1.0 : 1.0 - swell);
  }

  float far = 1.0;

  float envelope = sin(3.14159265 * clamp(uv.x, 0.0, 1.0));
  envelope *= envelope;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi < wavesLayers) {
      float k = fi / max(wavesLayers - 1.0, 1.0);
      float y = 0.5 + envelope * wavesAmplitude * mix(0.3, 0.08, k) * wavesHeight(x * 0.8, fi, k, t * 1.4);
      float dist = abs(uv.y - y) * res.y;
      float line = 1.0 - smoothstep(0.4, 1.4, dist);
      float glow = exp(-dist * 0.2) * 0.2;
      float lit = max(line * mix(1.0, 0.5, k), glow * (1.0 - k * 0.6));
      if (lit > tone) {
        tone = lit;
        far = k;
      }
    }
  }
  return vec2(tone, far);
}

float field(vec2 uv, vec2 res, float t) {
  return wavesSea(uv, res, t).x;
}
`;

// Near crests take the last colour; far swells and the sky fade to the
// far colour.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 s = wavesSea(uv, res, t);
  return paletteColor(clamp((1.0 - s.y) * 0.7 + s.x * 0.35, 0.0, 1.0)).rgb;
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

/** A horizon and a few swell lines in CSS, shown without WebGL. */
const WavesFallback = ({
  lines,
  palette,
  horizon,
}: {
  lines: boolean;
  palette: AsciiPalette;
  horizon: number;
}) => {
  const ink = cssColor(palette.at(-2) ?? palette[1]);
  const at = `${((1 - horizon) * 100).toFixed(1)}%`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: lines
          ? `linear-gradient(to bottom, transparent 46%, color-mix(in oklch, ${ink} 50%, transparent) 50%, transparent 54%)`
          : `linear-gradient(to bottom, transparent 30%, color-mix(in oklch, ${ink} 35%, transparent) ${at}, color-mix(in oklch, ${ink} 18%, transparent) calc(${at} + 1px), transparent)`,
      }}
    />
  );
};

/**
 * Layered waves drawn in glyphs: rows of swells under a glowing horizon,
 * or thin lines like a sound wave. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const Waves = (props: WavesProps) => {
  const {
    ink = "--ascii-ink",
    farColor = "blue",
    paper = "--ascii-paper",
    palette,
    layers = 6,
    amplitude = 1,
    charset = props.variant === "lines" ? "braille" : "standard",
    colorMode = "truecolor",
    cell = 12,
    interaction = "none",
    interactive = true,
    stillTime = 4,
    variant: _variant,
    horizon: _horizon,
    ...rest
  } = props;
  const lines = props.variant === "lines";
  const horizon = props.variant === "lines" ? 0.5 : (props.horizon ?? 0.62);
  const colors = palette ?? [
    paper,
    mix(farColor, 65, paper),
    mix(ink, 55, farColor),
    ink,
  ];

  return (
    <AsciiShader
      {...rest}
      cell={cell}
      charset={charset}
      colorMode={colorMode}
      {...glass(rest.phosphor, colors.at(-1) ?? ink, colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      uniforms={{
        wavesAmplitude: Math.max(0, amplitude),
        wavesHorizon: horizon,
        wavesLayers: clamp(Math.round(layers), 2, 8),
        wavesMode: lines ? 1 : 0,
      }}
      fallback={
        <WavesFallback lines={lines} palette={colors} horizon={horizon} />
      }
    />
  );
};
