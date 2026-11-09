"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  CharsetName,
  ColorMode,
} from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Tokyo on a cool night, painted back to front: a teal and blue-grey sky
// with a small moon and faint cirrus, Mount Fuji on the far horizon, three
// layers of towers that get darker and clearer as they come closer, Tokyo
// Tower, then the elevated line and the street. The field returns a tone
// that sets dot size; the colour field returns that point's own colour.
// World units: y runs 0 (street) to 1 (top of the sky) and x is centred and
// measured in the same units, so shapes keep their proportions at any
// aspect. Fuji and the tower stay at about a fifth and four fifths of the
// width in any box, so a centred headline covers neither. Windows snap to whole glyph cells, so each one is
// a single dot in any charset.
const SCENE = `
const float TOKYO_HORIZON = 0.3;
const float TOKYO_TOWER_BASE = 0.07;
const float TOKYO_TOWER_HEIGHT = 0.82;
const float TOKYO_RAIL = 0.078;

vec2 tokyoCacheUv = vec2(-1.0);
float tokyoCacheT = -1.0;
vec4 tokyoCacheValue = vec4(0.0);

float tokyoAspect;
vec2 tokyoCells;
vec2 tokyoCellSize;
vec2 tokyoCellIndex;
vec2 tokyoCellCentre;

// The sky from the horizon (s = 0) to the top (s = 1): a cool urban night,
// pale cyan-grey where the city's light catches the haze, then teal and
// blue-grey, deepening to near black overhead.
vec3 tokyoSkyRamp(float s) {
  vec3 c = mix(vec3(0.46, 0.68, 0.72), vec3(0.2, 0.42, 0.48), smoothstep(0.0, 0.16, s));
  c = mix(c, vec3(0.09, 0.28, 0.34), smoothstep(0.12, 0.38, s));
  c = mix(c, vec3(0.05, 0.17, 0.23), smoothstep(0.34, 0.68, s));
  return mix(c, vec3(0.035, 0.08, 0.11), smoothstep(0.64, 1.0, s));
}

// The haze colour at height y: faint cyan-white glow low over the city,
// cooler and darker above it.
vec3 tokyoHaze(float y) {
  return mix(vec3(0.46, 0.6, 0.64), vec3(0.18, 0.28, 0.34), smoothstep(TOKYO_HORIZON - 0.06, TOKYO_HORIZON + 0.12, y));
}

// One layer of towers. Two staggered rows of plots, the taller one wins.
// Returns the roof height at x; id names the building, and edge holds its
// left and right sides in world units.
float tokyoSkyline(float x, float plot, float seed, float base, float amp, float lift, out float id, out vec2 edge) {
  float best = 0.0;
  id = -1.0;
  edge = vec2(0.0);
  for (int row = 0; row < 2; row++) {
    float shift = float(row) * 0.5;
    float w = plot * (row == 0 ? 1.0 : 0.73);
    float k = floor(x / w + shift);
    float key = k + seed * 37.0 + float(row) * 101.0;
    float width = mix(0.55, 0.95, hash21(vec2(key, 1.3)));
    float left = (k - shift + (1.0 - width) * hash21(vec2(key, 2.7))) * w;
    float right = left + width * w;
    if (x < left || x > right) {
      continue;
    }
    float h = base + amp * (0.18 + 0.82 * pow(hash21(vec2(key, 4.1)), 1.6)) + lift;
    // Some towers step back near the roof.
    float step1 = hash21(vec2(key, 5.9));
    float f = (x - left) / (right - left);
    if (step1 > 0.55 && (f < 0.22 || f > 0.78)) {
      h -= (h - base) * 0.12;
    }
    // A few carry a thin mast.
    if (step1 > 0.86 && abs(f - 0.5) < 0.5 * tokyoCellSize.x / (right - left)) {
      h += 0.025;
    }
    if (h > best) {
      best = h;
      id = key;
      edge = vec2(left, right);
    }
  }
  return best;
}

// Windows on a building face: a soft, uneven field of single-cell lights,
// banded by floor, white and cyan with a few pale warm rooms. A few switch
// on or off slowly.
// Returns the light's colour in rgb and its strength in a.
vec4 tokyoWindow(float id, vec2 edge, float roof, float density, float t) {
  vec2 c = tokyoCellCentre;
  // Keep one cell clear at each side and under the roof.
  if (c.x - edge.x < tokyoCellSize.x * 0.9 || edge.y - c.x < tokyoCellSize.x * 0.9 || roof - c.y < tokyoCellSize.y * 1.2) {
    return vec4(0.0);
  }
  float style = hash21(vec2(id, 8.1));
  vec2 cell = tokyoCellIndex;
  // Striped facades light every other column; ribbon facades every other row.
  if (style < 0.3 && mod(cell.x, 2.0) > 0.5) {
    return vec4(0.0);
  }
  if (style > 0.78 && mod(cell.y, 2.0) > 0.5) {
    return vec4(0.0);
  }
  // Whole floors tend to be lit or dark together, and some towers are
  // busier than others.
  float floorLit = hash21(vec2(id, cell.y * 1.7));
  float busy = mix(0.4, 1.6, hash21(vec2(id, 6.2)));
  float chance = density * busy * (floorLit > 0.4 ? 1.5 : 0.45);
  float pick = hash21(cell + id * 0.37);
  float lit = step(pick, chance);
  // A few cells drift between on and off over tens of seconds.
  float drifting = step(hash21(cell * 1.31 + 4.2), 0.07);
  if (drifting > 0.5) {
    float period = 14.0 + 16.0 * hash21(cell + 9.4);
    float phase = t / period + hash21(cell + 2.2) * 9.0;
    float a = step(hash21(cell + floor(phase)), chance * 1.3);
    float b = step(hash21(cell + floor(phase) + 1.0), chance * 1.3);
    lit = mix(a, b, smoothstep(0.75, 1.0, fract(phase)));
  }
  if (lit <= 0.0) {
    return vec4(0.0);
  }
  float tint = hash21(vec2(id, 3.3)) * 0.6 + hash21(cell + 6.6) * 0.4;
  // Office white, cyan fluorescents and a few pale warm rooms; the tower
  // keeps the only real orange.
  vec3 warm = vec3(0.98, 0.9, 0.76);
  vec3 white = vec3(0.84, 0.92, 0.96);
  vec3 cool = vec3(0.56, 0.84, 0.92);
  vec3 col = tint < 0.2 ? warm : tint < 0.62 ? white : cool;
  // Most lights are soft; about one in six burns bright.
  float bright = hash21(cell + 1.9);
  float strength = lit * (bright > 0.84 ? 1.0 : mix(0.4, 0.7, bright));
  return vec4(col, strength);
}

// Half-width of Tokyo Tower at height m, in metres (333 m tall, about
// 80 m across the base). The legs flare like the Eiffel Tower's; above the
// Top Deck the antenna steps in twice.
float tokyoTowerHalf(float m) {
  if (m < 252.0) {
    float k = max(1.0 - m / 262.0, 0.0);
    return 3.4 + 37.0 * k * k;
  }
  if (m < 290.0) {
    return mix(2.8, 1.8, (m - 252.0) / 38.0);
  }
  return mix(1.2, 0.6, (m - 290.0) / 43.0);
}

// 1 where the tower is painted white, 0 for international orange.
float tokyoTowerWhite(float m) {
  if (m < 140.0) {
    return step(92.0, m) * step(m, 112.0);
  }
  if (m < 245.0) {
    return step(180.0, m) * step(m, 198.0) + step(220.0, m) * step(m, 236.0);
  }
  if (m < 290.0) {
    return step(m, 272.0);
  }
  return step(m, 306.0) + step(320.0, m);
}

// Tokyo Tower at u, m metres from the foot of its axis. Returns colour and
// tone; cover is 1 inside it.
vec4 tokyoTower(float u, float m, float mx, float t, out float cover) {
  cover = 0.0;
  float au = abs(u);
  if (m < 0.0 || m > 336.0) {
    return vec4(0.0);
  }
  bool mainDeck = m >= 142.0 && m < 158.0;
  bool topDeck = m >= 244.0 && m < 254.0;
  float hw = mainDeck ? 17.0 : topDeck ? 8.0 : tokyoTowerHalf(m);
  hw = max(hw, m > 290.0 ? mx * 0.55 : mx * 1.05);
  if (au > hw) {
    return vec4(0.0);
  }
  // The arch between the four legs at the base.
  if (m < 52.0) {
    float leg = 0.32 * hw;
    float arch = 52.0 * sqrt(max(1.0 - pow(au / max(hw - leg, 1.0), 2.0), 0.0));
    if (au < hw - leg && m < arch - 6.0) {
      return vec4(0.0);
    }
  }
  cover = 1.0;
  float glow = 0.93 + 0.07 * sin(t * 0.55);
  vec3 orange = vec3(1.0, 0.5, 0.18);
  vec3 white = vec3(1.0, 0.94, 0.84);
  vec3 col = mix(orange, white, tokyoTowerWhite(m));
  // Below the Main Deck the lattice is open: X bracing, panel bands and the
  // legs stay lit and the gaps between them fall darker, so the structure
  // reads. The right side is a little shaded, away from the moon.
  float frame = 1.0;
  if (m < 142.0) {
    float panel = 24.0;
    float v = fract(m / panel);
    float across = au / max(hw, 1.0);
    float diag = abs(across - abs(v * 2.0 - 1.0));
    float brace = smoothstep(0.22, 0.06, diag);
    float band = smoothstep(0.12, 0.0, min(v, 1.0 - v));
    float leg = smoothstep(0.6, 0.78, across);
    frame = max(max(brace, band), leg);
  }
  float shade = mix(1.0, 0.8, smoothstep(-0.2, 1.0, u / max(hw, 1.0)));
  float gap = (1.0 - frame) * (1.0 - 0.6 * tokyoTowerWhite(m));
  float tone = mix(0.97, 0.72, gap) * mix(1.0, shade, 0.3) * glow;
  col *= mix(1.0, 0.76, gap) * shade * glow;
  if (mainDeck || topDeck) {
    // Lit observation windows in the middle rows of each deck.
    float lo = mainDeck ? 146.0 : 247.0;
    float hi = mainDeck ? 154.0 : 251.0;
    float win = step(lo, m) * step(m, hi) * step(au, hw - mx * 0.9);
    col = mix(vec3(0.95, 0.9, 0.82) * 0.85, vec3(1.0, 0.94, 0.78), win);
    tone = mix(0.85, 1.0, win) * glow;
  }
  // The red light at the tip pulses slowly.
  if (m > 326.0) {
    float b = 0.5 + 0.5 * sin(t * 1.6);
    col = mix(vec3(0.7, 0.12, 0.1), vec3(1.0, 0.2, 0.14), b);
    tone = mix(0.7, 1.0, b * b);
  }
  return vec4(col, tone);
}

vec4 tokyoScene(vec2 uv, vec2 res, float t) {
  if (uv == tokyoCacheUv && t == tokyoCacheT) {
    return tokyoCacheValue;
  }
  tokyoAspect = res.x / res.y;
  tokyoCells = floor(ascii_samples / tokyoGrid + 0.5);
  tokyoCellSize = vec2(tokyoAspect, 1.0) / tokyoCells;
  tokyoCellIndex = floor(uv * tokyoCells);
  tokyoCellCentre = vec2(((tokyoCellIndex.x + 0.5) / tokyoCells.x - 0.5) * tokyoAspect, (tokyoCellIndex.y + 0.5) / tokyoCells.y);
  vec2 p = vec2((uv.x - 0.5) * tokyoAspect, uv.y);
  float x = p.x;
  float y = p.y;
  // Fuji and the tower sit at about a fifth and four fifths of the width
  // in any box, so a centred headline covers neither.
  float wide = clamp(tokyoAspect / 1.78, 0.28, 1.0);
  float fujiX = max(-0.3 * tokyoAspect, -0.62);
  float towerX = min(0.3 * tokyoAspect, 0.5);
  float drift = t * 0.008;

  // Sky: a smooth gradient in small, dim dots, so it reads as quiet air.
  // A small moon high over Fuji, faint moonlit cirrus, and a few stars.
  float s = clamp((y - TOKYO_HORIZON) / (1.0 - TOKYO_HORIZON), 0.0, 1.0);
  vec3 col = tokyoSkyRamp(s);
  vec2 moonAt = vec2(fujiX - 0.04 * wide, 0.84);
  float moonD = length(p - moonAt);
  float moonGlow = exp(-moonD * moonD * 60.0);
  col = mix(col, vec3(0.4, 0.52, 0.58), moonGlow * 0.5);
  float lum = dot(col, vec3(0.3, 0.5, 0.2));
  float tone = 0.13 + 0.6 * lum * lum + 0.16 * lum + moonGlow * 0.08;
  float band = smoothstep(0.4, 0.48, y) * (1.0 - smoothstep(0.62, 0.74, y));
  // Long, thin streaks: stretched noise, so they read as layers of cirrus.
  float cloud = snoise(vec2(x * 0.8 + drift, y * 7.0 + 3.0)) * 0.65 + snoise(vec2(x * 2.2 - drift, y * 14.0)) * 0.35;
  cloud = smoothstep(0.15, 0.65, cloud) * band;
  vec3 cloudCol = mix(vec3(0.34, 0.46, 0.52), vec3(0.22, 0.32, 0.4), smoothstep(0.1, 0.45, s));
  col = mix(col, cloudCol, cloud * 0.4);
  tone += cloud * 0.05;
  float starZone = smoothstep(0.62, 0.85, s);
  float star = step(hash21(tokyoCellIndex + 0.71), 0.012 * starZone);
  if (star > 0.5) {
    float tw = 0.55 + 0.45 * sin(t * 0.8 + hash21(tokyoCellIndex) * 40.0);
    col = mix(col, vec3(0.8, 0.9, 0.96), 0.7 * tw);
    tone = mix(tone, 0.5, tw);
  }
  // The moon: a small disc, the coolest bright point in the scene.
  float moon = 1.0 - smoothstep(0.024, 0.03, moonD);
  if (moon > 0.0) {
    col = mix(col, vec3(0.86, 0.94, 0.98), moon);
    tone = mix(tone, 0.95, moon);
  }

  // A soft orange halo around the tower, breathing slowly: the one warm
  // light in a cool night, and with the snow and the moon the only place
  // the dots grow large.
  float towerTop = TOKYO_TOWER_BASE + TOKYO_TOWER_HEIGHT;
  float hy = clamp(y, TOKYO_TOWER_BASE + 0.2, towerTop - 0.16);
  vec2 hd = vec2(x - towerX, (y - hy) * 0.6);
  float halo = exp(-dot(hd, hd) * 90.0) * (0.85 + 0.15 * sin(t * 0.55));
  col = mix(col, vec3(1.0, 0.5, 0.26), halo * 0.45);
  tone += halo * 0.3;

  // Mount Fuji, far and moonlit: a concave cone with a flat summit and a
  // snow cap streaked down its gullies, in cool grey-blue. Its body sits
  // close to the sky in value; only the snow on the side facing the moon is
  // bright.
  if (tokyoFujiOn > 0.5) {
    float dx = abs(x - fujiX) / 0.78;
    float peak = 0.6;
    float prof = TOKYO_HORIZON - 0.02 + (peak - TOKYO_HORIZON + 0.02) * pow(max(1.0 - dx, 0.0), 2.3);
    prof += 0.004 * snoise(vec2(x * 40.0, 7.0));
    prof = min(prof, peak - 0.014);
    if (y < prof) {
      float lit = 1.0 - smoothstep(-0.05, 0.06, x - fujiX);
      vec3 body = mix(vec3(0.3, 0.4, 0.5), vec3(0.42, 0.52, 0.62), lit);
      body *= mix(0.85, 1.05, smoothstep(TOKYO_HORIZON, peak, y));
      float gully = 1.0 - abs(snoise(vec2((x - fujiX) * 13.0, 3.0)));
      float snowLine = peak - 0.1 - 0.035 * gully * gully - 0.008 * snoise(vec2(x * 30.0, 1.0));
      float snow = smoothstep(snowLine - 0.005, snowLine + 0.005, y);
      vec3 snowCol = mix(vec3(0.5, 0.6, 0.72), vec3(0.9, 0.96, 1.0), lit);
      col = mix(body, snowCol, snow);
      tone = mix(0.32, mix(0.52, 0.95, lit), snow);
      float foot = 1.0 - smoothstep(TOKYO_HORIZON - 0.02, TOKYO_HORIZON + 0.12, y);
      col = mix(col, tokyoHaze(y), foot * 0.6);
      tone = mix(tone, 0.24, foot * 0.6);
    }
  }

  float id;
  vec2 edge;

  // The far city: low contrast, close to the haze, its lights barely there.
  float farRoof = tokyoSkyline(x, 0.03, 1.0, TOKYO_HORIZON - 0.04, 0.08, 0.0, id, edge);
  farRoof += 0.003 * snoise(vec2(x * 60.0, 2.0));
  if (y < farRoof) {
    col = mix(vec3(0.17, 0.25, 0.31), tokyoHaze(y), 0.55);
    tone = 0.24;
    vec4 w = tokyoWindow(id, edge, farRoof, 0.08, t);
    col = mix(col, w.rgb, w.a * 0.3);
    tone += w.a * 0.06;
  }

  // A band of haze along the horizon swallows the feet of the far city.
  float horizonHaze = exp(-pow((y - TOKYO_HORIZON + 0.03) / 0.05, 2.0));
  horizonHaze *= mix(0.7, 1.0, fbm(vec2(x * 1.2 - drift * 1.5, y * 6.0)));
  col = mix(col, tokyoHaze(y), horizonHaze * 0.7);
  tone = mix(tone, 0.3, horizonHaze * 0.55);

  // The middle city, nearer and darker; its windows are a dim field that
  // melts into the haze at its feet.
  float midBase = 0.16;
  float midLift = 0.04 * smoothstep(0.3, 0.9, abs(x - towerX * 0.3) / (0.5 * tokyoAspect + 0.01));
  float midRoof = tokyoSkyline(x, 0.046, 2.0, midBase + 0.04, 0.12, midLift, id, edge);
  if (y < midRoof) {
    float rim = 1.0 - smoothstep(0.0, tokyoCellSize.x * 1.2, x - edge.x);
    col = mix(vec3(0.08, 0.13, 0.18), vec3(0.2, 0.28, 0.34), rim * 0.6);
    tone = 0.22 + rim * 0.05;
    vec4 w = tokyoWindow(id, edge, midRoof, 0.42, t);
    if (w.a > 0.0) {
      col = mix(w.rgb, vec3(0.5, 0.64, 0.68), 0.35) * mix(0.5, 0.85, w.a);
      tone = 0.2 + 0.42 * w.a;
    }
  }
  // City glow: a faint cyan-white haze over the middle and near towers, so the
  // windows sit in soft light instead of reading as speckle.
  float mist = fbm(vec2(x * 1.4 + drift, y * 7.0 + 5.0));
  float glowBand = exp(-pow((y - 0.17) / 0.07, 2.0)) * mix(0.5, 1.0, smoothstep(0.3, 0.75, mist));
  col = mix(col, vec3(0.36, 0.56, 0.6), glowBand * 0.5);
  tone = mix(tone, 0.34, glowBand * 0.35);

  // Tokyo Tower.
  float metres = TOKYO_TOWER_HEIGHT / 333.0;
  float cover;
  vec4 tower = tokyoTower((x - towerX) / metres, (y - TOKYO_TOWER_BASE) / metres, tokyoCellSize.x / metres, t, cover);
  if (cover > 0.5) {
    col = tower.rgb;
    tone = tower.a;
  }

  // The near city: dark towers, tall at the sides and low in the middle,
  // each with a faint lit west edge. Windows are medium dots, a few bright.
  float side = smoothstep(0.25, 0.95, abs(x) / (0.5 * tokyoAspect + 0.01));
  float nearRoof = tokyoSkyline(x, 0.075, 3.0, TOKYO_RAIL + 0.04, 0.09, 0.12 * side, id, edge);
  // Low roofs around the tower's foot, so its arch shows whole.
  nearRoof = mix(min(nearRoof, TOKYO_RAIL + 0.045), nearRoof, smoothstep(0.08, 0.14, abs(x - towerX)));
  if (y < nearRoof) {
    float rim = 1.0 - smoothstep(0.0, tokyoCellSize.x * 1.2, x - edge.x);
    float roofLine = 1.0 - smoothstep(0.0, tokyoCellSize.y * 1.1, nearRoof - y);
    col = mix(vec3(0.04, 0.07, 0.1), vec3(0.18, 0.26, 0.32), max(rim * 0.7, roofLine * 0.5));
    tone = 0.17 + max(rim, roofLine * 0.6) * 0.12;
    vec4 w = tokyoWindow(id, edge, nearRoof, 0.4, t);
    if (w.a > 0.0) {
      col = w.rgb * mix(0.5, 1.0, w.a);
      tone = 0.18 + 0.74 * w.a;
    }
  }

  // The elevated line: a dim deck with a row of small lamps, piers, and
  // now and then a train gliding across.
  float deckTop = TOKYO_RAIL + 0.014;
  if (y < deckTop && y > TOKYO_RAIL) {
    col = vec3(0.13, 0.19, 0.23);
    tone = 0.26;
    float lamp = step(mod(tokyoCellIndex.x, 11.0), 0.5) * step(deckTop - tokyoCellSize.y, y);
    col = mix(col, vec3(0.86, 0.95, 1.0), lamp * 0.85);
    tone = mix(tone, 0.55, lamp);
  }
  float pier = step(abs(fract(x / 0.12) - 0.5) * 0.12, 0.007);
  if (y <= TOKYO_RAIL && pier > 0.5) {
    col = vec3(0.07, 0.11, 0.15);
    tone = 0.2;
  }
  if (tokyoTrainOn > 0.5) {
    float cycle = 40.0;
    float trip = 18.0;
    float lap = mod(t + 6.0, cycle);
    float len = 0.42;
    float span = tokyoAspect + len + 0.2;
    float head = -0.5 * tokyoAspect - 0.1 + span * lap / trip;
    float tail = head - len;
    if (lap < trip && x < head && x > tail && y >= deckTop && y < deckTop + 0.028) {
      float car = fract((x - tail) / (len / 5.0));
      float gap = step(car, 0.04);
      float upper = step(deckTop + 0.012, y);
      vec3 body = vec3(0.32, 0.4, 0.46);
      vec3 stripe = vec3(0.3, 0.52, 0.36);
      vec3 win = vec3(0.9, 0.96, 1.0);
      bool pane = mod(tokyoCellIndex.x, 3.0) < 1.5;
      col = upper > 0.5 ? (pane ? win : body) : stripe;
      tone = upper > 0.5 ? (pane ? 0.66 : 0.32) : 0.36;
      col *= 1.0 - gap * 0.7;
      tone *= 1.0 - gap * 0.6;
    }
  }

  // The street: near-black, a faint cool glow from below and a few lamps.
  if (y < TOKYO_RAIL && pier < 0.5) {
    float glowUp = 1.0 - smoothstep(0.0, TOKYO_RAIL, y);
    col = mix(vec3(0.03, 0.055, 0.075), vec3(0.16, 0.26, 0.3), glowUp * glowUp * 0.6);
    tone = 0.12 + glowUp * 0.1;
    float light = step(hash21(tokyoCellIndex + 3.7), 0.015);
    col = mix(col, vec3(0.86, 0.94, 1.0), light * 0.7);
    tone += light * 0.32;
  }

  // Intensity dims everything and quiets the central band most, where a
  // headline sits: the middle half of the width, 30% to 65% from the top.
  float quiet = 1.0 - tokyoIntensity;
  float centreY = 1.0 - smoothstep(0.15, 0.26, abs(y - 0.525));
  float centreX = 1.0 - smoothstep(0.44, 0.66, abs(x) / (0.5 * tokyoAspect + 0.01));
  float dim = 1.0 - quiet * (0.35 + 0.55 * centreY * centreX);
  tone = clamp(tone, 0.0, 1.0) * mix(0.55, 1.0, dim);
  col *= dim;

  tokyoCacheUv = uv;
  tokyoCacheT = t;
  tokyoCacheValue = vec4(col, tone);
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
const NIGHT = "#050b0e";
const NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

// Dots, Braille and quadrants blend neighbouring sizes with ordered
// dithering, so the sky's gradient reads as a smooth halftone.
const DITHER_CHARSETS: ReadonlySet<CharsetName> = new Set<CharsetName>([
  "braille",
  "dots",
  "quadrants",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to top, #050b0e 0%, #0e1a20 14%, #5d7a80 30%, #22383f 42%, #12202a 65%, #090f15 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface TokyoProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Lower values quiet the middle band most. Default 1. */
  intensity?: number;
  /** Mount Fuji on the horizon. Default `true`. */
  fuji?: boolean;
  /** The train that glides along the elevated line now and then. Default `true`. */
  train?: boolean;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for one-glyph charsets such as `dots`; `false`
   * for Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** Ignored: the city doesn't respond to the pointer. Accepted so any stage can pass it. */
  interactive?: boolean;
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
 * Tokyo on a cool night, as a halftone of coloured dots. Tokyo Tower glows
 * orange and white with both observation decks lit, the one warm light
 * against a teal sky; a deep city of towers recedes into faint cyan haze,
 * and Mount Fuji stands moonlit and snow-capped on the horizon. Motion is
 * calm: a few windows change, the tower's glow breathes, haze drifts and
 * a train glides along the elevated line now and then. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Tokyo = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  dither,
  square,
  cell = 7,
  stillTime = 3,
  interactive: _interactive,
  intensity = 1,
  fuji = true,
  train = true,
  fallback = FALLBACK,
  ...props
}: TokyoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gridX, gridY] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        tokyoFujiOn: fuji ? 1 : 0,
        // Samples per glyph, so windows and stars snap to whole cells.
        tokyoGrid: [gridX, gridY],
        tokyoIntensity: clamp(intensity, 0, 1),
        tokyoTrainOn: train ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={
        dither ??
        (DITHER_CHARSETS.has(charset) && !chars ? "blue-noise" : "none")
      }
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      square={square ?? gridX * gridY === 1}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
