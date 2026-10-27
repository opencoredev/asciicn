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

export interface HorizonProps extends AsciiSceneProps {
  /** The lit rim, the glow just above it and the stars. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The high glow where it fades into space, in `truecolor` and `palette` modes. Default `"blue"`. */
  hazeColor?: AsciiColor;
  /** The sky and the planet. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once: sky, haze, then rim. Wins over `ink`, `hazeColor` and `paper`. */
  palette?: AsciiPalette;
  /** Height of the horizon's highest point from the bottom, 0 to 1. Default 0.28. */
  horizon?: number;
  /** How round the planet is, 0 (nearly flat) to 1 (a small globe). Default 0.6. */
  curve?: number;
  /** Strength of the glow above the horizon, 0 to 1. Default 1. */
  glow?: number;
  /** How much the glow ripples into aurora curtains, 0 (a smooth band) to 1. Default 1. */
  aurora?: number;
  /** How many stars in the sky, 0 to 3. Default 1. */
  stars?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// horizonLight returns the tone and the height above the horizon, which
// the colour field uses to cool the glow as it rises.
const FIELD = `
float horizonNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float horizonFbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 3; i++) {
    sum += amp * horizonNoise(p);
    p = p * 2.03 + vec2(17.1, 9.2);
    amp *= 0.5;
  }
  return sum / 0.875;
}

vec2 horizonLight(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 world = vec2(uv.x * aspect, uv.y);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);

  // The planet is a circle in square space whose top touches the horizon.
  float radius = 0.6 * pow(8.0, 1.0 - horizonCurve);
  vec2 centre = vec2(0.0, horizonHeight - radius);
  // Signed distance from the horizon, in box heights.
  float e = length(p - centre) - radius;
  float above = max(e, 0.0);
  float below = max(-e, 0.0);

  // Domain-warped noise, drifting slowly sideways along the horizon.
  vec2 warp = vec2(
    horizonFbm(world * 1.3 + vec2(t * 0.021, 0.0)),
    horizonFbm(world * 1.3 + vec2(5.2, 1.3) - vec2(0.0, t * 0.017))
  );
  float n = horizonFbm(world * vec2(1.1, 2.6) + 1.7 * warp + vec2(t * 0.013, 0.0));

  // Aurora curtains: noise stretched vertically, sliding along the horizon.
  float curtains = horizonFbm(vec2(world.x * 5.0 + 2.0 * warp.x - t * 0.03, above * 6.0 - t * 0.01));
  curtains = mix(0.7, curtains, horizonAurora);
  float lit = 0.3 + 0.95 * n * curtains + 0.25 * n;
  float glow = 1.2 * exp(-above * 10.0) * lit + 0.3 * exp(-above * 4.5) * curtains * curtains;
  glow *= horizonGlow;
  // A lit rim at least a sample row thick, then the dark planet.
  float rimWidth = max(1.0 / 60.0, 1.4 / res.y);
  float rim = exp(-below / rimWidth) * (0.9 + 0.3 * n) * mix(0.6, 1.0, horizonGlow);
  // Faint glow drops to clean paper, so ramp charsets keep a dark sky.
  float tone = smoothstep(0.08, 1.0, e > 0.0 ? glow * 1.2 : rim);

  // Fixed stars, one per sample (one glyph, or one Braille dot), thinning
  // out towards the glow so the horizon stays clean.
  vec2 at = floor(gl_FragCoord.xy);
  float seed = hash21(vec2(hash21(at), hash21(at.yx + 31.7)) * 97.0);
  float star = step(1.0 - 0.004 * horizonStars, seed) * smoothstep(0.08, 0.3, above);
  star *= 0.7 + 0.3 * sin(t * 1.3 + seed * 400.0);
  return vec2(max(tone, star), e);
}

float field(vec2 uv, vec2 res, float t) {
  return horizonLight(uv, res, t).x;
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float e = horizonLight(uv, res, t).y;
  return paletteColor(1.0 - smoothstep(0.0, 0.3, e)).rgb;
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

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

/** A soft CSS glow over a dark arc, shown without WebGL. */
const fallbackImage = ({
  palette,
  horizon,
}: {
  palette: AsciiPalette;
  horizon: number;
}) => {
  const glow = cssColor(palette.at(-1) ?? palette[1]);
  const sky = cssColor(palette[0]);
  const top = percent(1 - horizon);
  return [
    `radial-gradient(ellipse 90% 60% at 50% calc(${top} + 60%), ${sky} 99%, transparent 100%)`,
    `radial-gradient(ellipse 80% 30% at 50% ${top}, color-mix(in oklab, ${glow} 55%, transparent), transparent 70%)`,
    `linear-gradient(${sky}, ${sky})`,
  ].join(", ");
};

/**
 * A planet's horizon seen from space, drawn in glyphs: a lit rim, an
 * aurora glow that drifts along it, and a scatter of stars. Decorative
 * and full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Horizon = ({
  ink = "--ascii-ink",
  hazeColor = "blue",
  paper = "--ascii-paper",
  palette,
  horizon = 0.28,
  curve = 0.6,
  glow = 1,
  aurora = 1,
  stars = 1,
  charset = "standard",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 14,
  ...props
}: HorizonProps) => {
  const colors = palette ?? [paper, hazeColor, ink];

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
        horizonAurora: clamp(aurora, 0, 1),
        horizonCurve: clamp(curve, 0, 1),
        horizonGlow: clamp(glow, 0, 1),
        horizonHeight: clamp(horizon, 0, 0.95),
        horizonStars: clamp(stars, 0, 3),
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: fallbackImage({ horizon, palette: colors }),
          }}
        />
      }
    />
  );
};
