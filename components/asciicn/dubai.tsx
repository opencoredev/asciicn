"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The whole city is one function of a point in box units: x runs across
// the true aspect, y from 0 at the bottom to 1 at the top. Layers are drawn
// back to front (sky, dunes, far towers, the Burj Khalifa, the glass
// cluster, the Burj Al Arab), and the lake below mirrors them. Each layer
// returns colour and tone, with a negative tone for "missed", so the first
// opaque layer from the front wins. Tone is set per layer rather than
// taken from brightness: open sky stays empty, silhouettes stay filled,
// and sunlit glass reads as the densest glyphs.
const SCENE = `
const float DUBAI_SHORE = 0.15;
const float DUBAI_BURJ_BASE = 0.15;
const float DUBAI_BURJ_ROOF = 0.79;
const float DUBAI_BURJ_TIP = 0.955;

float dubaiNoise(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(i, 7.1)), hash21(vec2(i + 1.0, 7.1)), f);
}

// Where the last sunlight reaches. Below it everything sits in the shadow
// of the dunes; as the hour runs on it climbs the Burj and leaves only the
// spire, then nothing.
float dubaiSunLine() {
  return DUBAI_SHORE + 0.06 + dubaiHour * 0.92;
}

float dubaiLit(float y) {
  float line = dubaiSunLine();
  return smoothstep(line - 0.012, line + 0.012, y);
}

// A dune ridge: a long windward slope up to a crest, then a short steep
// slip face. Returns the crest height and where along the dune x falls
// (0 to 0.75 windward, 0.75 to 1 the slip face).
vec2 dubaiDune(float x, float k) {
  float w = x * (1.8 + k * 0.7) + k * 0.37 + 0.35 * dubaiNoise(x * 3.0 + k * 9.0);
  float s = fract(w);
  float prof = s < 0.75 ? s / 0.75 : (1.0 - s) / 0.25;
  prof = prof * prof * (3.0 - 2.0 * prof);
  float h = DUBAI_SHORE + 0.05 + k * 0.07
    + (0.06 + 0.04 * dubaiNoise(floor(w) * 1.7 + k)) * prof
    + 0.008 * sin(x * 21.0 + k * 3.0);
  return vec2(h, s);
}

vec4 dubaiSky(vec2 q, float sunX, float t, float px) {
  float night = dubaiHour;
  float hz = clamp((q.y - DUBAI_SHORE) / (1.0 - DUBAI_SHORE), 0.0, 1.0);
  vec3 low = mix(vec3(1.0, 0.56, 0.24), vec3(0.4, 0.17, 0.26), night);
  vec3 mid = mix(vec3(0.66, 0.36, 0.48), vec3(0.12, 0.09, 0.27), night);
  vec3 top = mix(vec3(0.13, 0.18, 0.42), vec3(0.03, 0.04, 0.13), night);
  vec3 col = mix(low, mid, smoothstep(0.0, 0.35, hz));
  col = mix(col, top, smoothstep(0.3, 0.9, hz));
  // The glow over the horizon is a band of faint glyphs; higher up the
  // sky drops to paper.
  float tone = 0.2 * (1.0 - smoothstep(0.0, 0.25, hz)) * (1.0 - 0.75 * night);

  vec2 sun = vec2(sunX, DUBAI_SHORE + 0.3 - 0.32 * night);
  float d = length(q - sun);
  float radius = 0.05;
  float halo = exp(-max(d - radius, 0.0) * 10.0) * (1.0 - 0.85 * night);
  col += vec3(1.0, 0.5, 0.18) * halo * 0.7;
  tone += halo * 0.28;
  if (d < radius) {
    col = mix(vec3(1.0, 0.9, 0.55), vec3(1.0, 0.45, 0.2), smoothstep(radius * 0.4, radius, d));
    tone = 0.95;
  }

  // Thin streaks of cloud, lit gold from below at sunset.
  float c = fbm(vec2(q.x * 1.8 - t * 0.006, q.y * 16.0 + 3.0));
  float wisp = smoothstep(0.6, 0.78, c) * smoothstep(0.12, 0.3, hz) * smoothstep(0.7, 0.4, hz);
  col = mix(col, mix(vec3(1.0, 0.62, 0.42), vec3(0.32, 0.26, 0.48), night), wisp);
  tone = max(tone, wisp * 0.18);

  // Stars come out as the sky darkens.
  vec2 id = floor(q * 90.0);
  float star = hash21(id + 4.3);
  if (star > 0.986 && hz > 0.3) {
    float twinkle = 0.55 + 0.45 * sin(t * (1.0 + star * 3.0) + star * 50.0);
    float show = smoothstep(0.25, 0.75, night) * smoothstep(0.3, 0.55, hz);
    // Most stars are faint dots; a few bright ones twinkle as larger glyphs.
    tone = max(tone, (star > 0.996 ? 0.6 : 0.22) * twinkle * show);
    col = mix(col, vec3(0.86, 0.9, 1.0), show);
  }

  // A plane crosses high up, its strobe blinking.
  float span = u_resolution.x / u_resolution.y;
  vec2 plane = vec2(mix(-0.6 * span - 0.1, 0.6 * span + 0.1, fract(t / 48.0)), 0.74 + 0.03 * sin(t * 0.05));
  vec2 pd = abs(q - plane);
  if (pd.x < 0.6 * px && pd.y < 0.5 * px) {
    float strobe = step(fract(t * 1.1), 0.18);
    tone = max(tone, 0.5 + 0.45 * strobe);
    col = mix(vec3(1.0, 0.3, 0.25), vec3(1.0), strobe);
  }
  return vec4(col, tone);
}

// Two ridges of dunes behind the city, sand blowing off the crests. The
// low near ridge is tested first so its outline crosses the taller one.
vec4 dubaiDunes(vec2 q, float t, float px) {
  float night = dubaiHour;
  for (int i = 0; i < 2; i++) {
    float back = float(i);
    vec2 dune = dubaiDune(q.x, back);
    float above = q.y - dune.x;
    if (above < 0.0) {
      // Windward slopes face the low sun on the left; slip faces fall into shadow.
      float lit = smoothstep(0.82, 0.7, dune.y) * smoothstep(0.0, 0.06, dune.y);
      vec3 sand = mix(vec3(1.0, 0.68, 0.36), vec3(0.44, 0.37, 0.55), night);
      vec3 shade = mix(vec3(0.66, 0.34, 0.28), vec3(0.17, 0.17, 0.33), night);
      vec3 col = mix(shade, sand, lit);
      // Ripples the wind combs across the sand.
      float ripple = step(0.55, fract(q.x * 70.0 + q.y * 260.0 + 0.4 * sin(q.x * 18.0)));
      float tone = mix(0.08, 0.18, lit) + 0.06 * ripple * lit;
      // The ridge line catches the light, brightest along the crest.
      float edge = step(-0.9 * px, above);
      float crest = edge * mix(0.6, 1.0, smoothstep(0.4, 0.75, dune.y) * smoothstep(1.0, 0.8, dune.y));
      tone = max(tone, crest * 0.72);
      col = mix(col, mix(vec3(1.0, 0.82, 0.5), vec3(0.6, 0.55, 0.75), night), crest);
      tone *= (1.0 - 0.45 * night) * mix(1.0, 0.72, back);
      col = mix(col, vec3(0.9, 0.5, 0.35), back * 0.25 * (1.0 - night));
      return vec4(col, tone);
    }
    // Plumes stream downwind off the crests.
    float plume = snoise(vec2((q.x - t * 0.07) * 26.0, above * 80.0 - q.x * 9.0 - t * 0.3));
    float near = smoothstep(0.5, 0.75, dune.y) + smoothstep(0.75, 1.0, dune.y) * 0.6;
    float blow = smoothstep(0.3, 0.85, plume) * exp(-above * 55.0) * near * dubaiSand;
    if (blow > 0.12) {
      return vec4(mix(vec3(1.0, 0.72, 0.42), vec3(0.5, 0.45, 0.62), night), blow * 0.42 * (1.0 - 0.4 * night));
    }
  }
  return vec4(0.0, 0.0, 0.0, -1.0);
}

// Lit windows on a grid of floors, more of them as night falls, a few
// switching on and off.
float dubaiWindow(vec2 cellId, float t, float rate) {
  float h = hash21(cellId);
  float flick = hash21(cellId + floor(t * 0.15 + h * 9.0) * 1.37);
  return step(h, rate) * step(0.08, flick);
}

// Glass towers from one row of hashed slots: the far skyline when far > 0.5,
// the downtown cluster around the Burj otherwise.
vec4 dubaiTowers(vec2 q, float burjX, float t, float px, float far) {
  float night = dubaiHour;
  float cw = mix(0.085, 0.05, far);
  float slot = floor(q.x / cw);
  vec4 hit = vec4(0.0, 0.0, 0.0, -1.0);
  for (int j = -1; j <= 1; j++) {
    float s = slot + float(j);
    float h1 = hash21(vec2(s, 11.0 + far * 5.0));
    float h2 = hash21(vec2(s, 17.0 + far * 5.0));
    float h3 = hash21(vec2(s, 23.0 + far * 5.0));
    float cx = (s + 0.5 + (h2 - 0.5) * 0.5) * cw;
    float hw = cw * mix(0.28, 0.42, h3);
    float dx = cx - burjX;
    // Downtown rises around the Burj and falls away toward the desert.
    float downtown = exp(-dx * dx / mix(0.05, 0.22, far));
    float height = DUBAI_SHORE + mix(0.05, 0.02, far)
      + mix(0.05 + 0.28 * h1 * h1, 0.03 + 0.13 * h1 * h1, far) * mix(0.3, 1.0, downtown);
    // Leave the Burj its own slot, and gaps where the desert shows.
    // Away from downtown the towers thin out and the desert shows.
    if (abs(dx) < 0.05 + hw || (far > 0.5 && h2 > 0.72) || h3 > downtown + mix(0.3, 0.15, far)) {
      continue;
    }
    float lx = (q.x - (cx - hw)) / (2.0 * hw);
    if (lx < 0.0 || lx > 1.0) {
      continue;
    }
    float kind = floor(h2 * 4.0);
    float top = height;
    if (kind < 0.5) {
      // A sloped crown, like the Emirates Towers.
      top = height + 0.045 * (h1 > 0.5 ? lx : 1.0 - lx) - 0.02;
    } else if (kind < 1.5) {
      top = height - 0.03 * abs(lx * 2.0 - 1.0);
    } else if (kind < 2.5 && abs(lx - 0.5) < max(0.06, 0.35 * px / hw)) {
      top = height + 0.035;
    }
    if (q.y > top || q.y < DUBAI_SHORE - 0.002) {
      continue;
    }
    float lit = dubaiLit(q.y);
    vec3 glass = mix(vec3(0.3, 0.34, 0.5), vec3(0.14, 0.17, 0.32), night);
    vec3 gold = vec3(1.0, 0.7, 0.32);
    float face = smoothstep(0.55, 0.25, lx);
    float tone = mix(0.48, 0.56, face);
    vec3 col = glass;
    // Sun-facing glass turns gold above the shadow line.
    col = mix(col, gold, lit * mix(0.55, 1.0, face));
    tone = mix(tone, mix(0.72, 0.9, face), lit);
    // A glint of sky slides across the glass now and then.
    float glint = fract(t * 0.035 + h3 * 7.0) * 3.0 - 1.0;
    float sheen = exp(-abs(lx - glint - (q.y - DUBAI_SHORE) * 2.0) * 30.0) * (1.0 - far);
    tone = min(1.0, tone + sheen * 0.3);
    col = mix(col, vec3(1.0, 0.86, 0.62), sheen * 0.6);
    // Windows: a floor every two rows at least, three to seven bays across.
    float floorH = max(0.013, 2.0 * px);
    float floors = floor((q.y - DUBAI_SHORE) / floorH);
    float bays = floor(lx * mix(3.0, 7.0, h3));
    float rate = mix(0.1, 0.55, night) * (1.0 - lit) * mix(1.0, 0.7, far);
    float on = dubaiWindow(vec2(s * 13.0 + bays, floors + far * 50.0), t, rate);
    if (on > 0.5 && fract((q.y - DUBAI_SHORE) / floorH) > 0.5) {
      col = hash21(vec2(s, bays)) > 0.3 ? vec3(1.0, 0.82, 0.5) : vec3(0.7, 0.86, 1.0);
      tone = 0.86;
    }
    // Far towers sink into the haze over the horizon.
    if (far > 0.5) {
      col = mix(col, mix(vec3(0.75, 0.42, 0.42), vec3(0.2, 0.16, 0.34), night), 0.45);
      tone *= 0.8;
    }
    hit = vec4(col, tone);
  }
  return hit;
}

// The Burj Khalifa from the front: three wings around a core, each wing
// stepping back at its own height so the setbacks spiral up, then the
// core alone, then the spire.
vec4 dubaiBurj(vec2 q, float burjX, float t, float px) {
  float bx = q.x - burjX;
  float y = q.y;
  if (y < DUBAI_BURJ_BASE - 0.002 || y > DUBAI_BURJ_TIP || abs(bx) > 0.07) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float night = dubaiHour;
  float h = (y - DUBAI_BURJ_BASE) / (DUBAI_BURJ_ROOF - DUBAI_BURJ_BASE);
  const float TIERS = 9.0;
  const float BASE = 0.1;
  float core = max(0.008, 0.6 * px);
  float tierL = floor(h * TIERS);
  float tierR = floor(h * TIERS + 0.5);
  float wingL = BASE * pow(max(0.0, 1.0 - tierL / TIERS), 1.5);
  float wingR = BASE * pow(max(0.0, 1.0 - (tierR - 0.5) / TIERS), 1.5);
  // The front wing narrows more slowly than the side wings.
  float front = max(core * 1.3, BASE * 0.45 * pow(max(0.0, 1.0 - h), 0.9));
  float left = h > 1.0 ? 0.0 : max(max(wingL, core), front);
  float right = h > 1.0 ? 0.0 : max(max(wingR, core), front);
  bool spire = false;
  if (h > 1.0) {
    float s = (y - DUBAI_BURJ_ROOF) / (DUBAI_BURJ_TIP - DUBAI_BURJ_ROOF);
    float hw = max(mix(core * 0.85, core * 0.15, s), 0.34 * px);
    left = hw;
    right = hw;
    spire = true;
  }
  if (bx < -left || bx > right) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float lit = dubaiLit(y);
  bool frontWing = abs(bx) < front || spire;
  vec3 glass = mix(vec3(0.34, 0.37, 0.54), vec3(0.17, 0.2, 0.36), night);
  vec3 col = frontWing ? glass * 1.15 : glass * 0.85;
  float tone = frontWing ? 0.62 : 0.5;
  // Sunlight lands hardest on the left, where the sun is.
  float side = smoothstep(right, -left, bx);
  col = mix(col, mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.86, 0.55), side), lit);
  tone = mix(tone, mix(0.8, 1.0, side) * (frontWing ? 1.0 : 0.9), lit);
  // A bright ledge on top of each setback.
  float ledgeL = fract(h * TIERS) * (DUBAI_BURJ_ROOF - DUBAI_BURJ_BASE) / TIERS;
  float ledgeR = fract(h * TIERS + 0.5) * (DUBAI_BURJ_ROOF - DUBAI_BURJ_BASE) / TIERS;
  bool onLedge = !spire && !frontWing
    && ((bx < 0.0 && ledgeL > (DUBAI_BURJ_ROOF - DUBAI_BURJ_BASE) / TIERS - 1.2 * px)
      || (bx > 0.0 && ledgeR > (DUBAI_BURJ_ROOF - DUBAI_BURJ_BASE) / TIERS - 1.2 * px));
  if (onLedge) {
    tone = min(1.0, tone + 0.2);
    col = mix(col, vec3(1.0, 0.9, 0.7), 0.5);
  }
  // Seams between the wings.
  if (!spire && abs(abs(bx) - front) < 0.45 * px) {
    tone *= 0.8;
  }
  // Scattered lit floors after dark, below the sunlight.
  float on = dubaiWindow(vec2(floor(bx * 220.0) + 400.0, floor(y * 95.0)), t, mix(0.04, 0.28, night) * (1.0 - lit));
  if (on > 0.5 && !spire) {
    col = vec3(1.0, 0.86, 0.6);
    tone = 0.9;
  }
  // The aircraft beacon on the tip.
  if (y > DUBAI_BURJ_TIP - 2.5 * px) {
    float blink = step(fract(t * 0.6), 0.35);
    col = mix(col, vec3(1.0, 0.18, 0.15), blink);
    tone = max(tone, blink);
  }
  return vec4(col, tone);
}

// The Burj Al Arab on its island: a straight mast on the land side and a
// sail that bellies out toward the sea, ribbed, with the helipad near the
// top. Floodlights change its colour after dark.
vec4 dubaiSail(vec2 q, float sailX, float t, float px) {
  const float HEIGHT = 0.31;
  float base = DUBAI_SHORE + 0.004;
  float ax = q.x - sailX;
  float h = (q.y - base) / HEIGHT;
  float night = dubaiHour;
  // The island it stands on.
  if (q.y < base + 0.006 && q.y > DUBAI_SHORE - 0.003 && abs(ax - 0.015) < 0.045 - (q.y - DUBAI_SHORE) * 2.0) {
    return vec4(mix(vec3(0.9, 0.62, 0.38), vec3(0.32, 0.3, 0.45), night), 0.38);
  }
  if (h < 0.0 || h > 1.18 || ax < -0.03 || ax > 0.1) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float back = -0.016 + 0.01 * h;
  float belly = pow(sin(3.14159 * clamp(h * 0.92, 0.0, 1.0)), 0.75) * (1.0 - 0.35 * h);
  float edge = back + 0.003 + 0.08 * belly;
  float mastW = max(0.0022, 0.45 * px);
  bool mast = abs(ax - back) < mastW && h < 1.18;
  bool sail = h <= 1.0 && ax > back && ax < edge;
  bool pad = h > 0.78 && h < 0.78 + max(0.04, 1.0 * px / HEIGHT) && ax > edge - 0.002 && ax < edge + 0.022;
  if (!mast && !sail && !pad) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  vec3 white = mix(vec3(1.0, 0.86, 0.66), vec3(0.75, 0.72, 0.86), night);
  float flood = smoothstep(0.35, 0.75, night);
  vec3 lights = toSrgb(oklch(0.72, 0.14, t * 0.12 + h * 1.6));
  vec3 col = mix(white, lights, flood * 0.85);
  float across = (ax - back) / max(edge - back, 1e-3);
  float tone = mix(0.56, 0.66, flood) * mix(1.0, 0.85, across);
  // Ribs curve across the fabric.
  float rib = fract(h * 11.0 + across * across * 0.6);
  if (sail && rib < 0.18) {
    tone += 0.16;
  }
  // The outer frame and the mast are the brightest lines.
  if (mast || pad || (sail && edge - ax < 1.2 * px)) {
    tone = 0.92;
    col = mix(vec3(1.0, 0.94, 0.82), lights, flood * 0.4);
  }
  return vec4(col, min(tone, 1.0));
}

// Everything above the waterline, front layer first.
vec4 dubaiLand(vec2 q, vec2 ptr, float burjX, float sailX, float sunX, float t, float px) {
  vec4 layer = dubaiSail(q + ptr * 0.8, sailX, t, px);
  if (layer.a >= 0.0) return layer;
  layer = dubaiTowers(q + ptr * 0.7, burjX, t, px, 0.0);
  if (layer.a >= 0.0) return layer;
  layer = dubaiBurj(q + ptr * 0.55, burjX, t, px);
  if (layer.a >= 0.0) return layer;
  layer = dubaiTowers(q + ptr * 0.4, burjX, t, px, 1.0);
  if (layer.a >= 0.0) return layer;
  layer = dubaiDunes(q + ptr * 0.25, t, px);
  if (layer.a >= 0.0) return layer;
  return dubaiSky(q + ptr * 0.08, sunX, t, px);
}

// The fountain in the lake at the Burj's feet: a show every fourteen
// seconds, jets swaying in arcs and pulsing in turn.
vec4 dubaiFountain(vec2 q, float burjX, float t, float px) {
  if (dubaiFountainOn < 0.5) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float phase = mod(t + 3.0, 14.0);
  float show = smoothstep(0.0, 1.2, phase) * smoothstep(7.5, 6.0, phase);
  if (show <= 0.0) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float y0 = DUBAI_SHORE - 0.03;
  float rise = q.y - y0;
  if (rise < 0.0 || rise > 0.24) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  float best = 0.0;
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float jx = burjX + (fi - 3.0) * max(0.034, 1.4 * px);
    float pulse = 0.55 + 0.45 * sin(t * 2.2 - fi * 0.7);
    float tall = (0.08 + 0.13 * pulse * (1.0 - abs(fi - 3.0) * 0.15)) * show;
    if (rise > tall) {
      continue;
    }
    float lean = sin(t * 1.3 + fi * 0.9) * 0.25;
    float u = rise / tall;
    // The jet leans and curls over at the top, spraying wider as it falls.
    float x = jx + lean * rise + lean * 0.4 * tall * u * u;
    float width = max(0.0025, 0.35 * px) * (1.0 + 1.5 * u * u);
    float d = abs(q.x - x);
    float spray = hash21(floor(q * 400.0) + floor(t * 12.0)) > 0.5 + 0.4 * u ? 1.0 : 0.0;
    float core = step(d, width) * mix(1.0, spray, smoothstep(0.55, 1.0, u));
    best = max(best, core * (1.0 - 0.35 * u));
  }
  if (best <= 0.0) {
    return vec4(0.0, 0.0, 0.0, -1.0);
  }
  vec3 col = mix(vec3(1.0, 0.92, 0.75), vec3(0.78, 0.9, 1.0), dubaiHour);
  return vec4(col, best * 0.95);
}

vec2 dubaiCacheUv = vec2(-1.0);
float dubaiCacheT = -1.0;
vec4 dubaiCacheValue = vec4(0.0);

vec4 dubaiScene(vec2 uv, vec2 res, float t) {
  if (uv == dubaiCacheUv && t == dubaiCacheT) {
    return dubaiCacheValue;
  }
  float aspect = res.x / res.y;
  float px = 1.0 / res.y;
  vec2 q = vec2((uv.x - 0.5) * aspect, uv.y);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * dubaiParallax * vec2(-0.05, -0.015);
  // Landmarks sit at fractions of the half width, clamped so a phone
  // still gets both Burjs in frame.
  float span = clamp(0.5 * aspect, 0.24, 0.95);
  float burjX = -0.2 * span;
  float sailX = 0.66 * span - 0.02;
  float sunX = -0.62 * span;

  // Heat shimmer bends the lowest air sideways, most in the evening heat.
  float heat = dubaiSand * (1.0 - 0.7 * dubaiHour)
    * smoothstep(DUBAI_SHORE - 0.01, DUBAI_SHORE + 0.02, q.y)
    * smoothstep(DUBAI_SHORE + 0.16, DUBAI_SHORE + 0.03, q.y);
  vec2 hq = q + vec2(heat * 0.0055 * sin(q.y * 190.0 + t * 5.0 + 3.0 * snoise(vec2(q.x * 7.0, t * 0.4))), 0.0);

  vec4 scene;
  if (q.y >= DUBAI_SHORE) {
    scene = dubaiLand(hq, ptr, burjX, sailX, sunX, t, px);
  } else {
    // The lake mirrors the city, broken into ripples.
    float depth = DUBAI_SHORE - q.y;
    float wobble = 0.004 * sin(q.y * 240.0 + t * 1.6) * (1.0 + depth * 18.0);
    vec2 mq = vec2(q.x + wobble, DUBAI_SHORE + depth * 1.3);
    vec4 above = dubaiLand(mq, ptr, burjX, sailX, sunX, t, px);
    float ripple = snoise(vec2(q.x * 14.0, q.y * 190.0 - t * 0.7));
    float keep = smoothstep(-0.35, 0.25, ripple);
    vec3 water = mix(vec3(0.16, 0.2, 0.36), vec3(0.04, 0.06, 0.16), dubaiHour);
    float tone = above.a * 0.52 * keep * (1.0 - depth * 2.5);
    vec3 col = mix(water, above.rgb, 0.75);
    // Sun glitter on the water.
    float path = exp(-abs(q.x - sunX) * 9.0) * (1.0 - dubaiHour);
    float glitter = step(0.93 - 0.2 * path, hash21(floor(vec2(q.x * 150.0, q.y * 260.0)) + floor(t * 3.0) * 0.71));
    if (glitter > 0.5 && path > 0.05) {
      tone = max(tone, 0.5 * path + 0.2);
      col = vec3(1.0, 0.78, 0.42);
    }
    // The waterline.
    if (depth < 1.1 * px) {
      tone = max(tone, 0.34);
      col = mix(col, vec3(1.0, 0.72, 0.4), 0.6 * (1.0 - dubaiHour));
    }
    scene = vec4(col, tone);
  }

  vec4 jet = dubaiFountain(q + ptr * 0.75, burjX, t, px);
  if (jet.a > 0.0) {
    scene = vec4(mix(scene.rgb, jet.rgb, jet.a), max(scene.a, jet.a));
  }

  // Grains of sand carried on the wind over the low city.
  if (dubaiSand > 0.0 && q.y > DUBAI_SHORE && q.y < DUBAI_SHORE + 0.22) {
    vec2 g = floor(vec2((q.x - t * 0.11) * 120.0, q.y * 150.0 + sin(q.x * 9.0 + t) * 2.0));
    float grain = hash21(g + 31.0);
    if (grain > 1.0 - 0.006 * dubaiSand) {
      scene = vec4(mix(vec3(1.0, 0.76, 0.45), vec3(0.6, 0.55, 0.7), dubaiHour), max(scene.a, 0.42));
    }
  }

  float tone = clamp(scene.a, 0.0, 1.0) * dubaiIntensity;
  // Near-empty tones go to paper so the open sky stays clean.
  tone = tone < 0.05 ? 0.0 : tone;
  vec3 col = max(scene.rgb, vec3(0.0));
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.5 + 0.5 * smoothstep(0.0, 0.85, peak));
  dubaiCacheUv = uv;
  dubaiCacheT = t;
  dubaiCacheValue = vec4(ink, tone);
  return dubaiCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return dubaiScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return dubaiScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const DUSK = "#070915";
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
        "radial-gradient(ellipse at 20% 78%, #ffb35c55 0, transparent 40%), linear-gradient(to bottom, #0b1030 0%, #3a2350 45%, #d9783a 80%, #1a1426 85%, #070915 100%)",
    }}
  />
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface DubaiProps extends AsciiSceneProps {
  /** Time of day, from 0 (golden hour, sun over the dunes) to 1 (night, only the beacon and windows lit). Default 0.45. */
  hour?: number;
  /** Wind-blown sand off the dunes and heat shimmer near the ground, from 0 to 1. Default 1. */
  sand?: number;
  /** Fountain shows in the lake at the foot of the Burj Khalifa, every 14 seconds. Default `true`. */
  fountain?: boolean;
  /** Dims the whole scene so text on top stays readable, from 0 to 1. Default 1. */
  intensity?: number;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's dusk colour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Dubai from the lake at golden hour. The Burj Khalifa towers over a
 * cluster of glass towers, its upper floors still in the sun; the Burj Al
 * Arab stands on the shore, dunes roll behind with sand blowing off their
 * crests, and the fountain shoots arcs now and then. The pointer moves the
 * layers apart. Decorative and full-bleed: size it with `className`,
 * usually `absolute inset-0`.
 */
export const Dubai = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  cell = 12,
  stillTime = 2,
  interactive = true,
  interaction = "none",
  hour = 0.45,
  sand = 1,
  fountain = true,
  intensity = 1,
  fallback = FALLBACK,
  ...props
}: DubaiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        dubaiFountainOn: fountain ? 1 : 0,
        dubaiHour: clamp01(hour),
        dubaiIntensity: clamp01(intensity),
        dubaiParallax: interactive ? 1 : 0,
        dubaiSand: clamp01(sand),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
