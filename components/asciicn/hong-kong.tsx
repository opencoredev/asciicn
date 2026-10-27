"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Victoria Harbour at night, seen from Kowloon. Everything is placed on
// the engine's sample grid: a building covers whole sample columns and
// rows and its windows fill whole glyph cells, so edges stay hard and
// window grids stay square in every charset. Each layer returns colour
// and tone, with a negative tone for "missed", and the first layer that
// hits from the front wins. Open sky is empty.
const SCENE = `
const float HK_WATER = 0.22;

// Sample size in box units, half the sample columns, the waterline row
// and the time.
float hkW;
float hkH;
float hkHalf;
float hkShore;
float hkT;

// The first and last sample columns whose centres fall inside [x0, x1].
// A span is never narrower than one column, so a mast never vanishes.
vec2 hkCols(float x0, float x1) {
  float l = ceil(x0 / hkW + hkHalf - 0.5);
  float r = floor(x1 / hkW + hkHalf - 0.5);
  return vec2(l, max(l, r));
}

// The last sample row whose centre is at or below y.
float hkTop(float y) {
  return floor(y / hkH - 0.5);
}

float hkX(float col) {
  return (col + 0.5 - hkHalf) * hkW;
}

// Braille and quadrants light a dot only above half tone, so there the
// facades are lifted over it and read as solid walls with dark windows.
float hkFill(float tone) {
  return mix(tone, max(tone, 0.56), hkSolid);
}

// Whether a window is lit. Most keep their state; one in twenty-five
// switches now and then, each on its own slow clock, so across thousands
// of windows only one or two change every second.
float hkLit(vec2 id, float rate) {
  float h = hash21(id);
  float h2 = hash21(id + 17.3);
  if (h2 < 0.04) {
    float epoch = floor(hkT / (40.0 + 3000.0 * h2) + h * 5.0);
    return step(hash21(id + epoch * 3.1), rate);
  }
  return step(h, rate);
}

vec3 hkTint(float h) {
  if (h < 0.45) return vec3(0.92, 0.95, 1.0);
  if (h < 0.8) return vec3(1.0, 0.84, 0.58);
  return vec3(0.6, 0.82, 1.0);
}

// A slow colour wash for the few buildings that change colour at night.
vec3 hkWash(float seed) {
  return toSrgb(oklch(0.74, 0.13, hkT * 0.04 + seed * 2.4));
}

// Whether sample c sits on a lit window: every other whole glyph cell
// across and up inside the columns span and the rows base to roofRow.
bool hkWindow(vec2 c, vec2 span, float roofRow, out vec2 id) {
  vec2 g = floor(c / hkGrid);
  float left = ceil(span.x / hkGrid.x);
  float right = floor((span.y + 1.0) / hkGrid.x) - 1.0;
  float base = ceil(hkShore / hkGrid.y);
  float roof = floor(roofRow / hkGrid.y) - 1.0;
  id = vec2(g.x - left, g.y - base);
  return g.x <= right - 1.0 && g.y <= roof && id.y >= 0.0
    && mod(id.x, 2.0) > 0.5 && mod(id.y, 2.0) > 0.5;
}

// One tower: a dim facade with a grid of windows and a lit roof line.
// crown 1 gives it a colour-changing top band, part of the light show.
vec4 hkTower(vec2 c, float xc, float hw, float height, float seed, float rate, float crown) {
  vec2 span = hkCols(xc - hw, xc + hw);
  if (c.x < span.x || c.x > span.y) {
    return vec4(-1.0);
  }
  float topRow = hkTop(HK_WATER + height);
  if (c.y > topRow) {
    return vec4(-1.0);
  }
  vec3 facade = vec3(0.26, 0.32, 0.5);
  if (c.y == topRow) {
    return vec4(0.66, 0.74, 0.9, 0.6);
  }
  if (crown > 0.5 && c.y >= topRow - hkGrid.y) {
    return vec4(mix(vec3(0.7, 0.76, 0.9), hkWash(seed), hkLights), mix(0.6, 0.86, hkLights));
  }
  vec2 id;
  if (hkWindow(c, span, topRow, id)) {
    if (hkLit(id + seed * 61.0, rate) > 0.5) {
      return vec4(hkTint(hash21(vec2(seed, floor(id.x / 4.0)))), 0.92);
    }
    return vec4(facade * 0.8, 0.2);
  }
  return vec4(facade, hkFill(0.28));
}

// Victoria Peak: a long dark ridge of several summits behind the city,
// highest behind Central, its crest drawn as one line with a few lights
// along the roads.
float hkRidge(float x, float peakX) {
  float d = (x - peakX) / 0.4;
  return HK_WATER + 0.31 + 0.09 * exp(-d * d)
    + 0.03 * sin(x * 6.2 + 0.8) + 0.018 * sin(x * 14.0 + 2.0)
    + 0.006 * sin(x * 31.0 + 0.3);
}

vec4 hkPeak(vec2 c, float peakX) {
  float x = hkX(c.x);
  float crest = hkTop(hkRidge(x, peakX));
  if (c.y > crest) {
    return vec4(-1.0);
  }
  // The crest line: the higher of this column's crest and its neighbours',
  // so steep slopes stay one unbroken line.
  float left = hkTop(hkRidge(x - hkW, peakX));
  float right = hkTop(hkRidge(x + hkW, peakX));
  if (c.y > min(crest, min(left, right)) - 1.0) {
    return vec4(0.36, 0.42, 0.62, 0.55);
  }
  // Street lights wind up the hill in a few sparse strings.
  float road = abs(fract((c.y * hkH - x * 0.35) * 9.0) - 0.5);
  if (road < 0.5 * hkH * 9.0 && hash21(floor(c / hkGrid) + 4.0) > 0.86) {
    return vec4(1.0, 0.82, 0.55, 0.7);
  }
  return vec4(0.12, 0.14, 0.24, 0.14);
}

// The Bank of China Tower: a square prism split into triangular shafts
// that stop at different heights, so its top is a run of slanted roofs
// rising to the apex and the twin masts. The glass is dark; the X braces
// of each square module are lines of white light.
vec4 hkBankOfChina(vec2 c, float xc) {
  const float ROOF = 0.28;
  const float HW = 0.034;
  vec2 span = hkCols(xc - HW, xc + HW);
  float n = span.y - span.x + 1.0;
  float i = c.x - span.x;
  float u = i / max(n - 1.0, 1.0);
  // Twin masts above the apex at the right edge.
  float mastTop = hkTop(HK_WATER + ROOF + 0.05);
  if ((c.x == span.y || c.x == span.y - 2.0) && c.y <= mastTop && c.y > hkTop(HK_WATER + ROOF - 0.01)) {
    float blink = smoothstep(0.0, 0.1, fract(hkT / 1.9)) * smoothstep(0.5, 0.15, fract(hkT / 1.9));
    if (c.y == mastTop && c.x == span.y) {
      return vec4(1.0, 0.25, 0.2, 0.45 + 0.55 * blink);
    }
    return vec4(0.85, 0.88, 0.96, 0.75);
  }
  if (c.x < span.x || c.x > span.y) {
    return vec4(-1.0);
  }
  // Three slanted roofs, each rising to the right, each higher.
  float top;
  if (u < 0.34) {
    top = mix(0.56, 0.66, u / 0.34);
  } else if (u < 0.67) {
    top = mix(0.76, 0.86, (u - 0.34) / 0.33);
  } else {
    top = mix(0.9, 1.0, (u - 0.67) / 0.33);
  }
  float topRow = hkTop(HK_WATER + ROOF * top);
  if (c.y > topRow) {
    return vec4(-1.0);
  }
  vec4 line = vec4(0.94, 0.96, 1.0, 0.92);
  // Edges, roof lines and the joints between shafts are lit.
  if (c.x == span.x || c.x == span.y || c.y == topRow) {
    return line;
  }
  // Square modules, as many rows tall as the tower is wide.
  float rows = max(2.0, floor(n * hkW / hkH + 0.5));
  float j = mod(c.y - hkShore, rows);
  if (j < 0.5) {
    return line;
  }
  // Each diagonal is one sample thick: one row per column where the
  // module is wider than tall, one column per row where it is taller.
  float a = floor(i * (rows - 1.0) / max(n - 1.0, 1.0) + 0.5);
  float b = floor(j * (n - 1.0) / max(rows - 1.0, 1.0) + 0.5);
  float ia = n - 1.0 - i;
  float aa = floor(ia * (rows - 1.0) / max(n - 1.0, 1.0) + 0.5);
  if (j == a || i == b || j == aa || ia == b) {
    return line;
  }
  return vec4(0.2, 0.28, 0.5, 0.26);
}

// Two IFC: the tallest tower, with vertical strips of light, two small
// setbacks near the top and an open crown of fins, taller at the corners.
vec4 hkIfc(vec2 c, float xc) {
  const float H = 0.37;
  float y = (c.y + 0.5) * hkH;
  float h = (y - HK_WATER) / H;
  float hw = h < 0.74 ? 0.028 : (h < 0.83 ? 0.024 : 0.02);
  vec2 span = hkCols(xc - hw, xc + hw);
  if (c.x < span.x || c.x > span.y || h < 0.0) {
    return vec4(-1.0);
  }
  float n = span.y - span.x + 1.0;
  float u = (c.x - span.x) / max(n - 1.0, 1.0);
  float bodyRow = hkTop(HK_WATER + H * 0.88);
  if (c.y > bodyRow) {
    // Fins every other column, rising toward the corners.
    float finTop = hkTop(HK_WATER + H * (0.93 + 0.07 * abs(u - 0.5) * 2.0));
    if (c.y <= finTop && mod(c.x - span.x, 2.0) < 0.5) {
      return vec4(0.96, 0.97, 1.0, 0.9);
    }
    return vec4(-1.0);
  }
  // A setback ledge is a sample whose neighbour above is narrower.
  float hA = (y + hkH - HK_WATER) / H;
  float hwA = hA < 0.74 ? 0.028 : (hA < 0.83 ? 0.024 : 0.02);
  vec2 spanA = hkCols(xc - hwA, xc + hwA);
  if (c.y == bodyRow || c.x < spanA.x || c.x > spanA.y) {
    return vec4(0.96, 0.97, 1.0, 0.9);
  }
  float band = mod(floor(c.x / hkGrid.x), 2.0);
  return band > 0.5 ? vec4(0.82, 0.88, 1.0, 0.8) : vec4(0.36, 0.44, 0.66, hkFill(0.36));
}

// Central Plaza: a triangular tower with lit floor bands, a glowing
// pyramid top that slowly changes colour, and a mast.
vec4 hkCentralPlaza(vec2 c, float xc) {
  const float ROOF = 0.27;
  const float HW = 0.026;
  vec2 span = hkCols(xc - HW, xc + HW);
  vec2 mast = hkCols(xc, xc);
  float roofRow = hkTop(HK_WATER + ROOF);
  if (c.x == mast.x && c.y > roofRow && c.y <= hkTop(HK_WATER + ROOF + 0.07)) {
    return vec4(0.85, 0.88, 0.96, 0.7);
  }
  if (c.x < span.x || c.x > span.y) {
    return vec4(-1.0);
  }
  float n = span.y - span.x + 1.0;
  float u = (c.x - span.x) / max(n - 1.0, 1.0);
  vec3 glow = mix(vec3(1.0, 0.86, 0.6), hkWash(0.7), 0.6 * hkLights);
  float pyramidRow = hkTop(HK_WATER + ROOF + 0.035 * (1.0 - abs(u - 0.5) * 2.0));
  if (c.y > roofRow) {
    return c.y <= pyramidRow ? vec4(glow, 0.9) : vec4(-1.0);
  }
  if (c.y == roofRow || c.x == span.x || c.x == span.y) {
    return vec4(glow * 0.9, 0.7);
  }
  // A band of light along every other floor of cells.
  float g = floor((c.y - hkShore) / hkGrid.y);
  if (mod(g, 2.0) > 0.5 && mod(c.y - hkShore, hkGrid.y) < 0.5) {
    return vec4(glow * 0.85, 0.66);
  }
  vec2 id;
  if (hkWindow(c, span, roofRow, id) && hkLit(id + 811.0, 0.55) > 0.5) {
    return vec4(1.0, 0.86, 0.6, 0.9);
  }
  return vec4(0.3, 0.3, 0.42, hkFill(0.28));
}

// A row of towers from hashed slots with no gaps between them: the dense
// wall along the waterfront, or, with climb > 0, the towers of the
// Mid-Levels stepping up the slope of the Peak.
vec4 hkRow(vec2 c, float peakX, float slotW, float lo, float hi, float seedBase, float rate, float climb) {
  float x = hkX(c.x);
  float slot = floor(x / slotW);
  float h1 = hash21(vec2(slot, seedBase));
  float h2 = hash21(vec2(slot, seedBase + 3.7));
  float h3 = hash21(vec2(slot, seedBase + 9.1));
  float xc = (slot + 0.5 + (h2 - 0.5) * 0.15) * slotW;
  float hw = slotW * mix(0.36, 0.48, h3);
  float height = mix(lo, hi, h1 * h1);
  if (climb > 0.5) {
    // Up the hill the towers stand on higher ground, so their roofs
    // follow the ridge down from below the crest.
    height = min(max(height, (hkRidge(xc, peakX) - HK_WATER - 0.2) * mix(1.3, 2.0, h1)), 0.24);
  }
  float crown = step(0.93, h3) * climb;
  return hkTower(c, xc, hw, height, slot + seedBase, rate, crown);
}

// Everything above the waterline, front layer first.
vec4 hkLand(vec2 c, vec4 at) {
  vec4 hit = hkIfc(c, at.z);
  if (hit.a >= 0.0) return hit;
  hit = hkBankOfChina(c, at.y);
  if (hit.a >= 0.0) return hit;
  hit = hkCentralPlaza(c, at.x);
  if (hit.a >= 0.0) return hit;
  hit = hkRow(c, at.w, 0.034, 0.04, 0.12, 13.0, 0.6, 0.0);
  if (hit.a >= 0.0) return hit;
  hit = hkRow(c, at.w, 0.042, 0.09, 0.15, 29.0, 0.5, 1.0);
  if (hit.a >= 0.0) return hit;
  return hkPeak(c, at.w);
}

// City light hides most stars; a few of the brightest show.
vec4 hkSky(vec2 c) {
  vec2 q = vec2(hkX(c.x), (c.y + 0.5) * hkH);
  const float LATTICE = 0.05;
  vec2 g = floor(q / LATTICE);
  float h = hash21(g + 5.3);
  if (h > 0.93 && q.y > 0.7) {
    vec2 star = (g + vec2(hash21(g + 7.1), hash21(g + 1.9))) * LATTICE;
    if (abs(q.x - star.x) < hkW * 0.5 && abs(q.y - star.y) < hkH * 0.5) {
      float twinkle = 0.5 + 0.5 * sin(hkT * (0.4 + h) + h * 40.0);
      return vec4(0.86, 0.9, 1.0, (h > 0.99 ? 0.6 : 0.22) + 0.06 * twinkle);
    }
  }
  return vec4(0.6, 0.66, 0.86, 0.0);
}

// The Star Ferry: a green hull under a white upper deck with a row of
// lit windows, crossing the harbour once every two minutes and a half.
vec4 hkFerry(vec2 c, float aspect) {
  float span = 0.5 * aspect + 0.1;
  float x = mix(span, -span, fract(hkT / 150.0 + 0.62));
  vec2 hull = hkCols(x - 0.04, x + 0.04);
  float base = hkShore - floor(0.07 / hkH);
  float r = c.y - base;
  if (c.x < hull.x || c.x > hull.y || r < 0.0) {
    return vec4(-1.0);
  }
  float i = c.x - hull.x;
  float n = hull.y - hull.x;
  float deck = max(1.0, floor(0.016 / hkH));
  if (r < deck) {
    return vec4(0.2, 0.62, 0.4, 0.7);
  }
  if (r < deck * 2.0 && i >= 1.0 && i <= n - 1.0) {
    return mod(i, 2.0) > 0.5 ? vec4(1.0, 0.9, 0.66, 0.92) : vec4(0.92, 0.94, 0.96, 0.62);
  }
  if (r < deck * 3.0 && i >= 3.0 && i <= n - 3.0) {
    return vec4(0.92, 0.94, 0.96, 0.66);
  }
  return vec4(-1.0);
}

// The harbour mirrors the land row for row, shifted a whole sample or
// two per row as the surface moves, and broken into short dashes.
vec4 hkWater(vec2 c, vec4 at, float aspect) {
  if (hkFerryOn > 0.5) {
    vec4 boat = hkFerry(c, aspect);
    if (boat.a >= 0.0) return boat;
  }
  float depth = hkShore - c.y;
  float wave = floor(sin(c.y * 1.7 + hkT * 0.3) * 1.4 + 0.5);
  vec2 m = vec2(c.x + wave, hkShore + depth - 1.0);
  vec4 land = hkLand(m, at);
  float dash = floor((c.x + wave * 2.0 + c.y * 3.0) / 4.0);
  // Deeper rows keep fewer dashes rather than dimmer ones, so the
  // reflection fades out without dropping under the dot threshold.
  float fade = exp(-depth * hkH * 3.0);
  float keep = step(0.4 + 0.5 * (1.0 - fade), hash21(vec2(dash, c.y) + floor(hkT * 0.15 + hash21(vec2(c.y, 2.0)) * 4.0)));
  vec4 hit = vec4(0.4, 0.5, 0.78, 0.0);
  if (land.a >= 0.0) {
    // Where only bright dots show, only the lights reflect.
    float mirror = mix(land.a * 0.6, step(0.6, land.a) * 0.6, hkSolid);
    hit = vec4(land.rgb * 0.8, mirror * keep);
  }
  return hit;
}

vec2 hkCacheUv = vec2(-1.0);
float hkCacheT = -1.0;
vec4 hkCacheValue = vec4(0.0);

vec4 hkScene(vec2 uv, vec2 res, float t) {
  if (uv == hkCacheUv && t == hkCacheT) {
    return hkCacheValue;
  }
  float aspect = res.x / res.y;
  hkW = aspect / max(ascii_samples.x, 1.0);
  hkH = 1.0 / max(ascii_samples.y, 1.0);
  hkHalf = 0.5 * ascii_samples.x;
  hkT = t;
  hkShore = floor(HK_WATER / hkH + 0.5);
  vec2 c = floor(uv * ascii_samples);
  // From the left: Central Plaza, the Bank of China Tower, Two IFC, with
  // the Peak behind Central. Narrow screens pull them together.
  float span = clamp(0.5 * aspect, 0.42, 1.1);
  vec4 at = vec4(-0.5 * span, -0.05 * span, 0.3 * span, 0.15 * span);

  vec4 hit;
  if (c.y >= hkShore) {
    hit = hkLand(c, at);
    if (hit.a < 0.0) {
      hit = hkSky(c);
    }
  } else {
    hit = hkWater(c, at, aspect);
  }

  float tone = clamp(hit.a, 0.0, 1.0);
  // Near-empty tones go to paper so the open sky stays clean. Braille and
  // quadrants draw a dot or nothing, so there intensity dims colour only;
  // scaling tone would drop whole facades under the dot threshold.
  tone = tone < 0.05 ? 0.0 : tone * mix(sqrt(hkIntensity), 1.0, hkSolid);
  hkCacheUv = uv;
  hkCacheT = t;
  hkCacheValue = vec4(hit.rgb * hkIntensity, tone);
  return hkCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return hkScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return hkScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its deep blue night behind
// them in both themes; mono and palette keep the theme's paper, or the
// phosphor's.
const NIGHT = "#030818";
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
        "linear-gradient(to bottom, #030818 0%, #050b22 76%, #0a1430 78%, #030818 100%)",
    }}
  />
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface HongKongProps extends AsciiSceneProps {
  /** How bright the scene is, from 0 (blank) to 1, so text on top stays readable. Default 1. */
  intensity?: number;
  /** How strongly the few colour-changing tops (Central Plaza's pyramid and some rooftops) show their colours, from 0 (plain white) to 1. Default 1. */
  lights?: number;
  /** The Star Ferry crossing the harbour. Default `true`. */
  ferry?: boolean;
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
 * Hong Kong. Victoria Harbour at night, seen from Kowloon: a dense wall
 * of lit towers climbing toward the dark ridge of Victoria Peak, with
 * Central Plaza, the X-braced Bank of China Tower and Two IFC standing
 * above it, calm reflections and one slow Star Ferry. Only the lights
 * move. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const HongKong = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 2,
  intensity = 1,
  lights = 1,
  ferry = true,
  fallback = FALLBACK,
  // Accepted so galleries can pass it to every scene; this one has no
  // pointer response, so the prop does nothing.
  interactive: _interactive,
  ...props
}: HongKongProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const { kind, grid } = resolveCharset(charset, chars);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        hkFerryOn: ferry ? 1 : 0,
        hkGrid: [grid[0], grid[1]],
        hkIntensity: clamp01(intensity),
        hkLights: clamp01(lights),
        hkSolid: kind === "braille" || kind === "quadrants" ? 1 : 0,
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
