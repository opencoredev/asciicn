"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Screen space for the land and sky, a shared 3D frame for light and sea:
// the camera sits at the origin, the sea is the plane y = -1, and a screen
// point q is the ray (q.x, q.y - horizon, focal). The lamp is placed on
// that frame at its depth, so each beam is a real line in 3D and the
// light a view ray picks up comes from its closest approach to the beam.
// `lhScene` returns colour and tone, cached for the second call.
const SCENE = `
const float LH_HORIZON = -0.08;
const float LH_FOCAL = 1.3;
const float LH_DEPTH = 12.0;

// Half the box width and sample rows per unit, set once per sample.
float lhHalfWidth = 1.0;
float lhRows = 1.0;

vec3 lhRay(vec2 q) {
  return normalize(vec3(q.x, q.y - LH_HORIZON, LH_FOCAL));
}

// The near cliff's top edge at x, rising steeply from the sea on its left.
float lhCliffTop(float x, float start) {
  float rise = smoothstep(start, start + 0.16, x);
  float rough = (fbm(vec2(x * 7.0, 3.1)) - 0.5) * 0.05 + (fbm(vec2(x * 23.0, 8.7)) - 0.5) * 0.015;
  // A knoll for the lighthouse, then the headland falls away to the right.
  float knoll = exp(-pow((x - start - 0.44) * 6.0, 2.0)) * 0.035;
  float fall = smoothstep(start + 0.62, start + 1.3, x) * 0.09;
  return LH_HORIZON - 0.04 + rise * (0.23 + rough) + knoll - fall;
}

vec3 lhSky(vec2 q, float t, vec2 moon, out float cloudCover) {
  float h = q.y - LH_HORIZON;
  vec3 col = mix(vec3(0.045, 0.06, 0.085), vec3(0.002, 0.004, 0.012), smoothstep(0.0, 0.4, h));
  float dm = length(q - moon);
  float radius = 0.05;
  float disc = 1.0 - smoothstep(radius - 0.003, radius + 0.003, dm);
  float maria = fbm((q - moon) * 38.0 + 2.0);
  vec3 moonCol = vec3(0.95, 0.94, 0.86) * (0.8 - 0.35 * smoothstep(0.5, 0.75, maria));
  vec3 halo = vec3(0.35, 0.42, 0.55) * (exp(-max(dm - radius, 0.0) * 10.0) * 0.4 + exp(-max(dm - radius, 0.0) * 40.0) * 0.4);
  // Two decks of cloud drifting at different speeds.
  float c1 = fbm(vec2(q.x * 2.1 + t * 0.025, q.y * 4.2));
  float c2 = fbm(vec2(q.x * 4.5 + t * 0.045 + 7.0, q.y * 7.0 - 2.0));
  float cloud = smoothstep(0.42, 0.72, c1 * 0.65 + c2 * 0.35) * smoothstep(-0.02, 0.12, h);
  cloud *= 0.55 + 0.45 * lhStorm;
  cloudCover = cloud;
  col += (moonCol * disc + halo * (1.0 - disc)) * (1.0 - cloud * 0.92);
  // Silver linings: thin cloud near the moon catches its light.
  float lining = cloud * (1.0 - cloud) * 4.0 * exp(-dm * 4.5);
  col = mix(col, vec3(0.018, 0.022, 0.032), cloud * 0.85);
  col += vec3(0.55, 0.6, 0.7) * lining * 0.7;
  return col;
}

float lhWaves(vec2 xz, float t) {
  float s = lhSwell;
  float h = 0.0;
  h += 0.32 * s * pow(0.5 + 0.5 * sin(dot(xz, vec2(0.07, -0.42)) + t * 1.1), 2.4);
  h += 0.2 * s * pow(0.5 + 0.5 * sin(dot(xz, vec2(-0.21, -0.55)) + t * 1.45 + 1.7), 2.4);
  h += 0.1 * pow(0.5 + 0.5 * sin(dot(xz, vec2(0.6, -0.9)) + t * 2.1), 2.0);
  h += 0.12 * snoise(xz * vec2(0.35, 0.5) + vec2(t * 0.15, -t * 0.4));
  return h;
}

// One sweeping beam: the light a view ray scatters out of a cone of fog.
float lhBeam(vec3 rd, vec3 lamp, vec3 axis, float occluder, float t) {
  vec3 w0 = -lamp;
  float b = dot(rd, axis);
  float d = dot(rd, w0);
  float e = dot(axis, w0);
  float den = max(1.0 - b * b, 1e-3);
  float along = (e - b * d) / den;
  float view = (b * e - d) / den;
  if (along < 0.0) {
    along = 0.0;
    view = dot(lamp, rd);
  }
  if (view > occluder) {
    return 0.0;
  }
  vec3 near = lamp + axis * along;
  float dist = length(rd * view - near);
  float radius = 0.06 + along * 0.075;
  float core = exp(-dist * dist / (radius * radius) * 1.6);
  // Rays nearly along the beam cross more of it: brighter, as in fog.
  float path = 1.0 / (radius * sqrt(den) + 0.25);
  float fog = 0.35 + 0.9 * fbm(near.xz * 0.12 + near.y * 0.3 + vec2(t * 0.06, 0.0)) * lhFog;
  return core * path * exp(-along * 0.02) * fog * 0.55;
}

vec3 lhRender(vec2 q, float t, vec2 ptr) {
  float halfWidth = lhHalfWidth;
  vec2 moon = vec2(-halfWidth * 0.5, 0.27) - ptr * 0.008;
  float clouds;
  vec3 col = lhSky(q, t, moon, clouds);
  vec3 rd = lhRay(q);

  // The near headland: a cliff on the right with the lighthouse on top.
  vec2 c = q - vec2(ptr.x * 0.05, ptr.y * 0.015);
  float start = min(halfWidth - 0.85, 0.12);
  float top = lhCliffTop(c.x, start);
  float base = LH_HORIZON - 0.04;
  float towerX = start + 0.44;
  float ground = lhCliffTop(towerX, start);
  vec2 lampScreen = vec2(towerX, ground + 0.205);
  float solid = 1e4;
  vec3 land = vec3(0.0);
  bool covered = false;

  // A far point of land on the left, low and blue in the fog.
  float farX = q.x - ptr.x * 0.015;
  float farTop = LH_HORIZON + 0.004 + 0.04 * (1.0 - smoothstep(-halfWidth, -halfWidth * 0.2, farX)) * (0.7 + 0.6 * fbm(vec2(farX * 6.0, 1.0)));
  if (q.y < farTop && q.y > LH_HORIZON - 0.004 && farX < -halfWidth * 0.15) {
    covered = true;
    land = vec3(0.025, 0.035, 0.055) + vec3(0.2, 0.25, 0.32) * exp(-(farTop - q.y) * lhRows * 1.2) * 0.35;
    solid = LH_DEPTH * 4.0;
  }

  if (c.y < top && c.y > base - 0.06 * smoothstep(start, start + 0.3, c.x)) {
    covered = true;
    solid = LH_DEPTH;
    float strata = fbm(vec2(c.x * 12.0, c.y * 45.0));
    float cracks = smoothstep(0.62, 0.8, fbm(vec2(c.x * 40.0, c.y * 6.0)));
    land = vec3(0.02, 0.022, 0.03) * (0.6 + strata) - vec3(0.01) * cracks;
    // Moonlight catches the rim and the left-facing slope.
    float rim = exp(-(top - c.y) * lhRows * 0.8);
    float slope = 1.0 - smoothstep(start - 0.01, start + 0.03, c.x - (top - base) * 0.3);
    land += vec3(0.4, 0.46, 0.58) * (rim * 0.75 + slope * 0.15 * strata);
  }

  // Lighthouse: tapered tower, red bands, gallery, lantern and dome.
  float y = c.y - ground;
  float dx = c.x - towerX;
  float towerHalf = mix(0.03, 0.02, clamp(y / 0.19, 0.0, 1.0));
  if (y > -0.01 && y < 0.19 && abs(dx) < towerHalf) {
    covered = true;
    solid = LH_DEPTH;
    float s = dx / towerHalf;
    float band = step(0.5, fract(y / 0.19 * 3.0 + 0.25));
    vec3 paint = mix(vec3(0.82, 0.82, 0.86), vec3(0.75, 0.12, 0.1), band);
    float lit = clamp(0.62 - 0.55 * s, 0.08, 1.0) * sqrt(max(1.0 - s * s, 0.0));
    land = paint * (0.05 + 0.42 * lit);
    land += vec3(0.55, 0.6, 0.72) * exp(-(1.0 + s) * lhRows * towerHalf * 1.2) * 0.5;
  }
  if (y >= 0.19 && y < 0.197 && abs(dx) < 0.03) {
    covered = true;
    solid = LH_DEPTH;
    land = vec3(0.1, 0.1, 0.12);
  }
  if (y >= 0.197 && y < 0.226 && abs(dx) < 0.018) {
    covered = true;
    solid = LH_DEPTH;
    // Glazing bars across the lit lantern room.
    float bars = step(0.24, abs(fract(dx / 0.012) - 0.5));
    land = vec3(1.0, 0.86, 0.5) * (0.6 + 0.6 * bars);
  }
  float dome = length(vec2(dx, (y - 0.226) * 1.4));
  if (y >= 0.226 && dome < 0.02) {
    covered = true;
    solid = LH_DEPTH;
    land = vec3(0.05, 0.05, 0.07) + vec3(0.4, 0.45, 0.55) * smoothstep(0.012, 0.02, dome) * step(dx, 0.0) * 0.5;
  }
  // Keeper's cottage with one warm window.
  vec2 house = vec2(c.x - (towerX + 0.06), y);
  if (house.y > -0.01 && house.y < 0.04 - abs(house.x) * 0.25 && abs(house.x) < 0.035) {
    covered = true;
    solid = LH_DEPTH;
    land = vec3(0.03, 0.032, 0.045);
    if (abs(house.x - 0.01) < 0.007 && abs(house.y - 0.014) < 0.006) {
      land = vec3(1.0, 0.62, 0.28) * 0.9;
    }
  }

  if (covered) {
    col = land;
  } else if (q.y < LH_HORIZON) {
    // Open sea: a swell rolling in, moon glitter, foam on the crests.
    float far = 1.0 / -rd.y;
    vec3 at = rd * far;
    vec2 xz = at.xz + vec2(ptr.x * 0.4, 0.0);
    float e = 0.04 + far * 0.01;
    float h = lhWaves(xz, t);
    float hx = lhWaves(xz + vec2(e, 0.0), t) - h;
    float hz = lhWaves(xz + vec2(0.0, e), t) - h;
    vec3 n = normalize(vec3(-hx, e * 1.4, -hz));
    vec3 r = reflect(rd, n);
    vec3 moonDir = lhRay(moon);
    float glitter = pow(max(dot(r, moonDir), 0.0), 260.0) * (1.0 - clouds * 0.5);
    vec3 water = vec3(0.004, 0.01, 0.02) + vec3(0.04, 0.06, 0.09) * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
    water += vec3(0.9, 0.92, 0.85) * glitter * 1.6;
    float crest = smoothstep(0.42, 0.62, h / max(lhSwell, 0.3)) * smoothstep(0.35, 0.65, fbm(xz * 0.9 + t * 0.2));
    // Surf churns where the swell meets the cliff foot.
    float shore = 0.0;
    if (c.x > start - 0.06) {
      float gapY = (base - 0.06 * smoothstep(start, start + 0.3, c.x)) - c.y;
      shore = exp(-max(gapY, 0.0) * 70.0) * smoothstep(0.3, 0.7, fbm(vec2(c.x * 30.0, c.y * 60.0 + t * 1.5)));
      float burst = pow(0.5 + 0.5 * sin(t * 0.9 + c.x * 6.0), 6.0);
      shore += exp(-max(gapY, 0.0) * 30.0) * burst * 0.6 * smoothstep(0.5, 0.8, fbm(vec2(c.x * 18.0, c.y * 30.0 - t)));
    }
    water += vec3(0.75, 0.8, 0.85) * (crest * 0.55 + shore);
    float mist = 1.0 - exp(-far * 0.035);
    col = mix(water, vec3(0.045, 0.055, 0.075), mist * (0.6 + 0.4 * lhFog));
    solid = far;
  }

  // Two beams, opposite, turning; the pointer nudges where they point.
  float spin = t * 0.5 * lhSpin + ptr.x * 0.8;
  vec3 lamp = vec3(lampScreen.x + ptr.x * 0.05, lampScreen.y + ptr.y * 0.015 - LH_HORIZON, LH_FOCAL) * (LH_DEPTH / LH_FOCAL);
  vec3 axisA = normalize(vec3(cos(spin), -0.02, sin(spin)));
  vec3 axisB = normalize(vec3(-cos(spin), -0.02, -sin(spin)));
  float beams = lhBeam(rd, lamp, axisA, solid * 1.02, t) + lhBeam(rd, lamp, axisB, solid * 1.02, t);
  col += vec3(1.0, 0.9, 0.66) * beams * (0.55 + 0.6 * clouds);
  // Glare when a beam swings toward the camera, with a flat lens streak.
  vec3 toCamera = normalize(-lamp);
  float facing = pow(max(max(dot(axisA, toCamera), dot(axisB, toCamera)), 0.0), 10.0);
  vec2 dl = q - (lampScreen + vec2(ptr.x * 0.05, ptr.y * 0.015));
  float glare = exp(-length(dl) * 16.0) * (0.25 + 1.6 * facing) + exp(-length(dl) * 70.0) * 0.8;
  glare += exp(-abs(dl.y) * lhRows * 0.9) * exp(-abs(dl.x) * 3.5) * facing * 0.9;
  col += vec3(1.0, 0.88, 0.6) * glare;

  // Rain slanting through, and mist low over the water.
  vec2 rp = q;
  rp.x += rp.y * 0.3;
  float rid = floor(rp.x * 90.0);
  float rh = hash21(vec2(rid, 3.0));
  float drop = fract(rp.y * 0.5 + t * (1.4 + rh * 0.6) + rh * 9.0);
  float streak = (1.0 - smoothstep(0.0, 0.09, drop)) * step(1.0 - lhStorm * 0.5, rh) * exp(-pow(fract(rp.x * 90.0) - 0.5, 2.0) * 60.0);
  col += vec3(0.45, 0.5, 0.6) * streak * 0.5;
  float low = exp(-abs(q.y - LH_HORIZON) * 14.0) * fbm(vec2(q.x * 3.0 - t * 0.04, q.y * 9.0)) * lhFog;
  col += vec3(0.08, 0.1, 0.13) * low;
  return col;
}

vec2 lhCacheUv = vec2(-1.0);
float lhCacheT = -1.0;
vec4 lhCacheValue = vec4(0.0);

vec4 lhScene(vec2 uv, vec2 res, float t) {
  if (uv == lhCacheUv && t == lhCacheT) {
    return lhCacheValue;
  }
  float aspect = res.x / res.y;
  float zoom = max(1.0, 1.5 / aspect);
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * lhParallax;
  lhHalfWidth = aspect * zoom * 0.5;
  lhRows = res.y / zoom;
  vec3 col = lhRender(q, t, ptr);
  col = col / (1.0 + col * 0.3);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float tone = clamp((1.0 - exp(-lum * 3.4)) * 1.22 - 0.16, 0.0, 1.0);
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.45 + 0.55 * smoothstep(0.0, 0.85, peak));
  lhCacheUv = uv;
  lhCacheT = t;
  lhCacheValue = vec4(ink, tone);
  return lhCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return lhScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return lhScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#020409";
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
        "radial-gradient(circle at 24% 22%, #f2efe0 0 3%, #5f6c84 4%, transparent 14%), linear-gradient(to bottom, #02040a 0%, #0c1320 56%, #05080f 58%, #03060c 100%)",
    }}
  />
);

export interface CoastalLighthouseSceneProps extends AsciiSceneProps {
  /** How fast the lamp turns. 0 holds the beams still. Default 1. */
  beamSpeed?: number;
  /** Height of the swell, from 0 (calm) to 2 (heavy). Default 1. */
  swell?: number;
  /** Rain and cloud, from 0 (clear) to 1 (storm). Default 0.5. */
  storm?: number;
  /** Fog the beams light up, from 0 to 1. Default 0.7. */
  fog?: number;
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
 * Midnight Lighthouse & Storm Swell. Twin beams sweep through fog from a
 * lighthouse on a cliff, toward you and away, over a rolling sea with
 * foam on the crests and surf at the cliff foot, under a moon in drifting
 * cloud. The pointer moves the layers and nudges the beams.
 */
export const CoastalLighthouseScene = ({
  charset = "braille",
  dither = "bayer4",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 0.4,
  interactive = true,
  interaction = "none",
  beamSpeed = 1,
  swell = 1,
  storm = 0.5,
  fog = 0.7,
  fallback = FALLBACK,
  ...props
}: CoastalLighthouseSceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        lhFog: fog,
        lhParallax: interactive ? 1 : 0,
        lhSpin: beamSpeed,
        lhStorm: storm,
        lhSwell: swell,
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
