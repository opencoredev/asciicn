"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The whole city is one function, `crScene`, returning the colour in RGB
// and the tone in alpha. `field` and `colorField` both call it for the
// same sample, so it keeps the last result and the second call is free.
const SCENE = `
const float CR_STREET = -0.2;

// Sample rows in the box, set once per sample by crScene.
float crRows = 1.0;

float crHash(float a, float b) {
  return hash21(vec2(a, b));
}

// Night sky over the city: a low cloud deck lit magenta from below.
vec3 crSky(vec2 p, float t) {
  float h = p.y - CR_STREET;
  // The haze glows brightest behind the skyline, so towers read as dark
  // shapes cut out of it.
  vec3 col = mix(vec3(1.2, 0.3, 0.95), vec3(0.0, 0.0, 0.01), smoothstep(0.02, 0.62, h));
  col = mix(col, vec3(0.25, 0.08, 0.45), smoothstep(0.12, 0.3, h) * (1.0 - smoothstep(0.3, 0.62, h)) * 0.5);
  float cloud = fbm(vec2(p.x * 1.8 + t * 0.015, p.y * 4.5 - t * 0.01));
  col += vec3(0.4, 0.08, 0.36) * smoothstep(0.55, 0.85, cloud) * (1.0 - smoothstep(0.2, 0.75, h));
  return col;
}

// A made-up character: strokes on a 3 by 4 grid, picked by its seed.
float crGlyph(vec2 g, float seed) {
  if (g.x < 0.14 || g.x > 0.86 || g.y < 0.1 || g.y > 0.9) {
    return 0.0;
  }
  vec2 c = floor(g * vec2(3.0, 4.0));
  vec2 f = fract(g * vec2(3.0, 4.0));
  float h = crHash(c.x + c.y * 3.0, seed);
  float across = step(abs(f.y - 0.5), 0.24) * step(0.42, h);
  float down = step(abs(f.x - 0.5), 0.26) * step(h, 0.34);
  float corner = step(0.78, h) * step(abs(f.x - f.y), 0.3);
  return max(max(across, down), corner);
}

// One neon sign: a frame and a column (or row) of characters, flickering.
// Returns the sign's light and adds its halo to glow.
vec4 crSign(vec2 q, vec2 lo, vec2 hi, float id, float vertical, float t, inout vec3 glow, float scale) {
  float pick = crHash(id, 5.3);
  vec3 neon = pick < 0.5 ? vec3(1.0, 0.16, 0.72) : vec3(0.15, 0.95, 1.0);
  if (pick > 0.85) {
    neon = vec3(1.0, 0.72, 0.2);
  }
  float beat = floor(t * 14.0);
  float on = 1.0 - 0.85 * step(0.94, crHash(id, beat));
  // Glitch: now and then a sign tears sideways and swaps its colour.
  float burst = floor(t * 2.7);
  float tear = step(1.0 - crGlitch * 0.22, crHash(id + 0.5, burst));
  q.x += tear * (crHash(floor(q.y * 18.0), burst) - 0.5) * (hi.x - lo.x) * 0.5;
  neon = mix(neon, neon.bgr, tear);
  vec2 d2 = max(max(lo - q, q - hi), 0.0);
  float dist = length(d2) / scale;
  glow += neon * exp(-dist * 55.0) * 0.2 * on;
  if (q.x < lo.x || q.x > hi.x || q.y < lo.y || q.y > hi.y) {
    return vec4(0.0);
  }
  vec2 size = hi - lo;
  vec2 g = (q - lo) / size;
  float edge = min(min(q.x - lo.x, hi.x - q.x), min(q.y - lo.y, hi.y - q.y)) / scale;
  float frame = step(edge, 0.0045);
  float ink;
  if (vertical > 0.5) {
    float n = max(1.0, floor(size.y / size.x));
    float k = g.y * n - t * 0.6 * step(0.6, pick);
    ink = crGlyph(vec2(g.x, fract(k)), id * 7.0 + floor(k));
  } else {
    float n = max(1.0, floor(size.x / size.y));
    float k = g.x * n;
    ink = crGlyph(vec2(fract(k), g.y), id * 11.0 + floor(k) + floor(t * 0.4));
  }
  vec3 col = neon * (0.16 + 1.25 * max(ink, frame)) * on;
  return vec4(col, 1.0);
}

// One skyline layer. k runs 0 (far) to 3 (near). alpha = 1 where a
// building, mast or sign covers the sample.
vec4 crLayer(vec2 p, float k, float t, vec2 ptr, inout vec3 glow) {
  float depth = 1.0 + (3.0 - k) * 0.85;
  float scale = 3.3 * depth;
  float px = p.x + ptr.x * 0.07 / depth + t * 0.006 / depth;
  float x = px * scale + k * 31.7;
  float y = (p.y - CR_STREET - ptr.y * 0.015 / depth) * scale;
  float id = floor(x);
  float fx = fract(x);
  float h1 = crHash(id, k);
  float h2 = crHash(id, k + 9.1);
  float h3 = crHash(id + 3.3, k);
  float h4 = crHash(id, k * 7.0 + 2.0);
  float w = 0.6 + 0.36 * h2;
  float l = (1.0 - w) * h3;
  float r = l + w;
  float hs = mix(0.66, 0.24, k / 3.0) * (0.3 + 0.7 * h1 * h1);
  float top = hs * scale;
  // A narrower crown on some towers.
  float crown = step(0.45, h4) * top * (0.12 + 0.12 * h2);
  float inset = w * 0.17;
  bool body = fx > l && fx < r && y < top;
  bool upper = fx > l + inset && fx < r - inset && y < top + crown;
  float mastX = (l + r) * 0.5 + (h3 - 0.5) * w * 0.4;
  float mastTop = top + crown + (0.05 + 0.1 * h1) * scale;
  float mastHalf = 0.0042 * scale;
  bool mast = h4 > 0.62 && abs(fx - mastX) < mastHalf && y < mastTop;
  // Red beacon blinking at the mast tip.
  float blink = step(0.5, fract(t * 0.7 + h2));
  float beacon = length(vec2(fx - mastX, y - mastTop) / scale);
  glow += step(0.62, h4) * vec3(1.0, 0.1, 0.08) * exp(-beacon * 120.0) * blink * 0.9;

  vec3 col = vec3(0.0);
  float hit = 0.0;
  if (body || upper || mast) {
    hit = 1.0;
    float ys = y / scale;
    col = vec3(0.01, 0.012, 0.03) + vec3(0.06, 0.012, 0.05) * exp(-ys * 12.0);
    // Rim light: cyan down the left edges, magenta down the right.
    float edgeL = (fx - (upper && !body ? l + inset : l)) / scale;
    float edgeR = ((upper && !body ? r - inset : r) - fx) / scale;
    float roof = ((upper && !body ? top + crown : top) - y) / scale;
    float rim = 1.0 / crRows;
    float lift = mix(0.28, 1.0, k / 3.0);
    col += vec3(0.15, 0.75, 1.0) * exp(-edgeL / rim * 2.2) * lift;
    col += vec3(1.0, 0.2, 0.7) * exp(-edgeR / rim * 2.2) * lift * 0.8;
    col += vec3(0.75, 0.5, 0.95) * exp(-roof / rim * 2.0) * lift * 0.9;
    if (!mast || body) {
      // Window grid, square-ish, with whole dark floors and rare flicker.
      float n = floor(3.0 + h2 * 6.0);
      float pitch = w / n;
      vec2 wg = vec2((fx - l) / pitch, y / (pitch * 1.35));
      vec2 cellId = floor(wg);
      vec2 f = fract(wg);
      float lit = step(0.78 - 0.22 * h3 + (3.0 - k) * 0.04, crHash(cellId.x + id * 5.7, cellId.y + k * 13.0));
      lit *= step(0.2, crHash(cellId.y, id + k));
      lit *= 1.0 - step(0.975, crHash(cellId.x + cellId.y * 31.0, id)) * step(0.5, crHash(id + cellId.y, floor(t * 6.0)));
      float pane = step(0.24, f.x) * step(f.x, 0.76) * step(0.28, f.y) * step(f.y, 0.78);
      // Windows smaller than a sample fill it, as single points of light.
      float samples = pitch / scale * crRows;
      float fine = smoothstep(1.5, 3.0, samples);
      // Sub-sample windows would fill far towers with dots: keep only a
      // few, as distant points of light.
      float sparse = step(0.93, crHash(cellId.x * 3.1 + id, cellId.y));
      float light = lit * mix(sparse * step(0.5, f.x) * step(0.5, f.y), pane, fine);
      float hue = crHash(cellId.y + id, 2.0);
      vec3 warm = hue < 0.55 ? vec3(1.0, 0.68, 0.34) : (hue < 0.85 ? vec3(0.55, 0.85, 1.0) : vec3(1.0, 0.35, 0.8));
      col += warm * light * mix(0.45, 1.0, k / 3.0) * (y < top ? 1.0 : 0.0);
    }
  }
  // Signs hang on the nearer layers, and some towers carry a billboard.
  if (k > 1.5) {
    float sh = crHash(id, 4.4);
    if (sh > 1.0 - crSigns * 0.55) {
      float bw = 0.16 + 0.06 * h3;
      float x0 = l + w * (0.08 + 0.5 * h2 * (1.0 - bw / w));
      float y0 = top * (0.18 + 0.25 * h1);
      float len = min(top * 0.62, bw * (3.0 + floor(h4 * 4.0)));
      vec4 s = crSign(vec2(fx, y), vec2(x0, y0), vec2(x0 + bw, y0 + len), id + k * 50.0, 1.0, t, glow, scale);
      if (s.a > 0.5) {
        col = s.rgb;
        hit = 1.0;
      }
    } else if (sh < 0.12 && h4 < 0.62) {
      float bh = 0.16 + 0.05 * h1;
      vec2 lo = vec2(l + w * 0.06, top + crown * 0.0 + 0.04);
      vec2 hi = vec2(r - w * 0.06, top + 0.04 + bh);
      vec4 s = crSign(vec2(fx, y), lo, hi, id + k * 70.0, 0.0, t, glow, scale);
      if (s.a > 0.5) {
        col = s.rgb;
        hit = 1.0;
      }
    }
  }
  return vec4(col, hit);
}

vec3 crCity(vec2 p, float t, vec2 ptr) {
  vec3 glow = vec3(0.0);
  vec3 col = crSky(p, t);
  float far = 0.0;
  for (int i = 0; i < 4; i++) {
    float k = 3.0 - float(i);
    vec4 layer = crLayer(p, k, t, ptr, glow);
    if (layer.a > 0.5) {
      col = layer.rgb;
      far = 3.0 - k;
      break;
    }
    far = 0.0;
  }
  // Fog sits between layers and thickens toward the street.
  float h = max(p.y - CR_STREET, 0.0);
  vec3 haze = vec3(0.2, 0.05, 0.24) + vec3(0.02, 0.05, 0.1) * smoothstep(0.0, 0.4, h);
  float bank = fbm(vec2(p.x * 3.0 - t * 0.05, h * 10.0 + t * 0.02));
  float fog = crFog * clamp(far * 0.09 + exp(-h * 14.0) * (0.1 + 0.4 * bank), 0.0, 0.85);
  col = mix(col, haze, fog);
  return col + glow;
}

vec3 crRainLayer(vec2 p, float t, float density, float fall, float len, float seed) {
  vec2 q = p;
  q.x += q.y * crWind * 0.4;
  float c = q.x * density;
  float id = floor(c);
  float fx = fract(c) - 0.5;
  float h = crHash(id, seed);
  if (h > crRain * 0.75 + 0.05) {
    return vec3(0.0);
  }
  float y = fract(q.y * 0.55 + t * fall * (0.75 + 0.5 * h) + h * 7.31);
  float streak = (1.0 - smoothstep(0.0, len, y)) * step(0.004, y);
  float thin = exp(-fx * fx * 60.0);
  return vec3(0.6, 0.78, 1.0) * streak * thin;
}

vec2 crCacheUv = vec2(-1.0);
float crCacheT = -1.0;
vec4 crCacheValue = vec4(0.0);

vec4 crScene(vec2 uv, vec2 res, float t) {
  if (uv == crCacheUv && t == crCacheT) {
    return crCacheValue;
  }
  crRows = res.y;
  float aspect = res.x / res.y;
  // Portrait boxes zoom out so the skyline keeps its width.
  float zoom = max(1.0, 1.15 / aspect);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * crParallax;
  vec3 col;
  if (p.y >= CR_STREET) {
    col = crCity(p, t, ptr);
  } else {
    // Wet street: the city mirrored, rippled by rain, brighter in puddles.
    float d = CR_STREET - p.y;
    float z = 1.0 / (d + 0.03);
    float ripple = snoise(vec2(p.x * 26.0, z * 3.0 - t * 2.2)) * (0.2 + crRain);
    vec2 m = vec2(p.x + ripple * 0.006, CR_STREET + d * 1.15 + ripple * 0.004);
    vec3 mirrored = crCity(m, t, ptr);
    float puddle = smoothstep(0.42, 0.62, fbm(vec2(p.x * 2.2 * z * 0.12, z * 0.5)));
    col = mirrored * mix(0.14, 0.62, puddle) * smoothstep(-0.02, 0.06, d + 0.04);
    col += vec3(0.02, 0.02, 0.04);
    // Lane marks running toward the vanishing point.
    float lane = abs(fract(p.x * z * 0.9 + 0.5) - 0.5);
    col += vec3(0.25, 0.22, 0.3) * step(lane, 0.02) * step(0.5, fract(z * 0.4 - t * 0.6)) * smoothstep(0.0, 0.1, d);
    // Rain rings opening on the puddles.
    vec2 cell = vec2(p.x * z * 2.0, z * 1.5);
    vec2 cid = floor(cell);
    vec2 cf = fract(cell) - 0.5;
    float phase = fract(t * 0.9 + crHash(cid.x, cid.y));
    float ring = abs(length(cf * vec2(1.0, 2.2)) - phase * 0.45);
    col += vec3(0.4, 0.5, 0.65) * exp(-ring * 40.0) * (1.0 - phase) * step(1.0 - crRain * 0.6, crHash(cid.y, cid.x + 2.0)) * puddle;
    // Street lights along the kerb.
    col += vec3(0.95, 0.45, 0.6) * exp(-d * 60.0) * 0.35;
  }
  // Rain in three depths, nearer drops longer and faster.
  vec3 ambient = vec3(0.65, 0.5, 0.95);
  col += ambient * crRainLayer(p, t, 90.0, 1.1, 0.06, 1.0) * 0.4;
  col += ambient * crRainLayer(p + 0.37, t, 60.0, 1.6, 0.09, 2.0) * 0.55;
  col += crRainLayer(p * 0.8 + 0.71, t, 34.0, 2.3, 0.13, 3.0) * 0.7;

  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  // A toe keeps the dark sky nearly empty, so silhouettes stay crisp.
  // Glyph ramps are calibrated by ink coverage, so even a faint tone draws
  // dots: a floor keeps building faces and dark sky truly empty.
  float tone = clamp((pow(lum * 1.7, 1.35) - 0.05) / 0.95, 0.0, 1.0);
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.6 + 0.4 * smoothstep(0.0, 0.8, peak));
  crCacheUv = uv;
  crCacheT = t;
  crCacheValue = vec4(ink, tone);
  return crCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return crScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return crScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#04030a";
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
        "linear-gradient(to bottom, #04050d 0%, #160a24 52%, #3a0f3a 74%, #07060c 76%, #120818 100%)",
    }}
  />
);

export interface CyberpunkRainSceneProps extends AsciiSceneProps {
  /** How hard it rains, from 0 (dry) to 1 (downpour). Default 0.7. */
  rain?: number;
  /** Slant of the rain, from -1 (blowing left) to 1 (blowing right). Default 0.35. */
  wind?: number;
  /** Fog between the skyline layers, from 0 to 1. Default 0.6. */
  fog?: number;
  /** How many buildings carry neon signs, from 0 to 1. Default 0.6. */
  signs?: number;
  /** How often the signs glitch, from 0 to 1. Default 0.4. */
  glitch?: number;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's night colour in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Neon Rain Metropolis. Four skyline layers with lit windows and masts,
 * flickering neon signs, fog between the layers, a wet street that
 * mirrors the city and rain slanting in front. The pointer shifts the
 * layers for parallax.
 */
export const CyberpunkRainScene = ({
  charset = "braille",
  dither = "bayer4",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 7,
  interactive = true,
  interaction = "none",
  rain = 0.7,
  wind = 0.35,
  fog = 0.6,
  signs = 0.6,
  glitch = 0.4,
  fallback = FALLBACK,
  ...props
}: CyberpunkRainSceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        crFog: fog,
        crGlitch: glitch,
        crParallax: interactive ? 1 : 0,
        crRain: rain,
        crSigns: signs,
        crWind: wind,
      }}
      charset={charset}
      dither={dither}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      fps={fps}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
