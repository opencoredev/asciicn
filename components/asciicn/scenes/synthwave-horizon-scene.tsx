"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// One heightfield makes the whole ground: flat down a central corridor,
// rising into ridged mountains on both sides. A ray march finds where each
// view ray lands, and grid lines are drawn there in world units, so the
// floor grid climbs the mountains as wireframe. Line widths are measured
// against one sample's footprint, so distant lines fade into haze instead
// of shimmering. `swScene` returns colour and tone, cached per sample.
const SCENE = `
const float SW_CAMERA = 0.85;
const float SW_HORIZON = -0.07;
const float SW_CORRIDOR = 2.2;

float swNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Sharp-crested ridges: folded noise, squared, three octaves.
float swRidges(vec2 p) {
  float sum = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 3; i++) {
    float n = 1.0 - abs(swNoise(p) * 2.0 - 1.0);
    sum += amp * n * n;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 4.1;
    amp *= 0.45;
  }
  return sum;
}

float swHeight(vec2 xz) {
  float side = smoothstep(SW_CORRIDOR, SW_CORRIDOR + 5.5, abs(xz.x));
  return side * (0.25 + swRidges(xz * vec2(0.16, 0.11)) * 7.5) * swMountains;
}

// Coverage of grid lines one world unit apart, box-filtered over the
// sample's footprint and faded to their average once lines merge.
float swLines(vec2 g, vec2 footprint, float width) {
  vec2 d = abs(fract(g - 0.5) - 0.5);
  vec2 aa = max(footprint, vec2(1e-4));
  // Conservative: a line that touches the sample lights it, so even far
  // lines stay one crisp sample wide for glyph ramps and the edge set.
  vec2 line = clamp((width + aa * 0.5 - d) / (aa * 0.35 + 1e-4), 0.0, 1.0);
  vec2 merge = smoothstep(0.3, 0.7, aa);
  line = mix(line, vec2(0.14), merge);
  return max(line.x, line.y);
}

// The sun: yellow to magenta, cut by gaps that widen and slide downward.
vec3 swSun(vec2 s, float t, out float cover) {
  float radius = 0.21;
  float r = length(s);
  float v = s.y / radius;
  vec3 col = mix(vec3(1.0, 0.12, 0.55), vec3(1.0, 0.86, 0.3), smoothstep(-0.9, 0.75, v));
  float lower = clamp((0.3 - v) / 1.3, 0.0, 1.0);
  float stripe = fract(lower * 6.5 - t * 0.22);
  float gap = step(stripe, lower * 0.75 * swSunBands) * step(0.001, lower);
  cover = (1.0 - smoothstep(radius - 0.004, radius + 0.004, r)) * (1.0 - gap);
  float outside = step(radius, r);
  float halo = (exp(-(r - radius) * 11.0) * 0.4 + exp(-(r - radius) * 40.0) * 0.35) * outside;
  return col * cover * 1.25 + vec3(1.0, 0.25, 0.6) * halo;
}

vec3 swSky(vec3 rd, float t, float pixel, vec2 uv) {
  vec2 s = rd.xy / max(rd.z, 0.05);
  float h = s.y;
  vec3 col = mix(vec3(0.5, 0.08, 0.38), vec3(0.12, 0.02, 0.22), smoothstep(0.0, 0.12, h));
  col = mix(col, vec3(0.0, 0.0, 0.03), smoothstep(0.1, 0.45, h));
  // Stars, fewer toward the glow at the horizon.
  vec2 g = s * 42.0;
  vec2 id = floor(g);
  float star = hash21(id + 3.7);
  if (star > 0.93) {
    vec2 o = (vec2(hash21(id + 1.1), hash21(id + 5.3)) - 0.5) * 0.6;
    float d = length(fract(g) - 0.5 - o);
    float twinkle = 0.55 + 0.45 * sin(t * (1.0 + star * 4.0) + star * 60.0);
    col += vec3(0.85, 0.85, 1.0) * exp(-d * d * 28.0) * twinkle * smoothstep(0.08, 0.3, h) * 1.3;
  }
  float cover;
  col += swSun(s - vec2(0.0, 0.2), t, cover);
  return col;
}

vec3 swRender(vec2 p, float t, vec2 ptr, float pixel) {
  float yaw = ptr.x * 0.24 + sin(t * 0.09) * 0.035;
  float roll = -ptr.x * 0.05;
  vec2 q = vec2(p.x * cos(roll) - p.y * sin(roll), p.x * sin(roll) + p.y * cos(roll));
  vec3 rd = normalize(vec3(q.x, q.y - SW_HORIZON + ptr.y * 0.04, 1.05));
  rd.xz = vec2(rd.x * cos(yaw) + rd.z * sin(yaw), -rd.x * sin(yaw) + rd.z * cos(yaw));
  vec3 ro = vec3(0.0, SW_CAMERA, 0.0);
  float travel = t * 3.2 * swTravel;

  vec3 sky = swSky(rd, t, pixel, p);
  float floorT = rd.y < -1e-4 ? SW_CAMERA / -rd.y : 1e4;
  float hitT = -1.0;
  float gap = 1e3;
  if (abs(rd.x) * floorT < SW_CORRIDOR) {
    // Never leaves the flat corridor: the floor is the hit.
    hitT = floorT < 1e4 ? floorT : -1.0;
  } else {
    float march = 0.05;
    for (int i = 0; i < 64; i++) {
      vec3 at = ro + rd * march;
      float d = at.y - swHeight(vec2(at.x, at.z + travel));
      gap = min(gap, d / march);
      if (d < 0.002 * march) {
        hitT = march;
        break;
      }
      march += max(d * 0.5, 0.012 * march);
      if (march > min(floorT, 160.0)) {
        break;
      }
    }
    // Out of steps or past the ridges: below the horizon it is still floor.
    if (hitT < 0.0 && floorT < 1e4) {
      hitT = floorT;
    }
  }
  if (hitT < 0.0) {
    // A ridge the ray just cleared glows along its crest.
    return sky + vec3(0.3, 0.75, 1.0) * exp(-max(gap, 0.0) / pixel * 0.9) * 0.6;
  }
  vec3 at = ro + rd * hitT;
  vec2 world = vec2(at.x, at.z + travel);
  float e = 0.05;
  float hx = swHeight(world + vec2(e, 0.0)) - swHeight(world - vec2(e, 0.0));
  float hz = swHeight(world + vec2(0.0, e)) - swHeight(world - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx, 2.0 * e, -hz));
  float facing = max(abs(dot(n, rd)), 0.06);
  float spot = hitT * pixel;
  vec2 footprint = vec2(spot / max(facing, abs(n.x) * 0.5 + 0.06), spot / facing);
  float lines = swLines(world, footprint, 0.035);
  float rise = smoothstep(0.08, 1.2, at.y);
  vec3 ink = mix(vec3(1.0, 0.16, 0.72), mix(vec3(0.15, 0.85, 1.0), vec3(0.75, 0.4, 1.0), smoothstep(1.5, 6.0, at.y)), rise);
  vec3 fill = vec3(0.035, 0.0, 0.07) * (0.6 + 0.6 * max(n.z * -1.0, 0.0)) + vec3(0.06, 0.0, 0.08) * rise;
  vec3 col = fill + ink * lines * 1.35;
  // The sun's reflection runs up the wet floor toward it.
  float sunLine = exp(-abs(rd.x / max(rd.z, 0.05) + 0.0) * 9.0) * (1.0 - rise);
  col += vec3(1.0, 0.3, 0.6) * sunLine * 0.18;
  // Haze toward the horizon, the colour of the sun's glow.
  float haze = 1.0 - exp(-hitT * 0.022);
  col = mix(col, vec3(0.42, 0.07, 0.34), haze * 0.9);
  return col;
}

vec2 swCacheUv = vec2(-1.0);
float swCacheT = -1.0;
vec4 swCacheValue = vec4(0.0);

vec4 swScene(vec2 uv, vec2 res, float t) {
  if (uv == swCacheUv && t == swCacheT) {
    return swCacheValue;
  }
  float aspect = res.x / res.y;
  float zoom = max(1.0, 1.2 / aspect);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * zoom;
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * swParallax;
  float pixel = zoom / res.y;
  vec3 col = swRender(p, t, ptr, pixel);
  // A soft bright band rolls down the screen, like a tired CRT.
  float roll = fract(uv.y * 0.6 + t * 0.07);
  col *= 1.0 + swShimmer * 0.35 * exp(-pow((roll - 0.5) * 14.0, 2.0));
  col *= 1.0 - swShimmer * 0.12 * step(0.82, hash21(vec2(floor(uv.y * res.y), floor(t * 12.0))));
  col = col / (1.0 + col * 0.25);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float tone = clamp((1.0 - exp(-lum * 3.4)) * 1.15 - 0.1, 0.0, 1.0);
  float peak = max(max(col.r, col.g), col.b);
  vec3 ink = col / max(peak, 1e-4) * (0.45 + 0.55 * smoothstep(0.0, 0.85, peak));
  swCacheUv = uv;
  swCacheT = t;
  swCacheValue = vec4(ink, tone);
  return swCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return swScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return swScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#05010c";
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
        "radial-gradient(circle at 50% 36%, #ffd34d 0 9%, #ff2f8f 15%, transparent 16%), linear-gradient(to bottom, #05010d 0%, #2a0a44 38%, #b8297a 56%, #10021c 57%, #05010d 100%)",
    }}
  />
);

export interface SynthwaveHorizonSceneProps extends AsciiSceneProps {
  /** How fast the grid rolls toward you. 0 parks the camera. Default 1. */
  travel?: number;
  /** Height of the mountains on both sides, from 0 (flat) to 2. Default 1. */
  mountains?: number;
  /** The gaps cut across the sun, from 0 (a solid disc) to 1. Default 1. */
  sunBands?: number;
  /** The rolling CRT band and row flicker, from 0 to 1. Default 0.5. */
  shimmer?: number;
  /** An engine pointer effect on top of the steering. Default `"none"`. */
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
 * Outrun Wireframe Horizon. A perspective grid rolls toward you and climbs
 * into wireframe mountains on both sides, under a striped retro sun, stars
 * and a slow CRT shimmer. The pointer steers the camera.
 */
export const SynthwaveHorizonScene = ({
  charset = "braille",
  colorMode,
  phosphor,
  paper,
  fps = 60,
  stillTime = 3,
  interactive = true,
  interaction = "none",
  travel = 1,
  mountains = 1,
  sunBands = 1,
  shimmer = 0.5,
  fallback = FALLBACK,
  ...props
}: SynthwaveHorizonSceneProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        swMountains: mountains,
        swParallax: interactive ? 1 : 0,
        swShimmer: shimmer,
        swSunBands: sunBands,
        swTravel: travel,
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
