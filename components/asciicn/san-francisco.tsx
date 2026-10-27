"use client";

import type { ReactNode } from "react";

import { useAsciiColors } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The Golden Gate on a foggy morning, seen from the bay. Everything is laid
// out in box-height units (y runs 0 at the bottom to 1 at the top, x is
// centred and scaled by the true aspect), and the span between the towers
// follows the box's width, so a phone still shows both towers. Layers from
// back to front: sky and sun, the city on its hills, the Marin headlands,
// the bridge, the fog bank, the water with boats, and gulls. Each layer
// returns its own colour and tone, so open sky stays empty, the fog draws
// light glyphs and the orange steel is densest. `sfScene` is cached per
// sample because field and colorField both ask.
const SCENE = `
const float SF_WATER = 0.27;
const float SF_PIER = 0.245;
const float SF_DECK = 0.36;
const float SF_TOP = 0.68;

const vec3 sfOrange = vec3(0.93, 0.36, 0.2);
const vec3 sfFogLit = vec3(0.86, 0.9, 0.95);
const vec3 sfFogShade = vec3(0.6, 0.67, 0.76);

// Half the main span: the towers stand at plus and minus this.
float sfSpan(float aspect) {
  return clamp(0.36 * aspect, 0.15, 0.62);
}

vec4 sfSky(vec2 p, float t, float pixel, vec2 sun) {
  float h = clamp((p.y - SF_WATER) / (1.0 - SF_WATER), 0.0, 1.0);
  vec3 col = mix(vec3(1.0, 0.86, 0.72), vec3(0.78, 0.84, 0.9), smoothstep(0.0, 0.35, h));
  col = mix(col, vec3(0.6, 0.72, 0.86), smoothstep(0.35, 1.0, h));
  float tone = 0.0;

  // A pale morning sun behind thin haze, with a wide soft glow.
  float r = length(p - sun);
  float disc = 1.0 - smoothstep(0.036 - pixel, 0.036 + pixel, r);
  float halo = exp(-max(r - 0.036, 0.0) * 22.0) * (1.0 - disc);
  col = mix(col, vec3(1.0, 0.9, 0.66), max(disc, halo * 0.8));
  tone = max(disc * 0.5, halo * 0.22);

  // High streaks of thin cloud, drifting east.
  float band = smoothstep(0.5, 0.65, h) * (1.0 - smoothstep(0.85, 1.0, h));
  float streak = fbm(vec2(p.x * 1.1 - t * 0.008, p.y * 9.0));
  float wisp = smoothstep(0.68, 0.78, streak) * band;
  col = mix(col, vec3(0.94, 0.95, 0.98), wisp);
  tone = max(tone, wisp * 0.24);
  return vec4(col, tone);
}

// The Transamerica Pyramid: a tapering spire with its two wings near the top.
float sfPyramid(vec2 d, float pixel, float colW) {
  float height = 0.33;
  float halfW = 0.04;
  float s = d.y / height;
  if (s < 0.0 || s > 1.12) {
    return 0.0;
  }
  float w = max(halfW * (1.0 - s), colW * 0.5);
  if (abs(d.x) < w) {
    return 1.0;
  }
  // The wings that hold the lift shafts and stairs, on both sides.
  float wingX = halfW * (1.0 - 0.7) + colW * 0.6;
  if (s > 0.62 && s < 0.82 && abs(abs(d.x) - wingX) < colW * 0.6) {
    return 0.8;
  }
  return 0.0;
}

// The city on its hills behind the south end: houses stacked on the slopes,
// downtown towers with the pyramid among them, and Coit Tower on its hill.
vec4 sfCity(vec2 p, float t, float pixel, float colW, float px) {
  float x = p.x - px;
  vec4 k = (vec4(x) - vec4(-0.17, 0.2, -0.02, 0.5)) / vec4(0.09, 0.13, 0.06, 0.22);
  vec4 bumps = exp(-k * k);
  float hill = SF_WATER + 0.008 + dot(bumps, vec4(0.19, 0.21, 0.12, 0.17))
    + 0.006 * snoise(vec2(p.x * 12.0, 3.0));
  hill = mix(SF_WATER, hill, smoothstep(-0.34, -0.26, x));
  float base = SF_WATER + 0.012;

  // Downtown: a cluster of plain towers around the pyramid.
  float towerTop = 0.0;
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float bx = -0.07 + fi * 0.03 + 0.008 * hash21(vec2(fi, 2.0));
    float bh = 0.1 + 0.09 * hash21(vec2(fi, 9.0));
    float bw = 0.009 + 0.006 * hash21(vec2(fi, 4.0));
    if (abs(x - bx) < max(bw, colW * 0.5)) {
      towerTop = max(towerTop, base + bh);
    }
  }
  float pyr = sfPyramid(vec2(x, p.y - base), pixel, colW);
  // Coit Tower: a slim fluted column on Telegraph Hill.
  vec2 coit = vec2(-0.17, SF_WATER + 0.196);
  float coitHit = step(abs(x - coit.x), max(0.005, colW * 0.5)) * step(coit.y, p.y) * step(p.y, coit.y + 0.04);

  vec3 cream = vec3(0.95, 0.92, 0.86);
  // The morning sun comes from the east, behind and right, so the right
  // faces catch the light.
  if (pyr > 0.0) {
    float lit = step(0.0, x);
    return vec4(mix(cream * 0.8, cream, lit), mix(0.62, 0.78, lit) * pyr);
  }
  if (coitHit > 0.5) {
    return vec4(cream, 0.5);
  }
  if (p.y < towerTop) {
    vec2 g = floor(vec2(p.x / max(colW, 0.004), p.y * 90.0));
    float win = step(0.6, hash21(g + 7.0));
    vec3 col = mix(vec3(0.68, 0.72, 0.78), vec3(1.0, 0.86, 0.62), win * 0.6);
    return vec4(col, 0.36 + 0.1 * win);
  }
  if (p.y < hill) {
    // Rows of small houses, white and pastel, with gaps of green.
    vec2 g = floor(vec2(p.x * 70.0, p.y * 110.0));
    float house = hash21(g);
    float green = smoothstep(0.45, 0.6, fbm(p * vec2(14.0, 30.0)));
    vec3 col = house < 0.33 ? vec3(0.96, 0.94, 0.9)
      : house < 0.66 ? vec3(0.92, 0.82, 0.74)
      : vec3(0.78, 0.84, 0.88);
    col = mix(col, vec3(0.5, 0.62, 0.48), green * 0.8);
    return vec4(col, mix(0.3, 0.2, green) + 0.08 * step(0.8, house));
  }
  return vec4(0.0);
}

// The Marin headlands: steep green-brown hills that the north end of the
// bridge runs into, with the fog pouring over their ridge.
float sfRidge(float x, float span) {
  float rise = smoothstep(-span * 0.95, -span * 1.35 - 0.12, x);
  return SF_PIER + (0.52 - SF_PIER) * rise
    + 0.025 * rise * snoise(vec2(x * 5.0, 1.0)) + 0.01 * snoise(vec2(x * 17.0, 4.0));
}

vec4 sfHeadlands(vec2 p, float span) {
  float ridge = sfRidge(p.x, span);
  if (p.y > ridge || p.y < SF_PIER - 0.012 || p.x > -span * 0.6) {
    return vec4(0.0);
  }
  float depth = ridge - p.y;
  float scrub = fbm(p * vec2(9.0, 18.0));
  vec3 col = mix(vec3(0.62, 0.6, 0.42), vec3(0.32, 0.45, 0.32), smoothstep(0.35, 0.65, scrub));
  // The sunlit crest is brighter than the shaded slope below it.
  col *= mix(1.0, 0.75, smoothstep(0.0, 0.12, depth));
  float tone = 0.34 + 0.18 * smoothstep(0.4, 0.7, scrub) + 0.12 * (1.0 - smoothstep(0.0, 0.015, depth));
  return vec4(col, tone);
}

// One tower, face on: two tapering legs, stepped back at each portal, joined
// by portal struts whose openings have stepped art deco corners. A red
// aviation light blinks on top.
vec4 sfTower(vec2 p, float cx, float t, float pixel, float colW) {
  float x = p.x - cx;
  float ax = abs(x);
  float y = p.y;
  if (y < SF_PIER || y > SF_TOP + 0.02 || ax > 0.06) {
    return vec4(0.0);
  }
  float h = SF_TOP - SF_DECK;
  // Portal struts, as fractions of the height above the deck.
  float s1 = SF_DECK + h * 0.3;
  float s2 = SF_DECK + h * 0.56;
  float s3 = SF_DECK + h * 0.8;
  float strutH = max(0.01, pixel * 0.9);
  // The legs step in at every strut, like setbacks on a deco tower.
  float tier = y < s1 ? 0.0 : y < s2 ? 1.0 : y < s3 ? 2.0 : 3.0;
  float outer = max(0.05 - tier * 0.004, colW * 3.0);
  float leg = max(0.018, colW * 1.6);
  float inner = outer - leg;
  if (y > SF_TOP) {
    // The cap and the light.
    float blink = step(0.55, fract(t * 0.5 + cx));
    if (ax < max(colW * 0.6, 0.004) && y < SF_TOP + 0.014) {
      return vec4(mix(vec3(0.5, 0.1, 0.08), vec3(1.0, 0.15, 0.1), blink), 0.55 + 0.45 * blink);
    }
    return vec4(0.0);
  }
  if (ax > outer) {
    return vec4(0.0);
  }
  // The sunlit right face is brighter; a recess runs down each leg.
  float lit = mix(0.78, 1.0, step(0.0, x));
  if (ax > inner) {
    float flute = abs(ax - (inner + leg * 0.5)) < leg * 0.18 ? 0.86 : 1.0;
    return vec4(sfOrange * lit * flute, 0.88 * flute + 0.08 * lit);
  }
  // Between the legs: struts and their stepped corners.
  for (int i = 0; i < 4; i++) {
    float sy = i == 0 ? s1 : i == 1 ? s2 : i == 2 ? s3 : SF_TOP - strutH * 0.5;
    float under = sy - strutH * 0.5 - y;
    if (abs(y - sy) < strutH * 0.5) {
      return vec4(sfOrange * lit * 0.92, 0.82);
    }
    // One stepped corner under each strut, the deco touch on the portals.
    if (under > 0.0 && under < max(0.008, pixel * 0.8) && ax > inner - max(0.007, colW)) {
      return vec4(sfOrange * lit * 0.85, 0.74);
    }
  }
  // Below the deck: an X brace between the legs, then the pier.
  if (y < SF_DECK - 0.03 && y > SF_PIER + 0.02) {
    float v = (y - SF_PIER - 0.02) / (SF_DECK - 0.05 - SF_PIER);
    float diag = abs(ax - inner * abs(1.0 - 2.0 * v));
    if (diag < max(0.004, colW * 0.6)) {
      return vec4(sfOrange * 0.7, 0.6);
    }
  }
  if (y < SF_PIER + 0.02) {
    return vec4(vec3(0.62, 0.6, 0.58), 0.6);
  }
  return vec4(0.0);
}

// The main cables, the suspenders hung from them, the deck with its truss,
// the traffic on it and the anchorages at both ends.
vec4 sfSpanSteel(vec2 p, float t, float pixel, float colW, float span) {
  float side = span * 0.5;
  float end = span + side;
  float ax = abs(p.x);
  if (ax > end + 0.03) {
    return vec4(0.0);
  }
  float top = SF_TOP - 0.01;
  float low = SF_DECK + 0.022;
  float anchor = SF_DECK + 0.006;
  float cable;
  float slope;
  if (ax < span) {
    float u = p.x / span;
    cable = low + (top - low) * u * u;
    slope = 2.0 * (top - low) * u / span;
  } else {
    float u = 1.0 - (ax - span) / side;
    cable = anchor + (top - anchor) * u * u;
    slope = 2.0 * (top - anchor) * u / side;
  }
  float thick = max(0.004, pixel * 0.5) * sqrt(1.0 + slope * slope);
  if (abs(p.y - cable) < thick && ax < end) {
    return vec4(sfOrange, 0.95);
  }

  // The deck: a roadway on a deep stiffening truss.
  float deckH = max(0.022, pixel * 1.6);
  float dy = SF_DECK - p.y;
  if (dy > 0.0 && dy < deckH && ax < end) {
    // Cars in both directions: headlights one way, tail lights the other.
    if (dy < deckH * 0.4) {
      for (int k = 0; k < 2; k++) {
        float dir = k == 0 ? 1.0 : -1.0;
        float lane = (p.x * dir + t * 0.06) / 0.11;
        float slot = floor(lane);
        float on = step(hash21(vec2(slot, float(k) + 3.0)), sfTraffic);
        if (on > 0.5 && fract(lane) < 0.1) {
          vec3 light = k == 0 ? vec3(1.0, 0.95, 0.8) : vec3(1.0, 0.2, 0.15);
          return vec4(light, 0.95);
        }
      }
      return vec4(sfOrange * 0.9, 0.86);
    }
    float v = dy / deckH;
    float u = fract(p.x / 0.024);
    float web = min(abs(u - v), abs(u - (1.0 - v)));
    if (v > 0.85 || web < 0.18) {
      return vec4(sfOrange * 0.72, 0.7);
    }
    return vec4(sfOrange * 0.45, 0.3);
  }

  // Suspenders: one glyph column each, so they stay crisp at any width.
  if (p.y > SF_DECK && p.y < cable && ax < end && abs(ax - span) > 0.06) {
    float pitch = max(0.04, colW * 5.0);
    float k = floor(p.x / pitch + 0.5);
    if (abs(p.x - k * pitch) < colW * 0.5) {
      return vec4(sfOrange * 0.8, 0.26);
    }
  }

  // The anchorage blocks where the cables come down.
  if (ax > end - 0.012 && ax < end + 0.03 && p.y < SF_DECK + 0.012 && p.y > SF_PIER) {
    return vec4(vec3(0.72, 0.68, 0.64), 0.62);
  }
  return vec4(0.0);
}

// The fog bank pouring through the strait from the ocean side, on the left,
// in slow rolling billows. Returns the density, 0 to 1.
float sfFogBank(vec2 p, float t, float span) {
  vec2 q = p * vec2(2.0, 3.6);
  vec2 warp = vec2(
    fbm(q * 0.6 + vec2(-t * 0.04, t * 0.02)),
    fbm(q * 0.6 + vec2(5.2, -t * 0.03))
  );
  float n = fbm(q + warp * 1.6 - vec2(t * 0.08, 0.0));
  // Thickest at the ocean end, where it also spills over the headlands.
  float west = smoothstep(span * 0.5, -span * 1.6, p.x);
  // Rounded billow tops along the ceiling, rolling east.
  float billow = fbm(vec2(p.x * 2.6 - t * 0.06, t * 0.02));
  float ceiling = SF_DECK - 0.05 + sfFog * (0.06 + 0.2 * west) + 0.1 * (billow - 0.5);
  float body = smoothstep(ceiling + 0.012, ceiling - 0.05, p.y);
  // It sits on the water by the bridge and thins toward the viewer.
  float lift = smoothstep(SF_PIER - 0.07, SF_PIER - 0.01, p.y);
  float density = body * lift * mix(0.15, 1.0, smoothstep(0.46, 0.76, n));

  // Loose streamers torn off the bank, drifting through the towers.
  float streamer = smoothstep(0.62, 0.76, fbm(vec2(p.x * 1.8 - t * 0.1, p.y * 16.0 + warp.x)));
  streamer *= smoothstep(ceiling - 0.01, ceiling + 0.02, p.y) * (1.0 - smoothstep(ceiling + 0.08, ceiling + 0.16, p.y));
  density = max(density, streamer * 0.5);
  return clamp(density * (0.3 + sfFog), 0.0, 1.0);
}

// A lower, flatter layer behind the bridge that hides the city's waterfront.
float sfFogFar(vec2 p, float t) {
  float n = fbm(vec2(p.x * 3.0 - t * 0.05, p.y * 12.0));
  float top = SF_WATER + 0.035 + 0.025 * sfFog + 0.02 * (n - 0.5);
  float body = smoothstep(top + 0.005, top - 0.03, p.y) * smoothstep(SF_WATER - 0.012, SF_WATER, p.y);
  return clamp(body * smoothstep(0.3, 0.6, n) * sfFog, 0.0, 1.0);
}

vec4 sfFogColor(float density, vec2 p, float n) {
  // Billow tops catch the low sun; their undersides are cool and grey.
  vec3 col = mix(sfFogShade, sfFogLit, smoothstep(0.2, 0.8, n));
  col = mix(col, vec3(1.0, 0.92, 0.84), smoothstep(SF_DECK - 0.02, SF_DECK + 0.1, p.y) * 0.5);
  return vec4(col, 0.1 + 0.5 * pow(density, 1.5));
}

// Sailboats crossing the bay: a dark hull, a mainsail and a jib, a wake.
vec4 sfBoats(vec2 p, float t, float pixel, float colW, float halfW) {
  vec4 hit = vec4(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    if (hash21(vec2(fi, 31.0)) > sfSails + 0.05) {
      continue;
    }
    float y0 = mix(0.04, 0.16, hash21(vec2(fi, 11.0)));
    // Nearer boats are larger and move faster across the view.
    float scale = mix(1.8, 1.0, (y0 - 0.04) / 0.12);
    float dir = hash21(vec2(fi, 17.0)) > 0.5 ? 1.0 : -1.0;
    float travel = 2.0 * halfW + 0.15;
    float x0 = (fract(t * 0.006 * scale + hash21(vec2(fi, 5.0))) - 0.5) * travel * dir;
    vec2 d = (p - vec2(x0, y0)) / scale;
    d.x *= dir;
    // Rocking with the swell.
    d.y += 0.002 * sin(t * 1.3 + fi * 2.0);
    if (d.y > -0.005 && d.y < 0.004 && abs(d.x) < 0.026 - (0.004 - d.y) * 1.5) {
      hit = vec4(0.16, 0.22, 0.32, 0.66);
    }
    float mast = 0.002;
    float sailH = 0.07;
    float sy = d.y - 0.004;
    if (sy > 0.0 && sy < sailH) {
      float f = sy / sailH;
      // Main behind the mast, jib ahead of it, with a sliver of gap.
      if (d.x < -mast && d.x > -mast - 0.028 * (1.0 - f)) {
        hit = vec4(0.98, 0.98, 0.96, 0.78);
      } else if (d.x > mast && d.x < mast + 0.018 * (1.0 - f) && f < 0.85) {
        hit = vec4(0.92, 0.94, 0.98, 0.7);
      }
    }
    // The wake trails behind as broken foam.
    if (abs(d.y + 0.003) < 0.003 && d.x < -0.02 && d.x > -0.09) {
      float foam = step(0.5, hash21(floor(vec2(p.x / max(colW, 0.004), t * 2.0))));
      if (foam > 0.5 && hit.a < 0.2) {
        hit = vec4(0.9, 0.94, 0.98, 0.22 * (1.0 + d.x / 0.09));
      }
    }
  }
  return hit;
}

// The bay: grey-green swell with ripple lines, the sun's glitter and the
// towers' orange reflections, broken by the waves.
vec4 sfWater(vec2 p, float t, float pixel, float colW, float span, vec2 sun) {
  float dd = SF_WATER - p.y;
  float phase = p.y * 70.0 / (0.3 + p.y * 2.0) + t * 0.25;
  float wob = 0.3 * snoise(vec2(p.x * 4.0, floor(phase) * 1.3)) + 0.15 * snoise(vec2(p.x * 11.0, t * 0.15));
  float ripple = 1.0 - abs(fract(phase + wob) - 0.5) * 2.0;
  vec3 sea = mix(vec3(0.5, 0.62, 0.68), vec3(0.28, 0.42, 0.5), smoothstep(0.0, 0.2, dd));
  float broken = step(0.45, snoise(vec2(p.x * 7.0, floor(phase) * 2.3 + 0.5)) * 0.5 + 0.5);
  float tone = 0.2 * smoothstep(0.78, 1.0, ripple) * broken;
  vec3 col = sea;

  // Each tower's reflection, mirrored at the pier and torn by the swell.
  float ry = 2.0 * SF_PIER - p.y;
  vec2 rp = vec2(p.x + 0.006 * sin(p.y * 160.0 + t * 1.5), ry);
  if (p.y < SF_PIER && p.y > SF_PIER - 0.16) {
    vec4 r = sfTower(rp, -span, t, pixel, colW);
    vec4 r2 = sfTower(rp, span, t, pixel, colW);
    float ref = max(r.a, r2.a) * step(0.35, ripple) * (1.0 - (SF_PIER - p.y) / 0.16);
    col = mix(col, sfOrange * 0.85, ref);
    tone = max(tone, ref * 0.5);
  }

  // Glitter under the sun, wider toward the viewer.
  float pathW = 0.03 + dd * 0.5;
  float inPath = 1.0 - smoothstep(pathW * 0.5, pathW, abs(p.x - sun.x));
  vec2 cell = floor(vec2(p.x / max(colW, 0.004), phase * 4.0));
  float spark = step(0.62, hash21(cell + floor(t * 2.0) * 0.37)) * inPath;
  col = mix(col, vec3(1.0, 0.9, 0.7), spark);
  tone = max(tone, spark * 0.6);
  return vec4(col, tone);
}

// Gulls wheeling across the sky, flapping now and then and gliding between.
vec4 sfGulls(vec2 p, float t, float pixel, float colW, float halfW) {
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float speed = 0.012 + 0.01 * hash21(vec2(fi, 3.0));
    float dir = fi < 2.5 ? 1.0 : -1.0;
    float travel = 2.0 * halfW + 0.3;
    float gx = (fract(t * speed + hash21(vec2(fi, 8.0))) - 0.5) * travel * dir;
    float gy = 0.5 + 0.32 * hash21(vec2(fi, 13.0)) + 0.025 * sin(t * 0.4 + fi * 2.1);
    vec2 d = p - vec2(gx, gy);
    float size = 0.016;
    if (abs(d.x) > size || abs(d.y) > 0.02) {
      continue;
    }
    float flap = sin(t * 5.0 + fi * 1.7) * step(0.0, sin(t * 0.7 + fi));
    // Wings bend at the wrist: up from the body, then out and down.
    float u = abs(d.x) / size;
    float wing = 0.008 * (1.0 + flap) * (u < 0.5 ? u * 2.0 : 2.0 - u * 2.0) + 0.004 * flap * u;
    if (abs(d.y - wing) < max(0.003, pixel * 0.5)) {
      return vec4(0.98, 0.98, 1.0, 0.55);
    }
  }
  return vec4(0.0);
}

vec2 sfCacheUv = vec2(-1.0);
float sfCacheT = -1.0;
vec4 sfCacheValue = vec4(0.0);

vec4 sfOver(vec4 under, vec4 over) {
  return over.a > 0.0 ? over : under;
}

vec4 sfScene(vec2 uv, vec2 res, float t) {
  if (uv == sfCacheUv && t == sfCacheT) {
    return sfCacheValue;
  }
  float aspect = res.x / res.y;
  float halfW = aspect * 0.5;
  vec2 base = vec2((uv.x - 0.5) * aspect, uv.y);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * sfParallax;
  float pixel = 1.0 / res.y;
  // Width of one sample column, so thin verticals land on whole glyphs.
  float colW = aspect / max(ascii_samples.x, 1.0);
  float span = sfSpan(aspect);
  // Nearer layers slide further with the pointer.
  vec2 farP = base + ptr * vec2(0.01, 0.003);
  vec2 cityP = base + ptr * vec2(0.018, 0.004);
  vec2 hillP = base + ptr * vec2(0.03, 0.006);
  vec2 bridgeP = base + ptr * vec2(0.045, 0.008);
  vec2 nearP = base + ptr * vec2(0.07, 0.012);
  // The sun is up over the city, high enough to clear the towers.
  vec2 sun = vec2(span * 0.62, 0.84);
  // Downtown sits behind the main span, right of centre, under the cable.
  float px = span * 0.55;

  vec4 c = vec4(0.0);
  if (nearP.y < SF_WATER) {
    c = sfWater(nearP, t, pixel, colW, span, sun);
  } else {
    c = sfSky(farP, t, pixel, sun);
    c = sfOver(c, sfCity(cityP, t, pixel, colW, px));
  }
  float far = sfFogFar(cityP, t);
  if (far > 0.0) {
    vec4 f = sfFogColor(far, cityP, far);
    c = mix(c, f, far);
  }
  c = sfOver(c, sfHeadlands(hillP, span));
  c = sfOver(c, sfSpanSteel(bridgeP, t, pixel, colW, span));
  c = sfOver(c, sfTower(bridgeP, -span, t, pixel, colW));
  c = sfOver(c, sfTower(bridgeP, span, t, pixel, colW));
  if (nearP.y < SF_WATER) {
    c = sfOver(c, sfBoats(nearP, t, pixel, colW, halfW));
  }
  float bank = sfFogBank(bridgeP, t, span);
  if (bank > 0.0) {
    vec4 f = sfFogColor(bank, bridgeP, fbm(bridgeP * vec2(3.0, 8.0) - vec2(t * 0.05, 0.0)));
    c = mix(c, f, smoothstep(0.0, 0.85, bank));
  }
  c = sfOver(c, sfGulls(farP, t, pixel, colW, halfW));

  vec3 col = c.rgb;
  if (sfOnLight > 0.5) {
    // Pale fog and cream houses vanish on a light paper; darken the light
    // colours most so the orange keeps its hue.
    float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col *= mix(1.0, 0.5, l);
  }
  float tone = c.a * sfIntensity;
  // Below the faintest glyph the tone is exactly empty, so the open sky
  // draws clean paper instead of a scatter of dots.
  tone = tone < 0.05 ? 0.0 : tone;
  sfCacheUv = uv;
  sfCacheT = t;
  sfCacheValue = vec4(col, tone);
  return sfCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return sfScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return sfScene(uv, res, t).rgb;
}
`;

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #9fb6cf 0%, #d5dde6 45%, #e9e2d8 62%, #c9d2da 66%, #6f8b98 72%, #4a6674 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** True when the paper is light, so the shader darkens its pale colours. */
const usePaperIsLight = (
  paper: AsciiColor,
  phosphor: PhosphorName | undefined
) => {
  const colors = useAsciiColors(undefined, [paper]);
  const rgba = colors?.[0];
  if (phosphor !== undefined || rgba === undefined) {
    return false;
  }
  return 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2] > 0.55;
};

export interface SanFranciscoProps extends AsciiSceneProps {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** How thick the fog bank is, from 0 (a clear strait) to 1 (the deck buried). Default 0.6. */
  fog?: number;
  /** How many sailboats are out on the bay, from 0 (none) to 1. Default 0.6. */
  sails?: number;
  /** How many cars cross the bridge, from 0 (none) to 1. Default 0.5. */
  traffic?: number;
  /** The surface behind the glyphs. Default `"--ascii-paper"`, or the phosphor's glass. */
  paper?: AsciiColor;
  /** What the pointer does to the glyphs, on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /** Shown without WebGL and until the first frame. Default: a morning fog gradient. */
  fallback?: ReactNode;
}

/**
 * San Francisco. The Golden Gate Bridge on a foggy morning: orange towers
 * with stepped portals, the main cables and suspenders, a fog bank rolling
 * through the strait and under the deck, the Marin headlands, the city and
 * the Transamerica Pyramid behind, sailboats on the bay and gulls overhead.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const SanFrancisco = ({
  intensity = 1,
  fog = 0.6,
  sails = 0.6,
  traffic = 0.5,
  paper = "--ascii-paper",
  charset = "standard",
  colorMode,
  phosphor,
  cell = 12,
  fps = 30,
  stillTime = 9,
  interactive = true,
  interaction = "none",
  fallback = FALLBACK,
  ...props
}: SanFranciscoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const onLight = usePaperIsLight(paper, phosphor);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        sfFog: clamp(fog, 0, 1),
        sfIntensity: clamp(intensity, 0, 1),
        sfOnLight: onLight ? 1 : 0,
        sfParallax: interactive ? 1 : 0,
        sfSails: clamp(sails, 0, 1),
        sfTraffic: clamp(traffic, 0, 1),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={phosphor === undefined ? paper : undefined}
      cell={cell}
      fps={fps}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
