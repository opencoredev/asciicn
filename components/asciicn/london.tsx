"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Westminster at night from the South Bank, across the Thames. The view is
// one function of p = (x in box heights, y up) with the far embankment at
// ldShore. Every shape is measured in whole samples (`ldCw` wide, `ldPx`
// tall) and tested at sample centres, so edges land on the sample grid and
// window rows stay rectilinear at any size. Layers are tested near to far
// and the first one that covers a sample wins: the river boat, the river,
// the embankment lamps, the Elizabeth Tower, the Palace of Westminster,
// Tower Bridge, the Shard and the low city behind, then the sky. A faint
// haze sits on the water and the bank, only where nothing else is drawn,
// and never moves. `ldScene` returns colour and tone, cached per sample so
// the field and colour passes share one evaluation.
//
// Cells that hold several samples (Braille, quadrants) light a dot only
// above tone 0.5 and average the colour of all their samples, so `ldMulti`
// keeps structure above 0.5 and lets empty samples borrow a lit
// neighbour's colour. Ramp charsets get lower tones, so stone reads as mid
// glyphs and lamps as dense ones.
const SCENE = `
const float LD_PI = 3.14159265;
const vec3 LD_AMBER = vec3(1.0, 0.66, 0.28);
const vec3 LD_STONE = vec3(0.98, 0.76, 0.44);
const vec3 LD_GOLD = vec3(1.0, 0.8, 0.36);
const vec3 LD_WINDOW = vec3(1.0, 0.86, 0.56);
const vec3 LD_STEEL = vec3(0.46, 0.66, 1.0);

// Set once per sample by ldScene, read by every layer.
float ldPx = 0.0;
float ldCw = 0.0;
float ldTime = 0.0;
float ldShore = 0.0;
float ldMulti = 0.0;
float ldEtX = 0.0;
float ldPalL = 0.0;
float ldPalR = 0.0;
float ldTbX = 0.0;
float ldTbS = 1.0;
float ldShX = 0.0;

// Sizes rounded to whole samples, never below one. They divide back into
// whole samples only up to float rounding, so edge tests round the count
// again instead of trusting the division.
float ldSnapW(float w) {
  return max(1.0, floor(w / ldCw + 0.5)) * ldCw;
}

float ldSnapH(float h) {
  return max(1.0, floor(h / ldPx + 0.5)) * ldPx;
}

float ldCount(float w) {
  return floor(w / ldCw + 0.5);
}

float ldRows(float h) {
  return floor(h / ldPx + 0.5);
}

// A centre line on a boundary between two sample columns, so shapes around
// it come out symmetric.
float ldSnapX(float x) {
  return floor(x / ldCw + 0.5) * ldCw;
}

// Structure tone: above the dot threshold in Braille and quadrants, a mid
// glyph in ramp charsets.
float ldLine(float multi, float ramp) {
  return mix(ramp, multi, ldMulti);
}

// Whether a window is lit. Most hold their state; about one in sixteen
// re-rolls on its own clock of 30 to 70 seconds. Hash inputs stay small:
// hash21 loses its spread on large floats.
float ldLit(float id, float gx, float gy, float share) {
  vec2 cell = vec2(mod(id, 113.0) * 1.37 + mod(gx, 89.0) * 0.61, mod(gy, 97.0) * 0.73 + 3.1);
  float clock = hash21(cell + 17.3);
  float roll = 0.0;
  if (clock < 0.06) {
    float epoch = floor(ldTime / (30.0 + 660.0 * clock) + clock * 97.0);
    roll = mod(epoch, 37.0) * 0.371;
  }
  return step(hash21(cell + vec2(roll, roll * 0.7)), share);
}

// A slow red aviation light: one soft pulse every 1.8 seconds.
float ldBeacon(float phase) {
  float f = fract(ldTime / 1.8 + phase);
  return smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.25, 0.6, f));
}

vec4 ldRed(float b) {
  return vec4(mix(vec3(0.55, 0.13, 0.11), vec3(1.0, 0.22, 0.16), b), ldLine(0.55 + 0.4 * b, 0.3 + 0.6 * b));
}

// Distance in samples from a sample to the segment a-b, both in box units.
float ldSegment(vec2 p, vec2 a, vec2 b) {
  vec2 scale = vec2(ldCw, ldPx);
  vec2 pa = (p - a) / scale;
  vec2 ba = (b - a) / scale;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// Gothic stone: floodlit piers on every third column, string courses every
// eight rows, and a dark slit window in each panel. u and row count
// samples from the centre line and the ground.
vec4 ldStone(float u, float row, vec3 tint, float bright) {
  float course = mod(row, 8.0);
  if (course < 1.0) {
    return vec4(tint, ldLine(0.86, 0.6) * bright);
  }
  if (mod(u, 3.0) < 1.0) {
    return vec4(tint, ldLine(0.78, 0.5) * bright);
  }
  if (course > 2.5 && course < 6.5) {
    return vec4(tint * 0.75, ldLine(0.0, 0.18));
  }
  return vec4(tint * 0.92, ldLine(0.66, 0.4) * bright);
}

// The Elizabeth Tower: a floodlit Gothic shaft, the clock stage with its
// glowing dial and hands, the gilded belfry with its tall openings, a
// gallery, then the steep spire with corner pinnacles and the finial.
vec4 ldBigBen(vec2 p, out float cover) {
  cover = 0.0;
  float c = ldSnapX(ldEtX);
  float x = p.x - c;
  float q = abs(x);
  float v = p.y - ldShore;
  float tip = ldSnapH(0.735);
  if (v < 0.0 || v > tip || q > ldSnapW(0.055)) {
    return vec4(0.0);
  }
  float u = floor(q / ldCw);
  float row = floor(v / ldPx);
  float shaft = ldSnapH(0.4);
  float stage = ldSnapH(0.505);
  float belfry = ldSnapH(0.56);
  float gallery = belfry + ldSnapH(0.012);
  float spireTop = ldSnapH(0.7);
  if (v < shaft) {
    float hw = ldSnapW(0.042);
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (u >= ldCount(hw) - 1.0) {
      return vec4(LD_GOLD, ldLine(0.9, 0.62));
    }
    return ldStone(u, row, LD_STONE, 1.0);
  }
  if (v < stage) {
    float hw = ldSnapW(0.049);
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    // The dial: opal glass lit from behind, with a gold rim, four hour
    // marks and the two hands, which keep real clock time from ten past
    // ten.
    vec2 centre = vec2(c, ldShore + (shaft + stage) * 0.5);
    vec2 d = p - centre;
    float radius = 0.037 / ldPx;
    float r = length((p - centre) / ldPx);
    if (r < radius) {
      // A dark ring keeps the round dial apart from its square gold frame.
      if (r > radius - 1.0) {
        return vec4(0.45, 0.32, 0.16, ldLine(0.0, 0.2));
      }
      float minute = 2.0 * LD_PI * fract(ldTime / 3600.0 + 0.1667);
      float hour = 2.0 * LD_PI * fract(ldTime / 43200.0 + 0.847);
      vec2 mHand = centre + vec2(sin(minute), cos(minute)) * 0.032;
      vec2 hHand = centre + vec2(sin(hour), cos(hour)) * 0.021;
      float hands = min(ldSegment(p, centre, mHand), ldSegment(p, centre, hHand));
      float ang = atan(d.x, d.y);
      float tick = abs(fract(ang / (LD_PI * 0.5) + 0.5) - 0.5);
      bool mark = r > radius - 2.6 && tick < 0.05;
      if (hands < 0.5 || mark) {
        return vec4(0.3, 0.22, 0.12, ldLine(0.0, 0.15));
      }
      return vec4(1.0, 0.97, 0.86, ldLine(0.92, 0.84));
    }
    // A gold frame round the dial and dark stone in the corners.
    if (u >= ldCount(hw) - 1.0 || row == ldRows(shaft) || row == ldRows(stage) - 1.0) {
      return vec4(LD_GOLD, ldLine(0.88, 0.6));
    }
    return vec4(LD_STONE * 0.8, ldLine(0.58, 0.32));
  }
  if (v < belfry) {
    float hw = ldSnapW(0.043);
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    // Gilded panels with three tall openings a side, dark against the gold.
    float open = mod(u, 3.0);
    float local = row - ldRows(stage);
    float rows = ldRows(belfry) - ldRows(stage);
    if (u < ldCount(hw) - 1.0 && open > 0.5 && open < 1.5 && local > 1.0 && local < rows - 2.0) {
      return vec4(LD_GOLD * 0.6, ldLine(0.0, 0.2));
    }
    return vec4(LD_GOLD, ldLine(0.9, 0.7));
  }
  if (v < gallery) {
    if (q > ldSnapW(0.047)) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(1.0, 0.9, 0.62, ldLine(0.95, 0.8));
  }
  if (v < spireTop) {
    float t = (v - gallery) / (spireTop - gallery);
    float hw = ldSnapW(mix(0.036, 0.004, t));
    // Pinnacles at the corners of the spire's foot.
    float pin = ldSnapW(0.045);
    if (q <= pin && q > pin - ldCw && v < gallery + ldSnapH(0.045)) {
      cover = 1.0;
      return vec4(LD_GOLD, ldLine(0.82, 0.55));
    }
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (u >= ldCount(hw) - 1.0) {
      return vec4(LD_GOLD, ldLine(0.84, 0.58));
    }
    // Dark slate with lit dormer slits low down.
    if (t < 0.3 && mod(u, 2.0) < 1.0 && mod(row, 4.0) < 2.0) {
      return vec4(LD_WINDOW, ldLine(0.8, 0.6));
    }
    return vec4(0.42, 0.4, 0.5, ldLine(0.56, 0.28));
  }
  if (q > ldCw) {
    return vec4(0.0);
  }
  cover = 1.0;
  return vec4(LD_GOLD, ldLine(0.88, 0.62));
}

// The Palace of Westminster: a long floodlit front of tall lit windows in
// bays, a pinnacle over every buttress, two raised pavilions, the Central
// Tower's lantern and spire, and the square Victoria Tower at the far end.
vec4 ldPalace(vec2 p, out float cover) {
  cover = 0.0;
  float v = p.y - ldShore;
  if (v < 0.0 || p.x < ldPalL - 0.08 || p.x > ldPalR) {
    return vec4(0.0);
  }
  float col = floor((p.x - ldSnapX(ldPalL)) / ldCw);
  float row = floor(v / ldPx);
  float len = ldCount(ldPalR - ldSnapX(ldPalL));
  float bay = max(4.0, ldCount(0.03));
  // The Victoria Tower: square, with corner turrets and a flagpole.
  float vc = ldSnapX(ldPalL + 0.02);
  float vq = abs(p.x - vc);
  float vhw = ldSnapW(0.046);
  float vtop = ldSnapH(0.45);
  if (vq <= vhw + ldCw && v < vtop + ldSnapH(0.08)) {
    float vu = floor(vq / ldCw);
    float edge = ldCount(vhw) - 1.0;
    if (v < vtop && vq <= vhw) {
      cover = 1.0;
      if (vu >= edge || row >= ldRows(vtop) - 1.0) {
        return vec4(LD_STONE, ldLine(0.86, 0.58) * 0.92);
      }
      // Tall arched windows in pairs up the tower.
      float band = mod(row, 10.0);
      if (mod(vu, 3.0) > 0.5 && band > 2.0 && band < 8.0 && vu < edge - 1.0) {
        float lit = ldLit(7.0, vu + (p.x < vc ? 0.0 : 20.0), floor(row / 10.0), 0.55);
        return lit > 0.5 ? vec4(LD_WINDOW, 0.8) : vec4(LD_STONE * 0.6, ldLine(0.0, 0.15));
      }
      return vec4(LD_STONE * 0.92, ldLine(0.66, 0.38) * 0.92);
    }
    // Turrets at the corners, then the flagpole.
    if (v < vtop + ldSnapH(0.04) && vq <= vhw && vu >= ldCount(vhw) - 2.0) {
      cover = 1.0;
      return vec4(LD_STONE, ldLine(0.82, 0.55));
    }
    if (vq < ldCw && v < vtop + ldSnapH(0.08)) {
      cover = 1.0;
      return vec4(0.8, 0.78, 0.85, ldLine(0.6, 0.35));
    }
  }
  if (col < 0.0 || col >= len) {
    return vec4(0.0);
  }
  // The Central Tower, a little past the middle: an octagonal lantern
  // with tall lit windows and a spire.
  float cc = ldSnapX(ldSnapX(ldPalL) + (ldPalR - ldPalL) * 0.56);
  float cq = abs(p.x - cc);
  float cu = floor(cq / ldCw);
  float lantern = ldSnapH(0.29);
  float roof = ldSnapH(0.16);
  if (v >= roof && v < ldSnapH(0.4)) {
    float chw = ldSnapW(0.022);
    if (v < lantern && cq <= chw) {
      cover = 1.0;
      if (cu >= ldCount(chw) - 1.0 || row == ldRows(lantern) - 1.0) {
        return vec4(LD_STONE, ldLine(0.84, 0.55));
      }
      if (mod(cu, 2.0) < 1.0 && mod(row, 6.0) > 1.0) {
        return vec4(LD_WINDOW, ldLine(0.82, 0.7));
      }
      return vec4(LD_STONE * 0.85, ldLine(0.62, 0.35));
    }
    if (v >= lantern) {
      float t = (v - lantern) / (ldSnapH(0.4) - lantern);
      float shw = ldSnapW(mix(0.02, 0.0, t));
      if (cq <= shw || (cq < ldCw && t < 0.98)) {
        cover = 1.0;
        return vec4(LD_STONE * 0.95, ldLine(0.74, 0.48));
      }
    }
  }
  // Two pavilions rise a little above the main front.
  float pav1 = abs(col - floor(len * 0.3));
  float pav2 = abs(col - floor(len * 0.8));
  float pavHalf = bay;
  bool pavilion = pav1 < pavHalf || pav2 < pavHalf;
  float top = pavilion ? ldRows(0.19) : ldRows(0.16);
  float u = mod(col, bay);
  if (row < top) {
    cover = 1.0;
    // Buttresses at every bay, a parapet along the top and the river
    // terrace along the bottom.
    if (row >= top - 1.0 || row < 2.0) {
      return vec4(LD_STONE, ldLine(0.84, 0.55));
    }
    if (u < 1.0) {
      return vec4(LD_STONE, ldLine(0.76, 0.48));
    }
    // Tall windows: three rows lit, one row of stone, in each bay.
    float floor4 = mod(row - 2.0, 4.0);
    if (floor4 < 3.0 && u > 0.5 && u < bay - 0.5) {
      float lit = ldLit(19.0, floor(col / bay) * 3.0 + u, floor((row - 2.0) / 4.0), 0.72);
      if (lit > 0.5) {
        return vec4(LD_WINDOW, ldLine(0.84, 0.72));
      }
      return vec4(LD_STONE * 0.55, ldLine(0.0, 0.16));
    }
    return vec4(LD_STONE * 0.9, ldLine(0.64, 0.36));
  }
  // A slim pinnacle over each buttress, and corner pinnacles on the
  // pavilions.
  float spike = pavilion ? ldRows(0.03) : ldRows(0.035);
  if (u < 1.0 && row < top + spike) {
    cover = 1.0;
    return vec4(LD_STONE, ldLine(0.8, 0.5));
  }
  // The steep roofs behind the parapet, dark slate.
  if (row < top + 2.0 && !pavilion && u > 0.5) {
    cover = 1.0;
    return vec4(0.34, 0.34, 0.46, ldLine(0.52, 0.22));
  }
  return vec4(0.0);
}

// Tower Bridge, further down the river: two Gothic towers with steep
// roofs and corner turrets, the high walkways between them, the road deck,
// and the suspension chains sweeping down to the banks on each side.
vec4 ldBridge(vec2 p, out float cover) {
  cover = 0.0;
  float v = p.y - ldShore;
  float s = ldTbS;
  float c = ldSnapX(ldTbX);
  float span = ldSnapW(0.078 * s);
  float reach = ldSnapW(0.21 * s);
  float x = p.x - c;
  float q = abs(x);
  if (v < 0.0 || q > reach + ldCw || v > ldSnapH(0.33 * s)) {
    return vec4(0.0);
  }
  float row = floor(v / ldPx);
  float hw = ldSnapW(0.023 * s);
  float t = abs(q - span);
  float tu = floor(t / ldCw);
  float body = ldSnapH(0.24 * s);
  float peak = ldSnapH(0.31 * s);
  vec3 stone = vec3(0.92, 0.86, 0.72);
  // The two towers.
  if (t <= hw) {
    if (v < body) {
      cover = 1.0;
      if (tu >= ldCount(hw) - 1.0 || row >= ldRows(body) - 1.0) {
        return vec4(stone, ldLine(0.84, 0.55));
      }
      float band = mod(row, 7.0);
      if (mod(tu, 2.0) > 0.5 && band > 2.0 && band < 6.0) {
        return vec4(LD_WINDOW * 0.9, ldLine(0.0, 0.2));
      }
      return vec4(stone * 0.9, ldLine(0.68, 0.4));
    }
    // A steep roof up the middle, with a turret spike at each corner.
    float roofT = (v - body) / (peak - body);
    float rhw = ldSnapW(mix(0.015 * s, 0.0, roofT));
    if (t <= rhw || (t < ldCw && v < peak + ldSnapH(0.012))) {
      cover = 1.0;
      return vec4(stone * 0.85, ldLine(0.72, 0.45));
    }
    if (tu >= ldCount(hw) - 1.0 && v < body + ldSnapH(0.04 * s)) {
      cover = 1.0;
      return vec4(stone, ldLine(0.8, 0.5));
    }
    return vec4(0.0);
  }
  // The high walkways between the towers, lit blue.
  float walk = ldSnapH(0.19 * s);
  float walkTop = walk + ldSnapH(0.025 * s);
  if (q < span - hw && v >= walk && v < walkTop) {
    float wr = row - ldRows(walk);
    float wrows = ldRows(walkTop) - ldRows(walk);
    if (wr < 1.0 || wr >= wrows - 1.0) {
      cover = 1.0;
      return vec4(LD_STEEL, ldLine(0.84, 0.55));
    }
    if (mod(floor(q / ldCw), 3.0) < 1.0) {
      cover = 1.0;
      return vec4(LD_STEEL * 0.85, ldLine(0.62, 0.32));
    }
    return vec4(0.0);
  }
  // The road deck, with car lights crossing slowly.
  float deck = ldSnapH(0.05 * s);
  if (row == ldRows(deck) || row == ldRows(deck) - 1.0) {
    cover = 1.0;
    float car = fract((p.x - ldTime * 0.01 * (row == ldRows(deck) ? 1.0 : -1.0)) / 0.09);
    if (car < ldCw / 0.09 && row == ldRows(deck)) {
      return vec4(1.0, 0.9, 0.7, ldLine(0.9, 0.8));
    }
    if (car < ldCw / 0.09) {
      return vec4(1.0, 0.25, 0.18, ldLine(0.8, 0.6));
    }
    return vec4(LD_STEEL * 0.8, ldLine(0.6, 0.3));
  }
  // The side spans: the chains leave each tower high and sweep down to a
  // small tower on the bank, with hangers down to the deck.
  if (q > span + hw && q <= reach) {
    float k = (q - span - hw) / (reach - span - hw);
    float hi = ldSnapH(0.18 * s);
    float chainRow = (deck + (hi - deck) * (1.0 - k) * (1.0 - k)) / ldPx;
    float slope = 2.0 * (hi - deck) * (1.0 - k) / (reach - span - hw) * ldCw / ldPx;
    if (abs(row + 0.5 - chainRow) < 0.5 * sqrt(1.0 + slope * slope) + 0.1) {
      cover = 1.0;
      return vec4(LD_STEEL, ldLine(0.86, 0.6));
    }
    if (row < chainRow && row > ldRows(deck) && mod(floor(q / ldCw), 4.0) < 1.0) {
      cover = 1.0;
      return vec4(LD_STEEL * 0.7, ldLine(0.56, 0.25));
    }
    float abut = reach - ldSnapW(0.012 * s);
    if (q > abut && v < ldSnapH(0.085 * s)) {
      cover = 1.0;
      return vec4(stone * 0.85, ldLine(0.66, 0.4));
    }
  }
  return vec4(0.0);
}

// The Shard in the distance: a slim glass spike, a few lit floors and a
// red light on its needle.
vec4 ldShard(vec2 p, out float cover) {
  cover = 0.0;
  float c = ldSnapX(ldShX);
  float x = p.x - c;
  float q = abs(x);
  float v = p.y - ldShore;
  float tip = ldSnapH(0.56 * ldTbS);
  if (v < 0.0 || v > tip || q > ldSnapW(0.04)) {
    return vec4(0.0);
  }
  float t = v / tip;
  float hw = ldSnapW(mix(0.036 * ldTbS, 0.0, t));
  float u = floor(q / ldCw);
  float row = floor(v / ldPx);
  if (q > hw && !(q < ldCw && t > 0.92)) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (v > tip - ldSnapH(ldPx * 1.5)) {
    return ldRed(ldBeacon(0.45));
  }
  vec3 glass = vec3(0.46, 0.55, 0.78);
  if (u >= ldCount(hw) - 1.0) {
    return vec4(glass, ldLine(0.62, 0.36));
  }
  float lit = ldLit(53.0, u + (x < 0.0 ? 0.0 : 30.0), floor(row / 2.0), 0.3);
  if (mod(row, 2.0) < 1.0 && lit > 0.5) {
    return vec4(vec3(0.78, 0.86, 1.0), ldLine(0.72, 0.55));
  }
  return vec4(glass * 0.7, ldLine(0.0, 0.1));
}

// The low city behind: dim blocks with a few lit windows.
vec4 ldBack(vec2 p, out float cover) {
  cover = 0.0;
  float col = floor(p.x / ldCw);
  float row = floor((p.y - ldShore) / ldPx);
  float w = max(5.0, ldCount(0.05));
  float k = floor(col / w);
  float r = hash21(vec2(mod(k, 97.0), 3.7));
  float top = ldRows(0.035 + 0.075 * r);
  float u = col - k * w;
  if (row < 0.0 || row >= top || u > w - 1.0 - step(0.5, hash21(vec2(mod(k, 97.0), 8.1)))) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (row == top - 1.0) {
    return vec4(0.3, 0.33, 0.5, ldLine(0.52, 0.22));
  }
  float lit = ldLit(k + 61.0, u, floor(row / 2.0), 0.35);
  if (u > 0.5 && mod(u, 2.0) < 1.0 && mod(row, 2.0) < 1.0 && lit > 0.5) {
    return vec4(LD_WINDOW * 0.7, ldLine(0.62, 0.5));
  }
  return vec4(0.16, 0.18, 0.3, ldLine(0.0, 0.08));
}

// Lamp standards along the embankment wall: an iron post and an amber head.
float ldLampGap() {
  return max(7.0, ldCount(0.055));
}

vec4 ldLamps(vec2 p, out float cover) {
  cover = 0.0;
  float row = floor((p.y - ldShore) / ldPx);
  float col = floor(p.x / ldCw);
  if (row < 0.0 || row > 3.0) {
    return vec4(0.0);
  }
  if (row < 1.0) {
    cover = 1.0;
    return vec4(0.5, 0.46, 0.5, ldLine(0.56, 0.3));
  }
  if (mod(col, ldLampGap()) < 1.0) {
    cover = 1.0;
    if (row > 2.5) {
      return vec4(LD_AMBER, ldLine(0.96, 0.9));
    }
    return vec4(0.36, 0.32, 0.36, ldLine(0.52, 0.25));
  }
  return vec4(0.0);
}

// Everything on the far bank, near to far. Also read by the river for its
// reflections, so it never touches the sky.
vec4 ldCity(vec2 p, out float cover) {
  cover = 0.0;
  if (p.y < ldShore) {
    return vec4(0.0);
  }
  vec4 hit = ldLamps(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = ldBigBen(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = ldPalace(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = ldBridge(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = ldShard(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  return ldBack(p, cover);
}

// A faint, still haze on the water and the bank: a sparse ordered stipple
// that thins with height. It only fills empty samples, so it never crosses
// a building.
vec4 ldHaze(vec2 p) {
  float h = abs(p.y - ldShore);
  float reach = 0.07;
  if (h > reach) {
    return vec4(0.0);
  }
  vec2 s = mod(floor(p / vec2(ldCw, ldPx)), 4.0);
  // A 4 by 4 Bayer rank, from 0 to 15.
  float bx = mod(s.x, 2.0);
  float by = mod(s.y, 2.0);
  float rank = 8.0 * mod(bx + by, 2.0) + 4.0 * by + 2.0 * mod(floor(s.x / 2.0) + floor(s.y / 2.0), 2.0) + floor(s.y / 2.0);
  float density = ldFog * 0.16 * (1.0 - h / reach);
  if ((rank + 0.5) / 16.0 < density) {
    return vec4(0.3, 0.33, 0.42, ldLine(0.52, 0.08));
  }
  return vec4(0.0);
}

// A sparse field of faint stars, each one sample in a block of five by
// five, brightening and fading slowly.
vec4 ldSky(vec2 p) {
  vec2 s = floor(p / vec2(ldCw, ldPx));
  vec2 block = floor(s / 5.0);
  float pick = hash21(mod(block, 97.0) + 41.3);
  vec2 spot = floor(vec2(hash21(mod(block, 89.0) + 2.9), hash21(mod(block, 83.0) + 7.1)) * 5.0);
  if (pick > 0.95 && s == block * 5.0 + spot && p.y - ldShore > 0.36) {
    float twinkle = 0.7 + 0.3 * sin(ldTime * (0.35 + pick * 0.4) + pick * 60.0);
    return vec4(vec3(0.8, 0.84, 1.0) * twinkle, ldLine(0.58, 0.18 + 0.1 * twinkle));
  }
  return ldHaze(p);
}

// A river cruiser heading slowly upstream: a dark hull, a pale rail and a
// row of lit cabin windows.
vec4 ldBoat(vec2 p, float aspect, out float cover) {
  cover = 0.0;
  float len = ldSnapW(0.12);
  float travel = aspect + 0.4;
  float x0 = ldSnapX(mod(ldTime * 0.008 + aspect * 0.55, travel) - 0.2);
  float u = floor((p.x - x0) / ldCw);
  float cols = len / ldCw;
  float y = floor((p.y - ldShore * 0.45) / ldPx);
  if (u < 0.0 || u >= cols || y < 0.0 || y > 3.0) {
    return vec4(0.0);
  }
  if (u < 2.0 - y || u >= cols - 1.0 + min(0.0, 1.0 - y)) {
    return vec4(0.0);
  }
  if (y < 1.0) {
    cover = 1.0;
    return vec4(vec3(0.42, 0.46, 0.66), ldLine(0.55, 0.3));
  }
  if (y < 2.0) {
    cover = 1.0;
    return vec4(vec3(0.72, 0.74, 0.86), ldLine(0.58, 0.4));
  }
  if (u < 3.0 || u >= cols - 3.0) {
    return vec4(0.0);
  }
  cover = 1.0;
  return mod(u, 2.0) < 1.0 ? vec4(LD_WINDOW, ldLine(0.85, 0.8)) : vec4(LD_WINDOW * 0.5, ldLine(0.0, 0.15));
}

// The Thames: the city mirrored in calm water and broken into horizontal
// streaks that come and go slowly, with long amber streaks under the lamps.
vec4 ldWater(vec2 p) {
  float row = floor((ldShore - p.y) / ldPx);
  float col = floor(p.x / ldCw);
  float depth = row * ldPx;
  float fade = 1.0 - smoothstep(0.0, ldShore * 0.95, depth);
  float rowKey = mod(row, 97.0);
  float clock = hash21(vec2(rowKey, 4.1));
  float epoch = floor(ldTime / (6.0 + 8.0 * clock) + clock * 11.0);
  float keep = hash21(vec2(rowKey * 0.37 + mod(epoch, 29.0) * 0.17, 8.3));
  // The lamps' streaks run deeper than the rest of the mirror.
  if (mod(col, ldLampGap()) < 1.0 && depth < 0.11 && keep > 0.3) {
    return vec4(LD_AMBER * mix(0.5, 0.85, fade), ldLine(0.6 + 0.2 * fade, 0.3 + 0.35 * fade));
  }
  if (keep < 0.55 + 0.35 * (1.0 - fade)) {
    return ldHaze(p);
  }
  float slide = floor((hash21(vec2(rowKey, mod(epoch, 31.0) * 0.21 + 1.7)) - 0.5) * (1.0 + depth * 10.0) + 0.5);
  // Mirror row r below the shore onto row r above it, at its centre.
  vec2 rp = vec2((col + slide + 0.5) * ldCw, ldShore + depth + ldPx * 0.5);
  float rc;
  vec4 city = ldCity(rp, rc);
  if (rc * step(0.83, city.a) < 0.5) {
    return ldHaze(p);
  }
  return vec4(city.rgb * mix(0.3, 0.55, fade), ldLine(0.52 + 0.2 * fade, 0.16 + 0.28 * fade));
}

// Every layer at one sample, near to far.
vec4 ldLayers(vec2 p, float aspect) {
  float cover = 0.0;
  if (ldBoatOn > 0.5) {
    vec4 boat = ldBoat(p, aspect, cover);
    if (cover > 0.5) {
      return boat;
    }
  }
  if (p.y < ldShore) {
    return ldWater(p);
  }
  vec4 hit = ldCity(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  return ldSky(p);
}

vec2 ldCacheUv = vec2(-1.0);
float ldCacheT = -1.0;
vec4 ldCacheValue = vec4(0.0);

vec4 ldScene(vec2 uv, vec2 res, float t) {
  if (uv == ldCacheUv && t == ldCacheT) {
    return ldCacheValue;
  }
  float aspect = res.x / res.y;
  ldPx = 1.0 / res.y;
  // One sample column in the same units, from the engine's sample grid.
  ldCw = aspect / ascii_samples.x;
  ldTime = t;
  ldMulti = step(1.5, ldGrid.x * ldGrid.y);
  ldShore = floor(0.26 / ldPx) * ldPx;
  // Parliament runs from the left to the Elizabeth Tower right of centre;
  // Tower Bridge and the Shard fill the right, smaller in narrow boxes.
  ldTbS = clamp(aspect / 1.3, 0.72, 1.0);
  ldEtX = aspect * mix(0.42, 0.5, smoothstep(0.8, 1.3, aspect));
  ldPalL = max(0.06, ldEtX - 0.75);
  ldPalR = ldEtX - 0.045;
  ldTbX = min(aspect * 0.8, aspect - 0.21 * ldTbS - 0.02);
  ldShX = min(ldTbX + 0.21 * ldTbS, aspect - 0.03);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec4 hit = ldLayers(p, aspect);
  // A cell averages the colour of all its samples, lit or not, so an empty
  // sample borrows the colour of a lit neighbour in the same cell. Edges
  // and stars then keep their colour instead of fading toward the paper.
  if (ldMulti > 0.5 && hit.a <= 0.5) {
    float col = floor(p.x / ldCw);
    float rowTop = floor((1.0 - uv.y) * res.y);
    vec4 side = ldLayers(p + vec2((mod(col, 2.0) < 1.0 ? 1.0 : -1.0) * ldCw, 0.0), aspect);
    if (side.a > 0.5) {
      hit.rgb = side.rgb;
    } else {
      vec4 below = ldLayers(p + vec2(0.0, (mod(rowTop, 2.0) < 1.0 ? -1.0 : 1.0) * ldPx), aspect);
      if (below.a > 0.5) {
        hit.rgb = below.rgb;
      }
    }
  }
  // Intensity dims colour linearly. Ramp charsets also thin their glyphs
  // by the square root of it. Braille and quadrants only have dots on or
  // off, so scaling tone would cut the outlines first: they keep every dot
  // above a cut that rises as intensity falls, and drop the rest.
  float tone = hit.a < 0.04 ? 0.0 : clamp(hit.a, 0.0, 1.0);
  if (ldMulti > 0.5) {
    float cut = 0.5 + 0.48 * (1.0 - ldIntensity) * (1.0 - ldIntensity);
    tone = tone > cut && ldIntensity > 0.01 ? mix(0.51, tone, ldIntensity) : min(tone, 0.5) * ldIntensity;
  } else {
    tone *= sqrt(ldIntensity);
  }
  ldCacheUv = uv;
  ldCacheT = t;
  ldCacheValue = vec4(hit.rgb * mix(0.2, 1.0, ldIntensity), tone);
  return ldCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return ldScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return ldScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night sky behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#060913";
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
        "linear-gradient(to bottom, #060913 0%, #0b1020 72%, #060913 74%, #060913 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface LondonProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** How much still haze lies on the water and the bank, from 0 (none) to 1. Default 0.5. */
  fog?: number;
  /** The river boat heading upstream. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Westminster at night from across the Thames. The Elizabeth Tower's dial
 * glows beside the floodlit Palace of Westminster, Tower Bridge and the
 * Shard stand further down the river, and the embankment lamps drop amber
 * streaks into the water while a boat passes slowly. Nothing reacts to
 * the pointer. Decorative and full-bleed: size it with `className`,
 * usually `absolute inset-0`.
 */
export const London = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 30,
  intensity = 1,
  fog = 0.5,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: LondonProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gridX, gridY] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      {...props}
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        ldBoatOn: boat ? 1 : 0,
        ldFog: clamp(fog, 0, 1),
        ldGrid: [gridX, gridY],
        ldIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
    />
  );
};
