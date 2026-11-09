"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted back to front on the engine's sample grid: `p` is a
// sample centre in square units (x 0..aspect, y 0..1 up), and `rtX` is a
// horizontal scene coordinate that spans about -0.8..0.8 on a wide box and
// the middle -0.4..0.4 on a phone, so the hills stay centred in any crop.
// Every layer returns a colour and a tone; the tone picks the dot size.
const SCENE = `
const float RT_SUN_R = 0.04;

// Set once per sample by rtScene and read by every layer.
float rtT;
float rtAspect;
float rtSh;
float rtSw;
float rtSunX;
float rtSunY;
// The crest of the hill being drawn, so its terraces can follow it round.
float rtCrest;

// A small palette. Shadow keys sit just above the paper so dark areas read
// as quiet air; only the sun, its glitter and the pool lips run bright.
const vec3 RT_ZENITH = vec3(0.1, 0.1, 0.22);
const vec3 RT_VIOLET = vec3(0.24, 0.2, 0.38);
const vec3 RT_MAUVE = vec3(0.5, 0.32, 0.5);
const vec3 RT_ROSE = vec3(0.84, 0.47, 0.52);
const vec3 RT_PEACH = vec3(0.96, 0.65, 0.48);
const vec3 RT_GOLD = vec3(1.0, 0.82, 0.55);
const vec3 RT_SUN = vec3(1.0, 0.95, 0.8);
const vec3 RT_MIST = vec3(0.72, 0.62, 0.74);
const vec3 RT_SHADOW = vec3(0.11, 0.1, 0.18);
const vec3 RT_EARTH = vec3(0.14, 0.11, 0.16);

float rtHash(vec2 s) {
  return fract(sin(dot(s, vec2(127.1, 311.7))) * 43758.5453);
}

// The scene's horizontal coordinate for a point in square units.
float rtX(float px) {
  return (px - rtAspect * 0.5) * 1.6 / max(rtAspect, 0.9);
}

// How close a point is to the sun's column, for light that pools under it.
float rtSunward(vec2 p, float width) {
  float dx = (p.x - rtSunX) / width;
  return exp(-dx * dx);
}

// The dawn sky by height, from gold at the ridges to indigo overhead.
vec3 rtSkyRamp(float y) {
  float v = clamp((y - 0.55) / 0.45, 0.0, 1.0);
  vec3 c = mix(RT_GOLD, RT_PEACH, smoothstep(0.0, 0.12, v));
  c = mix(c, RT_ROSE, smoothstep(0.08, 0.28, v));
  c = mix(c, RT_MAUVE, smoothstep(0.24, 0.48, v));
  c = mix(c, RT_VIOLET, smoothstep(0.42, 0.72, v));
  return mix(c, RT_ZENITH, smoothstep(0.66, 1.0, v));
}

// The sun's halo: a wide warm bloom and a tight bright core.
float rtHalo(vec2 p) {
  vec2 d = (p - vec2(rtSunX, rtSunY)) * vec2(0.6, 1.0);
  float r = length(d);
  return 0.45 * exp(-r / 0.22) + 0.8 * exp(-r / 0.055);
}

vec4 rtSky(vec2 s, vec2 p) {
  float y = p.y;
  float x = rtX(p.x);
  float halo = rtHalo(p);
  float v = clamp((y - 0.55) / 0.45, 0.0, 1.0);
  // The horizon only warms near the sun; elsewhere the dawn is still dim.
  float warm = 0.6 + 0.4 * rtSunward(p, 0.7);
  vec3 c = mix(RT_ZENITH, rtSkyRamp(y), warm * (1.0 - 0.2 * v));
  c = mix(c, RT_GOLD, clamp(halo * 0.8, 0.0, 1.0));
  // Faint specks overhead, a little larger along the glow. Only the sun's
  // tight core grows the dots; the wide bloom is colour alone.
  vec2 sd = (p - vec2(rtSunX, rtSunY)) * vec2(0.6, 1.0);
  float core = exp(-length(sd) / 0.05);
  // The glow above the ridges is a soft wash of small dots, warmest under the sun.
  float tone = 0.05 + 0.1 * exp(-v / 0.2) * warm + 0.1 * exp(-v / 0.12) * rtSunward(p, 0.45) + 0.12 * halo + 0.55 * core;
  // Thin clouds, lit only where the sun reaches them.
  float band = smoothstep(0.72, 0.8, y) * (1.0 - smoothstep(0.9, 0.97, y));
  float n = fbm(vec2(x * 1.2 + rtT * 0.004, y * 12.0));
  float cloud = smoothstep(0.55, 0.75, n) * band;
  float lit = clamp(rtSunward(p, 0.45) + halo, 0.0, 1.0);
  c = mix(c, mix(RT_MAUVE, RT_PEACH, lit), cloud * (0.35 + 0.5 * lit));
  tone += cloud * (0.03 + 0.16 * lit);
  // The sky thins toward the zenith: many cells there are left empty.
  float keep = mix(1.0, 0.4, smoothstep(0.15, 0.85, v)) + core + cloud;
  if (rtHash(s + 5.3) > keep) {
    tone = 0.0;
  }
  // A few last stars high up, fading into the dawn.
  float h = rtHash(s + 17.0);
  if (v > 0.6 && h > 0.996) {
    float tw = 0.7 + 0.3 * sin(rtT * (0.4 + h) + rtHash(s) * 30.0);
    c = mix(c, vec3(0.85, 0.85, 1.0), 0.6 * tw);
    tone = max(tone, 0.32 * tw);
  }
  if (length(p - vec2(rtSunX, rtSunY)) < RT_SUN_R) {
    c = RT_SUN;
    tone = 1.0;
  }
  return vec4(c, tone);
}

// Folded noise: sharp crests, soft valleys.
float rtFold(float v) {
  float r = 1.0 - abs(snoise(vec2(v, v * 0.37 + 3.1)));
  return r * r;
}

// A ridgeline over the scene's x: two scales of crests, then fine noise so
// no edge runs smooth.
float rtRidge(float x, float seed, float base, float amp) {
  float n = 0.6 * rtFold(x * 1.3 + seed) + 0.28 * rtFold(x * 3.1 + seed * 2.3);
  n += 0.08 * snoise(vec2(x * 8.0, seed)) + 0.025 * snoise(vec2(x * 19.0, seed + 1.0));
  return base + amp * n;
}

// One mountain layer: faces turned to the sun take its colour, faces turned
// away keep the shadow, and gullies streak down from the crest. far, from 0
// to 1, compresses everything toward the sky's colour and shrinks the dots.
vec4 rtMountain(vec2 p, float top, float seed, float base, float amp, vec3 shade, float far) {
  float depth = top - p.y;
  // Warp x with depth, so the line between a lit face and a shaded one
  // wanders down the slope instead of dropping straight.
  float x = rtX(p.x) + 0.05 * snoise(vec2(rtX(p.x) * 4.0 + seed, depth * 9.0)) + depth * 0.25;
  float w = 0.015 + depth * 0.45;
  float slope = (rtRidge(x + w, seed, base, amp) - rtRidge(x - w, seed, base, amp)) / (2.0 * w);
  float toward = p.x < rtSunX ? 1.0 : -1.0;
  float gully = snoise(vec2(x * 7.0 - depth * 6.0 * sign(slope), seed + depth * 2.0));
  float lit = smoothstep(-0.1, 1.1, 0.5 - slope * toward * 1.6 + 0.2 * gully);
  lit = mix(lit, 0.4, far * 0.5);
  lit *= 0.45 + 0.55 * rtSunward(p, 0.9);
  vec3 face = mix(shade, mix(RT_MAUVE, RT_PEACH, lit), lit * (0.75 - 0.3 * far));
  // A thin rim of light on the crest, only close to the sun.
  // Narrower on tall boxes, so no bright edge crosses a phone's headline.
  float rim = (1.0 - smoothstep(0.0, 1.2 * rtSh, depth)) * rtSunward(p, 0.35 * clamp(rtAspect / 1.6, 0.3, 1.0));
  face = mix(face, RT_PEACH, rim * 0.7);
  // Haze: far layers and every layer's foot fade toward the valley mist.
  float foot = smoothstep(0.03, 0.14, depth);
  vec3 air = mix(rtSkyRamp(top + 0.02), RT_MIST, 0.5);
  face = mix(face, air, clamp(far * 0.55 + foot * 0.35, 0.0, 0.85));
  float tone = mix(0.22 + 0.24 * lit, 0.12 + 0.05 * lit, far) + rim * 0.3 + foot * 0.05;
  // Soft crests: over the top rows cells thin out at random, wider on the
  // far layers, so distant edges dissolve into the sky instead of cutting it.
  float edge = smoothstep(0.0, (2.5 + 4.0 * far) * rtSh, depth);
  float h = rtHash(floor(p / vec2(rtSw, rtSh)) + seed);
  if (h > edge + rim) {
    tone *= 0.35;
  }
  // Far layers are sparse: some cells hold nothing at all.
  if (h < far * 0.3 * (1.0 - rim)) {
    tone = 0.0;
  }
  return vec4(face, tone);
}

// Valley mist: long banks torn into wisps, drifting along the valley.
float rtMist(vec2 p, float lo, float hi) {
  float x = rtX(p.x);
  float n = fbm(vec2(x * 1.8 - rtT * 0.01, p.y * 13.0 + rtT * 0.002));
  float mid = (lo + hi) * 0.5;
  float profile = 1.0 - smoothstep(0.0, (hi - lo) * 0.5, abs(p.y - mid));
  return clamp(profile * smoothstep(0.3, 0.72, n) * 1.2, 0.0, 1.0);
}

// Mist colour: pale lilac, warming to gold under the sun.
vec3 rtMistColor(vec2 p) {
  return mix(RT_MIST, vec3(0.95, 0.8, 0.66), rtSunward(p, 0.3));
}

// The foreground hill: crest high on the left, falling to the right.
float rtNearCrest(float x) {
  return 0.27 + 0.3 * smoothstep(0.35, -0.95, x) + 0.025 * snoise(vec2(x * 2.4, 2.0)) + 0.008 * snoise(vec2(x * 9.0, 5.0));
}

// The middle hill: a rounded spur on the right, its feet in the mist.
float rtMidCrest(float x) {
  return 0.33 + 0.18 * exp(-pow((x - 0.62) / 0.3, 2.0)) + 0.012 * snoise(vec2(x * 4.0, 9.0)) + 0.005 * snoise(vec2(x * 15.0, 2.0));
}

// A hill's contour height. Terraces follow the hill round: they bow toward
// the viewer over each spur and tuck back into each gully, more strongly
// near the foot, where the hill is closest.
float rtContour(vec2 p, vec4 bows) {
  float x = rtX(p.x);
  float near = 1.0 - smoothstep(0.0, bows.w, p.y);
  // Partly level, partly scaled to the crest: high ground carries its
  // terraces up with it, the way they wrap a real hillside.
  float e = mix(p.y, p.y * bows.w * 1.4 / max(rtCrest, 0.05), 0.5);
  e += bows.x * (0.35 + 0.65 * near) * exp(-pow((x - bows.y) / bows.z, 2.0));
  e += (0.03 + 0.07 * near) * sin(x * 4.2 + bows.y * 5.0) + 0.035 * near * sin(x * 8.3 + 1.3);
  e += 0.007 * snoise(vec2(x * 7.0, p.y * 5.0));
  return e;
}

// Shifts each terrace edge by its own amount, so widths vary band to band.
float rtEdge(float k) {
  return 0.38 * (rtHash(vec2(k, 11.0)) - 0.5);
}

// Terraces on a hill. Each basin is a dark earthen wall at its near edge,
// a narrow bright lip where the water meets it, and a darker pool behind
// that deepens toward the wall above. top is the contour of the highest
// band; split sets how often a bund closes a basin off.
vec4 rtTerraces(vec2 s, vec2 p, vec4 bows, float top, float count, float haze, float split) {
  float g = pow(clamp(rtContour(p, bows) / top, 0.0, 1.2), 1.2) * count;
  float g2 = pow(clamp(rtContour(p + vec2(0.0, rtSh), bows) / top, 0.0, 1.2), 1.2) * count;
  float k = floor(g);
  if (g < k + rtEdge(k)) {
    k -= 1.0;
  } else if (g >= k + 1.0 + rtEdge(k + 1.0)) {
    k += 1.0;
  }
  float lo = k + rtEdge(k);
  float hi = k + 1.0 + rtEdge(k + 1.0);
  float f = (g - lo) / (hi - lo);
  float rows = (hi - lo) / max(g2 - g, 1e-3);
  float into = f * rows;
  float e = g / count;
  float bandY = p.y + (0.5 - f) * rows * rtSh;
  float sunPath = rtSunward(p, mix(0.05, 0.14, clamp(1.0 - bandY / 0.6, 0.0, 1.0)) * clamp(rtAspect / 1.6, 0.45, 1.0));
  // The near hill's own shadow: the light gathers toward the far terraces.
  float shade = 1.0 - smoothstep(0.02, 0.36, bandY);

  // Bunds close the basins off at irregular lengths.
  float col = floor(s.x / rtGrid.x);
  float span = floor(mix(34.0, 18.0, clamp(e, 0.0, 1.0)) * (0.7 + 0.6 * rtHash(vec2(k, 5.0))));
  float offset = floor(rtHash(vec2(k, 2.0)) * span);
  float slot = floor((col + offset) / span);
  bool bund = mod(col + offset, span) < 0.5 && rtHash(vec2(k, slot)) < split;

  if (into < 1.0 || bund) {
    // The wall: quiet dark earth, a few cells left empty.
    float n = rtHash(s + vec2(k, 7.0));
    vec3 c = mix(RT_SHADOW, RT_EARTH, n);
    c = mix(c, RT_MIST * 0.45, haze);
    return vec4(c, n < 0.25 ? 0.0 : 0.06 + 0.05 * n + haze * 0.1);
  }
  // Near pools look down steeply and mirror the high sky; far ones the glow.
  vec3 sky = rtSkyRamp(0.56 + max(0.6 - bandY, 0.0) * 0.4);
  sky *= 0.88 + 0.2 * rtHash(vec2(k, 3.1));
  float shimmer = fbm(vec2(p.x * 9.0 / max(rtAspect, 0.9) + rtT * 0.03, k * 3.7 + f * 1.5 - rtT * 0.02));
  float glint = sunPath * smoothstep(0.5, 0.75, shimmer);
  if (into < 2.0) {
    // The lip: one row of water catching the light at the wall's edge.
    vec3 c = mix(sky, RT_GOLD, 0.2 + 0.25 * clamp(bandY / 0.5, 0.0, 1.0) + 0.5 * sunPath);
    c = mix(c, RT_SUN, glint);
    c *= 1.0 - 0.2 * shade;
    c = mix(c, rtMistColor(p), haze);
    // Full dots for the near lips; higher up the slope they shrink a step.
    float tone = 0.82 + 0.2 * sunPath + 0.1 * glint - 0.1 * shade - 0.2 * smoothstep(0.36, 0.6, bandY) * (1.0 - sunPath);
    return vec4(c, mix(tone, 0.15, haze));
  }
  // The body: the same sky, darker, deepening toward the far wall's mirror.
  float deep = smoothstep(0.35, 1.0, f);
  vec3 c = mix(sky * 0.85, RT_SHADOW, deep * 0.55);
  c = mix(c, mix(RT_GOLD, RT_SUN, glint), glint);
  c *= 1.0 - 0.3 * shade;
  c = mix(c, rtMistColor(p) * 0.8, haze);
  float tone = 0.46 - 0.18 * deep + 0.5 * glint - 0.08 * shade;
  tone += 0.03 * sin(p.x * 70.0 / max(rtAspect, 0.9) + rtT * 0.5 + k * 1.7);
  return vec4(c, mix(tone, 0.1, haze));
}

// Clumps of trees along a crest: how far above the ground their tops reach.
float rtTrees(float x, float seed) {
  float clump = smoothstep(0.38, 0.62, fbm(vec2(x * 5.0, seed)));
  float crowns = 0.5 + 0.5 * snoise(vec2(x * 34.0, seed + 2.0));
  return clump * (0.012 + 0.02 * crowns);
}

// The trees: a dark mass with a warm rim where the sun finds it.
vec4 rtTreeColor(vec2 p, float top, float tall, float haze) {
  float rim = (1.0 - smoothstep(0.0, 1.5 * rtSh, top - p.y)) * smoothstep(0.006, 0.016, tall) * rtSunward(p, 0.45 * clamp(rtAspect / 1.6, 0.3, 1.0));
  vec3 c = mix(RT_SHADOW, RT_PEACH, rim * 0.7);
  c = mix(c, RT_MIST * 0.5, haze);
  return vec4(c, 0.1 + 0.4 * rim + 0.1 * haze);
}

// One far bird gliding across the sky, with a slow flap now and then.
float rtBird(vec2 s) {
  if (rtBirdOn < 0.5) {
    return 0.0;
  }
  float span = rtAspect + 0.3;
  float bx = mod(rtT * 0.009 + 0.25 * span, span) - 0.15;
  float by = 0.82 + 0.015 * sin(rtT * 0.07);
  vec2 cell = floor(s / rtGrid);
  vec2 home = floor(vec2(bx / rtSw, by / rtSh) / rtGrid);
  vec2 d = cell - home;
  float ax = abs(d.x);
  bool flap = fract(rtT * 0.18) < 0.12;
  // Gliding, the wings are one level line; on the flap the tips lift a row.
  bool body = d.y == 0.0 && ax < (flap ? 1.5 : 2.5);
  bool tips = flap && d.y == 1.0 && ax > 1.5 && ax < 2.5;
  return body || tips ? 1.0 : 0.0;
}

vec2 rtCacheUv = vec2(-1.0);
float rtCacheT = -1.0;
vec4 rtCacheValue = vec4(0.0);

vec4 rtScene(vec2 uv, vec2 res, float t) {
  if (uv == rtCacheUv && t == rtCacheT) {
    return rtCacheValue;
  }
  rtAspect = res.x / res.y;
  rtSh = 1.0 / res.y;
  rtSw = rtAspect / max(ascii_samples.x, 1.0);
  rtT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  vec2 p = (s + 0.5) * vec2(rtSw, rtSh);
  // Upper right on wide boxes, clear of a centred headline; on tall boxes
  // centred and high, above it.
  float wide = smoothstep(0.9, 1.5, rtAspect);
  rtSunX = rtAspect * mix(0.5, 0.79, wide);
  rtSunY = mix(0.8, 0.75, wide);
  float x = rtX(p.x);

  vec4 hit;
  float nearCrest = rtNearCrest(x);
  float nearTall = rtTrees(x, 1.0);
  float nearTrees = nearCrest + nearTall;
  if (p.y < nearTrees && p.y > nearCrest - 0.016) {
    hit = rtTreeColor(p, nearTrees, nearTall, 0.0);
  } else if (p.y < nearCrest) {
    rtCrest = nearCrest;
    hit = rtTerraces(s, p, vec4(0.12, -0.3, 0.2, 0.3), 0.66, 12.0, 0.0, 0.55);
    // Wisps of mist curl over the upper terraces.
    float m = rtMist(p, nearCrest - 0.1, nearCrest + 0.04) * 0.3;
    hit.rgb = mix(hit.rgb, rtMistColor(p), m);
  } else {
    float midCrest = rtMidCrest(x);
    float r1 = rtRidge(x, 3.0, 0.43, 0.13);
    float r2 = rtRidge(x, 7.0, 0.5, 0.12);
    float r3 = rtRidge(x, 13.0, 0.56, 0.1);
    float midTall = rtTrees(x, 6.0) * 0.8;
    float midTrees = midCrest + midTall;
    if (p.y < midTrees && p.y > midCrest - 0.012) {
      hit = rtTreeColor(p, midTrees, midTall, 0.35);
    } else if (p.y < midCrest) {
      rtCrest = midCrest;
      hit = rtTerraces(s, p, vec4(0.05, 0.62, 0.15, 0.25), 0.56, 10.0, 0.45, 0.4);
    } else if (p.y < r1) {
      hit = rtMountain(p, r1, 3.0, 0.43, 0.13, vec3(0.18, 0.17, 0.34), 0.0);
    } else if (p.y < r2) {
      hit = rtMountain(p, r2, 7.0, 0.5, 0.12, vec3(0.3, 0.27, 0.48), 0.45);
    } else if (p.y < r3) {
      hit = rtMountain(p, r3, 13.0, 0.56, 0.1, vec3(0.46, 0.4, 0.6), 0.8);
    } else {
      hit = rtSky(s, p);
      if (rtBird(s) > 0.5) {
        // An egret, its back catching the first light.
        hit = vec4(1.0, 0.88, 0.8, 0.7);
      }
    }
    // Mist fills the valley between the hills and the far ridges, soft and
    // low in contrast so the middle of the frame stays calm.
    float m = rtMist(p, 0.28, 0.44);
    hit.rgb = mix(hit.rgb, rtMistColor(p), m * 0.8);
    hit.a = mix(hit.a, 0.24 + 0.22 * rtSunward(p, 0.3), m * 0.8);
  }

  // Intensity dims colour everywhere but shrinks the dots only gently, so
  // the shapes hold; a soft oval in the middle, where a headline sits,
  // quiets further.
  float tone = hit.a < 0.04 ? 0.0 : clamp(hit.a, 0.0, 1.0);
  vec2 calm = (uv - 0.5) / vec2(0.34, 0.24);
  float quiet = (1.0 - rtIntensity) * exp(-dot(calm, calm));
  float dim = mix(0.25, 1.0, rtIntensity) * (1.0 - 0.6 * quiet);
  tone *= mix(0.9, 1.0, rtIntensity) * (1.0 - 0.5 * quiet);
  rtCacheUv = uv;
  rtCacheT = t;
  rtCacheValue = vec4(hit.rgb * dim, tone);
  return rtCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return rtScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return rtScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night-blue paper behind
// them in both themes; mono and palette keep the theme's paper, or the phosphor's.
const DAWN_PAPER = "#0c0d22";
const DAWN_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #1a1d44 0%, #4a3a6e 25%, #b8687a 38%, #e8a070 42%, #6a5a80 50%, #2a2440 70%, #141226 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RiceTerracesProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The one bird gliding far off across the sky. Default `true`. */
  bird?: boolean;
  /** Square cells, so the dots lie on an even halftone lattice. `false` uses the font's tall cells. Default `true`. */
  square?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"outrun"`, indigo through rose to gold. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dawn as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the scene never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Flooded rice terraces at dawn. Curved steps of water sweep down a
 * hillside, each pool mirroring the pink and gold sky between dark earthen
 * walls, while mist drifts through the valley and far ridges fade into
 * haze. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const RiceTerraces = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 0,
  intensity = 1,
  bird = true,
  fallback = FALLBACK,
  // The scene has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: RiceTerracesProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rtBirdOn: bird ? 1 : 0,
        // The samples per glyph, so details keep their size in Braille and quadrants.
        rtGrid: [gx, gy],
        rtIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "outrun" : undefined)}
      paper={paper ?? (DAWN_MODES.has(mode) ? DAWN_PAPER : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
