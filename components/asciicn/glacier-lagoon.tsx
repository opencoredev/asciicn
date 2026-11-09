"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted in colour first and the tone is read back from that
// colour's value, so dot size and dot colour always agree. Positions are in
// square units across the box, squeezed a little on narrow boxes so a phone
// still sees the glacier, the open water and the sun. Features sit at a
// share of the half width (`glacierAt`) and keep their own size, so the
// composition holds from a tall phone to an ultrawide. Rows below the
// horizon are the lagoon: it mirrors the sky, the peaks and the glacier
// about the horizon and each iceberg about its own waterline.
const SCENE = `
const float GLACIER_HORIZON = 0.42;

// Set once per sample by glacierColor and read by every layer.
float glacierT;
float glacierSqueeze;
float glacierHalfW;
float glacierScale;
vec2 glacierSun;

// A stable random value for whole-cell inputs. The engine's hash21
// repeats every 50 cells on integers, which would tile the ice chips.
float glacierHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// A share of the half width, from -1 (left edge) to 1 (right edge), as x.
float glacierAt(float f) {
  return f * glacierHalfW;
}

// How close x is to the sun: 1 under it, falling off over true distance.
float glacierSunNear(float x) {
  return exp(-abs(x - glacierSun.x) / glacierSqueeze * 2.4);
}

vec3 glacierSky(float x, float y) {
  float h = clamp((y - GLACIER_HORIZON) / (1.0 - GLACIER_HORIZON), 0.0, 1.0);
  float dx = (x - glacierSun.x) / glacierSqueeze;
  // A night-blue dome; all the warmth gathers low around the sun.
  vec3 col = mix(vec3(0.24, 0.2, 0.42), vec3(0.08, 0.09, 0.22), smoothstep(0.0, 0.85, h));
  float rose = exp(-dx * dx / 0.7) * exp(-h / 0.32) + 0.5 * exp(-h / 0.1);
  col = mix(col, vec3(0.86, 0.46, 0.56), clamp(rose, 0.0, 1.0) * 0.85);
  float gold = exp(-dx * dx / 0.14) * exp(-h / 0.14);
  col = mix(col, vec3(0.86, 0.56, 0.34), clamp(gold, 0.0, 1.0) * 0.9);

  // Stratus streaks, lit gold beside the sun and violet away from it.
  float near = exp(-abs(dx) * 2.2);
  float streak = fbm(vec2(x * 0.8 - glacierT * 0.006, y * 10.0));
  float band = smoothstep(0.06, 0.16, h) * (1.0 - smoothstep(0.42, 0.62, h));
  float cloud = smoothstep(0.5, 0.68, streak) * band;
  vec3 cloudCol = mix(vec3(0.46, 0.34, 0.62), vec3(1.0, 0.68, 0.5), near);
  col = mix(col, cloudCol, cloud * 0.75);

  // High cirrus catching the last pink light.
  float wisp = fbm(vec2(x * 0.7 + y * 1.2 - glacierT * 0.004, y * 6.0 + 3.0));
  float high = smoothstep(0.5, 0.72, h) * (1.0 - smoothstep(0.9, 1.0, h));
  col = mix(col, vec3(0.56, 0.38, 0.64), smoothstep(0.54, 0.74, wisp) * high * 0.7);
  // Soft banks of afterglow cloud in the upper sky, broad and dim, so the
  // top of the frame has some air without drawing the eye.
  float bank = fbm(vec2(x * 0.45 - glacierT * 0.003, y * 2.6 + 7.0));
  float upper = smoothstep(0.45, 0.7, h);
  vec3 bankCol = mix(vec3(0.3, 0.22, 0.46), vec3(0.44, 0.28, 0.48), exp(-abs(dx) * 1.2));
  col = mix(col, bankCol, smoothstep(0.4, 0.75, bank) * upper * 0.5);

  vec2 d = vec2(dx, y - glacierSun.y);
  float r = length(d);
  float pulse = 1.0 + 0.05 * sin(glacierT * 0.3);
  float halo = exp(-r * r * 260.0) * 0.35 * pulse;
  col += vec3(0.9, 0.5, 0.24) * halo;
  float disc = 1.0 - smoothstep(0.04, 0.047, r);
  col = mix(col, vec3(1.0, 0.97, 0.86), disc);
  return col;
}

// The main range: a few big peaks, each a rough cone, joined by ridges.
float glacierPeak(float x, float px, float h, float slope, float seed) {
  float dx = x - px;
  float rough = 1.0 + 0.2 * snoise(vec2(dx * 3.5, seed));
  return h - abs(dx) * slope * rough;
}

float glacierRange(float x, out float peakX) {
  float best = -1.0;
  peakX = 0.0;
  float p;
  float px = glacierAt(-0.88);
  p = glacierPeak(x, px, 0.33, 0.62, 1.3);
  if (p > best) { best = p; peakX = px; }
  px = glacierAt(-0.18);
  p = glacierPeak(x, px, 0.24, 0.66, 4.1);
  if (p > best) { best = p; peakX = px; }
  px = glacierAt(0.12);
  p = glacierPeak(x, px, 0.15, 0.6, 7.7);
  if (p > best) { best = p; peakX = px; }
  px = glacierAt(1.0);
  p = glacierPeak(x, px, 0.18, 0.72, 9.2);
  if (p > best) { best = p; peakX = px; }
  float detail = 0.014 * snoise(vec2(x * 8.0, 2.0)) + 0.005 * snoise(vec2(x * 24.0, 5.0));
  return best + detail;
}

// The far range behind: low, broken, and lowest where the sun sets.
float glacierFar(float x) {
  float n = 0.5 + 0.5 * snoise(vec2(x * 1.6, 11.0));
  float gap = smoothstep(0.08, 0.3, abs(x - glacierSun.x) / glacierSqueeze);
  return (0.06 + 0.11 * n + 0.012 * snoise(vec2(x * 10.0, 3.0))) * gap;
}

// The glacier: a tongue that widens as it comes down to the lagoon.
const float GLACIER_TOP = 0.22;
const float GLACIER_CLIFF = 0.04;

float glacierAcross(float x, float y, out float v) {
  v = clamp((y - GLACIER_HORIZON) / GLACIER_TOP, 0.0, 1.0);
  // It curves up into the valley between the two left peaks.
  float centre = glacierAt(-0.5) + (glacierAt(-0.4) - glacierAt(-0.5)) * v + 0.03 * sin(v * 3.0);
  // A wide lobe at the water that pinches into a ribbon up the valley.
  float span = mix(0.045, 0.26, exp(-v * v / 0.06)) * glacierScale;
  return (x - centre) / span;
}

vec3 glacierIce(float x, float y, float a, float v) {
  // Ogives: pale and blue bands arcing down the tongue.
  float arc = (y - GLACIER_HORIZON) * 60.0 + a * a * 2.4 + snoise(vec2(x * 5.0, y * 16.0)) * 0.7;
  float ogive = smoothstep(0.3, 1.0, sin(arc));
  // The surface bulges, so its sunward side is brighter.
  float lit = 0.55 + 0.45 * smoothstep(-1.0, 0.6, a);
  vec3 col = mix(vec3(0.5, 0.62, 0.88), vec3(0.88, 0.93, 1.0), lit);
  // Higher up the ice is farther off: rosier and softer.
  col = mix(col, vec3(0.86, 0.66, 0.74), smoothstep(0.25, 1.0, v) * 0.55);
  col = mix(col, vec3(0.24, 0.38, 0.72), ogive * 0.45);
  // One dark ash band, the medial moraine, runs down the ice.
  float moraine = 1.0 - smoothstep(0.04, 0.09, abs(a - 0.3 + 0.06 * snoise(vec2(y * 24.0, 1.0))));
  col = mix(col, vec3(0.16, 0.14, 0.26), moraine * 0.7);

  // The calving face: deep blue seracs streaked with pale ice.
  float face = GLACIER_HORIZON + GLACIER_CLIFF * (1.0 - 0.35 * a * a) * (1.0 + 0.3 * snoise(vec2(x * 12.0, 0.0)));
  if (y < face) {
    float streaks = 0.5 + 0.5 * snoise(vec2(x * 40.0 / glacierSqueeze, y * 4.0));
    col = mix(vec3(0.06, 0.2, 0.52), vec3(0.4, 0.72, 0.96), smoothstep(0.3, 0.8, streaks) * (0.3 + 0.7 * lit));
    col = mix(col, vec3(0.96, 0.9, 0.86), smoothstep(face - 0.006, face, y) * 0.7);
  }
  return col;
}

// Sky, far range, peaks and glacier: everything at or above the horizon.
vec3 glacierAbove(float x, float y) {
  float near = glacierSunNear(x);
  vec3 col = glacierSky(x, y);
  vec3 haze = glacierSky(x, GLACIER_HORIZON + 0.04);
  float up = y - GLACIER_HORIZON;

  float far = glacierFar(x);
  if (up < far) {
    float snow = smoothstep(far - 0.06, far - 0.01, up) * (0.5 + 0.5 * snoise(vec2(x * 12.0, up * 20.0)));
    vec3 rock = vec3(0.28, 0.2, 0.38);
    col = mix(rock, vec3(0.95, 0.68, 0.72), snow * 0.5);
    col = mix(col, haze, 0.4);
  }

  float peakX;
  float range = glacierRange(x, peakX);
  if (up < range) {
    // Faces east of each summit turn to the sun and catch rose light.
    float ridge = peakX + (range - up) * 0.15 * snoise(vec2(up * 4.0, peakX * 3.0));
    float facing = smoothstep(-0.004, 0.012, x - ridge);
    // Rock ribs run down the fall line and break up the snow.
    float rib = snoise(vec2(x * 16.0 / glacierSqueeze, up * 2.5 + peakX * 4.0));
    float snowLine = 0.09 + 0.05 * fbm(vec2(x * 4.0, up * 6.0));
    float snow = smoothstep(snowLine - 0.01, snowLine + 0.02, up) * (1.0 - smoothstep(0.3, 0.6, rib));
    vec3 rock = mix(vec3(0.04, 0.04, 0.11), vec3(0.12, 0.08, 0.16), facing);
    vec3 snowCol = mix(vec3(0.12, 0.13, 0.28), vec3(0.62, 0.38, 0.46), facing);
    col = mix(rock, snowCol, snow);
    // Alpenglow: only the sunward ridges near the crest catch full light.
    float crest = smoothstep(0.03, 0.004, range - up) * facing * smoothstep(0.06, 0.12, up);
    vec3 glow = mix(vec3(1.0, 0.64, 0.58), vec3(1.0, 0.86, 0.74), smoothstep(0.12, 0.3, up));
    col = mix(col, glow, crest * mix(0.6, 1.0, snow));
    // Depth: the lower slopes sink into the evening haze.
    col = mix(col, haze * 0.7, 0.2 * (1.0 - smoothstep(0.0, 0.06, up)));
    // The peaks right of centre stand farther back, softened by haze.
    float distant = step(glacierAt(0.0), peakX);
    col = mix(col, haze * vec3(0.62, 0.6, 0.78), distant * 0.4);
  }

  float v;
  float a = glacierAcross(x, y, v);
  if (up >= 0.0 && abs(a) < 1.0 && v < 1.0) {
    float edge = 1.0 - smoothstep(0.85, 1.0, abs(a));
    float fadeTop = 1.0 - smoothstep(0.5, 1.0, v);
    col = mix(col, glacierIce(x, y, a, v), edge * fadeTop);
  }

  // The low shore across the mouth of the lagoon, where the sun sits.
  float shore = 0.007 + 0.004 * snoise(vec2(x * 7.0, 9.0));
  if (up < shore && abs(a) > 0.95) {
    col = mix(vec3(0.1, 0.08, 0.2), vec3(0.4, 0.22, 0.26), near);
  }
  return col;
}

// The height of a faceted berg at knot i of six across its width.
float glacierKnot(float i, float seed) {
  if (i < 0.5 || i > 5.5) {
    return 0.04;
  }
  float u = i / 3.0 - 1.0;
  return sqrt(1.0 - u * u) * (1.0 - 0.2 * u) * (0.72 + 0.36 * glacierHash(vec2(i, seed)));
}

// Iceberg profiles: 0 rounded, 1 tabular, 2 pinnacle, 3 faceted, which has
// straight edges between knots like ice that has split along its planes.
float glacierProfile(float u, float kind, float seed) {
  if (kind > 2.5) {
    float k = (u + 1.0) * 3.0;
    float i = floor(k);
    float edge = mix(glacierKnot(i, seed), glacierKnot(i + 1.0, seed), k - i);
    return edge * (1.0 + 0.03 * snoise(vec2(u * 9.0, seed))) * smoothstep(1.0, 0.9, abs(u));
  }
  float rounded = pow(max(0.0, 1.0 - u * u), 0.6);
  float tabular = 1.0 - smoothstep(0.7, 1.0, abs(u));
  float spike = pow(max(0.0, 1.0 - abs(u - 0.2) * 1.05), 1.4);
  float shape = kind < 0.5 ? rounded : (kind < 1.5 ? tabular : spike);
  float jag = 0.12 * snoise(vec2(u * 2.6, seed)) + 0.05 * snoise(vec2(u * 7.0, seed + 2.0));
  return shape * (1.0 + jag) * smoothstep(1.0, 0.85, abs(u));
}

// One iceberg with geo (x, waterline y, half width, height) and info
// (kind, seed). Returns rgb and coverage (0 outside).
vec4 glacierBerg(float x, float y, vec4 geo, vec2 info) {
  float drift = 0.008 * sin(glacierT * 0.02 + info.y * 1.7);
  float u = (x - geo.x - drift) / geo.z;
  if (abs(u) >= 1.0 || y < geo.y) {
    return vec4(0.0);
  }
  float top = geo.w * glacierProfile(u, info.x, info.y);
  if (y > geo.y + top) {
    return vec4(0.0);
  }
  float v = (y - geo.y) / geo.w;
  float vt = top / geo.w;
  float near = glacierSunNear(x);
  // A jagged ridge splits the sunlit right face from the shadowed left.
  float split = -0.15 + 0.3 * snoise(vec2(v * 2.5, info.y)) + 0.25 * (vt - v);
  float facet = 0.5 + 0.5 * snoise(vec2(u * 2.2 + info.y, v * 1.8));
  vec3 litCol = mix(vec3(0.82, 0.91, 1.0), vec3(1.0, 0.9, 0.8), clamp(v * 0.6 + near * 0.4, 0.0, 1.0));
  litCol *= 0.86 + 0.14 * facet;
  vec3 shade = mix(vec3(0.06, 0.2, 0.52), vec3(0.24, 0.5, 0.86), clamp(facet * 0.75 + v * 0.25, 0.0, 1.0));
  float lit = smoothstep(-0.04, 0.04, u - split);
  if (info.x > 2.5) {
    // Facets: one flat, slanted plane under each edge of the top. Planes
    // step from shadow on the left to sunlit on the right, brighter where
    // the edge above falls toward the sun.
    float k = clamp((u + 0.3 * v + 1.0) * 3.0, 0.0, 5.99);
    float i = floor(k);
    float slope = glacierKnot(i + 1.0, info.y) - glacierKnot(i, info.y);
    float centre = (i + 0.5) / 3.0 - 1.0;
    lit = clamp(0.5 + 0.9 * centre - 1.2 * slope, 0.0, 1.0);
    facet = glacierHash(vec2(i, info.y + 1.0));
    litCol = mix(vec3(0.82, 0.91, 1.0), vec3(1.0, 0.9, 0.8), clamp(v * 0.6, 0.0, 1.0)) * (0.82 + 0.18 * facet);
    shade = mix(vec3(0.06, 0.2, 0.52), vec3(0.24, 0.5, 0.86), clamp(facet * 0.6 + v * 0.3, 0.0, 1.0));
  }
  vec3 col = mix(shade, litCol, lit);
  // The rim along the top catches the low sun even on the shadow side.
  float rim = smoothstep(0.12, 0.0, vt - v);
  col = mix(col, vec3(0.92, 0.94, 1.0), rim * 0.6);
  // Ice glows aquamarine where it meets the water.
  col = mix(col, vec3(0.36, 0.78, 0.94), smoothstep(0.16, 0.0, v) * 0.55);
  return vec4(col, 1.0);
}

vec4 glacierBergGeo(int i) {
  float s = glacierScale;
  if (i == 0) return vec4(glacierAt(-0.66), GLACIER_HORIZON - 0.012, 0.05 * s, 0.03);
  if (i == 1) return vec4(glacierAt(0.3), GLACIER_HORIZON - 0.022, 0.045 * s, 0.035);
  if (i == 2) return vec4(glacierAt(-0.12), GLACIER_HORIZON - 0.06, 0.085 * s, 0.06);
  if (i == 3) return vec4(glacierAt(0.62), GLACIER_HORIZON - 0.14, 0.15 * s, 0.15);
  if (i == 4) return vec4(glacierAt(-0.76), GLACIER_HORIZON - 0.25, 0.2 * s, 0.11);
  return vec4(glacierAt(0.14), GLACIER_HORIZON - 0.32, 0.08 * s, 0.03);
}

vec2 glacierBergInfo(int i) {
  if (i == 0) return vec2(1.0, 3.0);
  if (i == 1) return vec2(0.0, 5.0);
  if (i == 2) return vec2(1.0, 8.0);
  if (i == 3) return vec2(2.0, 13.0);
  if (i == 4) return vec2(3.0, 21.0);
  return vec2(1.0, 34.0);
}

vec3 glacierWater(float x, float y) {
  float depth = (GLACIER_HORIZON - y) / GLACIER_HORIZON;
  // Glassy: a faint slow wobble that grows toward the viewer.
  float wob = (0.001 + 0.007 * depth) * sin(y * 240.0 / (0.3 + depth) + glacierT * 0.45 + 2.0 * snoise(vec2(x * 2.0, y * 8.0)));
  vec3 refl = glacierAbove(x + wob, 2.0 * GLACIER_HORIZON - y);
  refl = refl * vec3(0.56, 0.62, 0.8) * mix(1.0, 0.6, depth);
  // The lagoon's own colour: glacial blue-green, deepest near the viewer.
  refl += mix(vec3(0.02, 0.04, 0.1), vec3(0.04, 0.08, 0.16), 1.0 - depth);
  refl *= 0.9 + 0.1 * snoise(vec2(x * 1.2 + glacierT * 0.01, y * 90.0));

  // The sun's path: gold glints in a column that widens toward the viewer.
  float dx = abs(x - glacierSun.x) / glacierSqueeze;
  float width = 0.022 + 0.1 * depth;
  float column = exp(-dx * dx / (width * width));
  float glint = snoise(vec2(x * 30.0 / glacierSqueeze, y * 140.0) + vec2(0.0, glacierT * 0.2));
  glint = smoothstep(0.3, 0.8, glint);
  refl += vec3(1.0, 0.74, 0.42) * column * (0.2 + glint * 1.0) * mix(1.0, 0.55, depth);

  // Brash ice: small chips of white ice scattered across the lagoon,
  // smaller and denser toward the horizon, drifting with the bergs.
  float row = log(depth + 0.08) * 5.0;
  vec2 g = vec2((x + glacierT * 0.0015) / (0.02 + 0.07 * depth), row);
  vec2 cellId = floor(g);
  vec2 f = fract(g) - 0.5;
  float pick = glacierHash(cellId);
  vec2 jit = vec2(glacierHash(cellId + 7.1), glacierHash(cellId + 3.3)) - 0.5;
  float chip = step(0.8, pick) * (1.0 - smoothstep(0.22, 0.3, length((f - jit * 0.4) * vec2(1.0, 1.8))));
  vec3 chipCol = mix(vec3(0.62, 0.78, 0.96), vec3(1.0, 0.86, 0.76), glacierSunNear(x));
  refl = mix(refl, chipCol, chip * mix(0.9, 0.6, depth));
  return refl;
}

vec3 glacierColor(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  glacierT = t;
  glacierSqueeze = sqrt(clamp(1.7 / aspect, 1.0, 4.0));
  glacierHalfW = 0.5 * aspect * glacierSqueeze;
  glacierScale = clamp(glacierHalfW / 0.85, 0.6, 1.15);
  glacierSun = vec2(glacierAt(0.46), GLACIER_HORIZON + 0.034);
  float x = (uv.x - 0.5) * aspect * glacierSqueeze;
  float y = uv.y;

  vec3 col = y >= GLACIER_HORIZON ? glacierAbove(x, y) : glacierWater(x, y);

  // Icebergs, far to near; each mirrors about its own waterline.
  for (int i = 0; i < 6; i++) {
    vec4 geo = glacierBergGeo(i);
    vec2 info = glacierBergInfo(i);
    vec4 body = glacierBerg(x, y, geo, info);
    if (body.a > 0.5) {
      col = body.rgb;
    } else if (y < geo.y) {
      vec4 mirror = glacierBerg(x, 2.0 * geo.y - y, geo, info);
      if (mirror.a > 0.5) {
        col = mix(col, mirror.rgb * vec3(0.56, 0.64, 0.82), 0.9);
      }
      // Submerged ice shows as a turquoise glow just under the berg.
      float u = (x - geo.x) / geo.z;
      float under = (1.0 - smoothstep(0.5, 1.0, abs(u))) * smoothstep(-0.04, 0.0, y - geo.y);
      col += vec3(0.03, 0.14, 0.18) * under;
    }
  }

  // A low band of mist slides across the water and the glacier's foot.
  if (glacierMistOn > 0.5) {
    float band = exp(-pow((y - GLACIER_HORIZON - 0.01) / 0.03, 2.0));
    band *= 1.0 - 0.6 * glacierSunNear(x);
    float m = fbm(vec2(x * 1.6 - t * 0.014, y * 14.0));
    float density = smoothstep(0.36, 0.66, m) * band;
    vec3 mistCol = mix(vec3(0.74, 0.66, 0.84), vec3(1.0, 0.84, 0.7), glacierSunNear(x));
    col = mix(col, mistCol, density * 0.8);
  }
  return max(col, vec3(0.0));
}

vec2 glacierCacheUv = vec2(-1.0);
float glacierCacheT = -1.0;
vec4 glacierCacheValue = vec4(0.0);

vec4 glacierScene(vec2 uv, vec2 res, float t) {
  if (uv == glacierCacheUv && t == glacierCacheT) {
    return glacierCacheValue;
  }
  vec3 col = clamp(glacierColor(uv, res, t), 0.0, 1.0);
  // Value counts saturated blues as mid-tones, so shadowed ice still draws.
  float value = max(dot(col, vec3(0.3, 0.55, 0.15)), 0.7 * max(col.r, max(col.g, col.b)));
  float tone = 0.1 + 0.9 * pow(value, 1.2);
  // Small dots read darker than the light they stand for, so lift the darks.
  float peak = max(col.r, max(col.g, col.b));
  vec3 ink = col / max(peak, 1e-3) * pow(peak, 0.6);
  // Deep sky and dark water stay quiet air: the smallest dots, in a colour
  // only a little lighter than the paper.
  float quiet = 1.0 - smoothstep(0.1, 0.3, value);
  ink = mix(ink, vec3(0.13, 0.14, 0.27), quiet * 0.55);
  tone *= 1.0 - 0.3 * quiet;
  // Below full intensity the middle band, where a headline sits, quiets most.
  float k = glacierIntensity;
  vec2 c = vec2((uv.x - 0.5) * res.x / res.y / 0.55, (uv.y - 0.5) / 0.14);
  float middle = exp(-dot(c, c)) * (1.0 - k);
  float dim = mix(0.5, 1.0, k) * (1.0 - 0.6 * middle);
  tone *= mix(0.72, 1.0, k) * (1.0 - 0.4 * middle);
  glacierCacheUv = uv;
  glacierCacheT = t;
  glacierCacheValue = vec4(ink * dim, tone);
  return glacierCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return glacierScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return glacierScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#0a0b1c";
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
        "linear-gradient(to bottom, #0f1130 0%, #1c1a3c 40%, #6e3f5c 52%, #c9876a 57%, #2a2340 58.5%, #0d1022 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface GlacierLagoonProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The band of low mist sliding across the water. Default `true`. */
  mist?: boolean;
  /**
   * Square cells, so the `dots` lay an even halftone lattice. Turn it off
   * for Braille, quadrants or text charsets. Default `true`.
   */
  square?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"glacier"`, teal shadow to white ice. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the sky and lagoon as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the scene never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A glacier lagoon under the midnight sun. Icebergs glow blue-white on a
 * glassy lagoon below a glacier's calving face and dark peaks, while the
 * sun sits gold and rose on the horizon and its path shimmers on the
 * water. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const GlacierLagoon = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  dither = "bayer4",
  stillTime = 0,
  intensity = 1,
  mist = true,
  fallback = FALLBACK,
  // The scene has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: GlacierLagoonProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        glacierIntensity: clamp(intensity, 0, 1),
        glacierMistOn: mist ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "glacier" : undefined)}
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
