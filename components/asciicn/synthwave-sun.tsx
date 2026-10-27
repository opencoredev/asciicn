"use client";

import type { ReactNode } from "react";

import { resolveCharset, useAsciiColors } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// An outrun horizon in box-height units: y runs from -0.5 at the bottom to
// 0.5 at the top, x is centred and scaled by the true aspect, so the sun
// stays round in any box. Everything that should read as a crisp line is
// decided per sample rather than smoothed: a grid line lights the samples
// it passes through, the horizon is exactly one sample row, and the sun's
// slices are whole sample rows. Glyphs then land on whole cells instead of
// blurring between two densities. Each layer returns its own colour and
// tone; `swScene` is cached per sample because field and colorField both
// ask for it.
const SCENE = `
const float SW_HORIZON = -0.07;
// Floor grid spacing across, in world units; rows are 1 apart and the
// camera sits 1 above the floor, one box height from the screen.
const float SW_SPACING = 0.55;

float swRidge(float x) {
  float n = 1.0 - abs(snoise(vec2(x * 2.1, 3.7)));
  float m = 1.0 - abs(snoise(vec2(x * 5.3 + 11.0, 1.3)));
  return n * n * 0.75 + m * m * 0.25;
}

// How many multiples of 'step' lie in (lo, hi]: the grid lines that pass
// through one sample's footprint.
float swCrossings(float lo, float hi, float step) {
  return floor(hi / step) - floor(lo / step);
}

vec3 swDeepen(vec3 col) {
  // On light paper, bright amber vanishes: darken and saturate.
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  vec3 rich = mix(vec3(l), col, 1.35) * 0.62;
  return mix(col, clamp(rich, 0.0, 1.0), swOnLight);
}

vec4 swSky(vec2 p, vec2 px, float vx, float t, float rowsPerUnit) {
  float h = p.y - SW_HORIZON;
  vec3 col = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.22, 0.55), smoothstep(0.0, 0.12, h));
  col = mix(col, vec3(0.45, 0.12, 0.7), smoothstep(0.1, 0.32, h));
  col = mix(col, vec3(0.16, 0.08, 0.42), smoothstep(0.3, 0.55, h));
  // The glow: dense glyphs on the horizon, thinning as it climbs.
  float tone = swGlow * 0.55 * exp(-h * 26.0);

  // Stars: single samples, so each is one crisp glyph or dot.
  vec2 id = floor(p / px);
  float star = hash21(id + 7.0);
  if (swStars > 0.5 && star > 0.993) {
    float twinkle = 0.6 + 0.4 * sin(t * (1.0 + star * 5.0) + star * 90.0);
    float s = twinkle * smoothstep(0.12, 0.32, h);
    if (s > tone) {
      col = mix(vec3(1.0, 0.85, 0.95), vec3(0.75, 0.8, 1.0), hash21(id + 3.1));
      tone = s;
    }
  }

  // The sun, setting into the horizon with a quarter of it below.
  float radius = min(0.25, 0.34 * u_resolution.x / u_resolution.y);
  vec2 c = vec2(vx, SW_HORIZON + radius * 0.52);
  vec2 s = p - c;
  float d = length(s);
  float v = s.y / radius;
  if (d < radius) {
    // Slices cut the lower part, widening as they fall and sliding down.
    // Measured in whole sample rows, so every gap is crisp.
    float rows = radius * rowsPerUnit;
    float below = (radius * 0.32 - s.y) * rowsPerUnit;
    float period = max(3.0, floor(rows * 0.17 + 0.5));
    float fall = clamp(below / (rows * 1.3), 0.0, 1.0);
    float local = mod(floor(below) + floor(t * swRate * 6.0), period);
    float gap = floor(mix(1.0, period * 0.72, fall) + 0.5) * swSlices;
    if (below > 0.0 && local < gap) {
      return vec4(col, tone);
    }
    vec3 sun = mix(vec3(1.0, 0.16, 0.52), vec3(1.0, 0.62, 0.2), smoothstep(-0.75, 0.35, v));
    sun = mix(sun, vec3(1.0, 0.88, 0.45), smoothstep(0.45, 1.0, v));
    // Full tone: any less and an ordered matrix pocks the disc with holes.
    return vec4(sun, 1.0);
  }
  // A halo round the disc, lighter glyphs that fade into the sky.
  float halo = 0.24 * exp(-(d - radius) * 40.0) * swGlow;
  if (halo > tone) {
    col = mix(col, vec3(1.0, 0.36, 0.55), 0.6);
    tone = halo;
  }
  return vec4(col, tone);
}

// The ridge's top edge, low in the middle so the sun sets in a valley.
float swRidgeTop(float x, float vx) {
  float side = smoothstep(0.06, 0.6, abs(x - vx));
  return SW_HORIZON + swMountainHeight * side * (0.03 + 0.2 * swRidge(x * 0.9 + 4.0));
}

vec4 swMountains(vec2 p, vec2 px, float top) {
  // The crest is one sample row: a wireframe line against the glow.
  if (top - p.y < px.y) {
    return vec4(1.0, 0.34, 0.8, swLine);
  }
  // Faint strata inside, every fourth row, then empty rock.
  float inside = (top - p.y) / px.y;
  float ring = mod(floor(inside), 4.0) == 2.0 ? 0.34 : 0.0;
  return vec4(0.42, 0.1, 0.55, ring * smoothstep(0.0, 0.03, top - SW_HORIZON));
}

vec4 swFloor(vec2 p, vec2 px, float vx, float t) {
  float d = SW_HORIZON - p.y;
  // The horizon row itself: one bright, crisp line.
  if (d < px.y) {
    return vec4(1.0, 0.78, 0.45, 1.0);
  }
  float near = d + px.y * 0.5;
  float far = max(d - px.y * 0.5, 1e-4);
  float travel = t * swTravel * 1.6;
  // Rows across the floor: depth z = 1 / d. A row lights the samples whose
  // depth span holds it; once rows are closer than one sample they merge.
  float zNear = 1.0 / near;
  float zFar = 1.0 / far;
  float rows = swCrossings(zNear + travel, zFar + travel, 1.0);
  float rowDensity = zFar - zNear;
  // Columns converge on the vanishing point: world x = screen x * z.
  float x = p.x - vx;
  float xs = 1.0 / d;
  float columns = swCrossings((x - px.x * 0.5) * xs, (x + px.x * 0.5) * xs, SW_SPACING);
  float columnDensity = px.x * xs / SW_SPACING;

  float z = 1.0 / d;
  float fog = smoothstep(2.5, 26.0, z);
  float line = max(min(rows, 1.0), min(columns, 1.0));
  // Far rows and columns crowd into haze rather than shimmering.
  float merged = smoothstep(0.45, 1.0, max(rowDensity, columnDensity));
  float tone = mix(line * swLine * (1.0 - 0.4 * fog), 0.12, merged);

  vec3 ink = mix(vec3(1.0, 0.18, 0.72), vec3(1.0, 0.5, 0.32), fog);
  // Haze above the floor near the horizon, the colour of the glow.
  float haze = swGlow * 0.32 * exp(-d * 110.0);
  // The sun's reflection on the wet floor: broken rows under the sun.
  float radius = min(0.25, 0.34 * u_resolution.x / u_resolution.y);
  float under = exp(-pow(x / (radius * 0.75), 2.0)) * exp(-d * 5.0);
  float streak = mod(floor(p.y / px.y), 2.0) * swGlow * 0.4 * under;
  float glow = max(haze, streak);
  if (glow > tone) {
    return vec4(mix(vec3(1.0, 0.62, 0.25), vec3(1.0, 0.3, 0.6), smoothstep(0.0, 0.2, d)), glow);
  }
  return vec4(ink, tone);
}

vec2 swCacheUv = vec2(-1.0);
float swCacheT = -1.0;
vec4 swCacheValue = vec4(0.0);

vec4 swScene(vec2 uv, vec2 res, float t) {
  if (uv == swCacheUv && t == swCacheT) {
    return swCacheValue;
  }
  float aspect = res.x / res.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  // One sample in box units. Rows come from the contract; columns from
  // the sample grid, since glyph cells are narrower than they are tall.
  vec2 px = vec2(aspect / ascii_samples.x, 1.0 / res.y);
  // Steering: the vanishing point, and the sun with it, follow the pointer.
  float steer = (u_pointer.x - 0.5) * u_pointer.z * swParallax;
  float vx = steer * 0.18 + sin(t * 0.17) * 0.015;
  vec4 col;
  if (p.y >= SW_HORIZON) {
    float top = swRidgeTop(p.x, vx);
    col = p.y <= top ? swMountains(p, px, top) : swSky(p, px, vx, t, res.y);
  } else {
    col = swFloor(p, px, vx, t);
  }
  col.rgb = swDeepen(col.rgb);
  swCacheUv = uv;
  swCacheT = t;
  swCacheValue = col;
  return col;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return swScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return swScene(uv, res, t).rgb;
}
`;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(circle at 50% 36%, #ffb347 0 9%, #ff3d8b 15%, transparent 16%), linear-gradient(to bottom, transparent 0%, #3a0f5c 40%, #ff3d8b 57%, transparent 57.4%, transparent 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** True when the paper is light, so the shader deepens its colours. */
const usePaperIsLight = (
  paper: AsciiColor,
  phosphor: PhosphorName | undefined
) => {
  const colors = useAsciiColors(undefined, [paper]);
  const rgba = colors?.[0];
  if (phosphor !== undefined || rgba === undefined) {
    return false;
  }
  return 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2] > 0.55;
};

export interface SynthwaveSunProps extends AsciiSceneProps {
  /** How fast the grid races toward you. 0 parks it. Default 1. */
  travel?: number;
  /** How wide the gaps cut across the sun grow, from 0 (a solid disc) to 1. Default 1. */
  slices?: number;
  /** How fast the slices slide down the sun. Default 1. */
  slide?: number;
  /** The glow over the horizon, the halo and the sun's reflection, from 0 to 1. Default 1. */
  glow?: number;
  /** Height of the ridge on both sides, from 0 (flat) to 2. Default 1. */
  mountains?: number;
  /** Twinkling stars in the upper sky. Default `true`. */
  stars?: boolean;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** What the pointer does to the glyphs, on top of the steering. Default `"none"`. */
  interaction?: Interaction;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Synthwave sun. A neon grid races toward a horizon under a setting sun
 * cut by sliding slices, between a wireframe ridge, with stars above and
 * the sun's reflection broken across the floor. Grid lines, the horizon
 * and the slices are decided per sample, so they draw as crisp rows of
 * glyphs. The pointer steers the vanishing point.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const SynthwaveSun = ({
  travel = 1,
  slices = 1,
  slide = 1,
  glow = 1,
  mountains = 1,
  stars = true,
  paper = "--ascii-paper",
  charset = "braille",
  chars,
  colorMode,
  phosphor,
  dither,
  cell = 12,
  fps = 60,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  fallback = FALLBACK,
  ...props
}: SynthwaveSunProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  // Dots light only above half tone; an ordered matrix keeps the glow and
  // the halo as a dot gradient instead of dropping them.
  const { kind } = resolveCharset(charset, chars);
  const packed = kind === "braille" || kind === "quadrants";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        swGlow: clamp(glow, 0, 1),
        // Dots need full tone to stay unbroken; a ramp draws lines a step
        // lighter than its densest glyph, which reads as a wire, not a wall.
        swLine: packed ? 1 : 0.7,
        swMountainHeight: clamp(mountains, 0, 2),
        swOnLight: onLight ? 1 : 0,
        swParallax: interactive ? 1 : 0,
        swRate: slide,
        swSlices: clamp(slices, 0, 1),
        swStars: stars ? 1 : 0,
        swTravel: travel,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={dither ?? (packed ? "bayer4" : "none")}
      paper={phosphor === undefined ? paper : undefined}
      cell={cell}
      fps={fps}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
