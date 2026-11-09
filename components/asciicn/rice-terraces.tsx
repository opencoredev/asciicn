"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted back to front on the engine's sample grid: `p` is a
// sample centre in square units (x 0..aspect, y 0..1 up), and `rtX` is a
// horizontal scene coordinate that spans about -0.8..0.8 on a wide box and
// the middle -0.4..0.4 on a phone, so the hills stay centred in any crop.
// Every layer returns a colour and a tone; the tone picks the dot size.
const SCENE = `
const float RT_SUN_Y = 0.72;
const float RT_SUN_R = 0.046;

// Set once per sample by rtScene and read by every layer.
float rtT;
float rtAspect;
float rtSh;
float rtSw;
float rtSunX;

// sRGB hex-ish keys, kept as constants so the palette stays small.
const vec3 RT_ZENITH = vec3(0.12, 0.14, 0.33);
const vec3 RT_VIOLET = vec3(0.30, 0.25, 0.48);
const vec3 RT_MAUVE = vec3(0.58, 0.36, 0.55);
const vec3 RT_ROSE = vec3(0.86, 0.48, 0.53);
const vec3 RT_PEACH = vec3(0.96, 0.65, 0.48);
const vec3 RT_GOLD = vec3(1.0, 0.82, 0.55);
const vec3 RT_SUN = vec3(1.0, 0.95, 0.80);
const vec3 RT_MIST = vec3(0.86, 0.74, 0.82);
const vec3 RT_EARTH = vec3(0.16, 0.12, 0.17);
const vec3 RT_GRASS = vec3(0.19, 0.21, 0.16);

float rtHash(vec2 s) {
  return fract(sin(dot(s, vec2(127.1, 311.7))) * 43758.5453);
}

// The scene's horizontal coordinate for a point in square units.
float rtX(float px) {
  return (px - rtAspect * 0.5) * 1.6 / max(rtAspect, 0.9);
}

// The dawn sky by height alone, from gold at the ridges to indigo overhead.
vec3 rtSkyRamp(float y) {
  float v = clamp((y - 0.55) / 0.45, 0.0, 1.0);
  vec3 c = mix(RT_GOLD, RT_PEACH, smoothstep(0.0, 0.14, v));
  c = mix(c, RT_ROSE, smoothstep(0.1, 0.32, v));
  c = mix(c, RT_MAUVE, smoothstep(0.28, 0.55, v));
  c = mix(c, RT_VIOLET, smoothstep(0.5, 0.8, v));
  return mix(c, RT_ZENITH, smoothstep(0.75, 1.0, v));
}

// The sun's halo: a wide warm bloom and a tight bright core.
float rtHalo(vec2 p) {
  vec2 d = (p - vec2(rtSunX, RT_SUN_Y)) * vec2(0.7, 1.0);
  float r = length(d);
  return 0.5 * exp(-r / 0.2) + 0.9 * exp(-r / 0.06);
}

vec4 rtSky(vec2 s, vec2 p) {
  float y = p.y;
  float x = rtX(p.x);
  vec3 c = rtSkyRamp(y);
  float halo = rtHalo(p);
  c = mix(c, RT_GOLD, clamp(halo * 0.9, 0.0, 1.0));
  float v = clamp((y - 0.55) / 0.45, 0.0, 1.0);
  // Small dots overhead, growing towards the glow along the horizon.
  float tone = 0.1 + 0.18 * (1.0 - v) + 0.5 * exp(-v / 0.16) + 0.6 * halo;
  // Long thin clouds lit from below, drifting a few cells a minute.
  float band = smoothstep(0.7, 0.78, y) * (1.0 - smoothstep(0.9, 0.98, y));
  float n = fbm(vec2(x * 1.1 + rtT * 0.004, y * 11.0));
  float cloud = smoothstep(0.52, 0.72, n) * band;
  vec3 lit = mix(RT_ROSE, RT_GOLD, clamp(halo * 1.4, 0.0, 1.0));
  c = mix(c, lit, cloud * 0.75);
  tone += cloud * 0.25;
  // A few last stars high up, fading into the dawn.
  float h = rtHash(s + 17.0);
  if (v > 0.72 && h > 0.996) {
    float tw = 0.7 + 0.3 * sin(rtT * (0.4 + h) + rtHash(s) * 30.0);
    c = mix(c, vec3(0.9, 0.9, 1.0), 0.6 * tw);
    tone = max(tone, 0.4 * tw);
  }
  // The sun disc sits just above the far ridges.
  vec2 d = p - vec2(rtSunX, RT_SUN_Y);
  if (length(d) < RT_SUN_R) {
    c = RT_SUN;
    tone = 1.0;
  }
  return vec4(c, tone);
}

// The far ridges, as heights over the scene's x: broad shoulders with a
// few soft peaks, ridged noise folded so the tops stay rounded.
float rtRidge(float x, float seed, float base, float amp) {
  float r = 1.0 - abs(snoise(vec2(x * 1.25 + seed, seed)));
  float n = 0.7 * r * r + 0.2 * snoise(vec2(x * 2.6 - seed, seed * 1.7)) + 0.06 * snoise(vec2(x * 7.0, seed + 4.0));
  return base + amp * n;
}

// How close a point is to the sun's column, for light that pools under it.
float rtSunward(vec2 p, float width) {
  float dx = (p.x - rtSunX) / width;
  return exp(-dx * dx);
}

// Valley mist: drifting banks, densest in a band across the valley floor.
float rtMist(vec2 p, float lo, float hi) {
  float x = rtX(p.x);
  // Long banks stretched along the valley, torn into wisps at their edges.
  float n = fbm(vec2(x * 1.8 - rtT * 0.01, p.y * 13.0 + rtT * 0.002));
  float mid = (lo + hi) * 0.5;
  float profile = 1.0 - smoothstep(0.0, (hi - lo) * 0.5, abs(p.y - mid));
  return clamp(profile * smoothstep(0.25, 0.7, n) * 1.3, 0.0, 1.0);
}

// Mist colour: pale rose, warming to gold under the sun.
vec3 rtMistColor(vec2 p) {
  return mix(vec3(0.9, 0.8, 0.88), vec3(1.0, 0.86, 0.7), rtSunward(p, 0.35));
}

// A flooded pool: the sky mirrored at the angle this terrace sees it, and
// the sun's glitter in a soft column under it. Each band keeps one colour,
// so the hill reads as stacked ribbons of light.
vec4 rtPool(vec2 p, float k, float f, float bandY, float haze) {
  // Near pools look down steeply and mirror the high sky; far ones the glow.
  float ry = 0.56 + max(0.62 - bandY, 0.0) * 0.36;
  vec3 c = rtSkyRamp(ry);
  float pick = rtHash(vec2(k, 3.1));
  c *= 0.9 + 0.14 * pick;
  // The far edge of each pool mirrors the dark wall standing above it.
  float wall = smoothstep(0.6, 0.95, f);
  c = mix(c, vec3(0.2, 0.15, 0.26), wall * 0.65);
  float shimmer = fbm(vec2(p.x * 9.0 / max(rtAspect, 0.9) + rtT * 0.03, k * 3.7 + f * 1.5 - rtT * 0.02));
  // The glitter path narrows with the box, so a phone keeps its pools.
  float path = mix(0.06, 0.16, 1.0 - bandY / 0.62) * clamp(rtAspect / 1.6, 0.45, 1.0);
  float glint = rtSunward(p, path) * smoothstep(0.5, 0.75, shimmer);
  c = mix(c, mix(RT_GOLD, RT_SUN, glint), clamp(glint, 0.0, 1.0));
  float lum = dot(c, vec3(0.3, 0.55, 0.15));
  // The nearest pools sit in the hill's own shadow, so the light gathers
  // towards the far terraces and the sun.
  float shade = 1.0 - smoothstep(0.0, 0.3, bandY);
  c *= 1.0 - 0.3 * shade;
  float tone = 0.66 + 0.35 * lum + 0.3 * glint - 0.22 * shade - 0.3 * wall;
  // A faint slow ripple runs along every pool.
  tone += 0.03 * sin(p.x * 70.0 / max(rtAspect, 0.9) + rtT * 0.5 + k * 1.7);
  // Far hills sit back: hazier colour and smaller dots.
  c = mix(c, mix(rtMistColor(p), vec3(0.5, 0.46, 0.7), step(0.32, haze) * 0.6), haze);
  return vec4(c, mix(tone, 0.48, smoothstep(0.25, 0.4, haze)));
}

// The earthen wall under a pool, with grass on it here and there.
vec4 rtWall(vec2 s, vec2 p, float k, float haze) {
  float n = rtHash(s + vec2(k, 7.0));
  vec3 c = mix(RT_EARTH, RT_GRASS, step(0.6, n));
  float tone = 0.07 + 0.07 * n;
  c = mix(c, rtMistColor(p) * 0.55, haze);
  return vec4(c, tone + haze * 0.18);
}

// The foreground hill: crest high on the left, falling to the right.
float rtNearCrest(float x) {
  return 0.27 + 0.36 * smoothstep(0.38, -0.9, x) + 0.025 * snoise(vec2(x * 2.4, 2.0)) + 0.008 * snoise(vec2(x * 9.0, 5.0));
}

// The middle hill: a rounded spur on the right, its feet in the mist.
float rtMidCrest(float x) {
  return 0.33 + 0.2 * exp(-pow((x - 0.55) / 0.34, 2.0)) + 0.012 * snoise(vec2(x * 4.0, 9.0));
}

// A hill's contour height. Seen from across the valley the terraces run
// almost level; they bow down towards the viewer over each spur and lift
// into each gully, and a little wobble keeps them hand built.
float rtContour(vec2 p, vec4 bows) {
  float x = rtX(p.x);
  float e = p.y;
  e += bows.x * exp(-pow((x - bows.y) / bows.z, 2.0));
  e += bows.w * sin(x * 3.3 + bows.y * 5.0) + 0.006 * snoise(vec2(x * 6.0, p.y * 4.0));
  return e;
}

// Terraces on a hill: bands that thin with height, each a dark earthen wall
// at its near edge and a pool of water behind it. top is the contour height
// of the highest band; split sets how often a low bund splits a pool.
vec4 rtTerraces(vec2 s, vec2 p, vec4 bows, float top, float count, float hazeBase, float split) {
  float e = rtContour(p, bows) / top;
  float e2 = rtContour(p + vec2(0.0, rtSh), bows) / top;
  float g = pow(clamp(e, 0.0, 1.2), 1.25) * count;
  float g2 = pow(clamp(e2, 0.0, 1.2), 1.25) * count;
  float k = floor(g);
  float f = g - k;
  float rows = 1.0 / max(g2 - g, 1e-3);
  float haze = clamp(hazeBase + 0.3 * smoothstep(0.55, 1.05, e), 0.0, 0.9);
  float bandY = p.y + (0.5 - f) * rows * rtSh;
  float wallRows = clamp(rows * 0.2, 1.0, 2.0);
  if (f * rows < wallRows) {
    return rtWall(s, p, k, haze);
  }
  // Low bunds split the pools into paddies, one column wide.
  float col = floor(s.x / rtGrid.x);
  float width = floor(mix(46.0, 18.0, clamp(e, 0.0, 1.0)) * 1.6 / max(rtAspect, 0.9) * max(rtAspect, 0.9) / 1.6);
  float offset = floor(rtHash(vec2(k, 2.0)) * width);
  float slot = floor((col + offset) / width);
  if (mod(col + offset, width) < 0.5 && rtHash(vec2(k, slot)) < split) {
    return rtWall(s, p, k, haze);
  }
  return rtPool(p, k, f, bandY, haze);
}

// Clumps of trees along a crest: how far above the ground their tops reach.
float rtTrees(float x, float seed) {
  float clump = smoothstep(0.38, 0.62, fbm(vec2(x * 5.0, seed)));
  float crowns = 0.5 + 0.5 * snoise(vec2(x * 34.0, seed + 2.0));
  return clump * (0.012 + 0.02 * crowns);
}

// The trees themselves: a dark mass with a warm rim where the sun finds it.
vec4 rtTreeColor(vec2 p, float top, float tall, float haze) {
  // Only real crowns catch the light, not the bare crest between clumps.
  float rim = (1.0 - smoothstep(0.0, 1.5 * rtSh, top - p.y)) * smoothstep(0.006, 0.016, tall);
  vec3 c = mix(vec3(0.11, 0.12, 0.2), RT_PEACH, rim * 0.6 * rtSunward(p, 0.5));
  c = mix(c, rtMistColor(p) * 0.6, haze);
  return vec4(c, 0.4 + 0.12 * rim + 0.15 * haze);
}

// One far bird gliding across the sky, with a slow flap now and then.
float rtBird(vec2 s) {
  if (rtBirdOn < 0.5) {
    return 0.0;
  }
  float span = rtAspect + 0.3;
  float bx = mod(rtT * 0.009 + 0.25 * span, span) - 0.15;
  float by = 0.8 + 0.015 * sin(rtT * 0.07);
  vec2 cell = floor(s / rtGrid);
  vec2 home = floor(vec2(bx / rtSw, by / rtSh) / rtGrid);
  vec2 d = cell - home;
  float ax = abs(d.x);
  bool flap = fract(rtT * 0.18) < 0.12;
  // Gliding, the wings are one level line; on the flap the tips lift a row.
  bool body = d.y == 0.0 && ax < (flap ? 1.5 : 2.5);
  bool tips = flap && d.y == 1.0 && ax > 1.5 && ax < 2.5;
  return body || tips ? 1.0 : 0.0;
}

vec2 rtCacheUv = vec2(-1.0);
float rtCacheT = -1.0;
vec4 rtCacheValue = vec4(0.0);

vec4 rtScene(vec2 uv, vec2 res, float t) {
  if (uv == rtCacheUv && t == rtCacheT) {
    return rtCacheValue;
  }
  rtAspect = res.x / res.y;
  rtSh = 1.0 / res.y;
  rtSw = rtAspect / max(ascii_samples.x, 1.0);
  rtT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  vec2 p = (s + 0.5) * vec2(rtSw, rtSh);
  // Right of centre on wide boxes, so the headline has the middle; centred on tall ones.
  rtSunX = rtAspect * mix(0.5, 0.66, smoothstep(0.9, 1.5, rtAspect));
  float x = rtX(p.x);

  vec4 hit;
  float nearCrest = rtNearCrest(x);
  float nearTall = rtTrees(x, 1.0);
  float nearTrees = nearCrest + nearTall;
  if (p.y < nearTrees && p.y > nearCrest - 0.018) {
    hit = rtTreeColor(p, nearTrees, nearTall, 0.0);
  } else if (p.y < nearCrest) {
    hit = rtTerraces(s, p, vec4(0.075, -0.32, 0.24, 0.028), 0.7, 14.0, 0.0, 0.3);
    // Wisps of mist curl over the upper terraces.
    float m = rtMist(p, nearCrest - 0.1, nearCrest + 0.04) * 0.35;
    hit.rgb = mix(hit.rgb, rtMistColor(p), m);
  } else {
    float midCrest = rtMidCrest(x);
    float r1 = rtRidge(x, 3.0, 0.42, 0.14);
    float r2 = rtRidge(x, 7.0, 0.49, 0.13);
    float r3 = rtRidge(x, 13.0, 0.55, 0.11);
    float glow = rtSunward(p, 0.3);
    float midTall = rtTrees(x, 6.0) * 0.8;
    float midTrees = midCrest + midTall;
    if (p.y < midTrees && p.y > midCrest - 0.014) {
      hit = rtTreeColor(p, midTrees, midTall, 0.3);
    } else if (p.y < midCrest) {
      hit = rtTerraces(s, p, vec4(0.05, 0.6, 0.15, 0.015), 0.6, 12.0, 0.35, 0.4);
    } else if (p.y < r1) {
      // The nearest ridge: deep blue, a rim of light on its crest.
      float lit = 1.0 - smoothstep(0.0, 1.5 * rtSh, r1 - p.y);
      float foot = smoothstep(0.02, 0.12, r1 - p.y);
      vec3 c = mix(vec3(0.2, 0.2, 0.42), rtMistColor(p), 0.55 * foot);
      hit = vec4(mix(c, RT_PEACH, lit * glow * 0.8), 0.42 + 0.2 * lit * glow + 0.3 * foot);
    } else if (p.y < r2) {
      float lit = 1.0 - smoothstep(0.0, 1.5 * rtSh, r2 - p.y);
      float foot = smoothstep(0.02, 0.1, r2 - p.y);
      vec3 c = mix(vec3(0.36, 0.35, 0.64), rtMistColor(p), 0.5 * foot);
      hit = vec4(mix(c, RT_ROSE, lit * 0.5), 0.72);
    } else if (p.y < r3) {
      // The farthest ridge is nearly the sky's colour, only a little cooler.
      vec3 c = mix(vec3(0.6, 0.55, 0.8), vec3(0.9, 0.68, 0.7), glow * 0.5);
      hit = vec4(c, 0.74);
    } else {
      hit = rtSky(s, p);
      if (rtBird(s) > 0.5) {
        // An egret, its back catching the first light.
        hit = vec4(1.0, 0.88, 0.8, 0.8);
      }
    }
    // Mist fills the valley between the hills and the far ridges.
    float m = rtMist(p, 0.26, 0.44);
    hit.rgb = mix(hit.rgb, rtMistColor(p), m * 0.85);
    hit.a = mix(hit.a, 0.85 + 0.15 * glow, m * 0.85);
  }

  // Intensity dims colour everywhere but shrinks the dots only gently, so
  // the shapes hold; a soft oval in the middle, where a headline sits,
  // quiets further.
  float tone = hit.a < 0.04 ? 0.0 : clamp(hit.a, 0.0, 1.0);
  vec2 calm = (uv - 0.5) / vec2(0.34, 0.24);
  float quiet = (1.0 - rtIntensity) * exp(-dot(calm, calm));
  float dim = mix(0.25, 1.0, rtIntensity) * (1.0 - 0.6 * quiet);
  tone *= mix(0.9, 1.0, rtIntensity) * (1.0 - 0.5 * quiet);
  rtCacheUv = uv;
  rtCacheT = t;
  rtCacheValue = vec4(hit.rgb * dim, tone);
  return rtCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return rtScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return rtScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night-blue paper behind
// them in both themes; mono and palette keep the theme's paper, or the phosphor's.
const DAWN_PAPER = "#0c0d22";
const DAWN_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #1a1d44 0%, #4a3a6e 25%, #b8687a 38%, #e8a070 42%, #6a5a80 50%, #2a2440 70%, #141226 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RiceTerracesProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The one bird gliding far off across the sky. Default `true`. */
  bird?: boolean;
  /** Square cells, so the dots lie on an even halftone lattice. `false` uses the font's tall cells. Default `true`. */
  square?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"outrun"`, indigo through rose to gold. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dawn as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the scene never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Flooded rice terraces at dawn. Curved steps of water sweep down a
 * hillside, each pool mirroring the pink and gold sky between dark earthen
 * walls, while mist drifts through the valley and far ridges fade into
 * haze. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const RiceTerraces = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 0,
  intensity = 1,
  bird = true,
  fallback = FALLBACK,
  // The scene has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: RiceTerracesProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rtBirdOn: bird ? 1 : 0,
        // The samples per glyph, so details keep their size in Braille and quadrants.
        rtGrid: [gx, gy],
        rtIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "outrun" : undefined)}
      paper={paper ?? (DAWN_MODES.has(mode) ? DAWN_PAPER : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
