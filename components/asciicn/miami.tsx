"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Ocean Drive at nightfall, seen from the bay and painted in dots: every
// sample returns a colour and a tone, and the tone only sets how big the dot
// is. Layers are tested near to far: the beach and the promenade, the palms,
// the art deco hotels, two layers of Brickell towers, then the sky. Rows
// below `miWaterRow` are the bay, which reads the same layers mirrored.
// `s` is a whole sample (column, row from the bottom) and `p` the same point
// in box heights. The hotels are built on whole samples, so their stepped
// parapets and neon trim land on clean rows and columns of dots, and they
// keep their size on any box: a phone shows fewer of them, not squashed ones.
const SCENE = `
const float MI_WATER = 0.16;
const float MI_SAND = 0.026;
const float MI_SLOT = 0.22;

// Set once per sample by miScene and read by every layer.
float miSw;
float miSh;
float miT;
float miAspect;
float miMid;
float miWide;
float miWaterRow;
float miWaterY;
float miGroundRow;
float miGroundY;
float miSlotN;
float miSlot0;
float miCluster;
float miCluster2;
vec2 miMoon;

// A stable random value for whole-sample inputs. The engine's hash21
// repeats every 50 samples on integers, which shows up as tiled stars.
float miHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float miRows(float v) {
  return floor(v / miSh + 0.5);
}

// How close x is to the middle of a wide box, where the headline sits: 1 in
// the middle, 0 at the sides and on tall boxes.
float miCentre(float x) {
  return miWide * (1.0 - smoothstep(0.12, 0.3, abs(x - miMid) / miAspect));
}

// Most windows keep their state. One in four turns on or off every couple
// of minutes, fading over three seconds, so the street changes slowly.
float miLit(vec2 id, float chance) {
  if (miHash(id) > 0.25) {
    return step(1.0 - chance, miHash(id + 7.1));
  }
  float period = 80.0 + 110.0 * miHash(id + 3.3);
  float phase = miT / period + miHash(id + 5.5);
  float k = floor(phase);
  float now = step(1.0 - chance, miHash(id + k * 1.37));
  float before = step(1.0 - chance, miHash(id + (k - 1.0) * 1.37));
  return mix(before, now, smoothstep(0.0, 3.0 / period, fract(phase)));
}

// The neon of one hotel: pink, teal or amber.
vec3 miNeonCol(float i) {
  float k = floor(miHash(vec2(i, 6.6)) * 3.0);
  if (k < 0.5) {
    return vec3(1.0, 0.38, 0.72);
  }
  if (k < 1.5) {
    return vec3(0.32, 0.96, 0.88);
  }
  return vec3(1.0, 0.74, 0.34);
}

// The facade of one hotel: a pastel, deepened by the dusk.
vec3 miPastel(float i) {
  float k = floor(miHash(vec2(i, 9.4)) * 6.0);
  vec3 c = vec3(0.94, 0.92, 1.0);
  if (k > 0.5) {
    c = vec3(0.46, 0.94, 0.8);
  }
  if (k > 1.5) {
    c = vec3(1.0, 0.88, 0.52);
  }
  if (k > 2.5) {
    c = vec3(0.74, 0.62, 1.0);
  }
  if (k > 3.5) {
    c = vec3(1.0, 0.7, 0.52);
  }
  if (k > 4.5) {
    c = vec3(0.48, 0.82, 1.0);
  }
  return mix(c * 0.8, vec3(0.42, 0.28, 0.62), 0.12);
}

// Each hotel's neon breathes on its own slow cycle.
float miBreath(float i) {
  float h = miHash(vec2(i, 2.2));
  return miNeon * (0.8 + 0.2 * sin(miT * (0.4 + 0.25 * h) + h * 6.28));
}

// The shape of hotel i, in samples: half width W either side of its centre
// column, body height hb, the two stepped tiers r1 and r2 of its parapet,
// and the spire or blade sign on top. Types: 0 a stepped pylon with a spire, 1 a
// pylon with a neon name sign, 2 one step and a vertical blade sign.
// Hotels behind the headline stand a little lower and lose their spires.
void miHotelShape(float i, out float W, out float hb, out float r1, out float r2, out float spire, out float type) {
  float h1 = miHash(vec2(i, 3.1));
  float h2 = miHash(vec2(i, 5.7));
  float h3 = miHash(vec2(i, 8.3));
  float half_ = floor(miSlotN * 0.5);
  float cen = miCentre((miSlot0 + i * miSlotN + half_ + 0.5) * miSw);
  W = half_ - 2.0 - floor(h1 * half_ * 0.25);
  hb = miRows((0.1 + 0.045 * h2) * (1.0 - 0.3 * cen));
  r1 = max(2.0, miRows(0.014 + 0.006 * h3));
  r2 = max(4.0, miRows((0.03 + 0.012 * h1) * (1.0 - 0.3 * cen)));
  spire = max(3.0, miRows((0.026 + 0.02 * h2) * (1.0 - 0.6 * cen)));
  type = floor(h3 * 2.999);
}

// Rows above the ground to the top of hotel i at jx columns from its centre,
// or -1 outside it.
float miRoof(float jx, float W, float hb, float r1, float r2, float spire, float type) {
  if (jx > W) {
    return -1.0;
  }
  float top = hb;
  if (jx <= floor(W * 0.5)) {
    top += r1;
  }
  if (type < 1.5 && jx <= floor(W * 0.18)) {
    top += r2;
  }
  if (type < 0.5 && jx < 0.5) {
    top += spire;
  }
  if (type > 1.5 && jx < 1.5) {
    top += r2 + spire;
  }
  return top;
}

vec4 miHotel(vec2 s, out float cover) {
  cover = 0.0;
  float ry = s.y - miGroundRow;
  if (ry < 0.0) {
    return vec4(0.0);
  }
  float i = floor((s.x - miSlot0) / miSlotN);
  float c = miSlot0 + i * miSlotN + floor(miSlotN * 0.5);
  float jx = abs(s.x - c);
  float W;
  float hb;
  float r1;
  float r2;
  float spire;
  float type;
  miHotelShape(i, W, hb, r1, r2, spire, type);
  float roof = miRoof(jx, W, hb, r1, r2, spire, type);
  if (ry >= roof) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec3 neonC = miNeonCol(i);
  float glow = miBreath(i);
  // The facade is washed with light from the street, as Ocean Drive's
  // hotels are at night: brightest low down and fading up the wall, warmed
  // over the arcade, tinged by its own neon near the top, never quite even.
  vec3 wall = miPastel(i);
  float up = 1.0 - smoothstep(0.0, roof, ry);
  wall *= mix(0.8, 1.08, up);
  wall = mix(wall, vec3(1.0, 0.76, 0.52), 0.3 * exp(-max(ry - 3.0, 0.0) / 3.0));
  float wt = mix(0.44, 0.6, up);
  wall = mix(wall, neonC * 0.6, 0.25 * glow * smoothstep(hb - 4.0, hb + r1, ry));
  wall *= 0.92 + 0.14 * miHash(s + 0.71);
  vec3 neonLine = mix(wall * 1.3, neonC, min(glow * 1.15, 1.0));
  float neonTone = mix(0.45, 0.92, glow);
  float w2 = floor(W * 0.18);
  float pylon = type > 1.5 ? 1.0 : w2;
  if (ry >= hb - 1.0) {
    // The blade sign: a neon border round letters.
    if (type > 1.5 && jx < 1.5 && ry >= hb + r1) {
      if (jx > 0.5 || ry > roof - 1.5) {
        return vec4(neonLine, neonTone);
      }
      float letter = mod(ry, 2.0) < 0.5 ? 1.0 : 0.5;
      return vec4(mix(wall, mix(neonC, vec3(1.0), 0.4), glow * letter), mix(0.38, 0.84, glow * letter));
    }
    // The spire: a pale stem with a neon tip.
    if (type < 0.5 && jx < 0.5 && ry >= hb + r1 + r2) {
      if (ry > roof - 1.5) {
        return vec4(mix(wall, mix(neonC, vec3(1.0), 0.3), glow), mix(0.5, 0.95, glow));
      }
      return vec4(wall * 1.25, 0.46);
    }
    // Neon trims the top tier; the lower steps end in pale ledges.
    bool top = ry > roof - 1.5;
    bool step_ = miRoof(jx + 1.0, W, hb, r1, r2, spire, type) < ry + 0.5;
    float crown = type > 1.5 ? hb : hb + r1;
    if ((top || step_) && ry >= crown - 1.0) {
      return vec4(neonLine, neonTone);
    }
    if (top || step_) {
      return vec4(wall * 1.35, 0.5);
    }
    // The name sign across the top tier.
    if (type > 0.5 && type < 1.5 && jx <= w2 - 1.0 && ry == hb + r1 + floor(r2 * 0.5)) {
      float on = mod(jx, 2.0) < 0.5 ? glow : glow * 0.35;
      return vec4(mix(wall, mix(neonC, vec3(1.0), 0.35), on), mix(0.36, 0.8, on));
    }
    return vec4(wall, wt);
  }
  // The ground floor: a cafe arcade, some bays warm, some dim.
  if (ry < 2.5) {
    if (mod(jx + 1.0, 3.0) < 0.5 || jx > W - 0.5) {
      return vec4(wall * 0.8, 0.3);
    }
    float on = miLit(vec2(s.x, i + 70.0), 0.7);
    float warm = 0.8 + 0.2 * miHash(vec2(s.x, i));
    return vec4(mix(wall * 0.7, vec3(1.0, 0.7, 0.42) * warm, on), mix(0.3, 0.66, on * warm));
  }
  // The canopy over the arcade, in neon on some hotels.
  if (ry < 3.5) {
    if (miHash(vec2(i, 4.4)) > 0.55) {
      return vec4(mix(wall, neonC, glow * 0.75), mix(0.42, 0.72, glow));
    }
    return vec4(wall * 1.25, 0.44);
  }
  // The central pylon of glass block, lit faintly by the stairwell.
  if (jx <= pylon) {
    vec3 glass = mix(wall, vec3(0.86, 0.8, 1.0), 0.25);
    if (mod(ry, 3.0) < 0.5 && jx < pylon - 0.5) {
      return vec4(mix(glass, vec3(1.0, 0.8, 0.58), 0.45), 0.5);
    }
    return vec4(glass, wt - 0.04);
  }
  float fr = mod(ry - 4.0, 3.0);
  // Eyebrow ledges over every row of windows.
  if (fr > 1.5) {
    return vec4(wall * 1.22, wt + 0.06);
  }
  if (jx < W - 1.5 && jx > pylon + 1.5 && mod(jx - pylon - 2.0, 3.0) < 0.5) {
    float floorId = floor((ry - 4.0) / 3.0);
    float on = miLit(vec2(s.x, floorId + i * 13.0), 0.42);
    vec3 lamp = miHash(vec2(s.x, floorId) + 41.0) > 0.72 ? mix(neonC, vec3(1.0), 0.5) : vec3(1.0, 0.8, 0.54);
    return vec4(mix(wall * 0.35, lamp, on), mix(0.22, 0.8, on));
  }
  return vec4(wall, wt);
}

// Distance from q to the segment a-b.
float miSeg(vec2 q, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float t = clamp(dot(q - a, ab) / dot(ab, ab), 0.0, 1.0);
  return length(q - a - ab * t);
}

// A palm stands in front of the gap between two hotels: a thin curved trunk
// and a crown of arching fronds, in silhouette against the glow. It sways a
// little, more at the tips than at the trunk. Palms behind the headline are
// shorter, so their crowns stay below it.
vec4 miPalm(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float bi = floor((s.x - miSlot0) / miSlotN + 0.5);
  float hp = miHash(vec2(bi, 4.2));
  if (hp < 0.15) {
    return vec4(0.0);
  }
  float baseX = (miSlot0 + bi * miSlotN) * miSw + (hp - 0.5) * 0.03;
  float H = (0.15 + 0.08 * miHash(vec2(bi, 7.7))) * (1.0 - 0.32 * miCentre(baseX));
  float lean = (miHash(vec2(bi, 2.9)) - 0.5) * 0.09;
  float sway = 0.004 * sin(miT * 0.3 + hp * 9.0);
  float y = p.y - miGroundY;
  vec3 dark = vec3(0.06, 0.035, 0.11);
  float k = y / H;
  if (k > -0.1 && k < 1.0) {
    float tx = baseX + (lean + sway) * k * k;
    float hw = max(mix(0.005, 0.0032, k), miSw * 0.5);
    if (abs(p.x - tx) < hw) {
      cover = 1.0;
      // Ring scars on the trunk catch a little light.
      return vec4(mix(dark, vec3(0.42, 0.22, 0.4), mod(s.y, 2.0) < 0.5 ? 0.35 : 0.55), 0.24);
    }
  }
  vec2 q = p - vec2(baseX + lean + sway, miGroundY + H);
  if (dot(q, q) > 0.02) {
    return vec4(0.0);
  }
  if (length(q * vec2(1.0, 1.4)) < max(0.005, miSh * 0.9)) {
    cover = 1.0;
    return vec4(dark, 0.14);
  }
  for (int f = 0; f < 8; f++) {
    float ff = float(f);
    // Fronds fan round the crown, upward ones short, side ones long and drooping.
    float a = -0.8 + ff * 0.67 + 0.3 * (miHash(vec2(bi, ff)) - 0.5);
    a += (0.03 + 0.03 * ff / 8.0) * sin(miT * 0.35 + ff * 1.3 + hp * 5.0);
    vec2 d = vec2(cos(a), sin(a));
    float L = (0.075 + 0.035 * miHash(vec2(bi, ff + 20.0))) * mix(1.0, 0.55, max(d.y, 0.0));
    float g = 0.2 + 0.45 * abs(d.x);
    float best = 1.0;
    float bt = 0.0;
    vec2 prev = vec2(0.0);
    for (int j = 1; j <= 5; j++) {
      float t = float(j) / 5.0;
      vec2 cur = L * (d * t - vec2(0.0, g * t * t));
      float dd = miSeg(q, prev, cur);
      if (dd < best) {
        best = dd;
        bt = t - 0.1;
      }
      prev = cur;
    }
    // Widest a third of the way out, tapering to a point.
    float w = 0.0045 * sin(3.14159 * clamp(bt * 0.9 + 0.1, 0.0, 1.0));
    w = max(w, miSh * 0.42);
    if (best < w) {
      cover = 1.0;
      return vec4(dark * 1.2, 0.15);
    }
  }
  return vec4(0.0);
}

// The sky from the horizon up: hot coral, pink, magenta, violet, then a deep
// violet barely lighter than the paper.
vec3 miSkyRamp(float h) {
  vec3 c = mix(vec3(1.0, 0.62, 0.42), vec3(1.0, 0.45, 0.46), smoothstep(0.0, 0.12, h));
  c = mix(c, vec3(0.92, 0.34, 0.58), smoothstep(0.1, 0.28, h));
  c = mix(c, vec3(0.56, 0.24, 0.66), smoothstep(0.24, 0.46, h));
  c = mix(c, vec3(0.28, 0.15, 0.46), smoothstep(0.4, 0.66, h));
  return mix(c, vec3(0.2, 0.12, 0.38), smoothstep(0.62, 0.95, h));
}

// The afterglow: strongest low in the sky under the moon, where the sun
// went down, and fading along the horizon away from it.
float miAfter(vec2 p) {
  float d = (p.x - miMoon.x) / 0.8;
  return exp(-d * d);
}

vec4 miSky(vec2 s, vec2 p) {
  float h = max(p.y - miGroundY, 0.0) / (1.0 - miGroundY);
  float glow = miAfter(p);
  // Away from the afterglow the colours run cooler, as if a little higher.
  float hc = h + 0.08 * (1.0 - glow);
  vec3 col = miSkyRamp(hc);
  col = mix(col, vec3(1.0, 0.76, 0.52), 0.45 * glow * exp(-h * 10.0));
  // Dot size follows the light: the horizon in medium dots, the high sky in
  // the smallest, so it reads as quiet dark air.
  float tone = 0.14 + 0.44 * exp(-hc * 3.0) + 0.12 * glow * exp(-h * 6.0);
  // Long thin clouds drifting slowly, lit pink from below.
  vec2 cp = vec2(p.x * 1.1 - miT * 0.004, p.y * 6.0);
  float cl = fbm(cp + vec2(5.3, 2.1));
  float band = smoothstep(0.1, 0.2, h) * (1.0 - smoothstep(0.36, 0.5, h));
  float cloud = smoothstep(0.52, 0.74, cl) * band;
  vec3 cloudCol = mix(vec3(1.0, 0.56, 0.6), vec3(0.56, 0.3, 0.7), smoothstep(0.1, 0.4, h));
  col = mix(col, cloudCol, cloud * 0.6);
  tone += cloud * 0.12;
  // The young moon low in the west, a thin bright crescent in a soft halo.
  vec2 m = (p - miMoon) / 0.03;
  float r = length(m);
  float lit = step(r, 1.0) * step(1.0, length(m - vec2(-0.42, 0.22)));
  float halo = exp(-r * 0.55) * 0.8;
  col = mix(col, vec3(1.0, 0.86, 0.66), clamp(halo * 0.75, 0.0, 0.7));
  tone += halo * 0.32;
  if (lit > 0.5) {
    return vec4(1.0, 0.95, 0.84, 1.0);
  }
  if (r < 1.0) {
    // The dark side of the moon, faintly lit by the earth.
    return vec4(mix(col, vec3(0.5, 0.36, 0.5), 0.6), 0.42);
  }
  // A few stars, only where the sky is dark.
  float star = miHash(s + 17.0);
  float density = 0.004 * smoothstep(0.45, 0.8, h);
  if (star > 1.0 - density) {
    float twinkle = 0.5 + 0.5 * sin(miT * (0.4 + star * 0.5) + miHash(s + 3.0) * 40.0);
    col = mix(vec3(0.62, 0.56, 0.86), vec3(0.98, 0.95, 1.0), twinkle);
    tone = mix(0.34, 0.62, twinkle);
  }
  return vec4(col, tone);
}

// The glass towers of Brickell in two layers, the far one paler and hazier,
// both cooler than the sky behind them. A tall cluster stands under the
// moon and a smaller one on the other side, clear of the headline; a few
// towers have lit crowns and the tallest a red beacon.
vec4 miTowers(vec2 s, vec2 p, float far, out float cover) {
  cover = 0.0;
  float y = p.y - miGroundY;
  if (y < 0.0) {
    return vec4(0.0);
  }
  float bw = far > 0.5 ? 0.046 : 0.064;
  float seed = far * 37.0;
  float x = p.x - miMid + far * 0.021;
  float id = floor(x / bw);
  float u = x / bw - id;
  float h1 = miHash(vec2(id, 1.3 + seed));
  if (h1 < 0.14) {
    return vec4(0.0);
  }
  float h2 = miHash(vec2(id, 2.7 + seed));
  float h3 = miHash(vec2(id, 4.1 + seed));
  float h4 = miHash(vec2(id, 6.9 + seed));
  float xc = (id + 0.5) * bw;
  float d1 = (xc - miCluster) / 0.26;
  float d2 = (xc - miCluster2) / 0.18;
  float hgt = 0.04 + 0.05 * h2 + mix(0.15, 0.26, miWide) * exp(-d1 * d1) + 0.13 * exp(-d2 * d2);
  hgt *= 1.0 - 0.35 * miCentre(miMid + xc);
  if (far > 0.5) {
    hgt = hgt * 0.8 + 0.035;
  }
  float wf = 0.5 + 0.36 * h3;
  float side = (u - 0.5) * 2.0 / wf;
  if (abs(side) > 1.0) {
    return vec4(0.0);
  }
  float top = hgt;
  if (h4 < 0.3) {
    // A slanted top.
    top -= 0.03 * (side * sign(h4 - 0.15) + 1.0);
  } else if (h4 < 0.55 && abs(side) > 0.5) {
    // Shoulders either side of a narrower crown.
    top -= 0.028;
  }
  if (y > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  float h = y / (1.0 - miGroundY);
  float k = y / top;
  vec3 sky = miSkyRamp(h + 0.06);
  vec3 glass = far > 0.5 ? vec3(0.42, 0.46, 0.86) : vec3(0.3, 0.38, 0.82);
  // The glass picks up the sky towards the top.
  vec3 col = mix(glass, sky, 0.18 * k);
  float tone = far > 0.5 ? 0.34 : 0.44;
  // The face away from the afterglow is a shade darker.
  float sunSide = sign(miMoon.x - (miMid + xc - far * 0.021));
  col *= side * sunSide > 0.2 ? 1.0 : 0.86;
  float glow = miAfter(p);
  float edgeW = miSw * 1.5 / (wf * bw * 0.5);
  if (far < 0.5 && side * sunSide > 1.0 - edgeW) {
    // The edge facing the afterglow catches it.
    col = mix(col, vec3(1.0, 0.6, 0.55), 0.3 + 0.4 * glow);
    tone = 0.52;
  } else if (mod(s.x, 2.0) < 0.5 && mod(s.y, 2.0) < 0.5 && y < top - 0.02) {
    float on = miLit(s + seed + 200.0, far > 0.5 ? 0.05 : 0.09);
    vec3 lamp = miHash(s + 9.0) > 0.5 ? vec3(0.82, 0.88, 1.0) : vec3(1.0, 0.8, 0.56);
    col = mix(col, lamp, on * 0.75);
    tone = mix(tone, 0.6, on);
  }
  // Lit crowns on some of the near towers.
  if (far < 0.5 && miHash(vec2(id, 8.8)) > 0.5 && y > top - miSh * 1.5) {
    float cc = miHash(vec2(id, 3.9));
    vec3 led = cc < 0.4 ? vec3(0.45, 0.7, 1.0) : (cc < 0.75 ? vec3(0.35, 0.95, 0.9) : vec3(1.0, 0.45, 0.78));
    col = mix(col, led, 0.5 * miNeon + 0.2);
    tone = mix(tone, 0.72, miNeon);
  }
  // A red beacon on the tallest, pulsing every 1.8 seconds.
  if (far < 0.5 && hgt > 0.24 && abs(u - 0.5) * bw < miSw * 0.5 && y > top - miSh) {
    float pulse = pow(0.5 + 0.5 * cos(miT * 3.49), 6.0);
    col = mix(col, vec3(1.0, 0.25, 0.3), 0.4 + 0.6 * pulse);
    tone = 0.45 + 0.4 * pulse;
  }
  // Blue haze: the far layer and the feet of both fade towards the sky.
  float haze = (far > 0.5 ? 0.3 : 0.1) + 0.3 * (1.0 - smoothstep(0.0, 0.1, y));
  col = mix(col, mix(sky, vec3(0.52, 0.5, 0.9), 0.6), haze);
  return vec4(col, mix(tone, 0.36, haze * 0.6));
}

// The beach in front: a broken line of surf, then lavender sand darkening
// up to the foot of the hotels.
vec4 miStrip(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  if (s.y >= miGroundRow) {
    return vec4(0.0);
  }
  cover = 1.0;
  float r = s.y - miWaterRow;
  float n = miGroundRow - miWaterRow;
  if (r < 0.5) {
    float f = snoise(vec2(p.x * 9.0 - miT * 0.03, miT * 0.06)) + 0.5 * snoise(vec2(p.x * 31.0, miT * 0.1));
    float foam = smoothstep(0.0, 0.9, f);
    return vec4(mix(vec3(0.5, 0.36, 0.6), vec3(1.0, 0.86, 0.9), foam), 0.3 + 0.32 * foam);
  }
  float k = (r - 0.5) / max(n - 1.0, 1.0);
  vec3 sand = mix(vec3(0.6, 0.42, 0.58), vec3(0.3, 0.2, 0.38), k);
  return vec4(sand * (0.9 + 0.2 * miHash(s + 0.2)), mix(0.36, 0.26, k));
}

// How much neon light hangs in the air around the hotel parapets, and its colour.
float miNeonHalo(vec2 s, out vec3 col) {
  col = vec3(0.0);
  float best = 0.0;
  float ry = s.y - miGroundRow;
  float i0 = floor((s.x - miSlot0) / miSlotN);
  for (int n = -1; n <= 1; n++) {
    float i = i0 + float(n);
    float c = miSlot0 + i * miSlotN + floor(miSlotN * 0.5);
    float jx = abs(s.x - c);
    float W;
    float hb;
    float r1;
    float r2;
    float spire;
    float type;
    miHotelShape(i, W, hb, r1, r2, spire, type);
    float roof = miRoof(min(jx, W), W, hb, r1, r2, spire, type);
    vec2 d = vec2(max(jx - W, 0.0) * miSw, max(ry - roof, 0.0) * miSh);
    float g = exp(-length(d) / 0.016) * miBreath(i);
    if (g > best) {
      best = g;
      col = miNeonCol(i);
    }
  }
  return best;
}

// Everything above the water at sample s.
vec4 miAbove(vec2 s) {
  vec2 p = (s + 0.5) * vec2(miSw, miSh);
  float cover;
  // How far back the hit is: 0 near, 1 near towers, 2 far towers, 3 sky.
  float depth = 0.0;
  vec4 hit = miStrip(s, p, cover);
  if (cover < 0.5) {
    hit = miPalm(s, p, cover);
  }
  if (cover < 0.5) {
    hit = miHotel(s, cover);
  }
  if (cover < 0.5) {
    hit = miTowers(s, p, 0.0, cover);
    depth = 1.0;
  }
  if (cover < 0.5) {
    hit = miTowers(s, p, 1.0, cover);
    depth = 2.0;
  }
  if (cover < 0.5) {
    hit = miSky(s, p);
    depth = 3.0;
  }
  if (depth > 0.5) {
    // Neon glow in the air just above the parapets.
    vec3 nc;
    float halo = miNeonHalo(s, nc);
    hit.rgb = mix(hit.rgb, nc, clamp(halo * 0.5, 0.0, 0.5));
    hit.a = max(hit.a, min(hit.a + halo * 0.22, 0.7));
    // Per-sample dither, so the gradients blend between dot sizes instead
    // of stepping in bands; the hotels and palms stay crisp.
    hit.a += (miHash(s + 0.37) - 0.5) * 0.22;
    // Mist lying low behind the hotels, drifting slowly.
    float y = p.y - miGroundY;
    float mist = (1.0 - smoothstep(0.0, 0.06, y)) * smoothstep(0.35, 0.75, fbm(vec2(p.x * 3.0 + miT * 0.01, y * 25.0)));
    hit.rgb = mix(hit.rgb, vec3(0.7, 0.5, 0.78), mist * 0.4);
    hit.a = mix(hit.a, 0.4, mist * 0.3);
  }
  return hit;
}

// The bay: everything above mirrored, darker and cooler, its mid-tones
// flattened into a quiet ripple so only the lights come through, broken
// into dashes. Each hotel's neon runs down the water in a soft streak and
// the moon lays a glitter path.
vec4 miWater(vec2 s) {
  vec2 p = (s + 0.5) * vec2(miSw, miSh);
  float k = miWaterY - p.y;
  float dn = clamp(k / miWaterY, 0.0, 1.0);
  float rip = snoise(vec2(p.x * mix(8.0, 2.8, dn) + miT * 0.012, k * mix(120.0, 36.0, dn) - miT * 0.38));
  float rip2 = snoise(vec2(p.x * 3.0 - miT * 0.01, k * mix(60.0, 20.0, dn) + miT * 0.26 + 7.0));
  float sway = rip2 * (0.002 + 0.012 * dn);
  float off = floor(sway / miSw + 0.5);
  vec2 m = vec2(s.x + off, 2.0 * miWaterRow - 1.0 - s.y);
  vec4 hit = miAbove(m);
  float dash = smoothstep(-0.15, 0.55, rip);
  float bright = smoothstep(0.55, 0.85, hit.a);
  vec3 col = mix(hit.rgb * 0.55, hit.rgb * 0.92, bright) * mix(1.0, 0.72, dn);
  col = mix(col, col * vec3(0.82, 0.84, 1.15), 0.4) + vec3(0.02, 0.015, 0.05);
  float tone = mix(0.12 + 0.18 * hit.a, hit.a * 0.95 * dash, bright);
  // A pink shimmer on the ripple crests, where they catch the glowing sky.
  float crest = smoothstep(0.45, 0.85, rip) * (1.0 - bright) * mix(0.8, 0.35, dn);
  col = mix(col, miSkyRamp(0.16 + 0.2 * dn) * 0.8, crest * 0.7);
  tone = max(tone, 0.2 + 0.2 * crest);
  // Neon streaks under the middle of each hotel.
  float i = floor((s.x + off - miSlot0) / miSlotN);
  float c = miSlot0 + i * miSlotN + floor(miSlotN * 0.5);
  float W;
  float hb;
  float r1;
  float r2;
  float spire;
  float type;
  miHotelShape(i, W, hb, r1, r2, spire, type);
  float jx = abs(s.x + off - c) / max(floor(W * 0.3), 2.0);
  float streak = exp(-jx * jx) * dash * miBreath(i) * mix(0.95, 0.35, dn);
  col = mix(col, miNeonCol(i) * mix(1.0, 0.7, dn), clamp(streak, 0.0, 0.8));
  tone = max(tone, streak * 0.85);
  // The moon's glitter path, widening towards you.
  float mx = (p.x - miMoon.x + sway) / mix(0.012, 0.05, dn);
  float glitter = exp(-mx * mx) * smoothstep(0.0, 0.6, rip) * mix(1.0, 0.7, dn);
  col = mix(col, vec3(1.0, 0.86, 0.64), clamp(glitter, 0.0, 0.9));
  tone = max(tone, glitter);
  tone += (miHash(s + 0.53) - 0.5) * 0.14 * (1.0 - max(streak, glitter));
  return vec4(col, tone);
}

vec2 miCacheUv = vec2(-1.0);
float miCacheT = -1.0;
vec4 miCacheValue = vec4(0.0);

vec4 miScene(vec2 uv, vec2 res, float t) {
  if (uv == miCacheUv && t == miCacheT) {
    return miCacheValue;
  }
  miAspect = res.x / res.y;
  miSh = 1.0 / res.y;
  miSw = miAspect / max(ascii_samples.x, 1.0);
  miT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  miMid = miAspect * 0.5;
  miWide = smoothstep(0.9, 1.3, miAspect);
  // The waterline and the ground sit on cell boundaries, so the beach and
  // its mirror image line up with whole glyphs.
  float rows = miSh * miGrid.y;
  miWaterRow = floor(MI_WATER / rows + 0.5) * miGrid.y;
  miWaterY = miWaterRow * miSh;
  miGroundRow = miWaterRow + max(2.0, floor(MI_SAND / rows + 0.5)) * miGrid.y;
  miGroundY = miGroundRow * miSh;
  // Hotel slots are an odd number of columns, so each hotel is symmetric.
  // Wide boxes put a palm in the middle, behind the headline; tall ones a
  // whole hotel.
  miSlotN = 2.0 * floor(MI_SLOT / miSw * 0.5) + 1.0;
  miSlot0 = floor(miMid / miSw) - (miAspect < 1.0 ? floor(miSlotN * 0.5) : 0.0);
  // Brickell and the moon sit left of the headline on wide boxes, and
  // above the hotels, to one side, on tall ones.
  miCluster = mix(-0.08, -0.38 * miAspect, miWide);
  miCluster2 = 0.36 * miAspect;
  miMoon = vec2(miMid + mix(-0.12, -0.3 * miAspect, miWide), mix(0.7, 0.66, miWide));

  vec4 hit = s.y < miWaterRow ? miWater(s) : miAbove(s);
  // Intensity quiets the band where a headline sits most and the edges
  // least. It dims colour in step and shrinks the dots more gently, so the
  // shapes keep their place behind text.
  vec2 band = vec2((uv.x - 0.5) / 0.32, (uv.y - 0.52) / 0.22);
  float inBand = exp(-dot(band, band));
  float k = clamp(miIntensity + (1.0 - miIntensity) * (1.0 - inBand) * miIntensity, 0.0, 1.0);
  float tone = clamp(hit.a, 0.0, 1.0) * sqrt(k);
  miCacheUv = uv;
  miCacheT = t;
  miCacheValue = vec4(clamp(hit.rgb, 0.0, 1.0) * k, tone);
  return miCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return miScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return miScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#0b0719";
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
        "linear-gradient(to bottom, #120a2c 0%, #2a1650 35%, #7a2c6a 58%, #e0605c 74%, #2a1a3a 78%, #0b0719 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface MiamiProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Brightness of the neon on the hotels and the lit tower crowns, from 0 (off) to 1. Default 1. */
  neon?: number;
  /**
   * Paper behind the glyphs. Default: a deep violet night in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for one-glyph charsets such as `dots`; `false`
   * for Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
}

/**
 * Ocean Drive at nightfall, painted in coloured dots. A row of art deco
 * hotels stands along the beach with soft neon on their stepped parapets,
 * palms in silhouette between them and the glass towers of Brickell in blue
 * haze behind, under a sky running from coral to deep violet. The bay in
 * front carries the neon in broken reflections. Decorative and full-bleed:
 * size it with `className`, usually `absolute inset-0`.
 */
export const Miami = ({
  intensity = 1,
  neon = 1,
  paper,
  square,
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  cell = 7,
  stillTime = 12,
  // Part of the shared scene props; nothing here follows the pointer.
  interactive: _interactive,
  fallback = FALLBACK,
  ...props
}: MiamiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        // The samples per glyph, so the waterline and the ground land on
        // whole cells in every charset.
        miGrid: [gx, gy],
        miIntensity: clamp(intensity, 0, 1),
        miNeon: clamp(neon, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      square={square ?? gx * gy === 1}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
