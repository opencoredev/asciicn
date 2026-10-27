"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  CharsetName,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted back to front in one pass: stars, Fuji, a far
// skyline, Tokyo Tower, mid towers, near blocks with vertical neon, the
// elevated line and its train, then the street. Each layer is an opaque
// silhouette, so a dark facade hides what stands behind it. Window grids
// are box-filtered over one sample's footprint so they don't shimmer in
// coarse charsets. Units: y runs 0 (street) to 1 (top of the sky), x is
// centred and measured in the same units, so shapes keep their proportions
// at any aspect. `tokyoScene` returns colour and tone, cached per sample.
const SCENE = `
const float TOKYO_STREET = 0.07;
const float TOKYO_TOWER_BASE = 0.21;
const float TOKYO_TOWER_H = 0.65;

// Integral of a 0/1 pulse that is on from a to b in every unit period.
float tokyoPulseSum(float x, float a, float b) {
  return floor(x) * (b - a) + clamp(fract(x) - a, 0.0, b - a);
}

// How much of a footprint fw wide, centred on x, the pulse covers.
float tokyoPulse(float x, float a, float b, float fw) {
  float w = max(fw, 1e-4);
  return (tokyoPulseSum(x + w * 0.5, a, b) - tokyoPulseSum(x - w * 0.5, a, b)) / w;
}

// Lays a layer over what is behind it wherever it covers.
void tokyoPaint(inout vec4 acc, vec3 rgb, float tone, float cover) {
  acc = mix(acc, vec4(rgb, tone), clamp(cover, 0.0, 1.0));
}

// Windows on a facade: a grid that is lit cell by cell and changes slowly.
float tokyoWindows(vec2 q, vec2 size, vec2 px, float id, float lit, float t) {
  vec2 g = q / size;
  float on = tokyoPulse(g.x, 0.22, 0.72, px.x / size.x) * tokyoPulse(g.y, 0.3, 0.72, px.y / size.y);
  vec2 cell = floor(g);
  float seed = hash21(cell + id * 17.0);
  float epoch = floor(t * 0.04 + seed * 9.0);
  float state = hash21(cell * 1.7 + vec2(id, epoch));
  return on * step(1.0 - lit, state) * (0.6 + 0.4 * hash21(cell + 3.3));
}

vec3 tokyoWindowColor(float r) {
  if (r < 0.45) {
    return vec3(1.0, 0.86, 0.62);
  }
  if (r < 0.8) {
    return vec3(0.72, 0.86, 1.0);
  }
  return vec3(0.42, 0.62, 1.0);
}

float tokyoFujiTop(float dx) {
  float slope = clamp(1.0 - (abs(dx) - 0.022) / 0.44, 0.0, 1.0);
  return 0.3 + 0.2 * pow(slope, 1.75);
}

vec4 tokyoFuji(vec2 p, float pixel) {
  float top = tokyoFujiTop(p.x);
  if (p.y > top || p.y < 0.28) {
    return vec4(0.0);
  }
  // Snow reaches down in streaks from the summit.
  float streak = 0.5 + 0.5 * sin(p.x * 160.0 + 2.0 * sin(p.x * 47.0));
  float snowline = 0.3 + 0.2 * (0.6 + 0.12 * streak);
  float rim = 1.0 - smoothstep(pixel * 0.6, pixel * 1.8, top - p.y);
  float snow = smoothstep(snowline - 0.004, snowline + 0.004, p.y);
  float tone = max(0.1, max(rim * 0.34, snow * (0.36 + 0.1 * streak)));
  vec3 col = mix(vec3(0.3, 0.38, 0.62), vec3(0.82, 0.88, 1.0), max(snow, rim * 0.5));
  return vec4(col, tone);
}

// A row of blocks. lo..hi is the height range; near the tower and Fuji the
// blocks stay low so both landmarks read. Returns colour and tone, and the
// coverage through cover.
vec4 tokyoBlocks(vec2 p, float w, float lo, float hi, float seed, vec2 win, float lit, float t, vec2 px, float towerX, float fujiX, float fujiOn, out float cover) {
  cover = 0.0;
  float xs = p.x / w;
  float id = floor(xs);
  float f = fract(xs);
  float r1 = hash21(vec2(id, seed));
  float r2 = hash21(vec2(id, seed + 7.1));
  float r3 = hash21(vec2(id, seed + 13.7));
  float left = 0.03 + r2 * 0.12;
  float right = 0.97 - r3 * 0.12;
  if (f < left || f > right) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w;
  float h = lo + (hi - lo) * pow(r1, 1.3);
  h = mix(min(h, TOKYO_TOWER_BASE + 0.05), h, smoothstep(0.07, 0.12, abs(cx - towerX)));
  h = mix(min(h, 0.335), h, max(smoothstep(0.12, 0.3, abs(cx - fujiX)), 1.0 - fujiOn));
  // Setback crowns on some towers.
  float mid = abs(f - (left + right) * 0.5) / (right - left);
  if (r2 > 0.55 && mid < 0.28) {
    h += 0.025 + 0.03 * r3;
  }
  float antenna = 0.0;
  if (r1 > 0.78 && abs(f - (left + right) * 0.5) * w < px.x * 0.6) {
    antenna = h + 0.035;
  }
  if (p.y > max(h, antenna)) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (p.y > h) {
    // The antenna and its blinking red light.
    float blink = step(0.55, fract(t * 0.6 + r3 * 3.0));
    float light = step(antenna - px.y * 1.5, p.y) * blink;
    return mix(vec4(0.4, 0.45, 0.6, 0.22), vec4(1.0, 0.12, 0.08, 0.95), light);
  }
  vec2 q = vec2(p.x - (id + left) * w, p.y);
  float glass = tokyoWindows(q, win, px, id + seed, lit, t);
  float roof = 1.0 - smoothstep(px.y * 0.6, px.y * 1.6, h - p.y);
  vec3 col = tokyoWindowColor(r3);
  float tone = max(glass * 0.82, roof * 0.24);
  col = mix(vec3(0.36, 0.46, 0.75), col, step(roof * 0.24, glass * 0.82));
  return vec4(col, tone);
}

// Tokyo Tower: a tapering lattice with two observation decks and a spire,
// banded in orange and white and floodlit from below.
vec4 tokyoTower(vec2 p, float t, vec2 px, out float cover) {
  cover = 0.0;
  float H = TOKYO_TOWER_H;
  float s = (p.y - TOKYO_TOWER_BASE) / H;
  float u = p.x;
  if (s < 0.0 || s > 1.0) {
    return vec4(0.0);
  }
  float body = 0.8;
  float taper = 1.0 - min(s, body) / body;
  float hw = s < body ? H * (0.006 + 0.118 * pow(taper, 2.1)) : H * 0.0032;
  float mainDeck = step(abs(s - 0.455), 0.022);
  float topDeck = step(abs(s - 0.738), 0.011);
  float w = max(hw + H * (0.012 * mainDeck + 0.006 * topDeck), px.x * 0.6);
  if (abs(u) > w) {
    return vec4(0.0);
  }
  // The arch between the legs.
  if (s < 0.11) {
    float arch = hw * 0.64 * sqrt(max(0.0, 1.0 - pow(s / 0.11, 2.0)));
    if (abs(u) < arch) {
      return vec4(0.0);
    }
  }
  cover = 1.0;
  vec3 orange = vec3(1.0, 0.24, 0.1);
  vec3 white = vec3(1.0, 0.93, 0.86);
  float flood = mix(1.0, 0.8, s);
  if (s > 0.975) {
    float blink = step(0.5, fract(t * 0.5));
    return vec4(vec3(1.0, 0.1, 0.06), mix(0.45, 1.0, blink));
  }
  if (mainDeck + topDeck > 0.5) {
    // Deck windows run round the box in a bright strip.
    float centre = mainDeck > 0.5 ? 0.455 : 0.738;
    float band = mainDeck > 0.5 ? 0.022 : 0.011;
    float strip = 1.0 - smoothstep(0.35, 0.6, abs(s - centre) / band);
    float mullion = tokyoPulse(u / (H * 0.008), 0.0, 0.7, px.x / (H * 0.008));
    float glass = strip * mullion;
    return vec4(mix(white, vec3(0.75, 0.9, 1.0), glass), 0.62 + 0.38 * glass);
  }
  vec3 paint = orange;
  if (s < body) {
    float upper = step(0.48, s) * mod(floor((s - 0.48) / 0.046), 2.0);
    float lowBand = step(0.25, s) * step(s, 0.3);
    paint = mix(orange, white, max(upper, lowBand));
  } else {
    paint = mix(orange, white, mod(floor((s - body) / 0.035), 2.0));
  }
  if (s >= body) {
    return vec4(paint, 0.85 * flood);
  }
  // Panels shrink with the tower, so the bracing stays square-ish.
  float z = -log(hw / H) * 3.2;
  float s2 = s + px.y / H;
  float hw2 = H * (0.006 + 0.118 * pow(1.0 - min(s2, body) / body, 2.1));
  float dz = abs(-log(hw2 / H) * 3.2 - z);
  float fz = fract(z);
  float a = u / hw;
  float reach = px.x * 0.75 / hw;
  float leg = step(1.0 - px.x * 1.1 / hw, abs(a));
  float diag = max(step(abs(a - (2.0 * fz - 1.0)), reach), step(abs(a + (2.0 * fz - 1.0)), reach));
  float rung = step(min(fz, 1.0 - fz), dz * 0.9);
  float strut = max(leg, max(diag, rung));
  // Gaps stay dim so the bracing reads, dithered or not.
  return vec4(paint, mix(0.16, 0.96, strut) * flood);
}

// A vertical neon shop sign: a lit panel with blocky characters stacked
// down it, framed by a tube. Signs flicker now and then; some light their
// characters one after another.
vec4 tokyoSign(vec2 p, float sx, float top, float len, float sw, float id, float t, vec2 px, out float cover) {
  cover = 0.0;
  float lx = (p.x - sx) / sw + 0.5;
  if (lx < 0.0 || lx > 1.0 || p.y > top || p.y < top - len) {
    return vec4(0.0);
  }
  cover = 1.0;
  float r = hash21(vec2(id, 4.2));
  vec3 col = r < 0.38 ? vec3(1.0, 0.16, 0.22) : r < 0.72 ? vec3(0.2, 0.55, 1.0) : r < 0.88 ? vec3(1.0, 0.95, 0.9) : vec3(1.0, 0.3, 0.75);
  float frame = sw * 0.12;
  float dx = min(p.x - (sx - sw * 0.5), (sx + sw * 0.5) - p.x);
  float dy = min(top - p.y, p.y - (top - len));
  float tube = step(min(dx, dy), max(frame, px.x * 0.8));
  // Characters: three by three strokes, a row and column pattern each.
  float ly = (top - p.y - sw * 0.15) / (sw * 1.05);
  float ci = floor(ly);
  vec2 c = vec2((lx - 0.18) / 0.64, fract(ly) / 0.86);
  vec2 sub = floor(c * 3.0);
  float glyph = 0.0;
  if (c.x > 0.0 && c.x < 1.0 && c.y < 1.0) {
    float rowBar = step(0.45, hash21(vec2(id + ci, sub.y + 1.0)));
    float colBar = step(0.5, hash21(vec2(id - ci, sub.x + 7.0)));
    vec2 inCell = fract(c * 3.0);
    float thin = 0.34;
    float hz = rowBar * step(abs(inCell.y - 0.5), thin);
    float vt = colBar * step(abs(inCell.x - 0.5), thin);
    glyph = max(hz, vt);
  }
  float chase = 1.0;
  if (r > 0.6 && r < 0.72) {
    chase = step(fract(t * 0.35 - ci * 0.12), 0.7);
  }
  float window = fract(t * 0.13 + r * 7.0);
  float stutter = step(0.45, hash21(vec2(floor(t * 16.0), id)));
  float on = window < 0.05 ? stutter : 1.0;
  float tone = max(tube * 0.88, max(0.18, glyph * chase * 0.98));
  return vec4(mix(col, vec3(1.0), glyph * chase * 0.35), tone * mix(0.12, 1.0, on) * tokyoNeon);
}

// Near blocks at the sides, carrying the neon.
vec4 tokyoNear(vec2 p, float t, vec2 px, float towerX, out float cover) {
  cover = 0.0;
  float w = 0.13;
  float xs = p.x / w;
  float id = floor(xs);
  float f = fract(xs);
  float r1 = hash21(vec2(id, 31.0));
  float r2 = hash21(vec2(id, 37.3));
  float left = 0.02 + r2 * 0.06;
  float right = 0.98 - r1 * 0.05;
  if (f < left || f > right) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w;
  float side = smoothstep(0.1, 0.34, abs(cx - towerX));
  float h = 0.13 + 0.07 * r1 + 0.26 * side * (0.55 + 0.45 * r2);
  if (p.y > h) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 q = vec2(p.x - (id + left) * w, p.y);
  float glass = tokyoWindows(q, vec2(0.02, 0.028), px, id + 50.0, 0.42, t);
  float roof = 1.0 - smoothstep(px.y * 0.6, px.y * 1.8, h - p.y);
  vec4 acc = vec4(mix(vec3(0.34, 0.42, 0.7), tokyoWindowColor(r2), step(0.2, glass)), max(glass * 0.66, roof * 0.26));
  // One or two vertical signs per block.
  for (int k = 0; k < 2; k++) {
    float fk = float(k);
    float rs = hash21(vec2(id, 60.0 + fk * 5.0));
    if (rs > 0.25 + 0.6 * tokyoNeon) {
      continue;
    }
    float sw = 0.026 + 0.008 * hash21(vec2(id, 70.0 + fk));
    float sx = (id + mix(left, right, fk > 0.5 ? 0.78 : 0.2) + (rs - 0.5) * 0.08) * w;
    float top = h - 0.015 - 0.04 * hash21(vec2(id, 80.0 + fk));
    float len = min(0.09 + 0.12 * hash21(vec2(id, 90.0 + fk)), top - TOKYO_STREET - 0.035);
    float signCover;
    vec4 sign = tokyoSign(p, sx, top, len, sw, id * 3.0 + fk, t, px, signCover);
    // A soft spill of the sign's colour on the facade around it.
    float gap = max(abs(p.x - sx) - sw * 0.5, max(p.y - top, top - len - p.y));
    float spill = exp(-max(gap, 0.0) / 0.012) * 0.16 * tokyoNeon * (1.0 - signCover);
    if (spill > acc.a) {
      acc = vec4(sign.rgb, spill);
    }
    tokyoPaint(acc, sign.rgb, sign.a, signCover);
  }
  return acc;
}

float tokyoTrack(float x) {
  return 0.19 + 0.028 * sin(x * 2.4 + 0.9) + 0.01 * sin(x * 6.3);
}

// The elevated line: a beam on pillars, and a train gliding along it.
vec4 tokyoRail(vec2 p, float t, vec2 px, float span, out float cover) {
  cover = 0.0;
  float y0 = tokyoTrack(p.x);
  float beam = 0.012;
  vec4 acc = vec4(0.0);
  // Pillars down to the street.
  float pillar = tokyoPulse(p.x / 0.12, 0.0, 0.05, px.x / 0.12);
  if (p.y < y0 - beam && pillar > 0.3) {
    cover = 1.0;
    acc = vec4(vec3(0.42, 0.5, 0.72), 0.2);
  }
  if (p.y >= y0 - beam && p.y < y0) {
    cover = 1.0;
    float lip = step(y0 - px.y * 1.2, p.y);
    acc = vec4(vec3(0.5, 0.6, 0.85), mix(0.3, 0.55, lip));
  }
  // The train: six cars, a window strip and a blue line along the skirt.
  float carLen = 0.072;
  float cars = 6.0;
  float head = mod(t * 0.07 * tokyoTraffic + span * 0.62, span) - span * 0.5;
  float back = head - carLen * cars;
  float h = 0.024;
  if (p.x < head && p.x > back && p.y >= y0 && p.y < y0 + h) {
    float along = (head - p.x) / carLen;
    float joint = step(fract(along), 0.03) * step(0.5, along);
    float k = (p.y - y0) / h;
    // Round the nose of the lead car.
    float nose = (head - p.x) / (h * 0.9);
    if (nose < 1.0 && k > 0.35 + 0.65 * sqrt(max(0.0, 1.0 - nose))) {
      return acc;
    }
    if (joint > 0.5) {
      return acc;
    }
    cover = 1.0;
    float strip = step(0.45, k) * step(k, 0.8);
    float panes = tokyoPulse((head - p.x) / 0.011, 0.15, 0.85, px.x / 0.011);
    float skirt = step(k, 0.22);
    float lamp = step(head - p.x, h * 0.45) * step(0.25, k) * step(k, 0.5);
    vec3 body = vec3(0.82, 0.86, 0.92);
    vec3 col = mix(body, vec3(0.62, 0.84, 1.0), strip * panes);
    col = mix(col, vec3(0.1, 0.45, 1.0), skirt);
    col = mix(col, vec3(1.0, 0.98, 0.9), lamp);
    float tone = max(max(0.5, strip * panes), max(skirt * 0.82, lamp));
    acc = vec4(col, tone);
  }
  return acc;
}

// The street: cars in two lanes, a white light at the front of each and a
// red one at the back.
vec4 tokyoStreet(vec2 p, float t, vec2 px) {
  if (p.y > TOKYO_STREET) {
    return vec4(0.0);
  }
  float kerb = step(TOKYO_STREET - px.y * 1.2, p.y);
  vec4 acc = vec4(vec3(0.35, 0.42, 0.62), kerb * 0.22);
  for (int i = 0; i < 2; i++) {
    float lane = float(i);
    float y = 0.022 + lane * 0.024;
    if (abs(p.y - y) > 0.006) {
      continue;
    }
    float dir = lane > 0.5 ? -1.0 : 1.0;
    float x = p.x - dir * t * (0.11 + 0.04 * lane) * tokyoTraffic + lane * 3.1;
    float slot = 0.085;
    float id = floor(x / slot);
    float f = fract(x / slot);
    if (hash21(vec2(id, lane + 2.0)) < 0.4) {
      continue;
    }
    float len = 0.34;
    if (f > len) {
      continue;
    }
    float front = dir > 0.0 ? len - f : f;
    float back = dir > 0.0 ? f : len - f;
    float edge = px.x * 1.2 / slot;
    if (front < edge + 0.025) {
      acc = vec4(1.0, 0.96, 0.85, 0.95);
    } else if (back < edge + 0.025) {
      acc = vec4(1.0, 0.12, 0.1, 0.8);
    } else {
      acc = vec4(0.35, 0.42, 0.62, 0.18);
    }
  }
  return acc;
}

vec4 tokyoStars(vec2 p, float t, float pixel) {
  if (p.y < 0.5) {
    return vec4(0.0);
  }
  vec2 g = p / 0.045;
  vec2 id = floor(g);
  float r = hash21(id + 11.3);
  if (r < 0.93) {
    return vec4(0.0);
  }
  vec2 at = vec2(hash21(id + 1.7), hash21(id + 5.9)) * 0.7 + 0.15;
  // Cells are about 0.6 as wide as tall; measure in samples so a star
  // stays one glyph, not a cluster.
  vec2 off = (fract(g) - at) * 0.045;
  float d = length(vec2(off.x / 0.6, off.y));
  float twinkle = 0.6 + 0.4 * sin(t * (0.8 + r * 3.0) + r * 50.0);
  float star = step(d, pixel * 0.5) * twinkle * smoothstep(0.5, 0.62, p.y);
  // Dim enough to stay a single small glyph, bright enough for a Braille dot.
  return vec4(vec3(0.85, 0.9, 1.0), star * mix(0.5, 0.78, (r - 0.93) / 0.07));
}

vec2 tokyoCacheUv = vec2(-1.0);
float tokyoCacheT = -1.0;
vec4 tokyoCacheValue = vec4(0.0);

vec4 tokyoScene(vec2 uv, vec2 res, float t) {
  if (uv == tokyoCacheUv && t == tokyoCacheT) {
    return tokyoCacheValue;
  }
  float aspect = res.x / res.y;
  float pixel = 1.0 / res.y;
  // One sample's footprint. Glyph cells run about 0.6 wide to 1 tall and
  // charsets sample them 1x1 to 2x4, so 0.9 rows wide is a fair middle.
  vec2 px = vec2(pixel * 0.9, pixel);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * tokyoParallax;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float wide = clamp(aspect, 0.5, 1.8);
  float towerX = 0.11 * wide;
  float fujiX = -0.2 * wide;
  float span = aspect + 0.9;

  // Starlight white, so an empty sky never borrows a colour from below.
  vec4 acc = vec4(0.85, 0.9, 1.0, 0.0);
  vec4 star = tokyoStars(p + ptr * 0.004, t, pixel);
  tokyoPaint(acc, star.rgb, star.a, step(0.001, star.a));
  if (tokyoFujiOn > 0.5) {
    vec2 q = p + vec2(ptr.x * 0.008, 0.0) - vec2(fujiX, 0.0);
    vec4 fuji = tokyoFuji(q, pixel);
    tokyoPaint(acc, fuji.rgb, fuji.a, step(0.001, fuji.a));
  }
  float cover;
  vec2 pf = p + vec2(ptr.x * 0.014, ptr.y * 0.003);
  vec4 far = tokyoBlocks(pf, 0.034, 0.27, 0.37, 3.0, vec2(0.009, 0.013), 0.32, t, px, towerX, fujiX, tokyoFujiOn, cover);
  tokyoPaint(acc, mix(far.rgb, vec3(0.45, 0.6, 1.0), 0.45), far.a * 0.62, cover);
  vec2 pt = p + vec2(ptr.x * 0.022, ptr.y * 0.005) - vec2(towerX, 0.0);
  vec4 tower = tokyoTower(pt, t, px, cover);
  // A faint warm haze around the floodlit tower.
  float haze = exp(-max(abs(pt.x) - 0.02, 0.0) / 0.03) * smoothstep(0.86, 0.3, pt.y) * step(TOKYO_TOWER_BASE, pt.y) * 0.13;
  if (haze > max(acc.a, 0.02)) {
    acc = vec4(1.0, 0.45, 0.2, haze);
  }
  tokyoPaint(acc, tower.rgb, tower.a, cover);
  vec2 pm = p + vec2(ptr.x * 0.034, ptr.y * 0.008);
  vec4 mid = tokyoBlocks(pm + vec2(5.0, 0.0), 0.06, 0.2, 0.47, 9.0, vec2(0.014, 0.021), 0.48, t, px, towerX + 5.0, fujiX + 5.0, tokyoFujiOn, cover);
  tokyoPaint(acc, mid.rgb, mid.a, cover);
  vec2 pn = p + vec2(ptr.x * 0.055, ptr.y * 0.012);
  vec4 near = tokyoNear(pn, t, px, towerX, cover);
  tokyoPaint(acc, near.rgb, near.a, cover);
  vec2 pr = p + vec2(ptr.x * 0.07, ptr.y * 0.014);
  vec4 rail = tokyoRail(pr, t, px, span, cover);
  tokyoPaint(acc, rail.rgb, rail.a, cover);
  vec4 street = tokyoStreet(p + vec2(ptr.x * 0.08, 0.0), t, px);
  tokyoPaint(acc, street.rgb, street.a, step(0.001, street.a));

  // Near-black stays clean paper, so the sky and facades don't fill with noise.
  float tone = acc.a < 0.08 ? 0.0 : acc.a;
  tokyoCacheUv = uv;
  tokyoCacheT = t;
  tokyoCacheValue = vec4(acc.rgb, tone * tokyoIntensity);
  return tokyoCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return tokyoScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return tokyoScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#03050d";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Braille and quadrants light a dot only above the threshold, which would
// drop the dim facades, rooflines and Fuji. Dithering keeps them as sparse
// dots, so the far layers still read.
const DOT_CHARSETS: ReadonlySet<CharsetName> = new Set<CharsetName>([
  "braille",
  "quadrants",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to top, #03050d 0%, #0b1a3a 22%, #03050d 23%, #060b1c 40%, #03050d 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface TokyoProps extends AsciiSceneProps {
  /** How bright the scene is, from 0 (blank) to 1, so text on top stays readable. Default 1. */
  intensity?: number;
  /** How many vertical neon signs glow, and how brightly, from 0 (none) to 1. Default 1. */
  neon?: number;
  /** Speed of the train and the street traffic, from 0 (parked) to 2. Default 1. */
  traffic?: number;
  /** Mount Fuji on the horizon. Default `true`. */
  fuji?: boolean;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's night colour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a night gradient. */
  fallback?: ReactNode;
}

/**
 * Tokyo on a clear night. Tokyo Tower stands lit in the middle distance
 * among towers with lit windows, vertical neon signs flicker on the near
 * blocks, a train glides along a curving elevated line, and Mount Fuji's
 * snowy cone sits on the horizon under a few stars. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Tokyo = ({
  charset = "braille",
  colorMode,
  phosphor,
  paper,
  dither,
  cell = 10,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  intensity = 1,
  neon = 1,
  traffic = 1,
  fuji = true,
  fallback = FALLBACK,
  ...props
}: TokyoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        tokyoFujiOn: fuji ? 1 : 0,
        tokyoIntensity: clamp(intensity, 0, 1),
        tokyoNeon: clamp(neon, 0, 1),
        tokyoParallax: interactive ? 1 : 0,
        tokyoTraffic: clamp(traffic, 0, 2),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      dither={dither ?? (DOT_CHARSETS.has(charset) ? "bayer4" : "none")}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
