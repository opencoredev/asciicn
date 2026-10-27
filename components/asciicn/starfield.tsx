"use client";

import { cssColor, resolveCharset } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface StarfieldProps extends AsciiSceneProps {
  /** The colour of the brightest stars. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The colour of faint stars and the haze. Default `"blue"`. */
  hazeColor?: AsciiColor;
  /** The sky behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once, paper first and the brightest stars last. Wins over `ink`, `hazeColor` and `paper`. */
  palette?: AsciiPalette;
  /** How many stars, 0 to 2. Default 1. */
  density?: number;
  /** How much each star pulses, 0 (steady) to 1. Default 0.6. */
  twinkle?: number;
  /** Direction the stars drift, in degrees as in CSS: 0 is up, 90 right. Default 270. */
  angle?: number;
  /** Drift speed of the nearest layer, in sample rows per second. 0 holds them still. Default 1.6. */
  drift?: number;
  /** Strength of a faint haze of glyphs behind the stars, 0 to 1. Default 0.5. */
  haze?: number;
  /** How much star colours vary from cool blue to warm, in `truecolor` mode, 0 to 1. Default 0.6. */
  temperature?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

/**
 * Three layers of stars on grids of samples. The field pass draws one
 * fragment per sample, so `gl_FragCoord` is the exact sample index: a star
 * is one sample wide whatever the font's cell aspect, one glyph in a ramp
 * charset and one dot in Braille. Each grid square holds at most one star,
 * so stars never clump. `starLayer` returns the brightness in x and the
 * star's own random value in y, which picks its colour.
 */
const FIELD = `
vec2 starLayer(vec2 cell, float grid, vec2 offset, float density, float peak, float t, float seed) {
  vec2 q = cell + offset;
  vec2 id = floor(q / grid);
  vec2 local = floor(q - id * grid);
  if (hash21(id + seed) > density) {
    return vec2(0.0);
  }
  vec2 at = floor(vec2(hash21(id + seed + 7.1), hash21(id + seed + 13.7)) * max(grid - 2.0, 1.0)) + 1.0;
  vec2 d = abs(local - at);
  float rate = 0.5 + 1.7 * hash21(id + seed + 5.3);
  float pulse = 0.5 + 0.5 * sin(t * rate + hash21(id + seed + 2.9) * 40.0);
  float b = peak * (0.5 + 0.5 * hash21(id + seed + 3.3));
  b *= mix(1.0, pulse, starTwinkle);
  float core = step(d.x + d.y, 0.5);
  // The brightest stars get a small cross of dimmer glyphs around them.
  float arms = step(d.x + d.y, 1.5) * step(0.8, b) * b * 0.5;
  return vec2(max(core * b, arms), hash21(id + seed + 21.4));
}

vec2 starSky(vec2 uv, vec2 res, float t) {
  vec2 cell = floor(gl_FragCoord.xy);
  float a = radians(starAngle);
  vec2 dir = vec2(sin(a), cos(a));
  vec2 travel = -dir * t * starDrift;

  // Grids are a few glyphs wide; starGrid widens them where a glyph holds
  // several samples (Braille, quadrants).
  vec2 stars = starLayer(cell, 4.0 * starGrid, travel * 0.3, 0.3 * starDensity, 0.5, t, 0.0);
  vec2 mid = starLayer(cell, 7.0 * starGrid, travel * 0.6, 0.4 * starDensity, 0.8, t, 41.0);
  vec2 near = starLayer(cell, 12.0 * starGrid, travel, 0.5 * starDensity, 1.0, t, 83.0);
  if (mid.x > stars.x) stars = mid;
  if (near.x > stars.x) stars = near;
  // Faint stars still land on the first visible glyph, never below it.
  stars.x = stars.x > 0.1 ? max(stars.x, 0.3) : 0.0;

  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y) + travel * 0.15 / res.y;
  float haze = smoothstep(0.55, 0.95, fbm(p * 1.4 + vec2(2.3, 7.1))) * 0.24 * starHaze;
  return stars.x > haze ? stars : vec2(haze, -1.0);
}

float field(vec2 uv, vec2 res, float t) {
  return starSky(uv, res, t).x;
}
`;

// Stars run from cool to warm around the palette's ink by their own random
// value; the haze takes the palette's first ink colour.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 s = starSky(uv, res, t);
  if (s.y < 0.0) {
    return paletteColor(0.0).rgb;
  }
  vec3 base = paletteColor(0.35 + 0.65 * s.x).rgb;
  vec3 cool = base * vec3(0.78, 0.9, 1.15);
  vec3 warm = base * vec3(1.15, 0.92, 0.72);
  vec3 tint = s.y < 0.5 ? mix(cool, base, s.y * 2.0) : mix(base, warm, s.y * 2.0 - 1.0);
  return clamp(mix(base, tint, starTemperature), 0.0, 1.0);
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

/** Tiled CSS dots in the star colours, shown without WebGL. */
const StarfieldFallback = ({ palette }: { palette: AsciiPalette }) => {
  const star = cssColor(palette.at(-1) ?? palette[1]);
  const dim = cssColor(palette[1]);
  const dots = [
    [star, 17, 23],
    [dim, 61, 47],
    [star, 103, 89],
    [dim, 139, 11],
    [dim, 31, 131],
    [star, 157, 149],
  ] as const;
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(palette[0]),
        backgroundImage: dots
          .map(
            ([color, x, y]) =>
              `radial-gradient(circle at ${x}px ${y}px, ${color} 1px, transparent 1.5px)`
          )
          .join(", "),
        backgroundSize: "173px 167px",
      }}
    />
  );
};

/**
 * A night sky of glyph stars in three parallax layers that twinkle and
 * drift slowly, each star with its own colour temperature. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Starfield = ({
  ink = "--ascii-ink",
  hazeColor = "blue",
  paper = "--ascii-paper",
  palette,
  density = 1,
  twinkle = 0.6,
  angle = 270,
  drift = 1.6,
  haze = 0.5,
  temperature = 0.6,
  charset = "dots",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  stillTime = 6,
  ...props
}: StarfieldProps) => {
  const [columnsPerGlyph, rowsPerGlyph] = resolveCharset(
    charset,
    props.chars
  ).grid;
  const colors = palette ?? [
    paper,
    mix(hazeColor, 55, paper),
    mix(ink, 70, hazeColor),
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
        starAngle: angle,
        starDensity: clamp(density, 0, 2),
        starDrift: drift,
        starGrid: Math.sqrt(columnsPerGlyph * rowsPerGlyph),
        starHaze: clamp(haze, 0, 1),
        starTemperature: clamp(temperature, 0, 1),
        starTwinkle: clamp(twinkle, 0, 1),
      }}
      fallback={<StarfieldFallback palette={colors} />}
    />
  );
};
