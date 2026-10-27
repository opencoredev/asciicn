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

/** A point relative to the box: x from the left, y from the top. May lie outside 0 to 1. */
export type BeamsOrigin = readonly [number, number];

export interface BeamsProps extends AsciiSceneProps {
  /** The light near its source. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The light where it fades out, in `truecolor` and `palette` modes. Default: `ink`. */
  farColor?: AsciiColor;
  /** The dark behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the source colour last. Wins over `ink`, `farColor` and `paper`. */
  palette?: AsciiPalette;
  /**
   * Where the light comes from, as fractions of the box from the top left.
   * Put it outside the box for a light just out of frame, or far away for
   * near-parallel rays from an edge. Default `[0.18, -0.12]`.
   */
  origin?: BeamsOrigin;
  /** Direction the light points, in degrees as in CSS: 180 is down. Default 160. */
  angle?: number;
  /** Width of the cone of light in degrees. Default 80. */
  spread?: number;
  /** How many separate rays, roughly. Default 9. */
  rays?: number;
  /** How far the rays sweep back and forth, in degrees. 0 holds them still. Default 6. */
  sweep?: number;
  /** How far the light reaches from where it enters the box, as a share of the box diagonal. Default 1. */
  reach?: number;
  /** Dust drifting through the light, 0 (clean shafts) to 1. Default 0.4. */
  dust?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// beamsLight returns the tone and how far the light has travelled as a
// share of its reach, which the colour field turns into a gradient.
const FIELD = `
vec2 beamsLight(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 o = vec2(beamOrigin.x * aspect, 1.0 - beamOrigin.y);
  vec2 d = p - o;
  float dist = length(d);
  // Light fades from where it enters the box, so a far origin still lights the near edge.
  vec2 box = vec2(aspect, 1.0) * 0.5;
  float entry = length(max(abs(o - box) - box, 0.0));
  float travelled = max(dist - entry, 0.0);

  // Angle from the cone's axis, in radians. CSS angles: 0 is up, clockwise.
  float sway = radians(beamSweep) * sin(t * 0.11);
  float axis = radians(beamAngle) + sway;
  float a = atan(d.x, d.y) - axis;
  a = mod(a + 3.14159265, 6.28318531) - 3.14159265;

  float halfWidth = radians(beamSpread) * 0.5;
  float cone = sqrt(smoothstep(halfWidth, 0.0, abs(a)));

  // Rays: noise around the origin, two octaves, sliding slowly sideways.
  // The smoothstep gives each shaft a firm edge, so glyph ramps show
  // separate rays instead of a grey wash.
  float k = beamRays / max(halfWidth, 0.02);
  float r1 = 0.5 + 0.5 * snoise(vec2(a * k * 0.5, t * 0.05));
  float r2 = 0.5 + 0.5 * snoise(vec2(a * k * 1.4 + 7.0, t * 0.08 + 3.0));
  float rays = 0.06 + 1.15 * smoothstep(0.3, 0.85, r1) + 0.3 * pow(r2, 3.0);
  float dust = 1.0 - beamDust * 0.45 * smoothstep(0.35, 0.8, fbm(vec2(a * k * 0.3, travelled * 3.0 - t * 0.06)));

  float reach = length(vec2(aspect, 1.0)) * beamReach;
  float fall = exp(-travelled / reach * 2.4);
  float core = exp(-travelled * 8.0) * 0.4;
  float tone = clamp(cone * (rays * dust * fall * 1.3 + core), 0.0, 1.0);
  return vec2(tone, clamp(travelled / reach, 0.0, 1.0));
}

float field(vec2 uv, vec2 res, float t) {
  return beamsLight(uv, res, t).x;
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  return paletteColor(1.0 - beamsLight(uv, res, t).y).rgb;
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

/** A soft CSS cone of light, shown without WebGL. */
const fallbackImage = ({
  palette,
  origin,
  angle,
  spread,
}: {
  palette: AsciiPalette;
  origin: BeamsOrigin;
  angle: number;
  spread: number;
}) => {
  const ink = cssColor(palette.at(-1) ?? palette[1]);
  const at = `${(origin[0] * 100).toFixed(1)}% ${(origin[1] * 100).toFixed(1)}%`;
  const from = angle - spread / 2;
  return `conic-gradient(from ${from}deg at ${at}, transparent, color-mix(in oklab, ${ink} 30%, transparent) ${spread / 2}deg, transparent ${spread}deg)`;
};

/**
 * Shafts of light drawn in glyphs, from a point or an edge, that sweep
 * slowly and fade with distance. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const Beams = ({
  ink = "--ascii-ink",
  farColor,
  paper = "--ascii-paper",
  palette,
  origin = [0.18, -0.12],
  angle = 160,
  spread = 80,
  rays = 9,
  sweep = 6,
  reach = 1,
  dust = 0.4,
  charset = "standard",
  colorMode = "palette",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 4,
  ...props
}: BeamsProps) => {
  const colors = palette ?? [paper, farColor ?? ink, ink];

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
        beamAngle: angle,
        beamDust: clamp(dust, 0, 1),
        beamOrigin: origin,
        beamRays: Math.max(1, rays),
        beamReach: Math.max(0.05, reach),
        beamSpread: clamp(spread, 1, 359),
        beamSweep: sweep,
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: cssColor(colors[0]),
            backgroundImage: fallbackImage({
              angle,
              origin,
              palette: colors,
              spread,
            }),
          }}
        />
      }
    />
  );
};
