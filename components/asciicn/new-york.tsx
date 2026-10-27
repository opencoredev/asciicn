"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The whole view is one function of p = (x in box heights, y up), seen from
// Brooklyn across the East River, with the Manhattan shore at NY_SHORE.
// Layers are tested near to far and the first one that covers a sample
// wins: the ferry, the Brooklyn Bridge, the river, then the city (the FDR
// Drive, a low row of blocks, the two landmarks and the dense skyline
// behind them) and the sky. Sizes that must survive coarse charsets are
// measured against `nyPx`, one sample row, and `nyCw`, about one column, so
// thin lines never vanish between samples. `nyScene` returns colour and
// tone, cached per sample so the field and colour passes share one
// evaluation.
const SCENE = `
const float NY_SHORE = 0.27;
const float NY_DECK = 0.2;
const float NY_CABLE = 0.47;
const float NY_PI = 3.14159265;

// Set once per sample by nyScene, read by every layer.
float nyPx = 0.0;
float nyCw = 0.0;
float nySx = 1.0;
float nyEsX = 0.0;
float nyChX = 0.0;
float nyTowerL = 0.0;
float nyTowerR = 0.0;
float nyPtr = 0.0;
float nyTime = 0.0;

// Window light: mostly warm incandescent, some paler, a few cool office tubes.
vec3 nyWindowColor(float h) {
  if (h < 0.62) {
    return vec3(1.0, 0.72, 0.36);
  }
  if (h < 0.88) {
    return vec3(1.0, 0.88, 0.62);
  }
  return vec3(0.72, 0.86, 1.0);
}

// Whether a window is lit. Each one flips on its own slow clock, so the
// skyline keeps changing without ever blinking. Hash inputs stay small:
// hash21 loses its spread on large floats.
float nyLit(float id, float gx, float gy, float share) {
  float key = mod(id, 89.0) * 1.37;
  float phase = hash21(vec2(key + gx * 0.61, gy * 0.73 + 3.0));
  float epoch = floor(nyTime / 19.0 + phase * 7.0);
  vec2 roll = vec2(fract(epoch * 0.137) * 40.0, mod(epoch, 41.0) * 1.9);
  return step(hash21(vec2(key + gx * 0.83, gy * 0.59) + roll), share);
}

// Moving car lights in one lane. dir is +1 or -1; returns 0 to 1.
float nyCars(float x, float lane, float dir, float speed) {
  float s = (x - dir * nyTime * speed) / 0.045;
  float id = floor(s + lane * 17.0);
  float f = fract(s);
  float present = step(0.45, hash21(vec2(mod(id, 97.0), lane)));
  return present * step(0.15, f) * step(f, 0.15 + max(nyCw / 0.045, 0.12));
}

// Two staggered grids of blocks, so widths vary. Returns a random 0 to 1
// that the caller turns into a roof height, plus the block's id, the
// sample's offset from its left wall and its width.
float nyBlocks(float x, float w1, float w2, float seed, out float id, out float u, out float w) {
  float a = floor(x / w1);
  float shifted = x + w2 * 0.37;
  float b = floor(shifted / w2);
  float ha = hash21(vec2(a, seed));
  float hb = hash21(vec2(b, seed + 5.0));
  if (ha >= hb) {
    id = a;
    u = x - a * w1;
    w = w1;
    return ha;
  }
  id = b + 0.5;
  u = shifted - b * w2;
  w = w2;
  return hb;
}

// A facade at v (height above the shore) under a roof at top. far dims it
// for the back row. Each sample row is a floor with windows on every other
// column; some towers have ribbon windows lit a whole floor at a time.
vec4 nyFacade(float u, float w, float v, float top, float id, float far) {
  float body = mix(0.09, 0.065, far);
  vec3 bodyCol = mix(vec3(0.26, 0.33, 0.66), vec3(0.2, 0.26, 0.58), far);
  float down = top - v;
  if (down < max(nyPx * 0.6, 0.002)) {
    return vec4(bodyCol, body + 0.08);
  }
  float gx = floor(u / nyCw);
  float gy = floor(down / nyPx);
  float cols = floor(w / nyCw);
  if (gx < 1.0 || gx > cols - 2.0) {
    return vec4(bodyCol, body);
  }
  float style = hash21(vec2(id, 4.2));
  float share = nyWindows * mix(1.1, 0.9, far);
  float lit;
  if (style > 0.7) {
    if (mod(gy, 2.0) < 1.0) {
      return vec4(bodyCol, body);
    }
    lit = nyLit(id, 0.0, gy, share * 0.8);
  } else {
    if (mod(gx, 2.0) < 1.0) {
      return vec4(bodyCol, body);
    }
    lit = nyLit(id, gx, gy, share);
  }
  if (lit < 0.5) {
    return vec4(bodyCol, body);
  }
  vec3 col = nyWindowColor(hash21(vec2(mod(id, 89.0) + gx * 0.7, gy * 0.37 + 2.0)));
  float tone = mix(0.7, 0.92, hash21(vec2(gx * 0.3 + mod(id, 89.0), gy * 0.5)));
  return vec4(mix(col, col * vec3(0.85, 0.88, 1.0), far), tone * mix(1.0, 0.66, far));
}

// A thin mast on some roofs, with a red warning light that blinks.
vec4 nyAntenna(float u, float w, float v, float top, float id, out float cover) {
  cover = 0.0;
  float tall = hash21(vec2(id, 8.8));
  if (tall < 0.8) {
    return vec4(0.0);
  }
  float reach = 0.025 + 0.03 * tall;
  if (abs(u - w * 0.5) > max(nyCw * 0.5, 0.002) || v < top || v > top + reach) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (v > top + reach - max(nyPx, 0.004)) {
    float blink = step(0.55, fract(nyTime * 0.7 + id * 0.37));
    return vec4(1.0, 0.18, 0.14, 0.35 + 0.6 * blink);
  }
  return vec4(0.5, 0.55, 0.8, 0.2);
}

// The Empire State Building: a broad base, the long shaft with its vertical
// piers, then the setbacks to the floodlit crown, the mooring mast and the
// antenna with its red light.
vec4 nyEmpire(vec2 p, out float cover) {
  cover = 0.0;
  float v = p.y - NY_SHORE;
  float x = (p.x - nyEsX) / nySx;
  float q = abs(x);
  if (v < 0.0 || v > 0.7 || q > 0.09) {
    return vec4(0.0);
  }
  float line = max(nyCw * 0.55 / nySx, 0.0025);
  float hw;
  if (v < 0.07) {
    hw = 0.08;
  } else if (v < 0.42) {
    hw = 0.056;
  } else if (v < 0.455) {
    hw = 0.044;
  } else if (v < 0.485) {
    hw = 0.032;
  } else if (v < 0.515) {
    hw = 0.022;
  } else if (v < 0.54) {
    hw = 0.013;
  } else if (v < 0.6) {
    hw = mix(0.009, 0.003, (v - 0.54) / 0.06);
  } else {
    hw = 0.0;
  }
  hw = max(hw, line);
  if (q > hw) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (v > 0.6) {
    if (v > 0.7 - max(nyPx * 1.2, 0.006)) {
      float blink = step(0.5, fract(nyTime * 0.5));
      return vec4(1.0, 0.2, 0.15, 0.4 + 0.6 * blink);
    }
    return vec4(0.86, 0.88, 1.0, 0.5);
  }
  float rim = 1.0 - smoothstep(line * 0.5, line * 1.6, hw - q);
  if (v > 0.42) {
    // Floodlit from below: gold on the lower setbacks, near white at the top.
    float rise = smoothstep(0.42, 0.6, v);
    float fin = step(0.5, fract(x / (nyCw * 2.0 / nySx)));
    vec3 col = mix(vec3(1.0, 0.68, 0.28), vec3(1.0, 0.95, 0.84), rise);
    float pulse = 0.04 * sin(nyTime * 0.8 + v * 40.0);
    return vec4(col, 0.66 + 0.12 * fin + 0.18 * rise + pulse);
  }
  if (v < 0.07) {
    return vec4(0.32, 0.38, 0.7, 0.13 + 0.12 * rim);
  }
  // The shaft: piers on every other column, windows between them. The top
  // floors catch the floodlights.
  float wash = smoothstep(0.28, 0.42, v);
  vec3 stone = mix(vec3(0.34, 0.4, 0.72), vec3(1.0, 0.72, 0.4), wash);
  float gx = floor(x / (nyCw / nySx));
  float gy = floor(v / nyPx);
  float pier = step(mod(gx, 2.0), 0.5);
  if (pier > 0.5 || rim > 0.5) {
    return vec4(stone, 0.18 + 0.2 * wash + 0.14 * rim);
  }
  float lit = nyLit(77.0, gx, gy, nyWindows * 0.6);
  if (lit > 0.5) {
    return vec4(nyWindowColor(hash21(vec2(gx, gy))), 0.8);
  }
  return vec4(stone, 0.12 + 0.12 * wash);
}

// The Chrysler Building: a slim shaft with pale corner piers, then the crown
// of five stacked arches, each ring pierced by triangular windows, and the
// needle on top.
vec4 nyChrysler(vec2 p, out float cover) {
  cover = 0.0;
  float v = p.y - NY_SHORE;
  float x = (p.x - nyChX) / nySx;
  float q = abs(x);
  if (v < 0.0 || v > 0.6 || q > 0.06) {
    return vec4(0.0);
  }
  float line = max(nyCw * 0.55 / nySx, 0.0025);
  const float CROWN = 0.29;
  if (v < CROWN) {
    float hw = v < 0.2 ? 0.052 : v < 0.25 ? 0.048 : 0.044;
    if (q > hw) {
      return vec4(0.0);
    }
    cover = 1.0;
    float rim = 1.0 - smoothstep(line * 0.5, line * 1.6, hw - q);
    if (rim > 0.5) {
      return vec4(0.78, 0.82, 0.98, 0.34);
    }
    float gx = floor(x / (nyCw / nySx));
    float gy = floor(v / nyPx);
    if (mod(gx, 2.0) > 0.5 && mod(gy, 2.0) > 0.5) {
      float lit = nyLit(91.0, gx, gy, nyWindows * 0.7);
      if (lit > 0.5) {
        return vec4(nyWindowColor(hash21(vec2(gx * 3.0, gy))), 0.78);
      }
    }
    return vec4(0.3, 0.36, 0.7, 0.13);
  }
  // The crown. The lowest arch that holds the sample is the one in front.
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float wk = 0.044 * (1.0 - fk / 5.4);
    float yk = CROWN + fk * 0.03;
    float hk = 0.055 - fk * 0.004;
    vec2 a = vec2(x / wk, (v - yk) / hk);
    float r = length(a);
    if (v >= yk && r < 1.0) {
      cover = 1.0;
      vec3 steel = vec3(0.82, 0.87, 1.0);
      // The lit rim of each arch.
      float edge = max(line / wk, nyPx / hk) * 1.2;
      if (r > 1.0 - edge) {
        return vec4(vec3(1.0, 0.97, 0.88), 0.82);
      }
      // A sunburst of triangles, wide at the inside and pointed outward.
      if (r > 0.42) {
        float ang = atan(a.x, a.y);
        float seg = fract(ang / NY_PI * 5.0 + 0.5);
        float taper = 1.0 - (r - 0.42) / (1.0 - edge - 0.42);
        if (abs(seg - 0.5) < 0.36 * taper) {
          float flick = 0.08 * sin(nyTime * 1.3 + fk * 2.0 + ang * 3.0);
          return vec4(vec3(1.0, 0.94, 0.78), 0.92 + flick);
        }
      }
      return vec4(steel, 0.42);
    }
  }
  // The needle.
  float tip = 0.6;
  float hw = max(mix(0.007, 0.0, (v - 0.42) / (tip - 0.42)), line * 0.8);
  if (v > 0.42 && q < hw) {
    cover = 1.0;
    return vec4(0.9, 0.93, 1.0, 0.6);
  }
  return vec4(0.0);
}

// How tall the skyline stands at x: Midtown rises around the two landmarks
// and the Financial District bunches up at the left.
float nyEnvelope(float x) {
  float mid = (nyEsX + nyChX) * 0.5;
  float midtown = exp(-pow((x - mid) / 0.45, 2.0));
  float downtown = exp(-pow((x - nyTowerL * 0.6) / 0.25, 2.0));
  return 0.14 + 0.18 * midtown + 0.16 * downtown;
}

// Everything on the Manhattan shore. Also called by the river for its
// reflections, so it never reads the sky.
vec4 nyCity(vec2 p, out float cover) {
  cover = 0.0;
  float v = p.y - NY_SHORE;
  if (v < 0.0 || v > 0.7) {
    return vec4(0.0);
  }
  // The FDR Drive along the water, with traffic both ways.
  vec2 near = p + vec2(nyPtr * 0.025, 0.0);
  float road = max(nyPx * 1.1, 0.008);
  if (v < road) {
    cover = 1.0;
    float cars = nyTraffic * max(nyCars(near.x, 3.0, 1.0, 0.05), nyCars(near.x, 4.0, -1.0, 0.04));
    if (cars > 0.5) {
      vec3 col = v < road * 0.5 ? vec3(1.0, 0.9, 0.7) : vec3(1.0, 0.3, 0.2);
      return vec4(col, 0.7);
    }
    return vec4(0.6, 0.55, 0.7, 0.16);
  }
  float id;
  float u;
  float w;
  // A low row of blocks in front, which hides the landmarks' feet.
  float r = nyBlocks(near.x, 0.11, 0.15, 1.3, id, u, w);
  float top = road + 0.03 + 0.16 * pow(r, 1.4) * nyEnvelope(near.x) / 0.48;
  if (v < top) {
    cover = 1.0;
    return nyFacade(u, w, v, top, id, 0.0);
  }
  vec4 hit = nyAntenna(u, w, v, top, id, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyEmpire(near, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyChrysler(near, cover);
  if (cover > 0.5) {
    return hit;
  }
  // The dense skyline behind.
  vec2 far = p + vec2(nyPtr * 0.015, 0.0);
  r = nyBlocks(far.x, 0.075, 0.105, 7.9, id, u, w);
  top = nyEnvelope(far.x) * (0.4 + 0.6 * sqrt(r));
  if (v < top) {
    cover = 1.0;
    return nyFacade(u, w, v, top, id + 0.25, 1.0);
  }
  return nyAntenna(u, w, v, top, id + 0.25, cover);
}

vec4 nySky(vec2 p, float aspect) {
  float h = p.y - NY_SHORE;
  float t = nyTime;
  // The city's own glow along the horizon, under a deep navy.
  float glow = exp(-max(h, 0.0) * 5.0);
  float tone = glow * 0.3 - 0.06;
  vec3 col = mix(vec3(0.3, 0.38, 0.9), vec3(1.0, 0.56, 0.42), smoothstep(0.4, 1.0, glow));
  // Thin clouds drifting east, lit from below by the city.
  vec2 cq = vec2(p.x * 1.1 + t * 0.01, p.y * 5.0);
  float n = fbm(cq + vec2(fbm(cq * 0.7 + 4.0) * 0.8, 0.0));
  float band = smoothstep(0.32, 0.42, h) * (1.0 - smoothstep(0.6, 0.72, h));
  float cloud = smoothstep(0.6, 0.78, n) * band;
  tone = mix(tone, 0.13 + 0.12 * smoothstep(0.7, 0.95, n), cloud);
  col = mix(col, mix(vec3(0.95, 0.6, 0.55), vec3(0.55, 0.58, 0.95), smoothstep(0.35, 0.65, h)), cloud);
  // A few stars, never through a cloud.
  // Each star is one sample in the middle of a 3 by 3 block.
  vec2 g = p / (vec2(nyCw, nyPx) * 3.0);
  vec2 id = floor(g);
  float star = hash21(mod(id, 97.0) + 23.7);
  vec2 off = abs(fract(g) - 0.5);
  if (star > 0.965 && cloud < 0.1 && max(off.x, off.y) < 0.17) {
    float twinkle = 0.55 + 0.45 * sin(t * (1.1 + star * 3.0) + star * 50.0);
    float s = 0.6 * twinkle * smoothstep(0.4, 0.6, h);
    if (s > tone) {
      tone = s;
      col = vec3(0.85, 0.88, 1.0);
    }
  }
  // A plane crossing high up, its strobe flashing.
  vec2 plane = vec2(mod(t * 0.02, aspect + 0.6) - 0.3, 0.9 + 0.02 * sin(t * 0.05));
  vec2 d = (p - plane) / vec2(nyCw, nyPx);
  if (abs(d.y) < 0.6 && abs(d.x) < 0.8) {
    float strobe = step(0.82, fract(t * 0.9));
    tone = max(tone, 0.45 + 0.5 * strobe);
    col = mix(vec3(1.0, 0.3, 0.25), vec3(1.0), strobe);
  }
  return vec4(col, tone);
}

// The cable's height at x: the main span sags between the towers and each
// side span drops toward an anchorage beyond them.
float nyCableY(float x, out float slope) {
  float len = (nyTowerR - nyTowerL) * 0.5;
  float low = NY_DECK + 0.018;
  float s;
  if (x < nyTowerL) {
    low = NY_DECK + 0.006;
    s = clamp((x - (nyTowerL - len)) / len, 0.0, 1.0);
  } else if (x > nyTowerR) {
    low = NY_DECK + 0.006;
    s = -clamp((nyTowerR + len - x) / len, 0.0, 1.0);
  } else {
    s = (x - (nyTowerL + len)) / len;
  }
  float rise = NY_CABLE - low;
  slope = 2.0 * rise * s / len;
  return low + rise * s * s;
}

// One of the bridge's granite towers: two tall pointed arches above the deck,
// a cornice on top. Returns the tone; cover is 0 in the arches, where the
// deck and the city show through.
vec4 nyTower(vec2 p, float tx, out float cover) {
  cover = 0.0;
  float tw = 0.062 * nySx;
  float base = 0.02;
  float x = p.x - tx;
  if (p.y < base || p.y > NY_CABLE + 0.012) {
    return vec4(0.0);
  }
  float hw = tw * (1.0 - 0.1 * (p.y - base) / (NY_CABLE - base));
  bool cornice = p.y > NY_CABLE - 0.03 && p.y < NY_CABLE - 0.016;
  if (cornice) {
    hw += max(nyCw * 0.6, 0.003);
  }
  if (abs(x) > hw) {
    return vec4(0.0);
  }
  float lh = max(nyPx * 0.6, 0.002);
  float lw = max(nyCw * 0.6, 0.002);
  // The arches: straight sides to the springing line, then a pointed head.
  float aw = tw * 0.19;
  float ac = abs(abs(x) - tw * 0.4);
  float spring = 0.35;
  float head = 0.05;
  float archTop = spring + head * (1.0 - ac / aw);
  bool inArch = ac < aw && p.y > NY_DECK - 0.018 && p.y < archTop;
  if (inArch) {
    return vec4(0.0);
  }
  cover = 1.0;
  // Light the outline of the stone and the arch heads.
  float rim = step(hw - abs(x), lw);
  float archEdge = ac < aw + lw && p.y > NY_DECK - 0.018 && p.y < archTop + lh * 1.5 ? 1.0 : 0.0;
  float course = 1.0 - smoothstep(0.0, lh, abs(mod(p.y, 0.03) - 0.015) - 0.012);
  float lit = smoothstep(0.08, 0.3, p.y);
  float tone = 0.26 + 0.18 * lit + 0.05 * course + 0.26 * max(rim, archEdge);
  if (cornice) {
    tone = 0.62;
  }
  vec3 col = mix(vec3(0.75, 0.62, 0.55), vec3(1.0, 0.8, 0.58), lit);
  return vec4(col, tone);
}

vec4 nyBridge(vec2 p, out float cover) {
  cover = 0.0;
  if (p.y > NY_CABLE + 0.015) {
    return vec4(0.0);
  }
  vec4 hit = nyTower(p, nyTowerL, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = nyTower(p, nyTowerR, cover);
  if (cover > 0.5) {
    return hit;
  }
  float lh = max(nyPx * 0.55, 0.002);
  float lw = max(nyCw * 0.55, 0.002);
  // The deck, a truss under a lit roadway, crossing the whole view.
  float deckH = max(0.016, nyPx * 2.2);
  if (p.y < NY_DECK && p.y > NY_DECK - deckH) {
    cover = 1.0;
    float d = NY_DECK - p.y;
    if (d < lh * 1.6) {
      float lamp = step(fract(p.x / 0.035), lw / 0.035 * 1.5);
      return mix(vec4(0.74, 0.72, 0.9, 0.56), vec4(1.0, 0.86, 0.6, 0.95), lamp);
    }
    float lane = d < deckH * 0.55 ? 1.0 : 0.0;
    float cars = nyTraffic * nyCars(p.x, lane, lane > 0.5 ? 1.0 : -1.0, 0.06);
    if (cars > 0.5) {
      return lane > 0.5 ? vec4(1.0, 0.92, 0.72, 0.9) : vec4(1.0, 0.24, 0.18, 0.75);
    }
    float truss = abs(fract(p.x / (deckH * 1.4) + d / deckH * 0.7) - 0.5);
    return vec4(0.5, 0.52, 0.78, 0.16 + 0.1 * step(0.36, truss));
  }
  if (p.y < NY_DECK) {
    return vec4(0.0);
  }
  float slope;
  float cy = nyCableY(p.x, slope);
  float cd = abs(p.y - cy) / sqrt(1.0 + slope * slope);
  bool mainSpan = p.x > nyTowerL && p.x < nyTowerR;
  // The main cables, strung with the bridge's necklace of lights.
  if (cd < max(lh, lw * 0.8) * 1.1) {
    cover = 1.0;
    float bead = step(abs(fract(p.x / 0.032) - 0.5) * 0.032, lw * 1.2);
    if (mainSpan && bead > 0.5) {
      return vec4(1.0, 0.97, 0.88, 1.0);
    }
    return vec4(0.82, 0.8, 0.95, 0.6);
  }
  if (p.y > cy) {
    return vec4(0.0);
  }
  // Suspenders hanging straight down from the cables. Wires set cover to
  // 0.5: nyScene lets anything brighter behind them show through.
  if (fract(p.x / (nyCw * 4.0)) < 0.25) {
    cover = 0.5;
    return vec4(0.6, 0.62, 0.86, 0.2);
  }
  // The diagonal stays that fan from each tower top: the bridge's web.
  for (int i = 0; i < 2; i++) {
    float tx = i == 0 ? nyTowerL : nyTowerR;
    float along = (NY_CABLE - p.y) / (NY_CABLE - NY_DECK);
    float d = (p.x - tx) / max(along, 0.05);
    float reach = (nyTowerR - nyTowerL) * 0.3;
    if (abs(d) > 0.062 * nySx && abs(d) < reach) {
      float spacing = 0.03;
      float k = abs(fract(d / spacing + 0.5) - 0.5) * spacing * along;
      if (k < lw) {
        cover = 0.5;
        return vec4(0.66, 0.66, 0.9, 0.24);
      }
    }
  }
  return vec4(0.0);
}

// A ferry crossing right to left: orange hull, two decks of lit cabin
// windows, a wheelhouse at each end, and a wake behind.
vec4 nyFerry(vec2 p, float aspect, out float cover) {
  cover = 0.0;
  float len = 0.2;
  float travel = aspect + 0.6;
  float x0 = aspect + 0.3 - mod(nyTime * 0.022 + aspect * 0.55, travel);
  float lx = p.x - x0;
  float y = p.y - 0.06;
  float lh = max(nyPx * 0.6, 0.002);
  if (lx < -0.02 || lx > len + 0.18 || y < -0.05 || y > 0.08) {
    return vec4(0.0);
  }
  float hullH = 0.02;
  float pinch = 0.014 * (1.0 - clamp(y / hullH, 0.0, 1.0));
  if (y >= 0.0 && y < hullH && lx > pinch && lx < len - pinch) {
    cover = 1.0;
    if (y > hullH - lh * 1.4) {
      return vec4(1.0, 0.86, 0.7, 0.75);
    }
    return vec4(1.0, 0.46, 0.12, 0.55);
  }
  float gx = floor(lx / nyCw);
  float window = step(0.5, mod(gx, 2.0));
  if (y >= hullH && y < hullH + 0.016 && lx > 0.01 && lx < len - 0.01) {
    cover = 1.0;
    return mix(vec4(1.0, 0.52, 0.18, 0.42), vec4(1.0, 0.86, 0.56, 0.95), window);
  }
  if (y >= hullH + 0.016 && y < hullH + 0.03 && lx > 0.028 && lx < len - 0.028) {
    cover = 1.0;
    return mix(vec4(0.95, 0.92, 0.88, 0.48), vec4(1.0, 0.8, 0.5, 0.82), window);
  }
  float house = min(abs(lx - 0.045), abs(lx - (len - 0.045)));
  if (y >= hullH + 0.03 && y < hullH + 0.042 && house < 0.012) {
    cover = 1.0;
    return vec4(0.95, 0.95, 1.0, 0.6);
  }
  if (abs(lx - len * 0.5) < max(nyCw * 0.5, 0.002) && y >= hullH + 0.03 && y < hullH + 0.06) {
    cover = 1.0;
    float top = step(hullH + 0.06 - max(nyPx, 0.004), y);
    return mix(vec4(0.8, 0.8, 0.9, 0.4), vec4(1.0, 1.0, 0.92, 1.0), top);
  }
  // The wake trails off to the right; the cabin lights drop warm streaks below.
  float ripple = 0.5 + 0.5 * snoise(vec2(lx * 50.0 + nyTime * 1.5, y * 90.0));
  if (lx > len - 0.01 && abs(y - 0.004) < max(nyPx, 0.004) + (lx - len) * 0.04) {
    float foam = exp(-(lx - len) * 14.0) * ripple;
    if (foam > 0.15) {
      cover = 1.0;
      return vec4(0.85, 0.9, 1.0, 0.55 * foam);
    }
  }
  if (y < 0.0 && lx > 0.01 && lx < len - 0.01) {
    float streak = ripple * exp(y * 40.0);
    if (streak > 0.25) {
      cover = 1.0;
      return vec4(1.0, 0.62, 0.3, 0.5 * streak);
    }
  }
  return vec4(0.0);
}

// The East River: ripples that drift and shimmer, and the city mirrored in
// them, broken into streaks.
vec4 nyWater(vec2 p) {
  float t = nyTime;
  float depth = NY_SHORE - p.y;
  vec2 q = p + vec2(nyPtr * 0.03, 0.0);
  float wave = snoise(vec2(q.x * 8.0 + t * 0.04, q.y * 100.0 + t * 0.6 + sin(q.x * 12.0) * 2.0));
  float rip = smoothstep(0.0, 0.8, wave);
  // The mirror is squashed, so the lights stretch down the river as streaks.
  float sway = snoise(vec2(p.y * 60.0, t * 0.5));
  vec2 rp = vec2(p.x + 0.01 * sway, NY_SHORE + 0.004 + depth * 0.6 + 0.015 * sway);
  float rc;
  vec4 city = nyCity(rp, rc);
  float refl = rc * city.a * (0.15 + 0.85 * rip) * exp(-depth * 2.2);
  float bright = step(0.3, city.a) * rc;
  float sky = exp(-depth * 9.0) * rip * 0.26;
  float tone = max(max(refl * 0.95, sky), rip * 0.09);
  vec3 col = mix(vec3(0.3, 0.4, 0.86), city.rgb, bright * step(sky, refl));
  return vec4(col, tone);
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
  // Wide boxes keep the landmarks right of centre, so a headline fits on
  // the left; tall ones pull everything in and slim it down.
  float wide = smoothstep(0.9, 1.5, aspect);
  nySx = mix(0.72, 1.0, smoothstep(0.5, 1.2, aspect));
  nyEsX = aspect * mix(0.42, 0.6, wide);
  nyChX = nyEsX + mix(0.15, 0.3, wide);
  nyTowerL = aspect * mix(0.08, 0.34, wide);
  nyTowerR = aspect * mix(0.92, 0.96, wide);
  // Nearer layers slide further with the pointer.
  nyPtr = (u_pointer.x - 0.5) * u_pointer.z * nyParallax;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float cover = 0.0;
  vec4 hit = vec4(0.0);
  bool done = false;

  if (nyFerryOn > 0.5) {
    hit = nyFerry(p + vec2(nyPtr * 0.07, 0.0), aspect, cover);
    done = cover > 0.5;
  }
  vec4 wire = vec4(0.0);
  if (!done) {
    hit = nyBridge(p + vec2(nyPtr * 0.05, 0.0), cover);
    done = cover > 0.75;
    if (cover > 0.25 && !done) {
      wire = hit;
    }
  }
  if (!done && p.y < NY_SHORE) {
    hit = nyWater(p);
    done = true;
  }
  if (!done) {
    hit = nyCity(p, cover);
    done = cover > 0.5;
  }
  if (!done) {
    hit = nySky(p + vec2(nyPtr * 0.005, 0.0), aspect);
  }
  if (wire.a > hit.a) {
    hit = wire;
  }
  // Near-black becomes paper, so the sky keeps clean gaps between glyphs.
  float tone = hit.a < 0.05 ? 0.0 : clamp(hit.a, 0.0, 1.0) * nyIntensity;
  nyCacheUv = uv;
  nyCacheT = t;
  nyCacheValue = vec4(hit.rgb, tone);
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
const NIGHT = "#050a1d";
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
        "linear-gradient(to bottom, #050a1d 0%, #0d1640 50%, #4a2d4a 72%, #070d26 73%, #050a1d 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface NewYorkProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Share of windows lit across the skyline, from 0 (dark) to 1. Default 0.5. */
  windows?: number;
  /** The ferry crossing the river. Default `true`. */
  ferry?: boolean;
  /** Car lights on the bridge and the FDR Drive. Default `true`. */
  traffic?: boolean;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's night navy in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Manhattan at night from across the East River. The Empire State Building
 * glows at the top, the Chrysler Building's crown shines over a skyline of
 * windows that slowly change, and the Brooklyn Bridge spans the river in
 * front while a ferry crosses below. Decorative and full-bleed: size it
 * with `className`, usually `absolute inset-0`.
 */
export const NewYork = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  cell = 12,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  intensity = 1,
  windows = 0.5,
  ferry = true,
  traffic = true,
  fallback = FALLBACK,
  ...props
}: NewYorkProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        nyFerryOn: ferry ? 1 : 0,
        nyIntensity: clamp(intensity, 0, 1),
        nyParallax: interactive ? 1 : 0,
        nyTraffic: traffic ? 1 : 0,
        nyWindows: clamp(windows, 0, 1),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
