"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Rio at night, seen from the sea. The scene lives in a frame measured in
// box heights (x centred, y up) with the bay's far shore at RIO_SEA; on
// narrow boxes the frame shrinks about that line so both peaks stay in
// view. Everything solid is decided per sample against exact outlines, and
// the small things (the statue, the cable car, windows, lamps, stars) are
// placed on whole samples, so edges stay crisp at every density and
// nothing between them blurs. Nothing that is built moves: only window
// lights, star glints, the water and the one cable car change over time.
// Tone carries density: in Braille and quadrants a fill becomes an ordered
// dot pattern of that density, and outlines and lights light every dot.
const SCENE = `
const float RIO_SEA = 0.3;
const float RIO_COR_X = -0.26;
const float RIO_COR_TOP = 0.7;
const float RIO_STATUE_H = 0.1;
const float RIO_LOAF_X = 0.52;
const float RIO_LOAF_H = 0.3;
const float RIO_URCA_X = 0.3;
const float RIO_LAMP = 0.03;
const float RIO_BLOCK = 0.05;

float rioAspect = 1.0;
float rioK = 1.0;
float rioOff = 0.0;
vec2 rioSamples = vec2(1.0);
float rioPx = 0.01;
float rioPw = 0.01;
vec2 rioMoonAt = vec2(0.73, 0.87);

void rioLayout(vec2 res) {
  rioAspect = res.x / res.y;
  rioSamples = max(ascii_samples, vec2(1.0));
  // Show at least the stretch from Corcovado to the moon, and centre on it
  // when the box is too narrow for the whole bay.
  float span = max(rioAspect, 1.15);
  rioK = rioAspect / span;
  rioOff = 0.2 * clamp((1.6 - span) / 0.45, 0.0, 1.0);
  // The moon stays clear of the right edge.
  rioMoonAt = vec2(min(0.73, rioOff + 0.5 * span - 0.08), 0.87);
  rioPx = 1.0 / (rioSamples.y * rioK);
  rioPw = rioAspect / (rioSamples.x * rioK);
}

vec2 rioFrame(vec2 uv) {
  return vec2((uv.x - 0.5) * rioAspect / rioK + rioOff, RIO_SEA + (uv.y - RIO_SEA) / rioK);
}

// The sample (column, row) that holds a frame point.
vec2 rioCellOf(vec2 f) {
  vec2 uv = vec2((f.x - rioOff) * rioK / rioAspect + 0.5, RIO_SEA + (f.y - RIO_SEA) * rioK);
  return floor(uv * rioSamples);
}

// A frame x as a continuous column: column c spans c to c + 1.
float rioColumn(float x) {
  return ((x - rioOff) * rioK / rioAspect + 0.5) * rioSamples.x;
}

vec2 rioCentre(vec2 cell) {
  return rioFrame((cell + 0.5) / rioSamples);
}

// Copacabana recedes to the right: depth runs 0 at the near end to 1 where
// the beach meets the bay below Urca, and things shrink with it.
float rioDepth(float x) {
  return clamp((x + 0.9) / 1.05, 0.0, 1.0);
}

float rioScale(float x) {
  return 1.0 - 0.7 * rioDepth(x);
}

float rioShore(float x) {
  float d = 1.0 - rioDepth(x);
  return RIO_SEA - 0.2 * d * d;
}

// The promenade, where the sand ends and the lamps stand.
float rioWalk(float x) {
  return rioShore(x) + 0.004 + 0.018 * rioScale(x);
}

// Distance along the beach in near-end units, so lamps and blocks set out
// at equal steps here shrink into the distance.
float rioAlong(float x) {
  return x < -0.9 ? x + 0.9 : -1.5 * log(rioScale(x));
}

float rioFromAlong(float u) {
  return u < 0.0 ? u - 0.9 : -0.9 + 1.5 * (1.0 - exp(-u / 1.5));
}

// The shared hash repeats every 50 steps on whole numbers, and lights,
// stars and windows here are keyed on whole sample and slot indices.
float rioHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float rioBayerPair(vec2 a) {
  return mod(2.0 * a.x + 3.0 * a.y, 4.0);
}

// A 4x4 ordered threshold, so fills in dot charsets are even patterns.
float rioBayer(vec2 cell) {
  vec2 a = mod(cell, 2.0);
  vec2 b = mod(floor(cell / 2.0), 2.0);
  return (4.0 * rioBayerPair(a) + rioBayerPair(b) + 0.5) / 16.0;
}

// ---- Mountains -------------------------------------------------------

float rioUrcaTop(float x) {
  float d = (x - RIO_URCA_X) / 0.16;
  if (abs(d) >= 1.0) {
    return -1.0;
  }
  return RIO_SEA + 0.15 * pow(1.0 - d * d, 0.55) * (1.0 + 0.08 * d);
}

// Sugarloaf: a granite dome with near-vertical sides, a rounded crown and
// a forested skirt, leaning a little toward the open sea. v is 0 at the
// water and 1 at the top.
float rioLoafHalf(float v) {
  return 0.085 * sqrt(max(1.0 - v * v * v, 0.0)) + 0.055 * pow(1.0 - v, 3.0);
}

float rioLoafAxis(float v) {
  return RIO_LOAF_X + 0.02 * v;
}

// -1 to 1 across the dome at p, or a value outside that range off it.
float rioLoafAcross(vec2 p) {
  float v = (p.y - RIO_SEA) / RIO_LOAF_H;
  if (v < 0.0 || v > 1.0) {
    return 9.0;
  }
  float sx = p.x - rioLoafAxis(v);
  float hw = rioLoafHalf(v) * (sx < 0.0 ? 1.1 : 0.9);
  return sx / max(hw, 1e-4);
}

// Corcovado: a sharp granite peak with a long shoulder to the west and a
// near-sheer face to the east, rising from the forested Tijuca range.
float rioCorcovado(float x) {
  float dx = x - RIO_COR_X;
  float a = sqrt(dx * dx + 1e-4) - 0.01;
  // Steep near the summit and flaring lower down, the east face steeper.
  return RIO_COR_TOP - (dx < 0.0 ? 0.65 * pow(a, 0.61) : 1.0 * pow(a, 0.61));
}

// The forested range without the peak.
float rioRange(float x) {
  float r = 0.43 + 0.03 * sin(x * 5.3 + 0.4) + 0.015 * sin(x * 13.0 + 2.1);
  return mix(RIO_SEA - 0.02, r, smoothstep(0.2, -0.05, x));
}

float rioRidge(float x) {
  return max(rioRange(x), rioCorcovado(x));
}

// The higher range far behind, paler with distance.
float rioFar(float x) {
  float r = 0.47 + 0.025 * sin(x * 3.7 + 1.0) + 0.07 * exp(-(x + 0.6) * (x + 0.6) / 0.012);
  return mix(RIO_SEA, r, smoothstep(0.15, -0.15, x));
}

// Which landform covers p: 0 sky or water, 1 the far range, 2 the near
// range with Corcovado, 3 Sugarloaf, 4 Morro da Urca. Higher is nearer.
float rioLandAt(vec2 p) {
  if (p.y < rioShore(p.x)) {
    return 0.0;
  }
  if (p.y >= RIO_SEA && p.y < rioUrcaTop(p.x)) {
    return 4.0;
  }
  if (abs(rioLoafAcross(p)) <= 1.0) {
    return 3.0;
  }
  if (p.y < rioRidge(p.x)) {
    return 2.0;
  }
  if (p.y < rioFar(p.x)) {
    return 1.0;
  }
  return 0.0;
}

// Colour and tone of a landform at p. Moonlight comes from the right, so
// Sugarloaf is shaded across its dome. An outline sample is one whose
// neighbour above or beside it belongs to something further back.
vec4 rioLand(vec2 p, float id) {
  float up = rioLandAt(p + vec2(0.0, rioPx));
  float left = rioLandAt(p - vec2(rioPw, 0.0));
  float right = rioLandAt(p + vec2(rioPw, 0.0));
  bool rim = up < id || left < id || right < id;
  if (id > 3.5) {
    return rim ? vec4(0.45, 0.62, 0.56, 0.9) : vec4(0.14, 0.32, 0.27, 0.42);
  }
  if (id > 2.5) {
    float v = (p.y - RIO_SEA) / RIO_LOAF_H;
    float lit = clamp(0.5 + 0.6 * rioLoafAcross(p), 0.0, 1.0);
    if (rim) {
      return vec4(mix(vec3(0.5, 0.56, 0.7), vec3(0.95, 0.97, 1.0), lit), 0.95);
    }
    if (v < 0.13 + 0.02 * sin(p.x * 90.0)) {
      return vec4(0.14, 0.3, 0.25, 0.42);
    }
    return vec4(mix(vec3(0.3, 0.36, 0.5), vec3(0.72, 0.78, 0.9), lit), 0.4 + 0.35 * lit);
  }
  if (id > 1.5) {
    if (rim) {
      return vec4(0.45, 0.56, 0.68, 0.9);
    }
    // Bare granite where the peak stands clear of the forested range.
    if (p.y > rioRange(p.x) + 0.05 + 0.01 * sin(p.x * 70.0)) {
      return vec4(0.38, 0.42, 0.52, 0.5);
    }
    return vec4(0.14, 0.3, 0.32, 0.42);
  }
  return rim ? vec4(0.26, 0.34, 0.52, 0.85) : vec4(0.16, 0.22, 0.38, 0.3);
}

// Homes along the foot of the hills: fixed warm points, densest low down.
// Each light owns its whole glyph: one lit sample, the rest dark in its
// colour, so the point stays bright where a glyph averages its samples.
vec4 rioHillLights(vec2 cell, vec2 p, float id, out float cover) {
  cover = 0.0;
  if (id < 1.5 || p.x > 0.33 || id > 2.5 && id < 3.5) {
    return vec4(0.0);
  }
  float rise = (p.y - max(rioWalk(p.x), RIO_SEA)) / 0.09;
  if (rise < 0.0 || rise > 1.0) {
    return vec4(0.0);
  }
  vec2 glyph = floor(cell / rioGrid);
  if (rioHash(glyph + 31.7) > 0.12 * (1.0 - rise)) {
    return vec4(0.0);
  }
  vec2 spot = glyph * rioGrid + floor(vec2(rioHash(glyph + 2.3), rioHash(glyph + 6.1)) * rioGrid);
  vec3 col = rioHash(glyph + 4.1) < 0.7 ? vec3(1.0, 0.76, 0.44) : vec3(0.82, 0.88, 1.0);
  cover = 1.0;
  return vec4(col * (0.7 + 0.3 * rioHash(glyph + 8.9)), spot == cell ? 0.9 : 0.0);
}

// ---- Christ the Redeemer, the cable car ------------------------------

// The statue on Corcovado's summit, in statue units: u across, v up from
// the foot of the pedestal. Every part is at least one sample. Its axis
// sits on a glyph boundary in dot charsets (two samples per glyph) and on
// a glyph centre otherwise, so both halves light the same dots.
vec4 rioStatue(vec2 cell, vec2 p, out float cover) {
  cover = 0.0;
  float axis = rioGrid.x > 1.5 ? 2.0 * floor(rioColumn(RIO_COR_X) / 2.0 + 0.5) : floor(rioColumn(RIO_COR_X)) + 0.5;
  float foot = rioGrid.y * floor(rioCellOf(vec2(RIO_COR_X, RIO_COR_TOP)).y / rioGrid.y);
  float u = (cell.x + 0.5 - axis) * rioPw / RIO_STATUE_H;
  float v = (cell.y - foot + 0.5) * rioPx / RIO_STATUE_H;
  if (v < 0.0 || v > 1.0 || abs(u) > 0.45) {
    return vec4(0.0);
  }
  float hu = 0.505 * rioPw / RIO_STATUE_H;
  float hv = 0.5 * rioPx / RIO_STATUE_H;
  bool body = false;
  bool plinth = false;
  if (v < 0.12) {
    plinth = abs(u) <= max(0.1, hu);
  } else if (v < 0.82) {
    // The robe: flared at the hem, slimmer at the waist.
    float robe = mix(0.12, 0.075, smoothstep(0.12, 0.5, v)) + 0.012 * smoothstep(0.6, 0.82, v);
    body = abs(u) <= max(robe, hu);
  }
  // Arms straight out at the shoulders, the span over four fifths of the
  // whole height: two rows of dots, or one row of glyphs.
  if (v <= 0.82 && v >= 0.82 - max(0.07, (rioGrid.y > 1.5 ? 3.98 : 1.98) * hv) && abs(u) <= 0.42) {
    body = true;
  }
  // The small head, sitting right on the shoulders.
  if (v > 0.82 && v <= 0.82 + max(0.1, 2.0 * hv) && abs(u) <= max(0.04, hu)) {
    body = true;
  }
  if (plinth) {
    cover = 1.0;
    return vec4(0.72, 0.75, 0.82, 0.88);
  }
  if (body) {
    cover = 1.0;
    return vec4(0.98, 0.98, 1.0, 1.0);
  }
  // Empty sky around the figure takes its white at zero tone, so glyphs
  // that average their samples keep the arms bright.
  if (abs(u) < 0.5 && v < 1.05 && rioLandAt(p) < 0.5) {
    cover = 1.0;
    return vec4(0.98, 0.98, 1.0, 0.0);
  }
  return vec4(0.0);
}

vec2 rioCableA() {
  return vec2(0.37, rioUrcaTop(0.37) + 0.008);
}

vec2 rioCableB() {
  return vec2(0.508, RIO_SEA + RIO_LOAF_H * 0.955);
}

float rioCableY(float x) {
  vec2 a = rioCableA();
  vec2 b = rioCableB();
  float s = clamp((x - a.x) / (b.x - a.x), 0.0, 1.0);
  return mix(a.y, b.y, s) - 0.014 * s * (1.0 - s);
}

// Where the car is along the cable, 0 at Urca and 1 at the top: it waits
// at each station, then takes about half a minute to cross.
float rioCarAt(float t) {
  float c = mod(t, 90.0);
  float s = c < 12.0 ? 0.0 : c < 45.0 ? smoothstep(0.0, 1.0, (c - 12.0) / 33.0) : c < 57.0 ? 1.0 : 1.0 - smoothstep(0.0, 1.0, (c - 57.0) / 33.0);
  return mix(0.1, 0.9, s);
}

vec4 rioCable(vec2 cell, vec2 p, float t, out float cover) {
  cover = 0.0;
  if (rioCableOn < 0.5) {
    return vec4(0.0);
  }
  vec2 a = rioCableA();
  vec2 b = rioCableB();
  // The car hangs one glyph below the cable: a full glyph in dot charsets
  // (its top row left dark), three glyphs on a one-glyph hanger otherwise.
  float x = mix(a.x, b.x, rioCarAt(t));
  vec2 car = rioCellOf(vec2(x, rioCableY(x)));
  vec2 g = rioGrid;
  if (g.x > 1.5) {
    vec2 box = g * (floor(car / g) - vec2(0.0, 1.0));
    vec2 dc = cell - box;
    if (dc.x >= 0.0 && dc.x < g.x && dc.y >= 0.0 && dc.y < g.y) {
      cover = 1.0;
      float top = g.y - 1.0;
      return vec4(1.0, 0.8, 0.5, dc.y < top || g.y < 1.5 ? 0.95 : 0.0);
    }
  } else {
    vec2 dc = cell - car;
    if (abs(dc.x) <= 1.0 && dc.y <= -2.0 && dc.y >= -3.0) {
      cover = 1.0;
      return dc.y > -2.5 ? vec4(1.0, 0.82, 0.52, 0.95) : vec4(0.86, 0.5, 0.34, 0.9);
    }
    if (dc.x == 0.0 && dc.y == -1.0) {
      cover = 1.0;
      return vec4(0.6, 0.62, 0.7, 0.7);
    }
  }
  // The stations: a lit sample at each end.
  vec2 sa = rioCellOf(a);
  vec2 sb = rioCellOf(b);
  if (abs(cell.y - sa.y) < 0.5 && abs(cell.x - sa.x) <= 1.0 || abs(cell.y - sb.y) < 0.5 && abs(cell.x - sb.x) <= 1.0) {
    cover = 1.0;
    return vec4(1.0, 0.8, 0.5, 0.9);
  }
  if (p.x < a.x || p.x > b.x) {
    return vec4(0.0);
  }
  // Thick enough on the steep run that no column drops the line.
  float slope = (b.y - a.y) / (b.x - a.x);
  if (abs(p.y - rioCableY(p.x)) <= 0.5 * rioPx + 0.5 * rioPw * slope) {
    cover = 1.0;
    return vec4(0.56, 0.6, 0.7, 0.6);
  }
  return vec4(0.0);
}

// ---- Copacabana -------------------------------------------------------

// The lamp cell of lamp n along the promenade.
vec2 rioLampCell(float n) {
  float x = rioFromAlong((n + 0.5) * RIO_LAMP);
  return rioDepth(x) > 0.95 ? vec2(-9.0) : rioCellOf(vec2(x, rioWalk(x)));
}

// The lamp standing in column c, if any; x is a frame x in that column.
vec2 rioLampIn(float c, float x) {
  float n = floor(rioAlong(x) / RIO_LAMP);
  for (int i = -1; i <= 1; i++) {
    vec2 lamp = rioLampCell(n + float(i));
    if (lamp.x == c) {
      return lamp;
    }
  }
  return vec2(-9.0);
}

// Whether window id is lit. Most windows keep their state; a few switch,
// each on its own slow clock, and fade over a couple of seconds.
float rioWindowLit(vec3 id, float rate, float t) {
  float h = rioHash(id.yz + id.x * 7.13);
  if (rioHash(id.zy + id.x * 3.31 + 1.7) > 0.25) {
    return step(h, rate);
  }
  float period = 70.0 + 110.0 * rioHash(id.yz * 1.37 + id.x);
  float phase = t / period + h * 13.0;
  float k = floor(phase);
  float now = step(rioHash(vec2(k, h * 91.0)), rate);
  float next = step(rioHash(vec2(k + 1.0, h * 91.0)), rate);
  return mix(now, next, smoothstep(0.0, 2.5 / period, fract(phase) - (1.0 - 2.5 / period)));
}

// The wall of apartment blocks behind the promenade, each block on whole
// samples with its windows on a two-sample grid.
vec4 rioBlocks(vec2 cell, vec2 p, float t, out float cover) {
  cover = 0.0;
  if (rioDepth(p.x) > 0.93 || p.y < rioWalk(p.x)) {
    return vec4(0.0);
  }
  // Blocks own whole glyphs: columns go in groups of the glyph's sample
  // width and rows in groups of its height, so no glyph straddles a
  // block's edge and window grids land the same way in every glyph.
  vec2 g = rioGrid;
  float group = floor(cell.x / g.x);
  float xg = rioCentre(vec2(group * g.x + 0.5 * (g.x - 1.0), cell.y)).x;
  float n = floor(rioAlong(xg) / RIO_BLOCK);
  float xa = rioFromAlong(n * RIO_BLOCK);
  float xb = rioFromAlong((n + 1.0) * RIO_BLOCK);
  float ca = min(g.x * ceil((rioColumn(xa) - 0.5 * g.x) / g.x), group * g.x);
  float cb = max(g.x * ceil((rioColumn(xb) - 0.5 * g.x) / g.x), (group + 1.0) * g.x);
  float w = cb - ca;
  float h1 = rioHash(vec2(n, 3.1));
  float f = rioScale(0.5 * (xa + xb));
  float baseRow = g.y * ceil((rioCellOf(vec2(xb, rioWalk(xb))).y + 2.0) / g.y);
  float rows = g.y * max(1.0, floor((0.045 + 0.07 * h1) * f / (rioPx * g.y)));
  float r = cell.y - baseRow;
  if (r >= rows) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (r < 0.0) {
    // The dark avenue between the lamps and the blocks.
    return vec4(0.0);
  }
  float cc = cell.x - ca;
  float alley = rioHash(vec2(n, 5.7)) < 0.45 ? g.x : 0.0;
  vec3 tint = rioHash(vec2(n, 8.3)) < 0.7 ? vec3(1.0, 0.78, 0.46) : vec3(0.8, 0.87, 1.0);
  // In dot charsets a cell takes the average colour of its samples, so
  // dark samples carry the window tint at zero tone to keep lit dots bright.
  vec3 wall = rioDots > 0.5 ? tint : vec3(0.16, 0.17, 0.22);
  if (cc >= w - alley) {
    return vec4(wall, 0.0);
  }
  float wc = floor(cc / g.x);
  bool pane = mod(wc, 2.0) > 0.5 && cc < w - alley - g.x && mod(r, 2.0) > 0.5 && r < rows - 1.0;
  if (!pane) {
    return vec4(wall, 0.12);
  }
  float rate = 0.4 + 0.35 * rioHash(vec2(n, 1.9));
  float lit = rioWindowLit(vec3(n, wc, r), rate, t);
  vec3 col = rioHash(vec2(wc, r) + n * 1.31) < 0.8 ? tint : vec3(1.0, 0.62, 0.32);
  return vec4(mix(wall, col * (0.75 + 0.25 * rioHash(vec2(r, wc) + n)), lit), 0.12 + 0.78 * lit);
}

vec4 rioBeach(vec2 cell, vec2 p) {
  // The thin line where the bay laps the sand.
  if (rioCellOf(vec2(p.x, rioShore(p.x))).y == cell.y) {
    return vec4(0.46, 0.54, 0.64, 0.42);
  }
  return vec4(0.3, 0.24, 0.17, 0.2);
}

// ---- Sky and water ------------------------------------------------------

vec4 rioMoon(vec2 p, out float cover) {
  cover = 0.0;
  // Never under seven rows across, so the crescent keeps its shape.
  float r = max(0.036, 3.5 * rioPx);
  float d = length(p - rioMoonAt);
  if (d > r * 1.3) {
    return vec4(0.0);
  }
  cover = 1.0;
  // The dark side and a rim around the moon keep its colour at zero tone.
  bool dark = d > r || length(p - rioMoonAt - vec2(-0.55, 0.28) * r) < r * 0.9;
  return vec4(1.0, 0.93, 0.76, dark ? 0.0 : 1.0);
}

// One star at most per square of the box, each a single sample, glinting
// slowly in colour while its glyph stays put.
vec4 rioStar(vec2 uv, vec2 cell, float t) {
  vec2 s = vec2(uv.x * rioAspect, uv.y);
  float g = 0.032;
  vec2 id = floor(s / g);
  float h = rioHash(id + 17.0);
  if (h > 0.18 * smoothstep(0.35, 0.9, uv.y)) {
    return vec4(0.0);
  }
  vec2 at = (id + 0.15 + 0.7 * vec2(rioHash(id + 3.1), rioHash(id + 8.7))) * g;
  vec2 starCell = floor(vec2(at.x / rioAspect, at.y) * rioSamples);
  if (floor(starCell / rioGrid) != floor(cell / rioGrid)) {
    return vec4(0.0);
  }
  float b = 0.35 + 0.55 * rioHash(id + 9.2);
  float glint = 0.8 + 0.2 * sin(t * (0.3 + 0.6 * rioHash(id + 5.0)) + h * 40.0);
  // A full dot, or the lightest glyphs of a ramp, never a heavy one.
  float tone = rioDots > 0.5 ? 0.9 : 0.12 + 0.14 * b;
  return vec4(vec3(0.76, 0.82, 1.0) * b * glint, starCell == cell ? tone : 0.0);
}

// The bay: dark water carrying broken copies of what stands on it. Each
// row of samples shifts sideways by whole samples on a slow sway, and a
// slowly drifting dash pattern breaks it up, so reflections shimmer
// without sliding.
vec4 rioWater(vec2 cell, vec2 p, float t) {
  vec2 g = rioGrid;
  float shift = g.x * floor(1.4 * sin(cell.y * 0.83 + t * 0.4) + 0.5);
  float c0 = g.x * floor((cell.x + shift) / g.x);
  float c = c0 + 0.5 * (g.x - 1.0);
  vec2 q = rioCentre(vec2(c, cell.y));
  float on = step(-0.1, snoise(vec2(c * 0.13 + t * 0.05, cell.y * 0.9)));
  vec4 hit = vec4(0.0);
  vec2 lamp = vec2(-9.0);
  for (int i = 0; i < 2; i++) {
    float lc = c0 + float(i);
    if (float(i) < g.x && lamp.x < -1.0) {
      lamp = rioLampIn(lc, rioCentre(vec2(lc, cell.y)).x);
    }
  }
  if (lamp.x > -1.0) {
    float below = (rioWalk(q.x) - p.y) / (0.07 * rioScale(q.x));
    float fade = 1.0 - smoothstep(0.2, 1.0, below);
    hit = vec4(vec3(1.0, 0.74, 0.42) * (0.45 + 0.55 * fade), 0.9 * fade * on);
  }
  // Sugarloaf and Urca mirrored in the open bay.
  vec2 m = vec2(q.x, 2.0 * RIO_SEA - p.y);
  if (p.y < RIO_SEA && q.x > 0.1) {
    float id = rioLandAt(m);
    vec4 land = id > 2.5 ? rioLand(m, id) : vec4(0.0);
    // Only the lit granite and the outlines show in the water.
    if (land.a > 0.5) {
      float fade = on * step(0.1, snoise(vec2(c * 0.04 - t * 0.03, cell.y * 0.45 + 4.0))) * (1.0 - smoothstep(0.03, 0.14, RIO_SEA - p.y));
      vec4 refl = vec4(land.rgb * 0.5, land.a * 0.7 * fade);
      if (hit.a == 0.0 && hit.r == 0.0 || refl.a > hit.a) {
        hit = refl;
      }
    }
  }
  // The moon's path: short dashes centred under it on every fourth row,
  // their lengths changing slowly. The rows between keep its colour.
  if (p.y < RIO_SEA && p.y > RIO_SEA - 0.24 && hit.a < 0.5) {
    float band = floor(cell.y / 4.0);
    float reach = (0.01 + 0.07 * (RIO_SEA - p.y)) * (0.25 + 0.75 * (0.5 + 0.5 * snoise(vec2(band * 1.1, t * 0.08))));
    if (abs(q.x - rioMoonAt.x) < reach) {
      hit = vec4(0.9, 0.9, 0.84, mod(cell.y, 4.0) < 0.5 ? 0.9 : 0.0);
    }
  }
  // In a ramp, glints take the light strokes rather than the dense glyphs.
  if (rioDots < 0.5) {
    hit.a *= 0.45;
  }
  return hit;
}

// ---- Composition ------------------------------------------------------

vec4 rioCompose(vec2 uv, vec2 cell, vec2 p, float t) {
  float cover = 0.0;
  vec2 glyph = floor(cell / rioGrid);
  for (int i = 0; i < 2; i++) {
    float c = glyph.x * rioGrid.x + float(i);
    if (float(i) < rioGrid.x) {
      vec2 lamp = rioLampIn(c, rioCentre(vec2(c, cell.y)).x);
      if (lamp.x > -1.0 && floor(lamp / rioGrid) == glyph) {
        return vec4(1.0, 0.86, 0.58, lamp == cell ? (rioDots > 0.5 ? 1.0 : 0.7) : 0.0);
      }
    }
  }
  if (p.y < rioShore(p.x)) {
    return rioWater(cell, p, t);
  }
  if (rioDepth(p.x) < 0.95 && p.y < rioWalk(p.x)) {
    return rioBeach(cell, p);
  }
  vec4 hit = rioBlocks(cell, p, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = rioStatue(cell, p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = rioCable(cell, p, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  float id = rioLandAt(p);
  if (id > 0.5) {
    hit = rioHillLights(cell, p, id, cover);
    return cover > 0.5 ? hit : rioLand(p, id);
  }
  hit = rioMoon(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  return rioStar(uv, cell, t);
}

vec2 rioCacheUv = vec2(-1.0);
float rioCacheT = -1.0;
vec4 rioCacheValue = vec4(0.0);

vec4 rioScene(vec2 uv, vec2 res, float t) {
  if (uv == rioCacheUv && t == rioCacheT) {
    return rioCacheValue;
  }
  rioLayout(res);
  vec2 cell = floor(uv * rioSamples);
  vec4 hit = rioCompose(uv, cell, rioFrame(uv), t);
  float tone = hit.a;
  if (rioDots > 0.5) {
    // Lights and outlines light every dot. Fills light every dot too when
    // the glyph colour carries brightness; otherwise an even share of them,
    // so the layers still part by density.
    bool lit = tone >= 0.85 || tone >= 0.15 && (rioSolid > 0.5 || tone * rioIntensity > rioBayer(cell));
    tone = lit ? max(tone, 0.6) : 0.0;
  } else {
    tone *= sqrt(rioIntensity);
  }
  rioCacheUv = uv;
  rioCacheT = t;
  rioCacheValue = vec4(hit.rgb * rioIntensity, tone);
  return rioCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night blue behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const NIGHT = "#050a17";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Modes where the glyph colour carries the scene's brightness.
const SOLID_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #050a17 0%, #050a17 55%, #0b1424 70%, #050a17 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RioProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The Sugarloaf cable car and its cable. Default `true`. */
  cableCar?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Rio de Janeiro at night, seen from the sea. Sugarloaf rises out of the
 * bay beside Morro da Urca with one cable car crossing between them,
 * Christ the Redeemer stands lit white on Corcovado, and the lamps of
 * Copacabana curve along the beach and shimmer in the water.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Rio = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 28,
  intensity = 1,
  cableCar = true,
  fallback = FALLBACK,
  interactive: _interactive,
  ...props
}: RioProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rioCableOn: cableCar ? 1 : 0,
        // Braille and quadrants light a dot only above half tone, so fills
        // are drawn there as ordered dot patterns instead.
        rioDots: gx * gy > 1 ? 1 : 0,
        rioGrid: [gx, gy],
        rioIntensity: clamp(intensity, 0, 1),
        rioSolid: SOLID_MODES.has(mode) ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
