"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The canyon is painted near to far from four silhouettes: the near walls,
// a middle shelf, a few far buttes and the flat plateau on the horizon.
// The near and middle walls are terraced V shapes whose gaps follow the
// river, so the one winding band of water shows through each gap in turn
// and reads as a river running from the sunset towards you. Heights are in
// box heights and widths in the same units, so shapes keep their proportions;
// positions across are fractions of the half width, so tall boxes keep the
// whole composition, a little narrower. Only light moves: the glow on the
// far rims, the shimmer on the water, the stars and the clouds.
const SCENE = `
const float CANYON_HZ = 0.5;
const float CANYON_FLOOR_M = 0.27;
const float CANYON_FLOOR_F = 0.43;

// Set once per sample by canyonScene and read by every layer.
float canyonT;
float canyonW;
float canyonSun;
float canyonRow;
float canyonGapN;
float canyonGapM;
float canyonGapF;
float canyonHalfN;
float canyonHalfM;
float canyonHalfF;
float canyonRimN;
float canyonRimM;
float canyonWet;

// A stable random value per cell. hash21 repeats on integers, which tiles stars.
float canyonHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Benches and risers: flat ledges joined by steep cliffs.
float canyonTerrace(float v, float n) {
  float q = clamp(v, 0.0, 1.0) * n;
  return (floor(q) + smoothstep(0.52, 0.94, fract(q))) / n;
}

// The river's centre at screen height y: it leaves the sunset, swings right,
// then crosses back to the left as it comes near. Perspective narrows the
// swing towards the horizon.
float canyonRiverX(float y) {
  float u = clamp((CANYON_HZ - y) / CANYON_HZ, 0.0, 1.3);
  return mix(canyonSun, -0.05 * canyonW, u) + canyonW * 0.26 * pow(u, 0.8) * sin(u * 5.2 + 0.3);
}

float canyonRiverHalf(float y) {
  return 0.003 + 0.14 * pow(max(CANYON_HZ - y, 0.0), 1.25);
}

// The near walls, rising in four terraces from the river to the rim at the
// edges of the box. The left rim stands a little higher.
float canyonNearTop(float x) {
  float left = step(x, canyonGapN);
  float d = abs(x - canyonGapN) - canyonHalfN;
  float span = mix(canyonW - canyonGapN, canyonW + canyonGapN, left) - canyonHalfN;
  float v = d / max(span * 0.62, 0.05) + 0.05 * snoise(vec2(x * 3.1, 4.7));
  canyonRimN = mix(0.36, 0.41, left) + 0.012 * snoise(vec2(x * 1.7, 9.2));
  return mix(-0.08, canyonRimN, canyonTerrace(v, 4.0));
}

// The middle shelf, three terraces up from its own gap, with a few clefts
// that split it into separate mesas further out.
float canyonMidTop(float x) {
  float d = abs(x - canyonGapM) - canyonHalfM;
  float v = d / (0.42 * canyonW + 0.05) + 0.06 * snoise(vec2(x * 2.6, 1.9));
  canyonRimM = 0.462 + 0.01 * snoise(vec2(x * 1.3, 6.1));
  float cleft = smoothstep(0.5, 0.7, snoise(vec2(x * 2.4, 3.3)));
  return mix(CANYON_FLOOR_M, canyonRimM, canyonTerrace(v, 3.0) * (1.0 - 0.4 * cleft));
}

// One butte: a flat cap rock with sheer sides, on a talus skirt that
// spreads towards its foot. Keeps whichever is taller, it or best, with the
// side of it that faces the sun.
vec2 canyonButte(vec2 best, float x, float cx, float hw, float top, float cap) {
  float d = abs(x - cx);
  float h = d < hw ? top : top - cap - (d - hw) * 1.4;
  if (h > best.x) {
    float side = (x - cx) * sign(canyonSun - cx);
    best = vec2(h, 0.5 + 0.5 * smoothstep(-0.5 * hw, 0.7 * hw, side));
  }
  return best;
}

// The far buttes, placed by hand so they frame the sunset: a broad mesa
// with a lower step on the left, a slender spire, a small butte near the
// middle and a wide mesa on the right. None stands in front of the sun or
// where the river leaves it. Returns the top and how much it faces the sun.
vec2 canyonFar(float x) {
  vec2 best = vec2(CANYON_FLOOR_F, 0.5);
  best = canyonButte(best, x, -0.62 * canyonW, 0.12, 0.63, 0.06);
  best = canyonButte(best, x, -0.62 * canyonW + 0.19, 0.045, 0.572, 0.035);
  best = canyonButte(best, x, -0.17 * canyonW, 0.016, 0.585, 0.075);
  best = canyonButte(best, x, 0.1 * canyonW, 0.03, 0.548, 0.03);
  best = canyonButte(best, x, 0.8 * canyonW, 0.11, 0.6, 0.05);
  float open = smoothstep(canyonHalfF, canyonHalfF + 0.05, abs(x - canyonGapF));
  open *= smoothstep(0.06, 0.13, abs(x - canyonSun));
  best.x = CANYON_FLOOR_F + max(best.x - CANYON_FLOOR_F, 0.0) * open;
  return best;
}

// The plateau on the horizon, notched where the river comes out of it.
float canyonHorizonTop(float x) {
  float n = smoothstep(-0.3, 0.5, snoise(vec2(x * 1.1, 12.0)));
  float top = CANYON_HZ + 0.008 + 0.012 * canyonTerrace(n * 0.999, 2.0);
  return mix(CANYON_HZ - 0.006, top, smoothstep(0.012, 0.05, abs(x - canyonSun)));
}

// The sky from the gold at the horizon to indigo overhead, warmest under
// the sun and coolest away from it.
vec3 canyonSkyColor(float x, float y) {
  float e = clamp((y - CANYON_HZ) / (1.0 - CANYON_HZ), 0.0, 1.0);
  float near = exp(-abs(x - canyonSun) * 2.2);
  vec3 col = vec3(0.08, 0.1, 0.27);
  col = mix(vec3(0.18, 0.15, 0.4), col, smoothstep(0.42, 0.95, e));
  col = mix(vec3(0.38, 0.2, 0.44), col, smoothstep(0.2, 0.6, e));
  col = mix(mix(vec3(0.6, 0.3, 0.46), vec3(0.88, 0.44, 0.36), near), col, smoothstep(0.06, 0.32, e));
  col = mix(mix(vec3(0.78, 0.42, 0.42), vec3(1.0, 0.72, 0.4), near), col, smoothstep(0.0, 0.12, e));
  return col;
}

// The glow of the sun just under the horizon, wide and flattened, with a
// slow breath.
float canyonGlow(float x, float y) {
  vec2 d = vec2((x - canyonSun) * 0.45, max(y - CANYON_HZ, 0.0) * 1.2);
  float r = length(d);
  return (0.9 + 0.08 * sin(canyonT * 0.25)) * (exp(-r * 16.0) + 0.45 * exp(-r * 5.0));
}

vec3 canyonSky(vec2 cell, float x, float y) {
  vec3 col = canyonSkyColor(x, y);
  float e = (y - CANYON_HZ) / (1.0 - CANYON_HZ);
  float glow = canyonGlow(x, y);
  col = mix(col, vec3(1.0, 0.84, 0.56), clamp(glow, 0.0, 1.0));
  // The sun itself, half set behind the plateau.
  float disc = length(vec2(x - canyonSun, y - CANYON_HZ - 0.006));
  col = mix(col, vec3(1.0, 0.96, 0.84), 1.0 - smoothstep(0.036, 0.044, disc));
  // Soft bands of cloud, lit rose and gold from below, drifting slowly.
  float band = smoothstep(0.12, 0.24, e) * (1.0 - smoothstep(0.46, 0.6, e));
  float wisp = fbm(vec2(x * 1.4 + canyonT * 0.006, y * 9.0 - 3.0));
  float cloud = band * smoothstep(0.56, 0.7, wisp);
  vec3 lit = mix(vec3(0.66, 0.34, 0.5), vec3(1.0, 0.64, 0.44), exp(-abs(x - canyonSun) * 1.4));
  col = mix(col, lit, cloud * 0.42);
  // The first stars, more of them higher up, each twinkling on its own beat.
  if (canyonStarsOn > 0.5) {
    float h = canyonHash(cell + 17.0);
    float density = 0.022 * smoothstep(0.4, 0.95, e);
    if (h < density && cloud < 0.1) {
      float k = canyonHash(cell + 3.0);
      float twinkle = 0.55 + 0.45 * sin(canyonT * (0.5 + 0.9 * k) + k * 40.0);
      float bright = k > 0.8 ? 1.0 : 0.62;
      col = mix(col, vec3(0.94, 0.92, 1.0), bright * twinkle * smoothstep(0.4, 0.62, e));
    }
  }
  return col;
}

// The last light, sliding slowly along the rims like the shadow of a cloud
// passing over them. Strongest on the sun's side.
float canyonLight(float x) {
  float n = snoise(vec2(x * 1.5 - canyonT * 0.014, 2.0));
  return (0.5 + 0.5 * smoothstep(-0.35, 0.55, n)) * (0.7 + 0.3 * exp(-abs(x - canyonSun) * 1.2));
}

// One wall of rock: faces turned to the sun lit, a bright ledge at the rim
// and along every bench below it (one every ledge, counted up from base),
// banded strata, and haze settling towards its foot.
vec3 canyonRock(
  float x, float y, float top, float base, float facing, float ledge,
  vec3 lit, vec3 shade, vec3 rim, vec3 haze, float hazeAmt, float light
) {
  float h = clamp((y - base) / max(top - base, 1e-3), 0.0, 1.0);
  float rows = (top - y) / canyonRow;
  float strata = 0.5 + 0.5 * sin(y * 95.0 + 1.6 * snoise(vec2(x * 2.4, y * 14.0)));
  float grain = snoise(vec2(x * 38.0, y * 5.0));
  vec3 col = mix(shade, lit, facing);
  col *= 0.72 + 0.36 * h;
  col *= 0.9 + 0.14 * strata + 0.03 * grain;
  col = mix(col, rim, light * (rows < 1.0 ? 0.9 : 0.4 * exp(-rows * 0.5)));
  if (ledge > 0.0 && (1.0 - fract((y - base) / ledge)) * ledge < canyonRow) {
    col = mix(col, rim, 0.6 * light * (0.4 + 0.6 * facing));
  }
  return mix(col, haze, hazeAmt * (0.55 + 0.45 * (1.0 - h)));
}

// The water mirrors the sky above it: gold far off under the sun, rose and
// violet close by. Streaks of shimmer slide slowly across it.
vec3 canyonWater(float x, float y) {
  float depth = CANYON_HZ - y;
  vec3 col = canyonSkyColor(x, CANYON_HZ + depth * 0.32) + vec3(0.05, 0.04, 0.08);
  float sun = exp(-abs(x - canyonSun) * 5.0) * exp(-depth * 3.5);
  col = mix(col, vec3(1.0, 0.82, 0.52), clamp(sun * 1.4, 0.0, 1.0));
  float streak = snoise(vec2(x * 7.0 + canyonT * 0.05, y * 85.0 - canyonT * 0.22));
  col *= 0.82 + 0.32 * smoothstep(-0.1, 0.8, streak);
  float glint = smoothstep(0.86, 0.95, snoise(vec2(x * 22.0 - canyonT * 0.03, y * 140.0 + canyonT * 0.12)));
  return mix(col, vec3(1.0, 0.9, 0.7), glint * (0.35 + 0.65 * sun));
}

// The canyon floor where no wall covers it: sand banks along the water,
// dusk shadow further out, hazier with distance.
vec3 canyonFloor(float x, float y) {
  float d = abs(x - canyonRiverX(y));
  float hw = canyonRiverHalf(y);
  float far = smoothstep(0.1, CANYON_HZ, y);
  canyonWet = 1.0 - step(hw, d);
  if (d < hw) {
    return canyonWater(x, y);
  }
  vec3 ground = mix(vec3(0.24, 0.14, 0.24), vec3(0.46, 0.3, 0.44), far);
  float bank = 1.0 - smoothstep(hw, hw + 0.012 + hw * 0.6, d);
  ground = mix(ground, mix(vec3(0.44, 0.26, 0.2), vec3(0.7, 0.48, 0.46), far), bank * 0.85);
  return ground * (0.96 + 0.05 * snoise(vec2(x * 12.0, y * 30.0)));
}

vec2 canyonCacheUv = vec2(-1.0);
float canyonCacheT = -1.0;
vec4 canyonCacheValue = vec4(0.0);

vec4 canyonScene(vec2 uv, vec2 res, float t) {
  if (uv == canyonCacheUv && t == canyonCacheT) {
    return canyonCacheValue;
  }
  float aspect = res.x / res.y;
  // Tall boxes narrow the view less than they crop it, so the river, both
  // walls and the sunset all stay in frame on a phone.
  float zoom = clamp(aspect / 1.5, 0.55, 1.0);
  float x = (uv.x - 0.5) * aspect / zoom;
  float y = uv.y;
  // One star per dot, so a star never splits across two glyph columns.
  vec2 cell = floor(uv * ascii_samples / vec2(canyonPitch, 1.0));
  canyonT = t;
  canyonRow = 1.0 / res.y;
  canyonW = 0.5 * aspect / zoom;
  canyonSun = canyonW * mix(0.3, 0.42, smoothstep(0.7, 1.6, aspect));
  canyonGapN = canyonRiverX(0.06);
  canyonGapM = canyonRiverX(0.33);
  canyonGapF = canyonRiverX(0.455);
  canyonHalfN = canyonRiverHalf(0.06) + 0.025;
  canyonHalfM = canyonRiverHalf(0.33) + 0.025;
  canyonHalfF = canyonRiverHalf(0.455) + 0.01;

  vec3 col;
  // Ground draws larger dots than sky of the same brightness, so the walls
  // read as solid rock and the sky stays light and fine. solid shifts one
  // layer against the others.
  float ground = 1.0;
  float solid = 0.0;
  // How much brighter a layer's dots are than the value that sized them, so
  // a silhouette drawn in small dots still shows its colour.
  float ink = 1.0;
  float topN = canyonNearTop(x);
  float topM = canyonMidTop(x);
  vec2 far = canyonFar(x);
  float topH = canyonHorizonTop(x);
  if (y < topN) {
    float facing = 1.0 - smoothstep(-0.15, 0.15, x - canyonGapN);
    ink = 1.1;
    col = canyonRock(
      x, y, topN, -0.08, facing, (canyonRimN + 0.08) * 0.25,
      vec3(0.46, 0.15, 0.11), vec3(0.28, 0.13, 0.27), vec3(1.0, 0.52, 0.26),
      vec3(0.2, 0.1, 0.18), 0.1, canyonLight(x)
    );
    solid = 0.12;
  } else if (y < topM && y > CANYON_FLOOR_M) {
    float facing = 1.0 - smoothstep(-0.1, 0.1, x - canyonGapM);
    col = canyonRock(
      x, y, topM, CANYON_FLOOR_M, facing, (canyonRimM - CANYON_FLOOR_M) / 3.0,
      vec3(0.96, 0.5, 0.27), vec3(0.5, 0.27, 0.44), vec3(1.0, 0.72, 0.42),
      vec3(0.46, 0.26, 0.42), 0.28, 0.9 * canyonLight(x)
    );
    solid = 0.06;
  } else if (y < far.x && y > CANYON_FLOOR_F) {
    col = canyonRock(
      x, y, far.x, CANYON_FLOOR_F, far.y, 0.0,
      vec3(0.74, 0.36, 0.3), vec3(0.34, 0.19, 0.36), vec3(1.0, 0.74, 0.44),
      vec3(0.48, 0.3, 0.5), 0.35, canyonLight(x)
    );
    solid = 0.14;
    ink = 1.2;
  } else if (y < topH && y > CANYON_HZ - 0.03) {
    col = canyonRock(
      x, y, topH, CANYON_HZ - 0.03, 0.5, 0.0,
      vec3(0.8, 0.5, 0.5), vec3(0.55, 0.36, 0.52), vec3(1.0, 0.72, 0.5),
      vec3(0.68, 0.46, 0.6), 0.5, canyonLight(x)
    );
    solid = -0.05;
  } else if (y < CANYON_HZ) {
    col = canyonFloor(x, y);
    solid = mix(0.04, 0.12, canyonWet);
  } else {
    col = canyonSky(cell, x, y);
    ground = 0.0;
    // A fixed jitter per dot mixes neighbouring dot sizes where the sky
    // crosses from one to the next, instead of a hard stepped contour.
    solid = 0.22 * (canyonHash(cell + 41.0) - 0.5);
  }

  // Dot size follows brightness. The dots ramp switches at about 0.1, 0.35
  // and 0.75: deep shadow and the high sky stay on the smallest dot, lit
  // rock takes the middle one and light the largest.
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float tone = mix(1.25 * lum - 0.02, 0.04 + 1.8 * lum, ground) + solid;
  tone = clamp(tone, 0.0, 1.0);
  // Like ink in a halftone, a dot keeps a clear colour and its size carries
  // the value; very dark colours on small dots would vanish into the paper.
  col = min(col * ink * clamp(pow(0.16 / max(lum, 0.01), 0.5), 1.0, 1.8), vec3(1.0));
  // Without square cells a dot glyph's cell is half as wide as it is tall,
  // so dots light every other column to keep the grid of dots square.
  if (canyonPitch > 1.5 && mod(floor(uv.x * ascii_samples.x), 2.0) > 0.5) {
    tone = 0.0;
  }
  canyonCacheUv = uv;
  canyonCacheT = t;
  // Intensity dims colour in step and shrinks dots gently. It quiets the
  // middle of the box, where a headline sits, more than the edges.
  float calm = 1.0 - smoothstep(0.2, 0.75, length((uv - 0.5) * vec2(1.2, 2.0)));
  float k = mix(1.0, canyonIntensity, mix(0.6, 1.0, calm));
  canyonCacheValue = vec4(col * k, tone * (0.7 + 0.3 * k));
  return canyonCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return canyonScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return canyonScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const DUSK = "#0b0a1c";
const DUSK_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0b0a1c 0%, #1c1438 30%, #4a2440 48%, #7a3a2a 52%, #1a0c12 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface CanyonRiverProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The first stars twinkling in the upper sky. Default `true`. */
  stars?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's dusk in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the dusk. */
  ramp?: AsciiSceneProps["ramp"];
  /** Cells as wide as they are tall, so `dots` lay an even halftone lattice. Default `true`. */
  square?: boolean;
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the canyon never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A desert canyon at dusk from a high rim. Terraced walls step back from
 * deep rust shadow to far mesas glowing orange in violet haze, and a river
 * winds up the canyon floor mirroring the sunset. The last light drifts
 * along the far rims, the water shimmers and the first stars come out.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const CanyonRiver = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  dither = "none",
  square = true,
  stillTime = 0,
  intensity = 1,
  stars = true,
  fallback = FALLBACK,
  // The canyon has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: CanyonRiverProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const resolved = resolveCharset(charset, chars);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        canyonIntensity: clamp(intensity, 0, 1),
        canyonPitch: resolved.id === "dots" && !square ? 2 : 1,
        canyonStarsOn: stars ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      dither={dither}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
