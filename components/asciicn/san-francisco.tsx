"use client";

import type { ReactNode } from "react";

import { resolveCharset, useAsciiColors } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, PhosphorName } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The Golden Gate Bridge at night, seen from the ocean side looking in:
// the Marin Headlands on the left, the city on the right. Units are box
// heights: y runs from 0 at the bottom to 1 at the top and x is centred.
// The towers move apart as the box gets wider and keep their height, so a
// phone still shows the whole span. Every edge is a hard test against the
// sample grid, curves are drawn one sample thick with no gaps, and the
// suspenders fall on whole sample columns, so the bridge is drawn in clean
// glyphs. Nothing built moves: only lamps, beacons, stars, a few cars, the
// fog and the water change.
//
// Tones are designed for glyphs: lights high, steel and outlines above half
// (a Braille dot), fills low. Braille and quadrants only light a dot above
// half tone, so `sfFill` turns a fill into a regular share of dots there.
const SCENE = `
const float SF_WATER = 0.2;
const float SF_DECK = 0.33;
const float SF_TOP = 0.72;

const vec3 sfOrange = vec3(0.98, 0.34, 0.16);
const vec3 sfSteel = vec3(0.72, 0.22, 0.12);
const vec3 sfAmber = vec3(1.0, 0.7, 0.32);
const vec3 sfWarm = vec3(1.0, 0.82, 0.55);
const vec3 sfCool = vec3(0.78, 0.88, 1.0);

// One sample in scene units, the sample's index, and 1 when the charset
// draws sub-cell dots. Set by sfScene for each sample it evaluates.
vec2 sfPx = vec2(0.01);
vec2 sfS = vec2(0.0);
float sfDots = 0.0;

// The bridge layout for this box: its centre, the half span between the
// towers, and the side spans out to the anchorages.
float sfMid = 0.0;
float sfHalf = 0.4;
float sfSide = 0.11;
float sfHalfWidth = 0.5;
float sfFogTime = 0.0;

// A 4x4 ordered threshold on the sample grid, in (0, 1).
float sfBayer(vec2 s) {
  vec2 a = mod(s, 2.0);
  vec2 b = mod(floor(s * 0.5), 2.0);
  float hi = mod(2.0 * a.x + 3.0 * a.y, 4.0);
  float lo = mod(2.0 * b.x + 3.0 * b.y, 4.0);
  return (hi * 4.0 + lo + 0.5) / 16.0;
}

float sfFill(float level) {
  if (sfDots < 0.5) {
    return level;
  }
  return sfBayer(sfS) < level * 0.75 ? 0.6 : 0.0;
}

// True on the single sample row or column that holds a coordinate.
bool sfRow(float y, float at) {
  return abs(y - at) < sfPx.y * 0.5;
}

bool sfCol(float x, float at) {
  return abs(x - at) < sfPx.x * 0.5;
}

// A count of samples for a length in scene units, never below a minimum.
float sfSamples(float size, float px, float least) {
  return max(least, floor(size / px + 0.5));
}

// True when a curve y = at, with slope dy/dx, passes through this sample:
// one sample thick, and as many rows per column as the slope needs so a
// steep stretch has no gaps.
bool sfCurve(vec2 p, float at, float slope) {
  float rise = abs(slope) * sfPx.x / sfPx.y;
  return abs(p.y - at) / sfPx.y < 0.5 + rise * 0.5;
}

// A light that switches on or off now and then. Each one keeps its state
// for a minute or so and fades over about two seconds when it changes.
float sfLit(vec2 id, float share, float t) {
  float period = 40.0 + 50.0 * hash21(id + 3.7);
  float e = t / period + hash21(id + 9.1) * 7.0;
  float now = step(hash21(id + floor(e) * 1.37), share);
  float before = step(hash21(id + (floor(e) - 1.0) * 1.37), share);
  return mix(before, now, smoothstep(0.0, 2.0 / period, fract(e)));
}

// An aviation light: one slow pulse every 1.8 seconds.
float sfPulse(float t, float phase) {
  float f = fract(t / 1.8 + phase);
  return smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.3, 0.75, f));
}

vec4 sfNone() {
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// ---- The towers ------------------------------------------------------------

// The outer half width of a tower at height y: the legs step in at each
// portal strut above the deck.
float sfTowerHalf(float y) {
  float h = (y - SF_DECK) / (SF_TOP - SF_DECK);
  return h < 0.36 ? 0.04 : h < 0.62 ? 0.036 : h < 0.82 ? 0.032 : 0.029;
}

// One tower, centred on x = cx: two legs joined by four portal struts above
// the deck, the top one at the crown, and X bracing between the legs below
// the deck. Each portal opening has two stepped corners at its head, and
// each leg a darker flute down its face.
vec4 sfTower(vec2 p, float cx, float t, float phase) {
  float x = p.x - cx;
  float y = p.y;
  if (y < SF_WATER || y > SF_TOP + 0.03) {
    return sfNone();
  }
  // The beacon on the crown, and the cable saddle under it.
  if (sfCol(x, 0.0) && sfRow(y, SF_TOP + sfPx.y * 2.0)) {
    return vec4(1.0, 0.16, 0.14, 0.92 * sfPulse(t, phase));
  }
  if (y > SF_TOP) {
    return sfNone();
  }
  // The concrete pier the tower stands on.
  if (y < SF_WATER + 0.022) {
    return abs(x) < 0.047 ? vec4(vec3(0.42, 0.42, 0.48), 0.62) : sfNone();
  }

  float half1 = sfTowerHalf(y);
  if (abs(x) >= half1) {
    return sfNone();
  }
  float leg = half1 * 0.48;
  float inner = half1 - leg;
  float ax = abs(x);
  bool onLeg = ax >= inner;

  // Struts: heights as a share of the tower above the deck.
  float h = (y - SF_DECK) / (SF_TOP - SF_DECK);
  float strutH = max(0.012, sfPx.y * 2.0) / (SF_TOP - SF_DECK);
  float strut = -1.0;
  if (h > 0.36 - strutH && h < 0.36) strut = 0.36;
  if (h > 0.62 - strutH && h < 0.62) strut = 0.62;
  if (h > 0.82 - strutH && h < 0.82) strut = 0.82;
  if (h > 1.0 - strutH * 1.4) strut = 1.0;
  // Below the deck, a strut at the road and a pair of X braces.
  if (h < 0.0 && h > -strutH) strut = 0.0;

  // The stepped head of each portal: just under a strut the opening
  // narrows twice, a step of one leg flute each.
  float head = 1e3;
  if (h > 0.0) {
    float next = h < 0.36 ? 0.36 : h < 0.62 ? 0.62 : h < 0.82 ? 0.82 : 1.0;
    head = (next - strutH - h) * (SF_TOP - SF_DECK);
  }
  float step1 = max(sfPx.y * 2.0, 0.008);
  float notch = head < step1 ? (head < step1 * 0.5 ? 2.0 : 1.0) : 0.0;
  bool corner = !onLeg && ax >= inner - notch * max(sfPx.x, 0.004);

  vec3 lit = sfOrange;
  if (strut >= 0.0 || onLeg || corner) {
    // Floodlit from below: the faces are brightest near the deck.
    float glow = mix(1.0, 0.78, clamp(h, 0.0, 1.0));
    if (onLeg && strut < 0.0) {
      // The flute down the middle of each leg, and the outer edge.
      float mid = inner + leg * 0.5;
      if (abs(ax - mid) < sfPx.x * 0.5 && leg > sfPx.x * 2.5) {
        return vec4(sfSteel * 0.75, 0.62);
      }
    }
    return vec4(lit * glow, 0.82);
  }

  // Under the deck: X bracing between the legs.
  if (h < 0.0) {
    float span = SF_DECK - SF_WATER - 0.022;
    float v = (y - SF_WATER - 0.022) / span;
    float u = x / inner;
    float k = v;
    float diag = abs(abs(u) - abs(k * 2.0 - 1.0));
    if (diag * inner / sfPx.x < 0.6) {
      return vec4(sfSteel, 0.7);
    }
  }
  return sfNone();
}

// ---- Cable, suspenders and deck ---------------------------------------------

// The main cable's height at x and its slope: a parabola from tower crown
// to tower crown that comes down almost to the road at mid-span, then a
// shallower sag down each side span to the anchorages.
vec2 sfCable(float x) {
  float top = SF_TOP - 0.004;
  float low = SF_DECK + 0.014;
  float u = (x - sfMid) / sfHalf;
  if (abs(u) <= 1.0) {
    return vec2(low + (top - low) * u * u, 2.0 * (top - low) * u / sfHalf);
  }
  // Side span: from the crown down to the anchorage at deck height, sagging
  // below the straight line a little.
  float s = (abs(u) - 1.0) * sfHalf / sfSide;
  float anchor = SF_DECK + 0.006;
  float line = mix(top, anchor, s);
  float sag = 0.035 * s * (1.0 - s);
  float dir = sign(u);
  float slope = ((anchor - top) / sfSide - 0.035 * (1.0 - 2.0 * s) / sfSide) * dir;
  return vec2(line - sag, slope);
}

vec4 sfSpan(vec2 p, float t) {
  float u = (p.x - sfMid) / sfHalf;
  float reach = 1.0 + sfSide / sfHalf;
  float truss = max(0.016, sfPx.y * 3.0);

  // The main cable, drawn in front of everything but the towers. It rides
  // over the crowns, so nothing of it shows through the portals.
  float nearTower = min(abs(p.x - sfMid + sfHalf), abs(p.x - sfMid - sfHalf));
  if (abs(u) <= reach && nearTower > 0.041) {
    vec2 c = sfCable(p.x);
    if (p.y > SF_DECK && sfCurve(p, c.x, c.y)) {
      return vec4(sfOrange, 0.9);
    }
    // Suspenders: one every few sample columns, counted from mid-span so
    // the two halves match.
    // In the ramp charsets a light tone draws them as a column of colons.
    float gap = sfSamples(0.014, sfPx.x, sfDots > 0.5 ? 3.0 : 4.0);
    float col = floor((p.x - sfMid) / sfPx.x + 0.5);
    if (mod(col, gap) < 0.5 && p.y > SF_DECK && p.y < c.x - sfPx.y * 0.5) {
      // High enough that the dots survive a dimmed intensity.
      return vec4(sfOrange * 0.8, sfDots > 0.5 ? 0.7 : 0.24);
    }
  }

  // The deck: the road on top, lamps along it, cars, and the stiffening
  // truss underneath as two chords with posts between them.
  float roadRow = SF_DECK + sfPx.y * 0.5;
  if (sfRow(p.y, roadRow + sfPx.y)) {
    // Cars, one light each: white headlights one way, red tail lights the
    // other, crossing slowly.
    for (int k = 0; k < 6; k++) {
      float fk = float(k);
      if (fk >= sfTraffic * 6.0) {
        break;
      }
      float dir = mod(fk, 2.0) < 0.5 ? 1.0 : -1.0;
      float span = 2.0 * (sfHalf + sfSide) + 0.5;
      float speed = 0.016 + 0.006 * hash21(vec2(fk, 2.0));
      float x = (mod(t * speed + hash21(vec2(fk, 7.0)) * span, span) - span * 0.5) * dir + sfMid;
      if (sfCol(p.x, x)) {
        return dir > 0.0 ? vec4(1.0, 0.96, 0.85, 0.95) : vec4(1.0, 0.2, 0.16, 0.9);
      }
    }
    // Sodium lamps along the rail.
    float lamp = floor((p.x - sfMid) / 0.034 + 0.5);
    if (sfCol(p.x, sfMid + lamp * 0.034)) {
      return vec4(sfAmber, 0.88);
    }
  }
  if (p.y < SF_DECK && p.y > SF_DECK - truss) {
    bool chord = sfRow(p.y, roadRow - sfPx.y) || sfRow(p.y, SF_DECK - truss + sfPx.y * 0.5);
    float post = mod(floor((p.x - sfMid) / sfPx.x + 0.5), sfSamples(0.01, sfPx.x, 3.0));
    if (chord || sfRow(p.y, roadRow)) {
      return vec4(sfOrange * 0.85, 0.78);
    }
    if (post < 0.5) {
      return vec4(sfSteel, 0.66);
    }
    // Between the posts the truss is open; it still hides what is behind.
    return vec4(sfSteel * 0.5, sfFill(0.18));
  }
  if (sfRow(p.y, roadRow)) {
    return vec4(sfOrange * 0.85, 0.78);
  }

  // Approach viaducts beyond the anchorages: piers down to the ground.
  if (abs(u) > reach && p.y < SF_DECK - truss && p.y > SF_WATER) {
    float pier = floor((p.x - sfMid) / 0.07 + 0.5);
    float px1 = sfMid + pier * 0.07;
    if (abs(p.x - px1) < max(sfPx.x * 0.5, 0.004)) {
      return vec4(sfSteel * 0.8, 0.62);
    }
  }
  // The anchorage blocks the cables end in.
  float ax = abs(p.x - sfMid) - sfHalf - sfSide;
  if (abs(ax) < 0.018 && p.y > SF_DECK - truss - 0.03 && p.y < SF_DECK + 0.012) {
    return vec4(vec3(0.45, 0.42, 0.45), 0.6);
  }
  return sfNone();
}

// ---- The land ------------------------------------------------------------------

// The Marin Headlands: a ridge rising from the strait by the north tower
// to the left edge, with a softer shoulder in front.
float sfMarin(float x) {
  float u = (sfMid - sfHalf - 0.03) - x;
  if (u < 0.0) {
    return SF_WATER - 1.0;
  }
  float rise = 0.3 * (1.0 - exp(-u * 9.0));
  float folds = 0.022 * sin(u * 11.0 + 0.6) + 0.012 * sin(u * 27.0 + 1.3);
  return SF_WATER + max(0.0, rise + folds * smoothstep(0.0, 0.2, u));
}

// The city shore on the right: the Presidio bluff, low and dark.
float sfPresidio(float x) {
  float u = x - (sfMid + sfHalf + 0.02);
  if (u < 0.0) {
    return SF_WATER - 1.0;
  }
  return SF_WATER + 0.018 + 0.012 * smoothstep(0.0, 0.25, u) + 0.004 * sin(u * 40.0);
}

vec4 sfHills(vec2 p) {
  float m = sfMarin(p.x);
  float m1 = sfMarin(p.x + sfPx.x);
  if (p.y < m) {
    if (sfCurve(p, m, (m1 - m) / sfPx.x) && p.y > m - sfPx.y * 1.5) {
      return vec4(vec3(0.5, 0.6, 0.64), 0.62);
    }
    return vec4(vec3(0.2, 0.27, 0.32), sfFill(0.16));
  }
  float c = sfPresidio(p.x);
  if (p.y < c) {
    if (p.y > c - sfPx.y) {
      return vec4(vec3(0.3, 0.36, 0.42), 0.56);
    }
    return vec4(vec3(0.12, 0.14, 0.18), sfFill(0.1));
  }
  return sfNone();
}

// ---- Downtown --------------------------------------------------------------------

// Distant towers seen past the south end: plain blocks, then the
// Transamerica Pyramid with its spire and the Salesforce Tower with its
// rounded crown. x is relative to the cluster's centre.
vec4 sfDowntown(vec2 p, float t, float cx) {
  float x = p.x - cx;
  // The city stands on its hills, so its base sits above the waterline.
  float base = SF_WATER + 0.05;
  float y = p.y - base;
  if (y < 0.0 || abs(x) > 0.22) {
    return sfNone();
  }

  // Transamerica Pyramid: a slender taper from a wide base to a point,
  // with a spire. Never thinner than a sample, so the point and the spire
  // join up.
  float tx = x + 0.045;
  float pyrH = 0.25;
  float pyrHalf = max(0.022 * (1.0 - y / pyrH), sfPx.x * 0.5);
  if (y < pyrH && abs(tx) < pyrHalf) {
    if (abs(tx) + sfPx.x >= pyrHalf) {
      return vec4(vec3(0.94, 0.92, 0.86), 0.68);
    }
    float row = floor(y / sfPx.y);
    float lit = mod(row, 2.0) < 1.0 ? sfLit(vec2(floor(tx / sfPx.x), row) + 51.0, 0.55, t) : 0.0;
    return vec4(sfWarm * mix(0.3, 0.85, lit), mix(0.0, 0.72, lit));
  }
  if (sfCol(tx, 0.0) && y >= pyrH && y < pyrH + 0.04) {
    return vec4(vec3(0.9, 0.88, 0.82), 0.62);
  }

  // Salesforce Tower: the tallest, tapering slightly to a rounded crown
  // whose lights glow.
  float sx = x - 0.07;
  float sfH = 0.28;
  float half1 = mix(0.02, 0.016, clamp(y / sfH, 0.0, 1.0));
  float crown = sfH - 0.04;
  float topY = y > crown ? crown + 0.04 * sqrt(max(0.0, 1.0 - (sx / half1) * (sx / half1))) : sfH;
  if (abs(sx) < half1 && y < topY) {
    bool edge = abs(sx) + sfPx.x >= half1 || y + sfPx.y >= topY;
    if (y > crown) {
      // The lit crown: an open lattice of white light.
      float lattice = mod(floor((sx + half1) / sfPx.x), 2.0) < 1.0 ? 0.74 : 0.0;
      return vec4(vec3(0.9, 0.95, 1.0), edge ? 0.76 : lattice);
    }
    if (edge) {
      return vec4(vec3(0.5, 0.56, 0.66), 0.58);
    }
    float row = floor(y / sfPx.y);
    float colW = sfSamples(0.007, sfPx.x, 2.0);
    float col = floor((sx + half1) / sfPx.x);
    if (mod(row, 3.0) < 1.0 && mod(col, colW) > 0.5 && mod(col, colW) < 1.5) {
      float lit = sfLit(vec2(col + 300.0, row), 0.45, t);
      return vec4(sfCool * mix(0.2, 0.75, lit), mix(0.0, 0.7, lit));
    }
    return vec4(0.0);
  }

  // The rest of the skyline: blocks of a few heights.
  float lot = floor(x / 0.03);
  float r = hash21(vec2(lot, 13.0));
  float bx = x - (lot + 0.5) * 0.03;
  float bh = 0.04 + 0.12 * r * smoothstep(0.22, 0.05, abs(x - 0.01));
  float bw = 0.01 + 0.004 * hash21(vec2(lot, 5.0));
  if (abs(bx) < bw && y < bh) {
    bool edge = abs(bx) + sfPx.x >= bw || y + sfPx.y >= bh;
    if (edge) {
      return vec4(vec3(0.42, 0.46, 0.58), 0.56);
    }
    float row = floor(y / sfPx.y);
    if (mod(row, 2.0) < 1.0 && mod(floor(bx / sfPx.x), 2.0) < 1.0) {
      float lit = sfLit(vec2(lot * 31.0 + floor(bx / sfPx.x), row), 0.4, t);
      vec3 c = hash21(vec2(lot, row)) < 0.6 ? sfWarm : sfCool;
      return vec4(c * mix(0.2, 0.75, lit), mix(0.0, 0.7, lit));
    }
    return vec4(0.0);
  }
  return sfNone();
}

// ---- Sky and fog ---------------------------------------------------------

vec4 sfSky(vec2 p, float t) {
  if (p.y > 0.5) {
    vec2 g = floor(p / 0.045);
    float r = hash21(g + 61.0);
    vec2 at = (g + 0.2 + 0.6 * vec2(hash21(g + 4.0), hash21(g + 8.0))) * 0.045;
    if (r < 0.3 && sfCol(p.x, at.x) && sfRow(p.y, at.y)) {
      float tw = 0.5 + 0.5 * sin(t * (0.35 + r) + r * 40.0);
      // A dot in Braille and quadrants, a point or a colon in the ramps.
      float tone = sfDots > 0.5 ? 0.58 + 0.2 * tw : 0.16 + 0.1 * tw;
      return vec4(vec3(0.85, 0.88, 1.0) * (0.55 + 0.45 * tw), tone);
    }
  }
  return sfNone();
}

// A low fog bank lying in the strait behind the bridge, banked up against
// the Marin side. Its top is a smooth line that drifts a few box widths an
// hour; inside, ordered dots thin out toward the top, with no hard edge.
float sfFogTop(float x) {
  float side = smoothstep(sfMid + sfHalf * 0.4, sfMid - sfHalf * 1.3, x);
  float drift = x + sfFogTime * 0.002;
  float swell = 0.85 + 0.1 * sin(drift * 6.0) + 0.05 * sin(drift * 15.0 + 1.7);
  return SF_WATER + 0.17 * sfFogAmount * side * swell;
}

vec4 sfFog(vec2 p) {
  if (sfFogAmount <= 0.0 || p.y < SF_WATER) {
    return sfNone();
  }
  float top = sfFogTop(p.x);
  if (p.y >= top || top < SF_WATER + sfPx.y * 2.0) {
    return sfNone();
  }
  float h = (top - p.y) / max(top - SF_WATER, 1e-3);
  float level = 0.12 + 0.3 * smoothstep(0.0, 0.6, h);
  vec3 col = vec3(0.6, 0.66, 0.78);
  if (sfDots > 0.5) {
    return vec4(col, sfFill(level));
  }
  // Ramp charsets: every other row, so the bank reads as layers.
  float row = floor((top - p.y) / sfPx.y);
  return vec4(col, mod(row, 2.0) < 1.0 ? level * 0.8 : 0.0);
}

// Everything above the water, front to back.
vec4 sfLand(vec2 p, float t) {
  vec4 c = sfTower(p, sfMid - sfHalf, t, 0.0);
  if (c.a >= 0.0) {
    return c;
  }
  c = sfTower(p, sfMid + sfHalf, t, 0.45);
  if (c.a >= 0.0) {
    return c;
  }
  c = sfSpan(p, t);
  if (c.a >= 0.0) {
    return c;
  }
  c = sfFog(p);
  if (c.a >= 0.0) {
    return c;
  }
  c = sfHills(p);
  if (c.a >= 0.0) {
    return c;
  }
  float hw = sfHalfWidth;
  float city = min(sfMid + sfHalf + 0.2, hw - 0.12);
  c = sfDowntown(p, t, city);
  if (c.a >= 0.0) {
    return c;
  }
  return sfSky(p, t);
}

// Calm water: only lights reflect, as dimmer copies stretched downward and
// broken into short dashes that come and go slowly, sparser with depth.
vec4 sfWater(vec2 p, float t) {
  float depth = SF_WATER - p.y;
  float row = floor(depth / sfPx.y);
  float dash = floor(p.x / 0.008 + hash21(vec2(row, 1.0)) * 4.0);
  float flip = floor(t * 0.45 + hash21(vec2(row, dash)) * 9.0);
  float keep = hash21(vec2(row * 1.3 + dash, flip));
  if (keep > mix(0.72, 0.18, clamp(depth / 0.2, 0.0, 1.0))) {
    return vec4(0.0);
  }
  vec4 src = sfLand(vec2(p.x, SF_WATER + depth * 0.62), t);
  // The floodlit towers, lamps, cars and some city windows reflect.
  float col = floor(p.x / sfPx.x);
  if (src.a < 0.8 && (src.a < 0.68 || hash21(vec2(col, 4.0)) > 0.35)) {
    return vec4(0.0);
  }
  // Dimmer means toward the paper, which is white on a light theme.
  vec3 dim = sfOnLight > 0.5 ? mix(src.rgb, vec3(1.0), 0.5) : src.rgb * 0.5;
  return vec4(dim, sfDots > 0.5 ? 0.64 : 0.36);
}

vec2 sfCacheUv = vec2(-1.0);
float sfCacheT = -1.0;
vec4 sfCacheValue = vec4(0.0);

vec4 sfScene(vec2 uv, vec2 res, float t) {
  if (uv == sfCacheUv && t == sfCacheT) {
    return sfCacheValue;
  }
  float aspect = res.x / res.y;
  sfPx = vec2(aspect / ascii_samples.x, 1.0 / res.y);
  sfS = floor(uv * ascii_samples);
  sfDots = step(1.5, sfGrid.x * sfGrid.y);
  sfHalfWidth = aspect * 0.5;
  sfFogTime = t;
  // The span widens with the box, between a phone and a wide hero; the
  // bridge sits a little left so the city has room on the right. Both are
  // snapped to whole sample columns so the towers come out symmetric.
  sfHalf = clamp(sfHalfWidth * 0.5, 0.2, 0.52);
  sfSide = sfHalf * 0.27;
  sfMid = -sfHalfWidth * 0.08;
  sfMid = (floor(sfMid / sfPx.x) + 0.5) * sfPx.x;
  sfHalf = floor(sfHalf / sfPx.x) * sfPx.x;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);

  vec4 c = p.y < SF_WATER ? sfWater(p, t) : sfLand(p, t);
  vec3 col = c.rgb;
  float tone = max(c.a, 0.0);
  // Intensity thins the tone by its square root, so Braille dots survive
  // longer than the colour does, and fades the colour toward the paper.
  tone *= sqrt(sfIntensity);
  if (sfOnLight > 0.5) {
    // Orange and the lights wash out on a light paper; deepen them.
    col = mix(vec3(1.0), col * col * 0.8, sfIntensity);
  } else {
    col *= sfIntensity;
  }
  tone = tone < 0.04 ? 0.0 : tone;
  sfCacheUv = uv;
  sfCacheT = t;
  sfCacheValue = vec4(col, tone);
  return sfCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return sfScene(uv, res, t).a;
}
`;

// Braille and quadrant cells show one colour for all their dots, which the
// engine averages over every sample. Giving each sample the colour of the
// strongest sample in its cell keeps a one-dot cable or suspender orange
// instead of fading into the dark around it.
const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec2 origin = floor(floor(uv * ascii_samples) / sfGrid) * sfGrid;
  vec4 best = vec4(0.0, 0.0, 0.0, -1.0);
  for (int y = 0; y < 4; y++) {
    for (int x = 0; x < 2; x++) {
      if (float(x) < sfGrid.x && float(y) < sfGrid.y) {
        vec4 c = sfScene((origin + vec2(float(x), float(y)) + 0.5) / ascii_samples, res, t);
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
        "linear-gradient(to bottom, #050814 0%, #0b1428 55%, #142036 78%, #05070f 80%, #03050b 100%)",
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

export interface SanFranciscoProps extends AsciiSceneProps {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** How high the fog bank behind the bridge rises, from 0 (none) to 1. Default 0.5. */
  fog?: number;
  /** How many cars cross the bridge, from 0 (none) to 1 (six). Default 0.5. */
  traffic?: number;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a night gradient. */
  fallback?: ReactNode;
}

/**
 * San Francisco. The Golden Gate Bridge at night: two orange towers with
 * stepped portals, the main cable dipping to the deck between them, the
 * suspenders, a few cars crossing, the Marin Headlands on the left and the
 * downtown skyline far right, with a low fog bank behind the span.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const SanFrancisco = ({
  intensity = 1,
  fog = 0.5,
  traffic = 0.5,
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
}: SanFranciscoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        sfFogAmount: clamp(fog, 0, 1),
        sfGrid: [gx, gy],
        sfIntensity: clamp(intensity, 0, 1),
        sfOnLight: onLight ? 1 : 0,
        sfTraffic: clamp(traffic, 0, 1),
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
