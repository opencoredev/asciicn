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

// Minato at night, painted back to front: stars, Mount Fuji, a far
// skyline, Tokyo Tower, a near skyline, then the elevated line and its
// train. Nothing here moves but lights and the train. Every edge and every
// window is placed on whole samples (`ascii_samples` is the sample count),
// so silhouettes are crisp and window grids stay regular in any charset.
// World units: y runs 0 (street) to 1 (top of the sky) and x is centred and
// measured in the same units, so shapes keep their proportions at any
// aspect. The tower is modelled in metres from the real one: 333 m tall,
// about 80 m across at the base, the Main Deck at 150 m and the Top Deck
// at 250 m.
const SCENE = `
const float TOKYO_BASE = 0.11;
const float TOKYO_HEIGHT = 0.8;
const float TOKYO_RAIL = 0.052;

float tokyoAspect;
vec2 tokyoCount;
vec2 tokyoCell;
vec2 tokyoSample;
vec2 tokyoP;
float tokyoCw;
float tokyoCh;

float tokyoCol(float x) {
  return floor((x / tokyoAspect + 0.5) * tokyoCount.x);
}

float tokyoRow(float y) {
  return floor(y * tokyoCount.y);
}

// Bayer-friendly fill tones: in Braille and quadrants a quarter tone is an
// even grid of dots; ramp charsets get a light glyph instead.
float tokyoFill(float dots, float ramp) {
  return tokyoGrid.y > 1.5 ? dots : ramp;
}

// A slow aviation beacon: a soft swell about every 1.8 s.
float tokyoBeacon(float t, float phase) {
  float b = 0.5 + 0.5 * sin(t * 3.49 + phase);
  return b * b * b;
}

// Half-width of the tower at height m, in metres. The legs flare like the
// Eiffel Tower's; above the Top Deck the antenna steps in twice.
float tokyoTowerHalf(float m) {
  if (m < 254.0) {
    float k = max(1.0 - m / 262.0, 0.0);
    return 3.2 + 36.8 * k * k;
  }
  if (m < 290.0) {
    return mix(2.6, 1.6, (m - 254.0) / 36.0);
  }
  return mix(0.9, 0.45, (m - 290.0) / 43.0);
}

// 1 where the tower is painted white, 0 for international orange.
float tokyoTowerWhite(float m) {
  if (m < 140.0) {
    return step(90.0, m) * step(m, 114.0);
  }
  if (m < 245.0) {
    return step(177.0, m) * step(m, 197.0) + step(217.0, m) * step(m, 235.0);
  }
  if (m < 290.0) {
    return step(m, 272.0);
  }
  return step(m, 305.0) + step(320.0, m);
}

// Panel bounds of the lower lattice, where the X bracing changes.
vec2 tokyoPanel(float m) {
  if (m < 22.0) {
    return vec2(0.0, 22.0);
  }
  if (m < 44.0) {
    return vec2(22.0, 44.0);
  }
  if (m < 66.0) {
    return vec2(44.0, 66.0);
  }
  if (m < 90.0) {
    return vec2(66.0, 90.0);
  }
  if (m < 114.0) {
    return vec2(90.0, 114.0);
  }
  return vec2(114.0, 140.0);
}

// Tokyo Tower. u and m are metres from the foot of its axis; mx and my are
// one sample in metres. halo marks samples just outside it, which take its
// colour at zero tone so thin parts don't fade in Braille cells.
vec4 tokyoTower(float u, float m, float mx, float my, float t, out float cover, out float halo) {
  cover = 0.0;
  halo = 0.0;
  float au = abs(u);
  vec3 orange = vec3(1.0, 0.36, 0.1);
  vec3 white = vec3(1.0, 0.89, 0.74);
  vec3 paint = mix(orange, white, tokyoTowerWhite(m));
  vec3 red = vec3(1.0, 0.1, 0.06);
  bool mainDeck = m >= 140.0 && m < 157.0;
  bool topDeck = m >= 245.0 && m < 255.0;
  float hw = mainDeck ? 16.5 : topDeck ? 7.5 : tokyoTowerHalf(m);
  hw = max(hw, mx * 0.5);
  float tip = 333.0;
  if (m < 0.0 || m > tip + my) {
    return vec4(paint, 0.0);
  }
  // Beacons sit one row above each deck roof and on top of the mast.
  float beacon = 0.0;
  if (m > tip) {
    beacon = au < mx * 0.5 ? 1.0 : 0.0;
  } else if (m >= 157.0 && m < 157.0 + my) {
    beacon = au <= 16.5 && au > 16.5 - mx ? 1.0 : 0.0;
  } else if (m >= 255.0 && m < 255.0 + my) {
    beacon = au <= 7.5 && au > 7.5 - mx ? 1.0 : 0.0;
  }
  if (beacon > 0.5) {
    cover = 1.0;
    float b = tokyoBeacon(t, floor(m / 50.0) * 1.3);
    return vec4(red * mix(0.35, 1.0, b), tokyoFill(1.0, mix(0.35, 1.0, b)));
  }
  if (au > hw) {
    halo = au < hw + mx * 2.5 && m < tip ? 1.0 : 0.0;
    return vec4(paint, 0.0);
  }
  cover = 1.0;
  if (mainDeck || topDeck) {
    // Two floors of lit glass on the Main Deck, one on the Top Deck,
    // between white slabs; ramp charsets get glass only.
    float base = mainDeck ? 140.0 : 245.0;
    float rows = floor((mainDeck ? 17.0 : 10.0) / my + 0.5);
    float i = floor((m - base) / my);
    bool slab = rows >= 5.0 && (i < 0.5 || i > rows - 1.5 || (mainDeck && abs(i - floor(rows * 0.5)) < 0.5));
    vec3 glass = vec3(0.86, 0.95, 1.0);
    return slab ? vec4(white, tokyoFill(1.0, 0.8)) : vec4(glass, 1.0);
  }
  if (m >= 140.0) {
    return vec4(paint, tokyoFill(1.0, 0.85));
  }
  // The lower body is an open lattice: two legs, X bracing in each panel
  // and a strut at each panel edge. The arch opens between the legs.
  float leg = max(mx * 0.9, 0.11 * hw);
  if (m < 36.0) {
    float arch = (hw - leg) * sqrt(max(1.0 - (m / 36.0) * (m / 36.0), 0.0));
    if (au < arch) {
      cover = 0.0;
      return vec4(paint, 0.0);
    }
  }
  vec2 panel = tokyoPanel(m);
  float f = (m - panel.x) / (panel.y - panel.x);
  float slope = 2.0 * hw / (panel.y - panel.x);
  float reach = 0.5 * max(mx, slope * my) + 0.01;
  float diag = min(abs(u - hw * (2.0 * f - 1.0)), abs(u + hw * (2.0 * f - 1.0)));
  float strut = abs(m - panel.x) < my * 0.5 ? 1.0 : 0.0;
  float member = hw - au < leg || diag < reach || strut > 0.5 ? 1.0 : 0.0;
  vec3 gap = paint * 0.8;
  return vec4(mix(gap, paint, member), mix(tokyoFill(0.25, 0.3), tokyoFill(1.0, 0.85), member));
}

// Mount Fuji: a symmetric cone with concave slopes, a small flat crater
// and a snow cap whose lower edge runs down the gullies in short teeth.
vec4 tokyoFuji(vec2 q, out float cover) {
  cover = 0.0;
  float peak = 0.345;
  float d = max(abs(q.x) - 0.01, 0.0);
  float top = peak - 0.36 * pow(d, 0.8);
  if (q.y > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  float tooth = 0.024;
  float k = floor(q.x / tooth);
  float tri = 1.0 - abs(2.0 * fract(q.x / tooth) - 1.0);
  float snowline = peak - 0.045 - (0.006 + 0.02 * hash21(vec2(k, 4.0))) * tri;
  if (q.y > snowline) {
    return vec4(0.66, 0.72, 0.84, tokyoFill(1.0, 0.55));
  }
  // A faint gradient: the slopes are a touch lighter towards the snow.
  float lift = clamp((q.y - 0.18) / (peak - 0.18), 0.0, 1.0);
  vec3 body = mix(vec3(0.14, 0.17, 0.3), vec3(0.26, 0.31, 0.47), lift);
  bool rim = q.y > top - tokyoCh;
  return vec4(body, rim ? tokyoFill(0.5, 0.24) : tokyoFill(0.25, 0.12));
}

vec3 tokyoTint(float r) {
  if (r < 0.45) {
    return vec3(1.0, 0.7, 0.36);
  }
  if (r < 0.8) {
    return vec3(0.8, 0.93, 1.0);
  }
  return vec3(1.0, 0.85, 0.52);
}

// One window's brightness. Each window keeps its state for ten to twenty
// minutes and fades over a few seconds when it changes, so only a handful
// switch at a time across the whole city.
float tokyoWindow(vec2 id, float lit, float t) {
  float period = 600.0 + 600.0 * hash21(id + 0.37);
  float x = t / period + hash21(id + 9.1) * 7.0;
  float epoch = floor(x);
  float now = step(1.0 - lit, hash21(id + vec2(epoch * 1.31, 2.0)));
  float before = step(1.0 - lit, hash21(id + vec2((epoch - 1.0) * 1.31, 2.0)));
  float fade = smoothstep(0.0, 3.0 / period, fract(x));
  return mix(before, now, fade) * (0.72 + 0.28 * hash21(id + 5.5));
}

// A row of high-rises. Slots are w wide; each holds one building whose
// edges, roof and window grid sit on whole samples. cap(x) keeps the
// skyline low in front of the tower and Fuji so both read.
vec4 tokyoBlocks(float w, float off, vec2 range, float seed, vec2 pitch, float lit, float dim, float floorY, float t, float towerX, float fujiX, out float cover) {
  cover = 0.0;
  float x = tokyoP.x + off;
  float id = floor(x / w);
  float r1 = hash21(vec2(id, seed));
  float r2 = hash21(vec2(id, seed + 7.1));
  float r3 = hash21(vec2(id, seed + 13.7));
  float r4 = hash21(vec2(id, seed + 19.3));
  float c0 = tokyoCol((id + 0.02 + 0.08 * r2) * w - off);
  float c1 = tokyoCol((id + 0.98 - 0.08 * r3) * w - off);
  if (tokyoSample.x < c0 || tokyoSample.x >= c1) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w - off;
  float h = range.x + (range.y - range.x) * pow(r1, 1.25);
  h = mix(min(h, TOKYO_BASE + 0.05 + 0.02 * r2), h, smoothstep(0.07, 0.15, abs(cx - towerX)));
  h = mix(min(h, 0.17 + 0.025 * r3), h, max(smoothstep(0.12, 0.26, abs(cx - fujiX)), 1.0 - tokyoFujiOn));
  float roof = tokyoRow(h);
  // Some towers carry a narrower crown, and the tallest a red beacon.
  float inset = floor((c1 - c0) * 0.25);
  float crown = r2 > 0.6 && c1 - c0 > 5.0 ? tokyoRow(h + 0.018 + 0.02 * r4) : roof;
  bool inCrown = tokyoSample.x >= c0 + inset && tokyoSample.x < c1 - inset;
  float lamp = floor((c0 + c1) * 0.5);
  if (r1 > 0.8 && tokyoSample.x == lamp && tokyoSample.y == crown) {
    cover = 1.0;
    float b = tokyoBeacon(t, r4 * 6.28);
    return vec4(vec3(1.0, 0.1, 0.06) * mix(0.3, 1.0, b), tokyoFill(1.0, mix(0.3, 1.0, b)));
  }
  if (tokyoSample.y >= (inCrown ? crown : roof)) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec3 tint = tokyoTint(r4);
  // Windows: pitch is converted to whole samples, one sample of wall
  // between columns and a slab between floors. Ramp charsets pair glyphs
  // into two-wide windows, which read better than a lone glyph.
  float px = max(tokyoFill(2.0, 3.0), floor(pitch.x / tokyoCw + 0.5));
  float py = max(2.0, floor(pitch.y / tokyoCh + 0.5));
  float wy = py - max(1.0, floor(py * 0.4));
  float lx = tokyoSample.x - c0 - 1.0;
  float ly = (inCrown ? crown : roof) - 1.0 - tokyoSample.y;
  float cols = c1 - c0 - 2.0;
  bool ribbon = r3 < 0.18;
  bool strip = r3 > 0.18 && r3 < 0.3;
  bool pane = lx >= 0.0 && lx < cols && ly >= 0.0 && tokyoSample.y > tokyoRow(floorY)
    && (ribbon || mod(lx, px) < px - 1.0) && (strip || mod(ly, py) < wy);
  if (!pane) {
    return vec4(tint * dim, 0.0);
  }
  vec2 win = vec2(id * 31.0 + floor(lx / (ribbon ? 2.0 : px)), floor(ly / py)) + seed;
  float glow = tokyoWindow(win, lit, t);
  return vec4(tint * dim * glow, glow > 0.3 ? tokyoFill(1.0, 0.75) : 0.0);
}

// The elevated line: a dotted beam on thin pillars, and one train that
// crosses slowly as a row of lit windows.
vec4 tokyoRailLine(float t, out float cover) {
  cover = 0.0;
  float beam = tokyoRow(TOKYO_RAIL);
  float s = tokyoSample.y;
  vec3 steel = vec3(0.34, 0.38, 0.5);
  if (s == beam) {
    cover = 1.0;
    return vec4(steel, tokyoFill(0.5, 0.24));
  }
  if (s < beam) {
    float pillar = tokyoCol(floor(tokyoP.x / 0.16 + 0.5) * 0.16);
    if (tokyoSample.x == pillar) {
      cover = 1.0;
      return vec4(steel, tokyoFill(0.5, 0.24));
    }
    return vec4(0.0);
  }
  float rows = max(1.0, floor(0.008 / tokyoCh + 0.5));
  if (tokyoTrain < 0.5 || s > beam + rows) {
    return vec4(0.0);
  }
  float car = max(4.0, floor(0.045 / tokyoCw + 0.5));
  float cars = car * 7.0;
  float span = tokyoCount.x + cars + car * 6.0;
  // It starts a third of the way in, so the still frame shows it.
  float head = mod(floor(t * 0.032 / tokyoCw) + floor(tokyoCount.x * 0.3) + cars, span) - car * 3.0;
  float k = head - tokyoSample.x;
  if (k < 0.0 || k >= cars) {
    return vec4(0.0);
  }
  cover = 1.0;
  float kk = mod(k, car);
  vec3 light = vec3(1.0, 0.95, 0.84);
  if (k < 0.5) {
    return vec4(light, 1.0);
  }
  if (k > cars - 1.5) {
    return vec4(1.0, 0.12, 0.08, tokyoFill(1.0, 0.7));
  }
  // Each car: a coupler gap, then windows two lit to one pillar.
  if (kk > car - 1.5 || mod(kk, 3.0) > 1.5) {
    return vec4(light * 0.8, 0.0);
  }
  return vec4(light, tokyoFill(1.0, 0.75));
}

// A sparse field of stars, at most one dot per glyph cell, twinkling
// gently. The whole cell takes the star's colour so the dot stays bright.
vec4 tokyoStars(float t) {
  vec2 cell = floor(tokyoSample / tokyoGrid);
  float area = tokyoGrid.x * tokyoGrid.y * tokyoCw * tokyoCh;
  float r = hash21(cell + 11.3);
  float y = (cell.y + 0.5) * tokyoGrid.y * tokyoCh;
  if (y < 0.5 || r > 55.0 * area) {
    return vec4(0.0);
  }
  vec2 at = floor(vec2(hash21(cell + 1.7), hash21(cell + 5.9)) * tokyoGrid);
  float lit = tokyoSample == cell * tokyoGrid + at ? 1.0 : 0.0;
  float twinkle = 0.62 + 0.22 * sin(t * (0.5 + hash21(cell + 3.1)) + r * 90.0);
  float fade = smoothstep(0.5, 0.62, y);
  return vec4(vec3(0.82, 0.88, 1.0) * twinkle * fade, lit * tokyoFill(1.0, 0.12));
}

vec2 tokyoCacheUv = vec2(-1.0);
float tokyoCacheT = -1.0;
vec4 tokyoCacheValue = vec4(0.0);

vec4 tokyoScene(vec2 uv, vec2 res, float t) {
  if (uv == tokyoCacheUv && t == tokyoCacheT) {
    return tokyoCacheValue;
  }
  tokyoAspect = res.x / res.y;
  tokyoCount = vec2(ascii_samples.x, res.y);
  tokyoSample = floor(uv * tokyoCount);
  tokyoCw = tokyoAspect / tokyoCount.x;
  tokyoCh = 1.0 / tokyoCount.y;
  // Positions are taken at sample centres so every layer agrees on them.
  tokyoP = vec2(((tokyoSample.x + 0.5) / tokyoCount.x - 0.5) * tokyoAspect, (tokyoSample.y + 0.5) * tokyoCh);
  // Landmarks sit on a sample centre so each is symmetric to the sample.
  float towerCol = tokyoCol(min(tokyoAspect * 0.21, tokyoAspect * 0.5 - 0.13));
  float towerX = ((towerCol + 0.5) / tokyoCount.x - 0.5) * tokyoAspect;
  float fujiCol = tokyoCol(-tokyoAspect * 0.24);
  float fujiX = ((fujiCol + 0.5) / tokyoCount.x - 0.5) * tokyoAspect;

  // Starlight white, so an empty sky never borrows a colour from below.
  vec4 acc = vec4(0.82, 0.86, 0.95, 0.0);
  vec4 star = tokyoStars(t);
  if (star.r > 0.0) {
    acc = star;
  }
  float cover;
  if (tokyoFujiOn > 0.5) {
    vec4 fuji = tokyoFuji(tokyoP - vec2(fujiX, 0.0), cover);
    acc = cover > 0.5 ? fuji : acc;
  }
  vec4 far = tokyoBlocks(0.046, 3.7, vec2(0.13, 0.26), 3.0, vec2(0.009, 0.011), 0.68, 0.5, TOKYO_RAIL + 0.018, t, towerX, fujiX, cover);
  acc = cover > 0.5 ? far : acc;
  float metre = TOKYO_HEIGHT / 333.0;
  float halo;
  vec4 tower = tokyoTower((tokyoP.x - towerX) / metre, (tokyoP.y - TOKYO_BASE) / metre, tokyoCw / metre, tokyoCh / metre, t, cover, halo);
  if (cover > 0.5) {
    acc = tower;
  } else if (halo > 0.5 && acc.a == 0.0) {
    acc.rgb = tower.rgb;
  }
  vec4 near = tokyoBlocks(0.074, 0.0, vec2(0.09, 0.42), 9.0, vec2(0.011, 0.013), 0.84, 1.0, TOKYO_RAIL + 0.018, t, towerX, fujiX, cover);
  acc = cover > 0.5 ? near : acc;
  vec4 rail = tokyoRailLine(t, cover);
  acc = cover > 0.5 ? rail : acc;

  // intensity dims colour in step and thins the glyphs more gently, so a
  // dimmed scene keeps its shapes.
  tokyoCacheUv = uv;
  tokyoCacheT = t;
  tokyoCacheValue = vec4(acc.rgb * tokyoIntensity, acc.a * sqrt(tokyoIntensity));
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

// Braille and quadrants light a dot only above the threshold. Ordered
// dithering turns the scene's quarter and half tones into even dot grids,
// which is how Fuji's slopes and the open lattice read.
const DOT_CHARSETS: ReadonlySet<CharsetName> = new Set<CharsetName>([
  "braille",
  "quadrants",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to top, #03050d 0%, #0a1226 18%, #03050d 40%, #03050d 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface TokyoProps extends AsciiSceneProps {
  /** How bright the scene is, from 0 (blank) to 1, so text on top stays readable. Default 1. */
  intensity?: number;
  /** Mount Fuji on the horizon. Default `true`. */
  fuji?: boolean;
  /** The train crossing on the elevated line. Default `true`. */
  train?: boolean;
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
 * Tokyo at night. Tokyo Tower stands on the right in orange and white,
 * its Main Deck and Top Deck lit, over a dense skyline of lit windows.
 * Mount Fuji's snowy cone sits far off on the left. Only lights move:
 * windows switch on and off now and then, red beacons pulse slowly, and
 * one train crosses on the elevated line. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const Tokyo = ({
  charset = "braille",
  chars,
  colorMode,
  phosphor,
  paper,
  dither,
  cell = 9,
  stillTime = 6,
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
        tokyoGrid: [gridX, gridY],
        tokyoIntensity: clamp(intensity, 0, 1),
        tokyoTrain: train ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      dither={
        dither ?? (DOT_CHARSETS.has(charset) && !chars ? "bayer4" : "none")
      }
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
