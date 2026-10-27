"use client";

import type { ReactNode } from "react";

import { resolveCharset, useAsciiColors } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, PhosphorName } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Ocean Drive at nightfall, seen from the water. Units are box heights: y
// runs from 0 at the bottom to 1 at the top and x is centred, so a portrait
// box shows fewer hotels instead of squashed ones. Every edge is a hard test
// against the sample grid, and window grids count whole samples, so the
// architecture lands on clean rows and columns of glyphs. Nothing built
// moves: only windows, beacons, stars, the water and one boat change.
//
// Tones are designed for glyphs: lights and neon sit high, outlines just
// above half (a Braille dot), and fills low. Braille and quadrants only
// light a dot above half tone, so `miFill` turns a fill into a regular share
// of dots there instead.
const SCENE = `
const float MI_WATER = 0.25;
const float MI_BASE = 0.268;
const float MI_LOT = 0.29;

const vec3 miMagenta = vec3(1.0, 0.25, 0.72);
const vec3 miCyan = vec3(0.22, 0.9, 1.0);
const vec3 miGold = vec3(1.0, 0.74, 0.3);
const vec3 miWarm = vec3(1.0, 0.8, 0.52);
const vec3 miCool = vec3(0.78, 0.9, 1.0);

// One sample in scene units, the sample's index, and 1 when the charset
// draws sub-cell dots. Set by miScene for each sample it evaluates.
vec2 miPx = vec2(0.01);
vec2 miS = vec2(0.0);
float miDots = 0.0;

// A 4x4 ordered threshold on the sample grid, in (0, 1).
float miBayer(vec2 s) {
  vec2 a = mod(s, 2.0);
  vec2 b = mod(floor(s * 0.5), 2.0);
  float hi = mod(2.0 * a.x + 3.0 * a.y, 4.0);
  float lo = mod(2.0 * b.x + 3.0 * b.y, 4.0);
  return (hi * 4.0 + lo + 0.5) / 16.0;
}

float miFill(float level) {
  if (miDots < 0.5) {
    return level;
  }
  return miBayer(miS) < level * 0.75 ? 0.6 : 0.0;
}

// True on the single sample row or column that holds a coordinate.
bool miRow(float y, float at) {
  return abs(y - at) < miPx.y * 0.5;
}

bool miCol(float x, float at) {
  return abs(x - at) < miPx.x * 0.5;
}

// A count of samples for a length in scene units, never below a minimum.
float miSamples(float size, float px, float least) {
  return max(least, floor(size / px + 0.5));
}

// A light that switches on or off now and then. Each one keeps its state
// for a minute or so and fades over about two seconds when it changes.
float miLit(vec2 id, float share, float t) {
  float period = 40.0 + 50.0 * hash21(id + 3.7);
  float e = t / period + hash21(id + 9.1) * 7.0;
  float now = step(hash21(id + floor(e) * 1.37), share);
  float before = step(hash21(id + (floor(e) - 1.0) * 1.37), share);
  return mix(before, now, smoothstep(0.0, 2.0 / period, fract(e)));
}

vec2 miSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return vec2(length(p - a - ab * h), h);
}

// ---- Sky ---------------------------------------------------------------

vec4 miSky(vec2 p, float t, float hw) {
  // A thin crescent moon, high on the right.
  vec2 m = p - vec2(hw * 0.58, 0.86);
  if (length(m) < 0.032 && length(m - vec2(0.013, 0.008)) > 0.029) {
    return vec4(1.0, 0.93, 0.78, 0.85);
  }

  // Sparse stars, one sample each, that brighten and dim slowly.
  if (p.y > 0.62) {
    vec2 g = floor(p / 0.045);
    float r = hash21(g + 31.0);
    vec2 at = (g + 0.2 + 0.6 * vec2(hash21(g + 4.0), hash21(g + 8.0))) * 0.045;
    if (r < 0.3 && miCol(p.x, at.x) && miRow(p.y, at.y)) {
      float tw = 0.5 + 0.5 * sin(t * (0.35 + r) + r * 40.0);
      // A dot in Braille and quadrants, a point or a colon in the ramps.
      float tone = miDots > 0.5 ? 0.58 + 0.2 * tw : 0.16 + 0.1 * tw;
      return vec4(vec3(0.85, 0.85, 1.0) * (0.55 + 0.45 * tw), tone);
    }
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// ---- Brickell towers -----------------------------------------------------

// Each tower: x centre, half width, height above the street, crown kind
// (0 flat, 1 slanted, 2 stepped, 3 rounded, 4 spire) and, for a lit crown,
// which neon (0 none, 1 magenta, 2 cyan, 3 gold). A beacon tops the tall ones.
void miTowerSpec(float i, out vec4 spec, out vec2 lit) {
  spec = vec4(-0.72, 0.03, 0.3, 0.0); lit = vec2(0.0, 0.0);
  if (i == 1.0) { spec = vec4(-0.55, 0.038, 0.4, 1.0); lit = vec2(0.0, 0.0); }
  if (i == 2.0) { spec = vec4(-0.39, 0.028, 0.35, 4.0); lit = vec2(0.0, 1.0); }
  if (i == 3.0) { spec = vec4(-0.22, 0.044, 0.49, 2.0); lit = vec2(3.0, 1.0); }
  if (i == 4.0) { spec = vec4(-0.04, 0.032, 0.43, 0.0); lit = vec2(2.0, 0.0); }
  if (i == 5.0) { spec = vec4(0.13, 0.046, 0.56, 0.0); lit = vec2(0.0, 1.0); }
  if (i == 6.0) { spec = vec4(0.3, 0.034, 0.45, 3.0); lit = vec2(1.0, 1.0); }
  if (i == 7.0) { spec = vec4(0.47, 0.04, 0.37, 0.0); lit = vec2(0.0, 0.0); }
  if (i == 8.0) { spec = vec4(0.63, 0.028, 0.32, 1.0); lit = vec2(2.0, 0.0); }
  if (i == 9.0) { spec = vec4(0.8, 0.036, 0.27, 0.0); lit = vec2(0.0, 0.0); }
}

vec3 miNeonOf(float k) {
  return k < 1.5 ? miMagenta : k < 2.5 ? miCyan : miGold;
}

// The roof height of a tower at local x.
float miTowerTop(float x, float halfW, float h, float crown) {
  if (crown == 1.0) {
    return h - (x + halfW) * 0.45;
  }
  if (crown == 2.0) {
    return abs(x) < halfW * 0.4 ? h : abs(x) < halfW * 0.72 ? h - 0.022 : h - 0.044;
  }
  if (crown == 3.0) {
    float u = clamp(x / halfW, -1.0, 1.0);
    return h - 0.05 + 0.05 * sqrt(1.0 - u * u);
  }
  return h;
}

vec4 miTowers(vec2 p, float t) {
  for (int k = 0; k < 10; k++) {
    float i = float(k);
    vec4 spec;
    vec2 lit;
    miTowerSpec(i, spec, lit);
    vec2 q = vec2(p.x - spec.x, p.y - MI_BASE);
    float halfW = spec.y;
    float crown = spec.w;
    float top = miTowerTop(q.x, halfW, spec.z, crown);

    // A spire or a beacon above the roof.
    if (crown == 4.0 && miCol(q.x, 0.0) && q.y > top && q.y < top + 0.07) {
      return vec4(miCool * 0.7, 0.62);
    }
    float tip = crown == 4.0 ? top + 0.07 : top;
    if (lit.y > 0.5 && miCol(q.x, 0.0) && miRow(q.y, tip + miPx.y)) {
      // An aviation light: one slow pulse every 1.8 seconds.
      float f = fract(t / 1.8 + i * 0.37);
      float pulse = smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.3, 0.75, f));
      return vec4(1.0, 0.18, 0.2, 0.9 * pulse);
    }

    if (abs(q.x) >= halfW || q.y < 0.0 || q.y >= top) {
      continue;
    }
    float leftOut = abs(q.x - miPx.x) >= halfW ? 1.0 : 0.0;
    float rightOut = abs(q.x + miPx.x) >= halfW ? 1.0 : 0.0;
    float topOut = q.y + miPx.y >= miTowerTop(q.x, halfW, spec.z, crown) ? 1.0 : 0.0;
    float sideOut = q.y + miPx.y >= miTowerTop(q.x + miPx.x, halfW, spec.z, crown)
      || q.y + miPx.y >= miTowerTop(q.x - miPx.x, halfW, spec.z, crown) ? 1.0 : 0.0;
    if (topOut + sideOut > 0.5 && q.y > 0.04) {
      // The crown line: neon on the lit towers, a pale edge on the rest.
      if (lit.x > 0.5) {
        return vec4(miNeonOf(lit.x) * mix(0.35, 1.0, miNeon), 0.6 + 0.3 * miNeon);
      }
      return vec4(vec3(0.34, 0.42, 0.62), 0.58);
    }
    if (leftOut + rightOut > 0.5) {
      return vec4(vec3(0.22, 0.28, 0.46), 0.55);
    }

    // Glass floors: one row of windows every few sample rows, a window in
    // every other column, counted from the left edge so the spacing stays
    // even across the face.
    float floorH = miSamples(0.013, miPx.y, 2.0);
    float row = floor(q.y / miPx.y);
    float colW = miSamples(0.009, miPx.x, 2.0);
    float col = floor((q.x + halfW) / miPx.x);
    float cols = floor(halfW * 2.0 / miPx.x);
    if (mod(row, floorH) < 1.0 && mod(col, colW) > 0.5 && mod(col, colW) < 1.5 && col < cols - 1.0) {
      // Offices light a few windows at a time along a floor.
      vec2 id = vec2(i * 97.0 + floor(col / colW / 3.0), floor(row / floorH));
      float on = miLit(id, 0.32, t);
      float tint = hash21(id + 0.5);
      vec3 c = tint < 0.7 ? miCool : tint < 0.88 ? vec3(0.5, 0.95, 1.0) : miWarm;
      return vec4(c * mix(0.2, 0.7, on), mix(0.0, 0.76, on));
    }
    // Dark glass: no glyph, but it hides what is behind.
    return vec4(0.0);
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// ---- Ocean Drive hotels -----------------------------------------------------

// The hotel on a lot: half width, body height, parapet steps, step height,
// then the fin's x (relative to the centre) and top (0 for no fin), whether
// it has portholes, whether its eyebrows carry neon, and its neon colours.
float miKind(float id) {
  return mod(id, 5.0);
}

void miHotelSpec(float id, out vec4 body, out vec4 extra) {
  float kind = miKind(id);
  // body: half width, height, steps, step height
  // extra: fin x, fin top, portholes, neon eyebrows
  body = vec4(0.118, 0.17, 3.0, 0.02); extra = vec4(0.0, 0.3, 0.0, 1.0);
  if (kind == 1.0) { body = vec4(0.125, 0.14, 3.0, 0.018); extra = vec4(0.0, 0.0, 1.0, 0.0); }
  if (kind == 2.0) { body = vec4(0.088, 0.2, 1.0, 0.018); extra = vec4(-0.058, 0.27, 0.0, 0.0); }
  if (kind == 3.0) { body = vec4(0.114, 0.21, 2.0, 0.022); extra = vec4(0.0, 0.0, 1.0, 1.0); }
  if (kind == 4.0) { body = vec4(0.108, 0.115, 1.0, 0.016); extra = vec4(0.08, 0.19, 0.0, 1.0); }
}

bool miHotelIn(vec2 q, vec4 body, vec4 extra) {
  if (q.y < 0.0) {
    return false;
  }
  if (abs(q.x) < body.x && q.y < body.y) {
    return true;
  }
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    if (fi >= body.z) {
      break;
    }
    float w = body.x * (0.62 - 0.17 * fi);
    if (abs(q.x) < w && q.y < body.y + (fi + 1.0) * body.w) {
      return true;
    }
  }
  float finW = max(miPx.x * 1.01, 0.007);
  return extra.y > 0.0 && abs(q.x - extra.x) < finW && q.y < extra.y;
}

vec4 miHotels(vec2 p, float t) {
  float id = floor(p.x / MI_LOT + 0.5);
  vec2 q = vec2(p.x - id * MI_LOT, p.y - MI_BASE);
  vec4 body;
  vec4 extra;
  miHotelSpec(id, body, extra);
  float halfW = body.x;
  float h = body.y;
  vec3 neon = miNeonOf(1.0 + mod(id, 3.0));
  vec3 neon2 = miNeonOf(1.0 + mod(id + 1.0, 3.0));
  float n = miNeon;
  float k = mod(id * 7.0, 5.0);
  vec3 wall = k < 1.0 ? vec3(1.0, 0.72, 0.8)
    : k < 2.0 ? vec3(0.65, 1.0, 0.86)
    : k < 3.0 ? vec3(1.0, 0.92, 0.66)
    : k < 4.0 ? vec3(0.8, 0.74, 1.0)
    : vec3(0.95, 0.95, 0.92);

  // Floors: a ground floor of shopfronts, then storeys of a few sample rows
  // each, capped by an eyebrow ledge that sticks out past the corners.
  float ground = 0.022;
  float floorH = miSamples(0.03, miPx.y, 3.0);
  float rows = floor((q.y - ground) / miPx.y);
  float inFloor = mod(rows, floorH);
  float storey = floor(rows / floorH);
  float topStorey = floor((h - 0.012 - ground) / miPx.y / floorH);
  bool facade = q.y > ground && storey < topStorey;
  bool eyebrow = facade && inFloor > floorH - 1.5;
  if (eyebrow && abs(q.x) < halfW + miPx.x * 1.01 && abs(q.x) >= halfW) {
    return vec4(wall * 0.8, 0.6);
  }

  if (!miHotelIn(q, body, extra)) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float finW = max(miPx.x * 1.01, 0.007);
  bool onFin = extra.y > 0.0 && abs(q.x - extra.x) < finW && (q.y >= h || abs(q.x) >= halfW * 0.6);
  bool openUp = !miHotelIn(q + vec2(0.0, miPx.y), body, extra);
  bool openSide = !miHotelIn(q + vec2(miPx.x, 0.0), body, extra)
    || !miHotelIn(q - vec2(miPx.x, 0.0), body, extra);

  // Neon traces the roofline, every step of the parapet and the fin.
  if (openUp && q.y > h * 0.5) {
    return vec4(neon * mix(0.3, 1.0, n), 0.62 + 0.33 * n);
  }
  if (onFin) {
    if (openSide) {
      return vec4(neon * mix(0.3, 1.0, n), 0.62 + 0.33 * n);
    }
    // The blade sign: stacked letters, a lit row and a dark row.
    float lit = mod(floor((extra.y - q.y) / miPx.y), 2.0) < 1.0 ? 1.0 : 0.0;
    return vec4(neon2 * mix(0.25, 1.0, n * lit), mix(0.3, 0.9, n * lit));
  }
  if (openSide) {
    return vec4(wall * 0.75, 0.58);
  }

  // The parapet steps: plain wall, with portholes on the first step.
  if (q.y >= h) {
    if (extra.z > 0.5 && q.y < h + body.w) {
      vec2 d = vec2(mod(q.x + 0.5 * 0.024, 0.024) - 0.012, q.y - h - body.w * 0.5) / miPx;
      if (length(d) < max(1.1, 0.0045 / miPx.y)) {
        return vec4(miWarm, 0.8);
      }
    }
    return vec4(wall * 0.55, miFill(0.3));
  }

  // Shopfronts: a warm lit band broken by pilasters.
  float col = floor(abs(q.x) / miPx.x);
  float colW = miSamples(0.02, miPx.x, 2.0);
  if (q.y < ground) {
    if (mod(col, colW * 2.0) < 1.0) {
      return vec4(wall * 0.6, 0.58);
    }
    return vec4(miWarm * 0.9, 0.74);
  }
  if (eyebrow) {
    if (extra.w > 0.5) {
      return vec4(neon2 * mix(0.3, 1.0, n), 0.6 + 0.3 * n);
    }
    return vec4(wall * 0.85, 0.6);
  }

  // Windows, mirrored about the centre, a sample row under each eyebrow.
  // Hotels with portholes put a round window down the middle instead.
  if (facade && inFloor > 0.5 && inFloor < floorH - 1.5) {
    if (extra.z > 0.5 && abs(q.x) < 0.012) {
      vec2 d = vec2(q.x, mod(q.y - ground, floorH * miPx.y) - floorH * miPx.y * 0.45) / miPx;
      if (length(d) < max(1.1, 0.0045 / miPx.y)) {
        return vec4(miWarm, 0.8);
      }
      return vec4(wall * 0.55, miFill(0.3));
    }
    float edge = floor(halfW / miPx.x);
    if (mod(col, colW) < colW * 0.5 && col < edge - 1.0) {
      vec2 id2 = vec2(id * 53.0 + col * sign(q.x + 1e-4), storey);
      float on = miLit(id2, 0.72, t);
      float tint = hash21(id2 + 2.0);
      vec3 c = tint < 0.75 ? miWarm : tint < 0.9 ? vec3(1.0, 0.62, 0.72) : miCool;
      return vec4(c * mix(0.25, 1.0, on), mix(0.0, 0.8, on));
    }
  }
  return vec4(wall * 0.55, miFill(0.3));
}

// ---- Palms --------------------------------------------------------------

// A still palm: a curved trunk and a crown of tapered fronds that arch
// out and droop, their edges notched where the leaflets part. Drawn dark,
// so it reads as a silhouette against the lit hotels behind it.
vec4 miPalm(vec2 p, vec2 base, float height, float lean, float seed) {
  vec3 trunkCol = vec3(0.24, 0.16, 0.2);
  vec3 leafCol = vec3(0.1, 0.3, 0.24);
  vec4 hit = vec4(0.0, 0.0, 0.0, -1.0);

  float s = (p.y - base.y) / height;
  if (s >= 0.0 && s <= 1.0) {
    float cx = base.x + lean * s * s;
    float w = max(mix(0.0065, 0.004, s), miPx.x * 0.5);
    if (abs(p.x - cx) < w) {
      float ring = mod(floor((p.y - base.y) / miPx.y), 3.0) < 1.0 ? 0.7 : 1.0;
      hit = vec4(trunkCol * ring, 0.8);
    }
  }

  vec2 c = vec2(base.x + lean, base.y + height);
  if (abs(p.x - c.x) > 0.15 || abs(p.y - c.y) > 0.11) {
    return hit;
  }
  for (int f = 0; f < 9; f++) {
    float ff = float(f);
    float rf = hash21(vec2(seed, ff + 3.0));
    // Spread from just below one horizon to just below the other, the
    // flatter ones longer and heavier.
    float ang = mix(-0.25, 3.39, ff / 8.0) + (rf - 0.5) * 0.18;
    float flat1 = 1.0 - abs(sin(ang));
    float len = 0.07 + 0.04 * flat1 + 0.012 * rf;
    float droop = 0.012 + 0.06 * flat1;
    vec2 dir = vec2(cos(ang), sin(ang) * 0.85);
    vec2 prev = c;
    for (int j = 1; j <= 5; j++) {
      float u = float(j) / 5.0;
      vec2 next = c + dir * len * u - vec2(0.0, droop * u * u);
      vec2 seg = miSegment(p, prev, next);
      float along = (float(j - 1) + seg.y) / 5.0;
      float notch = step(0.5, fract(along * len / 0.016)) * 0.3 + 0.7;
      float w = 0.011 * sin(3.14159 * min(along * 0.9 + 0.1, 1.0)) * notch;
      if (seg.x < max(w, miPx.y * 0.6)) {
        hit = vec4(leafCol, 0.8);
      }
      prev = next;
    }
  }
  return hit;
}

vec4 miPalms(vec2 p, float hw) {
  vec4 a = miPalm(p, vec2(-hw * 0.82, MI_WATER - 0.004), 0.4, 0.06, 1.0);
  if (a.a >= 0.0) {
    return a;
  }
  if (hw > 0.6) {
    vec4 b = miPalm(p, vec2(-hw * 0.7, MI_WATER - 0.004), 0.31, -0.04, 2.0);
    if (b.a >= 0.0) {
      return b;
    }
  }
  return miPalm(p, vec2(hw * 0.8, MI_WATER - 0.004), 0.43, -0.07, 3.0);
}

// ---- Shore and water -------------------------------------------------------

// The promenade: the seawall's edge with low bollard lights along it.
vec4 miShore(vec2 p) {
  if (miRow(p.y, MI_WATER + miPx.y * 0.5)) {
    float slot = floor(p.x / 0.065 + 0.5);
    if (miCol(p.x, slot * 0.065)) {
      return vec4(miWarm, 0.88);
    }
    return vec4(vec3(0.5, 0.42, 0.55), 0.56);
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// Everything above the water that can light it.
vec4 miLand(vec2 p, float t, float hw) {
  if (p.y < MI_BASE) {
    vec4 shore = miShore(p);
    if (shore.a >= 0.0) {
      return shore;
    }
  }
  vec4 hotel = miHotels(p, t);
  if (hotel.a >= 0.0) {
    return hotel;
  }
  vec4 tower = miTowers(p, t);
  if (tower.a >= 0.0) {
    return tower;
  }
  return miSky(p, t, hw);
}

// A small boat crossing the bay very slowly: a hull line, two cabin
// windows and a white masthead light.
vec4 miBoat(vec2 p, float t, float hw) {
  float span = hw * 2.0 + 0.4;
  float x = mod(t * 0.011 + 0.3, span) - span * 0.5;
  vec2 q = p - vec2(x, 0.14);
  if (miRow(q.y, 0.0) && abs(q.x) < 0.035) {
    return vec4(vec3(0.6, 0.6, 0.7), 0.6);
  }
  if (miRow(q.y, miPx.y) && abs(q.x + 0.004) < 0.018) {
    float win = mod(floor(q.x / miPx.x), 3.0) < 1.0 ? 1.0 : 0.0;
    return vec4(mix(vec3(0.4, 0.4, 0.5), miWarm, win), mix(0.56, 0.85, win));
  }
  if (miCol(q.x, -0.006) && q.y > 0.0 && q.y < 0.05) {
    return miRow(q.y, 0.05 - miPx.y * 0.5) ? vec4(1.0, 1.0, 1.0, 0.9) : vec4(vec3(0.4, 0.4, 0.5), 0.56);
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// Calm water: only lights reflect, as dimmer copies stretched downward and
// broken into short dashes that come and go slowly, sparser with depth.
vec4 miWater(vec2 p, float t, float hw) {
  vec4 boat = miBoat(p, t, hw);
  if (boat.a >= 0.0) {
    return boat;
  }
  float depth = MI_WATER - p.y;
  float row = floor(depth / miPx.y);
  float dash = floor(p.x / 0.008 + hash21(vec2(row, 1.0)) * 4.0);
  float flip = floor(t * 0.45 + hash21(vec2(row, dash)) * 9.0);
  float keep = hash21(vec2(row * 1.3 + dash, flip));
  if (keep > mix(0.72, 0.18, clamp(depth / 0.24, 0.0, 1.0))) {
    return vec4(0.0);
  }
  vec4 src = miLand(vec2(p.x, MI_WATER + depth * 0.62), t, hw);
  // Neon, beacons and the shore lights reflect; only some windows do.
  float col = floor(p.x / miPx.x);
  if (src.a < 0.84 && (src.a < 0.7 || hash21(vec2(col, 4.0)) > 0.3)) {
    return vec4(0.0);
  }
  // Dimmer means toward the paper, which is white on a light theme.
  vec3 dim = miOnLight > 0.5 ? mix(src.rgb, vec3(1.0), 0.5) : src.rgb * 0.5;
  return vec4(dim, miDots > 0.5 ? 0.64 : 0.36);
}

vec2 miCacheUv = vec2(-1.0);
float miCacheT = -1.0;
vec4 miCacheValue = vec4(0.0);

vec4 miScene(vec2 uv, vec2 res, float t) {
  if (uv == miCacheUv && t == miCacheT) {
    return miCacheValue;
  }
  float aspect = res.x / res.y;
  miPx = vec2(aspect / ascii_samples.x, 1.0 / res.y);
  miS = floor(uv * ascii_samples);
  miDots = step(1.5, miGrid.x * miGrid.y);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float hw = aspect * 0.5;

  vec4 c = miPalms(p, hw);
  if (c.a < 0.0) {
    c = p.y < MI_WATER ? miWater(p, t, hw) : miLand(p, t, hw);
  }
  vec3 col = c.rgb;
  float tone = max(c.a, 0.0);
  // Intensity thins the tone by its square root, so Braille dots survive
  // longer than the colour does, and fades the colour toward the paper.
  tone *= sqrt(miIntensity);
  if (miOnLight > 0.5) {
    // Neon and pastels vanish on a light paper; deepen them.
    col = mix(vec3(1.0), col * col * 0.8, miIntensity);
  } else {
    col *= miIntensity;
  }
  tone = tone < 0.04 ? 0.0 : tone;
  miCacheUv = uv;
  miCacheT = t;
  miCacheValue = vec4(col, tone);
  return miCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return miScene(uv, res, t).a;
}
`;

// Braille and quadrant cells show one colour for all their dots, which the
// engine averages over every sample. Giving each sample the colour of the
// strongest sample in its cell keeps a one-dot neon line its own colour
// instead of fading into the dark around it.
const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 origin = floor(floor(uv * ascii_samples) / miGrid) * miGrid;
  vec4 best = vec4(0.0, 0.0, 0.0, -1.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 2; x++) {
      if (float(x) < miGrid.x && float(y) < miGrid.y) {
        vec4 c = miScene((origin + vec2(float(x), float(y)) + 0.5) / ascii_samples, res, t);
        if (c.a > best.a) {
          best = c;
        }
      }
    }
  }
  return best.rgb;
}
`;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #07051a 0%, #1a0f3a 45%, #4a1d5a 62%, #0a0a18 75%, #05050f 100%)",
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

export interface MiamiProps extends AsciiSceneProps {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** Brightness of the neon on the hotels and the lit tower crowns, from 0 (off) to 1. Default 1. */
  neon?: number;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a night gradient. */
  fallback?: ReactNode;
}

/**
 * Miami. Ocean Drive at nightfall, seen from the water: a row of art deco
 * hotels with stepped parapets and neon trim, the glass towers of Brickell
 * behind, still palms in front and the lights reflected in the bay.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Miami = ({
  intensity = 1,
  neon = 1,
  paper = "--ascii-paper",
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  cell = 9,
  fps = 30,
  stillTime = 12,
  // Part of the shared scene props; nothing here follows the pointer.
  interactive: _interactive,
  fallback = FALLBACK,
  ...props
}: MiamiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        miGrid: [gx, gy],
        miIntensity: clamp(intensity, 0, 1),
        miNeon: clamp(neon, 0, 1),
        miOnLight: onLight ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={phosphor === undefined ? paper : undefined}
      cell={cell}
      fps={fps}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
