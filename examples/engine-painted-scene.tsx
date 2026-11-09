"use client";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// A moonlit lake between hills: the starter scene from the painted scenes
// guide. The scene is painted in colour first; the tone (dot size) is read
// back from that colour, so size and colour always agree.
const SCENE = `
// Set once per sample by lakeColor and read by every layer.
float lakeT;
float lakeHorizon;
float lakeHalfW;
float lakeScale;
float lakeSqueeze;
vec2 lakeMoon;

// A stable random value per cell. hash21 repeats every 50 whole cells.
float lakeHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Deep blue overhead, dusty violet at the horizon, a cool glow around the
// moon, thin cloud lit only near it, and sparse stars high up.
vec3 lakeSky(vec2 p, vec2 cellId) {
  float h = clamp((p.y - lakeHorizon) / (1.0 - lakeHorizon), 0.0, 1.0);
  vec3 col = mix(vec3(0.44, 0.38, 0.58), vec3(0.13, 0.14, 0.3), smoothstep(0.0, 0.35, h));
  col = mix(col, vec3(0.04, 0.05, 0.12), smoothstep(0.3, 1.0, h));
  // Undo the phone squeeze so the moon and its halo stay round.
  float r = length(vec2((p.x - lakeMoon.x) / lakeSqueeze, p.y - lakeMoon.y));
  col += vec3(0.2, 0.21, 0.3) * exp(-r * 3.0);
  col += vec3(0.5, 0.5, 0.56) * exp(-r * r * 260.0);
  float streak = fbm(vec2(p.x * 1.1 - lakeT * 0.006, p.y * 9.0));
  float cloud = smoothstep(0.55, 0.75, streak) * smoothstep(0.04, 0.16, h) * (1.0 - smoothstep(0.45, 0.65, h));
  vec3 cloudCol = mix(vec3(0.1, 0.1, 0.2), vec3(0.62, 0.6, 0.7), exp(-r * 5.0));
  col = mix(col, cloudCol, cloud * 0.7);
  float star = step(0.994, lakeHash(cellId)) * smoothstep(0.35, 0.7, h);
  col += vec3(0.6, 0.62, 0.7) * star * (0.6 + 0.4 * sin(lakeT * 0.7 + lakeHash(cellId + 3.0) * 40.0));
  float disc = 1.0 - smoothstep(0.034, 0.04, r);
  return mix(col, vec3(1.0, 0.96, 0.86), disc);
}

// The top of layer i (0 the far snow range, 1 wooded hills, 2 the near
// shore) above the horizon. Two noise scales, so no edge is straight and
// no two peaks match.
float lakeRidge(float x, float i) {
  float freq = 1.1 + i * 0.6;
  float n = fbm(vec2(x * freq + i * 7.3, i * 3.1));
  float ridged = 1.0 - abs(snoise(vec2(x * freq * 0.8, i + 9.0)));
  float height = mix(0.26, 0.07, i * 0.5) * mix(n, ridged, mix(0.6, 0.2, i * 0.5)) * lakeScale;
  // The near layer dips under the water in the middle and right, so it
  // frames the lake instead of crossing it.
  float near = step(1.5, i) * smoothstep(-0.1, 0.5, x / lakeHalfW);
  return lakeHorizon + mix(0.01, -0.03, i * 0.5) + height - near * 0.12;
}

vec3 lakeAbove(vec2 p, vec2 cellId) {
  vec3 col = lakeSky(p, cellId);
  vec3 haze = lakeSky(vec2(p.x, lakeHorizon + 0.03), cellId) * 0.8;
  // Far to near: each nearer layer paints over the ones behind it.
  for (int k = 0; k < 3; k++) {
    float i = float(k);
    float top = lakeRidge(p.x, i);
    if (p.y < top) {
      // Shade by the silhouette's normal against the moon. Below the crest
      // the slope is read over a wider window at a wandering x, so faces
      // spread into broad planes split by crooked ridges, not vertical
      // lines; ribs down the fall line break them up.
      float below = top - p.y;
      float xs = p.x + below * 0.5 * snoise(vec2(below * 5.0, p.x * 3.0 + i));
      float e = 0.01 + below * 0.8;
      float slope = (lakeRidge(xs + e, i) - lakeRidge(xs - e, i)) / (2.0 * e);
      vec2 normal = normalize(vec2(-slope, 1.0));
      vec2 toMoon = normalize(lakeMoon - vec2(p.x, top));
      float rib = snoise(vec2(p.x * 22.0, below * 3.0 + i));
      float lit = smoothstep(0.1, 0.8, dot(normal, toMoon) + 0.25 * rib);
      // Each nearer layer is darker: moonlit snow far, woods, then rock.
      vec3 shade = mix(vec3(0.12, 0.13, 0.27), vec3(0.03, 0.035, 0.08), i * 0.5);
      vec3 light = mix(vec3(0.78, 0.8, 0.92), vec3(0.2, 0.23, 0.3), i * 0.5);
      // Snow lies near the crests and gives way to dark rock below.
      float snow = 1.0 - smoothstep(0.03, 0.1, below + 0.03 * rib);
      light = mix(light * 0.35, light, mix(snow, 1.0, i * 0.5));
      vec3 face = mix(shade, light, lit);
      // A rim of moonlight along every crest on the lit side.
      face = mix(face, vec3(0.7, 0.72, 0.82), smoothstep(0.01, 0.0, below) * lit * 0.5);
      // Atmospheric perspective: far layers and every layer's foot sink
      // into the haze.
      float far = mix(0.3, 0.0, i * 0.5);
      far = mix(far, 1.0, 0.4 * (1.0 - smoothstep(0.0, 0.05, p.y - lakeHorizon)));
      col = mix(face, haze, far);
    }
  }
  return col;
}

vec3 lakeWater(vec2 p, vec2 cellId) {
  float depth = (lakeHorizon - p.y) / lakeHorizon;
  // Mirror about the horizon, wobbled by ripples that grow toward the viewer.
  float wob = (0.002 + 0.01 * depth) * sin(p.y * 220.0 / (0.25 + depth) + lakeT * 0.5 + 2.0 * snoise(vec2(p.x * 2.0, p.y * 10.0)));
  vec3 col = lakeAbove(vec2(p.x + wob, 2.0 * lakeHorizon - p.y), cellId);
  col = col * vec3(0.6, 0.66, 0.8) * mix(0.95, 0.55, depth) + vec3(0.02, 0.03, 0.07);
  // The moon's path: glints in a column that widens toward the viewer.
  float dx = abs(p.x - lakeMoon.x) / lakeSqueeze;
  float width = 0.012 + 0.07 * depth;
  float column = exp(-dx * dx / (width * width));
  float glint = smoothstep(0.35, 0.85, snoise(vec2(p.x * 26.0, p.y * 130.0 + lakeT * 0.25)));
  col += vec3(0.9, 0.86, 0.72) * column * (0.12 + glint) * mix(1.0, 0.55, depth);
  return col;
}

vec3 lakeColor(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  // Narrow boxes squeeze x, so a phone still sees the hills and the moon.
  lakeSqueeze = sqrt(clamp(1.6 / aspect, 1.0, 4.0));
  float portrait = 1.0 - smoothstep(0.7, 1.1, aspect);
  lakeT = t;
  lakeHalfW = 0.5 * aspect * lakeSqueeze;
  // On a phone the headline fills the middle: the horizon and the hills
  // drop below the buttons and the moon rises into the sky above the text.
  lakeHorizon = mix(0.4, 0.2, portrait);
  lakeScale = mix(1.0, 0.7, portrait);
  lakeMoon = vec2(0.55 * lakeHalfW, mix(lakeHorizon + 0.3, 0.8, portrait));
  vec2 p = vec2((uv.x - 0.5) * aspect * lakeSqueeze, uv.y);
  vec2 cellId = floor(uv * res);

  vec3 col = p.y >= lakeHorizon ? lakeAbove(p, cellId) : lakeWater(p, cellId);

  // A dark near shore in the bottom left: the foreground plane.
  float shore = 0.12 + 0.05 * fbm(vec2(p.x * 3.0, 5.0)) - 0.3 * smoothstep(-0.9, 0.2, p.x / lakeHalfW);
  if (p.y < shore) {
    float rocks = 0.5 + 0.5 * snoise(vec2(p.x * 14.0, p.y * 9.0));
    col = mix(vec3(0.03, 0.035, 0.07), vec3(0.12, 0.12, 0.2), rocks * 0.5);
    col = mix(col, vec3(0.4, 0.4, 0.5), smoothstep(0.012, 0.0, shore - p.y) * 0.6);
  }

  // Low mist drifting along the far shore.
  float band = exp(-pow((p.y - lakeHorizon - 0.01) / 0.025, 2.0));
  float mist = smoothstep(0.4, 0.7, fbm(vec2(p.x * 1.5 - t * 0.012, p.y * 12.0))) * band;
  return mix(col, vec3(0.42, 0.4, 0.54), mist * 0.6);
}

// field and colorField run in the same shader pass, so the second call for
// a sample reads the cached result instead of painting the scene again.
vec2 lakeCacheUv = vec2(-1.0);
float lakeCacheT = -1.0;
vec4 lakeCacheValue = vec4(0.0);

vec4 lakeScene(vec2 uv, vec2 res, float t) {
  if (uv == lakeCacheUv && t == lakeCacheT) {
    return lakeCacheValue;
  }
  vec3 col = clamp(lakeColor(uv, res, t), 0.0, 1.0);
  float peak = max(col.r, max(col.g, col.b));
  // Value counts saturated colour as mid-tone, so blue shadow still draws.
  float value = max(dot(col, vec3(0.3, 0.55, 0.15)), 0.7 * peak);
  float tone = 0.1 + 0.9 * pow(value, 1.2);
  // The focal light draws full dots, not a dithered mix of the two largest.
  tone = max(tone, smoothstep(0.82, 0.92, value));
  // Small dots read darker than the light they stand for: lift dark ink.
  vec3 ink = col / max(peak, 1e-3) * pow(peak, 0.6);
  // Quiet darks: the faintest specks, in a colour just above the paper.
  float quiet = 1.0 - smoothstep(0.08, 0.28, value);
  ink = mix(ink, vec3(0.11, 0.12, 0.2), quiet * 0.55);
  tone *= 1.0 - 0.35 * quiet;
  // Below full intensity the middle band, where a headline sits, quiets most.
  float k = lakeIntensity;
  vec2 c = vec2((uv.x - 0.5) * res.x / res.y / 0.55, (uv.y - 0.52) / 0.15);
  float middle = exp(-dot(c, c)) * (1.0 - k);
  tone *= mix(0.72, 1.0, k) * (1.0 - 0.45 * middle);
  ink *= mix(0.5, 1.0, k) * (1.0 - 0.6 * middle);
  lakeCacheUv = uv;
  lakeCacheT = t;
  lakeCacheValue = vec4(ink, tone);
  return lakeCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return lakeScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return lakeScene(uv, res, t).rgb;
}
`;

// The scene paints its own night, so modes that use its colours keep this
// paper in light and dark themes alike.
const NIGHT = "#070a14";
const PAINTED: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

export interface MoonLakeProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Square cells, for an even lattice of dots. Default `true`. */
  square?: boolean;
  /** Paper behind the dots. Default: the scene's night in painted modes. */
  paper?: AsciiColor;
}

export const MoonLake = ({
  charset = "dots",
  colorMode = "truecolor",
  cell = 7,
  square = true,
  dither = "bayer4",
  stillTime = 6,
  intensity = 1,
  paper,
  ...props
}: MoonLakeProps) => (
  <AsciiShader
    field={FIELD}
    colorField={COLOR_FIELD}
    uniforms={{ lakeIntensity: Math.min(1, Math.max(0, intensity)) }}
    charset={charset}
    colorMode={colorMode}
    paper={paper ?? (PAINTED.has(colorMode) ? NIGHT : undefined)}
    cell={cell}
    square={square}
    dither={dither}
    stillTime={stillTime}
    fallback={<div className="absolute inset-0 bg-[#070a14]" />}
    {...props}
  />
);

export default function EnginePaintedScene() {
  return <MoonLake className="absolute inset-0" />;
}
