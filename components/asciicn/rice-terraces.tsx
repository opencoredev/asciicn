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
const float RT_SUN_R = 0.038;

// Set once per sample by rtScene and read by every layer.
float rtT;
float rtAspect;
float rtSh;
float rtSw;
float rtSunX;
float rtSunY;
// The crest of the hill being drawn, so its terraces can follow it round.
float rtCrest;

// A fresh dawn: slate overhead, silver and cream at the horizon, silver-blue
// water, green-gold grass on the banks, dark olive earth. Shadow keys sit
// just above the paper so dark areas read as quiet air.
const vec3 RT_ZENITH = vec3(0.1, 0.15, 0.24);
const vec3 RT_SLATE = vec3(0.22, 0.32, 0.44);
const vec3 RT_BLUE = vec3(0.44, 0.58, 0.7);
const vec3 RT_SILVER = vec3(0.74, 0.82, 0.86);
const vec3 RT_CREAM = vec3(0.96, 0.92, 0.78);
const vec3 RT_GOLD = vec3(1.0, 0.86, 0.58);
const vec3 RT_SUN = vec3(1.0, 0.97, 0.88);
const vec3 RT_MIST = vec3(0.68, 0.76, 0.8);
const vec3 RT_SHADOW = vec3(0.07, 0.11, 0.12);
const vec3 RT_EARTH = vec3(0.17, 0.15, 0.1);
const vec3 RT_GRASS = vec3(0.66, 0.72, 0.38);
const vec3 RT_RICE = vec3(0.5, 0.58, 0.3);

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

// The dawn sky by height, from cream at the ridges to slate overhead.
vec3 rtSkyRamp(float y) {
  float v = clamp((y - 0.55) / 0.45, 0.0, 1.0);
  vec3 c = mix(RT_CREAM, RT_SILVER, smoothstep(0.0, 0.16, v));
  c = mix(c, RT_BLUE, smoothstep(0.12, 0.42, v));
  c = mix(c, RT_SLATE, smoothstep(0.38, 0.72, v));
  return mix(c, RT_ZENITH, smoothstep(0.66, 1.0, v));
}

// The sun's bloom, wide and soft.
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
  float warm = 0.7 + 0.3 * rtSunward(p, 0.7);
  vec3 c = mix(RT_ZENITH, rtSkyRamp(y), warm * (1.0 - 0.15 * v));
  c = mix(c, RT_GOLD, clamp(halo * 0.7, 0.0, 1.0));
  // Faint specks overhead, a soft wash of small dots along the glow. Only
  // the sun's tight core grows the dots; the wide bloom is colour alone.
  vec2 sd = (p - vec2(rtSunX, rtSunY)) * vec2(0.6, 1.0);
  float core = exp(-length(sd) / 0.05);
  // A bright silver band along the horizon, so the morning reads fresh.
  // It rises clear of the ridges and breaks into soft drifts, so it never
  // draws a ruled line.
  float drift = fbm(vec2(x * 2.2 + rtT * 0.006, y * 12.0)) + 0.25;
  float tone = 0.05 + 0.15 * exp(-v / 0.22) * warm + (0.1 + 0.16 * rtSunward(p, 0.4 * clamp(rtAspect / 1.6, 0.3, 1.0))) * exp(-abs(v - 0.18) / 0.1) * smoothstep(0.35, 0.85, drift) + 0.14 * exp(-v / 0.12) * rtSunward(p, 0.55) + 0.12 * halo + 0.55 * core;
  // Thin high cloud, silver, gilded only near the sun.
  float band = smoothstep(0.72, 0.8, y) * (1.0 - smoothstep(0.9, 0.97, y));
  float n = fbm(vec2(x * 1.2 + rtT * 0.004, y * 12.0));
  float cloud = smoothstep(0.55, 0.75, n) * band;
  float lit = clamp(rtSunward(p, 0.45) + halo, 0.0, 1.0);
  c = mix(c, mix(RT_SILVER, RT_GOLD, lit), cloud * (0.3 + 0.5 * lit));
  tone += cloud * (0.03 + 0.16 * lit);
  // The sky thins toward the zenith: many cells there are left empty.
  float keep = mix(1.0, 0.4, smoothstep(0.2, 0.85, v)) + core + cloud;
  if (rtHash(s + 5.3) > keep) {
    tone = 0.0;
  }
  // A few last stars high up, fading into the dawn.
  float h = rtHash(s + 17.0);
  if (v > 0.6 && h > 0.996) {
    float tw = 0.7 + 0.3 * sin(rtT * (0.4 + h) + rtHash(s) * 30.0);
    c = mix(c, vec3(0.9, 0.94, 1.0), 0.6 * tw);
    tone = max(tone, 0.3 * tw);
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

// A ridgeline over the scene's x. detail scales the fine noise, so far
// layers keep only their broad shape.
float rtRidge(float x, float seed, float base, float amp, float detail) {
  float n = 0.55 * rtFold(x * 1.3 + seed) + 0.26 * rtFold(x * 3.1 + seed * 2.3) + 0.12 * rtFold(x * 7.3 + seed * 1.7);
  n += detail * (0.08 * snoise(vec2(x * 8.0, seed)) + 0.025 * snoise(vec2(x * 19.0, seed + 1.0)));
  return base + amp * n;
}

// One hill layer: faces turned to the sun take its light, faces turned
// away keep the shadow. far, from 0 to 1, flattens the shading, pales the
// colour toward the haze, shrinks the dots and softens the crest.
vec4 rtMountain(vec2 p, float top, float seed, float base, float amp, vec3 shade, float far) {
  float depth = top - p.y;
  float detail = 1.0 - far * 0.85;
  float x = rtX(p.x) + 0.05 * detail * snoise(vec2(rtX(p.x) * 4.0 + seed, depth * 9.0)) + depth * 0.25;
  float w = 0.015 + depth * 0.45;
  float slope = (rtRidge(x + w, seed, base, amp, detail) - rtRidge(x - w, seed, base, amp, detail)) / (2.0 * w);
  float toward = p.x < rtSunX ? 1.0 : -1.0;
  float gully = snoise(vec2(x * 7.0 - depth * 6.0 * sign(slope), seed + depth * 2.0));
  float lit = smoothstep(-0.1, 1.1, 0.5 - slope * toward * 1.6 + 0.2 * gully * detail);
  lit = mix(lit, 0.4, far * 0.7);
  lit *= 0.45 + 0.55 * rtSunward(p, 0.9);
  vec3 face = mix(shade, vec3(0.62, 0.66, 0.56), lit * (0.6 - 0.35 * far));
  // A thin rim of light on the crest, only close to the sun, narrower on
  // tall boxes so no bright edge crosses a phone's headline.
  float rim = (1.0 - smoothstep(0.0, 1.2 * rtSh, depth)) * rtSunward(p, 0.35 * clamp(rtAspect / 1.6, 0.3, 1.0)) * detail;
  face = mix(face, RT_CREAM, rim * 0.6);
  float foot = smoothstep(0.03, 0.14, depth);
  vec3 air = mix(rtSkyRamp(top + 0.02), RT_MIST, 0.5);
  face = mix(face, air, clamp(far * 0.6 + foot * 0.35, 0.0, 0.85));
  float tone = mix(0.22 + 0.24 * lit, 0.1 + 0.04 * lit, far) + rim * 0.3 + foot * 0.05;
  // Soft crests: over the top rows cells thin out at random, wider on the
  // far layers, so distant edges dissolve into the sky.
  float edge = smoothstep(0.0, (2.5 + 5.0 * far) * rtSh, depth);
  float h = rtHash(floor(p / vec2(rtSw, rtSh)) + seed);
  if (h > edge + rim) {
    tone *= 0.35;
  }
  if (h < far * 0.35 * (1.0 - rim)) {
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

// Mist colour: silver, warming a little under the sun.
vec3 rtMistColor(vec2 p) {
  return mix(RT_MIST, vec3(0.92, 0.88, 0.74), rtSunward(p, 0.3));
}

// The terraced hill: crest high on the left, falling to the right.
float rtNearCrest(float x) {
  return 0.29 + 0.3 * smoothstep(0.35, -0.95, x) + 0.025 * snoise(vec2(x * 2.4, 2.0)) + 0.008 * snoise(vec2(x * 9.0, 5.0));
}

// The middle hill: a rounded spur on the right, its feet in the mist.
float rtMidCrest(float x) {
  return 0.35 + 0.17 * exp(-pow((x - 0.62) / 0.3, 2.0)) + 0.02 * snoise(vec2(x * 4.0, 9.0)) + 0.008 * snoise(vec2(x * 13.0, 4.0));
}

// The dark ridge in the very front, higher on the left.
float rtFrontCrest(float x) {
  return 0.07 + 0.08 * smoothstep(0.1, -0.9, x) + 0.015 * snoise(vec2(x * 5.0, 21.0)) + 0.005 * snoise(vec2(x * 22.0, 3.0));
}

// A hill's contour height. Terraces follow the hill round: they climb with
// the crest, bow toward the viewer over each spur and tuck back into each
// gully, more strongly near the foot.
float rtContour(vec2 p, vec4 bows) {
  float x = rtX(p.x);
  float near = 1.0 - smoothstep(0.0, bows.w, p.y);
  float e = mix(p.y, p.y * bows.w * 1.4 / max(rtCrest, 0.05), 0.5);
  e += bows.x * (0.35 + 0.65 * near) * exp(-pow((x - bows.y) / bows.z, 2.0));
  e += (0.03 + 0.07 * near) * sin(x * 4.2 + bows.y * 5.0) + 0.035 * near * sin(x * 8.3 + 1.3);
  e += 0.007 * snoise(vec2(x * 7.0, p.y * 5.0));
  return e;
}

// Shifts each terrace edge by its own amount, so widths vary level to
// level, and wobbles it along the hill, so no bank runs dead straight.
float rtEdge(float k, float x) {
  return 0.38 * (rtHash(vec2(k, 11.0)) - 0.5) + 0.07 * snoise(vec2(x * 9.0, k * 3.1)) + 0.03 * snoise(vec2(x * 23.0, k * 1.7));
}

// Terraces on a hill. From the near edge up, each level is a flooded field,
// then the earthen retaining wall of the level above, then that wall's lit
// grassy top edge. Bunds split each level into separate fields, and each
// field holds its own reflection. On thin, far levels the wall drops out.
vec4 rtTerraces(vec2 s, vec2 p, vec4 bows, float top, float count, float haze, float split) {
  float g = pow(clamp(rtContour(p, bows) / top, 0.0, 1.2), 1.2) * count;
  float g2 = pow(clamp(rtContour(p + vec2(0.0, rtSh), bows) / top, 0.0, 1.2), 1.2) * count;
  float x = rtX(p.x);
  float k = floor(g);
  if (g < k + rtEdge(k, x)) {
    k -= 1.0;
  } else if (g >= k + 1.0 + rtEdge(k + 1.0, x)) {
    k += 1.0;
  }
  float lo = k + rtEdge(k, x);
  float hi = k + 1.0 + rtEdge(k + 1.0, x);
  float f = (g - lo) / (hi - lo);
  float rows = (hi - lo) / max(g2 - g, 1e-3);
  float into = f * rows;
  float left = rows - into;
  float e = g / count;
  float bandY = p.y + (0.5 - f) * rows * rtSh;
  float sunPath = rtSunward(p, mix(0.05, 0.14, clamp(1.0 - bandY / 0.6, 0.0, 1.0)) * clamp(rtAspect / 1.6, 0.45, 1.0));
  // The hill's own shadow lies over the lowest levels.
  float shade = 1.0 - smoothstep(0.04, 0.36, bandY);
  float wallRows = rows < 3.5 ? 0.0 : clamp(rows * 0.3, 1.0, 4.0);

  // The lit top edge: grass on the bank catching the low sun.
  if (left < 1.0) {
    float h = rtHash(s + vec2(k, 13.0));
    vec3 c = mix(RT_GRASS, RT_GOLD, 0.35 * sunPath + 0.2 * h);
    c *= 1.0 - 0.35 * shade;
    c = mix(c, rtMistColor(p) * 0.85, haze);
    float tone = 0.86 + 0.15 * sunPath - 0.12 * shade - 0.2 * smoothstep(0.38, 0.62, bandY);
    tone = h < 0.12 ? tone * 0.5 : tone;
    return vec4(c, mix(tone, 0.14, haze));
  }
  // Fields end at irregular lengths. Where one ends, its top edge curves
  // down onto the bank below, so each field closes in a rounded, tapering
  // tip and the bank shows between it and the next.
  float col = floor(s.x / rtGrid.x);
  float span = floor(mix(34.0, 18.0, clamp(e, 0.0, 1.0)) * (0.7 + 0.6 * rtHash(vec2(k, 5.0))));
  float offset = floor(rtHash(vec2(k, 2.0)) * span);
  float slot = floor((col + offset) / span);
  float u = mod(col + offset, span) + 0.5;
  float toLeft = rtHash(vec2(k, slot)) < split ? u : 1e3;
  float toRight = rtHash(vec2(k, slot + 1.0)) < split ? span - u : 1e3;
  float fieldRows = rows - 1.0 - wallRows;
  float tipLength = max(3.0, fieldRows * 2.4) * (0.8 + 0.5 * rtHash(vec2(k, slot + 9.0)));
  float tip = sqrt(clamp(min(toLeft, toRight) / tipLength, 0.0, 1.0));
  float reach = fieldRows * tip + 0.6 * snoise(vec2(col * 0.4, k * 5.0)) - 0.3;
  if (left < 1.0 + wallRows || into > reach) {
    // The retaining wall: dark earth, a few cells left empty.
    float n = rtHash(s + vec2(k, 7.0));
    vec3 c = mix(RT_SHADOW, RT_EARTH, n);
    c = mix(c, RT_MIST * 0.45, haze);
    return vec4(c, n < 0.25 ? 0.0 : 0.07 + 0.06 * n + haze * 0.06);
  }
  float field = rtHash(vec2(k, slot + 0.5));
  float depthIn = into / max(fieldRows, 1.0);
  if (field < 0.2) {
    // A planted field: young rice, soft green-gold, combed in rows.
    float comb = 0.75 + 0.25 * step(0.5, fract(s.x / rtGrid.x * 0.5));
    vec3 c = mix(RT_RICE, RT_GRASS, 0.3 * sunPath + 0.2 * field / 0.2) * comb;
    c *= 1.0 - 0.35 * shade;
    c = mix(c, rtMistColor(p) * 0.8, haze);
    float tone = 0.36 + 0.1 * comb - 0.1 * shade;
    return vec4(c, mix(tone, 0.1, haze));
  }
  // A flooded field holds the sky at the angle it sees it: near fields the
  // blue overhead, far ones the silver at the horizon, each a little
  // brighter or duller than its neighbour. Along its far edge it mirrors
  // the dark wall standing above it.
  vec3 sky = rtSkyRamp(0.57 + max(0.6 - bandY, 0.0) * 0.4) * (0.92 + 0.3 * field);
  float wallMirror = smoothstep(0.55, 1.0, depthIn);
  float shimmer = fbm(vec2(p.x * 9.0 / max(rtAspect, 0.9) + rtT * 0.03, k * 3.7 + f * 1.5 - rtT * 0.02));
  float glint = sunPath * smoothstep(0.5, 0.75, shimmer);
  vec3 c = mix(sky, RT_SHADOW, wallMirror * 0.55);
  c = mix(c, mix(RT_GOLD, RT_SUN, glint), glint);
  c *= 1.0 - 0.2 * shade;
  c = mix(c, rtMistColor(p) * 0.8, haze);
  float lum = dot(c, vec3(0.3, 0.55, 0.15));
  // Fields high on the slope mirror the bright horizon; they step down a
  // dot size so the hill's top doesn't flare.
  float high = smoothstep(0.38, 0.56, bandY) * (1.0 - sunPath);
  float tone = 0.26 + 0.7 * lum - 0.22 * wallMirror + 0.45 * glint - 0.06 * shade - 0.32 * high;
  tone += 0.03 * sin(p.x * 70.0 / max(rtAspect, 0.9) + rtT * 0.5 + k * 1.7);
  return vec4(c, mix(tone, 0.1, haze));
}

// Clumps of trees along a crest: how far above the ground their tops reach.
float rtTrees(float x, float seed) {
  float clump = smoothstep(0.38, 0.62, fbm(vec2(x * 5.0, seed)));
  float crowns = 0.5 + 0.5 * snoise(vec2(x * 34.0, seed + 2.0));
  return clump * (0.012 + 0.02 * crowns);
}

// The trees: a dark mass with a soft rim where the sun finds it.
vec4 rtTreeColor(vec2 p, float top, float tall, float haze) {
  float rim = (1.0 - smoothstep(0.0, 1.5 * rtSh, top - p.y)) * smoothstep(0.006, 0.016, tall) * rtSunward(p, 0.45 * clamp(rtAspect / 1.6, 0.3, 1.0));
  vec3 c = mix(RT_SHADOW, RT_GRASS, rim * 0.6);
  c = mix(c, RT_MIST * 0.5, haze);
  return vec4(c, 0.1 + 0.4 * rim + 0.1 * haze);
}

// One tree on the front ridge: a slim trunk under a ragged crown.
float rtLoneTree(vec2 q, float base, float height, float spread, float seed) {
  float trunk = step(abs(q.x), 0.5 * rtSw * rtGrid.x + 0.002) * step(base, q.y) * step(q.y, base + height * 0.7);
  // Two overlapping lobes, so the crown reads as a tree, not a ball.
  vec2 c = (q - vec2(0.0, base + height * 0.78)) / vec2(spread, height * 0.3);
  vec2 c2 = (q - vec2(spread * 0.7, base + height * 0.62)) / vec2(spread * 0.7, height * 0.22);
  float ragged = 0.2 * snoise(q * 22.0 + seed) + 0.08 * snoise(q * 60.0 - seed);
  float crown = max(step(length(c) + ragged, 1.0), step(length(c2) + ragged, 1.0));
  return max(trunk, crown);
}

// The front ridge: dark ground with sparse grass and a few trees standing
// against the bright fields behind.
vec4 rtFront(vec2 s, vec2 p, float x, float crest, out float cover) {
  cover = 0.0;
  float wide = smoothstep(0.9, 1.5, rtAspect);
  // Grass tufts: single columns poking a row or two above the crest.
  float colId = floor(s.x / rtGrid.x);
  float tuft = rtHash(vec2(colId, 4.0));
  float grass = tuft > 0.82 ? (1.0 + floor(tuft * 10.0 - 8.2) * 1.4) * rtSh : 0.0;
  float tree = 0.0;
  // The tall tree moves in on narrow boxes, so a phone keeps it in frame.
  tree = max(tree, rtLoneTree(vec2(x + mix(0.28, 0.62, wide), p.y), crest - 0.01, 0.26, 0.06, 1.0));
  tree = max(tree, rtLoneTree(vec2(x + 0.36, p.y), crest - 0.01, 0.16, 0.04, 4.0) * wide);
  tree = max(tree, rtLoneTree(vec2(x - 0.5, p.y), rtFrontCrest(0.5) - 0.01, 0.1, 0.03, 7.0));
  if (p.y > crest + grass && tree < 0.5) {
    return vec4(0.0);
  }
  cover = 1.0;
  // A green-gold rim along the crest where the low sun catches the grass;
  // the trees stay pure silhouettes against the fields behind.
  float rim = (1.0 - smoothstep(0.0, 1.5 * rtSh, abs(p.y - crest))) * (1.0 - tree) * 0.7;
  float n = rtHash(s + 31.0);
  // Sparse grass catches a little light, so the ridge isn't a black slab.
  vec3 c = mix(RT_SHADOW, mix(RT_EARTH, RT_RICE * 0.6, step(0.7, n)), n);
  c = mix(c, RT_GRASS * 0.85, step(0.5, rim) * (0.55 + 0.45 * rtSunward(p, 0.8)));
  float sun = 0.4 + 0.6 * rtSunward(p, 0.8);
  return vec4(c, rim > 0.5 ? 0.5 + 0.3 * sun : (n < 0.3 ? 0.0 : 0.08 + 0.1 * n * step(0.7, n) + 0.04 * n));
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
  float frontCrest = rtFrontCrest(x);
  float frontCover;
  vec4 front = rtFront(s, p, x, frontCrest, frontCover);
  float nearCrest = rtNearCrest(x);
  float nearTall = rtTrees(x, 1.0);
  float nearTrees = nearCrest + nearTall;
  if (frontCover > 0.5) {
    hit = front;
  } else if (p.y < nearTrees && p.y > nearCrest - 0.016) {
    hit = rtTreeColor(p, nearTrees, nearTall, 0.0);
  } else if (p.y < nearCrest) {
    rtCrest = nearCrest;
    hit = rtTerraces(s, p, vec4(0.12, -0.3, 0.2, 0.3), 0.66, 11.0, 0.0, 0.6);
    // Wisps of mist curl over the upper terraces.
    float m = rtMist(p, nearCrest - 0.1, nearCrest + 0.04) * 0.3;
    hit.rgb = mix(hit.rgb, rtMistColor(p), m);
  } else {
    float midCrest = rtMidCrest(x);
    float r1 = rtRidge(x, 3.0, 0.43, 0.13, 0.7);
    float r2 = rtRidge(x, 7.0, 0.5, 0.12, 0.6);
    float r3 = rtRidge(x, 13.0, 0.56, 0.1, 0.45);
    float midTall = rtTrees(x, 6.0) * 0.8;
    float midTrees = midCrest + midTall;
    if (p.y < midTrees && p.y > midCrest - 0.012) {
      hit = rtTreeColor(p, midTrees, midTall, 0.45);
    } else if (p.y < midCrest) {
      rtCrest = midCrest;
      hit = rtTerraces(s, p, vec4(0.05, 0.62, 0.15, 0.25), 0.56, 9.0, 0.5, 0.4);
    } else if (p.y < r1) {
      hit = rtMountain(p, r1, 3.0, 0.43, 0.13, vec3(0.13, 0.19, 0.24), 0.15);
    } else if (p.y < r2) {
      hit = rtMountain(p, r2, 7.0, 0.5, 0.12, vec3(0.24, 0.32, 0.4), 0.5);
    } else if (p.y < r3) {
      hit = rtMountain(p, r3, 13.0, 0.56, 0.1, vec3(0.4, 0.48, 0.56), 0.85);
    } else {
      hit = rtSky(s, p);
      if (rtBird(s) > 0.5) {
        // An egret, its back catching the first light.
        hit = vec4(0.96, 0.95, 0.88, 0.7);
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
const DAWN_PAPER = "#0d1a22";
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
        "linear-gradient(to bottom, #111c2a 0%, #2c3e52 25%, #8fa6b4 40%, #d8d2b4 44%, #4a5a62 52%, #1a2622 75%, #0a1419 100%)",
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
   * Paper behind the glyphs. Default: the scene's deep slate in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"heliograph"`, slate through blue to silver. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dawn as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the scene never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Flooded rice terraces at dawn. Curved steps of water sweep down a
 * hillside, each field mirroring the silver-blue sky between dark earthen
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
      ramp={ramp ?? (mode === "duotone" ? "heliograph" : undefined)}
      paper={paper ?? (DAWN_MODES.has(mode) ? DAWN_PAPER : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
