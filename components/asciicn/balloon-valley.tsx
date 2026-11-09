"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Early morning over a river valley, painted in square units (x across
// from the middle of the box, y up from the bottom) and tested near to far:
// two foreground hills, the valley floor with the river, four ridges that
// open in a V under the sun, then the sky. It is printed like ink on warm
// cream paper: the dot size follows how far a colour is from the paper, so
// the pale sky is the faintest dots, the cool blue hills and the gold mist
// are small and medium ones, and only the sun, the river's glints and the
// balloons get large ones.
const SCENE = `
// The land is laid out in its own units and squashed by BV_LAND into the
// lower part of the box, so the sun, its glow and the river sit below a
// headline in the middle and the sky above stays quiet.
const float BV_LAND = 0.68;
// The horizon in land units.
const float BV_HORIZON = 0.43;

// The cream paper the scene is printed on.
const vec3 BV_PAPER = vec3(0.965, 0.937, 0.902);

// Set once per sample by bvScene and read by every layer.
float bvT;
// Extra dot size for the focal lights: the sun, the river's glints and the
// lit side of the near balloons.
float bvAccent;
float bvWide;
float bvStretch;
float bvHalf;
float bvSunOffset;
// The sun in box units, and in land units.
vec2 bvSun;
vec2 bvSunQ;

// The sky, in box units: a soft blue overhead paling to a clear cream in
// the middle, so a headline sits on almost bare paper, and warming to pale
// peach at the horizon, with a gold glow round the sun.
vec3 bvSky(vec2 p) {
  float y = p.y;
  vec3 c = mix(vec3(1.0, 0.85, 0.66), vec3(0.98, 0.92, 0.84), smoothstep(0.29, 0.42, y));
  c = mix(c, vec3(0.92, 0.93, 0.93), smoothstep(0.42, 0.66, y));
  c = mix(c, vec3(0.68, 0.79, 0.95), smoothstep(0.6, 1.02, y));
  float r = length((p - bvSun) * vec2(0.5, 1.3));
  c = mix(c, vec3(1.0, 0.78, 0.46), clamp(exp(-r / 0.15), 0.0, 1.0));
  return c;
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
    return vec4(0.48, 0.58, 0.76, 0.0);
  }
  if (i == 1) {
    return vec4(0.53, 0.61, 0.78, 0.12);
  }
  if (i == 2) {
    return vec4(0.62, 0.68, 0.84, 0.3);
  }
  if (i == 3) {
    return vec4(0.72, 0.76, 0.88, 0.5);
  }
  return vec4(0.8, 0.82, 0.9, 0.66);
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

// The colour of a ridge: a cool blue shadow that sinks into the colour of
// the sky behind it with distance. Faces turned towards the sun warm up and
// the others stay cool. Gold mist thickens down each face, so the next
// crest in front stands out, and pools in the low ground of the V. The
// crest nearest the sun catches a line of sunlight.
vec3 bvRidgeColor(vec2 q, float top, int i, float lit) {
  vec4 look = bvRidgeLook(i);
  vec4 shape = bvRidgeShape(i);
  float haze = look.a;
  float sunward = bvSunward(q);
  vec3 skyBehind = bvSky(vec2(q.x, (BV_HORIZON + 0.06) * BV_LAND));
  vec3 c = mix(look.rgb, skyBehind, haze);
  float face = (1.0 - haze) * (0.4 + 0.6 * sunward);
  c = mix(c, vec3(0.96, 0.82, 0.64), clamp(lit, 0.0, 1.0) * 0.45 * face);
  c *= 1.0 - 0.1 * clamp(-lit, 0.0, 1.0) * (1.0 - haze);
  float tex = fbm(q * vec2(18.0, 30.0) + float(i) * 7.0);
  c *= 1.0 + (0.08 * tex - 0.04) * (1.0 - haze);
  vec3 mistCol = mix(vec3(0.98, 0.86, 0.64), vec3(1.0, 0.8, 0.5), sunward);
  c = mix(c, mistCol, smoothstep(0.015, 0.16, top - q.y) * 0.5);
  float edge = 1.0 - smoothstep(0.01, 0.02, top - q.y);
  float rim = edge * shape.z * sunward;
  c = mix(c, vec3(1.0, 0.78, 0.45), clamp(rim, 0.0, 1.0));
  bvAccent += 0.2 * rim;
  float low = 1.0 - smoothstep(shape.x, shape.x + shape.y, q.y);
  float mist = low * (0.6 + 0.4 * smoothstep(0.3, 0.72, bvMist(q, 1.0)));
  return mix(c, mistCol, clamp(mist * 0.75, 0.0, 1.0));
}

// The valley floor: sage meadow in soft blue shadow close by, lost in gold
// mist with distance, and the river mirroring the pale sky with the sun's
// glitter on it.
vec3 bvFloor(vec2 q) {
  float k = bvNear(q.y);
  float sunward = exp(-abs(q.x - bvSun.x) / 0.4);
  vec3 meadow = mix(vec3(0.84, 0.83, 0.72), vec3(0.4, 0.54, 0.54), pow(k, 0.5));
  meadow *= 0.95 + 0.1 * fbm(q * vec2(16.0, 30.0) + 5.0);
  float mist = smoothstep(0.3, 0.7, bvMist(vec2(q.x, q.y * 0.7), 1.2)) * (1.0 - 0.9 * k);
  mist = max(mist, 1.0 - smoothstep(0.0, 0.05, BV_FLOOR - q.y));
  vec3 mistCol = mix(vec3(0.98, 0.86, 0.64), vec3(1.0, 0.8, 0.5), sunward);
  float off = abs(q.x - bvRiverX(q.y));
  float halfWidth = bvRiverHalf(q.y);
  vec3 c = meadow;
  if (off < halfWidth) {
    vec3 sky = bvSky(vec2(bvSun.x + (q.x - bvSun.x) * 0.5, (BV_HORIZON + 0.02 + k * 0.3) * BV_LAND));
    c = mix(sky, vec3(0.82, 0.88, 0.96), 0.4);
    float spread = 0.03 + 0.08 * k;
    float column = exp(-pow((q.x - bvSun.x) / spread, 2.0));
    float ripple = 0.5 + 0.5 * snoise(vec2(q.x * 36.0, q.y * 90.0 - bvT * 0.3));
    // The sun's column of glitter, and sparse glints all along the water.
    float glint = clamp(column * (0.4 + 0.6 * ripple) + smoothstep(0.72, 0.9, ripple) * (0.5 + 0.5 * sunward), 0.0, 1.0);
    glint *= 0.9 + 0.1 * sin(bvT * 0.5);
    c = mix(c, vec3(1.0, 0.74, 0.34), glint);
    bvAccent += 0.45 * glint;
    // Darker banks at the edges.
    c = mix(c, meadow * 0.8, smoothstep(0.75, 1.0, off / halfWidth) * 0.8);
  }
  return mix(c, mistCol, clamp(mist * 0.65, 0.0, 0.75));
}

// One balloon: a round crown tapering to the mouth, gores in two colours
// and a band, lit from the sun's side and glowing through on the shadow
// side, with a small basket below. Returns colour and coverage.
vec4 bvBalloon(vec2 p, vec3 b, vec3 ca, vec3 cb, float z) {
  vec2 q = (p - b.xy) / b.z;
  if (q.y < -2.0 || q.y > 1.05 || abs(q.x) > 1.05) {
    return vec4(0.0);
  }
  float haze = 0.8 * (1.0 - exp(-z / 12.0));
  vec3 hazeCol = bvSky(p);
  vec2 l2 = normalize(bvSun - b.xy);
  vec3 light = normalize(vec3(l2, 0.45 + z * 0.12));
  // Basket and its shadowed ropes.
  if (q.y < -1.6) {
    if (q.y > -1.95 && q.y < -1.7 && abs(q.x) < 0.2) {
      vec3 wicker = mix(vec3(0.42, 0.25, 0.18), vec3(0.95, 0.6, 0.36), 0.35 + 0.35 * l2.x * sign(q.x + 0.001));
      bvAccent = 0.0;
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
  vec3 lit = cloth * (through + 0.5 * lambert);
  lit += vec3(1.0, 0.75, 0.45) * pow(1.0 - n.z, 3.0) * max(dot(n.xy, l2), 0.0) * 0.6;
  bvAccent = 0.25 * lambert * (1.0 - haze);
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
  bvAccent = 0.0;
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
    col = bvSky(p);
    // The sun's disc, a little flattened by the haze, in a soft halo.
    float r = length((p - bvSun) * vec2(1.0, 1.08));
    float disc = 1.0 - smoothstep(0.034, 0.04, r);
    col = mix(col, vec3(1.0, 0.76, 0.36), disc);
    bvAccent = max(disc * 0.55, 0.45 * exp(-r / 0.045));
  }

  // Balloons, each drawn only where nothing nearer covers it.
  // A balloon sets bvAccent for its own sample; keep the scene's otherwise.
  float accent = bvAccent;
  vec4 hit;
  vec3 b;
  b = bvPlace(vec4(0.88, 0.27, 0.021, 0.0), vec4(0.62, 0.25, 0.017, 0.0), 0.12, 260.0, 0.32);
  hit = bvBalloon(p, b, vec3(0.42, 0.62, 0.95), vec3(0.95, 0.92, 0.88), 10.0);
  if (hit.a > 0.5 && depth > 10.0) {
    col = hit.rgb;
    depth = 10.0;
    accent = bvAccent;
  }
  b = bvPlace(vec4(0.24, 0.9, 0.016, 0.0), vec4(3.0, 0.93, 0.013, 0.0), 0.0, 1.0, 0.7);
  hit = bvBalloon(p, b, vec3(0.9, 0.3, 0.3), vec3(0.98, 0.9, 0.8), 12.0);
  if (hit.a > 0.5 && depth > 12.0) {
    col = hit.rgb;
    depth = 12.0;
    accent = bvAccent;
  }
  b = bvPlace(vec4(-0.36, 0.82, 0.028, 0.0), vec4(-0.78, 0.94, 0.018, 0.0), 0.0, 1.0, 0.15);
  hit = bvBalloon(p, b, vec3(0.98, 0.78, 0.3), vec3(0.55, 0.3, 0.62), 6.0);
  if (hit.a > 0.5 && depth > 6.0) {
    col = hit.rgb;
    depth = 6.0;
    accent = bvAccent;
  }
  b = bvPlace(vec4(0.66, 0.6, 0.042, 0.0), vec4(0.6, 0.86, 0.03, 0.0), 0.1, 200.0, 0.6);
  hit = bvBalloon(p, b, vec3(0.25, 0.7, 0.66), vec3(0.98, 0.9, 0.74), 4.0);
  if (hit.a > 0.5 && depth > 4.0) {
    col = hit.rgb;
    depth = 4.0;
    accent = bvAccent;
  }
  b = bvPlace(vec4(-0.72, 0.63, 0.095, 0.0), vec4(-0.3, 0.81, 0.058, 0.0), 0.0, 1.0, 0.0);
  hit = bvBalloon(p, b, vec3(0.95, 0.28, 0.22), vec3(1.0, 0.72, 0.28), 1.5);
  if (hit.a > 0.5 && depth > 1.5) {
    col = hit.rgb;
    depth = 1.5;
    accent = bvAccent;
  }

  col = clamp(col, 0.0, 1.0);
  // Like ink on paper: the dot grows with how far the colour is from the
  // cream, so near-paper sky is the faintest dots, and the focal lights get
  // their accent on top.
  float ink = length((col - BV_PAPER) * vec3(1.0, 1.15, 0.85));
  float tone = clamp(0.05 + 0.88 * pow(min(ink / 0.8, 1.0), 1.1) + accent, 0.0, 1.0);
  tone *= sqrt(bvIntensity);
  bvCacheUv = uv;
  bvCacheT = t;
  // Intensity fades the colours back into the paper.
  bvCacheValue = vec4(mix(BV_PAPER, col, bvIntensity), tone);
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

// Modes that paint the scene's own colours print on its cream paper in
// both themes; mono and palette keep the theme's paper. Matches BV_PAPER.
const DAWN = "#f6efe6";
const DAWN_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Duotone on the cream: from paper-coloured specks to slate-blue ink.
const INK_RAMP = ["#e9ddcc", "#a9b7cf", "#5c719c", "#2e3f68"] as const;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #c4d5ee 0%, #ecebe8 40%, #fbe7cf 62%, #b8c6de 72%, #8fa3c4 100%)",
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
   * Paper behind the glyphs. Default: the scene's warm cream in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from faint to strong. Default: cream to slate-blue ink. */
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
 * Early morning over a river valley, printed on cream. Cool blue ridges
 * fade into the haze, pale gold mist pools in the valley and the river
 * catches the low sun,
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
      ramp={ramp ?? (mode === "duotone" ? INK_RAMP : undefined)}
      paper={paper ?? (DAWN_MODES.has(mode) ? DAWN : undefined)}
      cell={cell}
      square={square}
      dither={dither}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
