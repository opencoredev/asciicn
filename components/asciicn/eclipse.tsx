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

/** A point in the box: x from the left, y from the top, both 0 to 1. */
export type EclipsePoint = readonly [number, number];

export interface EclipseProps extends AsciiSceneProps {
  /** The corona. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The thin rim, in `truecolor` and `palette` modes. Default: `ink` mixed halfway to the text colour, so it runs hotter. */
  rimColor?: AsciiColor;
  /** The sky and the disc. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once: sky, corona, then rim. Wins over `ink`, `rimColor` and `paper`. */
  palette?: AsciiPalette;
  /** Centre of the disc. Default `[0.5, 0.5]`. */
  center?: EclipsePoint;
  /** Radius of the disc as a share of the box height. Default 0.24. */
  size?: number;
  /** How far the corona reaches past the rim, 0 to 1. Default 0.55. */
  corona?: number;
  /** Streamers in the corona, 0 (a smooth halo) to 1. Default 0.6. */
  streamers?: number;
  /** Where the rim is brightest, in degrees as in CSS: 0 is the top. Default 315. */
  light?: number;
  /** How much the glow breathes, 0 (steady) to 1. Default 0.5. */
  pulse?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// eclipseGlow returns the tone and how close the sample is to the rim
// (1 on it, 0 far out), which the colour field turns into hot and cool.
const FIELD = `
vec2 eclipseGlow(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 c = vec2(eclipseCenter.x * aspect, 1.0 - eclipseCenter.y);
  vec2 d = p - c;
  float r = length(d);
  float e = r - eclipseSize;
  if (e < 0.0) {
    return vec2(0.0);
  }

  // Direction around the disc as a point on the unit circle, so the noise wraps.
  vec2 around = d / max(r, 0.0001);
  float a = atan(d.x, d.y);
  float facing = 0.5 + 0.5 * cos(a - radians(eclipseLight));

  float breathe = 1.0 + eclipsePulse * 0.12 * sin(t * 0.6);
  float reach = eclipseSize * (0.12 + 0.55 * eclipseCorona) * breathe;

  // Streamers: noise around the rim, stretched outwards, so the corona
  // breaks into spokes that glyph ramps draw as separate strokes.
  float streak = fbm(around * 2.2 + vec2(t * 0.02, -t * 0.015));
  float spokes = smoothstep(0.35, 0.75, fbm(around * 7.0 + vec2(e * 2.0 - t * 0.03, t * 0.01)));
  float rays = mix(1.0, 0.35 + 1.1 * spokes, eclipseStreamers);
  float halo = exp(-e / reach) * (1.0 - smoothstep(reach, reach * 3.2, e)) * (0.65 + 0.6 * streak) * rays;
  // A rim at least a sample row thick, brightest on the lit side.
  float width = max(eclipseSize * 0.035, 1.2 / res.y);
  float rim = exp(-e / width);
  float glow = halo * (0.35 + 0.6 * facing) + rim * (0.4 + pow(facing, 1.5));
  return vec2(clamp(glow * breathe, 0.0, 1.0), rim);
}

float field(vec2 uv, vec2 res, float t) {
  return eclipseGlow(uv, res, t).x;
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  return paletteColor(smoothstep(0.05, 0.6, eclipseGlow(uv, res, t).y)).rgb;
}
`;

const CENTRE: EclipsePoint = [0.5, 0.5];

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

/** A CSS disc inside a soft ring, shown without WebGL. */
const fallbackImage = ({
  center,
  size,
  palette,
}: {
  center: EclipsePoint;
  size: number;
  palette: AsciiPalette;
}) => {
  const rim = cssColor(palette.at(-1) ?? palette[1]);
  const sky = cssColor(palette[0]);
  const at = `${percent(center[0])} ${percent(center[1])}`;
  const radius = `${(size * 100).toFixed(1)}cqh`;
  return `radial-gradient(circle at ${at}, ${sky} ${radius}, ${rim} calc(${radius} + 1px), color-mix(in oklab, ${rim} 25%, transparent) calc(${radius} * 1.15), transparent calc(${radius} * 1.6)), linear-gradient(${sky}, ${sky})`;
};

/**
 * An eclipse drawn in glyphs: a dark disc with a hot rim and a corona of
 * streamers that breathes slowly. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const Eclipse = ({
  ink = "--ascii-ink",
  rimColor,
  paper = "--ascii-paper",
  palette,
  center = CENTRE,
  size = 0.24,
  corona = 0.55,
  streamers = 0.6,
  light = 315,
  pulse = 0.5,
  charset = "standard",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 5,
  style,
  ...props
}: EclipseProps) => {
  const colors = palette ?? [
    paper,
    ink,
    rimColor ?? `color-mix(in oklch, ${cssColor(ink)} 50%, var(--foreground))`,
  ];

  return (
    <AsciiShader
      {...props}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, colors[1], colors[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={colors}
      stillTime={stillTime}
      style={{ containerType: "size", ...style }}
      uniforms={{
        eclipseCenter: center,
        eclipseCorona: clamp(corona, 0, 1),
        eclipseLight: light,
        eclipsePulse: clamp(pulse, 0, 1),
        eclipseSize: Math.max(0.01, size),
        eclipseStreamers: clamp(streamers, 0, 1),
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: fallbackImage({ center, palette: colors, size }),
          }}
        />
      }
    />
  );
};
