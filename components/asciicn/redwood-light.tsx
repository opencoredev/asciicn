"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The forest is painted back to front in square units (x runs 0 to the
// box's aspect, y 0 to 1 up): haze and the sun, the fern floor, two rows of
// distant trunks with mist between them, the canopy, the light shafts and
// the motes in them, the near trunks, and fern fronds across the bottom.
// Every trunk leans towards one vanishing point high above the centre, so
// the forest reads as seen from the floor looking up. The colour of each
// sample becomes both the dot's colour and its size, so light areas draw
// big dots and the darkest shade still keeps a faint dot.
const SCENE = `
// The far edge of the floor, where the haze takes over.
const float RW_HORIZON = 0.31;
// Height of the point every trunk leans towards.
const float RW_VANISH = 3.4;

// Set once per sample by redwoodScene and read by every layer.
float rwT;
float rwAspect;
float rwCx;
float rwHalf;
float rwRow;
float rwCol;
vec2 rwSun;

// A stable random value. The engine's hash21 repeats on whole numbers,
// which would tile the trunk rows.
float rwHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// How much a trunk has narrowed at height y, 1 at the horizon.
float rwScale(float y) {
  return (RW_VANISH - y) / (RW_VANISH - RW_HORIZON);
}

// x in trunk space, where every trunk stands straight.
float rwU(vec2 p) {
  return rwCx + (p.x - rwCx) / rwScale(p.y);
}

// The air: blue-green haze, paler low down in the distance, deeper higher
// up, warm around the sun, and broken by the soft shapes of far foliage.
vec3 rwHaze(vec2 p) {
  float h = clamp((p.y - RW_HORIZON) / 0.62, 0.0, 1.0);
  vec3 col = mix(vec3(0.31, 0.45, 0.45), vec3(0.11, 0.21, 0.22), h);
  col *= 0.85 + 0.3 * fbm(vec2(p.x * 2.2, p.y * 1.4) + 21.0);
  vec2 d = (p - rwSun) * vec2(0.7, 1.0);
  float warm = exp(-length(d) * 5.0);
  return mix(col, vec3(0.92, 0.8, 0.52), warm * 0.7);
}

// The sun's halo: a hot core and a wide soft bloom.
float rwGlow(vec2 p) {
  float d = length((p - rwSun) * vec2(0.8, 1.0));
  return 1.1 * exp(-d / 0.028) + 0.28 * exp(-d / 0.1);
}

// One shaft: a band across the light, soft at its edges.
float rwBeam(float q, float at, float width) {
  return 1.0 - smoothstep(0.35, 1.0, abs(q - at) / width);
}

// Five shafts of light slanting down and to the left from the sun's side
// of the canopy, nearly parallel and widening a little as they fall. Each
// breathes on its own slow cycle. On tall boxes they stand more upright
// and gather towards the middle.
float rwShaft(vec2 p) {
  float drop = rwSun.y + 0.08 - p.y;
  if (drop < 0.0) {
    return 0.0;
  }
  float wide = smoothstep(0.6, 1.4, rwAspect);
  float slope = mix(0.3, 0.6, wide);
  // Position across the shafts, measured where they leave the canopy.
  float q = (p.x - rwSun.x + drop * slope) / (1.0 + 0.45 * drop);
  float span = clamp(rwCx, 0.3, 0.95);
  // Narrower boxes get narrower shafts, so they stay apart.
  float thin = mix(0.55, 1.0, wide);
  float b = rwBeam(q, -0.6 * span, 0.03 * thin) * (0.62 + 0.18 * sin(rwT * 0.19 + 1.0));
  b += rwBeam(q, -0.34 * span, 0.02 * thin) * (0.75 + 0.2 * sin(rwT * 0.23 + 2.0));
  b += rwBeam(q, -0.1 * span, 0.04 * thin) * (0.9 + 0.1 * sin(rwT * 0.16 + 4.0));
  b += rwBeam(q, 0.1 * span, 0.017 * thin) * (0.8 + 0.2 * sin(rwT * 0.21 + 5.0));
  b += rwBeam(q, 0.26 * span, 0.026 * thin) * (0.68 + 0.2 * sin(rwT * 0.27 + 3.0));
  // Dust thickens and thins along each shaft, so none is a flat bar.
  b *= 0.85 + 0.15 * snoise(vec2(q * 12.0, drop * 1.1 - rwT * 0.015));
  // A broad warm wash under the sun ties the shafts together.
  b += 0.05 * exp(-abs(q + 0.05 * span) * 5.0);
  return b * smoothstep(0.0, 0.16, drop) * mix(1.0, 0.7, smoothstep(0.3, 0.9, drop));
}

// The canopy: a dark ceiling of foliage, thinning to gaps near the sun.
float rwCanopy(vec2 p) {
  float edge = 0.76 + 0.12 * (fbm(vec2(p.x * 1.8 + 3.0, 2.0)) - 0.5);
  float c = smoothstep(edge - 0.05, edge + 0.14, p.y + 0.09 * (fbm(p * vec2(3.0, 5.0) + 11.0) - 0.5));
  float gaps = fbm(p * vec2(7.0, 9.0) + 7.0);
  float open = smoothstep(0.52, 0.66, gaps) * 0.7;
  float clearing = exp(-pow(length((p - rwSun) * vec2(0.8, 1.1)) / 0.2, 2.0));
  return c * (1.0 - open) * (1.0 - clearing);
}

// One row of trunks: trunk space is cut into slots, each holding at most
// one trunk, kept inside its slot so no slot needs its neighbours.
// Returns the colour and coverage of the trunk at p, or zero coverage.
vec4 rwTrunks(vec2 p, float spacing, float wMin, float wMax, float base, float seed, float chance, vec3 bark) {
  float u = rwU(p);
  float id = floor(u / spacing);
  if (rwHash(vec2(id, seed)) > chance) {
    return vec4(0.0);
  }
  float uc = (id + 0.27 + 0.46 * rwHash(vec2(id, seed + 1.0))) * spacing;
  float hw = mix(wMin, wMax, rwHash(vec2(id, seed + 2.0)));
  float b = base + 0.025 * (rwHash(vec2(id, seed + 3.0)) - 0.5) + 0.012 * snoise(vec2(p.x * 40.0, seed));
  if (p.y < b) {
    return vec4(0.0);
  }
  hw *= 1.0 + 0.4 * exp(-(p.y - b) / 0.04);
  float x = (u - uc) / hw;
  float soft = rwCol / (hw * rwScale(p.y));
  float cover = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.5, abs(x));
  if (cover <= 0.0) {
    return vec4(0.0);
  }
  float side = sign(rwSun.x - p.x);
  float lit = smoothstep(-0.4, 1.0, x * side);
  float furrow = snoise(vec2(x * 2.6 + id * 7.3, p.y * 3.0 / (hw * 30.0)));
  vec3 col = bark * mix(0.5, 1.5, lit) * (0.9 + 0.15 * furrow);
  // A faint warm edge only: strong rims belong to the giants in front.
  col = mix(col, vec3(0.7, 0.5, 0.32), smoothstep(0.75, 0.98, x * side) * 0.22);
  return vec4(col, cover);
}

// Ground mist drifting slowly between the far trunks.
float rwMist(vec2 p) {
  float band = smoothstep(0.2, 0.3, p.y) * (1.0 - smoothstep(0.38, 0.56, p.y));
  float n = fbm(vec2(p.x * 1.4 - rwT * 0.011, p.y * 5.0 + 3.0));
  return band * smoothstep(0.38, 0.72, n) * rwMistOn;
}

// The fern floor seen in perspective: clumps get smaller and hazier
// towards the horizon, and the shafts land on it as warm pools.
vec3 rwFloor(vec2 p, float shaft) {
  float dy = max(RW_HORIZON - p.y, 0.004);
  float z = 0.1 / dy;
  vec2 g = vec2((p.x - rwCx) * z * 3.2, z * 2.4);
  float clump = fbm(g * 0.9 + 5.0);
  float frond = 0.5 + 0.5 * snoise(g * vec2(3.6, 2.4) + 9.0);
  float leaf = smoothstep(0.35, 0.75, clump) * mix(0.6, 1.0, frond);
  vec3 shade = vec3(0.06, 0.12, 0.07);
  vec3 fern = vec3(0.24, 0.42, 0.17);
  vec3 col = mix(shade, fern, leaf);
  vec3 sunlit = vec3(0.86, 0.82, 0.36);
  col = mix(col, sunlit * mix(0.6, 1.0, leaf), clamp(shaft * 1.6, 0.0, 1.0) * mix(0.5, 0.95, leaf));
  float far = smoothstep(0.05, RW_HORIZON, p.y);
  return mix(col, rwHaze(vec2(p.x, RW_HORIZON)) * 0.85, far * far * 0.75);
}

// The giants in front: hand placed so the middle stays open for a
// headline, and narrowed on tall boxes so they never fill a phone.
vec4 rwGiant(vec2 p, float at, float hw, float base, float seed) {
  float u = rwU(p);
  float uc = rwCx + at * rwHalf;
  if (p.y < base) {
    return vec4(0.0);
  }
  float w = hw * (1.0 + 0.55 * exp(-(p.y - base) / 0.07));
  float x = (u - uc) / w;
  float soft = rwCol / (w * rwScale(p.y));
  float cover = 1.0 - smoothstep(1.0 - soft, 1.0 + soft * 0.5, abs(x));
  if (cover <= 0.0) {
    return vec4(0.0);
  }
  float side = sign(rwSun.x - uc);
  float facing = x * side;
  // Deep vertical furrows in the bark, wandering a little as they climb.
  float wander = 0.25 * snoise(vec2(seed, p.y * 2.2));
  float furrow = 0.5 + 0.5 * sin((x + wander) * 17.0 + seed * 5.0 + 0.8 * snoise(vec2(x * 4.0 + seed, p.y * 1.6)));
  float rough = fbm(vec2(x * 4.0 + seed, p.y * 9.0));
  float lit = smoothstep(-0.9, 1.0, facing);
  float rim = smoothstep(0.6, 0.97, facing);
  // Ridges catch the light and grooves stay in shade, so the bark keeps
  // its texture even on the side away from the sun.
  float relief = mix(0.55, 1.0, furrow) * mix(0.8, 1.15, rough);
  vec3 bark = vec3(0.6, 0.27, 0.16);
  vec3 col = bark * relief * mix(0.32, 1.05, lit);
  col = mix(col, vec3(1.0, 0.7, 0.38) * mix(0.75, 1.05, furrow), rim * 0.9);
  return vec4(col, cover);
}

// Fern clumps across the bottom edge, in front of everything: each is a
// fan of arching fronds with saw-toothed leaflets, dark at the heart and
// lighter towards the tips, gold where a shaft reaches them.
vec4 rwFronds(vec2 p, float shaft) {
  if (p.y > 0.34) {
    return vec4(0.0);
  }
  float sp = 0.3;
  float id0 = floor(p.x / sp);
  float best = -1.0;
  vec3 col = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    float id = id0 + float(i);
    if (rwHash(vec2(id, 60.0)) > 0.85) {
      continue;
    }
    vec2 c = vec2((id + 0.5 + 0.5 * (rwHash(vec2(id, 61.0)) - 0.5)) * sp, -0.04);
    float len = mix(0.22, 0.32, rwHash(vec2(id, 62.0)));
    vec2 d = p - c;
    for (int j = 0; j < 5; j++) {
      float fj = float(j) - 2.0;
      float a = fj * 0.5 + 0.3 * (rwHash(vec2(id, 70.0 + float(j))) - 0.5);
      float l = len * (1.0 - 0.16 * abs(fj));
      float ca = cos(a);
      float sa = sin(a);
      float t = (d.x * sa + d.y * ca) / l;
      if (t < 0.0 || t > 1.0) {
        continue;
      }
      // The spine arches outward and down as it grows.
      float bend = a >= 0.0 ? 1.0 : -1.0;
      float off = (d.x * ca - d.y * sa) - bend * 0.5 * l * t * t;
      float w = l * 0.17 * sin(3.1416 * pow(t, 0.7));
      float saw = fract(t * l / 0.032 + rwHash(vec2(id, float(j))));
      if (abs(off) > w * (0.45 + 0.55 * (1.0 - saw))) {
        continue;
      }
      // The front frond of the clump wins, so overlapping ones stay clear.
      float order = 1.0 - abs(fj) * 0.2 + float(i) * 0.01;
      if (order <= best) {
        continue;
      }
      best = order;
      float v = mix(0.45, 1.0, t) * mix(0.7, 1.0, smoothstep(0.0, 0.4, abs(off) / max(w, 0.001)));
      col = mix(vec3(0.08, 0.17, 0.08), vec3(0.36, 0.56, 0.2), v);
      // A paler midrib down each frond.
      col = mix(col, vec3(0.5, 0.64, 0.3), (1.0 - smoothstep(0.0, 0.18, abs(off) / max(w, 0.001))) * 0.5);
      col = mix(col, vec3(0.84, 0.8, 0.36), clamp(shaft * 1.2, 0.0, 1.0) * t * 0.8);
    }
  }
  return vec4(col, best > -1.0 ? 1.0 : 0.0);
}

// Dust and pollen drifting slowly, seen only where a shaft lights them.
float rwMotes(vec2 p) {
  float sp = 0.055;
  vec2 q = p + vec2(rwT * 0.0045, -rwT * 0.0028);
  q.x += 0.008 * sin(rwT * 0.13 + p.y * 9.0);
  vec2 id = floor(q / sp);
  vec2 f = q - id * sp;
  float h = rwHash(id + u_seed + 31.0);
  if (h > 0.4) {
    return 0.0;
  }
  vec2 c = sp * (0.2 + 0.6 * vec2(rwHash(id + 5.0), rwHash(id + 9.0)));
  vec2 d = (f - c) / vec2(rwCol * 1.2, rwRow * 0.9);
  float twinkle = 0.65 + 0.35 * sin(rwT * (0.5 + h) + h * 40.0);
  return exp(-dot(d, d)) * twinkle * rwMotesOn;
}

vec2 rwCacheUv = vec2(-1.0);
float rwCacheT = -1.0;
vec4 rwCacheValue = vec4(0.0);

vec4 redwoodScene(vec2 uv, vec2 res, float t) {
  if (uv == rwCacheUv && t == rwCacheT) {
    return rwCacheValue;
  }
  rwT = t;
  rwAspect = res.x / res.y;
  rwCx = rwAspect * 0.5;
  rwHalf = rwCx;
  rwRow = 1.0 / res.y;
  rwCol = rwAspect / max(ascii_samples.x, 1.0);
  // The sun sits above and right of centre on wide boxes, centred on tall ones.
  rwSun = vec2(rwCx + 0.2 * min(rwAspect, 1.9) * smoothstep(0.5, 1.3, rwAspect), 0.86);
  vec2 p = vec2(uv.x * rwAspect, uv.y);

  float shaft = rwShaft(p);
  vec3 col;
  if (p.y >= RW_HORIZON) {
    col = rwHaze(p);
  } else {
    col = rwFloor(p, shaft);
  }

  // Far trunks, nearly lost in the haze, then mist, then the middle row.
  vec4 far = rwTrunks(p, 0.1, 0.01, 0.018, 0.3, 17.0, 0.8, vec3(0.16, 0.22, 0.24));
  col = mix(col, mix(far.rgb, rwHaze(p), 0.3), far.a);
  float mist = rwMist(p);
  col = mix(col, rwHaze(p) * 1.15 + vec3(0.1, 0.08, 0.03) * shaft, mist * 0.6);
  vec4 mid = rwTrunks(p, 0.26, 0.03, 0.046, 0.235, 29.0, 0.8, vec3(0.22, 0.12, 0.08));
  col = mix(col, mix(mid.rgb, rwHaze(p), 0.16), mid.a);
  col = mix(col, rwHaze(p) * 1.1, mist * 0.18 * (1.0 - mid.a * 0.5));

  float canopy = rwCanopy(p);
  col = mix(col, vec3(0.04, 0.1, 0.08) + rwHaze(p) * 0.12, canopy);
  // The sun burns through the canopy as the one bright light.
  col += vec3(1.0, 0.84, 0.55) * rwGlow(p) * (1.0 - 0.5 * canopy);

  // Shafts scatter warm light into the air under the canopy.
  float air = shaft * (1.0 - 0.8 * canopy) * smoothstep(RW_HORIZON - 0.1, RW_HORIZON + 0.08, p.y);
  // Shafts ease off around the middle, where a headline usually sits.
  vec2 mid0 = (p - vec2(rwCx, 0.5)) / vec2(max(rwCx, 0.3) * 0.75, 0.2);
  air *= 1.0 - 0.3 * exp(-dot(mid0, mid0) * 0.6);
  col += vec3(0.85, 0.64, 0.28) * air * 0.62;
  float mote = rwMotes(p) * (0.4 + shaft * 1.2) * (1.0 - canopy) * step(RW_HORIZON, p.y);
  col = mix(col, vec3(1.0, 0.95, 0.78), clamp(mote, 0.0, 1.0));

  // A soft vignette: the light lives in the middle and the sun's side.
  vec2 v = (p - vec2(mix(rwCx, rwSun.x, 0.4), 0.55)) / vec2(max(rwCx, 0.4) * 1.25, 0.8);
  col *= mix(1.0, 0.5, smoothstep(0.35, 1.15, length(v)));

  // The giants in front, rim lit on the sun's side.
  float squeeze = mix(0.4, 1.0, smoothstep(0.5, 1.4, rwAspect));
  vec4 g = rwGiant(p, -0.84, 0.14 * squeeze, -0.02, 1.0);
  vec4 g2 = rwGiant(p, -0.47, 0.065 * squeeze, 0.08, 2.0);
  vec4 g3 = rwGiant(p, 0.82, 0.16 * squeeze, -0.04, 3.0);
  g2.rgb = mix(g2.rgb, rwHaze(p), 0.18);
  // On narrow boxes the second giant would merge into the first.
  g2.a *= smoothstep(0.75, 1.05, rwAspect);
  col = mix(col, g2.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.5, g2.a);
  col = mix(col, g.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.35, g.a);
  col = mix(col, g3.rgb + vec3(0.5, 0.36, 0.16) * shaft * 0.35, g3.a);

  vec4 fronds = rwFronds(p, shaft);
  col = mix(col, fronds.rgb, fronds.a);

  col = clamp(col, 0.0, 1.0);
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  // Dot size follows brightness, and never drops below the faintest dot.
  // The faintest dot starts at tone 0.09, the middle one at 0.32 and the
  // largest at 0.73, so shade draws small dots and light the big ones.
  float tone = 0.11 + 0.89 * pow(clamp(lum / 0.75, 0.0, 1.0), 0.9);
  // Size already carries the dark, so colours in shadow are lifted:
  // a small dot keeps its hue instead of vanishing into the paper.
  vec3 ink = col * pow(max(lum, 0.004), -0.4);
  tone *= mix(0.35, 1.0, sqrt(rwIntensity));
  rwCacheUv = uv;
  rwCacheT = t;
  rwCacheValue = vec4(ink * rwIntensity, rwIntensity > 0.0 ? tone : 0.0);
  return rwCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return redwoodScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return redwoodScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need the forest's shade behind
// them in both themes; mono and palette keep the theme's paper, or the phosphor's.
const SHADE = "#060a08";
const SHADE_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "radial-gradient(ellipse at 65% 8%, #6b6a4a 0%, #24362f 35%, #0c1512 70%, #060a08 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface RedwoodLightProps extends Omit<
  AsciiSceneProps,
  "interactive"
> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Dust and pollen drifting through the light shafts. Default `true`. */
  motes?: boolean;
  /** Mist drifting between the far trunks. Default `true`. */
  mist?: boolean;
  /**
   * Paper behind the glyphs. Default: the forest's deep shade in
   * `truecolor`, `ansi16` and `duotone`; the theme's paper, or the
   * phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the shade. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: a soft gradient of the scene. */
  fallback?: ReactNode;
  /** Ignored: the forest never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A redwood forest in early morning. Huge trunks rise in perspective, the
 * nearest dark and furrowed, the farther ones fading into blue-green haze,
 * while shafts of golden light slant through the canopy onto a fern floor
 * and motes drift in the light. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const RedwoodLight = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 12,
  intensity = 1,
  motes = true,
  mist = true,
  fallback = FALLBACK,
  // The forest has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: RedwoodLightProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        rwIntensity: clamp(intensity, 0, 1),
        rwMistOn: mist ? 1 : 0,
        rwMotesOn: motes ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (SHADE_MODES.has(mode) ? SHADE : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
