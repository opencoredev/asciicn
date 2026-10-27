"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Manhattan at night from Brooklyn, across the river. The view is one
// function of p = (x in box heights, y up) with the shore at nyShore. Every
// shape is measured in whole samples (`nyCw` wide, `nyPx` tall) and tested
// at sample centres, so edges land on the sample grid and window grids stay
// rectilinear at any size. Layers are tested near to far and the first one
// that covers a sample wins: the ferry, the river, the low front row, the
// three landmarks (One World Trade Center, the Empire State Building, the
// Chrysler Building), the skyline behind them, then the sky. `nyScene`
// returns colour and tone, cached per sample so the field and colour
// passes share one evaluation.
//
// Cells that hold several samples (Braille, quadrants) light a dot only
// above tone 0.5 and average the colour of all their samples, so `nyMulti`
// switches facades to zero tone that carries the nearest window's colour,
// and keeps structure above 0.5. Ramp charsets get a faint body tone instead,
// so silhouettes read as solid shapes.
const SCENE = `
const float NY_PI = 3.14159265;

// Set once per sample by nyScene, read by every layer.
float nyPx = 0.0;
float nyCw = 0.0;
float nyTime = 0.0;
float nyShore = 0.0;
float nyMulti = 0.0;
float nyWtcX = 0.0;
float nyEsX = 0.0;
float nyChX = 0.0;

// Sizes rounded to whole samples, never below one. They divide back into
// whole samples only up to float rounding, so edge tests round the count
// again instead of trusting the division.
float nySnapW(float w) {
  return max(1.0, floor(w / nyCw + 0.5)) * nyCw;
}

float nySnapH(float h) {
  return max(1.0, floor(h / nyPx + 0.5)) * nyPx;
}

// A centre line on a boundary between two sample columns, so shapes around
// it come out symmetric.
float nySnapX(float x) {
  return floor(x / nyCw + 0.5) * nyCw;
}

// Structure tone: above the dot threshold in Braille and quadrants, a
// mid glyph in ramp charsets.
float nyLine(float multi, float ramp) {
  return mix(ramp, multi, nyMulti);
}

// Window light: mostly warm incandescent, some paler, a few cool office tubes.
vec3 nyTint(float h) {
  if (h < 0.55) {
    return vec3(1.0, 0.72, 0.38);
  }
  if (h < 0.83) {
    return vec3(1.0, 0.88, 0.64);
  }
  return vec3(0.7, 0.84, 1.0);
}

// Whether a window is lit. Most hold their state; about one in fourteen
// re-rolls on its own clock of 25 to 60 seconds, so only a few change at a
// time. Hash inputs stay small: hash21 loses its spread on large floats.
float nyLit(float id, float gx, float gy, float share) {
  float key = mod(id, 113.0);
  vec2 cell = vec2(key * 1.37 + mod(gx, 89.0) * 0.61, mod(gy, 97.0) * 0.73 + 3.1);
  float clock = hash21(cell + 17.3);
  float roll = 0.0;
  if (clock < 0.07) {
    float epoch = floor(nyTime / (25.0 + 500.0 * clock) + clock * 97.0);
    roll = mod(epoch, 37.0) * 0.371;
  }
  return step(hash21(cell + vec2(roll, roll * 0.7)), share);
}

// A slow red aviation light: one soft pulse every 1.8 seconds.
float nyBeacon(float phase) {
  float f = fract(nyTime / 1.8 + phase);
  return smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.25, 0.6, f));
}

// A facade grid inside a box. u counts samples from the left wall, d
// samples down from the roof, cols is the box's width in samples. Windows
// sit on every other row with a one sample margin, on every other column
// where cells hold several samples and on every column where a sample is a
// whole glyph.
vec4 nyFacade(float u, float d, float cols, float id, float share, float dim, vec3 body) {
  float tint = hash21(vec2(mod(id, 113.0) * 0.77, floor(d / 8.0) * 0.31 + floor(u / 6.0) * 0.53));
  vec3 lightCol = nyTint(tint) * dim;
  float bodyTone = nyLine(0.0, 0.12 * dim);
  if (u < 1.0 || u > cols - 2.0 || d < 1.0) {
    return vec4(body, bodyTone);
  }
  float gx = u - 1.0;
  float gy = d - 1.0;
  float period = 1.0 + nyMulti;
  float lit = nyLit(id, floor(gx / period), floor(gy / 2.0), share);
  bool pane = mod(gy, 2.0) < 1.0 && mod(gx, period) < 1.0;
  if (pane && lit > 0.5) {
    float glow = 0.78 + 0.17 * hash21(vec2(mod(gx, 61.0) * 0.3 + mod(id, 113.0), mod(gy, 59.0) * 0.5));
    return vec4(lightCol, glow * mix(0.82, 1.0, dim));
  }
  // Between panes: in multi-sample cells, carry the window's colour so the
  // cell average stays its tint.
  vec3 halo = lit > 0.5 ? lightCol : body;
  return vec4(mix(body, halo, nyMulti), bodyTone);
}

// Generic towers: slots whose walls are jittered, so widths vary, with a
// sample of gap between some neighbours. Returns the slot id and the
// tower's left and right walls in sample columns.
float nySlot(float col, float width, float seed, out float left, out float right) {
  float k = floor(col / width);
  float a = (k + 0.36 * (hash21(vec2(mod(k, 97.0), seed)) - 0.5)) * width;
  float b = (k + 1.0 + 0.36 * (hash21(vec2(mod(k + 1.0, 97.0), seed)) - 0.5)) * width;
  if (col < floor(a)) {
    k -= 1.0;
    b = a;
    a = (k + 0.36 * (hash21(vec2(mod(k, 97.0), seed)) - 0.5)) * width;
  } else if (col >= floor(b)) {
    k += 1.0;
    a = b;
    b = (k + 1.0 + 0.36 * (hash21(vec2(mod(k + 1.0, 97.0), seed)) - 0.5)) * width;
  }
  left = floor(a);
  right = floor(b) - step(0.5, hash21(vec2(mod(k, 97.0), seed + 2.0)));
  return k;
}

// How tall the skyline stands at x: the Financial District bunches up
// around One World Trade Center, the Village dips low, Midtown rises
// around the Empire State and Chrysler buildings and falls off past them.
// Towers right by the Chrysler crown stay low so its arches stand clear.
float nyEnvelope(float x) {
  float downtown = 0.25 * exp(-pow((x - nyWtcX) / 0.15, 2.0));
  float mid = (nyEsX + nyChX) * 0.5;
  float midtown = 0.25 * exp(-pow((x - mid) / 0.3, 2.0));
  float h = 0.06 + max(downtown, midtown);
  float clear = 1.0 - exp(-pow((x - nyChX) / 0.07, 2.0));
  return mix(0.17, h, clear);
}

// One row of generic towers. far dims the back row.
vec4 nyRow(vec2 p, float width, float seed, float low, float high, float far, out float cover) {
  cover = 0.0;
  float col = floor(p.x / nyCw);
  float row = floor((p.y - nyShore) / nyPx);
  float left;
  float right;
  float k = nySlot(col, width / nyCw, seed, left, right);
  if (col >= right) {
    return vec4(0.0);
  }
  float r = hash21(vec2(mod(k, 97.0), seed + 0.5));
  float centre = (left + right) * 0.5 * nyCw;
  float env = high > 0.0 ? nyEnvelope(centre) : 0.0;
  float h = high > 0.0 ? env * (0.45 + 0.55 * r) : low * (0.4 + 0.6 * r);
  float top = floor(h / nyPx + 0.5);
  float cols = right - left;
  float u = col - left;
  float id = k + seed * 13.0;
  // Some towers step in near the top.
  float style = hash21(vec2(mod(k, 97.0), seed + 3.3));
  float inset = style > 0.6 && cols > 9.0 ? floor(cols * 0.18) : 0.0;
  float shoulder = top - floor((top * 0.22));
  vec3 body = mix(vec3(0.15, 0.19, 0.38), vec3(0.12, 0.15, 0.32), far);
  vec3 rim = mix(vec3(0.34, 0.4, 0.68), vec3(0.27, 0.32, 0.58), far);
  float dim = mix(1.0, 0.78, far);
  float share = nyWindows * mix(1.0, 0.9, far);
  // A roof line would float over a dark tower where facades have no tone,
  // so the back row draws one only in ramp charsets.
  bool roofLine = far < 0.5 || nyMulti < 0.5;
  if (row < 0.0) {
    return vec4(0.0);
  }
  if (row < top) {
    if (inset > 0.0 && row >= shoulder && (u < inset || u >= cols - inset)) {
      // Above the setback: open sky beside the narrower top.
      if (row == shoulder && roofLine) {
        cover = 1.0;
        return vec4(rim, nyLine(0.56, 0.32) * dim);
      }
      return vec4(0.0);
    }
    cover = 1.0;
    if (row == top - 1.0 && roofLine) {
      return vec4(rim, nyLine(0.56, 0.32) * dim);
    }
    float uu = inset > 0.0 && row >= shoulder ? u - inset : u;
    float cc = inset > 0.0 && row >= shoulder ? cols - 2.0 * inset : cols;
    return nyFacade(uu, top - 1.0 - row, cc, id, share, dim, body);
  }
  // A mast with a red light on a few of the taller towers.
  if (high > 0.0 && style < 0.14 && h > 0.16 && abs(u - floor(cols * 0.5)) < 0.5) {
    float mast = floor(0.03 / nyPx);
    if (row < top + mast) {
      cover = 1.0;
      if (row >= top + mast - 1.0) {
        float b = nyBeacon(r);
        return vec4(mix(vec3(0.5, 0.12, 0.1), vec3(1.0, 0.2, 0.14), b), nyLine(0.55 + 0.4 * b, 0.25 + 0.6 * b));
      }
      return vec4(rim, nyLine(0.52, 0.22) * dim);
    }
  }
  return vec4(0.0);
}

// One World Trade Center, seen from the southeast: a square podium, then
// the tapering shaft whose chamfered corners make a tall V of glass down
// the middle, a lit parapet, and the spire with its beacon.
vec4 nyWtc(vec2 p, out float cover) {
  cover = 0.0;
  float c = nySnapX(nyWtcX);
  float x = p.x - c;
  float q = abs(x);
  float v = p.y - nyShore;
  float podium = nySnapH(0.075);
  float roof = nySnapH(0.555);
  float parapet = roof + nySnapH(0.012);
  float collar = parapet + nySnapH(0.01);
  float tip = nySnapH(0.72);
  float base = nySnapW(0.048);
  float crown = nySnapW(0.028);
  if (v < 0.0 || v > tip || q > base + nyCw) {
    return vec4(0.0);
  }
  vec3 glass = vec3(0.56, 0.7, 1.0);
  vec3 pale = vec3(0.86, 0.92, 1.0);
  float row = floor(v / nyPx);
  if (v < podium) {
    if (q > base) {
      return vec4(0.0);
    }
    cover = 1.0;
    // The podium's glass fins, one every other column.
    float fin = mod(floor(q / nyCw), 2.0);
    return vec4(glass * 0.8, fin > 0.5 ? nyLine(0.52, 0.3) : nyLine(0.0, 0.1));
  }
  if (v < roof) {
    float t = (v - podium) / (roof - podium);
    float hw = nySnapW(mix(base, crown, t));
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    float u = floor(q / nyCw);
    float edge = floor(hw / nyCw + 0.5) - 1.0;
    if (u >= edge) {
      return vec4(pale, nyLine(0.66, 0.42));
    }
    // The middle facet: an inverted triangle from a point at the podium
    // to the full width under the parapet, edged by the two crease lines.
    float face = floor(crown / nyCw * t + 0.5);
    if (abs(u - face) < 0.5) {
      return vec4(pale, nyLine(0.8, 0.55));
    }
    if (u < face) {
      float lit = nyLit(31.0, u + (x < 0.0 ? 0.0 : 40.0), floor(row / 2.0), nyWindows * 0.7);
      bool pane = mod(row, 2.0) < 1.0 && mod(u, 2.0) > 0.5;
      if (pane && lit > 0.5) {
        return vec4(vec3(0.82, 0.9, 1.0), 0.86);
      }
      return vec4(glass, nyLine(0.0, 0.2));
    }
    float lit = nyLit(37.0, u + (x < 0.0 ? 0.0 : 40.0), floor(row / 2.0), nyWindows * 0.8);
    bool pane = mod(row, 2.0) < 1.0 && mod(u, 2.0) > 0.5;
    if (pane && lit > 0.5) {
      return vec4(nyTint(hash21(vec2(u, floor(row / 8.0)))), 0.84);
    }
    return vec4(mix(glass * 0.55, nyTint(0.9) * 0.8, nyMulti * lit), nyLine(0.0, 0.12));
  }
  if (v < parapet) {
    if (q > crown) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(pale, nyLine(0.92, 0.8));
  }
  if (v < collar) {
    if (q > nySnapW(0.009)) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(pale, nyLine(0.75, 0.55));
  }
  if (q > nyCw) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (v > tip - nySnapH(nyPx * 1.5)) {
    float b = nyBeacon(0.3);
    return vec4(mix(vec3(0.6, 0.14, 0.12), vec3(1.0, 0.22, 0.16), b), nyLine(0.55 + 0.4 * b, 0.3 + 0.6 * b));
  }
  return vec4(pale, nyLine(0.72, 0.45));
}

// The Empire State Building: the long shaft with its vertical piers, the
// setbacks at the 72nd, 81st and 85th floors, the observation deck, the
// floodlit tiers of the mooring mast and the antenna with its red light.
vec4 nyEmpire(vec2 p, out float cover) {
  cover = 0.0;
  float c = nySnapX(nyEsX);
  float x = p.x - c;
  float q = abs(x);
  float v = p.y - nyShore;
  float tip = nySnapH(0.6);
  if (v < 0.0 || v > tip || q > nySnapW(0.05)) {
    return vec4(0.0);
  }
  float shaft = nySnapH(0.355);
  float s81 = nySnapH(0.395);
  float s85 = nySnapH(0.418);
  float deck = nySnapH(0.43);
  float t1 = nySnapH(0.455);
  float t2 = nySnapH(0.477);
  float t3 = nySnapH(0.497);
  float mast = nySnapH(0.512);
  float hw;
  // tier: 0 shaft, 1 and 2 the setbacks, 3 the deck, 4 the mast.
  float tier;
  if (v < shaft) {
    hw = nySnapW(0.044);
    tier = 0.0;
  } else if (v < s81) {
    hw = nySnapW(0.033);
    tier = 1.0;
  } else if (v < s85) {
    hw = nySnapW(0.024);
    tier = 2.0;
  } else if (v < deck) {
    hw = nySnapW(0.02);
    tier = 3.0;
  } else if (v < t1) {
    hw = nySnapW(0.013);
    tier = 4.0;
  } else if (v < t2) {
    hw = nySnapW(0.011);
    tier = 4.0;
  } else if (v < t3) {
    hw = nySnapW(0.009);
    tier = 4.0;
  } else if (v < mast) {
    hw = nySnapW(0.006);
    tier = 4.0;
  } else {
    hw = nyCw;
    tier = 5.0;
  }
  if (q > hw) {
    return vec4(0.0);
  }
  cover = 1.0;
  float u = floor(q / nyCw);
  float row = floor(v / nyPx);
  bool rim = u >= floor(hw / nyCw + 0.5) - 1.0;
  if (tier > 4.5) {
    if (v > tip - nySnapH(nyPx * 1.5)) {
      float b = nyBeacon(0.0);
      return vec4(mix(vec3(0.6, 0.14, 0.12), vec3(1.0, 0.22, 0.16), b), nyLine(0.55 + 0.4 * b, 0.3 + 0.6 * b));
    }
    return vec4(0.84, 0.86, 1.0, nyLine(0.66, 0.4));
  }
  // The floodlit crown: gold on the lower tiers, near white at the top,
  // with a bright ledge at each setback.
  float rise = smoothstep(shaft - 0.05, mast, v);
  vec3 lit = mix(vec3(1.0, 0.7, 0.32), vec3(1.0, 0.96, 0.86), rise);
  if (tier > 0.5) {
    bool ledge = row == floor(shaft / nyPx + 0.5) || row == floor(s81 / nyPx + 0.5) || row == floor(s85 / nyPx + 0.5) || row == floor(deck / nyPx + 0.5) || row == floor(t1 / nyPx + 0.5) || row == floor(t2 / nyPx + 0.5) || row == floor(t3 / nyPx + 0.5);
    if (ledge || rim) {
      return vec4(lit, nyLine(0.95, 0.85));
    }
    // Vertical piers catch the light; the recesses between them glow less.
    if (mod(u, 2.0) < 1.0) {
      return vec4(lit, nyLine(0.84, 0.66));
    }
    return vec4(lit * 0.85, nyLine(0.6, 0.42));
  }
  // The shaft: piers on every other column, windows between them. The top
  // floors catch the floodlights.
  float wash = smoothstep(shaft - 0.08, shaft, v);
  vec3 stone = mix(vec3(0.4, 0.45, 0.7), vec3(1.0, 0.74, 0.42), wash);
  if (rim) {
    return vec4(stone, nyLine(0.68, 0.45 + 0.2 * wash));
  }
  if (mod(u, 2.0) > 0.5) {
    return vec4(stone, nyLine(0.54 + 0.2 * wash, 0.26 + 0.3 * wash));
  }
  float on = nyLit(77.0, u + (x < 0.0 ? 0.0 : 50.0), floor(row / 2.0), nyWindows * 0.75);
  if (mod(row, 2.0) < 1.0 && on > 0.5) {
    return vec4(nyTint(hash21(vec2(u * 0.7, floor(row / 6.0)))), 0.86);
  }
  return vec4(mix(stone, nyTint(0.3), nyMulti * on), nyLine(0.0, 0.1 + 0.2 * wash));
}

// The Chrysler Building: setbacks at the base, a slim shaft with pale
// corner piers, the eagle ledge, then the crown of stacked arches with
// triangular windows between their lit rims, and the needle on top.
vec4 nyChrysler(vec2 p, out float cover) {
  cover = 0.0;
  float c = nySnapX(nyChX);
  float x = p.x - c;
  float q = abs(x);
  float v = p.y - nyShore;
  float tip = nySnapH(0.465);
  if (v < 0.0 || v > tip || q > nySnapW(0.054)) {
    return vec4(0.0);
  }
  float crownBase = nySnapH(0.3);
  float u = floor(q / nyCw);
  float row = floor(v / nyPx);
  vec3 steel = vec3(0.86, 0.9, 1.0);
  if (v < crownBase) {
    float hw = v < nySnapH(0.12) ? nySnapW(0.052) : v < nySnapH(0.17) ? nySnapW(0.043) : nySnapW(0.033);
    float ledge = crownBase - nySnapH(0.012);
    if (v >= ledge) {
      hw = nySnapW(0.039);
    }
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (v >= ledge) {
      return vec4(steel, nyLine(0.72, 0.5));
    }
    if (u >= floor(hw / nyCw + 0.5) - 1.0) {
      return vec4(vec3(0.78, 0.82, 0.98), nyLine(0.62, 0.4));
    }
    // Windows in vertical bands, two columns of panes then a pier.
    float band = mod(u, 3.0);
    if (band < 2.0 && mod(row, 2.0) < 1.0) {
      float on = nyLit(91.0, u + (x < 0.0 ? 0.0 : 30.0), floor(row / 2.0), nyWindows * 0.7);
      if (on > 0.5) {
        return vec4(nyTint(hash21(vec2(u, floor(row / 6.0)) + 0.3)), 0.84);
      }
    }
    return vec4(vec3(0.3, 0.35, 0.62), nyLine(0.0, 0.12));
  }
  // The crown: five arches, each narrower and higher than the one below,
  // so their lit rims step up like terraces. The highest arch that holds
  // the sample is the band it sits in.
  float band = -1.0;
  float rimDist = 0.0;
  float ang = 0.0;
  float crownTop = crownBase;
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float wk = nySnapW(0.038 - 0.0066 * fk);
    float yk = crownBase + nySnapH(0.019) * fk;
    float hk = wk * 1.05;
    crownTop = yk + hk;
    vec2 a = vec2(x / wk, (v - yk) / hk);
    float r = length(a);
    if (v >= yk && r < 1.0) {
      band = fk;
      rimDist = (1.0 - r) * min(wk / nyCw, hk / nyPx);
      ang = atan(a.x, a.y);
    }
  }
  if (band >= 0.0) {
    cover = 1.0;
    if (rimDist < 1.0) {
      return vec4(vec3(1.0, 0.98, 0.92), nyLine(0.96, 0.88));
    }
    // A dark course of steel under each lit rim keeps the arches apart.
    if (rimDist < 2.0) {
      return vec4(steel * 0.8, nyLine(0.0, 0.3));
    }
    // Triangular windows: a sunburst of wedges inside each arch.
    float seg = fract(ang / NY_PI * (6.0 - band) + 0.5);
    if (abs(seg - 0.5) < 0.3) {
      return vec4(vec3(1.0, 0.92, 0.72), nyLine(0.8, 0.62));
    }
    return vec4(steel * 0.8, nyLine(0.0, 0.3));
  }
  // The needle: two samples wide at its foot, then one.
  float spire = crownTop - nyPx * 2.0;
  float foot = q < (v < spire + nySnapH(0.025) ? nySnapW(0.0055) : nyCw) ? 1.0 : 0.0;
  if (v >= spire && foot > 0.5) {
    cover = 1.0;
    return vec4(steel, nyLine(0.74, 0.5));
  }
  return vec4(0.0);
}

// Everything on the Manhattan shore, near to far. Also read by the river
// for its reflections, so it never touches the sky.
vec4 nyCity(vec2 p, out float cover) {
  cover = 0.0;
  if (p.y < nyShore) {
    return vec4(0.0);
  }
  vec4 hit = nyRow(p, 0.075, 1.3, 0.12, 0.0, 0.0, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyWtc(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyChrysler(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyEmpire(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  return nyRow(p, 0.052, 7.9, 0.0, 1.0, 1.0, cover);
}

// A sparse field of stars, each one sample in a block of four by four,
// that brighten and fade slowly. Clear of the skyline glow near the shore.
vec4 nySky(vec2 p) {
  vec2 s = floor(p / vec2(nyCw, nyPx));
  vec2 block = floor(s / 4.0);
  float pick = hash21(mod(block, 97.0) + 23.7);
  vec2 spot = floor(vec2(hash21(mod(block, 89.0) + 5.1), hash21(mod(block, 83.0) + 9.4)) * 4.0);
  if (pick > 0.962 && s == block * 4.0 + spot && p.y - nyShore > 0.32) {
    float twinkle = 0.7 + 0.3 * sin(nyTime * (0.4 + pick * 0.5) + pick * 60.0);
    return vec4(vec3(0.82, 0.86, 1.0) * twinkle, nyLine(0.6, 0.2 + 0.12 * twinkle));
  }
  return vec4(0.0);
}

// A ferry crossing slowly right to left: a dark hull with a pale rail, a
// row of lit cabin windows and a wheelhouse.
vec4 nyFerry(vec2 p, float aspect, out float cover) {
  cover = 0.0;
  float len = nySnapW(0.11);
  float travel = aspect + 0.4;
  float x0 = nySnapX(aspect + 0.2 - mod(nyTime * 0.009 + aspect * 0.35, travel));
  float u = floor((p.x - x0) / nyCw);
  float cols = len / nyCw;
  float y = floor((p.y - nyShore * 0.42) / nyPx);
  if (u < 0.0 || u >= cols || y < 0.0 || y > 4.0) {
    return vec4(0.0);
  }
  // The bow rakes back one sample per row.
  if (u < 2.0 - y || u >= cols - 1.0 + min(0.0, 1.0 - y)) {
    return vec4(0.0);
  }
  if (y < 1.0) {
    cover = 1.0;
    return vec4(vec3(0.5, 0.56, 0.8), nyLine(0.55, 0.3));
  }
  if (y < 2.0) {
    cover = 1.0;
    return vec4(vec3(0.7, 0.75, 0.92), nyLine(0.58, 0.4));
  }
  if (y < 3.0) {
    if (u < 2.0 || u >= cols - 2.0) {
      return vec4(0.0);
    }
    cover = 1.0;
    float pane = mod(u, 2.0);
    return pane < 1.0 ? vec4(1.0, 0.82, 0.5, 0.85) : vec4(vec3(1.0, 0.82, 0.5) * mix(0.3, 1.0, nyMulti), nyLine(0.0, 0.15));
  }
  float house = floor(cols * 0.3);
  if (u >= house && u < house + 3.0) {
    cover = 1.0;
    return vec4(vec3(0.9, 0.93, 1.0), nyLine(0.62, 0.42));
  }
  return vec4(0.0);
}

// The river: the shore lamps along the promenade, then the city mirrored
// in calm water and broken into horizontal streaks that come and go slowly.
vec4 nyWater(vec2 p) {
  float row = floor((nyShore - p.y) / nyPx);
  float col = floor(p.x / nyCw);
  float lampGap = max(6.0, floor(0.04 / nyCw));
  if (row < 1.0) {
    if (mod(col, lampGap) < 1.0) {
      return vec4(1.0, 0.68, 0.3, nyLine(0.85, 0.7));
    }
    return vec4(vec3(0.3, 0.34, 0.58), nyLine(0.0, 0.14));
  }
  float depth = row * nyPx;
  float fade = 1.0 - smoothstep(0.0, nyShore * 0.95, depth);
  // Each row of the mirror holds or breaks on its own slow clock, and
  // slides a sample or two sideways, so the reflections shimmer gently.
  float rowKey = mod(row, 97.0);
  float clock = hash21(vec2(rowKey, 4.1));
  float epoch = floor(nyTime / (6.0 + 8.0 * clock) + clock * 11.0);
  float keep = hash21(vec2(rowKey * 0.37 + mod(epoch, 29.0) * 0.17, 8.3));
  if (keep < 0.45 + 0.4 * (1.0 - fade)) {
    return vec4(0.0);
  }
  float slide = floor((hash21(vec2(rowKey, mod(epoch, 31.0) * 0.21 + 1.7)) - 0.5) * (1.0 + depth * 10.0) + 0.5);
  // Mirror row r below the shore onto row r above it, at its centre.
  vec2 rp = vec2((col + slide + 0.5) * nyCw, nyShore + depth + nyPx * 0.5);
  if (row < 2.0) {
    // The lamps' own short streaks.
    if (mod(col, lampGap) < 1.0) {
      return vec4(1.0, 0.6, 0.26, nyLine(0.62, 0.45));
    }
  }
  float rc;
  vec4 city = nyCity(rp, rc);
  float bright = rc * step(0.76, city.a);
  if (bright < 0.5) {
    return vec4(0.0);
  }
  return vec4(city.rgb * mix(0.4, 0.68, fade), nyLine(0.52 + 0.2 * fade, 0.18 + 0.32 * fade));
}

// Every layer at one sample, near to far.
vec4 nyLayers(vec2 p, float aspect) {
  float cover = 0.0;
  if (nyFerryOn > 0.5) {
    vec4 boat = nyFerry(p, aspect, cover);
    if (cover > 0.5) {
      return boat;
    }
  }
  if (p.y < nyShore) {
    return nyWater(p);
  }
  vec4 hit = nyCity(p, cover);
  if (cover > 0.5) {
    return hit;
  }
  return nySky(p);
}

vec2 nyCacheUv = vec2(-1.0);
float nyCacheT = -1.0;
vec4 nyCacheValue = vec4(0.0);

vec4 nyScene(vec2 uv, vec2 res, float t) {
  if (uv == nyCacheUv && t == nyCacheT) {
    return nyCacheValue;
  }
  float aspect = res.x / res.y;
  nyPx = 1.0 / res.y;
  // One sample column in the same units, from the engine's sample grid.
  nyCw = aspect / ascii_samples.x;
  nyTime = t;
  nyMulti = step(1.5, nyGrid.x * nyGrid.y);
  nyShore = floor(0.25 / nyPx) * nyPx;
  // One World Trade Center holds the left; Midtown sits right of centre,
  // the Chrysler Building a fixed step right of the Empire State.
  nyWtcX = clamp(aspect * 0.15, 0.1, 0.42);
  nyEsX = aspect * 0.54;
  nyChX = min(nyEsX + 0.19, aspect - 0.07);
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec4 hit = nyLayers(p, aspect);
  // A cell averages the colour of all its samples, lit or not, so an empty
  // sample borrows the colour of a lit neighbour in the same cell. Edges
  // and stars then keep their colour instead of fading toward the paper.
  if (nyMulti > 0.5 && hit.a <= 0.5) {
    float col = floor(p.x / nyCw);
    float rowTop = floor((1.0 - uv.y) * res.y);
    vec4 side = nyLayers(p + vec2((mod(col, 2.0) < 1.0 ? 1.0 : -1.0) * nyCw, 0.0), aspect);
    if (side.a > 0.5) {
      hit.rgb = side.rgb;
    } else {
      vec4 below = nyLayers(p + vec2(0.0, (mod(rowTop, 2.0) < 1.0 ? -1.0 : 1.0) * nyPx), aspect);
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
  if (nyMulti > 0.5) {
    float cut = 0.5 + 0.48 * (1.0 - nyIntensity) * (1.0 - nyIntensity);
    tone = tone > cut && nyIntensity > 0.01 ? mix(0.51, tone, nyIntensity) : min(tone, 0.5) * nyIntensity;
  } else {
    tone *= sqrt(nyIntensity);
  }
  nyCacheUv = uv;
  nyCacheT = t;
  nyCacheValue = vec4(hit.rgb * mix(0.2, 1.0, nyIntensity), tone);
  return nyCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return nyScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return nyScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night sky behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#04081a";
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
        "linear-gradient(to bottom, #04081a 0%, #070d26 74%, #04081a 75%, #04081a 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface NewYorkProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Share of windows lit across the skyline, from 0 (dark) to 1. Default 0.55. */
  windows?: number;
  /** The ferry crossing the river. Default `true`. */
  ferry?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night navy in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
  /** Ignored: the skyline never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Manhattan at night from across the river. One World Trade Center stands
 * at the left, the Empire State Building and the Chrysler Building rise
 * over Midtown, windows change a few at a time, and the river mirrors the
 * lights while a ferry crosses slowly. Nothing reacts to the pointer.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const NewYork = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 30,
  intensity = 1,
  windows = 0.55,
  ferry = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: NewYorkProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gridX, gridY] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      {...props}
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        nyFerryOn: ferry ? 1 : 0,
        nyGrid: [gridX, gridY],
        nyIntensity: clamp(intensity, 0, 1),
        nyWindows: clamp(windows, 0, 1),
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
