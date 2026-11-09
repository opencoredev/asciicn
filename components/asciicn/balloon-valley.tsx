"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The valley is painted in square units (x across from the middle of the
// box, y up from the bottom), tested near to far: two dark foreground hills,
// the valley floor with the river, then four ridges that open in a V under
// the sun, each paler than the one in front, then the sky. A ridge is dark
// at its crest with a lit rim and pales into haze below it, so the next
// crest in front stands out; mist pools in the low ground of each V. The
// colour is worked out first and the dot size follows its brightness, so
// the hills are small dim dots and the sun is large bright ones, as in a
// halftone print.
const SCENE = `
// The land is laid out in its own units and squashed by BV_LAND into the
// lower part of the box, so the sun, its glow and the river sit below a
// headline in the middle and the sky above stays quiet.
const float BV_LAND = 0.68;
// The horizon in land units.
const float BV_HORIZON = 0.43;

// Set once per sample by bvScene and read by every layer.
float bvT;
float bvWide;
float bvStretch;
float bvHalf;
float bvSunOffset;
// The sun in box units, and in land units.
vec2 bvSun;
vec2 bvSunQ;

// A stable random value; hash21 repeats every 50 samples on integers.
float bvHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The sky, in box units: near-black indigo overhead, so the top of the box
// is quiet dark air, easing through dusky violet and rose to peach at the
// horizon, warmed by a glow round the sun and a tighter halo.
vec3 bvSky(vec2 p) {
  float y = p.y;
  vec3 c = mix(vec3(0.96, 0.62, 0.52), vec3(0.66, 0.42, 0.55), smoothstep(0.29, 0.42, y));
  c = mix(c, vec3(0.36, 0.26, 0.5), smoothstep(0.38, 0.56, y));
  c = mix(c, vec3(0.17, 0.15, 0.36), smoothstep(0.52, 0.74, y));
  c = mix(c, vec3(0.09, 0.09, 0.22), smoothstep(0.72, 1.0, y));
  float r = length((p - bvSun) * vec2(0.45, 1.4));
  c = mix(c, vec3(1.0, 0.7, 0.46), clamp(exp(-r / 0.17) * 0.9, 0.0, 1.0));
  c = mix(c, vec3(1.0, 0.86, 0.62), clamp(exp(-length(p - bvSun) / 0.05), 0.0, 1.0));
  return c;
}

// The last stars, fading out as the sky brightens below them, each on
// its own slow twinkle.
vec3 bvStars(vec2 p, vec2 res, vec3 sky) {
  vec2 cellId = floor(p * res.y);
  float h = bvHash(cellId + 17.0);
  float density = 0.006 * smoothstep(0.74, 0.97, p.y);
  if (h < 1.0 - density) {
    return sky;
  }
  float twinkle = 0.75 + 0.25 * sin(bvT * (0.4 + bvHash(cellId + 3.0) * 0.6) + h * 50.0);
  return mix(sky, vec3(0.86, 0.86, 1.0), 0.5 * twinkle);
}

// Everything below is in land units. The valley floor is a flat strip in
// front of the ridges, seen in perspective from its far edge at BV_FLOOR
// down to the bottom of the box.
const float BV_FLOOR = 0.25;

// Nearness on the floor: 0 at its far edge, 1 at the bottom of the box.
float bvNear(float y) {
  return clamp((BV_FLOOR - y) / BV_FLOOR, 0.0, 1.0);
}

// The river's centre at row y. It leaves the far edge under the sun and
// swings wider as it comes nearer.
float bvRiverX(float y) {
  float k = bvNear(y);
  return bvSun.x + bvStretch * (0.03 + 0.16 * k) * sin(k * 5.2 + 0.4);
}

float bvRiverHalf(float y) {
  return 0.01 + 0.075 * pow(bvNear(y), 1.4);
}

// A ridge line: a soft V round its gap at gx (relative to the sun), with
// slopes sl and sr either side easing off towards a cap, and rolling noise.
float bvRidge(float x, float gx, float base, float sl, float sr, float cap, float seed, float rough) {
  float d = (x - bvSun.x) / bvStretch - gx;
  float v = (d < 0.0 ? sl : sr) * (sqrt(d * d + 0.0049) - 0.07);
  v = cap * (1.0 - exp(-v / cap));
  float n = 0.55 * snoise(vec2(x * 2.6 + seed, seed)) + 0.3 * snoise(vec2(x * 6.1 - seed, seed + 3.0)) + 0.15 * snoise(vec2(x * 15.0, seed + 6.0));
  return base + v + rough * n * smoothstep(0.0, 0.04, v);
}

// Ridge i, near to far: gap offset from the sun, base, left and right
// slopes, cap, seed and roughness. The nearest hills carry a ragged line
// of trees; the far ones stay smooth.
float bvRidgeTop(int i, float x) {
  if (i == 0) {
    return bvRidge(x, 0.03, -0.06, 0.95, 0.85, 0.38, 1.3, 0.05) + 0.012 * snoise(vec2(x * 38.0, 2.0));
  }
  if (i == 1) {
    return bvRidge(x, -0.24, 0.24, 0.42, 0.7, 0.28, 4.7, 0.045) + 0.005 * snoise(vec2(x * 30.0, 5.0));
  }
  if (i == 2) {
    return bvRidge(x, 0.16, 0.33, 0.6, 0.35, 0.24, 9.1, 0.04);
  }
  if (i == 3) {
    return bvRidge(x, -0.02, 0.4, 0.5, 0.5, 0.21, 2.9, 0.035);
  }
  return bvRidge(x, 0.0, 0.445, 0.4, 0.4, 0.22, 7.7, 0.035);
}

// Ridge i's crest colour and how far it is lost in the haze, 0 to 1.
vec4 bvRidgeLook(int i) {
  if (i == 0) {
    return vec4(0.06, 0.06, 0.13, 0.0);
  }
  if (i == 1) {
    return vec4(0.15, 0.13, 0.3, 0.18);
  }
  if (i == 2) {
    return vec4(0.24, 0.16, 0.33, 0.4);
  }
  if (i == 3) {
    return vec4(0.34, 0.22, 0.4, 0.58);
  }
  return vec4(0.45, 0.3, 0.42, 0.74);
}

// Ridge i's base, how high mist pools above it, rim strength and depth.
vec4 bvRidgeShape(int i) {
  if (i == 0) {
    return vec4(-0.06, 0.0, 0.35, 1.2);
  }
  if (i == 1) {
    return vec4(0.24, 0.035, 0.5, 4.5);
  }
  if (i == 2) {
    return vec4(0.33, 0.04, 0.6, 7.0);
  }
  if (i == 3) {
    return vec4(0.4, 0.035, 0.7, 11.0);
  }
  return vec4(0.445, 0.03, 0.8, 30.0);
}

// Mist drifting along the valley, as a 0 to 1 density.
float bvMist(vec2 p, float scale) {
  vec2 q = vec2(p.x * 2.6 * scale - bvT * 0.012, p.y * 14.0 * scale + bvT * 0.004);
  return fbm(q + vec2(fbm(q * 0.7 + bvT * 0.006) * 0.8, 0.0));
}

float bvSunward(vec2 q) {
  return exp(-length((q - bvSunQ) * vec2(1.0, 2.0)) / 0.4);
}

// The colour of a ridge. Far ridges sink into the colour of the sky behind
// them, so distance is quiet and low in contrast. Faces turned towards the
// sun catch a little light and the others fall into shade. Haze thickens
// down each face, so the next crest in front stands out, and mist pools
// in the low ground of the V. Only the rim near the sun is bright.
vec3 bvRidgeColor(vec2 q, float top, int i, float lit) {
  vec4 look = bvRidgeLook(i);
  vec4 shape = bvRidgeShape(i);
  float haze = look.a;
  float sunward = bvSunward(q);
  vec3 skyBehind = bvSky(vec2(q.x, (BV_HORIZON + 0.06) * BV_LAND)) * 0.88;
  vec3 c = mix(look.rgb, skyBehind, haze);
  c *= 1.0 + 0.35 * lit * (1.0 - haze);
  float tex = fbm(q * vec2(18.0, 30.0) + float(i) * 7.0);
  c *= 1.0 + (0.14 * tex - 0.07) * (1.0 - haze);
  vec3 mistCol = mix(vec3(0.56, 0.42, 0.58), vec3(0.95, 0.72, 0.58), sunward);
  c = mix(c, mix(mistCol, skyBehind, 0.5), smoothstep(0.015, 0.15, top - q.y) * 0.55);
  float edge = 1.0 - smoothstep(0.01, 0.02, top - q.y);
  vec3 rimCol = mix(vec3(0.52, 0.36, 0.48), vec3(1.0, 0.84, 0.58), sunward);
  c = mix(c, rimCol, clamp(edge * shape.z * (0.25 + 0.75 * sunward), 0.0, 1.0));
  float low = 1.0 - smoothstep(shape.x, shape.x + shape.y, q.y);
  float mist = low * (0.55 + 0.45 * smoothstep(0.3, 0.72, bvMist(q, 1.0)));
  return mix(c, mistCol, clamp(mist * 0.6, 0.0, 1.0));
}

// The valley floor: meadow in near-black shadow close by, sinking into
// mist with distance, and the river reflecting the dawn with the sun's
// glitter on it, the brightest dots below the horizon.
vec3 bvFloor(vec2 q) {
  float k = bvNear(q.y);
  float sunward = exp(-abs(q.x - bvSun.x) / 0.4);
  vec3 meadow = mix(vec3(0.3, 0.25, 0.4), vec3(0.06, 0.07, 0.14), pow(k, 0.5));
  meadow *= 0.9 + 0.2 * fbm(q * vec2(16.0, 30.0) + 5.0);
  float mist = smoothstep(0.32, 0.72, bvMist(vec2(q.x, q.y * 0.7), 1.2)) * (1.0 - 0.8 * k);
  mist = max(mist, 1.0 - smoothstep(0.0, 0.05, BV_FLOOR - q.y));
  vec3 mistCol = mix(vec3(0.5, 0.4, 0.56), vec3(0.95, 0.72, 0.58), sunward);
  float off = abs(q.x - bvRiverX(q.y));
  float halfWidth = bvRiverHalf(q.y);
  vec3 c = meadow;
  if (off < halfWidth) {
    vec3 sky = bvSky(vec2(bvSun.x + (q.x - bvSun.x) * 0.5, (BV_HORIZON + 0.02 + k * 0.3) * BV_LAND));
    c = sky * 0.78;
    float spread = 0.03 + 0.08 * k;
    float column = exp(-pow((q.x - bvSun.x) / spread, 2.0));
    float ripple = 0.5 + 0.5 * snoise(vec2(q.x * 36.0, q.y * 90.0 - bvT * 0.3));
    // The sun's column of glitter, and sparse glints all along the water.
    float glint = column * (0.4 + 0.6 * ripple) + smoothstep(0.82, 0.95, ripple) * (0.5 + 0.5 * sunward);
    c = mix(c, vec3(1.0, 0.9, 0.68), clamp(glint, 0.0, 1.0));
    c *= 0.9 + 0.1 * sin(bvT * 0.5);
    // Darker banks at the edges.
    c = mix(c, meadow, smoothstep(0.7, 1.0, off / halfWidth) * 0.6);
  }
  return mix(c, mistCol, clamp(mist * 0.6, 0.0, 0.7));
}

// One balloon: a round crown tapering to the mouth, gores in two colours
// and a band, lit from the sun's side and glowing through on the shadow
// side, with a small basket below. Returns colour and coverage.
vec4 bvBalloon(vec2 p, vec3 b, vec3 ca, vec3 cb, float z) {
  vec2 q = (p - b.xy) / b.z;
  if (q.y < -2.0 || q.y > 1.05 || abs(q.x) > 1.05) {
    return vec4(0.0);
  }
  float haze = 0.85 * (1.0 - exp(-z / 14.0));
  vec3 hazeCol = bvSky(p);
  vec2 l2 = normalize(bvSun - b.xy);
  vec3 light = normalize(vec3(l2, 0.45 + z * 0.12));
  // Basket and its shadowed ropes.
  if (q.y < -1.6) {
    if (q.y > -1.95 && q.y < -1.7 && abs(q.x) < 0.2) {
      vec3 wicker = mix(vec3(0.42, 0.25, 0.18), vec3(0.95, 0.6, 0.36), 0.35 + 0.35 * l2.x * sign(q.x + 0.001));
      return vec4(mix(wicker, hazeCol, haze), 1.0);
    }
    return vec4(0.0);
  }
  float w = q.y > -0.35 ? sqrt(max(0.0, 1.0 - q.y * q.y)) : mix(0.2, 0.937, pow(clamp((q.y + 1.6) / 1.25, 0.0, 1.0), 0.85));
  if (abs(q.x) > w) {
    return vec4(0.0);
  }
  float s = q.x / max(w, 0.001);
  float ny = q.y > -0.35 ? q.y : -0.35 - (q.y + 0.35) * 0.3;
  vec3 n = normalize(vec3(s * sqrt(max(0.0, 1.0 - ny * ny)), ny, sqrt(max(0.05, 1.0 - s * s))));
  // Small balloons in one colour: two gores that far off read as slivers.
  float gores = b.z < 0.035 ? 1.0 : 8.0;
  float g = floor((asin(clamp(s, -1.0, 1.0)) / 3.14159 + 0.5) * gores);
  vec3 cloth = mod(g, 2.0) < 0.5 ? ca : cb;
  if (b.z > 0.03 && abs(q.y - 0.2) < 0.13) {
    cloth = mix(ca, cb, 0.5) * 1.1;
  }
  float lambert = max(dot(n, light), 0.0);
  float through = 0.62 + 0.18 * (1.0 - abs(s));
  vec3 lit = cloth * (through + 0.6 * lambert) + vec3(0.06, 0.03, 0.06);
  lit += vec3(1.0, 0.7, 0.4) * pow(1.0 - n.z, 3.0) * max(dot(n.xy, l2), 0.0) * 0.8;
  return vec4(mix(lit, hazeCol, haze), 1.0);
}

// Balloon centre and radius: x as a share of the half width, wide and
// tall layouts blended by aspect, a slow bob, and for some a slow rise and
// fall over a few minutes.
vec3 bvPlace(vec4 wide, vec4 tall, float rise, float period, float phase) {
  vec4 a = mix(tall, wide, bvWide);
  float bob = 0.004 * sin(bvT * 0.23 + phase * 7.0);
  float up = rise * (0.5 - 0.5 * cos(6.2832 * (bvT / period + phase)));
  return vec3(a.x * bvHalf, a.y + bob + up, a.z);
}

vec2 bvCacheUv = vec2(-1.0);
float bvCacheT = -1.0;
vec4 bvCacheValue = vec4(0.0);

vec4 bvScene(vec2 uv, vec2 res, float t) {
  if (uv == bvCacheUv && t == bvCacheT) {
    return bvCacheValue;
  }
  float aspect = res.x / res.y;
  bvT = t;
  bvWide = smoothstep(0.7, 1.3, aspect);
  bvStretch = clamp(aspect / 1.78, 0.5, 1.2);
  bvHalf = min(aspect * 0.5, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  // The sun sits a little right of centre on wide boxes, central on tall
  // ones, low enough that its disc stays under a centred headline.
  bvSunOffset = 0.14 * bvWide;
  bvSunQ = vec2(bvSunOffset * bvStretch, BV_HORIZON + 0.028);
  bvSun = vec2(bvSunQ.x, bvSunQ.y * BV_LAND);
  vec2 q = vec2(p.x, p.y / BV_LAND);

  // Depth of whatever is nearest at this sample, and its colour.
  float depth = 1e4;
  vec3 col = vec3(0.0);
  bool found = false;

  // Near to far: the foreground hills, the valley floor, then the ridges.
  for (int i = 0; i < 5; i++) {
    if (i == 1 && q.y < BV_FLOOR) {
      col = bvFloor(q);
      depth = 2.0 + 3.0 * (1.0 - bvNear(q.y));
      found = true;
      break;
    }
    float top = bvRidgeTop(i, q.x);
    if (q.y < top) {
      // Positive where the face turns towards the sun.
      float slope = (bvRidgeTop(i, q.x + 0.01) - top) / 0.01;
      float lit = clamp(-slope * sign(bvSun.x - q.x) * 1.5, -1.0, 1.0);
      col = bvRidgeColor(q, top, i, lit);
      depth = bvRidgeShape(i).w;
      found = true;
      break;
    }
  }
  if (!found) {
    col = bvStars(p, res, bvSky(p));
    // The sun's disc, a little flattened by the haze.
    float r = length((p - bvSun) * vec2(1.0, 1.08));
    col = mix(col, vec3(1.0, 0.98, 0.9), 1.0 - smoothstep(0.034, 0.04, r));
  }

  // Balloons, each drawn only where nothing nearer covers it.
  vec4 hit;
  vec3 b;
  b = bvPlace(vec4(0.88, 0.27, 0.021, 0.0), vec4(0.62, 0.25, 0.017, 0.0), 0.12, 260.0, 0.32);
  hit = bvBalloon(p, b, vec3(0.42, 0.62, 0.95), vec3(0.95, 0.92, 0.88), 10.0);
  if (hit.a > 0.5 && depth > 10.0) {
    col = hit.rgb;
    depth = 10.0;
  }
  b = bvPlace(vec4(0.24, 0.9, 0.016, 0.0), vec4(3.0, 0.93, 0.013, 0.0), 0.0, 1.0, 0.7);
  hit = bvBalloon(p, b, vec3(0.9, 0.3, 0.3), vec3(0.98, 0.9, 0.8), 12.0);
  if (hit.a > 0.5 && depth > 12.0) {
    col = hit.rgb;
    depth = 12.0;
  }
  b = bvPlace(vec4(-0.36, 0.82, 0.028, 0.0), vec4(-0.7, 0.9, 0.022, 0.0), 0.0, 1.0, 0.15);
  hit = bvBalloon(p, b, vec3(0.98, 0.78, 0.3), vec3(0.55, 0.3, 0.62), 6.0);
  if (hit.a > 0.5 && depth > 6.0) {
    col = hit.rgb;
    depth = 6.0;
  }
  b = bvPlace(vec4(0.66, 0.6, 0.042, 0.0), vec4(0.55, 0.82, 0.034, 0.0), 0.1, 200.0, 0.6);
  hit = bvBalloon(p, b, vec3(0.25, 0.7, 0.66), vec3(0.98, 0.9, 0.74), 4.0);
  if (hit.a > 0.5 && depth > 4.0) {
    col = hit.rgb;
    depth = 4.0;
  }
  b = bvPlace(vec4(-0.72, 0.63, 0.095, 0.0), vec4(-0.35, 0.74, 0.068, 0.0), 0.0, 1.0, 0.0);
  hit = bvBalloon(p, b, vec3(0.95, 0.28, 0.22), vec3(1.0, 0.72, 0.28), 1.5);
  if (hit.a > 0.5 && depth > 1.5) {
    col = hit.rgb;
    depth = 1.5;
  }

  col = clamp(col, 0.0, 1.0);
  // Dot size follows brightness on a steep curve: shadow and dark air get
  // the smallest dots, some cells none, and only the sun, the river's
  // glints and the lit balloons reach the large ones.
  float luma = dot(col, vec3(0.3, 0.55, 0.15));
  float tone = clamp(1.12 * pow(luma, 1.15) + 0.03, 0.0, 1.0);
  tone *= sqrt(bvIntensity);
  bvCacheUv = uv;
  bvCacheT = t;
  bvCacheValue = vec4(col * bvIntensity, tone);
  return bvCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return bvScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return bvScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its pre-dawn night behind
// them in both themes; mono and palette keep the theme's paper.
const NIGHT = "#0d0b1f";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #15163a 0%, #3a2c5c 30%, #b06a7c 48%, #f0a070 55%, #3a2a58 60%, #15142e 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface BalloonValleyProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /**
   * Paper behind the glyphs. Default: the scene's deep indigo in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"infrared"`, indigo to amber. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dawn as a flat gradient. */
  fallback?: ReactNode;
  /** Square cells, so the dots lie on an even lattice like a halftone screen. Default `true`. */
  square?: boolean;
  /** Ordered dithering between dot sizes, which turns four dots into smooth tone. Default `"bayer4"`. */
  dither?: AsciiSceneProps["dither"];
  /** Ignored: the valley never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Sunrise over a river valley. Soft ridges fade into the haze layer by
 * layer, mist pools in the valley and the river catches the low sun,
 * while hot-air balloons hang at different depths and two rise and sink
 * very slowly. Decorative and full-bleed: size it with `className`,
 * usually `absolute inset-0`.
 */
export const BalloonValley = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 0,
  dither = "bayer4",
  intensity = 1,
  fallback = FALLBACK,
  // The valley has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: BalloonValleyProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{ bvIntensity: clamp(intensity, 0, 1) }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "infrared" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      square={square}
      dither={dither}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
