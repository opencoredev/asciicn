"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The view is drawn on the engine's own sample grid: `s` is a whole sample
// (column, row from the bottom), so every edge, window and lattice bar lands
// on a sample and stays razor sharp. Sizes are set in box heights and then
// rounded to whole samples, so the city keeps its proportions in every
// charset and only the detail changes. Rows below `parisWaterRow` are the
// Seine; above it sit the quay, the tower, the Haussmann blocks, the dome
// of Les Invalides and the sky, tested near to far. Nothing but the lights,
// the water and one boat ever moves.
const SCENE = `
const float PARIS_WATER = 0.2;
const float PARIS_QUAY = 0.026;
const float PARIS_HEIGHT = 0.68;

// Set once per sample by parisScene and read by every layer.
float parisSw;
float parisSh;
float parisT;
float parisAspect;
float parisAxis;
float parisAxisX;
float parisWaterRow;
float parisGroundRow;
float parisGroundY;
float parisMesh;
float parisDomeCol;
float parisFine;

// A height in tower units (0 at the ground, 1 at the antenna tip) as whole rows above the ground.
float parisRows(float v) {
  return floor(v * PARIS_HEIGHT / parisSh + 0.5);
}

// A half width in tower units as whole columns either side of the axis, so
// every part is an odd number of columns wide and exactly symmetric.
float parisCols(float w) {
  return floor(w * PARIS_HEIGHT / parisSw + 0.5);
}

// Half the tower's width at height v, in tower units, fitted to the real
// thing: 62 m at the feet, 35 m at the first floor, 20 m at the second and
// 8 m under the top, on 330 m.
float parisOuter(float v) {
  return 0.015 + 0.175 * exp(-3.78 * v);
}

// A stable random value for whole-sample inputs. The engine's hash21
// repeats every 50 samples on integers, which shows up as tiled stars.
float parisHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The great arch between the legs: a half ellipse 0.105 tower units wide
// each side, springing from the legs low down and touching the first floor.
const float PARIS_ARCH_W = 0.105;
const float PARIS_SPRING = 0.045;

// Rows above the ground to the underside of the arch at column jx.
float parisArch(float jx) {
  float x = jx * parisSw / PARIS_HEIGHT / PARIS_ARCH_W;
  return parisRows(PARIS_SPRING + (0.153 - PARIS_SPRING) * sqrt(max(0.0, 1.0 - x * x)));
}

// A floor of the tower: bright rims top, bottom and at the ends, and a row
// of lit bays between them.
float parisDeck(float jx, float ry, float r0, float r1, float n) {
  if (jx > n - 0.5 || ry < r0 + 0.5 || ry > r1 - 1.5) {
    return 0.95;
  }
  return mod(jx, 2.0) < 0.5 ? 0.78 : 0.3;
}

// The cross-bracing: two families of diagonals a few samples apart, mirrored
// about the axis. Bars are bright; the gaps keep a dim fill that only the
// ramp charsets draw, which also gives Braille cells the tower's colour.
float parisLattice(float jx, float ry, float bar, float gap) {
  float d = min(mod(jx + ry, parisMesh), mod(jx - ry, parisMesh));
  return d < 0.5 ? bar : gap;
}

vec4 parisTower(vec2 s, out float cover) {
  cover = 0.0;
  float jx = abs(s.x - parisAxis);
  float ry = s.y - parisGroundRow;
  float v = (ry + 0.5) * parisSh / PARIS_HEIGHT;
  if (ry < 0.0 || v > 1.0 || jx > parisCols(0.2)) {
    return vec4(0.0);
  }
  vec3 gold = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.78, 0.44), clamp(v * 1.2, 0.0, 1.0));
  vec3 bright = mix(gold, vec3(1.0, 0.92, 0.7), 0.5);
  // Floors and the top, in rows, each kept at least a row apart.
  float a0 = parisRows(0.157);
  float a1 = max(parisRows(0.19), a0 + 1.0);
  float b0 = max(parisRows(0.345), a1 + 2.0);
  float b1 = max(parisRows(0.366), b0 + 1.0);
  float c0 = max(parisRows(0.828), b1 + 2.0);
  float c1 = max(parisRows(0.846), c0 + 1.0);
  float d1 = max(parisRows(0.884), c1 + 1.0);
  float e1 = max(parisRows(0.905), d1 + 1.0);
  float tone = 0.0;
  if (ry >= e1) {
    // The antenna, a single column.
    if (jx > 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(bright, 0.85);
  }
  if (ry >= d1) {
    // The lantern that houses the beacon.
    if (jx > parisCols(0.008)) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(1.0, 0.94, 0.78, 1.0);
  }
  if (ry >= c1) {
    // The top: a small lit cabin over the third floor.
    float n = parisCols(0.017);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, c1 - 1.0, d1, n);
    return vec4(tone > 0.9 ? bright : gold, tone);
  }
  if (ry >= c0) {
    float n = parisCols(0.032);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, c0, c1, n);
    return vec4(tone > 0.9 ? bright : gold, tone);
  }
  if (ry >= b0 && ry < b1) {
    float n = parisCols(parisOuter(0.345) + 0.005);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, b0, b1, n);
    return vec4(tone > 0.9 ? bright : gold, tone);
  }
  if (ry >= a0 && ry < a1) {
    float n = parisCols(parisOuter(0.157) + 0.006);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, a0, a1, n);
    return vec4(tone > 0.9 ? bright : gold, tone);
  }
  // The legs and the shaft, with the openings between the legs.
  float n = parisCols(parisOuter(v));
  if (jx > n) {
    return vec4(0.0);
  }
  float m = 0.0;
  if (ry < a0) {
    float acol = parisCols(PARIS_ARCH_W);
    float spring = parisRows(PARIS_SPRING);
    // Below the spring the legs stand apart with straight inner faces.
    if (jx < acol && ry < parisArch(jx)) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (ry < spring + 1.0 && jx < acol + 0.5) {
      return vec4(bright, 0.95);
    }
    if (jx < acol) {
      float ra = parisArch(jx);
      // The arch is a line two rows thick in fine charsets, and it stays
      // unbroken where it runs steeply by reaching up to its neighbours' rows.
      float thick = parisSh < 0.008 ? 2.0 : 1.0;
      float reach = max(parisArch(jx + 1.0), parisArch(abs(jx - 1.0)));
      if (ry < max(ra + thick, reach)) {
        return vec4(bright, 0.95);
      }
    }
    // Above the arch the legs lean in towards the first floor; between
    // their inner faces and the arch runs a lighter web.
    float k = clamp((v - PARIS_SPRING) / (0.157 - PARIS_SPRING), 0.0, 1.0);
    m = parisCols(parisOuter(v) - mix(0.058, 0.047, k));
    if (jx < m - 0.5) {
      return vec4(gold, parisLattice(jx, ry, 0.62, 0.2));
    }
    if (ry < spring) {
      m = acol;
    }
  } else if (ry < b0) {
    float k = clamp((v - 0.19) / 0.155, 0.0, 1.0);
    m = parisCols(parisOuter(v) - mix(0.042, 0.027, k));
    if (jx < m) {
      return vec4(0.0);
    }
  } else {
    // Above the second floor the legs close up in a long narrow slot.
    float k = clamp((v - 0.366) / 0.23, 0.0, 1.0);
    m = parisCols(0.024 * (1.0 - k));
    if (jx < m) {
      return vec4(0.0);
    }
  }
  cover = 1.0;
  if (jx > n - 0.5 || (m > 0.5 && jx < m + 0.5)) {
    return vec4(bright, 0.95);
  }
  return vec4(gold, parisLattice(jx, ry, 0.72, 0.26));
}

// Most windows keep their state. One in four turns on or off every few
// minutes, fading over three seconds, so the city changes slowly.
float parisLit(vec2 id, float chance) {
  if (parisHash(id) > 0.25) {
    return step(1.0 - chance, parisHash(id + 7.1));
  }
  float period = 120.0 + 150.0 * parisHash(id + 3.3);
  float phase = parisT / period + parisHash(id + 5.5);
  float k = floor(phase);
  float now = step(1.0 - chance, parisHash(id + k * 1.37));
  float before = step(1.0 - chance, parisHash(id + (k - 1.0) * 1.37));
  return mix(before, now, smoothstep(0.0, 3.0 / period, fract(phase)));
}

// Facade and mansard heights of block id, in whole cells, so a roof and the
// windows under it never share a glyph and muddy each other's colour. None
// where the Champ de Mars opens around the tower, lower blocks nearest it.
vec2 parisBlock(float id, float wc) {
  float gap = abs((id + 0.5) * wc * parisGrid.x * parisSw - parisAxisX);
  if (gap < 0.2) {
    return vec2(0.0);
  }
  float low = mix(0.75, 1.0, smoothstep(0.2, 0.45, gap));
  float rows = parisSh * parisGrid.y;
  float facade = (0.058 + 0.024 * parisHash(vec2(id, 3.7))) * low;
  float roof = 0.018 + 0.01 * parisHash(vec2(id, 8.1));
  return vec2(max(2.0, floor(facade / rows + 0.5)), max(1.0, floor(roof / rows + 0.5)));
}

// Haussmann blocks on the far bank: a pale cornice over floors of tall
// windows, a zinc mansard with dormers, and chimney stacks on the party
// walls. Blocks, roofs and stacks are laid out in whole cells.
vec4 parisBlocks(vec2 s, out float cover) {
  cover = 0.0;
  float ry = s.y - parisGroundRow;
  if (ry < 0.0) {
    return vec4(0.0);
  }
  vec2 cell = floor(vec2(s.x, ry) / parisGrid);
  vec2 inCell = vec2(s.x, ry) - cell * parisGrid;
  float wc = max(5.0, floor(0.115 / (parisSw * parisGrid.x) + 0.5));
  float id = floor(cell.x / wc);
  float uc = cell.x - id * wc;
  vec2 b = parisBlock(id, wc);
  vec2 left = parisBlock(id - 1.0, wc);
  float top = b.x + b.y;
  // A chimney stack one cell wide on the party wall, a cell above the
  // taller roof, with its pots along the top in the fine charsets.
  if (uc < 0.5 && b.x > 0.5 && left.x > 0.5 && parisHash(vec2(id, 5.3)) > 0.3 && cell.y >= b.x) {
    float stackTop = max(top, left.x + left.y) + 1.0;
    if (cell.y < stackTop) {
      bool pot = cell.y > stackTop - 1.5 && inCell.y > parisGrid.y - 1.5 && mod(inCell.x, 2.0) > 0.5;
      cover = 1.0;
      return vec4(0.8, 0.54, 0.46, pot ? 0.0 : 0.6);
    }
  }
  if (b.x < 0.5 || cell.y >= top) {
    return vec4(0.0);
  }
  vec3 lamp = vec3(1.0, 0.76, 0.42);
  float sy = ry - b.x * parisGrid.y;
  if (sy >= 0.0) {
    // The mansard: steep at both ends, a brighter ridge along the top.
    float u = s.x - id * wc * parisGrid.x;
    // Steep like the real thing: about 70 degrees, whatever the sample shape.
    float inset = 1.0 + floor(sy * parisSh / parisSw * 0.4 + 0.3);
    if (u < inset || u > wc * parisGrid.x - 1.0 - inset) {
      return vec4(0.0);
    }
    cover = 1.0;
    vec3 zinc = vec3(0.34, 0.4, 0.62);
    // A lighter ridge along the top, and a stone cornice under roofs tall
    // enough to keep some zinc between the two.
    if (sy > b.y * parisGrid.y - 1.5) {
      return vec4(0.5, 0.56, 0.8, 0.6);
    }
    if (sy < 0.5 && b.y * parisGrid.y > 3.5) {
      return vec4(0.66, 0.64, 0.72, 0.6);
    }
    // Dormers in the lowest cell row of roofs two cells tall or more, one
    // every third cell, so a dormer's cell never shares the ridge.
    if (b.y > 1.5 && cell.y < b.x + 0.5 && mod(uc, 3.0) > 1.5 && uc < wc - 1.5) {
      float on = parisLit(vec2(cell.x, id + 101.0), 0.35);
      bool pane = inCell.x < 0.5 && inCell.y > 0.5 && inCell.y < parisGrid.y - 0.5;
      if (parisFine < 0.5) {
        return vec4(mix(zinc, lamp, on), mix(0.22, 0.85, on));
      }
      if (pane) {
        return vec4(on > 0.5 ? lamp : zinc, 0.85 * on);
      }
      return vec4(on > 0.5 ? lamp : zinc, on > 0.5 ? 0.0 : 0.55);
    }
    return vec4(zinc, parisFine > 0.5 ? 0.55 : 0.16);
  }
  cover = 1.0;
  vec3 tint = parisHash(cell + 41.0) > 0.88 ? vec3(0.72, 0.82, 1.0) : lamp;
  float on = parisLit(cell + vec2(0.0, id * 13.0), cell.y < 0.5 ? 0.6 : 0.42);
  bool bay = uc > 0.5 && uc < wc - 1.5;
  if (parisFine > 0.5) {
    // One tall window per cell, in its left column, lit gold or left a dim
    // slate, so every cell keeps a single clean colour.
    vec3 col = mix(vec3(0.3, 0.34, 0.54), tint, on);
    bool pane = bay && inCell.x < 0.5 && inCell.y > 0.5;
    return vec4(col, pane ? mix(0.55, 0.9, on) : 0.0);
  }
  // Coarse charsets: a window in every other column on every row.
  if (bay && mod(s.x, 2.0) < 0.5) {
    return vec4(tint, 0.9 * on);
  }
  return vec4(0.42, 0.42, 0.58, 0.12);
}

// The gilded dome of Les Invalides, far off and dimmed by distance.
vec4 parisDome(vec2 s, out float cover) {
  cover = 0.0;
  float jx = abs(s.x - parisDomeCol);
  float y = (s.y - parisGroundRow + 0.5) * parisSh;
  if (y < 0.0 || y > 0.18 || jx * parisSw > 0.07) {
    return vec4(0.0);
  }
  vec3 stone = vec3(0.5, 0.5, 0.62);
  vec3 gilt = vec3(0.78, 0.62, 0.34);
  float w = 0.0;
  float tone = 0.0;
  vec3 col = stone;
  if (y < 0.06) {
    w = 0.065;
    tone = 0.14;
  } else if (y < 0.076) {
    w = 0.04;
    tone = 0.16;
  } else if (y < 0.106) {
    // The drum, ringed with columns.
    w = 0.026;
    tone = mod(jx, 2.0) < 0.5 ? 0.55 : 0.18;
  } else if (y < 0.14) {
    float e = (y - 0.106) / 0.034;
    w = 0.029 * sqrt(max(0.0, 1.0 - e * e));
    col = gilt;
    // Gilded ribs down the dome.
    tone = mod(jx, 3.0) < 0.5 ? 0.58 : 0.24;
  } else if (y < 0.157) {
    w = 0.005;
    col = gilt;
    tone = 0.58;
  } else {
    w = 0.0;
    col = gilt;
    tone = 0.55;
  }
  float n = floor(w / parisSw + 0.5);
  if (jx > n) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (jx > n - 0.5) {
    tone = max(tone, 0.55);
  }
  return vec4(col, tone);
}

// The stone quay along the water under a darker coping.
vec4 parisQuay(vec2 s, out float cover) {
  cover = 0.0;
  if (s.y < parisWaterRow || s.y >= parisGroundRow) {
    return vec4(0.0);
  }
  cover = 1.0;
  return vec4(0.32, 0.34, 0.5, s.y > parisGroundRow - 1.5 ? 0.56 : 0.0);
}

// Everything above the water, near to far, without the sky.
vec4 parisAbove(vec2 s, out float cover) {
  vec4 hit = parisQuay(s, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = parisTower(s, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = parisBlocks(s, cover);
  if (cover > 0.5) {
    return hit;
  }
  return parisDome(s, cover);
}

// A bateau-mouche heading downstream: a pale hull, a long glass cabin lit
// warm between its mullions, and a flat roof. It moves in whole columns.
float parisBoatRow;

vec4 parisBoat(vec2 s, out float cover) {
  cover = 0.0;
  if (parisBoatOn < 0.5) {
    return vec4(0.0);
  }
  float len = max(10.0, floor(0.17 / parisSw + 0.5));
  float travel = parisAspect + 0.5;
  float x0 = floor((mod(parisT * 0.011 + parisAspect * 0.2 + 0.25, travel) - 0.25) / parisSw);
  float u = s.x - x0;
  float r = s.y - parisBoatRow;
  float hull = max(1.0, floor(0.007 / parisSh + 0.5));
  float cabin = max(1.0, floor(0.008 / parisSh + 0.5));
  float roof = parisSh < 0.008 ? 1.0 : 0.0;
  if (u < 0.0 || u > len - 0.5 || r < 0.0 || r > hull + cabin + roof - 0.5) {
    return vec4(0.0);
  }
  if (r < hull) {
    // The bow rakes forward and the stern tucks in at the waterline.
    float cut = hull - 1.0 - r;
    if (u < cut || u > len - 1.0 - cut * 2.0) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.8, 0.84, 0.96, 0.62);
  }
  float c0 = floor(len * 0.12);
  float c1 = floor(len * 0.8);
  if (u < c0 || u > c1) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (r > hull + cabin - 0.5) {
    return vec4(0.66, 0.72, 0.9, 0.58);
  }
  return vec4(1.0, 0.8, 0.5, mod(u - c0, 2.0) < 0.5 ? 0.9 : 0.3);
}

// The Seine: the boat, then the boat's lit cabin and the whole tower
// mirrored as striped streaks (every other row, short gaps, each
// row easing a column or two from side to side), then a few faint glints.
vec4 parisWater(vec2 s) {
  float cover;
  vec4 boat = parisBoat(s, cover);
  if (cover > 0.5) {
    return boat;
  }
  float k = parisWaterRow - 1.0 - s.y;
  float depth = k / max(parisWaterRow, 1.0);
  float sway = (0.002 + 0.007 * depth) / parisSw;
  float off = floor(sin(k * 0.9 + parisT * 0.35) * sway + 0.5);
  vec4 hit = parisBoat(vec2(s.x + off, 2.0 * parisBoatRow - 1.0 - s.y), cover);
  float lit = step(0.85, hit.a);
  if (cover < 0.5) {
    hit = parisTower(vec2(s.x + off, 2.0 * parisWaterRow - 1.0 - s.y), cover);
    lit = step(0.15, hit.a);
  }
  if (cover > 0.5) {
    vec3 col = mix(hit.rgb, vec3(0.5, 0.6, 1.0), 0.12) * 0.85;
    float stripe = parisFine > 0.5 ? step(mod(k, 2.0), 0.5) : 1.0;
    float run = step(-0.6 + 0.6 * depth, snoise(vec2(s.x * parisSw * 9.0 + parisT * 0.03, k * 0.3 - parisT * 0.05)));
    return vec4(col, lit * stripe * run * mix(0.68, 0.46, depth));
  }
  vec3 glintCol = vec3(0.46, 0.56, 0.9);
  float g = snoise(vec2(s.x * parisSw * 30.0 + k * 7.3, k * 1.31 + parisT * 0.05));
  if (g > 0.9) {
    return vec4(glintCol, parisFine > 0.5 ? 0.55 : 0.14);
  }
  return vec4(glintCol, 0.0);
}

// The beacon on top turns slowly; from here it reads as a soft glow that
// swells as the lamp faces you, about every eleven seconds.
float parisGlow(vec2 p) {
  vec2 c = vec2(parisAxisX, parisGroundY + PARIS_HEIGHT * 0.895);
  vec2 d = (p - c) * vec2(0.8, 1.2);
  float turn = 0.5 + 0.5 * cos(parisT * 0.55);
  return (0.55 + 0.45 * turn * turn) * exp(-length(d) / 0.018) * parisBeaconOn;
}

// A sparse field of faint stars high up. Empty sky near the tower carries
// its gold at zero tone, so Braille cells on its edge keep the colour.
vec4 parisSky(vec2 s, vec2 p) {
  float y = p.y - parisGroundY;
  float v = y / PARIS_HEIGHT;
  if (v < 1.0 && abs(p.x - parisAxisX) < parisOuter(max(v, 0.0)) * PARIS_HEIGHT + 0.012) {
    return vec4(1.0, 0.72, 0.36, 0.0);
  }
  vec3 starCol = vec3(0.78, 0.84, 1.0);
  float h = parisHash(s + 17.0);
  float density = 60.0 * parisSw * parisSh * smoothstep(0.26, 0.42, y);
  if (h > 1.0 - density) {
    float twinkle = 0.72 + 0.28 * sin(parisT * (0.5 + h * 0.6) + parisHash(s + 3.0) * 40.0);
    return vec4(starCol * twinkle, parisFine > 0.5 ? 0.6 : 0.24);
  }
  return vec4(starCol, 0.0);
}

vec2 parisCacheUv = vec2(-1.0);
float parisCacheT = -1.0;
vec4 parisCacheValue = vec4(0.0);

vec4 parisScene(vec2 uv, vec2 res, float t) {
  if (uv == parisCacheUv && t == parisCacheT) {
    return parisCacheValue;
  }
  parisAspect = res.x / res.y;
  parisSh = 1.0 / res.y;
  parisSw = parisAspect / max(ascii_samples.x, 1.0);
  parisT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  // Right of centre on wide boxes, so a headline fits on the left; centred on tall ones.
  float axis = parisAspect * mix(0.5, 0.64, smoothstep(0.95, 1.4, parisAspect));
  parisAxis = floor(axis / parisSw);
  parisAxisX = (parisAxis + 0.5) * parisSw;
  parisFine = parisGrid.x * parisGrid.y > 1.5 ? 1.0 : 0.0;
  // The waterline and the ground sit on cell boundaries, so the quay, the
  // blocks and their mirror images line up with whole glyphs.
  float rows = parisSh * parisGrid.y;
  parisWaterRow = floor(PARIS_WATER / rows + 0.5) * parisGrid.y;
  parisGroundRow = parisWaterRow + max(1.0, floor(PARIS_QUAY / rows + 0.5)) * parisGrid.y;
  parisGroundY = parisGroundRow * parisSh;
  parisMesh = clamp(floor(PARIS_HEIGHT / parisSh / 40.0 + 0.5), 3.0, 6.0);
  parisDomeCol = floor((parisAxisX - (parisAspect > 1.15 ? 0.6 : 0.3)) / parisSw);
  parisBoatRow = floor(0.07 / rows + 0.5) * parisGrid.y;
  vec2 p = (s + 0.5) * vec2(parisSw, parisSh);

  vec4 hit;
  if (s.y < parisWaterRow) {
    hit = parisWater(s);
  } else {
    float cover;
    hit = parisAbove(s, cover);
    if (cover < 0.5) {
      hit = parisSky(s, p);
    }
    // Ramp charsets draw faint tones too, so their glow is cut off sooner.
    float glow = parisGlow(p);
    if (glow > (parisFine > 0.5 ? 0.02 : 0.32)) {
      hit.rgb = mix(hit.rgb, vec3(1.0, 0.95, 0.82), clamp(glow * 1.2, 0.0, 1.0));
      hit.a = max(hit.a, glow);
    }
  }
  // Intensity dims colour in step. Ramp charsets also thin their glyphs,
  // more gently. Braille and quadrants drop any dot under half tone, so
  // there every dot stays and only the tone above that line is scaled.
  float tone = hit.a < 0.05 ? 0.0 : clamp(hit.a, 0.0, 1.0);
  if (parisFine > 0.5 && tone > 0.505) {
    tone = parisIntensity > 0.0 ? 0.505 + (tone - 0.505) * parisIntensity : 0.0;
  } else {
    tone *= sqrt(parisIntensity);
  }
  parisCacheUv = uv;
  parisCacheT = t;
  parisCacheValue = vec4(hit.rgb * parisIntensity, tone);
  return parisCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its blue hour behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const BLUE_HOUR = "#0a1034";
const BLUE_HOUR_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0a1034 0%, #0a1034 70%, #0c1440 80%, #0a1034 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface ParisProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The slow glow of the beacon on top of the tower. Default `true`. */
  beacon?: boolean;
  /** The bateau-mouche crossing the river. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's blue hour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the blue hour. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the blue hour as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Paris at blue hour. The Eiffel Tower stands lit gold over the Seine with
 * a soft beacon glow at its tip, between Haussmann rooftops and the far
 * dome of Les Invalides, while one bateau-mouche crosses the river.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Paris = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 8,
  stillTime = 0,
  intensity = 1,
  beacon = true,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: ParisProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        parisBeaconOn: beacon ? 1 : 0,
        parisBoatOn: boat ? 1 : 0,
        // The samples per glyph: layouts snap to whole cells, and in Braille
        // and quadrants, which light a dot only above half tone, faint
        // details such as stars and glints are drawn as single dots.
        parisGrid: [gx, gy],
        parisIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (BLUE_HOUR_MODES.has(mode) ? BLUE_HOUR : undefined)}
      cell={cell}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
