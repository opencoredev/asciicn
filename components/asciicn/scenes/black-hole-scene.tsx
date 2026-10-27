"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Lengths are in Schwarzschild radii: the horizon is r = 1, light orbits
// at r = 1.5, and the disk's inner edge sits at the innermost stable
// orbit, r = 3. Each ray is bent step by step with the photon equation
// a = -1.5 h^2 r / |r|^5, so the far side of the disk folds over the top
// and under the shadow on its own. `bhScene` returns colour and tone, and
// keeps the last result for the second call on the same sample.
const SCENE = `
const float BH_RING = 2.598;
const float BH_INNER = 3.0;
const float BH_OUTER = 13.0;

float bhHash3(vec3 p) {
  return hash21(p.xy + vec2(p.z * 17.31, p.z * 7.17));
}

float bhNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = bhHash3(i);
  float b = bhHash3(i + vec3(1.0, 0.0, 0.0));
  float c = bhHash3(i + vec3(0.0, 1.0, 0.0));
  float d = bhHash3(i + vec3(1.0, 1.0, 0.0));
  float e = bhHash3(i + vec3(0.0, 0.0, 1.0));
  float g = bhHash3(i + vec3(1.0, 0.0, 1.0));
  float h = bhHash3(i + vec3(0.0, 1.0, 1.0));
  float k = bhHash3(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(h, k, f.x), f.y), f.z);
}

// Streaks stretched along the orbit: the angle is sampled on a circle, so
// there is no seam, and more slowly than the radius.
float bhSwirl(float a, float r, float seed) {
  vec3 c = vec3(cos(a) * 2.4, sin(a) * 2.4, r * 1.7 + seed);
  float n = 0.5 * bhNoise(c);
  n += 0.25 * bhNoise(c * 2.03 + 3.1);
  n += 0.125 * bhNoise(c * 4.11 + 7.7);
  n += 0.0625 * bhNoise(c * 8.3 + 1.3);
  return n / 0.9375;
}

// Keplerian shear winds the streaks tighter forever, so two copies run a
// period apart and crossfade: each is replaced before it winds too far.
float bhTurbulence(float r, float a, float t) {
  float omega = 2.2 * pow(r, -1.5) * bhSpin;
  float period = 16.0;
  float ta = mod(t, period);
  float tb = mod(t + 0.5 * period, period);
  float wa = 1.0 - abs(2.0 * ta / period - 1.0);
  float na = bhSwirl(a - omega * ta, r, 0.0);
  float nb = bhSwirl(a - omega * tb, r, 5.3);
  return mix(nb, na, wa);
}

vec3 bhBlackbody(float temp) {
  vec3 c = mix(vec3(0.85, 0.16, 0.03), vec3(1.0, 0.52, 0.16), smoothstep(0.25, 0.8, temp));
  c = mix(c, vec3(1.0, 0.88, 0.72), smoothstep(0.8, 1.45, temp));
  c = mix(c, vec3(0.62, 0.76, 1.0), smoothstep(1.45, 2.6, temp));
  return c * smoothstep(0.06, 0.6, temp);
}

// Light leaving the disk where a ray crosses it: rgb premultiplied, a = cover.
vec4 bhDisk(vec3 hit, vec3 dir, float r, float t) {
  float a = atan(hit.z, hit.x);
  float inner = smoothstep(BH_INNER * 0.9, BH_INNER * 1.25, r);
  float outer = 1.0 - smoothstep(BH_OUTER * 0.45, BH_OUTER, r);
  float n = bhTurbulence(r, a, t);
  float lanes = 0.5 + 0.5 * sin(r * 5.5 + n * 6.0);
  float density = inner * outer * clamp(0.12 + 1.5 * n * n * (0.55 + 0.45 * lanes), 0.0, 1.4);
  float temp = pow(BH_INNER / r, 0.6) * 1.2;
  // Orbital speed with rs = 1, capped a little below the photon orbit's.
  float v = min(sqrt(0.5 / max(r - 1.0, 0.6)), 0.68);
  vec3 tangent = normalize(vec3(-hit.z, 0.0, hit.x));
  float toward = dot(tangent, -dir);
  float gamma = inversesqrt(1.0 - v * v);
  float doppler = 1.0 / (gamma * (1.0 - v * toward));
  // Physical beaming would black out the receding side entirely in
  // glyphs, so the shift is softened: doppler = 1 is a strong, readable
  // asymmetry rather than the full D^3.
  float shift = mix(1.0, doppler * sqrt(1.0 - 1.0 / r), 0.62 * bhDoppler);
  float beaming = clamp(pow(shift, 2.6), 0.0, 4.0);
  float cover = clamp(density * 0.95, 0.0, 1.0);
  vec3 light = bhBlackbody(temp * shift) * beaming * (0.6 + density) * 2.6;
  // Hue carries the shift too, so it reads in glyphs where brightness
  // saturates: blue-white coming toward you, deep red going away.
  float tint = clamp((shift - 1.0) * 2.8, -1.0, 1.0) * bhDoppler;
  light *= mix(vec3(1.0), tint > 0.0 ? vec3(0.55, 0.85, 1.7) : vec3(1.2, 0.5, 0.3), abs(tint));
  return vec4(light * cover, cover);
}

vec3 bhSky(vec3 d, float t) {
  vec3 col = vec3(0.0);
  vec3 a = abs(d);
  vec2 face;
  float side;
  if (a.x > a.y && a.x > a.z) {
    face = d.yz / a.x;
    side = sign(d.x);
  } else if (a.y > a.z) {
    face = d.xz / a.y;
    side = 2.0 + sign(d.y);
  } else {
    face = d.xy / a.z;
    side = 4.0 + sign(d.z);
  }
  for (int i = 0; i < 2; i++) {
    float layer = float(i);
    vec2 g = face * (55.0 + layer * 60.0);
    vec2 id = floor(g);
    vec2 f = fract(g) - 0.5;
    float h = hash21(id + side * 37.0 + layer * 11.0);
    float limit = 1.0 - 0.075 * bhStars;
    if (h > limit) {
      vec2 o = (vec2(hash21(id + 1.3), hash21(id + 2.7)) - 0.5) * 0.6;
      float dd = length(f - o);
      float mag = (h - limit) / (1.0 - limit);
      float twinkle = 0.6 + 0.4 * sin(t * (1.3 + mag * 5.0) + h * 91.0);
      vec3 tint = mix(vec3(1.0, 0.82, 0.62), vec3(0.7, 0.82, 1.0), hash21(id + 9.1));
      col += tint * exp(-dd * dd * 30.0) * twinkle * (0.35 + 2.2 * mag * mag);
    }
  }
  float band = exp(-pow(dot(d, normalize(vec3(0.35, 1.0, 0.25))) * 3.2, 2.0));
  float dust = fbm(face * 2.6 + side * 3.0);
  col += vec3(0.22, 0.16, 0.34) * band * smoothstep(0.5, 0.95, dust) * 0.4 * bhStars;
  return col;
}

vec3 bhRender(vec2 p, float t, vec2 ptr, float pixel) {
  float elevation = bhTilt + ptr.y * 0.12;
  float roll = -0.05 + ptr.x * 0.12;
  float dist = 26.0;
  vec3 ro = dist * vec3(0.0, sin(elevation), -cos(elevation));
  vec3 forward = normalize(-ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec2 q = vec2(p.x * cos(roll) - p.y * sin(roll), p.x * sin(roll) + p.y * cos(roll));
  vec3 rd = normalize(forward * 1.5 + right * q.x + up * q.y);

  float impact = length(cross(ro, rd));
  vec3 pos = ro;
  vec3 dir = rd;
  vec3 hv = cross(pos, dir);
  float h2 = dot(hv, hv);
  vec3 col = vec3(0.0);
  float through = 1.0;
  float captured = 0.0;
  for (int i = 0; i < 100; i++) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    if (r < 1.0) {
      captured = 1.0;
      break;
    }
    if (r > 34.0 && dot(pos, dir) > 0.0) {
      break;
    }
    float dt = clamp(0.1 * r, 0.025, 2.6);
    vec3 prev = pos;
    dir += -1.5 * h2 * pos / (r2 * r2 * r) * dt;
    pos += dir * dt;
    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      float rh = length(hit.xz);
      if (rh > BH_INNER * 0.85 && rh < BH_OUTER) {
        vec4 e = bhDisk(hit, normalize(dir), rh, t);
        col += e.rgb * through;
        through *= 1.0 - e.a;
        if (through < 0.03) {
          break;
        }
      }
    }
  }
  col += (1.0 - captured) * through * bhSky(normalize(dir), t);
  // The photon ring: light that circled the hole before escaping, a thin
  // line just outside the shadow, brighter on the approaching side.
  // At least a sample wide, so ramps with one sample per glyph keep it.
  float width = max(0.035, pixel * 0.7);
  float ring = exp(-pow((impact - BH_RING - 0.03) / width, 2.0)) * mix(1.0, 0.6, smoothstep(0.035, 0.3, width));
  float side = 1.0 + 0.6 * bhDoppler * clamp(-q.x * 4.0, -1.0, 1.0);
  col += vec3(1.0, 0.8, 0.58) * ring * side * 1.1;
  return col;
}

vec2 bhCacheUv = vec2(-1.0);
float bhCacheT = -1.0;
vec4 bhCacheValue = vec4(0.0);

vec4 bhScene(vec2 uv, vec2 res, float t) {
  if (uv == bhCacheUv && t == bhCacheT) {
    return bhCacheValue;
  }
  float aspect = res.x / res.y;
  // Portrait boxes zoom out so the whole disk fits across.
  float zoom = max(1.0, 1.45 / aspect);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * bhParallax;
    // One sample in impact-parameter units: camera distance over focal length.
  float pixel = 26.0 / 1.5 * zoom / res.y;
  vec3 col = bhRender(p, t, ptr, pixel);
  // Filmic shoulder so the beamed side saturates instead of clipping.
  col = col / (1.0 + col * 0.35);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float tone = clamp((1.0 - exp(-lum * 3.2)) * 1.16 - 0.09, 0.0, 1.0);
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.42 + 0.58 * smoothstep(0.0, 0.9, peak));
  bhCacheUv = uv;
  bhCacheT = t;
  bhCacheValue = vec4(ink, tone);
  return bhCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return bhScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return bhScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#020206";
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
        "radial-gradient(circle at 50% 50%, #000 0 8%, #ffd9a8 9%, #c2551a 13%, transparent 30%), radial-gradient(ellipse 60% 9% at 50% 52%, #ffb35c, #7a2a0c 60%, transparent 75%), #030308",
    }}
  />
);

const DEGREES = Math.PI / 180;

export interface BlackHoleSceneProps extends AsciiSceneProps {
  /** How far above the disk the camera sits, in degrees from 0 (edge on) to 30. Default 7. */
  tilt?: number;
  /** How fast the disk turns. 0 freezes the swirl. Default 1. */
  spin?: number;
  /** Relativistic brightening and blue shift of the approaching side, from 0 (off) to 1 (physical). Default 1. */
  doppler?: number;
  /** How many background stars, from 0 to 2. Default 1. */
  stars?: number;
  /** An engine pointer effect on top of the view tilt. Default `"none"`. */
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
 * Gargantua Accretion Disk. A ray-traced black hole: every ray bends
 * around the hole, so the disk's far side arches over and under the
 * shadow, stars smear into arcs, and a thin photon ring circles the edge.
 * The approaching side of the disk is brighter and bluer. The pointer
 * tilts the view.
 */
export const BlackHoleScene = ({
  charset = "braille",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  tilt = 7,
  spin = 1,
  doppler = 1,
  stars = 1,
  fallback = FALLBACK,
  ...props
}: BlackHoleSceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        bhDoppler: doppler,
        bhParallax: interactive ? 1 : 0,
        bhSpin: spin,
        bhStars: stars,
        bhTilt: tilt * DEGREES,
      }}
      charset={charset}
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
