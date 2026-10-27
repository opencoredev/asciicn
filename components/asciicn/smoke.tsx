"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface SmokeProps extends AsciiSceneProps {
  /** The colour of the lit smoke. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The colour of the smoke in shadow, in `truecolor` and `palette` modes. Default `"grey"`. */
  shadowColor?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the lit edge last. Wins over `ink`, `shadowColor` and `paper`. */
  palette?: AsciiPalette;
  /** Size of the billows. Higher values make more, smaller ones. Default 1. */
  scale?: number;
  /** How high the smoke climbs before it thins out, 0 to 1. Default 0.8. */
  height?: number;
  /** Sideways wind. Negative blows left, positive right. Default 0.2. */
  wind?: number;
  /** How thick the smoke is, 0 to 1.5. Default 1. */
  density?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"trail"`: the pointer stirs a wake. */
  interaction?: Interaction;
}

/**
 * Rising, curling noise. `smokeBody` returns the tone in x and the light
 * in y: smoke that thins towards the upper left is lit, the far side of a
 * billow is in shadow.
 */
const FIELD = `
float smokeDensity(vec2 p, float t) {
  // Rising coordinates, stretched upright so the puffs climb in plumes.
  vec2 q = vec2(p.x, p.y * 0.82) - vec2(smokeWind * t * 0.04, t * 0.045);
  // A slow warp curls the plumes as they climb.
  vec2 warp = vec2(
    snoise(q * 0.45 + vec2(0.0, t * 0.012)),
    snoise(q * 0.45 + vec2(5.2, 1.3) - vec2(t * 0.01, 0.0))
  );
  vec2 w = q + warp * 0.6;
  return 0.5 + 0.36 * snoise(w * 0.8) + 0.14 * snoise(w * 1.9 + 3.0);
}

vec2 smokeBody(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y) * 2.2 * smokeScale;

  float d = smokeDensity(p, t);
  float lit = smokeDensity(p + vec2(-0.2, 0.3), t);
  float light = clamp(0.7 + (d - lit) * 1.8, 0.3, 1.0);

  // Thick at the bottom, thinning out towards smokeHeight.
  float rise = uv.y / max(smokeHeight, 0.05);
  float body = smoothstep(0.3, 0.85, d - rise * 0.5 + 0.25);
  // The top edge follows the plumes, so it never reads as a straight line.
  body *= 1.0 - smoothstep(0.6, 1.2, rise - (d - 0.5) * 0.9);
  // A lit rim where a billow's edge faces the light: the sparse glyphs at
  // the edge of the smoke get one step brighter, so its outline reads.
  float rim = smoothstep(0.08, 0.3, body) * (1.0 - smoothstep(0.3, 0.6, body)) * smoothstep(0.75, 1.0, light) * 0.25;
  return vec2(clamp((body * light + rim) * smokeAmount, 0.0, 1.0), light);
}

float field(vec2 uv, vec2 res, float t) {
  return smokeBody(uv, res, t).x;
}
`;

// Shadowed smoke takes the low end of the palette, lit smoke the high end.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 s = smokeBody(uv, res, t);
  return paletteColor(clamp((s.y - 0.3) / 0.7 * 0.75 + s.x * 0.3, 0.0, 1.0)).rgb;
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

/** A soft CSS haze rising from the bottom, shown without WebGL. */
const SmokeFallback = ({
  palette,
  height,
}: {
  palette: AsciiPalette;
  height: number;
}) => {
  const ink = cssColor(palette.at(-1) ?? palette[1]);
  const top = `${Math.round((1 - height) * 100)}%`;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: `linear-gradient(to top, color-mix(in oklab, ${ink} 40%, transparent), transparent calc(100% - ${top}))`,
      }}
    />
  );
};

/**
 * Smoke billowing upward and thinning out, lit from the upper left and
 * drawn in the classic ASCII ramp. The pointer stirs a wake through it.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Smoke = ({
  ink = "--ascii-ink",
  shadowColor = "grey",
  paper = "--ascii-paper",
  palette,
  scale = 1,
  height = 0.8,
  wind = 0.2,
  density = 1,
  charset = "standard",
  colorMode = "palette",
  cell = 12,
  interaction = "trail",
  interactive = true,
  stillTime = 12,
  ...props
}: SmokeProps) => {
  const colors = palette ?? [
    paper,
    mix(shadowColor, 55, paper),
    mix(ink, 55, shadowColor),
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
        smokeAmount: clamp(density, 0, 1.5),
        smokeHeight: clamp(height, 0, 1),
        smokeScale: Math.max(0.1, scale),
        smokeWind: wind,
      }}
      fallback={<SmokeFallback palette={colors} height={height} />}
    />
  );
};
