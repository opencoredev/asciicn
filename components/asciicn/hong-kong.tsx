"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  CharsetName,
  ColorMode,
} from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Victoria Harbour at blue hour, seen from Kowloon, painted back to front:
// a magenta to deep blue sky, the dark ridge of Victoria Peak with mist on
// its crest, the towers of the Mid-Levels climbing its slope in haze, the
// Bank of China Tower and Two IFC, the wall of waterfront towers, then the
// harbour, which mirrors all of it in long coloured streaks, and a junk
// with red sails crossing it. The field returns a tone that sets dot size;
// the colour field returns that point's own colour.
// World units: y runs 0 (bottom) to 1 (top) and x is centred and measured
// in the same units, so shapes keep their proportions at any aspect. The
// Peak and the landmarks pull towards the centre in narrow boxes, so a
// phone crop keeps them. Windows and the landmarks' lines snap to whole
// glyph cells, so each light is a single dot in any charset.
const SCENE = `
float hkAsp;
float hkT;
float hkWide;
float hkTall;
float hkHz;
float hkHzRow;
float hkPeakX;
float hkBocX;
float hkIfcX;
float hkGlowX;
vec2 hkCells;
vec2 hkCellSize;

vec2 hkCacheUv = vec2(-1.0);
float hkCacheT = -1.0;
vec4 hkCacheValue = vec4(0.0);

float hkColOf(float x) {
  return floor((x / hkAsp + 0.5) * hkCells.x);
}

float hkRowOf(float y) {
  return floor(y * hkCells.y);
}

vec2 hkCellOf(vec2 p) {
  return vec2(hkColOf(p.x), hkRowOf(p.y));
}

vec2 hkCentre(vec2 cell) {
  return vec2(((cell.x + 0.5) / hkCells.x - 0.5) * hkAsp, (cell.y + 0.5) / hkCells.y);
}

// Tone for the air, the hills and the water, from brightness: the deep sky
// and the shadows draw the smallest dots or none, the afterglow larger ones.
float hkAirTone(vec3 c) {
  return 0.2 + 0.72 * pow(dot(c, vec3(0.3, 0.5, 0.2)), 1.1);
}

// 1 in the band behind a centred headline, 0 outside it. Detail and
// contrast step back there.
float hkCalm(vec2 p) {
  float across = 1.0 - smoothstep(0.18, 0.3, abs(p.x) / hkAsp);
  float up = smoothstep(0.3, 0.38, p.y) * (1.0 - smoothstep(0.66, 0.74, p.y));
  return across * up;
}

// The afterglow, low in the east beyond the IFC: the scene's main light.
float hkAfterglow(vec2 p) {
  vec2 g = vec2((p.x - hkGlowX) * 1.1, (p.y - hkHz - 0.17) * 2.4);
  return exp(-dot(g, g) * 9.0);
}

// The sky from the hills up: hot magenta where it meets the ridge, mauve,
// violet, then a deep, quiet blue overhead. It follows the crest, so the
// glow rims every summit.
vec3 hkSky(vec2 p, float ridge) {
  float s = clamp((p.y - ridge + 0.03) / 0.42, 0.0, 1.0);
  vec3 c = mix(vec3(0.9, 0.42, 0.58), vec3(0.74, 0.32, 0.56), smoothstep(0.0, 0.12, s));
  c = mix(c, vec3(0.5, 0.26, 0.54), smoothstep(0.08, 0.3, s));
  c = mix(c, vec3(0.28, 0.21, 0.5), smoothstep(0.24, 0.48, s));
  c = mix(c, vec3(0.13, 0.13, 0.34), smoothstep(0.44, 0.72, s));
  c = mix(c, vec3(0.06, 0.07, 0.17), smoothstep(0.7, 1.0, s));
  c = mix(c, vec3(1.0, 0.66, 0.6), hkAfterglow(p) * 0.85);
  return c;
}

// The haze colour at height y: rose low over the city, violet higher up.
vec3 hkHaze(float y) {
  return mix(vec3(0.6, 0.38, 0.58), vec3(0.34, 0.27, 0.54), smoothstep(hkHz, hkHz + 0.3, y));
}

// The crest of the hills behind the city: Victoria Peak, the shoulder of
// High West to its left and lower hills falling to the east, all with a
// rough, wooded edge.
float hkRidge(float x) {
  float u = (x - hkPeakX) / hkWide;
  float peak = 0.25 * exp(-u * u * 5.0);
  float west = 0.11 * exp(-pow((u + 0.58) / 0.2, 2.0));
  float east = 0.05 * exp(-pow((u - 0.75) / 0.3, 2.0));
  float rough = 0.03 * (fbm(vec2(x * 2.6, 0.5)) - 0.5) + 0.008 * snoise(vec2(x * 13.0, 4.1)) + 0.003 * snoise(vec2(x * 41.0, 1.7));
  return 0.5 + peak + west + east + rough;
}

// A nearer, lower spur in front of the ridge.
float hkSpur(float x) {
  float u = (x - hkPeakX) / hkWide;
  float a = 0.07 * exp(-pow((u - 0.32) / 0.24, 2.0));
  float b = 0.05 * exp(-pow((u + 0.36) / 0.2, 2.0));
  float rough = 0.02 * (fbm(vec2(x * 3.4, 7.5)) - 0.5) + 0.006 * snoise(vec2(x * 17.0, 2.9));
  return hkHz + 0.13 + a + b + rough;
}

// The hillside's relief: spurs and gullies running down the slope.
float hkRelief(vec2 q, float seed) {
  return fbm(vec2(q.x * 5.0 + q.y * 1.2 + seed, q.y * 2.2)) * 0.7 + fbm(vec2(q.x * 13.0 + seed, q.y * 6.0)) * 0.3;
}

// Light on a hillside: faces turned toward the afterglow, on the right,
// catch it, both across the whole slope and on each spur.
float hkSlopeLight(float x, float y, float dCrest, float seed) {
  float e = 0.01;
  float ground = hkRelief(vec2(x - e, y), seed) - hkRelief(vec2(x + e, y), seed);
  float slope = -dCrest / (2.0 * e) * 0.8 + ground / (2.0 * e) * 0.12;
  return smoothstep(-0.7, 0.7, slope);
}

// One layer of towers. Two staggered rows of plots, the taller one wins.
// Returns the roof height at x; id names the building, and edge holds its
// left and right sides.
float hkSkyline(float x, float plot, float seed, float lo, float amp, float lift, out float id, out vec2 edge) {
  float best = -1.0;
  id = -1.0;
  edge = vec2(0.0);
  for (int row = 0; row < 2; row++) {
    float shift = float(row) * 0.5;
    float w = plot * (row == 0 ? 1.0 : 0.71);
    float k = floor(x / w + shift);
    float key = k + seed * 53.0 + float(row) * 97.0;
    float width = mix(0.62, 0.98, hash21(vec2(key, 1.7)));
    float left = (k - shift + (1.0 - width) * hash21(vec2(key, 2.3))) * w;
    float right = left + width * w;
    if (x < left || x > right) {
      continue;
    }
    float h = lo + amp * pow(hash21(vec2(key, 4.9)), 1.4) + lift;
    // Some towers step back near the roof, and a few carry a mast.
    float st = hash21(vec2(key, 6.1));
    float f = (x - left) / (right - left);
    if (st > 0.6 && (f < 0.2 || f > 0.8)) {
      h -= (h - hkHz) * 0.1;
    }
    if (st > 0.93 && abs(f - 0.5) * (right - left) < hkCellSize.x * 0.5) {
      h += 0.02;
    }
    if (h > best) {
      best = h;
      id = key;
      edge = vec2(left, right);
    }
  }
  return best;
}

// The colour a building's lights lean to: mostly warm and white, some cool,
// a few teal.
vec3 hkTint(float h) {
  if (h < 0.4) return vec3(1.0, 0.72, 0.4);
  if (h < 0.68) return vec3(1.0, 0.9, 0.76);
  if (h < 0.9) return vec3(0.64, 0.8, 1.0);
  return vec3(0.46, 0.9, 0.84);
}

float hkBusy(float id) {
  return mix(0.4, 1.5, hash21(vec2(id, 6.2)));
}

// Windows on a building face: single-cell lights, lit floor by floor,
// each building in its own mix of warm and cool. A few switch on or off
// over tens of seconds. Returns the light's colour and its strength.
vec4 hkWindow(float id, vec2 edge, float roof, float density, vec2 cell) {
  vec2 c = hkCentre(cell);
  if (c.x - edge.x < hkCellSize.x * 0.9 || edge.y - c.x < hkCellSize.x * 0.9 || roof - c.y < hkCellSize.y * 1.2) {
    return vec4(0.0);
  }
  float style = hash21(vec2(id, 8.1));
  // Striped facades light every other column; ribbon facades every other row.
  if (style < 0.3 && mod(cell.x, 2.0) > 0.5) {
    return vec4(0.0);
  }
  if (style > 0.76 && mod(cell.y, 2.0) > 0.5) {
    return vec4(0.0);
  }
  float floorLit = hash21(vec2(id, cell.y * 1.7));
  float chance = density * hkBusy(id) * (floorLit > 0.42 ? 1.8 : 0.25);
  float lit = step(hash21(cell + id * 0.37), chance);
  float drifting = step(hash21(cell * 1.31 + 4.2), 0.06);
  if (drifting > 0.5) {
    float period = 18.0 + 24.0 * hash21(cell + 9.4);
    float phase = hkT / period + hash21(cell + 2.2) * 9.0;
    float a = step(hash21(cell + floor(phase)), chance * 1.3);
    float b = step(hash21(cell + floor(phase) + 1.0), chance * 1.3);
    lit = mix(a, b, smoothstep(0.75, 1.0, fract(phase)));
  }
  if (lit <= 0.0) {
    return vec4(0.0);
  }
  float pick = hash21(vec2(id, 3.3)) * 0.75 + hash21(cell + 6.6) * 0.25;
  return vec4(hkTint(pick), lit * mix(0.55, 1.0, hash21(cell + 1.9)));
}

// The average glow of a building's windows, for its reflection.
vec3 hkWindowAverage(float id, float density) {
  return hkTint(hash21(vec2(id, 3.3)) * 0.75 + 0.12) * min(0.3 + density * hkBusy(id) * 1.6, 1.0);
}

// A slow colour wash for the few crowns lit in changing LED colours.
vec3 hkWash(float seed) {
  return toSrgb(oklch(0.7, 0.14, hkT * 0.05 + seed * 2.4));
}

// The Bank of China Tower: a square prism split into triangular shafts
// that stop at different heights, so its top is a run of slanted roofs
// rising to the apex and twin masts. Its dark glass mirrors the sky; its
// edges are lines of white light and the X braces of each square module
// glow more softly.
vec4 hkBoc(vec2 cell, bool soft) {
  float H = mix(0.33, 0.29, hkTall);
  float hw = 0.042;
  float l = hkColOf(hkBocX - hw);
  float r = hkColOf(hkBocX + hw);
  float n = r - l + 1.0;
  float i = cell.x - l;
  float base = hkHzRow;
  float apex = hkRowOf(hkHz + H);
  float mastTop = hkRowOf(hkHz + H + 0.05);
  // Twin masts above the apex at the right.
  if ((cell.x == r || cell.x == r - 2.0) && cell.y > apex - 3.0 && cell.y <= mastTop) {
    if (cell.y == mastTop && cell.x == r) {
      float b = smoothstep(0.0, 0.1, fract(hkT / 1.8)) * smoothstep(0.55, 0.15, fract(hkT / 1.8));
      return vec4(mix(vec3(0.5, 0.1, 0.12), vec3(1.0, 0.24, 0.18), b), 0.5 + 0.45 * b);
    }
    return vec4(0.66, 0.68, 0.84, 0.5);
  }
  if (cell.x < l || cell.x > r) {
    return vec4(-1.0);
  }
  float u = i / max(n - 1.0, 1.0);
  float top;
  if (u < 0.34) {
    top = mix(0.56, 0.68, u / 0.34);
  } else if (u < 0.67) {
    top = mix(0.74, 0.86, (u - 0.34) / 0.33);
  } else {
    top = mix(0.88, 1.0, (u - 0.67) / 0.33);
  }
  float topRow = hkRowOf(hkHz + H * top);
  if (cell.y > topRow) {
    return vec4(-1.0);
  }
  float k = (cell.y - base) / max(apex - base, 1.0);
  // The right face takes the afterglow; the left falls into shadow.
  vec3 glass = mix(vec3(0.22, 0.22, 0.5), vec3(0.46, 0.34, 0.66), k) * mix(0.7, 1.15, u);
  if (soft) {
    return vec4(mix(glass, vec3(0.86, 0.9, 1.0), 0.3), 0.55);
  }
  if (cell.x == l || cell.x == r || cell.y == topRow) {
    return vec4(0.94, 0.95, 1.0, 0.96);
  }
  // Square modules, as many rows tall as the tower is wide.
  float j = mod(cell.y - base, n - 1.0);
  if (j < 0.5 || abs(j - i) < 0.5 || abs(j - (n - 1.0 - i)) < 0.5) {
    return vec4(mix(glass, vec3(0.86, 0.9, 1.0), 0.75), 0.74);
  }
  return vec4(glass, 0.46 + 0.12 * k);
}

// Two IFC: the tallest tower, striped with vertical light that brightens
// toward the top, with two small setbacks and an open crown of fins,
// taller at the corners.
float hkIfcHalf(float h) {
  return h < 0.74 ? 0.03 : (h < 0.84 ? 0.025 : 0.021);
}

vec4 hkIfc(vec2 cell, bool soft) {
  float H = mix(0.37, 0.32, hkTall);
  float y = hkCentre(cell).y;
  float h = (y - hkHz) / H;
  if (h < 0.0 || h > 1.0) {
    return vec4(-1.0);
  }
  float hw = hkIfcHalf(h);
  float l = hkColOf(hkIfcX - hw);
  float r = hkColOf(hkIfcX + hw);
  if (cell.x < l || cell.x > r) {
    return vec4(-1.0);
  }
  float n = r - l + 1.0;
  float u = (cell.x - l) / max(n - 1.0, 1.0);
  float bodyRow = hkRowOf(hkHz + H * 0.9);
  if (cell.y > bodyRow) {
    // Fins on every other column, rising toward the corners.
    float finTop = hkRowOf(hkHz + H * (0.94 + 0.06 * abs(u - 0.5) * 2.0));
    if (cell.y <= finTop && mod(cell.x - l, 2.0) < 0.5) {
      return vec4(0.92, 0.93, 1.0, soft ? 0.6 : 0.94);
    }
    return vec4(-1.0);
  }
  float shade = mix(0.78, 1.1, u);
  if (soft) {
    return vec4(vec3(0.56, 0.6, 0.86) * shade, 0.6);
  }
  // A ledge where the tower steps in just above.
  float hwA = hkIfcHalf((y + hkCellSize.y - hkHz) / H);
  if (cell.y == bodyRow || cell.x < hkColOf(hkIfcX - hwA) || cell.x > hkColOf(hkIfcX + hwA)) {
    return vec4(0.9, 0.92, 1.0, 0.9);
  }
  float rise = mix(0.7, 1.0, h);
  if (mod(cell.x - l, 2.0) > 0.5) {
    return vec4(vec3(0.66, 0.74, 0.98) * shade * rise, 0.5 + 0.22 * h);
  }
  return vec4(vec3(0.2, 0.2, 0.44) * shade, 0.3);
}

// Everything above the water at p. soft swaps each building's windows for
// their average glow, which the harbour stretches into long reflections.
vec4 hkAbove(vec2 p, bool soft) {
  vec2 cell = hkCellOf(p);
  float x = p.x;
  float y = p.y;
  float drift = hkT * 0.01;
  float calm = hkCalm(p);

  float ridge = hkRidge(x);
  vec3 col = hkSky(p, ridge);
  float tone = hkAirTone(col);

  // A few long streaks of cloud in the magenta band, lit from below.
  float band = smoothstep(0.62, 0.7, y) * (1.0 - smoothstep(0.8, 0.9, y));
  float cloud = snoise(vec2(x * 0.7 + drift, y * 8.0 + 2.0)) * 0.65 + snoise(vec2(x * 2.0 - drift, y * 15.0)) * 0.35;
  cloud = smoothstep(0.2, 0.65, cloud) * band * (1.0 - 0.6 * calm);
  col = mix(col, vec3(0.74, 0.42, 0.62), cloud * 0.45);
  tone = mix(tone, hkAirTone(col), 1.0) + cloud * 0.05;

  // A few stars where the sky is darkest.
  if (!soft) {
    float sz = smoothstep(0.8, 0.95, y);
    if (hash21(cell + 0.71) < 0.012 * sz) {
      float tw = 0.55 + 0.45 * sin(hkT * 0.8 + hash21(cell) * 40.0);
      col = mix(col, vec3(0.86, 0.88, 1.0), 0.7 * tw);
      tone = mix(tone, 0.6, tw);
    }
  }

  // Victoria Peak: a dark, wooded ridge. Faces turned toward the afterglow
  // catch a little magenta; the rest falls into quiet shadow.
  if (y < ridge) {
    float e = 0.012;
    float lit = hkSlopeLight(x, y, hkRidge(x + e) - hkRidge(x - e), 0.0);
    float below = ridge - y;
    col = mix(vec3(0.1, 0.09, 0.24), vec3(0.42, 0.25, 0.52), lit);
    tone = 0.24 + 0.18 * lit;
    // The crest catches the sky behind it on its lit side.
    float crest = (1.0 - smoothstep(0.0, hkCellSize.y * 2.0, below)) * lit;
    col = mix(col, vec3(0.44, 0.3, 0.56), crest * 0.6);
    tone += crest * 0.1;
    // Haze gathers low on the slope, over the city.
    float low = 1.0 - smoothstep(0.0, 0.2, y - hkHz - 0.08);
    col = mix(col, hkHaze(y), low * 0.3);
    tone = mix(tone, 0.34, low * 0.3);
  }

  // Mist on the Peak: soft banks drifting slowly across its upper slopes,
  // thickest near the summit.
  float mistN = fbm(vec2(x * 1.8 - hkT * 0.012, y * 4.0 + 1.0));
  float nearSummit = exp(-pow((x - hkPeakX) / (0.5 * hkWide + 0.1), 2.0));
  float mistBand = exp(-pow((y - ridge + 0.055) / 0.05, 2.0)) * mix(0.5, 1.0, nearSummit) * step(y, ridge + 0.01);
  float mist = smoothstep(0.38, 0.62, mistN) * mistBand * hkMist;
  col = mix(col, vec3(0.64, 0.5, 0.76), mist * 0.85);
  tone = mix(tone, 0.54, mist * 0.8);

  // The nearer spur, in front of the ridge and a little clearer.
  float spur = hkSpur(x);
  if (y < spur) {
    float e = 0.012;
    float lit = hkSlopeLight(x, y, hkSpur(x + e) - hkSpur(x - e), 7.0);
    col = mix(vec3(0.07, 0.07, 0.19), vec3(0.34, 0.2, 0.44), lit);
    tone = 0.22 + 0.16 * lit;
    // A few lights on the roads winding up it.
    float road = abs(fract((y - x * 0.4) * 22.0) - 0.5);
    if (!soft && road < 0.12 && hash21(cell + 4.0) < 0.16 * (1.0 - calm)) {
      col = vec3(0.9, 0.7, 0.48);
      tone = 0.56;
    }
  }
  // Mist in the valley between the spur and the ridge.
  float valley = exp(-pow((y - spur - 0.01) / 0.04, 2.0)) * smoothstep(0.38, 0.7, fbm(vec2(x * 2.0 + hkT * 0.009, y * 6.0 + 4.0))) * hkMist;
  col = mix(col, vec3(0.54, 0.42, 0.68), valley * 0.6);
  tone = mix(tone, 0.46, valley * 0.55);

  // The glow of the city on the air above it.
  vec2 gd = vec2(x / (0.6 * hkAsp + 0.1), (y - hkHz - 0.08) / 0.12);
  float cityGlow = exp(-dot(gd, gd));
  col = mix(col, vec3(0.62, 0.4, 0.52), cityGlow * 0.3);

  float id;
  vec2 edge;

  // The Mid-Levels: towers climbing the slope behind Central, pressed into
  // the haze, their windows dim. Near the Peak they stand on higher ground.
  float sideB = smoothstep(0.1, 0.4, abs(x) / hkAsp);
  float lift = clamp((hkSpur(x) - hkHz - 0.13) * 1.2, 0.0, 0.1) * (0.5 + 0.5 * sideB);
  float backRoof = hkSkyline(x, 0.034, 1.0, hkHz + 0.08, 0.05 + 0.05 * sideB, lift, id, edge);
  if (y < backRoof) {
    float lit = smoothstep(0.0, 1.0, (x - edge.x) / max(edge.y - edge.x, 0.001));
    float shade = mix(0.85, 1.12, hash21(vec2(id, 2.2)));
    float up = smoothstep(hkHz, backRoof, y);
    col = mix(vec3(0.26, 0.2, 0.46), hkHaze(y), 0.5) * shade * mix(0.8, 1.1, lit) * mix(1.15, 0.85, up);
    tone = 0.38 + 0.06 * lit - 0.06 * up;
    float roofLine = 1.0 - smoothstep(0.0, hkCellSize.y * 1.1, backRoof - y);
    col = mix(col, hkHaze(y) * 1.1, roofLine * 0.4);
    if (soft) {
      col = mix(col, hkWindowAverage(id, 0.24), 0.4);
    } else {
      vec4 w = hkWindow(id, edge, backRoof, 0.24 * (1.0 - 0.4 * calm), cell);
      col = mix(col, mix(w.rgb, hkHaze(y), 0.35), w.a * 0.7);
      tone += w.a * 0.2 * (1.0 - 0.4 * calm);
    }
  }

  // A thin haze between the Mid-Levels and Central.
  float veil = (1.0 - smoothstep(0.0, 0.12, y - hkHz)) * mix(0.4, 0.9, fbm(vec2(x * 1.4 + drift, y * 7.0 + 5.0)));
  col = mix(col, hkHaze(y), veil * 0.3);

  // The two landmarks, one on each side of the frame.
  vec4 hit = hkIfc(cell, soft);
  if (hit.a < 0.0) {
    hit = hkBoc(cell, soft);
  }
  if (hit.a >= 0.0) {
    col = hit.rgb;
    tone = hit.a;
  }

  // The waterfront: a dense wall of dark towers with the brightest
  // windows, low in the middle so a headline has calm air above them.
  float side = smoothstep(0.08, 0.45, abs(x) / hkAsp);
  float frontRoof = hkSkyline(x, 0.046, 2.0, hkHz + 0.03, 0.05 + 0.06 * side, 0.05 * side, id, edge);
  if (y < frontRoof) {
    float f = (x - edge.x) / max(edge.y - edge.x, 0.001);
    float shade = mix(0.8, 1.2, hash21(vec2(id, 2.2)));
    col = vec3(0.1, 0.1, 0.25) * shade * mix(0.85, 1.2, f);
    tone = 0.28;
    // The right edge and the roof catch the afterglow.
    float rim = 1.0 - smoothstep(0.0, hkCellSize.x * 1.2, edge.y - x);
    float roofLine = 1.0 - smoothstep(0.0, hkCellSize.y * 1.1, frontRoof - y);
    col = mix(col, vec3(0.5, 0.32, 0.56), max(rim * 0.6, roofLine * 0.5));
    tone += max(rim, roofLine) * 0.18;
    float crown = step(0.88, hash21(vec2(id, 9.7))) * step(frontRoof - hkCellSize.y * 2.0, y) * (1.0 - calm);
    if (soft) {
      col = mix(col, hkWindowAverage(id, 0.42), 0.85);
      tone = 0.62;
    } else {
      vec4 w = hkWindow(id, edge, frontRoof, 0.42 * (1.0 - 0.25 * calm), cell);
      col = mix(col, w.rgb * (1.0 - 0.2 * calm), w.a);
      tone += w.a * mix(0.5, 0.36, calm);
    }
    // A few crowns glow in slowly changing LED colours.
    if (crown > 0.5) {
      col = mix(vec3(0.9, 0.92, 1.0), hkWash(id), hkLights);
      tone = 0.8;
    }
  }

  // The promenade along the shore: a row of small lamps.
  if (cell.y == hkHzRow && hash21(vec2(cell.x, 5.1)) < 0.3) {
    col = vec3(1.0, 0.8, 0.54);
    tone = 0.62;
  }
  return vec4(col, tone);
}

// The junk at q, in world units from the middle of its waterline: a dark
// hull with a raised stern on the left, three battened red sails and a
// lantern at the stern. It sails to the right.
vec4 hkJunk(vec2 q) {
  float ax = abs(q.x + 0.002);
  float bottom = 0.01 * pow(ax / 0.066, 3.0) - 0.004;
  float deck = 0.014 + 0.016 * smoothstep(-0.03, -0.066, q.x) + 0.006 * smoothstep(0.04, 0.066, q.x);
  if (ax < 0.066 && q.y > bottom && q.y < deck) {
    if (q.x < -0.05 && q.x > -0.058 && q.y > deck - 0.01) {
      return vec4(1.0, 0.74, 0.4, 0.9);
    }
    float rail = step(deck - hkCellSize.y, q.y);
    return vec4(mix(vec3(0.22, 0.12, 0.13), vec3(0.5, 0.3, 0.26), rail), 0.44 + 0.14 * rail);
  }
  // Three sails, mainsail, foresail and mizzen: each a fan whose back edge
  // bows out and whose top slopes up toward the back, crossed by battens.
  for (int s = 0; s < 3; s++) {
    float x0 = s == 0 ? -0.022 : (s == 1 ? 0.034 : -0.064);
    float w = s == 0 ? 0.044 : (s == 1 ? 0.028 : 0.02);
    float hgt = s == 0 ? 0.11 : (s == 1 ? 0.078 : 0.054);
    float lo = 0.022;
    float v = (q.y - lo) / hgt;
    if (v < 0.0 || v > 1.4) {
      continue;
    }
    float front = x0 + w - 0.008 * v;
    float back = x0 - 0.012 * sin(min(v, 1.0) * 2.7);
    float topV = 1.0 + 0.3 * clamp((front - q.x) / w, 0.0, 1.0);
    if (q.x > back && q.x < front && v < topV) {
      float rowIn = floor((q.y - lo) / hkCellSize.y);
      float batten = step(mod(rowIn, 3.0), 0.5) * step(0.5, rowIn);
      float across = (q.x - back) / max(front - back, 0.001);
      float lit = mix(0.82, 1.06, across) * mix(0.85, 1.05, v);
      vec3 c = mix(vec3(0.9, 0.28, 0.16), vec3(0.4, 0.09, 0.1), batten) * lit;
      return vec4(c, mix(0.78, 0.5, batten));
    }
  }
  // The masts, along each sail's front edge.
  if (q.y > deck && q.y < 0.15) {
    float m0 = abs(q.x - (-0.022 + 0.044 - 0.004));
    float m1 = abs(q.x - (0.034 + 0.028 - 0.004));
    if ((m0 < hkCellSize.x * 0.5 && q.y < 0.14) || (m1 < hkCellSize.x * 0.5 && q.y < 0.105)) {
      return vec4(0.3, 0.19, 0.18, 0.4);
    }
  }
  return vec4(-1.0);
}

vec4 hkScene(vec2 uv, vec2 res, float t) {
  if (uv == hkCacheUv && t == hkCacheT) {
    return hkCacheValue;
  }
  hkAsp = res.x / res.y;
  hkT = t;
  hkCells = floor(ascii_samples / hkGrid + 0.5);
  hkCellSize = vec2(hkAsp, 1.0) / hkCells;
  hkTall = 1.0 - smoothstep(0.6, 1.3, hkAsp);
  hkHzRow = floor(mix(0.33, 0.3, hkTall) * hkCells.y + 0.5);
  hkHz = hkHzRow / hkCells.y;
  hkWide = clamp(hkAsp / 1.78, 0.3, 1.0);
  hkPeakX = -0.06 * hkWide;
  // The landmarks stand outside the middle half of the frame, and on a
  // phone close to its edges, so a headline never covers them.
  hkBocX = -mix(0.56 * hkWide, 0.5 * hkAsp - 0.06, hkTall);
  hkIfcX = mix(0.58 * hkWide, 0.5 * hkAsp - 0.055, hkTall);
  hkGlowX = hkIfcX + 0.06;
  vec2 p = vec2((uv.x - 0.5) * hkAsp, uv.y);
  vec2 cell = hkCellOf(p);

  vec4 c;
  if (cell.y >= hkHzRow) {
    c = hkAbove(p, false);
  } else {
    // The harbour mirrors the city, stretched and broken into horizontal
    // dashes by slow ripples that grow toward the viewer.
    float d = (hkHz - p.y) / hkHz;
    float r1 = snoise(vec2(p.x * 1.2 + t * 0.02, cell.y * 0.35 - t * 0.3));
    float shift = floor(r1 * (0.6 + 2.4 * d) + 0.5) * hkCellSize.x;
    vec2 m = vec2(p.x + shift, hkHz + (hkHz - p.y) * 0.85 + hkCellSize.y * 0.5);
    vec4 above = hkAbove(m, true);
    float dash = snoise(vec2(p.x * 1.6 - t * 0.015, cell.y * 0.6 + t * 0.2));
    float k = (0.45 + 0.55 * smoothstep(-0.5, 0.6, dash)) * mix(1.0, 0.55, d);
    vec3 water = mix(vec3(0.09, 0.07, 0.2), vec3(0.05, 0.05, 0.14), d);
    vec3 col = mix(water, above.rgb * vec3(0.9, 0.84, 0.98), k);
    float tone = mix(hkAirTone(water), above.a * 0.9, k);
    // The afterglow's path on the water: a long column of rose glints under
    // the IFC, widening toward the viewer.
    float path = exp(-pow((p.x - hkGlowX) / (0.07 + 0.12 * d), 2.0));
    float glint = smoothstep(0.2, 0.85, snoise(vec2(p.x * 7.0 + t * 0.03, cell.y * 0.8 - t * 0.4)));
    glint *= path * (1.0 - 0.55 * d);
    col = mix(col, vec3(1.0, 0.64, 0.6), glint * 0.8);
    tone = mix(tone, 0.86, glint * 0.85);

    if (hkJunkOn > 0.5) {
      // About two minutes to cross a wide screen. At the still frame it sits
      // a little right of centre, below the headline's band.
      float span = hkAsp + 0.4;
      float speed = 0.014;
      float bx = mod(t * speed + span * 0.5 + 0.1 * hkWide - 3.0 * speed, span) - span * 0.5;
      vec2 at = vec2(bx, hkHz - mix(0.17, 0.15, hkTall));
      vec2 q = hkCentre(cell) - at;
      vec4 j = hkJunk(q);
      if (j.a >= 0.0) {
        col = j.rgb;
        tone = j.a;
      } else if (q.y < 0.0 && q.y > -0.13) {
        // Its reflection: the sails in broken red streaks.
        float rs = snoise(vec2(cell.y * 0.7 - t * 0.5, 3.0)) * 1.2;
        vec4 r = hkJunk(vec2(q.x + floor(rs + 0.5) * hkCellSize.x, -q.y * 1.1));
        float keep = step(0.3, hash21(vec2(cell.y, floor(t * 1.5))));
        if (r.a >= 0.0) {
          float fade = 1.0 + q.y * 6.0;
          col = mix(col, r.rgb * 0.7, 0.7 * keep * fade);
          tone = mix(tone, r.a * 0.75, 0.7 * keep * fade);
        }
        // A faint wake trailing behind.
        float back = -q.x - 0.068;
        if (back > 0.0 && back < 0.16 && abs(q.y + 0.004) < hkCellSize.y * (0.6 + back * 8.0)
            && mod(cell.x + floor(t * 2.0), 3.0) < 1.0) {
          col = mix(col, vec3(0.6, 0.6, 0.78), 0.5 * (1.0 - back / 0.16));
          tone = mix(tone, 0.4, 1.0 - back / 0.16);
        }
      }
    }
    c = vec4(col, tone);
  }

  // A little per-dot variation in brightness, as in a print, so wide
  // gradients don't read as flat bands.
  float jit = hash21(cell + 31.7) - 0.5;
  c.rgb *= 1.0 + jit * 0.14;

  // Intensity dims everything and quiets the middle band most, where a
  // headline sits.
  float tone = clamp(c.a, 0.0, 1.0);
  float quiet = 1.0 - hkIntensity;
  float centre = (1.0 - smoothstep(0.1, 0.4, abs(p.y - 0.52))) * (1.0 - smoothstep(0.15, 0.6, abs(p.x) / (0.5 * hkAsp + 0.01)));
  float dim = 1.0 - quiet * (0.45 + 0.4 * centre);
  tone *= mix(0.5, 1.0, dim);

  hkCacheUv = uv;
  hkCacheT = t;
  hkCacheValue = vec4(clamp(c.rgb, 0.0, 1.0) * dim, tone);
  return hkCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return hkScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return hkScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#060818";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Dots, Braille and quadrants blend neighbouring sizes with ordered
// dithering, so the sky's gradient reads as a smooth halftone.
const DITHER_CHARSETS: ReadonlySet<CharsetName> = new Set<CharsetName>([
  "braille",
  "dots",
  "quadrants",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to top, #060818 0%, #141436 30%, #2a1e4a 33%, #b0507a 48%, #4a3274 62%, #161a48 80%, #0a0e2c 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface HongKongProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Lower values quiet the middle band most. Default 1. */
  intensity?: number;
  /** How strongly the few LED crowns on the waterfront show their slowly changing colours, from 0 (plain white) to 1. Default 1. */
  lights?: number;
  /** The junk with red sails crossing the harbour. Default `true`. */
  junk?: boolean;
  /** @deprecated Use `junk`. Kept so older callers still turn the boat off. Default `true`. */
  ferry?: boolean;
  /** Mist drifting on Victoria Peak, from 0 (none) to 1. Default 1. */
  mist?: number;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for one-glyph charsets such as `dots`; `false`
   * for Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** Ignored: the city doesn't respond to the pointer. Accepted so any stage can pass it. */
  interactive?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night colour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a blue-hour gradient. */
  fallback?: ReactNode;
}

/**
 * Hong Kong. Victoria Harbour at blue hour, as a halftone of coloured
 * dots: a dense wall of towers lit in warm and cool windows climbs toward
 * the dark ridge of Victoria Peak, with the Bank of China Tower and Two
 * IFC standing above it, under a magenta to deep blue sky. The harbour
 * mirrors the city in long coloured reflections. Motion is calm: a junk
 * with red sails crosses, the reflections shimmer, a few windows change
 * and mist drifts on the Peak. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const HongKong = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  dither,
  square,
  cell = 7,
  stillTime = 3,
  interactive: _interactive,
  intensity = 1,
  lights = 1,
  junk,
  ferry,
  mist = 1,
  fallback = FALLBACK,
  ...props
}: HongKongProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gridX, gridY] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        // Samples per glyph, so windows and the landmarks snap to whole cells.
        hkGrid: [gridX, gridY],
        hkIntensity: clamp(intensity, 0, 1),
        hkJunkOn: (junk ?? ferry ?? true) ? 1 : 0,
        hkLights: clamp(lights, 0, 1),
        hkMist: clamp(mist, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={
        dither ??
        (DITHER_CHARSETS.has(charset) && !chars ? "blue-noise" : "none")
      }
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      square={square ?? gridX * gridY === 1}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
