"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Dubai at dusk from the edge of the desert, painted in square units (x
// across from the middle of the box, y up from the bottom) and tested near
// to far: three dunes, the city behind them, the Burj Khalifa, then the sky.
// Every sample is snapped to the centre of its cell first, so towers cover
// whole columns and the needle of the spire never falls between two. The
// colour is worked out first and the dot size follows its brightness, as in
// a halftone print, so every cell carries at least a faint dot.
const SCENE = `
// Where the city stands, and the Burj Khalifa's height above it.
const float DB_BASE = 0.335;
const float DB_BURJ = 0.6;

// Set once per sample by dbScene and read by every layer.
float dbT;
float dbAspect;
float dbSw;
float dbSh;
float dbAxis;
float dbWide;
vec2 dbSun;
vec2 dbCell;
// The dot-size ceiling the building that was hit asks for.
float dbHold;
// 1 where the sky sample is a star, which keeps a slightly larger dot.
float dbStar;

// A stable random value; hash21 repeats every 50 samples on integers.
float dbHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The afterglow: gold where the sun went down, rose above it, deep blue
// overhead. h is 0 at the city's ground line and 1 at the top of the box.
vec3 dbSkyRamp(float h) {
  vec3 c = mix(vec3(0.74, 0.48, 0.5), vec3(0.7, 0.44, 0.52), smoothstep(0.0, 0.1, h));
  c = mix(c, vec3(0.62, 0.38, 0.56), smoothstep(0.06, 0.26, h));
  c = mix(c, vec3(0.46, 0.31, 0.6), smoothstep(0.2, 0.44, h));
  c = mix(c, vec3(0.22, 0.22, 0.52), smoothstep(0.4, 0.68, h));
  return mix(c, vec3(0.1, 0.12, 0.34), smoothstep(0.64, 1.0, h));
}

// How close a point is to the set sun, 0 to 1. Weaker on tall screens,
// where the glow would otherwise spread under a centred headline.
float dbAfter(vec2 p) {
  return mix(0.55, 1.0, dbWide) * exp(-length((p - dbSun) * vec2(0.6, 1.0)) / 0.28);
}

// The warm light the city throws up into the haze around its towers.
float dbCityGlow(vec2 p) {
  return exp(-length((p - vec2(dbAxis, DB_BASE)) * vec2(0.55, 1.7)) / 0.16);
}

vec3 dbSky(vec2 p) {
  float h = max(p.y - DB_BASE, 0.0) / (1.0 - DB_BASE);
  float glow = dbAfter(p);
  // Away from the afterglow the colours run cooler, as if a little higher.
  vec3 col = dbSkyRamp(h + 0.12 * (1.0 - glow));
  col = mix(col, vec3(1.0, 0.8, 0.52), 0.95 * glow * exp(-h * 4.0));
  col = mix(col, vec3(1.0, 0.68, 0.42), 0.25 * dbCityGlow(p));
  // The last light on the spire warms the air round it.
  float spire = exp(-length((p - vec2(dbAxis, DB_BASE + DB_BURJ * 0.62)) * vec2(1.0, 0.4)) / 0.1);
  col = mix(col, vec3(0.98, 0.62, 0.5), 0.45 * spire);
  // Long thin clouds, lit rose from below, drifting slowly to the right.
  vec2 cp = vec2(p.x * 1.1 - dbT * 0.004, p.y * 9.0);
  float c = fbm(cp + vec2(5.3, 2.1));
  float band = smoothstep(0.1, 0.2, h) * (1.0 - smoothstep(0.36, 0.5, h));
  float cloud = smoothstep(0.52, 0.74, c) * band;
  vec3 cloudCol = mix(vec3(1.0, 0.7, 0.58), vec3(0.62, 0.46, 0.72), smoothstep(0.12, 0.42, h));
  col = mix(col, cloudCol, cloud * 0.7);
  // The first stars, only where the sky has gone dark.
  vec2 id = floor(p / vec2(dbSw, dbSh) + 0.5);
  float star = dbHash(id + 17.0);
  float density = 0.006 * smoothstep(0.55, 0.85, h);
  if (star > 1.0 - density) {
    float twinkle = 0.5 + 0.5 * sin(dbT * (0.4 + star * 0.5) + dbHash(id + 3.0) * 40.0);
    col = mix(col, vec3(0.86, 0.9, 1.0), 0.3 + 0.35 * twinkle);
    dbStar = 1.0;
  }
  return col;
}

// Whether a window is lit. Most keep their state; a few switch now and
// then, each on its own slow clock.
float dbLit(vec2 id, float rate) {
  float h = dbHash(id);
  float h2 = dbHash(id + 17.3);
  if (h2 < 0.06) {
    float epoch = floor(dbT / (14.0 + 200.0 * h2) + h * 5.0);
    return step(dbHash(id + epoch * 3.1), rate);
  }
  return step(h, rate);
}

// One tower: a facade that pales into the blue haze with distance, its
// sunward edge and crown catching the afterglow, and a grid of windows a
// glyph apart. kind 0 is a stepped crown, 1 a slanted roof, 2 a mast.
// Returns colour and 1, or -1 for a miss.
vec4 dbTower(vec2 p, vec2 s, float xc, float hw, float ht, float kind, float seed, float haze) {
  float dx = p.x - xc;
  hw = max(hw, dbSw * 0.5);
  if (abs(dx) > hw) {
    return vec4(-1.0);
  }
  float u = clamp(dx / hw * 0.5 + 0.5, 0.0, 1.0);
  float top = DB_BASE + ht;
  float crown = 0.0;
  if (kind < 0.5) {
    float inset = abs(u - 0.5);
    crown = inset < 0.2 ? 0.024 : (inset < 0.36 ? 0.012 : 0.0);
  } else if (kind < 1.5) {
    crown = 0.035 * (1.0 - u);
  } else if (abs(dx) < dbSw * 0.5) {
    crown = 0.05;
  }
  float y = p.y - DB_BASE;
  if (y > ht + crown) {
    return vec4(-1.0);
  }
  vec3 shade = vec3(0.16, 0.2, 0.5);
  // Haze takes the colour of the sky behind, so far towers sink into it.
  vec3 hazeCol = mix(dbSky(vec2(p.x, top + 0.02)), vec3(0.36, 0.4, 0.74), 0.75);
  // The sunward side and the top floors hold a little warm light.
  float warm = smoothstep(0.55, 1.0, y / max(ht, 0.01)) * (1.0 - u);
  vec3 c = mix(shade, vec3(0.74, 0.5, 0.62), warm * 0.6);
  if (y > ht - dbSh) {
    // The roof line and crown catch the light.
    c = mix(vec3(0.7, 0.56, 0.78), vec3(1.0, 0.72, 0.5), 0.7 * (1.0 - u));
    return vec4(mix(c, hazeCol, haze * 0.5), 1.0);
  } else if (dx < -hw + dbSw && haze < 0.5) {
    // The sunward edge catches the afterglow, brightest near the top.
    c = mix(vec3(0.72, 0.5, 0.66), vec3(1.0, 0.68, 0.5), smoothstep(0.1, 0.9, y / max(ht, 0.01)));
    return vec4(mix(c, hazeCol, haze * 0.5), 1.0);
  } else if (dx > hw - dbSw && haze < 0.5) {
    // The far edge falls into shadow, so each tower stands apart.
    c = shade * 0.7;
  } else {
    // Windows a glyph apart, so they stay a clean grid in every charset.
    vec2 g = floor(s / dbCell);
    if (mod(g.x, 2.0) < 0.5 && mod(g.y, 2.0) < 0.5 && y > 0.012) {
      // Far towers keep only a few lights, so they don't stripe the haze.
      if (dbLit(g + seed * 31.0, haze < 0.5 ? 0.4 : 0.12) > 0.5) {
        float tint = dbHash(vec2(seed, floor(g.y / 3.0)));
        c = tint < 0.6 ? vec3(1.0, 0.78, 0.48) : vec3(0.86, 0.9, 1.0);
        return vec4(mix(c, hazeCol, haze * 0.45), 1.0);
      }
    }
  }
  c = mix(c, hazeCol, haze);
  // The foot of every tower dissolves into the city's glow.
  c = mix(c, vec3(0.98, 0.66, 0.5), (1.0 - smoothstep(0.0, 0.07, y)) * 0.55);
  return vec4(c, 1.0);
}

// Towers in the middle half of the box stay low, under the headline.
float dbCalm(float x) {
  return mix(0.3, 1.0, smoothstep(0.16, 0.25, abs(x) / dbAspect));
}

// The near cluster round the Burj: offset from it, half width, height,
// crown kind. Narrow screens keep only the ones that fit.
vec4 dbCluster(vec2 p, vec2 s) {
  vec4 hit;
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float side = mod(fi, 2.0) < 0.5 ? -1.0 : 1.0;
    float rank = floor(fi / 2.0);
    float h1 = dbHash(vec2(fi, 4.0));
    float h2 = dbHash(vec2(fi, 9.0));
    // Spaced wider than they are broad, so each tower stands on its own.
    float off = side * (0.082 + rank * 0.052 + (h1 - 0.5) * 0.012);
    // Taller close in, lower further out, so the cluster rises to the Burj.
    float ht = (0.31 - rank * 0.04) * mix(0.55, 1.0, h2);
    float hw = 0.01 + 0.006 * h1;
    hit = dbTower(p, s, dbAxis + off, hw, ht * dbCalm(dbAxis + off), mod(fi * 7.0, 3.0), fi + 11.0, 0.1 + 0.05 * rank);
    if (hit.a > 0.0) return vec4(hit.rgb, 0.86);
  }
  return vec4(-1.0);
}

// A second rank of towers behind, hazier, thinning out away from the Burj
// so the left of the horizon stays open for the afterglow.
vec4 dbBack(vec2 p, vec2 s) {
  const float SLOT = 0.032;
  float slot = floor(p.x / SLOT);
  float h1 = dbHash(vec2(slot, 21.0));
  float h2 = dbHash(vec2(slot, 23.0));
  float xc = (slot + 0.5 + (h2 - 0.5) * 0.3) * SLOT;
  float near = exp(-pow((xc - dbAxis) / 0.34, 2.0));
  float envelope = near;
  if (near < 0.2 || h1 > envelope + 0.3) {
    return vec4(-1.0);
  }
  float ht = mix(0.04, 0.2, h1 * h1) * envelope + 0.015;
  vec4 hit = dbTower(p, s, xc, SLOT * mix(0.2, 0.36, h2), ht * dbCalm(xc), floor(h2 * 3.0), slot + 101.0, 0.7);
  // Far towers draw in small dots only, so they read as haze.
  return hit.a > 0.0 ? vec4(hit.rgb, 0.55) : hit;
}

// Half width of the Burj on one side at height h (0 at its base, 1 at the
// tip). The three wings step back in turn, a half tier apart, so the
// setbacks alternate sides as they climb.
float dbBurjSide(float h, float phase) {
  const float BODY = 0.74;
  const float TIERS = 8.0;
  float core = h < 0.84 ? 0.014 : 0.0;
  if (h >= BODY) {
    return core;
  }
  float k = floor(h / BODY * TIERS + phase);
  float u = clamp((k + 1.0 - phase) / TIERS, 0.0, 1.0);
  return max(core, 0.08 * (1.0 - 0.68 * u));
}

// The Burj Khalifa. Below the light line it stands in the blue of dusk
// with a few lit floors; above it the sunward faces glow gold and amber
// and the far face takes rose from the sky. Returns colour and 1, or -1.
vec4 dbBurj(vec2 p, vec2 s) {
  float h = (p.y - DB_BASE) / DB_BURJ;
  if (h < 0.0 || h > 1.0) {
    return vec4(-1.0);
  }
  float dx = p.x - dbAxis;
  float left = dbBurjSide(h, 0.0);
  float right = dbBurjSide(h, 0.5);
  // The spire: a needle tapering to one column.
  float needle = h > 0.74 ? mix(0.016, 0.0, (h - 0.74) / 0.26) : 0.0;
  left = max(max(left, needle), dbSw * 0.5);
  right = max(max(right, needle), dbSw * 0.5);
  if (dx < -left || dx > right) {
    return vec4(-1.0);
  }
  // The beacon on the tip.
  if (h > 1.0 - dbSh / DB_BURJ) {
    float pulse = 0.5 + 0.5 * sin(dbT * 2.6);
    return vec4(mix(vec3(0.7, 0.24, 0.26), vec3(1.0, 0.36, 0.3), pulse), 1.0);
  }
  float lit = smoothstep(0.14, 0.3, h);
  // Which face: the sunward wing, the front, or the far wing.
  float front = 0.45 * min(left, right);
  vec3 shadowCol;
  vec3 litCol;
  if (dx < -front) {
    shadowCol = vec3(0.42, 0.42, 0.74);
    litCol = vec3(1.0, 0.76, 0.44);
  } else if (dx <= front) {
    shadowCol = vec3(0.32, 0.34, 0.64);
    litCol = vec3(0.98, 0.6, 0.42);
  } else {
    shadowCol = vec3(0.2, 0.22, 0.48);
    litCol = vec3(0.9, 0.52, 0.56);
  }
  vec3 c = mix(shadowCol, litCol, lit);
  // A setback ledge is a sample whose neighbour above is open air.
  float up = h + dbSh / DB_BURJ;
  float leftUp = max(dbBurjSide(up, 0.0), dbSw * 0.5);
  float rightUp = max(dbBurjSide(up, 0.5), dbSw * 0.5);
  if ((dx < -leftUp || dx > rightUp) && h < 0.84) {
    c = mix(c, mix(vec3(0.66, 0.66, 0.9), vec3(1.0, 0.88, 0.64), lit), 0.75);
  } else if (lit < 0.5) {
    // A few lit floors in the shadowed lower half.
    vec2 g = floor(s / dbCell);
    if (mod(g.y, 2.0) < 0.5 && dbLit(g + 7.0, 0.16) > 0.5) {
      c = vec3(0.98, 0.84, 0.6);
    }
  }
  // The spire's needle is lit to the tip.
  if (h >= 0.84) {
    c = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.9, 0.72), step(0.5, mod(s.y, 2.0)));
  }
  // Its foot dissolves into the city's glow.
  c = mix(c, vec3(0.98, 0.66, 0.5), (1.0 - smoothstep(0.0, 0.1, h)) * 0.5);
  return vec4(c, 1.0);
}

// A dune crest: soft swells with sharp tops, as wind leaves them.
float dbDuneShape(float x, float base, float amp, float freq, float tilt, float seed) {
  float n = snoise(vec2(x * freq + seed, seed * 1.7));
  float n2 = snoise(vec2(x * freq * 2.3 - seed, seed + 4.0));
  return base + tilt * x + amp * (0.6 * pow(1.0 - abs(n), 1.6) + 0.4 * (0.5 + 0.5 * n2) - 0.45);
}

// The same crest with a little grain, so its edge is never a clean curve.
// Shading reads the smooth shape, so the grain doesn't streak the faces.
float dbDuneTop(float x, float base, float amp, float freq, float tilt, float seed) {
  return dbDuneShape(x, base, amp, freq, tilt, seed) + 0.003 * snoise(vec2(x * 36.0, seed));
}

// The colour of a dune below its crest. The light comes low from the left,
// so a face that rises to the right is lit amber and one that falls away is
// in violet shadow; the slope is read along a slant, so each crest throws a
// shadow that widens down and to the right, the way a slip face does. Haze
// pales the far dunes, and fine ripples run across the near one.
vec3 dbDune(vec2 p, float top, float base, float amp, float freq, float tilt, float seed, vec3 litCol, vec3 shadowCol, float near) {
  float below = top - p.y;
  float x = p.x / clamp(dbAspect / 1.78, 0.55, 1.2) + below * 1.6;
  float e = 0.02;
  float slope = (dbDuneShape(x + e, base, amp, freq, tilt, seed) - dbDuneShape(x - e, base, amp, freq, tilt, seed)) / (2.0 * e);
  float lit = smoothstep(-0.3, 0.3, slope);
  // The low light falls toward the sun, so the warmth also grows leftwards.
  lit = clamp(lit + 0.25 * dbAfter(p) - 0.1, 0.0, 1.0);
  vec3 c = mix(shadowCol, litCol, lit);
  // A bright lip on the crest where it faces the light, only on the near
  // dunes and broken along its length; far crests just soften into haze.
  float lip = 1.0 - smoothstep(0.0, dbSh * 1.5, below);
  lip *= near * smoothstep(-0.2, 0.4, snoise(vec2(p.x * 9.0, seed)));
  c = mix(c, litCol * 1.12 + vec3(0.06), lip * (0.2 + 0.6 * lit));
  // Wind ripples, slanted, strongest on the lit faces.
  float r = sin(p.x * 50.0 + p.y * 130.0 + snoise(p * vec2(4.0, 9.0) + seed) * 6.0);
  float patch = smoothstep(0.1, 0.6, snoise(p * 3.0 + seed));
  c *= 1.0 + near * near * patch * smoothstep(0.6, 1.0, r) * 0.12 * lit;
  // Darker down into the trough, so the dune in front stands out.
  c *= 1.0 - 0.2 * smoothstep(0.02, 0.14, below);
  return c;
}

// Dust drifting low over the sand, as a 0 to 1 density.
float dbDust(vec2 p) {
  vec2 q = vec2(p.x * 2.4 - dbT * 0.02, p.y * 12.0 + sin(p.x * 3.0 + dbT * 0.05) * 0.4);
  return smoothstep(0.42, 0.78, fbm(q + vec2(fbm(q * 0.6 + dbT * 0.01) * 0.9, 0.0)));
}

vec2 dbCacheUv = vec2(-1.0);
float dbCacheT = -1.0;
vec4 dbCacheValue = vec4(0.0);

vec4 dbScene(vec2 uv, vec2 res, float t) {
  if (uv == dbCacheUv && t == dbCacheT) {
    return dbCacheValue;
  }
  dbAspect = res.x / res.y;
  dbT = t;
  vec2 samples = max(ascii_samples, vec2(1.0));
  dbSw = dbAspect / samples.x;
  dbSh = 1.0 / samples.y;
  dbCell = max(dbGrid, vec2(1.0));
  dbWide = smoothstep(0.95, 1.4, dbAspect);
  dbStar = 0.0;
  vec2 s = floor(uv * samples);
  vec2 p = vec2(((s.x + 0.5) / samples.x - 0.5) * dbAspect, (s.y + 0.5) / samples.y);
  // Out to the right at every aspect, beside a centred headline rather than
  // behind it. Snapped to a column centre so the spire is one whole column.
  float axis = mix(0.32, 0.27, dbWide) * dbAspect;
  dbAxis = (floor((axis + 0.5 * dbAspect) / dbSw) + 0.5) * dbSw - 0.5 * dbAspect;
  // The sun has set to the left, behind the far dunes.
  dbSun = vec2(-0.3 * dbAspect * dbWide - 0.12, DB_BASE - 0.05);

  vec3 col;
  float depth;
  float stretch = clamp(dbAspect / 1.78, 0.55, 1.2);
  float nearTop = dbDuneTop(p.x / stretch, 0.12, 0.08, 0.8, 0.05, 2.3);
  float midTop = dbDuneTop(p.x / stretch, 0.235, 0.05, 1.3, -0.03, 7.9);
  float farTop = dbDuneTop(p.x / stretch, 0.322, 0.038, 2.0, 0.0, 13.1);
  if (p.y < nearTop) {
    col = dbDune(p, nearTop, 0.12, 0.08, 0.8, 0.05, 2.3, vec3(0.98, 0.6, 0.38), vec3(0.4, 0.25, 0.44), 1.0);
    depth = 1.0;
  } else if (p.y < midTop) {
    col = dbDune(p, midTop, 0.235, 0.05, 1.3, -0.03, 7.9, vec3(0.96, 0.6, 0.42), vec3(0.38, 0.26, 0.48), 0.5);
    depth = 2.0;
  } else if (p.y < farTop) {
    col = dbDune(p, farTop, 0.322, 0.038, 2.0, 0.0, 13.1, vec3(0.66, 0.44, 0.52), vec3(0.36, 0.26, 0.44), 0.0);
    // Near the sun the far dune sits in glowing dust, so the afterglow
    // fades down into it instead of stopping at its crest.
    float dusk = smoothstep(0.35, 0.9, dbAfter(p)) * (1.0 - smoothstep(0.0, 0.06, farTop - p.y));
    col = mix(col, vec3(0.96, 0.66, 0.48), 0.6 * dusk);
    depth = 3.0;
  } else {
    depth = 10.0;
    vec4 hit = dbBurj(p, s);
    if (hit.a < 0.0) hit = dbCluster(p, s);
    if (hit.a < 0.0) hit = dbBack(p, s);
    if (hit.a > 0.0) {
      col = hit.rgb;
      depth = 5.0;
      dbHold = hit.a;
    } else {
      col = dbSky(p);
    }
  }

  // The city's glow hangs in the haze over the far dunes and the skyline's
  // feet, and the last of the afterglow lies along the horizon.
  float horizon = exp(-abs(p.y - DB_BASE) / 0.06);
  col = mix(col, vec3(1.0, 0.72, 0.5), horizon * clamp(0.2 * dbCityGlow(p) + 0.35 * dbAfter(p), 0.0, 0.45) * step(2.5, depth));
  // Dust and heat haze drifting over the dunes.
  if (depth < 4.0) {
    float band = 1.0 - smoothstep(0.0, 0.2, abs(p.y - 0.25));
    float dust = dbDust(p) * band;
    col = mix(col, vec3(0.98, 0.7, 0.58), dust * 0.22);
  }

  col = clamp(col, 0.0, 1.0);
  // Each layer has its own ceiling on dot size, so near forms and the lights
  // carry the large dots while the sky and the far dunes stay sparse specks.
  // The afterglow round the sun is let through as the one big soft light.
  float hold = 1.0;
  if (depth > 9.0) {
    hold = max(mix(0.52, 1.0, smoothstep(0.25, 0.8, dbAfter(p))), 0.9 * dbStar);
  } else if (depth > 4.0) {
    hold = dbHold;
  } else if (depth > 2.5) {
    // The far dune takes the afterglow near the sun, so the glow fades
    // into the sand instead of stopping at its crest.
    hold = mix(0.5, 0.95, smoothstep(0.3, 0.85, dbAfter(p)));
  } else if (depth > 1.5) {
    hold = 0.78;
  }
  // Dot size follows brightness on a steep curve: dark air and shadow get
  // the smallest dots or none, mid-tones medium ones, and only the lights
  // and lit edges the largest.
  float luma = dot(col, vec3(0.3, 0.55, 0.15));
  float tone = clamp(1.15 * hold * pow(luma, 1.35), 0.0, 1.0);
  // Dark dots lose their colour and sit just above the paper, so shadow
  // reads as quiet air; brighter ones are lifted a little to stay clear.
  col = mix(vec3(luma) * vec3(0.86, 0.9, 1.25), col, smoothstep(0.06, 0.32, luma));
  col = clamp(col / (0.55 + 0.45 * sqrt(max(luma, 0.001))), 0.0, 1.0);
  tone *= sqrt(dbIntensity);
  dbCacheUv = uv;
  dbCacheT = t;
  dbCacheValue = vec4(col * dbIntensity, tone);
  return dbCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return dbScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return dbScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const DUSK = "#0b0d26";
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
        "linear-gradient(to bottom, #12163e 0%, #2c2a62 28%, #7a4a7c 48%, #d07a74 60%, #f2b070 66%, #8a4e5a 70%, #3a2440 82%, #1c1228 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface DubaiProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /**
   * Paper behind the glyphs. Default: the scene's deep dusk blue in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"infrared"`, indigo to amber. */
  ramp?: AsciiSceneProps["ramp"];
  /**
   * Cells as wide as they are tall, so the dots lie on an even lattice like
   * a halftone screen. Default `true`, or `false` for `braille` and
   * `quadrants`, which stretch.
   */
  square?: boolean;
  /** Ordered dithering between dot sizes, which turns four dots into smooth tone. Default `"bayer4"`. */
  dither?: AsciiSceneProps["dither"];
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Dubai at dusk from the edge of the desert, painted in dots. The Burj
 * Khalifa rises far above a cluster of towers in blue haze, its stepped
 * upper half and spire still gold in the last light, while soft dunes in
 * rose and amber fill the foreground under a sky running from gold through
 * rose to deep blue. The beacon on the spire pulses, a window changes now
 * and then, and dust drifts over the sand. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const Dubai = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square,
  dither = "bayer4",
  stillTime = 0,
  intensity = 1,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: DubaiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const { kind, grid } = resolveCharset(charset, chars);
  const stretches = kind === "braille" || kind === "quadrants";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        // The samples per glyph, so windows sit a whole glyph apart in
        // every charset.
        dbGrid: [grid[0], grid[1]],
        dbIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "infrared" : undefined)}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      square={square ?? !stretches}
      dither={dither}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
