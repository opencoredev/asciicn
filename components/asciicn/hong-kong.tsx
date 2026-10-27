"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Victoria Harbour seen from Kowloon, painted back to front in one pass:
// stars, the ridge of Victoria Peak, towers stacked up its slopes, Central
// Plaza, the Bank of China Tower and Two IFC, the waterfront towers with
// their rooftop light shows, then the harbour. Below the waterline the
// skyline is drawn again, mirrored and pushed sideways by ripples, so the
// water reflects whatever is lit above it. The junk and the Star Ferry
// cross on top, and the searchlights and lasers come last. Units: y runs
// 0 (bottom of the water) to 1 (top of the sky), x is centred and measured
// in the same units, so shapes keep their proportions at any aspect.
// `hkScene` returns colour and tone, cached per sample.
const SCENE = `
const float HK_SEA = 0.3;
const float HK_IFC_H = 0.4;
const float HK_BOC_H = 0.33;
const float HK_PLAZA_H = 0.28;

// Integral of a 0/1 pulse that is on from a to b in every unit period.
float hkPulseSum(float x, float a, float b) {
  return floor(x) * (b - a) + clamp(fract(x) - a, 0.0, b - a);
}

// How much of a footprint fw wide, centred on x, the pulse covers, so thin
// repeating lines stay steady instead of shimmering in coarse charsets.
float hkPulse(float x, float a, float b, float fw) {
  float w = max(fw, 1e-4);
  return (hkPulseSum(x + w * 0.5, a, b) - hkPulseSum(x - w * 0.5, a, b)) / w;
}

// Lays a layer over what is behind it wherever it covers.
void hkPaint(inout vec4 acc, vec4 layer, float cover) {
  acc = mix(acc, layer, clamp(cover, 0.0, 1.0));
}

// Lit windows on a grid that changes slowly, one window at a time.
float hkWindows(vec2 q, vec2 size, vec2 px, float id, float lit, float t) {
  vec2 g = q / size;
  float on = hkPulse(g.x, 0.14, 0.84, px.x / size.x) * hkPulse(g.y, 0.2, 0.82, px.y / size.y);
  vec2 cell = floor(g);
  float seed = hash21(cell + id * 13.1);
  float epoch = floor(t * 0.05 + seed * 11.0);
  float state = hash21(cell * 1.3 + vec2(id * 0.7, epoch));
  return on * step(1.0 - lit, state) * (0.76 + 0.24 * hash21(cell + 5.1));
}

vec3 hkWindowColor(float r) {
  if (r < 0.5) {
    return vec3(1.0, 0.84, 0.58);
  }
  if (r < 0.84) {
    return vec3(0.84, 0.93, 1.0);
  }
  return vec3(0.45, 0.95, 0.86);
}

// The skyline of the island: Victoria Peak, with lower hills to the east.
float hkRidge(float x, float wide) {
  float a = (x + 0.06 * wide) / (0.34 * wide);
  float b = (x - 0.46 * wide) / (0.26 * wide);
  return HK_SEA + 0.07 + 0.24 * exp(-a * a) + 0.11 * exp(-b * b) + 0.011 * sin(x * 13.0 + 1.3) + 0.005 * sin(x * 31.0 + 0.4);
}

// The hill: a dark mass with a faint rim, scattered lamps up the slope and
// the bowl-roofed Peak Tower near the summit.
vec4 hkHill(vec2 p, float wide, float t, vec2 px, out float cover) {
  cover = 0.0;
  float top = hkRidge(p.x, wide);
  float peakX = -0.06 * wide;
  float dx = p.x - peakX;
  float base = hkRidge(peakX, wide) - 0.004;
  float k = dx / 0.024;
  float roof = 0.011 + 0.008 * k * k;
  float tower = 0.0;
  if (abs(k) < 1.0 && p.y > base && p.y < base + roof + px.y * 1.6) {
    float bowl = step(base + roof - px.y * 1.6, p.y);
    float block = step(abs(dx), 0.009) * step(p.y, base + 0.012);
    tower = max(bowl, block);
  }
  if (tower > 0.5) {
    cover = 1.0;
    return vec4(0.96, 0.95, 0.88, 0.86);
  }
  if (p.y > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  float rim = 1.0 - smoothstep(px.y * 0.8, px.y * 2.2, top - p.y);
  vec2 cellSize = vec2(0.012, 0.011);
  vec2 g = p / cellSize;
  vec2 id = floor(g);
  float h = clamp((p.y - HK_SEA) / max(top - HK_SEA, 0.01), 0.0, 1.0);
  vec2 at = vec2(hash21(id + 1.1), hash21(id + 2.3)) * 0.6 + 0.2;
  float d = length((fract(g) - at) * cellSize);
  float density = 0.6 * (1.0 - h * h);
  float lamp = step(1.0 - density, hash21(id + 3.7)) * step(d, px.y * 0.85);
  lamp *= 0.75 + 0.25 * sin(t * 1.7 + hash21(id) * 40.0);
  vec3 col = mix(vec3(0.32, 0.42, 0.75), vec3(1.0, 0.82, 0.55), step(0.01, lamp));
  return vec4(col, max(rim * 0.56, lamp * 0.72));
}

// Slim residential towers stacked up the slopes. Their tops follow the
// ridge, between lo and hi of the way from the water to the crest.
vec4 hkSlope(vec2 p, float wide, float w, float seed, float lo, float hi, float lit, float t, vec2 px, out float cover) {
  cover = 0.0;
  float xs = (p.x + seed) / w;
  float id = floor(xs);
  float f = fract(xs);
  float r1 = hash21(vec2(id, seed));
  float r2 = hash21(vec2(id, seed + 3.7));
  if (r1 < 0.1 || f < 0.06 + r2 * 0.14 || f > 0.94) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w - seed;
  float ridge = hkRidge(cx, wide);
  float top = HK_SEA + (ridge - HK_SEA) * mix(lo, hi, r1);
  if (p.y > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 q = vec2(p.x + seed - (id + 0.06 + r2 * 0.14) * w, p.y);
  float glass = hkWindows(q, vec2(0.008, 0.011), px, id + seed, lit, t);
  float roof = 1.0 - smoothstep(px.y * 0.6, px.y * 1.6, top - p.y);
  vec3 col = mix(vec3(0.34, 0.46, 0.82), hkWindowColor(r2), step(0.2, glass));
  return vec4(col, max(glass * 0.88, roof * 0.3));
}

// The waterfront: a dense row of towers, kept low around the landmarks.
// Some carry a band of animated light on the roof, others a strip of LEDs
// running up one edge, as in the nightly light show.
vec4 hkFront(vec2 p, float t, vec2 px, vec3 marks, out float cover) {
  cover = 0.0;
  float w = 0.036;
  float xs = p.x / w;
  float id = floor(xs);
  float f = fract(xs);
  float r1 = hash21(vec2(id, 61.0));
  float r2 = hash21(vec2(id, 67.3));
  float r3 = hash21(vec2(id, 71.9));
  float left = 0.03 + r2 * 0.1;
  float right = 0.97 - r3 * 0.08;
  if (f < left || f > right) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w;
  float h = 0.08 + 0.17 * pow(r1, 1.2);
  float clear = min(abs(cx - marks.x), min(abs(cx - marks.y), abs(cx - marks.z)));
  h = mix(min(h, 0.06), h, smoothstep(0.04, 0.08, clear));
  float top = HK_SEA + h;
  if (p.y > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 q = vec2(p.x - (id + left) * w, p.y);
  float glass = hkWindows(q, vec2(0.011, 0.015), px, id + 90.0, 0.66, t);
  float roof = 1.0 - smoothstep(px.y * 0.6, px.y * 1.6, top - p.y);
  vec4 acc = vec4(mix(vec3(0.36, 0.48, 0.84), hkWindowColor(r3), step(0.2, glass)), max(glass * 0.92, roof * 0.3));
  float band = top - p.y;
  if (r3 > 0.42 && band < 0.016 && hkLights > 0.0) {
    float x = p.x / 0.005;
    float mode = floor(r2 * 3.0);
    float on = 0.6 + 0.4 * sin(t * 2.0 + x * 0.35);
    if (mode < 1.0) {
      on = hkPulse(x * 0.25 - t * 1.2, 0.0, 0.5, px.x / 0.02);
    } else if (mode < 2.0) {
      on = hkPulse(band / 0.0055 + t * 0.9, 0.0, 0.55, px.y / 0.0055);
    }
    vec3 led = spectrum(fract(r1 * 2.0 + t * 0.03 + floor(t * 0.2 + r3 * 4.0) * 0.21));
    acc = vec4(mix(led, vec3(1.0), on * 0.25), mix(0.3, 0.96, on) * hkLights);
  }
  float edge = min(f - left, right - f) * w;
  if (r2 > 0.58 && edge < px.x * 1.2 && band > 0.016 && hkLights > 0.0) {
    float run = smoothstep(0.0, 0.6, fract(p.y / 0.07 - t * 0.45 + r1 * 3.0));
    acc = vec4(spectrum(fract(r2 * 5.0 + t * 0.04)), mix(0.3, 0.9, run) * hkLights);
  }
  return acc;
}

// Two IFC: a pale shaft with lit vertical mullions, three setbacks and an
// open crown of fins.
vec4 hkIfc(vec2 p, float t, vec2 px, out float cover) {
  cover = 0.0;
  float H = HK_IFC_H;
  float s = (p.y - HK_SEA) / H;
  if (s < 0.0 || s > 1.06) {
    return vec4(0.0);
  }
  float hw = H * 0.072;
  hw *= s > 0.62 ? 0.9 : 1.0;
  hw *= s > 0.78 ? 0.88 : 1.0;
  hw *= s > 0.89 ? 0.84 : 1.0;
  float a = abs(p.x) / hw;
  if (a > 1.0) {
    return vec4(0.0);
  }
  float glow = 0.85 + 0.15 * sin(t * 0.7);
  if (s > 0.95) {
    float corner = step(0.72, a) * step(s, 1.06);
    float inner = step(0.32, a) * step(a, 0.5) * step(s, 1.02);
    if (max(corner, inner) < 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.95, 0.97, 1.0, 0.96 * glow);
  }
  cover = 1.0;
  float lw = px.x / hw;
  float mullion = hkPulse(a / 0.34, 0.0, 0.62, lw / 0.34);
  // Caps keep outlines from swallowing the facade when one sample covers
  // a large share of the tower, as in blocks or standard.
  float edge = step(1.0 - min(lw * 1.2, 0.2), a);
  float ledge = 0.0;
  float lh = min(px.y * 1.1 / H, 0.025);
  ledge = max(ledge, step(abs(s - 0.62), lh));
  ledge = max(ledge, step(abs(s - 0.78), lh));
  ledge = max(ledge, step(abs(s - 0.89), lh));
  float floors = hkWindows(vec2(p.x + 3.0, p.y), vec2(hw * 0.68, 0.011), px, 7.0, 0.35, t);
  float line = max(max(mullion * 0.74, edge * 0.92), ledge);
  vec3 col = mix(vec3(0.5, 0.68, 1.0), vec3(0.9, 0.96, 1.0), max(line, floors));
  return vec4(col, max(0.3, max(line, floors * 0.96)) * mix(1.0, glow, ledge));
}

// The Bank of China Tower: a prism braced with great white X frames, its
// top cut in sloping wedges, with two masts on the high corner.
vec4 hkBoc(vec2 p, float t, vec2 px, out float cover) {
  cover = 0.0;
  float H = HK_BOC_H;
  float hw = 0.034;
  float y = p.y - HK_SEA;
  float a = p.x / hw;
  float lw = px.x / hw;
  if (y < 0.0 || abs(a) > 1.0 + lw) {
    return vec4(0.0);
  }
  float top = a < 0.0 ? H * (0.5 + 0.22 * (a + 1.0)) : H * (0.78 + 0.22 * a);
  if (y > top) {
    float mast1 = step(abs(a - 0.8) * hw, px.x * 0.6) * step(y, H * 1.17);
    float mast2 = step(abs(a - 0.96) * hw, px.x * 0.6) * step(y, H * 1.11);
    float mast = max(mast1, mast2);
    if (mast < 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    float tipY = mast1 > 0.5 ? H * 1.17 : H * 1.11;
    float blink = step(0.5, fract(t * 0.5 + mast1 * 0.25));
    float tip = step(tipY - px.y * 2.0, y) * blink;
    return mix(vec4(0.8, 0.86, 0.95, 0.6), vec4(1.0, 0.15, 0.1, 1.0), tip);
  }
  cover = 1.0;
  // Square modules, so the braces run at 45 degrees.
  float mh = 2.0 * hw;
  float fy = fract(y / mh);
  float dw = min(lw * 1.5, 0.3);
  float diag = max(step(abs(a - (2.0 * fy - 1.0)), dw), step(abs(a + (2.0 * fy - 1.0)), dw));
  float rows = step(min(fy, 1.0 - fy) * mh, min(px.y * 0.7, mh * 0.08));
  float spine = max(step(abs(a), min(lw * 0.6, 0.1)), step(1.0 - min(lw * 1.1, 0.16), abs(a)));
  float roofLine = step(top - y, min(px.y * 1.5, H * 0.03));
  float frame = max(max(diag, rows), max(spine, roofLine));
  float glass = hkWindows(vec2(p.x + 5.0, y), vec2(hw * 0.25, 0.011), px, 3.0, 0.32, t);
  vec3 col = mix(vec3(0.28, 0.44, 0.86), vec3(0.95, 0.97, 1.0), max(frame, glass * 0.6));
  return vec4(col, max(mix(0.34, 0.98, frame), glass * 0.62));
}

// Central Plaza: a gold-lit shaft whose crown changes colour like a
// clock, under a glass pyramid and a mast.
vec4 hkPlaza(vec2 p, float t, vec2 px, out float cover) {
  cover = 0.0;
  float H = HK_PLAZA_H;
  float hw = 0.022;
  float y = p.y - HK_SEA;
  float s = y / H;
  if (s < 0.0 || s > 1.18 || abs(p.x) > hw) {
    return vec4(0.0);
  }
  if (s > 0.9) {
    float pyramid = 1.0 - (s - 0.9) / 0.12;
    float mast = step(abs(p.x), px.x * 0.6) * step(s, 1.18);
    if (abs(p.x) > hw * pyramid && mast < 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    float tip = step(1.16, s) * step(0.5, fract(t * 0.5 + 0.3));
    return mix(vec4(1.0, 0.86, 0.55, 0.78), vec4(1.0, 0.15, 0.1, 1.0), tip);
  }
  cover = 1.0;
  float slot = mod(floor(t / 6.0), 5.0);
  vec3 clock = slot < 1.0 ? vec3(1.0, 0.2, 0.25) : slot < 2.0 ? vec3(1.0, 0.95, 0.9) : slot < 3.0 ? vec3(1.0, 0.8, 0.2) : slot < 4.0 ? vec3(1.0, 0.4, 0.8) : vec3(0.6, 0.4, 1.0);
  if (s > 0.8) {
    float rows = hkPulse(y / 0.011, 0.0, 0.6, px.y / 0.011);
    return vec4(clock, mix(0.45, 0.95, rows) * mix(0.5, 1.0, hkLights));
  }
  float edge = step(hw - px.x * 1.2, abs(p.x));
  float glass = hkWindows(vec2(p.x + 9.0, y), vec2(0.0088, 0.011), px, 11.0, 0.62, t);
  vec3 col = mix(vec3(0.62, 0.5, 0.32), vec3(1.0, 0.82, 0.48), max(glass, edge));
  return vec4(col, max(0.36, max(glass * 0.86, edge * 0.8)));
}

// Street lamps along the waterfront road.
vec4 hkShore(vec2 p, vec2 px) {
  float y = p.y - HK_SEA;
  if (y < 0.0 || y > 0.007) {
    return vec4(0.0);
  }
  float lamp = hkPulse(p.x / 0.016, 0.0, 0.4, px.x / 0.016);
  return vec4(1.0, 0.86, 0.6, max(0.4, lamp * 0.9));
}

// Everything above the waterline except the stars, so the harbour can
// mirror it.
void hkSkyline(inout vec4 acc, vec2 p, vec2 ptr, float wide, float t, vec2 px) {
  float cover;
  vec4 hill = hkHill(p + vec2(ptr.x * 0.008, ptr.y * 0.002), wide, t, px, cover);
  hkPaint(acc, hill, cover);
  vec2 pf = p + vec2(ptr.x * 0.014, ptr.y * 0.003);
  vec4 far = hkSlope(pf, wide, 0.016, 41.0, 0.6, 0.9, 0.58, t, px, cover);
  hkPaint(acc, vec4(mix(far.rgb, vec3(0.45, 0.6, 1.0), 0.35), far.a * 0.9), cover);
  vec2 ps = p + vec2(ptr.x * 0.02, ptr.y * 0.004);
  vec4 slope = hkSlope(ps, wide, 0.022, 7.0, 0.32, 0.62, 0.7, t, px, cover);
  hkPaint(acc, slope, cover);
  vec2 pl = p + vec2(ptr.x * 0.028, ptr.y * 0.006);
  vec3 marks = vec3(-0.32, 0.05, 0.3) * wide;
  vec4 plaza = hkPlaza(pl - vec2(marks.z, 0.0), t, px, cover);
  hkPaint(acc, plaza, cover);
  vec4 boc = hkBoc(pl - vec2(marks.y, 0.0), t, px, cover);
  hkPaint(acc, boc, cover);
  vec4 ifc = hkIfc(pl - vec2(marks.x, 0.0), t, px, cover);
  hkPaint(acc, ifc, cover);
  vec2 pn = p + vec2(ptr.x * 0.04, ptr.y * 0.008);
  vec4 front = hkFront(pn, t, px, marks, cover);
  hkPaint(acc, front, cover);
  vec4 shore = hkShore(pn, px);
  hkPaint(acc, shore, step(0.001, shore.a));
}

// One battened junk sail behind its mast, fanning out to a rounded back
// edge. Returns coverage; batten is 1 on the darker ribs.
float hkSail(vec2 q, float mx, float base, float h, float w, vec2 px, out float batten) {
  batten = 0.0;
  float sx = (mx - q.x) / w;
  float sy = (q.y - base) / h;
  if (sy < 0.0 || sy > 1.0) {
    return 0.0;
  }
  float leech = 0.8 + 0.28 * sin(3.14159 * sy);
  float head = 0.74 + 0.26 * clamp(sx, 0.0, 1.0);
  if (sx < -0.16 || sx > leech || sy > head) {
    return 0.0;
  }
  float bh = h / 6.0;
  batten = hkPulse((q.y - base) / bh, 0.0, 0.2, px.y / bh);
  return 1.0;
}

// A junk under three red sails, sailing right. q is relative to the middle
// of the waterline.
vec4 hkJunk(vec2 q, vec2 px, out float cover) {
  cover = 0.0;
  if (abs(q.x) > 0.1 || q.y < -0.006 || q.y > 0.11) {
    return vec4(0.0);
  }
  vec4 acc = vec4(0.0);
  float b;
  float s1 = hkSail(q, -0.03, 0.018, 0.056, 0.024, px, b);
  hkPaint(acc, vec4(mix(vec3(0.95, 0.2, 0.14), vec3(0.5, 0.08, 0.06), b), mix(0.66, 0.3, b)), s1);
  cover = max(cover, s1);
  float s2 = hkSail(q, 0.012, 0.015, 0.084, 0.034, px, b);
  hkPaint(acc, vec4(mix(vec3(1.0, 0.24, 0.16), vec3(0.5, 0.08, 0.06), b), mix(0.72, 0.3, b)), s2);
  cover = max(cover, s2);
  float s3 = hkSail(q, 0.05, 0.018, 0.058, 0.026, px, b);
  hkPaint(acc, vec4(mix(vec3(0.95, 0.2, 0.14), vec3(0.5, 0.08, 0.06), b), mix(0.66, 0.3, b)), s3);
  cover = max(cover, s3);
  // Masts.
  float mast = 0.0;
  mast = max(mast, step(abs(q.x + 0.03), px.x * 0.6) * step(q.y, 0.078));
  mast = max(mast, step(abs(q.x - 0.012), px.x * 0.6) * step(q.y, 0.104));
  mast = max(mast, step(abs(q.x - 0.05), px.x * 0.6) * step(q.y, 0.08));
  hkPaint(acc, vec4(0.72, 0.5, 0.36, 0.5), mast * step(0.0, q.y));
  cover = max(cover, mast * step(0.0, q.y));
  // The hull, its deck sweeping up to a high stern.
  float k = q.x / 0.064;
  if (abs(k) < 1.0) {
    float deck = 0.011 + 0.013 * smoothstep(-0.35, -1.0, k) + 0.005 * smoothstep(0.55, 1.0, k);
    float keel = -0.005 * (1.0 - k * k);
    if (q.y < deck && q.y > keel) {
      float rail = step(deck - px.y * 1.3, q.y);
      float lamp = hkPulse(q.x / 0.012, 0.0, 0.3, px.x / 0.012) * step(abs(q.y - 0.004), px.y * 0.8);
      vec3 col = mix(vec3(0.6, 0.32, 0.2), vec3(1.0, 0.82, 0.55), max(rail * 0.7, lamp));
      hkPaint(acc, vec4(col, max(0.5, max(rail * 0.78, lamp * 0.92))), 1.0);
      cover = 1.0;
    }
  }
  return acc;
}

// A Star Ferry heading left: a green hull, two white decks of lit windows,
// round at both ends.
vec4 hkFerry(vec2 q, float t, vec2 px, out float cover) {
  cover = 0.0;
  float L = 0.075;
  float k = abs(q.x) / L;
  if (k > 1.0 || q.y < -0.005 || q.y > 0.05) {
    return vec4(0.0);
  }
  float end = smoothstep(0.84, 1.0, k);
  float hullTop = 0.012 - 0.007 * end;
  float hullBottom = -0.005 + 0.004 * end;
  if (q.y > hullBottom && q.y < hullTop) {
    cover = 1.0;
    float stripe = step(hullTop - px.y * 1.3, q.y);
    return vec4(mix(vec3(0.1, 0.72, 0.38), vec3(0.95, 0.98, 0.95), stripe), mix(0.56, 0.86, stripe));
  }
  vec4 acc = vec4(0.0);
  float deck1 = step(k, 0.86) * step(0.012, q.y) * step(q.y, 0.024);
  float deck2 = step(k, 0.7) * step(0.024, q.y) * step(q.y, 0.034);
  float roof = step(k, 0.74) * step(0.034, q.y) * step(q.y, 0.037);
  if (deck1 + deck2 > 0.5) {
    cover = 1.0;
    float floorY = deck1 > 0.5 ? 0.012 : 0.024;
    float band = (q.y - floorY) / 0.012;
    float panes = hkPulse(q.x / 0.008, 0.15, 0.8, px.x / 0.008) * step(0.25, band) * step(band, 0.8);
    float flicker = 0.85 + 0.15 * sin(t * 3.0 + q.x * 90.0);
    acc = vec4(mix(vec3(0.92, 0.96, 0.92), vec3(1.0, 0.84, 0.52), panes), max(0.5, panes * 0.95 * flicker));
  } else if (roof > 0.5) {
    cover = 1.0;
    acc = vec4(0.18, 0.78, 0.44, 0.62);
  } else if (abs(q.x) < px.x * 0.6 && q.y < 0.05) {
    cover = 1.0;
    float tip = step(0.05 - px.y * 2.0, q.y);
    acc = vec4(mix(vec3(0.8, 0.86, 0.9), vec3(1.0), tip), mix(0.45, 1.0, tip));
  }
  return acc;
}

// Both boats, in water coordinates.
void hkBoatsAt(inout vec4 acc, vec2 p, float t, vec2 px, float span, float bob) {
  float cover;
  // The junk is further out than the ferry, so it is scaled up less.
  float jx = mod(t * 0.012 + span * 0.32, span) - span * 0.5;
  vec4 junk = hkJunk(vec2(p.x - jx, p.y - 0.15 - bob) / 1.4, px / 1.4, cover);
  hkPaint(acc, junk, cover);
  float fx = span * 0.5 - mod(t * 0.02 + span * 0.28, span);
  vec4 ferry = hkFerry(vec2(p.x - fx, p.y - 0.06 + bob * 0.7) / 1.5, t, px / 1.5, cover);
  hkPaint(acc, ferry, cover);
}

// A beam from a rooftop. Wide ones are searchlights that spread and fade;
// narrow ones are lasers that hold their width.
vec4 hkBeam(vec2 p, vec2 o, float ang, float spread, vec3 col, float env, vec2 px) {
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 v = p - o;
  float along = dot(v, d);
  if (along < 0.0 || env <= 0.0) {
    return vec4(0.0);
  }
  float perp = abs(v.x * d.y - v.y * d.x);
  float w = max(px.y * 0.9, 0.002 + along * spread);
  float core = 1.0 - smoothstep(w * 0.45, w, perp);
  float fade = exp(-along * (spread > 0.0 ? 1.4 : 0.9));
  return vec4(col, core * fade * env * (spread > 0.0 ? 0.66 : 0.9));
}

vec4 hkStars(vec2 p, float t, float pixel) {
  if (p.y < 0.6) {
    return vec4(0.0);
  }
  vec2 g = p / 0.05;
  vec2 id = floor(g);
  float r = hash21(id + 19.3);
  if (r < 0.9) {
    return vec4(0.0);
  }
  vec2 at = vec2(hash21(id + 1.7), hash21(id + 5.9)) * 0.7 + 0.15;
  float d = length((fract(g) - at) * 0.05);
  float twinkle = 0.6 + 0.4 * sin(t * (0.8 + r * 3.0) + r * 50.0);
  float star = step(d, pixel * 0.75) * twinkle * smoothstep(0.6, 0.72, p.y);
  return vec4(vec3(0.82, 0.88, 1.0), star * mix(0.55, 0.9, r));
}

vec2 hkCacheUv = vec2(-1.0);
float hkCacheT = -1.0;
vec4 hkCacheValue = vec4(0.0);

vec4 hkScene(vec2 uv, vec2 res, float t) {
  if (uv == hkCacheUv && t == hkCacheT) {
    return hkCacheValue;
  }
  float aspect = res.x / res.y;
  float pixel = 1.0 / res.y;
  // One sample's footprint. Glyph cells run about 0.6 wide to 1 tall and
  // charsets sample them 1x1 to 2x4, so 0.9 rows wide is a fair middle.
  vec2 px = vec2(pixel * 0.9, pixel);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * hkParallax;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  float wide = clamp(aspect, 0.5, 1.8);
  float span = aspect + 0.3;
  float bob = 0.0012 * sin(t * 1.3);

  vec4 acc = vec4(0.0);
  if (p.y >= HK_SEA) {
    vec4 star = hkStars(p + ptr * 0.004, t, pixel);
    hkPaint(acc, star, step(0.001, star.a));
    hkSkyline(acc, p, ptr, wide, t, px);
  } else {
    // The harbour mirrors the skyline. Ripple bands crowd together toward
    // the far shore, and each one pushes the reflection sideways.
    float d = HK_SEA - p.y;
    float depth = d / HK_SEA;
    float phase = log(d + 0.004) * 40.0;
    float wobble = sin(phase + t * 1.2 + 2.0 * snoise(vec2(p.x * 4.0, phase * 0.3)));
    vec2 q = vec2(
      p.x + hkWaves * (0.002 + 0.012 * depth) * wobble,
      HK_SEA + d * 0.85 + hkWaves * 0.003 * depth * sin(phase * 1.7 - t)
    );
    vec4 mirror = vec4(0.0);
    hkSkyline(mirror, q, ptr, wide, t, px);
    // Dark troughs between the swells cut the mirror into horizontal
    // dashes, so only bright lights carry down into the water.
    float n = snoise(vec2(p.x * 5.0 / (0.3 + depth), phase * 0.5 - t * 0.15));
    float trough = hkPulse(phase * 0.5 + 0.3 * n - t * 0.4, 0.0, 0.62, 20.0 * px.y / (d + 0.004));
    float streak = smoothstep(-0.55, 0.15, n + 0.2 * sin(phase * 2.0 + t * 1.1)) * mix(0.35, 1.0, trough);
    float calm = mix(1.0, streak, clamp(hkWaves, 0.0, 1.0));
    acc = vec4(min(mirror.rgb * vec3(0.78, 0.9, 1.12), 1.0), mirror.a * mix(1.0, 0.72, depth) * calm);
    if (hkBoats > 0.5) {
      // The boats' own reflections, under their hulls.
      vec4 boats = vec4(0.0);
      vec2 b = vec2(q.x, p.y);
      float jy = 0.15 + bob;
      float fy = 0.06 - bob * 0.7;
      if (p.y < jy && p.y > jy - 0.08) {
        hkBoatsAt(boats, vec2(b.x, 2.0 * jy - p.y), t, px, span, bob);
      } else if (p.y < fy) {
        hkBoatsAt(boats, vec2(b.x, 2.0 * fy - p.y), t, px, span, bob);
      }
      float shine = boats.a * 0.5 * calm;
      if (shine > acc.a) {
        acc = vec4(boats.rgb, shine);
      }
    }
  }
  if (hkBoats > 0.5) {
    hkBoatsAt(acc, p, t, px, span, bob);
  }

  // Searchlights and lasers switch on now and then and sweep the sky and
  // the water.
  if (hkLights > 0.0) {
    vec3 marks = vec3(-0.32, 0.05, 0.3) * wide;
    vec2 pl = p + vec2(ptr.x * 0.028, ptr.y * 0.006);
    for (int i = 0; i < 4; i++) {
      float k = float(i);
      float c = fract(t * 0.035 + k * 0.23);
      float env = smoothstep(0.0, 0.04, c) * (1.0 - smoothstep(0.4, 0.46, c)) * hkLights;
      vec2 o = vec2(marks.x, HK_SEA + HK_IFC_H * 1.06);
      float ang = 1.5708 + 0.55 * sin(t * 0.25);
      float spread = 0.06;
      vec3 col = vec3(0.85, 0.92, 1.0);
      if (i == 1) {
        o = vec2(marks.y + 0.8 * 0.034, HK_SEA + HK_BOC_H * 1.17);
        ang = -1.5708 + 1.25 * sin(t * 0.22 + 1.0);
        spread = 0.0;
        col = vec3(0.3, 1.0, 0.55);
      } else if (i == 2) {
        o = vec2(marks.z, HK_SEA + HK_PLAZA_H * 1.18);
        ang = 1.5708 + 1.2 * sin(t * 0.3 + 2.0);
        spread = 0.0;
        col = vec3(0.75, 0.4, 1.0);
      } else if (i == 3) {
        o = vec2(-0.1 * wide, HK_SEA + 0.22);
        ang = 1.5708 + 0.6 * sin(t * 0.2 + 4.0);
        col = vec3(0.5, 0.9, 1.0);
      }
      vec4 beam = hkBeam(pl, o, ang, spread, col, env, px);
      if (beam.a > acc.a * 0.6) {
        acc = vec4(mix(acc.rgb, beam.rgb, 0.8), max(acc.a, beam.a));
      }
    }
  }

  // Near-black stays clean paper, so the sky and water don't fill with noise.
  float tone = acc.a < 0.08 ? 0.0 : acc.a;
  hkCacheUv = uv;
  hkCacheT = t;
  // Intensity dims the colour as well as the tone, so a quieter scene
  // reads as darker rather than only sparser.
  hkCacheValue = vec4(acc.rgb * mix(0.45, 1.0, hkIntensity), tone * hkIntensity);
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

// Modes that paint the scene's own colours need its deep blue night behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const NIGHT = "#030818";
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
        "linear-gradient(to top, #030818 0%, #0a1a40 26%, #10224d 27%, #050b22 45%, #030818 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface HongKongProps extends AsciiSceneProps {
  /** How bright the scene is, from 0 (blank) to 1, so text on top stays readable. Default 1. */
  intensity?: number;
  /** The light show: rooftop displays, LED strips, searchlights and lasers, from 0 (off) to 1. Default 1. */
  lights?: number;
  /** How much the harbour ripples, from 0 (a still mirror) to 2. Default 1. */
  waves?: number;
  /** The junk and the Star Ferry crossing the harbour. Default `true`. */
  boats?: boolean;
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
 * Hong Kong. Victoria Harbour at night, seen from Kowloon: towers stacked
 * up the slopes under Victoria Peak, the Bank of China Tower and Two IFC,
 * rooftop light shows and sweeping beams, all mirrored in the rippling
 * water while a red-sailed junk and a Star Ferry cross. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const HongKong = ({
  charset = "braille",
  colorMode,
  phosphor,
  paper,
  cell = 10,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  intensity = 1,
  lights = 1,
  waves = 1,
  boats = true,
  threshold,
  fallback = FALLBACK,
  ...props
}: HongKongProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const level = clamp(intensity, 0, 1);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        hkBoats: boats ? 1 : 0,
        hkIntensity: level,
        hkLights: clamp(lights, 0, 1),
        hkParallax: interactive ? 1 : 0,
        hkWaves: clamp(waves, 0, 2),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      // Braille and quadrants light a dot above the threshold. Lowering it
      // with intensity keeps the skyline whole when the scene is dimmed.
      threshold={threshold ?? 0.5 * (0.5 + 0.5 * level)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
