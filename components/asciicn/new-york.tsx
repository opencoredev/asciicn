"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Manhattan at dusk from Brooklyn, across the East River. The view is one
// function of p = (x in box heights from the left edge, y up) with the
// river's far shore at nyS. Above it, near to far: a low waterfront row,
// the three landmarks (the Empire State Building, the Chrysler Building,
// One World Trade Center), two rows of towers and a hazy back row, then
// the sky. Below it the river mirrors all of that through ripples. Every
// layer returns a colour; tone follows the colour's brightness, so a dot's
// size and its light agree and the darkest water still carries a faint dot.
//
// Shapes are cut on the engine's sample grid (`nySw` wide, `nyPx` tall)
// and windows on the glyph grid (`nyCw`, `nyCh`), so edges stay sharp and
// every window is one glyph in any charset.
const SCENE = `
// Set once per sample by nyScene, read by every layer.
float nyA = 1.0;
float nyS = 0.3;
float nyT = 0.0;
float nyPx = 0.01;
float nySw = 0.01;
float nyCw = 0.01;
float nyCh = 0.01;
float nyEsX = 0.0;
float nyChX = 0.0;
float nyWtX = 0.0;
float nySunX = 0.0;
// The landmarks' scale: 1 on wide boxes, smaller on tall phones so all
// three fit beside a headline.
float nyK = 1.0;
// How far the layer that drew the current sample stands, 0 near to 1 lost
// in the haze. Farther layers draw smaller dots.
float nyFar = 0.0;
// 1 when the sample shows open sky, which takes a stronger size jitter so
// its gradient blends; buildings keep even dots and read as shapes.
float nySkyHit = 0.0;

// A stable random value that keeps its spread for large inputs, unlike a
// sin-based hash.
float nyHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// A centre snapped to a sample centre, and a half width that covers an
// odd number of samples around it, so every landmark is symmetric.
float nySnapX(float x) {
  return (floor(x / nySw) + 0.5) * nySw;
}

float nyHalf(float w) {
  return (floor(w / nySw) + 0.5) * nySw;
}

// A landmark half width at the current scale.
float nyHk(float w) {
  return nyHalf(w * nyK);
}

float nySq(float v) {
  return v * v;
}

// The dusk sky from the horizon (h = 0) to the top of the box (h = 1):
// amber, coral, mauve, violet, dusk blue, deep blue.
vec3 nySkyRamp(float h) {
  h = clamp(h, 0.0, 1.0);
  vec3 c0 = vec3(0.88, 0.58, 0.34);
  vec3 c1 = vec3(0.78, 0.43, 0.37);
  vec3 c2 = vec3(0.6, 0.36, 0.5);
  vec3 c3 = vec3(0.38, 0.31, 0.58);
  vec3 c4 = vec3(0.13, 0.14, 0.32);
  vec3 c5 = vec3(0.045, 0.05, 0.12);
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.16, h));
  c = mix(c, c2, smoothstep(0.1, 0.36, h));
  c = mix(c, c3, smoothstep(0.3, 0.55, h));
  c = mix(c, c4, smoothstep(0.48, 0.76, h));
  return mix(c, c5, smoothstep(0.62, 1.1, h));
}

// The sun has just set behind Midtown's west side: a wide warm glow on the
// horizon, brightest just above the skyline.
float nySunGlow(vec2 p) {
  vec2 d = (p - vec2(nySunX, nyS + 0.025)) * vec2(0.5, 1.35);
  float r = dot(d, d);
  return exp(-r * 10.0) * 0.3 + exp(-r * 110.0) * 0.4;
}

// The soft floodlit halo around the Empire State's crown, breathing slowly.
float nySpireGlow(vec2 p) {
  vec2 d = (p - vec2(nyEsX, nyS + 0.46 * nyK)) * vec2(1.0, 0.7) / nyK;
  float pulse = 0.85 + 0.15 * sin(nyT * 0.45);
  return exp(-dot(d, d) * 520.0) * pulse;
}

vec3 nySky(vec2 p) {
  nySkyHit = 1.0;
  float h = (p.y - nyS) / (1.0 - nyS);
  vec3 c = nySkyRamp(h - 0.05 * exp(-nySq((p.x - nySunX) / 0.5)));
  // Long stratus bands, lit pink from below near the sun, drifting east.
  float n = fbm(vec2(p.x * 0.7 + nyT * 0.004, p.y * 5.0 + 3.0));
  float band = smoothstep(0.18, 0.36, h) * (1.0 - smoothstep(0.58, 0.8, h));
  float cloud = smoothstep(0.48, 0.72, n) * band;
  float near = exp(-nySq((p.x - nySunX) / 0.7));
  vec3 lit = mix(c * 1.3 + vec3(0.06, 0.02, 0.04), vec3(1.0, 0.6, 0.5), near * 0.8);
  c = mix(c, lit, cloud * 0.35);
  c += vec3(1.0, 0.5, 0.2) * nySunGlow(p) * 0.5;
  c += vec3(1.0, 0.8, 0.5) * nySpireGlow(p) * 0.2;
  // A few stars where the sky has gone deep blue.
  vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
  float star = step(0.992, nyHash(cell + 41.7)) * smoothstep(0.55, 0.85, h) * (1.0 - cloud);
  float twinkle = 0.55 + 0.45 * sin(nyT * (0.5 + nyHash(cell + 3.3)) + nyHash(cell) * 40.0);
  return c + vec3(0.75, 0.8, 1.0) * star * twinkle * 0.55;
}

// Midtown and Lower Manhattan rise in two clusters with the low Village
// between them.
float nyEnv(float x) {
  float mid = exp(-nySq((x - (nyEsX + nyChX) * 0.5) / (0.3 * nyK)));
  float down = exp(-nySq((x - nyWtX) / (0.24 * nyK)));
  return 0.2 + 0.8 * max(mid, down * 0.85);
}

// One row of buildings on lots of lotW. Each lot holds one building 50 to
// 100 percent of its width, some with a setback crown. Heights follow a
// slow noise along the row as well as the lot, so rooflines rise and fall
// in clusters, and a few roof cells carry a tank or a plant room. Returns 1
// inside, with the building's id, roof height and edges.
float nyRow(vec2 p, float lotW, float base, float span, float seed, float env, out float bid, out float top, out vec2 edges) {
  float i = floor(p.x / lotW);
  vec2 key = vec2(i, seed);
  float w = lotW * (0.5 + 0.5 * nyHash(key + 0.13));
  float c = (i + 0.5) * lotW + (nyHash(key + 0.71) - 0.5) * (lotW - w);
  float l = floor((c - w * 0.5) / nySw) * nySw;
  float r = floor((c + w * 0.5) / nySw) * nySw;
  float drift = 0.5 + 0.5 * snoise(vec2(c * 2.6 / nyK + seed * 7.1, seed));
  float tall = mix(nyHash(key + 0.37), drift, 0.6);
  top = nyS + (base + span * tall * tall * mix(1.0, nyEnv(c), env)) * nyK;
  float setback = step(0.5, nyHash(key + 0.91));
  float inset = floor(w * 0.22 / nySw) * nySw * setback;
  float shoulder = top - (0.02 + 0.035 * nyHash(key + 0.5)) * setback * nyK;
  float col = floor(p.x / nyCw);
  float bump = step(0.86, nyHash(vec2(col, seed + 3.0))) * nyCh;
  bool body = p.x >= l && p.x < r && p.y < shoulder;
  bool crown = p.x >= l + inset && p.x < r - inset && p.y < top + bump * (1.0 - setback);
  bid = i * 3.17 + seed * 11.0;
  edges = vec2(l, r);
  return (body || crown) ? 1.0 : 0.0;
}

// Window light: warm lamps, amber, soft white and a few cool office tubes.
vec3 nyTint(float h) {
  if (h < 0.42) {
    return vec3(1.0, 0.74, 0.4);
  }
  if (h < 0.62) {
    return vec3(1.0, 0.86, 0.6);
  }
  if (h < 0.8) {
    return vec3(0.98, 0.6, 0.32);
  }
  return vec3(0.66, 0.8, 1.0);
}

// How lit one window is, from 0 to 1. Most hold their state; about one in
// sixteen re-rolls on its own clock of 60 to 120 seconds and fades over a
// few seconds, so only a handful change at a time.
float nyLit(vec2 cell, float bid, float share) {
  vec2 k = cell + vec2(bid * 1.7, bid * 0.31);
  float floorShare = share * (0.35 + 1.3 * nyHash(vec2(cell.y, bid) + 7.1));
  float clock = nyHash(k + 5.3);
  if (clock > 0.06) {
    return step(nyHash(k), floorShare);
  }
  float phase = nyT / (60.0 + 60.0 * nyHash(k + 9.2)) + nyHash(k + 2.9);
  float slot = floor(phase);
  float now = step(nyHash(k + slot * 1.37), floorShare);
  float was = step(nyHash(k + (slot - 1.0) * 1.37), floorShare);
  return mix(was, now, smoothstep(0.0, 0.05, fract(phase)));
}

// A facade with windows. body is the wall colour, haze how far the row
// stands, 0 near and 1 lost in the dusk.
vec3 nyFacade(vec2 p, float bid, vec2 edges, float top, vec3 body, float haze, float share) {
  vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
  float type = nyHash(vec2(bid, 1.9));
  // Some towers have piers between window columns, some lit bands of floors.
  bool pier = type > 0.7 && mod(cell.x, 2.0) > 0.5;
  bool edge = p.x < edges.x + nyCw || p.x >= edges.y - nyCw || p.y > top - nyCh;
  float sky = smoothstep(top - 0.12, top, p.y);
  // The face turned toward the afterglow is lighter and warmer than the
  // face turned away from it.
  float centre = (edges.x + edges.y) * 0.5;
  float lit = step(0.0, (p.x - centre) * (nySunX - centre));
  vec3 face = mix(vec3(0.8), vec3(1.2, 1.08, 1.0), lit);
  vec3 wall = body * face * (0.85 + 0.25 * nyHash(cell + 0.5)) * (0.9 + 0.3 * sky);
  if (pier || edge) {
    return wall;
  }
  float on = nyLit(cell, bid, share);
  float warm = nyHash(vec2(bid, 4.4));
  float pick = fract(nyHash(cell + 8.8) * 0.6 + warm * 0.7);
  vec3 light = nyTint(pick) * (0.5 + 0.5 * nyHash(cell + 2.2));
  light = mix(light, body * 1.6, haze * 0.85);
  return mix(wall, light, on);
}

// The rim of a backlit tower: the edge that faces the afterglow catches it.
vec3 nyRim(vec2 p, vec2 edges, float top, vec3 c) {
  float facing = p.x < nySunX ? edges.y - nyCw : edges.x;
  bool side = p.x < nySunX ? p.x >= facing : p.x < facing + nyCw;
  bool roof = p.y > top - nyCh;
  vec2 d = (vec2(p.x, top) - vec2(nySunX, nyS)) * vec2(0.45, 1.0);
  float glow = exp(-dot(d, d) * 6.0);
  if (roof) {
    return c + vec3(1.0, 0.6, 0.34) * glow * 0.45;
  }
  if (side) {
    return c + vec3(1.0, 0.62, 0.36) * glow * 0.25;
  }
  return c;
}

// The Empire State Building: setbacks, a floodlit top, a crown in two
// tiers, the mast and the antenna with a slow red light.
vec4 nyEmpire(vec2 p) {
  float x = abs(p.x - nyEsX);
  float y = (p.y - nyS) / nyK;
  float lit = 0.0;
  vec3 c = vec3(0.0);
  if (y < 0.36 && x < nyHk(0.042)) {
    vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
    vec3 body = vec3(0.13, 0.11, 0.21);
    // The central recess and the piers.
    if (x < nyHk(0.006) || mod(cell.x, 2.0) > 0.5) {
      c = body * 1.1;
    } else {
      c = mix(body, nyTint(nyHash(cell + 0.7) * 0.75) * 0.9, nyLit(cell, 71.0, 0.62));
    }
    // Floodlights wash the top floors gold, fading down the shaft.
    float wash = smoothstep(0.16, 0.36, y);
    c = mix(c, vec3(0.95, 0.72, 0.4) * (0.7 + 0.3 * nyHash(cell)), wash * wash * 0.85);
    lit = 1.0;
  } else if (y < 0.385 && x < nyHk(0.031)) {
    c = vec3(0.98, 0.78, 0.45);
    lit = 1.0;
  } else if (y < 0.41 && x < nyHk(0.022)) {
    c = vec3(1.0, 0.84, 0.52);
    lit = 1.0;
  } else if (y < 0.44 && x < nyHk(0.015)) {
    float stripe = mod(floor(p.x / nySw), 2.0);
    c = mix(vec3(1.0, 0.9, 0.62), vec3(0.9, 0.7, 0.42), stripe);
    lit = 1.0;
  } else if (y < 0.465 && x < nyHk(0.009)) {
    c = vec3(1.0, 0.95, 0.8);
    lit = 1.0;
  } else if (y < 0.5 && x < nyHk(0.004)) {
    c = vec3(0.95, 0.92, 0.85);
    lit = 1.0;
  } else if (y < 0.55 && x < nySw * 0.5) {
    c = vec3(0.42, 0.38, 0.5);
    if ((0.55 - y) * nyK < nyPx * 2.0) {
      c = vec3(1.0, 0.25, 0.2) * (0.55 + 0.45 * sin(nyT * 1.1));
    }
    lit = 1.0;
  }
  c *= 0.93 + 0.07 * sin(nyT * 0.45) * step(0.3, y);
  return vec4(c, lit);
}

// The Chrysler Building: a shaft, then the crown's stacked arches, each
// outlined in light with triangular windows, under the steel needle.
vec4 nyChrysler(vec2 p) {
  float x = abs(p.x - nyChX);
  float y = (p.y - nyS) / nyK;
  vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
  if (y < 0.15 && x < nyHk(0.04)) {
    return vec4(nyFacade(p, 23.0, vec2(nyChX - nyHk(0.04), nyChX + nyHk(0.04)), nyS + 0.15 * nyK, vec3(0.12, 0.1, 0.2), 0.0, 0.45), 1.0);
  }
  if (y < 0.3 && x < nyHk(0.03)) {
    return vec4(nyFacade(p, 29.0, vec2(nyChX - nyHk(0.03), nyChX + nyHk(0.03)), nyS + 0.3 * nyK, vec3(0.13, 0.11, 0.21), 0.0, 0.45), 1.0);
  }
  float crown = 0.11;
  if (y < 0.3) {
    return vec4(0.0);
  }
  if (y < 0.3 + crown) {
    float u = (y - 0.3) / crown * 4.0;
    float tier = floor(u);
    float v = fract(u);
    float hw = nyHk(0.03 * (1.0 - 0.21 * tier));
    float arch = hw * sqrt(max(0.0, 1.0 - v * v * 0.92));
    if (x < arch) {
      vec3 steel = vec3(0.46, 0.44, 0.58);
      // The arch line, one sample inside its outline, is lit white.
      bool line = x > arch - nySw * 1.2 || v > 0.86;
      bool tri = mod(cell.x + cell.y, 2.0) < 0.5 && v < 0.7;
      vec3 c = line ? vec3(0.98, 0.97, 1.0) : (tri ? vec3(1.0, 0.92, 0.72) : steel);
      return vec4(c * (0.92 + 0.08 * sin(nyT * 0.6 + tier)), 1.0);
    }
    return vec4(0.0);
  }
  if (y < 0.3 + crown + 0.07 && x < nySw * 0.5) {
    return vec4(vec3(0.82, 0.82, 0.92), 1.0);
  }
  return vec4(0.0);
}

// One World Trade Center: a tapering glass tower whose facets catch the
// afterglow in a long V, a lit parapet and a spire with a white light.
vec4 nyTrade(vec2 p) {
  float y = (p.y - nyS) / nyK;
  float H = 0.43;
  float dx = abs(p.x - nyWtX);
  if (y < H) {
    float u = y / H;
    float hw = nyHk(mix(0.05, 0.028, u));
    if (dx >= hw) {
      return vec4(0.0);
    }
    float facet = hw * u;
    // Blue-steel glass, dark against the afterglow so the tower reads as
    // a silhouette. The front facets are lighter than the sides and the
    // half facing the afterglow takes a warm tint.
    float sunward = mix(1.0 - step(nyWtX, p.x), step(nyWtX, p.x), step(nyWtX, nySunX));
    float front = 1.0 - step(facet, dx);
    vec3 glass = mix(vec3(0.17, 0.19, 0.36), vec3(0.11, 0.12, 0.26), u);
    glass = mix(glass, glass * vec3(1.9, 1.3, 1.0), sunward * 0.6);
    vec3 c = glass * mix(0.6, 1.0, front);
    if (abs(dx - facet) < nySw * 0.75) {
      c = mix(c, vec3(1.0, 0.84, 0.66), 0.6);
    }
    vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
    c = mix(c, vec3(0.75, 0.86, 1.0) * 0.8, nyLit(cell, 53.0, 0.2) * step(facet, dx));
    if ((H - y) * nyK < nyCh) {
      c = vec3(0.92, 0.95, 1.0);
    }
    return vec4(c, 1.0);
  }
  if (y < H + 0.15 && dx < nySw * 0.5) {
    vec3 c = vec3(0.55, 0.55, 0.66);
    if ((H + 0.15 - y) * nyK < nyPx * 2.0) {
      c = vec3(1.0) * (0.7 + 0.3 * sin(nyT * 0.8));
    }
    return vec4(c, 1.0);
  }
  return vec4(0.0);
}

// Haze between the viewer and a row: the sky behind it, cooled toward
// lavender and kept a step darker so far towers still read as shapes,
// thicker near the water.
vec3 nyHaze(vec3 c, vec2 p, float haze) {
  vec3 air = mix(nySkyRamp((p.y - nyS) / (1.0 - nyS)), vec3(0.42, 0.4, 0.62), 0.35);
  air = (air + vec3(1.0, 0.5, 0.2) * nySunGlow(p) * 0.16) * 0.62;
  float low = 1.0 - smoothstep(nyS, nyS + 0.1, p.y);
  return mix(c, air, clamp(haze + low * 0.22, 0.0, 1.0));
}

// Everything above the water at p, near to far.
vec3 nyCity(vec2 p, float share) {
  float bid;
  float top;
  vec2 edges;
  // The waterfront: low blocks and the drive's lights along the shore.
  if (p.y < nyS + nyCh) {
    vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
    float car = nyHash(cell + 6.1);
    vec3 c = vec3(0.09, 0.07, 0.14);
    if (car > 0.72) {
      c = car > 0.9 ? vec3(1.0, 0.32, 0.22) : vec3(1.0, 0.9, 0.7);
      c *= 0.7 + 0.3 * sin(nyT * 0.7 + car * 30.0);
    }
    return c;
  }
  nyFar = 0.0;
  nySkyHit = 0.0;
  if (nyRow(p, 0.032, 0.012, 0.045, 1.0, 0.0, bid, top, edges) > 0.5) {
    vec3 c = nyFacade(p, bid, edges, top, vec3(0.07, 0.062, 0.125), 0.0, share * 0.7);
    return nyHaze(c, p, 0.0);
  }
  vec4 lm = nyEmpire(p);
  if (lm.a > 0.5) {
    return nyHaze(lm.rgb, p, 0.04);
  }
  lm = nyChrysler(p);
  if (lm.a > 0.5) {
    return nyHaze(lm.rgb, p, 0.06);
  }
  nyFar = 0.1;
  if (nyRow(p, 0.04, 0.015, 0.17, 2.0, 1.0, bid, top, edges) > 0.5) {
    vec3 c = nyFacade(p, bid, edges, top, vec3(0.11, 0.095, 0.19), 0.1, share);
    return nyHaze(nyRim(p, edges, top, c), p, 0.1);
  }
  nyFar = 0.15;
  lm = nyTrade(p);
  if (lm.a > 0.5) {
    return nyHaze(lm.rgb, p, 0.14);
  }
  // Three far rows, each hazier, flatter in value and quieter than the
  // one in front, so the city recedes into the dusk.
  nyFar = 0.4;
  if (nyRow(p, 0.034, 0.03, 0.22, 3.0, 1.0, bid, top, edges) > 0.5) {
    vec3 c = nyFacade(p, bid, edges, top, vec3(0.15, 0.13, 0.25), 0.4, share * 0.6);
    return nyHaze(nyRim(p, edges, top, c), p, 0.48);
  }
  nyFar = 0.65;
  if (nyRow(p, 0.028, 0.045, 0.26, 4.0, 1.0, bid, top, edges) > 0.5) {
    vec3 c = nyFacade(p, bid, edges, top, vec3(0.2, 0.17, 0.3), 0.7, share * 0.3);
    return nyHaze(nyRim(p, edges, top, c), p, 0.7);
  }
  nyFar = 0.85;
  if (nyRow(p, 0.022, 0.06, 0.3, 5.0, 1.0, bid, top, edges) > 0.5) {
    return nyHaze(nyRim(p, edges, top, vec3(0.24, 0.2, 0.34)), p, 0.92);
  }
  nyFar = 0.0;
  return nySky(p);
}

// The ferry: hull, a cabin with a row of lit windows and the wheelhouse,
// crossing west to east. Returns colour and 1 where it is.
float nyFerryX() {
  return mod(nyT * 0.011 + 0.3 * nyA - 0.18, nyA + 0.3) - 0.15;
}

vec4 nyFerry(vec2 p) {
  float fy = nyS - 0.1;
  float bow = nyFerryX();
  float u = bow - p.x;
  float y = p.y - fy;
  if (u < 0.0 || u > 0.09 || y < 0.0) {
    return vec4(0.0);
  }
  if (y < 0.013 && u > y * 0.9) {
    vec3 hull = y < 0.005 ? vec3(0.12, 0.2, 0.42) : vec3(0.68, 0.7, 0.8);
    return vec4(hull, 1.0);
  }
  if (y < 0.027 && u > 0.016 && u < 0.078) {
    vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
    bool win = y > 0.016 && y < 0.024 && mod(cell.x, 2.0) < 0.5;
    return vec4(win ? vec3(1.0, 0.84, 0.55) : vec3(0.78, 0.78, 0.86), 1.0);
  }
  if (y < 0.036 && u > 0.03 && u < 0.046) {
    return vec4(vec3(0.82, 0.82, 0.9), 1.0);
  }
  return vec4(0.0);
}

// The river: the city mirrored through ripples that break it into long
// dashes, a glitter path under the afterglow, the ferry and its wake.
vec3 nyRiver(vec2 p, float share) {
  float depth = nyS - p.y;
  float row = floor(p.y / nyCh);
  // A dark lip right under the far shore.
  if (depth < nyCh) {
    return vec3(0.02, 0.02, 0.05);
  }
  float wob = snoise(vec2(row * 0.43, p.x * 1.6 + nyT * 0.12)) * (0.004 + depth * 0.04);
  vec2 q = vec2(p.x + wob, nyS + depth * 1.25);
  vec3 mirror = nyCity(q, share);
  // Lights smear down the water: take the brightest of the samples above.
  vec3 smear = max(mirror, nyCity(q + vec2(0.0, nyCh * 2.0), share) * 0.9);
  smear = max(smear, nyCity(q + vec2(0.0, nyCh * 4.0), share) * 0.75);
  float ripple = snoise(vec2(p.x * 7.0 + nyT * 0.05, p.y * 95.0 + nyT * 0.35));
  float dash = smoothstep(-0.25, 0.55, ripple);
  float near = clamp(depth / nyS, 0.0, 1.0);
  vec3 c = mirror * mix(0.5, 0.34, near) * (0.75 + 0.35 * dash) * vec3(0.78, 0.85, 1.1);
  float bright = dot(smear, vec3(0.3, 0.55, 0.15));
  c += smear * smoothstep(0.3, 0.8, bright) * dash * mix(0.7, 0.5, near);
  // The landmarks' lights run down the water in long broken columns that
  // widen toward the viewer.
  vec3 cols = vec3(1.0, 0.76, 0.4) * exp(-nySq((p.x - nyEsX) / (0.014 * nyK + depth * 0.05)));
  cols += vec3(0.86, 0.88, 1.0) * 0.75 * exp(-nySq((p.x - nyChX) / (0.011 * nyK + depth * 0.04)));
  cols += vec3(0.8, 0.86, 1.0) * 0.4 * exp(-nySq((p.x - nyWtX) / (0.01 * nyK + depth * 0.03)));
  float streak = smoothstep(0.05, 0.7, snoise(vec2(p.x * 16.0 + nyT * 0.04, p.y * 75.0 + nyT * 0.3)));
  c += cols * streak * 0.7 * (1.0 - near * 0.4) * smoothstep(0.0, 0.06, depth);
  // The afterglow's glitter path.
  float path = exp(-nySq((p.x - nySunX) / (0.04 + depth * 0.3)));
  c += vec3(1.0, 0.5, 0.22) * path * smoothstep(0.0, 0.7, ripple) * (1.0 - near * 0.5) * 0.6;
  c += vec3(0.02, 0.025, 0.06);
  if (nyFerryOn > 0.5) {
    float bow = nyFerryX();
    float fy = nyS - 0.1;
    vec4 boat = nyFerry(p);
    if (boat.a > 0.5) {
      return boat.rgb;
    }
    // The wake behind the stern and the cabin lights' reflection below.
    float behind = bow - 0.09 - p.x;
    float wake = smoothstep(0.004, 0.0, abs(p.y - fy - 0.002)) * smoothstep(0.18, 0.0, behind) * step(0.0, behind);
    c += vec3(0.75, 0.8, 0.9) * wake * (0.4 + 0.6 * nyHash(floor(vec2(p.x / nyCw, nyT * 2.0))));
    float under = fy - p.y;
    if (under > 0.0 && under < 0.035 && bow - p.x > 0.0 && bow - p.x < 0.085) {
      c = mix(c, vec3(0.9, 0.7, 0.45), 0.45 * dash * (1.0 - under / 0.035));
    }
  }
  return c;
}

vec2 nyCacheUv = vec2(-1.0);
float nyCacheT = -1.0;
vec4 nyCacheValue = vec4(0.0);

vec4 nyScene(vec2 uv, vec2 res, float t) {
  if (uv == nyCacheUv && t == nyCacheT) {
    return nyCacheValue;
  }
  nyA = res.x / res.y;
  nyPx = 1.0 / res.y;
  nySw = nyA / ascii_samples.x;
  nyCw = nySw * nyGrid.x;
  nyCh = nyPx * nyGrid.y;
  nyT = t;
  nyK = mix(0.72, 1.0, smoothstep(0.55, 1.3, nyA));
  nyS = floor(mix(0.24, 0.28, smoothstep(0.6, 1.4, nyA)) / nyCh) * nyCh;
  // The landmarks stand clear of the middle half, where a headline goes:
  // One World Trade Center to the west, the Empire State and the Chrysler
  // Building to the east. The afterglow sits low on the west side, under
  // the headline, with only the low Village between.
  float mid = nyA * 0.5;
  nyEsX = nySnapX(mid + nyA * 0.29);
  nyChX = nySnapX(min(nyEsX + max(nyA * 0.085, 0.075), nyA - 0.04 * nyK - nySw * 2.0));
  nyWtX = nySnapX(mid - nyA * 0.33);
  nySunX = mid - nyA * 0.2;
  vec2 p = vec2(uv.x * nyA, uv.y);
  float share = nyWindows * 0.85;
  vec3 c;
  if (p.y < nyS) {
    c = nyRiver(p, share);
    nyFar = 0.15;
    nySkyHit = 0.5;
  } else {
    c = nyCity(p, share);
  }
  // Tone follows brightness. Dark air and shadow get the smallest dots,
  // or none in the deepest shadow; mid tones get small and medium dots;
  // only the afterglow, lit crowns and windows reach the largest. Far
  // layers draw smaller dots, and a little per-glyph jitter mixes sizes
  // instead of banding.
  float luma = dot(c, vec3(0.3, 0.55, 0.15));
  vec2 cell = floor(vec2(p.x / nyCw, p.y / nyCh));
  float tone = 0.07 + 0.6 * pow(max(luma, 0.0), 0.8) + 0.42 * smoothstep(0.52, 0.9, luma) + (nyHash(cell + 0.37) - 0.5) * mix(0.03, 0.16, nySkyHit);
  tone *= mix(1.0, 0.8, nyFar);
  // Lowering intensity dims the city but keeps its lights, so the crowns
  // still read behind a headline.
  float hi = smoothstep(0.4, 0.7, luma);
  c = min(c * 1.1, vec3(1.0)) * mix(mix(0.25, 1.0, nyIntensity), mix(0.7, 1.0, nyIntensity), hi);
  tone = clamp(tone, 0.0, 1.0) * mix(sqrt(nyIntensity), mix(0.8, 1.0, nyIntensity), hi);
  nyCacheUv = uv;
  nyCacheT = t;
  nyCacheValue = vec4(c, tone);
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

// Modes that paint the scene's own colours need its dusk behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const DUSK = "#070816";
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
        "linear-gradient(to bottom, #0b1236 0%, #3a2f5e 38%, #a35f6a 58%, #e9a05a 68%, #1a1426 70%, #0d0c1c 100%)",
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
  /** Cells as wide as they are tall, so the dots lay an even halftone lattice. Default `true`. */
  square?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's dusk navy in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
  /** Ignored: the skyline never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Manhattan at dusk across the East River. The skyline glows against a sky
 * fading from amber to deep blue, with the Empire State Building's lit
 * spire, the Chrysler Building's crown and One World Trade Center. Windows
 * change a few at a time, the river mirrors the city in broken streaks and
 * a ferry crosses slowly. Nothing reacts to the pointer.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const NewYork = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 7,
  square = true,
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
        // Samples per glyph: windows and the waterfront lights are one
        // glyph each in every charset.
        nyGrid: [gridX, gridY],
        nyIntensity: clamp(intensity, 0, 1),
        nyWindows: clamp(windows, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
    />
  );
};
