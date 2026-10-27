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

export interface RetroGridProps extends AsciiSceneProps {
  /** The grid lines and the haze. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The top of the sun, in `truecolor` mode. Default `"orange"`. */
  sunColor?: AsciiColor;
  /** The bottom of the sun and its glow, in `truecolor` mode. Default `"pink"`. */
  sunsetColor?: AsciiColor;
  /** The sky and the floor. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Every colour at once: paper, grid, sunset, then sun. Wins over the colour props. */
  palette?: AsciiPalette;
  /** Height of the horizon, 0 (bottom) to 1 (top). Default 0.42. */
  horizon?: number;
  /** Size of the sun as a share of the box height. 0 hides it. Default 0.4. */
  sun?: number;
  /** How many grid squares across the front of the floor in a 16:10 box. Narrower boxes show fewer. Default 10. */
  columns?: number;
  /** Slits cut through the lower half of the sun, 0 to 8. Default 4. */
  slits?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

// Distances are in sample rows (`1.0 / res` is one row in both axes), so
// grid lines stay one sample thick whatever the charset: one row of Braille
// dots by default, or with `edge` glyphs that follow the perspective.
const FIELD = `
// A grid line at every whole value of v, about one sample wide whatever
// the perspective. Lines closer than a couple of samples fade out instead
// of turning into moire.
float retroLine(float v, float vx, float vy) {
  float offset = abs(fract(v + 0.5) - 0.5);
  float perSample = max(length(vec2(vx - v, vy - v)), 1e-4);
  float line = 1.0 - smoothstep(0.35, 1.1, offset / perSample);
  return line * (1.0 - smoothstep(0.2, 0.45, perSample));
}

vec2 retroFloor(vec2 uv, float aspect, float t) {
  float below = max(retroHorizon - uv.y, 1e-4) / max(retroHorizon, 1e-3);
  float depth = 1.0 / below;
  // Squares keep their size against the box height, so a narrow box shows
  // fewer columns rather than thinner ones. Front squares come out a little
  // foreshortened, as seen from a low camera.
  float across = (uv.x - 0.5) * aspect * depth * retroColumns / 1.6;
  float rows = 1.5 * retroHorizon * retroColumns / 1.6;
  return vec2(across, depth * rows + t * 0.35);
}

// The sun's centre and radius in box heights, x centred.
vec3 retroSunDisc(vec2 uv, float aspect) {
  float r = retroSun * 0.5;
  return vec3((uv.x - 0.5) * aspect, uv.y - (retroHorizon + r * 0.2), r);
}

float field(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 sampleStep = 1.0 / res;
  float tone = 0.0;

  if (uv.y < retroHorizon) {
    vec2 g = retroFloor(uv, aspect, t);
    vec2 gx = retroFloor(uv + vec2(sampleStep.x, 0.0), aspect, t);
    vec2 gy = retroFloor(uv + vec2(0.0, sampleStep.y), aspect, t);
    float lines = max(retroLine(g.x, gx.x, gy.x), retroLine(g.y, gx.y, gy.y));
    float near = (retroHorizon - uv.y) / max(retroHorizon, 1e-3);
    // Haze at the horizon, the sun's reflection, and lines that brighten towards you.
    float haze = exp(-near * 14.0) * 0.35;
    float glare = exp(-pow((uv.x - 0.5) * aspect * 2.6, 2.0)) * exp(-near * 5.0) * 0.2 * step(0.001, retroSun);
    tone = max(lines * mix(0.65, 1.0, smoothstep(0.0, 0.6, near)), haze + glare);
    tone = max(tone, (1.0 - smoothstep(0.0, 1.6, (retroHorizon - uv.y) * res.y)) * 0.95);
    return clamp(tone, 0.0, 1.0);
  }

  float above = uv.y - retroHorizon;
  tone = exp(-above * 28.0) * 0.25;
  if (retroSun > 0.001) {
    vec3 sun = retroSunDisc(uv, aspect);
    vec2 c = sun.xy;
    float r = sun.z;
    float dist = length(c);
    float disc = 1.0 - smoothstep(r - 1.2 / res.y, r, dist);
    // Bright at the top, deeper towards the horizon.
    float body = mix(0.6, 1.0, smoothstep(-r, r, c.y));
    // Slits through the lower half that thicken towards the horizon and
    // drift down. At least one sample row each, so they never vanish
    // between glyph rows.
    float k = clamp((r * 0.6 - c.y) / (r * 0.85), 0.0, 1.0);
    float band = fract(c.y / r * retroSlits * 0.5 + t * 0.08);
    float bandRows = r * res.y / max(retroSlits * 0.5, 0.5);
    float width = k > 0.0 && retroSlits > 0.5 ? max(k * 0.6, 1.0 / bandRows) : 0.0;
    float cut = band < width ? 1.0 : 0.0;
    float glow = exp(-max(dist - r, 0.0) * 9.0 / max(r * 2.0, 0.2)) * 0.4;
    tone = max(tone, max(disc * body * (1.0 - cut), glow * (1.0 - disc)));
  }
  return clamp(tone, 0.0, 1.0);
}
`;

// Grid and haze take the first ink; the sun runs from sunset at the bottom
// to sun at the top, and its glow takes the sunset colour.
const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  if (uv.y < retroHorizon || retroSun < 0.001) {
    return paletteColor(0.0).rgb;
  }
  vec3 sun = retroSunDisc(uv, res.x / res.y);
  float inside = 1.0 - smoothstep(sun.z, sun.z * 1.6, length(sun.xy));
  float height = smoothstep(-sun.z, sun.z, sun.y);
  return paletteColor(inside * (0.5 + 0.5 * height)).rgb;
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

/** A horizon, a sun and a flat grid in CSS, shown without WebGL. */
const fallbackImage = (palette: AsciiPalette, horizon: number, sun: number) => {
  const ink = cssColor(palette[1]);
  const glow = cssColor(palette.at(-1) ?? palette[1]);
  const line = `${((1 - horizon) * 100).toFixed(1)}%`;
  const layers = [
    `linear-gradient(to bottom, transparent calc(${line} - 1px), ${ink} calc(${line} - 1px) ${line}, transparent ${line})`,
    `linear-gradient(to bottom, transparent ${line}, color-mix(in oklab, ${ink} 18%, transparent) 100%)`,
  ];
  if (sun > 0) {
    layers.push(
      `radial-gradient(circle ${(sun * 50).toFixed(1)}cqh at 50% ${line}, color-mix(in oklab, ${glow} 70%, transparent) 70%, transparent 100%)`
    );
  }
  return layers.join(", ");
};

/**
 * A perspective grid floor drawn in glyphs, scrolling towards a horizon
 * under a slit sun, as on an eighties record sleeve. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const RetroGrid = ({
  ink = "--ascii-ink",
  sunColor = "orange",
  sunsetColor = "pink",
  paper = "--ascii-paper",
  palette,
  horizon = 0.42,
  sun = 0.4,
  columns = 10,
  slits = 4,
  charset = "braille",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 3,
  ...props
}: RetroGridProps) => {
  const colors = palette ?? [paper, ink, sunsetColor, sunColor];

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
      uniforms={{
        retroColumns: Math.max(2, columns),
        retroHorizon: clamp(horizon, 0.05, 0.95),
        retroSlits: clamp(Math.round(slits), 0, 8),
        retroSun: clamp(sun, 0, 1),
      }}
      fallback={
        <div
          className="absolute inset-0 [container-type:size]"
          style={{
            backgroundColor: cssColor(colors[0]),
            backgroundImage: fallbackImage(colors, horizon, sun),
          }}
        />
      }
    />
  );
};
