"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Sydney Harbour at blue hour, seen from the east across the water. The
// scene is painted per sample, far to near: the sky and its afterglow, the
// city towers in haze, the Harbour Bridge, and the Opera House on its
// podium. Below the horizon the harbour mirrors all of it through slow
// ripples.
//
// Units are box heights: y runs from 0 at the bottom to 1 at the top and x
// is centred. The Opera House stands on the left and the bridge on the
// right, so the middle of a wide box stays quiet behind a headline. On a
// tall box both close in and sit low, under the copy.
//
// Each layer returns a colour and a tone. The tone picks the dot size and is
// set per layer: the lit sails and the afterglow draw the big dots, the far
// city and the deep sky the smallest, so depth reads from dot size as well
// as colour.
const SCENE = `
vec2 syN = vec2(1.0);
float syAsp = 1.0;
float syCw = 0.01;
float syRh = 0.01;
float syT = 0.0;
float syHz = 0.3;
float syHzRow = 0.0;
float syOX = 0.0;
float syOS = 0.17;
float syPodRow = 0.0;
float syB0 = 0.1;
float syB1 = 0.8;
float syBH = 0.2;
float syDeckRow = 0.0;
float syGlowX = 0.0;

// A stable random value for whole-sample inputs.
float syHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float syX(float col) {
  return ((col + 0.5) / syN.x - 0.5) * syAsp;
}

float syY(float row) {
  return (row + 0.5) / syN.y;
}

float syColOf(float x) {
  return floor((x / syAsp + 0.5) * syN.x);
}

void sySetup(vec2 res, float t) {
  syN = ascii_samples;
  syAsp = res.x / res.y;
  syCw = syAsp / syN.x;
  syRh = 1.0 / syN.y;
  syT = t;
  float tall = 1.0 - smoothstep(0.6, 1.3, syAsp);
  syHzRow = floor(mix(0.31, 0.27, tall) * syN.y + 0.5);
  syHz = syHzRow / syN.y;
  // The Opera House: its tallest shell's tip sits at the edge of the
  // middle of a wide box, with both halls in view; on narrower boxes the
  // stairs and the restaurant run off the left edge first.
  float wideS = clamp((0.29 * syAsp - 0.02) / mix(1.85, 2.3, smoothstep(1.2, 1.6, syAsp)), 0.12, 0.21);
  // On a tall box the house's tallest shell stands just right of centre,
  // its stairs running off the left edge.
  float tallS = clamp(0.37 * syAsp, 0.12, 0.2);
  syOS = mix(wideS, tallS, tall);
  syOX = mix(-0.21 * syAsp - 1.1 * wideS, 0.2 * syAsp - 1.1 * tallS, tall);
  syPodRow = syHzRow + max(2.0, floor(0.2 * syOS * syN.y + 0.5));
  // The bridge spans the right of the box, behind the house on a tall one.
  float span = mix(0.42 * syAsp, 1.5 * syAsp, tall);
  syB0 = mix(0.04 * syAsp, -0.26 * syAsp, tall);
  syB1 = syB0 + span;
  syBH = 0.29 * span;
  syDeckRow = floor((syHz + 0.37 * syBH) * syN.y + 0.5);
  syGlowX = mix(-0.04 * syAsp, 0.34 * syAsp, tall);
}

// Tone for the atmosphere from its brightness: the darkest air draws the
// smallest dots, sometimes none, and only the glow draws large ones.
float syTone(vec3 c) {
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  return 0.1 + 0.44 * l;
}

// The afterglow: a broad warm halo low over the water, its bright core
// sitting on the horizon between the house and the bridge.
float syGlow(float x, float y) {
  vec2 g = vec2((x - syGlowX) * 0.45, (y - syHz - 0.02) * 2.3);
  return exp(-dot(g, g) * 5.0);
}

float syCore(float x, float y) {
  vec2 g = vec2((x - syGlowX) * 0.7, (y - syHz - 0.04) * 1.4);
  return exp(-dot(g, g) * 80.0);
}

vec3 sySky(float x, float y) {
  float h = clamp((y - syHz) / (1.0 - syHz), 0.0, 1.0);
  // Peach under the glow, cooling to rose and lavender toward the sides.
  float side = exp(-pow((x - syGlowX) * 1.2, 2.0));
  vec3 low = mix(vec3(0.6, 0.42, 0.56), vec3(1.0, 0.64, 0.44), side);
  vec3 rose = mix(vec3(0.44, 0.33, 0.52), vec3(0.86, 0.5, 0.5), side);
  vec3 c = mix(low, rose, smoothstep(0.0, 0.08, h));
  c = mix(c, vec3(0.38, 0.32, 0.56), smoothstep(0.05, 0.22, h));
  c = mix(c, vec3(0.22, 0.26, 0.52), smoothstep(0.14, 0.42, h));
  c = mix(c, vec3(0.12, 0.15, 0.33), smoothstep(0.4, 0.78, h));
  c = mix(c, vec3(0.06, 0.07, 0.16), smoothstep(0.76, 1.0, h));
  // Thin streaks of high cloud, lit pink underneath near the horizon.
  float band = smoothstep(0.05, 0.18, h) * (1.0 - 0.6 * smoothstep(0.5, 0.9, h));
  float streak = smoothstep(0.5, 0.8, fbm(vec2(x * 1.1 - syT * 0.004, y * 7.0 + 1.7)));
  vec3 cloud = mix(vec3(0.95, 0.6, 0.56), vec3(0.42, 0.38, 0.6), smoothstep(0.1, 0.4, h));
  cloud = mix(cloud, vec3(0.13, 0.15, 0.32), smoothstep(0.4, 0.85, h));
  c = mix(c, cloud, streak * band * 0.55);
  // Low mist drifting along the horizon breaks the warm band into
  // irregular patches, thinning with height.
  float lowH = 1.0 - smoothstep(0.02, 0.3, h);
  float mist = fbm(vec2(x * 2.6 - syT * 0.006, y * 14.0 + 2.9));
  c *= mix(1.0, 0.7 + 0.55 * mist, lowH);
  c += vec3(1.0, 0.55, 0.3) * syGlow(x, y) * 0.4;
  c += vec3(1.0, 0.82, 0.62) * syCore(x, y) * 0.32;
  return c;
}

// The aircraft warning lights' level, from 0 to 1, a soft blink about
// every 1.8 seconds, each light out of step with the others.
float syBeacon(float phase) {
  return smoothstep(-0.2, 1.0, sin(syT * 3.49 + phase)) * 0.85 + 0.15;
}

// A window's light: each one switches on or off about once a minute or
// two, fading over a couple of seconds, out of step with its neighbours.
float syWindow(vec2 id, float p) {
  float ph = syHash(id + 4.3);
  float e = syT / (50.0 + 70.0 * ph) + ph * 13.0;
  float now = step(syHash(id + floor(e) * 1.7), p);
  float before = step(syHash(id + (floor(e) - 1.0) * 1.7), p);
  return mix(before, now, smoothstep(0.0, 0.03, fract(e)));
}

// The city in cool haze: the towers of the centre behind and left of the
// house, a needle tower among them, a lower shoulder toward the bridge and
// North Sydney's lower towers past it. Writes how much it covers to cover.
vec4 syCity(float col, float row, float x, float y, vec3 sky, out float cover) {
  cover = 0.0;
  float bw = 0.045;
  float i = floor(x / bw);
  float hi = syHash(vec2(i, 3.7));
  float hj = syHash(vec2(i, 9.1));
  float cbd = exp(-pow((x - syOX - 0.05 * syOS) / (2.4 * syOS), 2.0));
  // Nothing tall stands in front of the afterglow, so it fades softly
  // into the far shore instead of showing through gaps.
  float clear = smoothstep(0.18, 0.42, abs(x - syGlowX));
  cbd *= clear;
  float mid = 0.0;
  float north = 0.5 * smoothstep(syB1 - 0.25 * (syB1 - syB0), syB1 + 0.1, x);
  float env = max(max(cbd, mid), north);
  float top = syHz + env * (0.03 + 0.13 * hi * hi) + 0.012 * fbm(vec2(x * 30.0, 1.0));
  // Some towers stand back with a gap, so the cluster reads as many.
  float fx = fract(x / bw);
  bool gap = hj < 0.3 && (fx < 0.18 || fx > 0.82);
  vec3 wall = mix(vec3(0.14, 0.16, 0.3), min(sky, vec3(0.5)) * 0.75, 0.5);
  float tone = min(mix(0.16, syTone(sky), 0.4), 0.28);

  // The needle tower with its golden turret, far and hazy.
  float nx = syOX - 1.0 * syOS;
  float nc = syColOf(nx);
  float nTop = syHz + 1.55 * syOS;
  float pod0 = syHz + 1.25 * syOS;
  float pod1 = pod0 + max(2.0 * syRh, 0.07 * syOS);
  if (abs(col - nc) < 0.5 && y < nTop) {
    cover = 1.0;
    if (y > nTop - syRh) {
      float b = syBeacon(1.3);
      return vec4(mix(wall, vec3(1.0, 0.25, 0.18), b * 0.8), 0.3 + 0.35 * b);
    }
    return vec4(wall * 1.1, tone + 0.06);
  }
  if (abs(col - nc) <= 2.0 && y > pod0 && y < pod1) {
    cover = 1.0;
    float edge = abs(col - nc) > 1.5 ? 0.7 : 1.0;
    return vec4(mix(vec3(0.95, 0.74, 0.46), sky, 0.35) * edge, 0.5);
  }

  if (y > top || gap) {
    return vec4(0.0);
  }
  cover = 1.0;
  // The face toward the glow catches a little of it.
  float lc = col - syColOf(i * bw);
  float lit = x < syGlowX ? step(syColOf((i + 1.0) * bw) - col, 1.5) : step(lc, 0.5);
  vec3 c = wall * (0.92 + 0.12 * hj) + vec3(0.06, 0.04, 0.05) * lit;
  // Haze thickens toward the horizon, so the feet of the towers fade.
  c = mix(c, min(sky, vec3(0.6)), 0.2 * (1.0 - smoothstep(syHz, syHz + 0.08, y)));
  if (mod(lc, 2.0) > 0.5 && mod(row, 2.0) < 0.5 && y < top - syRh) {
    float on = syWindow(vec2(col, row), 0.1 + 0.16 * hj);
    if (on > 0.0) {
      vec3 w = mix(vec3(1.0, 0.8, 0.52), sky, 0.35);
      c = mix(c, w, on * 0.85);
      tone = mix(tone, 0.48, on);
    }
  }
  return vec4(c, tone);
}

// The Harbour Bridge: granite pylons at each end, the arch between two
// chords, hangers down to the deck and lamps along it. It is farther than
// the house, so it draws smaller, hazier dots. Writes how much it covers.
vec4 syBridge(float col, float row, float x, float y, vec3 sky, out float cover) {
  cover = 0.0;
  float span = syB1 - syB0;
  float v = (y - syHz) / syBH;
  float haze = 0.15;
  // Dark steel against the afterglow, warmed a little where the glow
  // lights it from behind.
  vec3 steel = vec3(0.5, 0.5, 0.66) + vec3(0.22, 0.11, 0.06) * syGlow(x, y);
  float skyTone = syTone(sky);

  // The pylons: a granite tower each end, lit on the face toward the glow.
  float pw = max(3.0 * syCw, 0.075 * span);
  for (int s = 0; s < 2; s++) {
    float p0 = s == 0 ? syB0 - pw : syB1;
    float c0 = syColOf(p0);
    float c1 = syColOf(p0 + pw);
    float topV = 0.66 + 0.02 * float(s);
    bool step2 = v > topV - 0.06 && (col <= c0 || col >= c1);
    if (col >= c0 && col <= c1 && v > 0.0 && v < topV && !step2) {
      cover = 1.0;
      float f = (col - c0) / max(c1 - c0, 1.0);
      float lit = s == 0 ? 1.0 - f : f;
      lit = smoothstep(0.3, 0.7, lit) * 0.6 + 0.2;
      vec3 c = mix(vec3(0.26, 0.25, 0.4), vec3(0.78, 0.64, 0.56), lit);
      // Floodlit from below, the light fading up the stone.
      c *= 0.8 + 0.35 * (1.0 - v / topV);
      c *= 0.9 + 0.2 * syHash(vec2(col, row) + 2.0);
      // The cornice: a slightly darker course near the top.
      if (abs(v - (topV - 0.12)) < syRh / syBH * 0.6) {
        c *= 0.75;
      }
      return vec4(mix(c, sky, haze * 0.7), 0.62 + 0.2 * lit);
    }
  }

  float yd = (syDeckRow + 0.5) * syRh;
  // The arch: a top and a bottom chord, the truss between, hangers below.
  if (x > syB0 && x < syB1) {
    float u = (x - syB0) / span;
    float w = 2.0 * u - 1.0;
    float yb = syHz + syBH * (0.05 + 0.8 * (1.0 - w * w));
    float yt = syHz + syBH * (0.5 + 0.5 * (1.0 - w * w));
    float sb = -syBH * 0.8 * 4.0 * w / span;
    float st = -syBH * 0.5 * 4.0 * w / span;
    float db = abs(y - yb) / syRh / sqrt(1.0 + pow(sb * syCw / syRh, 2.0));
    float dt = abs(y - yt) / syRh / sqrt(1.0 + pow(st * syCw / syRh, 2.0));
    if (dt < 0.6) {
      cover = 1.0;
      // Lamps along the arch, spaced a little unevenly.
      float lamp = step(0.35, syHash(vec2(col, 5.0)));
      vec3 c = mix(steel * 1.3, vec3(1.0, 0.78, 0.5), lamp * 0.85);
      // The red light on the crown.
      if (abs(col - syColOf(syB0 + span * 0.5)) < 0.5) {
        float b = syBeacon(0.0);
        return vec4(mix(c, vec3(1.0, 0.2, 0.14), b * 0.9), 0.5 + 0.3 * b);
      }
      return vec4(mix(c, sky, haze), 0.68 + 0.12 * lamp);
    }
    if (db < 0.6) {
      cover = 1.0;
      return vec4(mix(steel, sky, haze), 0.64);
    }
    if (y > yb && y < yt) {
      // The truss: posts and crossed diagonals, in thin dim steel.
      float panel = max(3.0, floor(span / syCw / 24.0 + 0.5));
      float pc = mod(col - syColOf(syB0), panel);
      float f = pc / panel;
      float fr = (y - yb) / (yt - yb);
      float depth = (yt - yb) / syRh;
      bool post = pc < 0.5;
      bool diag = abs(fr - f) * depth < 0.55 || abs(fr - (1.0 - f)) * depth < 0.55;
      cover = 1.0;
      if (post || diag) {
        return vec4(mix(steel * 0.85, sky, haze + 0.08), 0.5);
      }
      // Between the members the sky shows through, dimmed by the lattice,
      // so the truss reads as one hazy band rather than a row of posts.
      return vec4(mix(steel * 0.7, sky, 0.45), mix(0.4, skyTone, 0.35));
    }
    if (y < yb && y > yd) {
      float panel = max(3.0, floor(span / syCw / 24.0 + 0.5));
      if (mod(col - syColOf(syB0), panel) < 0.5) {
        cover = 1.0;
        return vec4(mix(steel * 0.8, sky, haze + 0.1), 0.42);
      }
    }
  }

  // The deck, running on past the pylons as the approach spans.
  float far = syB0 - pw;
  float near = syB1 + 0.6 * span;
  if (x > far && x < near && row <= syDeckRow && row >= syDeckRow - 1.0) {
    cover = 1.0;
    if (row == syDeckRow) {
      float lamp = step(0.6, syHash(vec2(col, 11.0)));
      vec3 c = mix(steel, vec3(1.0, 0.76, 0.46), lamp * 0.9);
      return vec4(mix(c, sky, haze * 0.8), 0.6 + 0.18 * lamp);
    }
    return vec4(mix(steel * 0.7, sky, haze), 0.42);
  }
  // Piers under the approach spans.
  if ((x < syB0 - pw || x > syB1 + pw) && x > far && x < near && row < syDeckRow - 1.0 && v > 0.0) {
    float pier = mod(col - syColOf(syB0), max(6.0, floor(0.12 * span / syCw)));
    if (pier < 1.5) {
      cover = 1.0;
      return vec4(mix(steel * 0.75, sky, haze + 0.1), 0.38);
    }
  }
  return vec4(0.0);
}

// The Opera House's shells, back to front. Each is a curved shell cut
// from two circles: a convex back arc rising to the tip and a concave cut
// under it, where the shell's underside shows. at: origin (in house
// units), direction (1 tips toward the north end, -1 south), hall (0 the
// taller hall behind, 1 the lower hall in front, 2 the restaurant) and
// whether a glass wall fills the space under its tip. f: front base, tip
// x and tip height. Heights and leans differ, so the halls read as a
// cluster rather than a row of copies.
void syShellAt(int i, out vec4 at, out vec3 f) {
  if (i == 0) { at = vec4(-0.22, -1.0, 0.0, 0.0); f = vec3(0.52, 0.76, 0.66); }
  else if (i == 1) { at = vec4(-0.5, 1.0, 0.0, 0.0); f = vec3(0.58, 0.78, 0.72); }
  else if (i == 2) { at = vec4(-0.16, 1.0, 0.0, 0.0); f = vec3(0.66, 0.88, 0.86); }
  else if (i == 3) { at = vec4(0.13, 1.0, 0.0, 1.0); f = vec3(0.74, 0.97, 1.0); }
  else if (i == 4) { at = vec4(-0.64, -1.0, 1.0, 0.0); f = vec3(0.44, 0.64, 0.5); }
  else if (i == 5) { at = vec4(-0.9, 1.0, 1.0, 0.0); f = vec3(0.46, 0.62, 0.52); }
  else if (i == 6) { at = vec4(-0.6, 1.0, 1.0, 0.0); f = vec3(0.54, 0.74, 0.64); }
  else if (i == 7) { at = vec4(-0.28, 1.0, 1.0, 1.0); f = vec3(0.58, 0.8, 0.74); }
  else if (i == 8) { at = vec4(-1.52, 1.0, 2.0, 0.0); f = vec3(0.26, 0.34, 0.32); }
  else { at = vec4(-1.2, -1.0, 2.0, 0.0); f = vec3(0.24, 0.32, 0.28); }
}

// Distances into shell i at a point in house units: d1 inside its back
// arc, d2 outside its front cut (both positive inside the shell), and the
// point relative to the back arc's centre, for the arc's direction.
void syShellDist(float u, float v, int i, out float d1, out float d2, out vec2 r1) {
  vec4 at;
  vec3 f;
  syShellAt(i, at, f);
  vec2 q = vec2((u - at.x) * at.y, v);
  float c1 = (f.y * f.y + f.z * f.z) / (2.0 * f.y);
  r1 = q - vec2(c1, 0.0);
  d1 = c1 - length(r1);
  float c2 = (f.x * f.x - f.y * f.y - f.z * f.z) / (2.0 * (f.x - f.y));
  d2 = length(q - vec2(c2, 0.0)) - (c2 - f.x);
}

// The house's soft floodlit bloom, which warms the air around the sails.
float syBloom(float x, float y) {
  float podTop = syPodRow * syRh;
  vec2 g = vec2((x - syOX - 0.2 * syOS) / (1.3 * syOS), (y - podTop - 0.45 * syOS) / (0.9 * syOS));
  return exp(-dot(g, g));
}

// The Opera House and its podium. Writes how much it covers to cover.
vec4 syOpera(float col, float row, float x, float y, out float cover) {
  cover = 0.0;
  float podTop = syPodRow * syRh;
  float u = (x - syOX) / syOS;
  float v = (y - podTop) / syOS;
  float su = syCw / syOS;
  float sv = syRh / syOS;
  if (v > 0.0 && v < 1.02 && u > -1.6 && u < 1.15) {
    // The frontmost shell here, or the glass under a tip.
    int hit = -1;
    bool glass = false;
    bool behind = false;
    float hd1 = 0.0;
    float hd2 = 0.0;
    vec2 hr1 = vec2(0.0, 1.0);
    for (int i = 0; i < 10; i++) {
      float d1;
      float d2;
      vec2 r1;
      syShellDist(u, v, i, d1, d2, r1);
      vec4 at;
      vec3 f;
      syShellAt(i, at, f);
      vec2 q = vec2((u - at.x) * at.y, v);
      if (d1 > 0.0 && d2 > 0.0) {
        behind = hit >= 0;
        hit = i;
        glass = false;
        hd1 = d1;
        hd2 = d2;
        hr1 = r1;
      } else if (at.w > 0.5 && d1 > 0.0 && d2 <= 0.0 && q.x < f.y && q.y < f.z * 0.3) {
        behind = hit >= 0;
        hit = i;
        glass = true;
      }
    }
    if (hit >= 0) {
      cover = 1.0;
      vec4 at;
      vec3 f;
      syShellAt(hit, at, f);
      // The shells in front throw a soft contact shadow on this one, just
      // behind their back edges, so each overlap reads as depth.
      float occl = 0.0;
      for (int j = 0; j < 10; j++) {
        if (j > hit) {
          float d1;
          float d2;
          vec2 r1;
          syShellDist(u, v, j, d1, d2, r1);
          vec4 aj;
          vec3 fj;
          syShellAt(j, aj, fj);
          if (d1 < 0.0 && d2 > 0.0 && v < fj.z) {
            occl = max(occl, 1.0 - smoothstep(0.0, 5.0, -d1 / su));
          }
        }
      }
      if (glass) {
        // The glass wall under the tip, lit warm from the foyer.
        float glow = 0.7 + 0.3 * syHash(vec2(col, row) + 9.0);
        float mullion = mod(col, 3.0) < 0.5 ? 0.82 : 1.0;
        float dim = at.z < 0.5 ? 0.8 : 1.0;
        return vec4(vec3(1.0, 0.74, 0.48) * glow * mullion * dim * (1.0 - 0.4 * occl), 0.7 * dim);
      }
      float n = abs(normalize(hr1).y);
      float step1 = mix(su, sv, n);
      float edge = hd1 / step1;
      float lip = hd2 / mix(su, sv, 0.5);
      float up = v / f.z;
      // Across the shell from its back edge (0) to its front edge (1). The
      // shell is a curved volume: its back shoulder turns away from the
      // glow, the face swells toward it with a bright ridge, and under the
      // overhang its underside shows in shadow.
      float across = hd1 / (hd1 + hd2);
      bool toGlow = (at.y > 0.0) == (syGlowX > syOX);
      float side = toGlow ? across : 1.0 - across;
      // Floodlit tile stays pale even in shade, so the shadow side is a
      // cool lavender, not the colour of the sky behind it.
      float light = smoothstep(0.0, 0.5, side);
      float ridge = exp(-pow((side - 0.55) / 0.12, 2.0));
      vec3 shade = vec3(0.5, 0.5, 0.72);
      vec3 face = toGlow ? vec3(1.0, 0.86, 0.72) : vec3(0.82, 0.8, 0.9);
      vec3 s = mix(shade, face, light);
      s = mix(s, vec3(1.0, 0.95, 0.86), ridge * 0.4 * light);
      float tone = mix(0.62, 0.94, light) + 0.06 * ridge;
      // The underside: a shaded band along the concave cut, deepest low
      // down where the overhang is widest.
      float under = (1.0 - smoothstep(0.6, 2.4, lip)) * (1.0 - smoothstep(0.55, 0.9, up));
      s = mix(s, vec3(0.5, 0.42, 0.5), under * 0.75);
      tone = mix(tone, 0.56, under * 0.75);
      // The tip catches the open sky.
      s = mix(s, vec3(0.98, 0.9, 0.84), smoothstep(0.82, 1.0, up) * 0.3);
      // Floodlit from the podium a little; the tiles' faint grain.
      s *= 0.9 + 0.1 * (1.0 - up);
      s *= 0.95 + 0.09 * syHash(vec2(col, row) + float(hit));
      // Contact shadow from the shells in front.
      s = mix(s, vec3(0.32, 0.31, 0.48), occl * 0.55);
      tone = mix(tone, 0.5, occl * 0.55);
      if (at.z < 0.5) {
        // The hall behind sits in a little more haze.
        s = mix(s, vec3(0.5, 0.48, 0.66), 0.14);
      } else if (at.z > 1.5) {
        s *= 0.88;
        tone *= 0.92;
      }
      // A dark seam where this shell passes in front of another.
      if (behind && edge < 0.9) {
        s = vec3(0.2, 0.2, 0.33);
        tone = 0.36;
      }
      return vec4(s, tone);
    }
  }

  // The podium, with the broad stairs falling to the forecourt at its south
  // end, a lamp-lit top edge and a dim row of foyer lights.
  float uL = -1.56;
  float uR = 1.0;
  float stairs = 0.3;
  float base = syHz + syRh;
  float topAt = podTop;
  if (u < uL) {
    topAt = mix(podTop, base, clamp((uL - u) / stairs, 0.0, 1.0));
  }
  if (row >= syHzRow && y < topAt && u > uL - stairs && u < uR) {
    cover = 1.0;
    float depth = (topAt - y) / max(topAt - syHz, syRh);
    vec3 stone = mix(vec3(0.66, 0.54, 0.5), vec3(0.26, 0.24, 0.34), smoothstep(0.0, 1.0, depth));
    stone *= 0.9 + 0.2 * syHash(vec2(col, row) + 3.0);
    float tone = 0.45 + 0.18 * (1.0 - depth);
    if (u < uL) {
      // Each step catches the light on its edge.
      stone *= mod(row, 2.0) < 0.5 ? 1.12 : 0.8;
    } else if (row == syPodRow - 1.0 && syHash(vec2(col, 1.0)) < 0.45) {
      return vec4(vec3(1.0, 0.8, 0.55), 0.8);
    } else if (row == syPodRow - 2.0 - floor((syPodRow - syHzRow) * 0.4) && syHash(vec2(col, 2.0)) < 0.3) {
      return vec4(vec3(0.95, 0.66, 0.4), 0.6);
    }
    return vec4(stone, tone);
  }
  return vec4(0.0);
}

// Everything above the water at a sample.
vec4 syAbove(float col, float row) {
  float x = syX(col);
  float y = syY(row);
  vec3 sky = sySky(x, y);
  sky += vec3(1.0, 0.82, 0.66) * syBloom(x, y) * 0.12;
  vec4 c = vec4(sky, syTone(sky));

  // Faint stars in the upper sky.
  float h = (y - syHz) / (1.0 - syHz);
  float sh = syHash(vec2(col, row));
  if (h > 0.45 && sh < 0.006 * smoothstep(0.45, 0.9, h)) {
    float tw = 0.6 + 0.4 * sin(syT * 0.9 + sh * 400.0);
    c = vec4(mix(c.rgb, vec3(0.86, 0.9, 1.0), 0.75 * tw), 0.36 + 0.26 * tw);
  }

  float cover;
  vec4 city = syCity(col, row, x, y, sky, cover);
  if (cover > 0.0) {
    c = city;
  }

  // The far shore under the bridge: a low dark line of trees and houses.
  float shore = syHz + syRh * (1.0 + 2.5 * fbm(vec2(x * 6.0, 4.4)));
  if (y < shore && city.a == 0.0) {
    vec3 s = mix(vec3(0.12, 0.13, 0.26), sky, 0.3);
    c = vec4(s, 0.16);
    if (syHash(vec2(col, row) + 6.0) < 0.07) {
      c = vec4(mix(vec3(1.0, 0.78, 0.5), sky, 0.4), 0.42);
    }
  }

  vec4 b = syBridge(col, row, x, y, sky, cover);
  if (cover > 0.0) {
    c = b;
  }
  vec4 o = syOpera(col, row, x, y, cover);
  if (cover > 0.0) {
    c = o;
  }
  return c;
}

vec4 syFerry(float col, float row) {
  float fRow = syHzRow - max(4.0, floor(0.1 * syN.y));
  float span = syAsp + 0.5;
  float fx = span * (0.5 - fract(syT * 0.008 / span + 0.38));
  float dx = col - syColOf(fx);
  float dr = row - fRow;
  // Heading left: a green hull, a cream deckhouse with its windows lit, the
  // wheelhouse on top and a white masthead light.
  vec3 green = vec3(0.12, 0.34, 0.24);
  vec3 cream = vec3(0.88, 0.82, 0.66);
  if (dr == 0.0 && dx >= -5.0 && dx <= 7.0) {
    return vec4(green, 0.5);
  }
  if (dr == 1.0 && dx >= -6.0 && dx <= 7.0) {
    if (mod(dx, 2.0) < 0.5 && dx > -5.0 && dx < 6.0) {
      return vec4(vec3(1.0, 0.8, 0.5), 0.72);
    }
    return vec4(cream, 0.6);
  }
  if (dr == 2.0 && dx >= -3.0 && dx <= 5.0) {
    if (mod(dx, 2.0) > 0.5) {
      return vec4(vec3(1.0, 0.82, 0.55), 0.66);
    }
    return vec4(cream * 0.9, 0.55);
  }
  if (dr == 3.0 && dx >= 0.0 && dx <= 2.0) {
    return vec4(green * 1.3, 0.48);
  }
  if (dr == 4.0 && dx == 1.0) {
    return vec4(vec3(1.0, 0.97, 0.9), 0.75);
  }
  // A faint wake trailing behind, widening with distance.
  if (dx > 7.0 && dx < 30.0) {
    float back = dx - 7.0;
    float w = 0.6 + back * 0.08;
    if (abs(dr) < w && mod(back + floor(syT * 2.0), 3.0) < 1.0) {
      return vec4(vec3(0.6, 0.64, 0.78) * (1.0 - back / 26.0), 0.3 * (1.0 - back / 30.0) + 0.08);
    }
  }
  // The lit windows' reflection, a short broken streak.
  if (dr < 0.0 && dr > -6.0 && dx >= -5.0 && dx <= 6.0
      && syHash(vec2(col, row + floor(syT * 3.0))) < 0.5) {
    return vec4(vec3(0.92, 0.72, 0.48) * (1.0 + dr * 0.13), 0.36);
  }
  return vec4(0.0);
}

vec4 syScene(vec2 uv, vec2 res, float t, float ferry) {
  sySetup(res, t);
  float col = floor(uv.x * syN.x);
  float row = floor(uv.y * syN.y);
  if (row >= syHzRow) {
    return syAbove(col, row);
  }
  // The harbour: everything above, mirrored at the horizon and broken into
  // horizontal streaks by slow ripples that grow toward the viewer.
  float x = syX(col);
  float y = syY(row);
  float depth = (syHz - y) / syHz;
  float r1 = snoise(vec2(x * 1.4 + t * 0.01, row * 0.42 - t * 0.3));
  float r2 = snoise(vec2(x * 3.5 - t * 0.02, row * 0.9 + t * 0.2));
  float shiftR = floor(r1 * (0.5 + 1.5 * depth) + 0.5);
  float shiftC = floor(r2 * (0.5 + 1.4 * depth) + 0.5);
  float mr = max(2.0 * syHzRow - 1.0 - row + shiftR, syHzRow);
  vec4 m = syAbove(col + shiftC, mr);
  float streak = 0.8 + 0.22 * snoise(vec2(x * 1.6 - t * 0.015, row * 0.6 + t * 0.16));
  vec3 water = mix(vec3(0.07, 0.09, 0.2), vec3(0.035, 0.045, 0.11), depth);
  float k = clamp(0.74 * streak * (1.0 - 0.35 * depth), 0.0, 1.0);
  vec3 c = mix(water, m.rgb * vec3(0.8, 0.83, 0.96), k);
  float tone = mix(syTone(water), m.a * 0.9, k);
  // The afterglow's path on the water: a warm column that widens toward
  // the viewer, broken into glints by the ripples.
  float path = exp(-pow((x - syGlowX) * 2.0 / (0.5 + 0.9 * depth), 2.0));
  float glint = smoothstep(0.05, 0.75, snoise(vec2(x * 7.0 + t * 0.03, row * 0.8 - t * 0.4)));
  glint *= path * (1.0 - 0.7 * depth);
  c = mix(c, vec3(1.0, 0.72, 0.48), glint * 0.85);
  tone = mix(tone, 0.85, glint * 0.9);
  if (ferry > 0.5) {
    vec4 b = syFerry(col, row);
    if (b.a > 0.0) {
      c = b.rgb;
      tone = b.a;
    }
  }
  return vec4(c, tone);
}

vec2 syCacheUv = vec2(-1.0);
float syCacheT = -1.0;
vec4 syCacheValue = vec4(0.0);

vec4 syShade(vec2 uv, vec2 res, float t) {
  if (uv == syCacheUv && t == syCacheT) {
    return syCacheValue;
  }
  vec4 c = syScene(uv, res, t, sydFerryOn);
  // A little per-dot variation in brightness and hue, as in a print, so
  // wide gradients don't read as flat bands.
  vec2 cell = floor(uv * syN);
  float j = syHash(cell + 31.7) - 0.5;
  float k = syHash(cell + 77.1) - 0.5;
  c.rgb *= 1.0 + j * 0.18;
  c.rgb += vec3(k, -k * 0.3, -k) * 0.04;
  syCacheUv = uv;
  syCacheT = t;
  syCacheValue = vec4(c.rgb * sydIntensity, c.a * sqrt(sydIntensity));
  return syCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return syShade(uv, res, t).a;
}
`;

// Dots carry tone by size, so a dim colour on a small dot almost vanishes.
// A gentle lift keeps the deep sky a quiet field of faint dots without
// turning it into a bright texture.
const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 c = syShade(uv, res, t).rgb;
  float peak = max(max(c.r, c.g), c.b);
  return clamp(c / pow(max(peak, 0.15), 0.25), 0.0, 1.0);
}
`;

// Modes that paint the scene's own colours need its blue hour behind them
// in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const DUSK = "#04071a";
const DUSK_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #070a1e 0%, #18204a 40%, #5a4772 62%, #c48a74 69%, #0a0e22 70%, #04071a 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface SydneyProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** The ferry crossing the harbour. Default `true`. */
  ferry?: boolean;
  /**
   * The surface behind the glyphs. Default: the scene's blue hour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for `dots` and other ramps, `false` for Braille
   * and quadrants, which would stretch.
   */
  square?: boolean;
  /** Shown without WebGL and until the first frame. Default: a blue-hour gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Sydney Harbour at blue hour. The Opera House's sails catch a soft warm
 * glow on the left, the Harbour Bridge spans the water on the right with
 * its lamps lit, the city's towers stand in cool haze behind, and the
 * harbour mirrors the sails and the arch under a peach afterglow.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Sydney = ({
  intensity = 1,
  ferry = true,
  paper,
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  ramp,
  cell = 7,
  dither,
  square,
  fps = 24,
  stillTime = 30,
  // Part of the shared scene props; nothing here follows the pointer.
  interactive: _interactive,
  fallback = FALLBACK,
  ...props
}: SydneyProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  // Dithering blends dot sizes into smooth gradients on ramps; Braille and
  // quadrants would turn it into an even mesh, so they keep the threshold.
  const isRamp = resolveCharset(charset, chars).kind === "ramp";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        sydFerryOn: ferry ? 1 : 0,
        sydIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "ember" : undefined)}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      dither={dither ?? (isRamp ? "blue-noise" : "none")}
      square={square ?? isRamp}
      fps={fps}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
