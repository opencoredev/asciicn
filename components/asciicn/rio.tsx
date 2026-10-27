"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The whole view is one function of p = (x in box heights, y up), with the
// far shore of the bay at RIO_SEA. Layers are tested near to far and the
// first one that covers a sample wins: the promenade, the beach
// and the surf, the bay, then the mountains, the birds and the sky. Sizes
// that must survive coarse charsets are measured against `px`, one sample
// row, so cables, wings and the statue's arms never fall between samples.
// `rioScene` returns colour and tone, cached per sample so the field and
// colour passes share one evaluation.
const SCENE = `
const float RIO_SEA = 0.3;

// The layout, set once per sample by rioLayout.
float rioAspect = 1.0;
// 0 on tall boxes, 1 on wide ones.
float rioK = 1.0;
float rioCorX = 0.0;
float rioCorTop = 0.64;
float rioLoafX = 0.0;
float rioLoafH = 0.26;
float rioLoafW = 0.1;
float rioUrcaX = 0.0;
float rioUrcaH = 0.1;
vec2 rioSun = vec2(0.0);

// Landmarks right of centre on wide boxes, so a headline fits on the left,
// and drawn a little smaller on tall ones so both peaks still fit.
void rioLayout(float aspect) {
  rioAspect = aspect;
  rioK = smoothstep(0.9, 1.5, aspect);
  rioCorX = aspect * mix(0.3, 0.58, rioK);
  rioCorTop = mix(0.6, 0.64, rioK);
  rioLoafX = aspect * mix(0.76, 0.84, rioK);
  rioLoafH = mix(0.24, 0.3, rioK);
  rioLoafW = mix(0.065, 0.08, rioK);
  rioUrcaX = rioLoafX - mix(0.13, 0.19, rioK);
  rioUrcaH = mix(0.085, 0.11, rioK);
  // On tall boxes the sun climbs clear of the statue's arms.
  rioSun = vec2(mix(rioCorX, rioLoafX, mix(0.72, 0.5, rioK)), mix(0.84, 0.7, rioK));
}

// 0 at the left edge, 1 at the right: the beach curves away toward the right.
float rioCurve(float x) {
  float a = clamp(x / rioAspect, 0.0, 1.0);
  return pow(a, 2.6);
}

float rioShore(float x) {
  return 0.12 + 0.15 * rioCurve(x);
}

float rioWalk(float x) {
  return 0.07 + 0.07 * rioCurve(x);
}

// The forested range behind the bay, with Corcovado's sharp peak in it: a
// long shoulder on the left and a near-sheer face on the right. Sines give
// the shape so the slope can be read cheaply; rioRidge adds the treeline.
float rioRidgeShape(float x) {
  float r = RIO_SEA + 0.085 + 0.03 * sin(x * 3.1 + 1.0) + 0.018 * sin(x * 7.3 + 2.0);
  float dx = x - rioCorX;
  float a = max(abs(dx) - 0.01, 0.0);
  float peak = rioCorTop - (dx < 0.0 ? 1.15 * pow(a, 1.12) : 2.6 * pow(a, 1.05));
  return max(r, peak);
}

float rioRidge(float x) {
  return rioRidgeShape(x) + 0.006 * snoise(vec2(x * 30.0, 1.3));
}

vec4 rioSky(vec2 p, float px, float t) {
  float h = p.y - RIO_SEA;
  float glow = exp(-max(h, 0.0) * 3.6);
  vec2 ds = (p - rioSun) * vec2(1.0, 1.3);
  float d = length(ds);
  float halo = exp(-d * d / 0.006);
  float tone = glow * 0.08 + halo * 0.36;
  vec3 col = mix(vec3(0.36, 0.56, 0.92), vec3(1.0, 0.7, 0.42), smoothstep(0.15, 0.8, max(glow, halo)));
  // Fair-weather cumulus drifting along the coast, gold on the sun side.
  float band = smoothstep(0.16, 0.24, h) * (1.0 - smoothstep(0.46, 0.6, h));
  float n = 0.0;
  if (band > 0.0) {
    vec2 cq = vec2(p.x * 4.5 + t * 0.03, p.y * 11.0);
    n = fbm(cq + vec2(sin(cq.y * 1.3 + cq.x * 0.7) * 0.5, 0.0));
  }
  float cloud = smoothstep(0.68, 0.78, n) * band;
  vec3 cloudCol = mix(vec3(0.82, 0.74, 0.86), vec3(1.0, 0.84, 0.62), smoothstep(0.0, 0.6, halo * 3.0));
  tone = mix(tone, 0.12 + 0.34 * smoothstep(0.68, 0.88, n) + halo * 0.3, cloud);
  col = mix(col, cloudCol, cloud);
  // The sun itself, low and white-gold.
  float r = max(0.034, px * 2.2);
  if (d < r) {
    tone = 1.0;
    col = vec3(1.0, 0.94, 0.74);
  }
  return vec4(col, tone);
}

// Frigatebirds riding the wind: long crooked wings, almost never a flap.
vec4 rioFlock(vec2 p, float px, float t, out float cover) {
  cover = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= rioBirds) {
      break;
    }
    float h1 = hash21(vec2(fi, 3.7));
    float h2 = hash21(vec2(fi, 8.1));
    float span = rioAspect + 0.4;
    float x = mod(h1 * span + t * (0.006 + 0.008 * h2), span) - 0.2;
    x += 0.03 * cos(t * 0.25 + fi * 2.0);
    float y = 0.62 + 0.28 * h2 + 0.02 * sin(t * 0.25 + fi * 2.0);
    float s = max(0.016, px * 1.4) * (0.8 + 0.4 * h1);
    vec2 q = (p - vec2(x, y)) / s;
    if (abs(q.x) > 1.6 || abs(q.y) > 1.2) {
      continue;
    }
    float lift = 0.55 + 0.12 * sin(t * 0.9 + fi * 4.0);
    float ax = abs(q.x);
    float wing = ax < 0.7 ? ax * lift : 0.7 * lift - (ax - 0.7) * 0.7;
    if (ax < 1.5 && abs(q.y - wing) < max(0.22, px * 0.55 / s)) {
      cover = 1.0;
      return vec4(0.92, 0.84, 0.78, 0.58);
    }
  }
  return vec4(0.0);
}

// Christ the Redeemer on the summit: plinth, robe, open arms and head,
// with every part at least one sample thick.
vec4 rioStatue(vec2 p, float px, out float cover) {
  cover = 0.0;
  float s = max(0.1, px * 7.5);
  vec2 q = (p - vec2(rioCorX, rioCorTop - 0.004)) / s;
  if (q.y < 0.0 || q.y > 1.0 || abs(q.x) > 0.6) {
    return vec4(0.0);
  }
  float line = px * 0.55 / s;
  bool hit = false;
  if (q.y < 0.2) {
    hit = abs(q.x) < max(0.1 - q.y * 0.1, line);
  } else if (q.y < 0.8) {
    hit = abs(q.x) < max(mix(0.09, 0.065, (q.y - 0.2) / 0.6), line);
  }
  // The arms, straight out and tapering a little toward the hands.
  float arm = max(0.045 - abs(q.x) * 0.02, px * 0.5 / s);
  if (abs(q.y - 0.74) < arm && abs(q.x) < 0.44) {
    hit = true;
  }
  if (length(vec2(q.x, (q.y - 0.87) * 0.9)) < max(0.065, line * 1.2)) {
    hit = true;
  }
  if (!hit) {
    return vec4(0.0);
  }
  cover = 1.0;
  // The side toward the sun takes the gold.
  float lit = smoothstep(-0.05, 0.08, q.x * sign(rioSun.x - rioCorX));
  return vec4(mix(vec3(0.9, 0.9, 0.88), vec3(1.0, 0.86, 0.6), lit), 0.88 + 0.12 * lit);
}

// A cable run from a to b with its car going there and back. The cable
// sags into a shallow curve and the car hangs under it on a short arm.
float rioCableY(vec2 a, vec2 b, float s) {
  return mix(a.y, b.y, s) - 0.06 * (b.x - a.x) * s * (1.0 - s);
}

vec4 rioCable(vec2 p, float px, vec2 a, vec2 b, float phase, float t, out float cover) {
  cover = 0.0;
  float cs = 0.5 - 0.5 * cos(t * 0.16 + phase);
  vec2 cp = vec2(mix(a.x, b.x, cs), rioCableY(a, b, cs));
  vec2 hs = vec2(max(0.012, px * 0.95), max(0.009, px * 0.75));
  float hang = hs.y + max(0.006, px * 0.6);
  vec2 d = p - (cp - vec2(0.0, hang));
  if (abs(d.x) < hs.x && abs(d.y) < hs.y) {
    cover = 1.0;
    // Glass catching the sun on top, a pale frame below.
    return d.y > 0.0 ? vec4(1.0, 0.86, 0.5, 1.0) : vec4(0.92, 0.95, 1.0, 0.82);
  }
  if (abs(p.x - cp.x) < max(0.002, px * 0.35) && p.y > cp.y - hang && p.y < cp.y) {
    cover = 1.0;
    return vec4(0.8, 0.78, 0.76, 0.6);
  }
  float s = (p.x - a.x) / (b.x - a.x);
  if (s < 0.0 || s > 1.0) {
    return vec4(0.0);
  }
  float y = rioCableY(a, b, s);
  float slope = abs((rioCableY(a, b, min(s + 0.01, 1.0)) - rioCableY(a, b, max(s - 0.01, 0.0))) / (0.02 * (b.x - a.x)));
  // Steep runs get thicker so no column drops the line.
  if (abs(p.y - y) < px * (0.5 + 0.35 * slope)) {
    cover = 1.0;
    return vec4(0.82, 0.8, 0.78, 0.56);
  }
  return vec4(0.0);
}

vec4 rioCables(vec2 p, float px, float t, out float cover) {
  cover = 0.0;
  if (rioCableOn < 0.5) {
    return vec4(0.0);
  }
  vec2 beach = vec2(rioUrcaX - mix(0.12, 0.2, rioK), RIO_SEA + 0.014);
  vec2 urca = vec2(rioUrcaX + 0.01, RIO_SEA + rioUrcaH + 0.004);
  vec2 loaf = vec2(rioLoafX + 0.015 - rioLoafW * 0.15, RIO_SEA + rioLoafH - 0.004);
  vec4 hit = rioCable(p, px, urca, loaf, 0.0, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  return rioCable(p, px, beach, urca, 2.2, t, cover);
}

// Half the width of the Sugarloaf at height v (0 at the water, 1 at the
// top): a steep granite bullet with a rounded crown and a forested skirt.
float rioLoafHalf(float v) {
  return rioLoafW * (pow(max(1.0 - pow(v, 2.2), 0.0), 0.5) + 0.35 * pow(1.0 - v, 4.0));
}

vec4 rioSugarloaf(vec2 p, float px, out float cover) {
  cover = 0.0;
  float v = (p.y - RIO_SEA) / rioLoafH;
  if (v < 0.0 || v > 1.0) {
    return vec4(0.0);
  }
  // It leans a little toward the open sea.
  float axis = rioLoafX + 0.015 * v;
  float hw = rioLoafHalf(v);
  float sx = p.x - axis;
  if (abs(sx) > hw) {
    return vec4(0.0);
  }
  cover = 1.0;
  float nx = sx / max(hw, 1e-3);
  float side = sign(rioSun.x - axis);
  float lambert = clamp(0.5 + 0.55 * nx * side, 0.0, 1.0);
  lambert = max(lambert, smoothstep(0.82, 1.0, v) * 0.75);
  // Dark streaks where rain runs down the granite.
  float streak = 0.5 + 0.5 * snoise(vec2(sx * 70.0, v * 3.0 + 7.0));
  float edge = min(hw - abs(sx), (1.0 - v) * rioLoafH);
  float rim = 1.0 - smoothstep(px * 0.6, px * 2.0, edge);
  float veg = 1.0 - smoothstep(0.14, 0.26, v + 0.08 * snoise(p * 45.0));
  veg = max(veg, step(0.55, snoise(p * 32.0)) * step(nx * side, -0.35) * step(v, 0.8));
  float rockTone = 0.46 + 0.34 * lambert + 0.14 * (streak - 0.5);
  vec3 rockCol = mix(vec3(0.5, 0.44, 0.46), vec3(1.0, 0.77, 0.54), lambert) * (0.85 + 0.15 * streak);
  float tone = mix(rockTone, 0.3 + 0.12 * lambert, veg);
  vec3 col = mix(rockCol, vec3(0.2, 0.55, 0.3) + 0.2 * lambert, veg);
  tone = max(tone, rim * (0.45 + 0.4 * lambert));
  col = mix(col, vec3(1.0, 0.86, 0.62), rim * lambert);
  return vec4(col, tone);
}

// Forest canopy, lit on the slopes that face the sun. The crowns are sized
// in samples, so they read as clumps rather than streaks in every charset.
vec4 rioForest(vec2 p, float px, float depth, float facing) {
  float canopy = 0.5 + 0.5 * snoise(p / (px * vec2(1.3, 1.8)));
  float tone = 0.3 + 0.28 * canopy + 0.12 * facing;
  vec3 col = mix(vec3(0.1, 0.4, 0.27), vec3(0.42, 0.74, 0.3), facing * 0.7 + canopy * 0.3);
  float rim = 1.0 - smoothstep(px * 0.6, px * 2.2, depth);
  tone = max(tone, rim * (0.45 + 0.2 * facing));
  col = mix(col, vec3(0.78, 0.86, 0.42), rim * facing);
  return vec4(col, tone);
}

// Morro da Urca, the low green hill the first cable climbs.
vec4 rioUrca(vec2 p, float px, out float cover) {
  cover = 0.0;
  float wu = mix(0.09, 0.13, rioK);
  float dx = (p.x - rioUrcaX) / wu;
  if (abs(dx) > 1.0) {
    return vec4(0.0);
  }
  float top = RIO_SEA + rioUrcaH * pow(max(1.0 - dx * dx, 0.0), 0.7) + 0.004 * snoise(vec2(p.x * 40.0, 5.0));
  if (p.y > top || p.y < RIO_SEA) {
    return vec4(0.0);
  }
  cover = 1.0;
  float facing = clamp(0.5 + 0.6 * dx * sign(rioSun.x - rioUrcaX), 0.0, 1.0);
  vec4 hit = rioForest(p, px, top - p.y, facing);
  // A bare granite face drops to the water on the sun side.
  float face = smoothstep(0.35, 0.6, dx * sign(rioSun.x - rioUrcaX)) * smoothstep(0.0, 0.03, top - p.y);
  float grain = 0.5 + 0.5 * snoise(vec2(p.x * 80.0, p.y * 20.0));
  hit = mix(hit, vec4(mix(vec3(0.6, 0.5, 0.46), vec3(1.0, 0.76, 0.54), grain), 0.48 + 0.2 * grain), face * step(0.4, grain + face * 0.5));
  return hit;
}

// White apartment blocks along the far shore, windows flashing gold.
vec4 rioTown(vec2 p, float px, float t, out float cover) {
  cover = 0.0;
  if (p.x > rioUrcaX - 0.1 || p.y < RIO_SEA) {
    return vec4(0.0);
  }
  float bw = 0.028;
  float id = floor(p.x / bw);
  float h = 0.012 + 0.045 * pow(hash21(vec2(id, 1.3)), 2.0);
  if (hash21(vec2(id, 2.9)) < 0.25 || p.y > RIO_SEA + h || fract(p.x / bw) > 0.86) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 win = floor(vec2(p.x / (px * 1.3), p.y / px));
  float glint = step(0.9, hash21(win + floor(t / 6.0 + hash21(win) * 4.0)));
  return mix(vec4(0.86, 0.84, 0.8, 0.5), vec4(1.0, 0.82, 0.5, 0.85), glint);
}

vec4 rioMountains(vec2 p, float px, float t, out float cover) {
  cover = 0.0;
  if (p.y > rioCorTop + max(0.1, px * 7.5) || p.y < RIO_SEA) {
    return vec4(0.0);
  }
  vec4 hit = rioTown(p, px, t, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = rioUrca(p, px, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = rioSugarloaf(p, px, cover);
  if (cover > 0.5) {
    return hit;
  }
  hit = rioStatue(p, px, cover);
  if (cover > 0.5) {
    return hit;
  }
  float top = rioRidge(p.x);
  if (p.y > top || p.y < RIO_SEA) {
    cover = 0.0;
    return vec4(0.0);
  }
  cover = 1.0;
  float depth = top - p.y;
  float e = 0.004;
  float slope = (rioRidgeShape(p.x + e) - rioRidgeShape(p.x - e)) / (2.0 * e);
  float facing = clamp(0.5 - 0.35 * slope * sign(rioSun.x - p.x), 0.0, 1.0);
  // Haze softens the range where it meets the far shore.
  hit = rioForest(p, px, depth, facing);
  hit.a *= mix(0.75, 1.0, smoothstep(RIO_SEA, RIO_SEA + 0.1, p.y));
  // Bare granite where the face is too steep for the forest to hold.
  float rock = smoothstep(1.3, 2.1, abs(slope)) * smoothstep(0.14, 0.03, depth) * step(RIO_SEA + 0.12, p.y);
  rock *= step(0.3, 0.5 + 0.5 * snoise(vec2(p.x * 60.0, p.y * 14.0)));
  vec3 rockCol = mix(vec3(0.56, 0.48, 0.46), vec3(1.0, 0.76, 0.52), facing);
  return mix(hit, vec4(rockCol, 0.48 + 0.3 * facing), rock);
}

// Sailboats crossing the bay, slow enough to read as drifting.
vec4 rioBoats(vec2 p, float px, float t, out float cover) {
  cover = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float h = hash21(vec2(fi, 6.6));
    float span = rioAspect + 0.3;
    float dir = fi < 0.5 ? 1.0 : -1.0;
    float x = mod(h * span + dir * t * 0.005, span) - 0.15;
    float y = RIO_SEA - 0.022 - 0.022 * fi;
    float s = max(0.032, px * 3.0);
    vec2 q = p - vec2(x, y);
    if (q.y > -max(0.005, px * 0.6) && q.y < 0.0 && abs(q.x) < s * 0.42 + q.y * 1.2) {
      cover = 1.0;
      return vec4(0.7, 0.4, 0.3, 0.5);
    }
    float sail = q.x * dir;
    if (q.y >= 0.0 && q.y < s && sail > -max(0.002, px * 0.3) && sail < max(s * 0.5 * (1.0 - q.y / s), px * 0.5)) {
      cover = 1.0;
      return vec4(1.0, 0.96, 0.88, 0.82);
    }
  }
  return vec4(0.0);
}

vec4 rioBay(vec2 p, float px, float t) {
  float dh = RIO_SEA - p.y;
  float shore = rioShore(p.x);
  float wave = snoise(vec2(p.x * 8.0 + t * 0.04, p.y * 110.0 + t * 0.5 + sin(p.x * 9.0) * 2.0));
  float rip = smoothstep(0.1, 0.8, wave);
  float tone = rip * 0.16;
  vec3 col = mix(vec3(0.2, 0.46, 0.88), vec3(0.16, 0.72, 0.78), smoothstep(0.0, 0.1, dh));
  // The mountains mirrored in the bay, broken up by the ripples.
  if (dh < 0.12) {
    vec2 rp = vec2(p.x + 0.006 * sin(p.y * 260.0 + t * 1.5), RIO_SEA + dh);
    float rc;
    vec4 refl = rioUrca(rp, px, rc);
    if (rc < 0.5) {
      refl = rioSugarloaf(rp, px, rc);
    }
    float mirror = rc * refl.a * (0.3 + 0.5 * rip) * exp(-dh * 7.0);
    if (mirror > tone) {
      tone = mirror;
      col = mix(col, refl.rgb, 0.6);
    }
  }
  // A path of glitter on the water under the sun.
  float wpath = 0.02 + dh * 0.35;
  float gx = p.x - rioSun.x;
  float path = exp(-gx * gx / (wpath * wpath));
  float glint = path > 0.04 ? smoothstep(0.35, 0.9, snoise(vec2(p.x * 45.0, p.y * 160.0 + t * 1.4))) : 0.0;
  float glitter = path * (0.25 + 0.75 * glint) * (0.6 + 0.4 * rip);
  if (glitter > tone) {
    tone = glitter;
    col = mix(vec3(1.0, 0.78, 0.45), vec3(1.0, 0.95, 0.8), glint);
  }
  // Rollers coming in: white lines that run toward the sand, break up as
  // they go and brighten as they break.
  float d = p.y - shore;
  float zone = 0.035 + 0.06 * rioSurf;
  if (rioSurf > 0.01 && d < zone) {
    float lambda = 0.022;
    float u = d / lambda + t * 0.22;
    float id = floor(u);
    float thick = max(0.16, px * 0.6 / lambda);
    float line = 1.0 - smoothstep(thick * 0.5, thick, fract(u));
    float foam = smoothstep(-0.25, 0.45, snoise(vec2(p.x * 12.0 - id * 3.1, id * 1.7)));
    float near = 1.0 - d / zone;
    float roller = line * foam * (0.35 + 0.65 * near) * (0.4 + 0.6 * rioSurf);
    // The wash that slides up the sand and back.
    float wash = 1.0 - smoothstep(0.0, max(0.008, px * 0.9), d - 0.004 * sin(t * 0.9 + p.x * 6.0));
    roller = max(roller, wash * 0.85 * (0.5 + 0.5 * rioSurf));
    if (roller > tone) {
      tone = roller;
      col = vec3(0.92, 0.97, 1.0);
    }
  }
  return vec4(col, tone);
}

// Copacabana sand: warm grain, a darker wet edge and a few umbrellas.
vec4 rioSand(vec2 p, float px, float t) {
  float shore = rioShore(p.x);
  float slot = 0.07;
  float id = floor(p.x / slot);
  float h = hash21(vec2(id, 4.2));
  if (h > 0.45) {
    float ux = (id + 0.25 + 0.5 * hash21(vec2(id, 7.3))) * slot;
    float base = mix(rioWalk(ux), rioShore(ux), 0.35 + 0.3 * hash21(vec2(id, 9.1)));
    float r = max(0.014, px * 1.3);
    vec2 q = p - vec2(ux, base + r * 1.2);
    if (q.y >= 0.0 && length(q / vec2(1.6, 0.7)) < r) {
      vec3 shade = h > 0.8 ? vec3(1.0, 0.36, 0.3) : h > 0.65 ? vec3(1.0, 0.82, 0.22) : vec3(0.3, 0.6, 1.0);
      return vec4(shade, 0.7);
    }
    if (q.y < 0.0 && p.y > base && abs(q.x) < max(0.0015, px * 0.3)) {
      return vec4(0.9, 0.9, 0.85, 0.45);
    }
  }
  float grain = hash21(floor(p / (px * vec2(0.6, 1.0))));
  float wet = smoothstep(shore - 0.018, shore - 0.002, p.y);
  float tone = 0.1 + 0.26 * grain * grain * grain + 0.08 * wet;
  vec3 col = mix(vec3(1.0, 0.84, 0.6), vec3(0.78, 0.62, 0.48), wet);
  return vec4(col, tone);
}

// The promenade's black and white wave mosaic, running along the beach.
vec4 rioPromenade(vec2 p, float px) {
  float top = rioWalk(p.x);
  float yy = top - p.y;
  if (yy < max(0.005, px * 0.8)) {
    return vec4(0.95, 0.92, 0.85, 0.62);
  }
  float w = max(0.024, px * 2.0);
  float s = (yy + w * 0.9 * sin(p.x * 6.2832 / (w * 6.0))) / w;
  float white = step(0.5, fract(s));
  return vec4(0.96, 0.94, 0.88, 0.72 * white);
}

vec2 rioCacheUv = vec2(-1.0);
float rioCacheT = -1.0;
vec4 rioCacheValue = vec4(0.0);

vec4 rioScene(vec2 uv, vec2 res, float t) {
  if (uv == rioCacheUv && t == rioCacheT) {
    return rioCacheValue;
  }
  float aspect = res.x / res.y;
  float px = 1.0 / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  rioLayout(aspect);
  // Nearer layers slide further with the pointer.
  float ptr = (u_pointer.x - 0.5) * u_pointer.z * rioParallax;
  float cover = 0.0;
  vec4 hit = vec4(0.0);
  vec2 near = p + vec2(ptr * 0.06, 0.0);
  if (near.y < rioWalk(near.x)) {
    hit = rioPromenade(near, px);
    cover = 1.0;
  }
  if (cover < 0.5) {
    vec2 q = p + vec2(ptr * 0.045, 0.0);
    if (q.y < rioShore(q.x)) {
      hit = rioSand(q, px, t);
      cover = 1.0;
    }
  }
  if (cover < 0.5 && p.y < RIO_SEA) {
    vec2 q = p + vec2(ptr * 0.03, 0.0);
    hit = rioBoats(q, px, t, cover);
    if (cover < 0.5) {
      hit = rioBay(q, px, t);
      cover = 1.0;
    }
  }
  if (cover < 0.5) {
    hit = rioCables(p + vec2(ptr * 0.022, 0.0), px, t, cover);
  }
  if (cover < 0.5) {
    hit = rioMountains(p + vec2(ptr * 0.02, 0.0), px, t, cover);
  }
  if (cover < 0.5) {
    hit = rioFlock(p + vec2(ptr * 0.012, 0.0), px, t, cover);
  }
  if (cover < 0.5) {
    hit = rioSky(p + vec2(ptr * 0.005, 0.0), px, t);
  }
  // Near-black becomes paper, so the sky keeps clean gaps between glyphs.
  float tone = hit.a < 0.05 ? 0.0 : clamp(hit.a, 0.0, 1.0) * rioIntensity;
  rioCacheUv = uv;
  rioCacheT = t;
  rioCacheValue = vec4(hit.rgb, tone);
  return rioCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return rioScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its evening blue behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const EVENING = "#061620";
const EVENING_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #061620 0%, #12304a 40%, #a8743f 68%, #0d3a46 70%, #3a2c1c 88%, #061620 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RioProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** How big the surf runs on Copacabana, from 0 (flat) to 1. Default 0.6. */
  surf?: number;
  /** How many frigatebirds ride the wind, from 0 to 8. Default 5. */
  birds?: number;
  /** The Sugarloaf cable cars and their cables. Default `true`. */
  cableCar?: boolean;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's evening blue in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Rio de Janeiro in the late afternoon. Sugarloaf rises from the bay with
 * its cable cars climbing, the statue opens its arms on Corcovado, and the
 * surf breaks on Copacabana below the wave mosaic of the promenade.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Rio = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  cell = 12,
  stillTime = 6,
  interactive = true,
  interaction = "none",
  intensity = 1,
  surf = 0.6,
  birds = 5,
  cableCar = true,
  fallback = FALLBACK,
  ...props
}: RioProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rioBirds: Math.round(clamp(birds, 0, 8)),
        rioCableOn: cableCar ? 1 : 0,
        rioIntensity: clamp(intensity, 0, 1),
        rioParallax: interactive ? 1 : 0,
        rioSurf: clamp(surf, 0, 1),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (EVENING_MODES.has(mode) ? EVENING : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
