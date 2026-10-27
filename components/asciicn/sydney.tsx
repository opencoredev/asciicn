"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Sydney Harbour at night from the east. The scene lives in a frame
// measured in box heights (x centred, y up) with the water at SYD_SEA; on
// narrow boxes the frame shrinks about that line so the Opera House and
// most of the bridge stay in view. Everything solid is decided per sample
// against exact outlines, and small things (truss members, windows, lamps,
// stars, the ferry) sit on whole samples, so edges stay crisp at every
// density. Nothing that is built moves: only window lights, star glints,
// one beacon, the water and the ferry change over time. Tone carries
// density: in Braille and quadrants a fill becomes an ordered dot pattern
// of that density unless the glyph colour already carries brightness.
const SCENE = `
const float SYD_SEA = 0.28;
const float SYD_PODIUM = 0.33;
// The bridge, measured in metres from the water at this scale.
const float SYD_M = 0.001254;
const float SYD_SOUTH = -0.07;
const float SYD_NORTH = 0.62;
const float SYD_PYLON_W = 0.06;
// Where the water line sits on screen, from the bottom.
const float SYD_SCREEN = 0.3;
const float SYD_PANELS = 28.0;
const float SYD_BLOCK = 0.05;

float sydAspect = 1.0;
float sydK = 1.0;
float sydOff = 0.0;
vec2 sydSamples = vec2(1.0);
float sydPx = 0.01;
float sydPw = 0.01;

void sydLayout(vec2 res) {
  sydAspect = res.x / res.y;
  sydSamples = max(ascii_samples, vec2(1.0));
  // Wide boxes show the towers, the Opera House and the whole bridge;
  // narrow ones close in on the Opera House and the bridge's south half.
  float wide = smoothstep(0.85, 1.25, sydAspect);
  float span = max(sydAspect, mix(0.9, 1.47, wide));
  sydK = sydAspect / span;
  sydOff = mix(-0.25, -0.075, wide);
  sydPx = 1.0 / (sydSamples.y * sydK);
  sydPw = sydAspect / (sydSamples.x * sydK);
}

vec2 sydFrame(vec2 uv) {
  return vec2((uv.x - 0.5) * sydAspect / sydK + sydOff, SYD_SEA + (uv.y - SYD_SCREEN) / sydK);
}

// The sample (column, row) that holds a frame point.
vec2 sydCellOf(vec2 f) {
  vec2 uv = vec2((f.x - sydOff) * sydK / sydAspect + 0.5, SYD_SCREEN + (f.y - SYD_SEA) * sydK);
  return floor(uv * sydSamples);
}

// A frame x as a continuous column: column c spans c to c + 1.
float sydColumn(float x) {
  return ((x - sydOff) * sydK / sydAspect + 0.5) * sydSamples.x;
}

vec2 sydCentre(vec2 cell) {
  return sydFrame((cell + 0.5) / sydSamples);
}

// The shared hash repeats every 50 steps on whole numbers, and lights,
// stars and windows here are keyed on whole sample and slot indices.
float sydHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float sydBayerPair(vec2 a) {
  return mod(2.0 * a.x + 3.0 * a.y, 4.0);
}

// A 4x4 ordered threshold, so fills in dot charsets are even patterns.
float sydBayer(vec2 cell) {
  vec2 a = mod(cell, 2.0);
  vec2 b = mod(floor(cell / 2.0), 2.0);
  return (4.0 * sydBayerPair(a) + sydBayerPair(b) + 0.5) / 16.0;
}

// A point light that owns its whole glyph: the light's sample is lit and
// the glyph's other samples carry its colour at zero tone, so it stays
// bright where a glyph averages its samples. cover is 1 inside the glyph.
vec4 sydLight(vec2 cell, vec2 spot, vec3 col, float tone, out float cover) {
  cover = 0.0;
  if (floor(spot / sydGrid) != floor(cell / sydGrid)) {
    return vec4(0.0);
  }
  cover = 1.0;
  return vec4(col, spot == cell ? (sydDots > 0.5 ? 1.0 : tone) : 0.0);
}

// ---- The Opera House ----------------------------------------------------

// Shell i, back to front: (x0, x1) its base on the podium, z the x of its
// tip and w its height above the podium. dir is 1 when the shell faces
// right (its tip over x1) and -1 when it faces left. The back hall peeks
// out behind the front one; the small restaurant shells sit at the south
// end on the left.
vec4 sydShellDef(float i, out float dir, out float lit) {
  dir = 1.0;
  lit = 1.0;
  if (i < 0.5) {
    dir = -1.0;
    lit = 0.74;
    return vec4(-0.44, -0.35, -0.455, 0.1);
  }
  if (i < 1.5) {
    lit = 0.8;
    return vec4(-0.42, -0.29, -0.275, 0.13);
  }
  if (i < 2.5) {
    lit = 0.8;
    return vec4(-0.36, -0.2, -0.18, 0.162);
  }
  if (i < 3.5) {
    dir = -1.0;
    lit = 0.86;
    return vec4(-0.63, -0.555, -0.645, 0.055);
  }
  if (i < 4.5) {
    lit = 0.93;
    return vec4(-0.615, -0.5, -0.49, 0.075);
  }
  if (i < 5.5) {
    dir = -1.0;
    lit = 0.88;
    return vec4(-0.485, -0.385, -0.5, 0.085);
  }
  if (i < 6.5) {
    return vec4(-0.47, -0.33, -0.315, 0.12);
  }
  if (i < 7.5) {
    return vec4(-0.41, -0.24, -0.22, 0.15);
  }
  return vec4(-0.34, -0.15, -0.125, 0.175);
}

// A shell's outline: a back that rises steeply from the podium and rolls
// over to the tip, and a nearly straight front that drops from the tip.
bool sydInShell(vec2 p, vec4 s, float dir) {
  float v = (p.y - SYD_PODIUM) / s.w;
  if (v < 0.0 || v > 1.0) {
    return false;
  }
  float back = dir > 0.0 ? s.x : s.y;
  float front = dir > 0.0 ? s.y : s.x;
  float xb = back + (s.z - back) * v * v;
  float xf = mix(front, s.z, v);
  return dir > 0.0 ? p.x >= xb && p.x <= xf : p.x <= xb && p.x >= xf;
}

// The front-most shell at p, as its index plus one, or 0.
float sydShellAt(vec2 p) {
  if (p.y < SYD_PODIUM || p.y > SYD_PODIUM + 0.18 || p.x < -0.66 || p.x > -0.1) {
    return 0.0;
  }
  float id = 0.0;
  for (int i = 0; i < 9; i++) {
    float dir;
    float lit;
    vec4 s = sydShellDef(float(i), dir, lit);
    if (sydInShell(p, s, dir)) {
      id = float(i) + 1.0;
    }
  }
  return id;
}

// The shells, lit cream-white, with a dark seam wherever one shell passes
// in front of another, so each reads as its own sail.
vec4 sydShells(vec2 p, out float cover) {
  cover = 0.0;
  float id = sydShellAt(p);
  if (id < 0.5) {
    return vec4(0.0);
  }
  cover = 1.0;
  float up = sydShellAt(p + vec2(0.0, sydPx));
  float left = sydShellAt(p - vec2(sydPw, 0.0));
  float right = sydShellAt(p + vec2(sydPw, 0.0));
  float down = sydShellAt(p - vec2(0.0, sydPx));
  float dir;
  float lit;
  vec4 s = sydShellDef(id - 1.0, dir, lit);
  if (up > id || left > id || right > id || down > id) {
    return vec4(vec3(1.0, 0.94, 0.82) * lit * 0.35, 0.0);
  }
  float v = (p.y - SYD_PODIUM) / s.w;
  vec3 col = vec3(1.0, 0.95, 0.84) * lit * (0.9 + 0.1 * v);
  return vec4(col, 0.6 + 0.35 * lit);
}

// The podium on Bennelong Point: a broad dark base with a lit top edge,
// a row of foyer lights, and the Monumental Steps falling away to the left.
vec4 sydPodium(vec2 cell, vec2 p, out float cover) {
  cover = 0.0;
  if (p.y < SYD_SEA || p.x < -0.78 || p.x > -0.09) {
    return vec4(0.0);
  }
  float top = SYD_PODIUM;
  if (p.x < -0.7) {
    top = min(SYD_PODIUM, SYD_SEA + 0.05 * (floor((p.x + 0.78) / 0.016) + 1.0) / 5.0);
  }
  if (p.x > -0.12) {
    top = SYD_PODIUM - 0.6 * (p.x + 0.12);
  }
  if (p.y >= top) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (sydCellOf(vec2(p.x, top - 0.5 * sydPx)).y == cell.y) {
    return vec4(0.86, 0.8, 0.7, 0.85);
  }
  // Foyer lights along the face, one per glyph on every other glyph.
  vec2 g = sydGrid;
  vec2 glyph = floor(cell / g);
  float row = sydCellOf(vec2(p.x, SYD_PODIUM - 0.02)).y;
  if (floor(row / g.y) == glyph.y && mod(glyph.x, 3.0) < 0.5 && p.x > -0.68 && p.x < -0.14) {
    float c;
    vec4 light = sydLight(cell, vec2(glyph.x * g.x, row), vec3(1.0, 0.78, 0.46), 0.75, c);
    if (c > 0.5) {
      return light;
    }
  }
  return vec4(0.3, 0.25, 0.22, 0.4);
}

// ---- The Harbour Bridge -------------------------------------------------

float sydLower(float x) {
  float u = (x - 0.5 * (SYD_SOUTH + SYD_NORTH)) / (0.5 * (SYD_NORTH - SYD_SOUTH) - 0.5 * SYD_PYLON_W);
  return SYD_SEA + 5.0 * SYD_M + 111.0 * SYD_M * (1.0 - u * u);
}

float sydUpper(float x) {
  float u = (x - 0.5 * (SYD_SOUTH + SYD_NORTH)) / (0.5 * (SYD_NORTH - SYD_SOUTH) - 0.5 * SYD_PYLON_W);
  return SYD_SEA + 70.0 * SYD_M + 64.0 * SYD_M * (1.0 - u * u);
}

float sydDeck() {
  return SYD_SEA + 49.0 * SYD_M;
}

// A line through a curve y(x) of the given slope, never thinner than one
// sample in either direction.
bool sydOnCurve(vec2 p, float y, float slope) {
  return abs(p.y - y) <= 0.5 * sydPx + 0.5 * sydPw * abs(slope);
}

// One granite pylon, centred at cx: a slight taper, a stepped crown, a
// floodlit face and a darker side.
vec4 sydPylon(vec2 p, float cx, float dim, out float cover) {
  cover = 0.0;
  float h = 89.0 * SYD_M;
  float v = (p.y - SYD_SEA) / h;
  if (v < 0.0 || v > 1.0) {
    return vec4(0.0);
  }
  float hw = 0.5 * SYD_PYLON_W * (1.0 - 0.08 * v) * (v > 0.93 ? 0.8 : 1.0);
  float dx = p.x - cx;
  if (abs(dx) > hw) {
    return vec4(0.0);
  }
  cover = 1.0;
  bool rim = v > 1.0 - sydPx / h || (v > 0.93 - sydPx / h && v <= 0.93 && abs(dx) > 0.8 * hw);
  vec3 stone = vec3(0.72, 0.64, 0.54) * dim;
  if (rim) {
    return vec4(stone * 1.25, 0.9);
  }
  // The face toward us is floodlit; the side turned away is not.
  return dx < 0.2 * hw ? vec4(stone, 0.55) : vec4(stone * 0.62, 0.42);
}

vec4 sydBridge(vec2 cell, vec2 p, float t, out float cover) {
  cover = 0.0;
  if (p.y < SYD_SEA || p.y > SYD_SEA + 140.0 * SYD_M || p.x < -0.13) {
    return vec4(0.0);
  }
  // Each end has a pair of pylons, one either side of the deck; the far
  // one shows just to the left of the near one.
  vec4 hit = sydPylon(p, SYD_SOUTH, 1.0, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydPylon(p, SYD_NORTH, 1.0, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydPylon(p, SYD_SOUTH - 0.013, 0.6, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydPylon(p, SYD_NORTH - 0.013, 0.6, cover);
  if (cover > 0.5) {
    return hit;
  }
  float deck = sydDeck();
  float a = SYD_SOUTH + 0.5 * SYD_PYLON_W;
  float b = SYD_NORTH - 0.5 * SYD_PYLON_W;
  float yl = sydLower(p.x);
  float yu = sydUpper(p.x);
  bool arch = p.x > a && p.x < b;
  // A red light on the crown pulses about every 1.8 seconds.
  float mid = 0.5 * (a + b);
  vec2 crown = sydCellOf(vec2(mid, sydUpper(mid) + sydPx));
  float glow = 0.5 + 0.5 * cos(t * 3.49);
  vec4 beacon = sydLight(cell, crown, vec3(1.0, 0.16, 0.12) * (0.45 + 0.55 * glow * glow), 0.7, cover);
  if (cover > 0.5) {
    return beacon;
  }
  // Lamps along the deck, one at every panel point.
  float panel = (b - a) / SYD_PANELS;
  float k = floor((p.x - a) / panel + 0.5);
  float lampX = a + k * panel;
  if (lampX > -0.12 + panel) {
    hit = sydLight(cell, sydCellOf(vec2(lampX, deck + 1.5 * sydPx)), vec3(1.0, 0.8, 0.5), 0.7, cover);
    if (cover > 0.5) {
      return hit;
    }
  }
  vec3 steel = vec3(0.6, 0.66, 0.78);
  // The deck runs the full width, two rows thick in dot charsets.
  if (abs(p.y - deck) <= (sydGrid.y > 1.5 ? 1.0 : 0.5) * sydPx) {
    cover = 1.0;
    return vec4(steel * 0.7, 0.8);
  }
  if (!arch) {
    return vec4(0.0);
  }
  float e = 0.004;
  if (sydOnCurve(p, yu, (sydUpper(p.x + e) - sydUpper(p.x - e)) / (2.0 * e)) || sydOnCurve(p, yl, (sydLower(p.x + e) - sydLower(p.x - e)) / (2.0 * e))) {
    cover = 1.0;
    return vec4(steel, 0.9);
  }
  float f = (p.x - a) / panel - k;
  // Hangers from the arch down to the deck at every panel point.
  if (p.y > deck && p.y < yl && abs(f) * panel <= 0.5 * sydPw) {
    cover = 1.0;
    return vec4(steel * 0.6, 0.6);
  }
  if (p.y > yl && p.y < yu) {
    float depth = yu - yl;
    float bv = (p.y - yl) / depth;
    // Posts at the panel points and one diagonal per panel, alternating.
    float fp = (p.x - a) / panel;
    float fk = floor(fp);
    float ff = fp - fk;
    float d = mod(fk, 2.0) < 0.5 ? ff - bv : ff - (1.0 - bv);
    bool post = abs(f) * panel <= 0.5 * sydPw;
    bool brace = abs(d) <= 0.5 * (sydPw / panel + sydPx / depth);
    // With one sample per glyph the bracing would fill solid: keep the
    // chords and every other post.
    if (sydDots < 0.5) {
      post = post && mod(k, 2.0) < 0.5;
      brace = false;
    }
    cover = 1.0;
    if (post || brace) {
      return vec4(steel * 0.62, 0.7);
    }
    return vec4(steel * 0.4, 0.0);
  }
  return vec4(0.0);
}

// ---- The city ---------------------------------------------------------

// Whether window id is lit. Most windows keep their state; a few switch,
// each on its own slow clock, and fade over a couple of seconds.
float sydWindowLit(vec3 id, float rate, float t) {
  float h = sydHash(id.yz + id.x * 7.13);
  if (sydHash(id.zy + id.x * 3.31 + 1.7) > 0.25) {
    return step(h, rate);
  }
  float period = 70.0 + 110.0 * sydHash(id.yz * 1.37 + id.x);
  float phase = t / period + h * 13.0;
  float k = floor(phase);
  float now = step(sydHash(vec2(k, h * 91.0)), rate);
  float next = step(sydHash(vec2(k + 1.0, h * 91.0)), rate);
  return mix(now, next, smoothstep(0.0, 2.5 / period, fract(phase) - (1.0 - 2.5 / period)));
}

// Towers on whole glyphs: Circular Quay and the CBD to the left of the
// Opera House, and lower North Sydney towers past the bridge. Each slot
// along x holds one tower with a window grid of one-glyph-wide windows on
// every other glyph and every other row; the tallest carry a slow red
// aviation light.
vec4 sydTowers(vec2 cell, vec2 p, float t, out float cover) {
  cover = 0.0;
  bool south = p.x < -0.52;
  bool north = p.x > SYD_NORTH + 0.06;
  if (!south && !north || p.y < SYD_SEA) {
    return vec4(0.0);
  }
  vec2 g = sydGrid;
  float group = floor(cell.x / g.x);
  float xg = sydCentre(vec2(group * g.x + 0.5 * (g.x - 1.0), cell.y)).x;
  float n = floor(xg / SYD_BLOCK);
  float ca = min(g.x * ceil((sydColumn(n * SYD_BLOCK) - 0.5 * g.x) / g.x), group * g.x);
  float cb = max(g.x * ceil((sydColumn((n + 1.0) * SYD_BLOCK) - 0.5 * g.x) / g.x), (group + 1.0) * g.x);
  float h1 = sydHash(vec2(n, 3.1));
  // The CBD climbs behind the south end of the Opera House and falls away
  // further left; North Sydney stays low.
  float tall = south ? (0.14 + 0.32 * h1) * (1.0 - 0.55 * smoothstep(-0.9, -1.6, xg)) : 0.035 + 0.06 * h1;
  float baseRow = g.y * floor(sydCellOf(vec2(xg, SYD_SEA)).y / g.y) + g.y;
  float rows = g.y * max(2.0, floor(tall / (sydPx * g.y)));
  float r = cell.y - baseRow;
  // A narrow gap between some neighbours, a whole glyph wide.
  float gap = sydHash(vec2(n, 5.7)) < 0.5 ? g.x : 0.0;
  float cc = cell.x - ca;
  float w = cb - ca - gap;
  if (r < 0.0 || r >= rows || cc >= w) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec3 tint = sydHash(vec2(n, 8.3)) < 0.65 ? vec3(1.0, 0.82, 0.52) : vec3(0.78, 0.86, 1.0);
  // The tallest towers carry a red light that pulses every 1.7 seconds.
  if (tall > 0.36) {
    vec2 top = vec2(ca + g.x * floor(0.5 * w / g.x), baseRow + rows);
    float glow = 0.5 + 0.5 * cos(t * 3.7 + n);
    float c;
    vec4 beacon = sydLight(cell, top - vec2(0.0, 1.0), vec3(1.0, 0.16, 0.12) * (0.45 + 0.55 * glow * glow), 0.7, c);
    if (c > 0.5 && r >= rows - g.y) {
      return beacon;
    }
  }
  // A dim facade, so each tower keeps its outline against the sky; lit
  // windows are brighter glyphs in it.
  vec3 wall = vec3(0.13, 0.15, 0.23) * (0.85 + 0.3 * sydHash(vec2(n, 4.4)));
  // Windows are whole glyphs on every other glyph column and row.
  float wc = floor(cc / g.x);
  float wr = floor(r / g.y);
  bool pane = mod(wc, 2.0) > 0.5 && cc < w - g.x && mod(wr, 2.0) < 0.5 && r < rows - g.y;
  if (!pane) {
    return vec4(wall, 0.3);
  }
  float rate = 0.35 + 0.35 * sydHash(vec2(n, 1.9));
  float lit = sydWindowLit(vec3(n, wc, wr), rate, t);
  vec3 col = sydHash(vec2(wc, wr) + n * 1.31) < 0.85 ? tint : vec3(1.0, 0.64, 0.34);
  return vec4(mix(wall, col * (0.75 + 0.25 * sydHash(vec2(wr, wc) + n)), lit), 0.3 + 0.6 * lit);
}

// Low dark headlands on the far shore, under the towers and the bridge's
// north end, with a few fixed lights.
vec4 sydShore(vec2 cell, vec2 p, out float cover) {
  cover = 0.0;
  float rise = p.x > 0.55 ? 0.022 + 0.01 * sin(p.x * 9.0) : p.x < -0.6 ? 0.012 : 0.0;
  if (p.y < SYD_SEA || p.y > SYD_SEA + rise) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 glyph = floor(cell / sydGrid);
  if (sydHash(glyph + 41.3) < 0.18) {
    vec2 spot = glyph * sydGrid + floor(vec2(sydHash(glyph + 2.3), sydHash(glyph + 6.1)) * sydGrid);
    return vec4(vec3(1.0, 0.78, 0.48) * (0.6 + 0.4 * sydHash(glyph)), spot == cell ? 0.8 : 0.0);
  }
  return vec4(0.1, 0.13, 0.18, 0.25);
}

// ---- Sky, ferry and water -----------------------------------------------

// One star at most per square of the box, each a single sample, glinting
// slowly in colour while its glyph stays put.
vec4 sydStar(vec2 uv, vec2 cell, float t) {
  vec2 s = vec2(uv.x * sydAspect, uv.y);
  float g = 0.032;
  vec2 id = floor(s / g);
  float h = sydHash(id + 23.0);
  if (h > 0.18 * smoothstep(0.4, 0.9, uv.y)) {
    return vec4(0.0);
  }
  vec2 at = (id + 0.15 + 0.7 * vec2(sydHash(id + 3.1), sydHash(id + 8.7))) * g;
  vec2 starCell = floor(vec2(at.x / sydAspect, at.y) * sydSamples);
  if (floor(starCell / sydGrid) != floor(cell / sydGrid)) {
    return vec4(0.0);
  }
  float b = 0.35 + 0.55 * sydHash(id + 9.2);
  float glint = 0.8 + 0.2 * sin(t * (0.3 + 0.6 * sydHash(id + 5.0)) + h * 40.0);
  // A full dot, or the lightest glyphs of a ramp, never a heavy one.
  float tone = sydDots > 0.5 ? 0.9 : 0.12 + 0.14 * b;
  return vec4(vec3(0.76, 0.82, 1.0) * b * glint, starCell == cell ? tone : 0.0);
}

// One harbour ferry: a green hull, a cream deckhouse with lit windows and
// a small wheelhouse, crossing about once every two and a half minutes.
// It moves a whole sample at a time.
// The ferry's bow, low and left, its keel on a glyph boundary.
vec2 sydFerryCell(float t) {
  float travel = mod(t * 0.012 + 0.9, 3.6) - 1.8;
  vec2 bow = sydCellOf(vec2(travel, SYD_SEA - 0.15));
  return vec2(bow.x, sydGrid.y * floor(bow.y / sydGrid.y));
}

vec4 sydFerry(vec2 cell, float t, out float cover) {
  cover = 0.0;
  if (sydFerryOn < 0.5) {
    return vec4(0.0);
  }
  vec2 bow = sydFerryCell(t);
  float len = max(12.0, floor(0.13 / sydPw));
  vec2 d = cell - bow;
  // One glyph row per part in dot charsets, so the hull, the deckhouse and
  // the wheelhouse never share a glyph.
  float rowsPer = sydGrid.y > 1.5 ? sydGrid.y : max(1.0, floor(0.011 / sydPx));
  float row = floor(d.y / rowsPer);
  if (d.x < 0.0 || d.x >= len || d.y < 0.0 || row > 2.0) {
    return vec4(0.0);
  }
  float u = d.x / len;
  if (row < 0.5) {
    // The hull tapers at both ends.
    if (u < 0.04 || u > 0.96) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.16, 0.42, 0.26, 0.75);
  }
  if (row < 1.5) {
    if (u < 0.1 || u > 0.9) {
      return vec4(0.0);
    }
    cover = 1.0;
    bool pane = mod(floor(d.x / sydGrid.x), 2.0) > 0.5;
    return pane ? vec4(1.0, 0.8, 0.48, 0.95) : vec4(0.9, 0.86, 0.74, 0.8);
  }
  if (u < 0.38 || u > 0.62) {
    return vec4(0.0);
  }
  cover = 1.0;
  return vec4(0.9, 0.86, 0.74, 0.8);
}

// Everything that stands above the water, without the sky.
vec4 sydAbove(vec2 cell, vec2 p, float t, out float cover) {
  vec4 hit = sydShells(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydPodium(cell, p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydBridge(cell, p, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = sydTowers(cell, p, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  return sydShore(cell, p, cover);
}

// The harbour: the scene mirrored, a little stretched, broken into short
// dashes that drift slowly along each row, with each row of samples
// swaying sideways by whole glyphs. Dark samples keep the colour of what
// they mirror, so lit dots stay bright.
vec4 sydWater(vec2 cell, vec2 p, float t) {
  float cover;
  vec4 boat = sydFerry(cell, t, cover);
  if (cover > 0.5) {
    return boat;
  }
  vec2 g = sydGrid;
  float depth = SYD_SEA - p.y;
  float shift = g.x * floor(1.2 * sin(cell.y * 0.71 + t * 0.35) + 0.5);
  float c0 = g.x * floor((cell.x + shift) / g.x);
  vec2 q = sydCentre(vec2(c0 + 0.5 * (g.x - 1.0), cell.y));
  vec2 m = vec2(q.x, SYD_SEA + depth * 0.75);
  vec2 mc = sydCellOf(m);
  vec4 src = sydAbove(mc, m, t, cover);
  // The ferry's own reflection, mirrored about its waterline.
  float keel = sydFerryCell(t).y;
  if (cell.y < keel) {
    vec4 own = sydFerry(vec2(cell.x, 2.0 * keel - 1.0 - cell.y), t, cover);
    if (cover > 0.5) {
      src = own;
    }
  }
  // Streaks on every other row of samples, in long dashes.
  float on = step(0.5, mod(cell.y, 2.0)) * step(-0.25, snoise(vec2(c0 * 0.06 + t * 0.04, cell.y * 0.35)));
  float fade = 1.0 - smoothstep(0.02, 0.16, depth);
  // Only lit things show in the water: the shells, lamps, windows and steel.
  vec4 hit = vec4(src.rgb * 0.55, src.a >= 0.6 ? 0.8 * on * fade : 0.0);
  if (sydDots < 0.5) {
    hit.a *= 0.45;
  }
  return hit;
}

// ---- Composition ------------------------------------------------------

vec4 sydCompose(vec2 uv, vec2 cell, vec2 p, float t) {
  if (p.y < SYD_SEA) {
    return sydWater(cell, p, t);
  }
  float cover;
  vec4 hit = sydAbove(cell, p, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  return sydStar(uv, cell, t);
}

vec2 sydCacheUv = vec2(-1.0);
float sydCacheT = -1.0;
vec4 sydCacheValue = vec4(0.0);

vec4 sydScene(vec2 uv, vec2 res, float t) {
  if (uv == sydCacheUv && t == sydCacheT) {
    return sydCacheValue;
  }
  sydLayout(res);
  vec2 cell = floor(uv * sydSamples);
  vec4 hit = sydCompose(uv, cell, sydFrame(uv), t);
  float tone = hit.a;
  if (sydDots > 0.5) {
    // Lights and outlines light every dot. Fills light every dot too when
    // the glyph colour carries brightness; otherwise an even share of them,
    // so the layers still part by density.
    bool lit = tone >= 0.85 || tone >= 0.15 && (sydSolid > 0.5 || tone * sydIntensity > sydBayer(cell));
    tone = lit ? max(tone, 0.6) : 0.0;
  } else {
    tone *= sqrt(sydIntensity);
  }
  sydCacheUv = uv;
  sydCacheT = t;
  sydCacheValue = vec4(hit.rgb * sydIntensity, tone);
  return sydCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return sydScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return sydScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night blue behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const NIGHT = "#050916";
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
        "linear-gradient(to bottom, #050916 0%, #050916 60%, #0a1226 72%, #050916 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface SydneyProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The ferry crossing the harbour. Default `true`. */
  ferry?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Sydney Harbour at night. The Opera House's shells stand lit cream-white
 * on their podium, the Harbour Bridge spans behind them between its
 * granite pylons, Circular Quay's towers hold grids of lit windows, and
 * one ferry crosses the calm water under their reflections. Decorative
 * and full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Sydney = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 40,
  intensity = 1,
  ferry = true,
  fallback = FALLBACK,
  ...props
}: SydneyProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        // Braille and quadrants light a dot only above half tone, so fills
        // are drawn there as ordered dot patterns instead.
        sydDots: gx * gy > 1 ? 1 : 0,
        sydFerryOn: ferry ? 1 : 0,
        sydGrid: [gx, gy],
        sydIntensity: clamp(intensity, 0, 1),
        sydSolid: SOLID_MODES.has(mode) ? 1 : 0,
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
