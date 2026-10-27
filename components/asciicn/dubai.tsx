"use client";

import type { ReactNode } from "react";

import { resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Dubai at night from the water. Everything is placed on the engine's
// sample grid: a building covers whole sample columns and rows, so its
// edges are hard and its windows sit on a clean grid in every charset.
// Each layer returns colour and tone, with a negative tone for "missed",
// and the first layer that hits from the front wins. Open sky is empty;
// only a few stars sit in it.
const SCENE = `
const float DUBAI_WATER = 0.2;
const float DUBAI_BURJ_H = 0.74;

// Sample size in box units, half the sample columns, and the time.
float dubaiW;
float dubaiH;
float dubaiHalf;
float dubaiT;
float dubaiShore;

// The first and last sample columns whose centres fall inside [x0, x1].
// A span is never narrower than one column, so a spire never vanishes.
vec2 dubaiCols(float x0, float x1) {
  float l = ceil(x0 / dubaiW + dubaiHalf - 0.5);
  float r = floor(x1 / dubaiW + dubaiHalf - 0.5);
  return vec2(l, max(l, r));
}

// The last sample row whose centre is at or below y.
float dubaiTop(float y) {
  return floor(y / dubaiH - 0.5);
}

// Braille and quadrants light a dot only above half tone, so there the
// facades are lifted over it and read as solid walls with dark windows.
float dubaiFill(float tone) {
  return mix(tone, max(tone, 0.56), dubaiSolid);
}

float dubaiX(float col) {
  return (col + 0.5 - dubaiHalf) * dubaiW;
}

// Whether a window is lit. Most keep their state; one in twelve switches
// now and then, each on its own slow clock, so the city changes a light
// or two every few seconds.
float dubaiLit(vec2 id, float rate) {
  float h = hash21(id);
  float h2 = hash21(id + 17.3);
  if (h2 < 0.08) {
    float epoch = floor(dubaiT / (18.0 + 300.0 * h2) + h * 5.0);
    return step(hash21(id + epoch * 3.1), rate);
  }
  return step(h, rate);
}

vec3 dubaiTint(float h) {
  if (h < 0.55) return vec3(1.0, 0.8, 0.5);
  if (h < 0.85) return vec3(0.96, 0.92, 0.84);
  return vec3(0.62, 0.8, 1.0);
}

// One tower on the shore: a dim facade with a grid of windows, cut to its
// crown. kind 0 is a flat roof, 1 a wedge rising to the right, 2 a wedge
// rising to the left, 3 a stepped crown, 4 a flat roof with a mast.
vec4 dubaiTower(vec2 c, float xc, float hw, float height, float kind, float seed, float rate) {
  vec2 span = dubaiCols(xc - hw, xc + hw);
  if (c.x < span.x || c.x > span.y) {
    return vec4(-1.0);
  }
  float n = span.y - span.x + 1.0;
  float lc = c.x - span.x;
  float u = n > 1.0 ? lc / (n - 1.0) : 0.5;
  float top = DUBAI_WATER + height;
  float crown = 0.0;
  if (kind > 0.5 && kind < 1.5) {
    crown = 0.05 * u;
  } else if (kind > 1.5 && kind < 2.5) {
    crown = 0.05 * (1.0 - u);
  } else if (kind > 2.5 && kind < 3.5) {
    float inset = abs(u - 0.5);
    crown = inset < 0.18 ? 0.03 : (inset < 0.34 ? 0.015 : 0.0);
  } else if (kind > 3.5 && abs(u - 0.5) < 0.5 / n + 0.01) {
    crown = 0.035;
  }
  float topRow = dubaiTop(top + crown);
  if (c.y > topRow) {
    return vec4(-1.0);
  }
  vec3 facade = vec3(0.3, 0.36, 0.56);
  // The roof line and the crown catch the light.
  if (c.y == topRow || (crown > 0.0 && c.y > dubaiTop(top))) {
    float rim = c.y == topRow ? 0.62 : dubaiFill(0.4);
    return vec4(vec3(0.72, 0.78, 0.92), rim);
  }
  // Windows fill whole glyph cells, every other cell across and up, so
  // they stay a clean grid however many samples a cell holds.
  vec2 g = floor(c / dubaiGrid);
  float left = ceil(span.x / dubaiGrid.x);
  float right = floor((span.y + 1.0) / dubaiGrid.x) - 1.0;
  float base = ceil(dubaiShore / dubaiGrid.y);
  float roof = floor(dubaiTop(top) / dubaiGrid.y) - 1.0;
  float wx = g.x - left;
  float wy = g.y - base;
  if (g.x <= right - 1.0 && g.y <= roof && wy >= 0.0 && mod(wx, 2.0) > 0.5 && mod(wy, 2.0) > 0.5) {
    vec2 id = vec2(seed * 61.0 + wx, wy);
    if (dubaiLit(id, rate) > 0.5) {
      return vec4(dubaiTint(hash21(vec2(seed, floor(wx / 4.0)))), 0.92);
    }
    return vec4(facade * 0.8, 0.2);
  }
  return vec4(facade, dubaiFill(0.28));
}

// A row of towers from hashed slots. envelope() decides how tall each
// slot may be at its position; away from the centres the row thins out.
vec4 dubaiRow(vec2 c, float burjX, float marinaX, float slotW, float maxH, float seedBase, float rate, float crowns) {
  float x = dubaiX(c.x);
  float slot = floor(x / slotW);
  float h1 = hash21(vec2(slot, seedBase));
  float h2 = hash21(vec2(slot, seedBase + 3.7));
  float h3 = hash21(vec2(slot, seedBase + 9.1));
  float xc = (slot + 0.5 + (h2 - 0.5) * 0.2) * slotW;
  float hw = slotW * mix(0.22, 0.4, h3);
  // Downtown rises around the Burj, the Marina further along the shore.
  float down = exp(-pow((xc - burjX) / 0.3, 2.0));
  float marina = exp(-pow((xc - marinaX) / 0.2, 2.0));
  float envelope = max(max(down, marina * 0.9), 0.32);
  if (h1 > envelope + 0.25) {
    return vec4(-1.0);
  }
  float height = maxH * mix(0.35, 1.0, h1 * h1) * envelope;
  // Wedge crowns are left to the Emirates Towers.
  float kind = h2 < 0.45 ? 0.0 : (h2 < 0.8 ? 3.0 : 4.0);
  kind *= crowns;
  return dubaiTower(c, xc, hw, height, kind, slot + seedBase, rate);
}

// Half widths of the Burj Khalifa at a height h (0 at the water, 1 at
// the tip of the spire): the left, right and front wings, and the core.
// The Y-plan tower has three wings that step back at their own heights,
// a third of a tier apart, so seen from the front the setbacks alternate
// sides as they climb.
float dubaiWing(float h, float phase) {
  const float BODY = 0.68;
  const float TIERS = 7.0;
  if (h >= BODY) {
    return 0.0;
  }
  float k = floor(h / BODY * TIERS + phase);
  float u = clamp((k + 1.0 - phase) / TIERS, 0.0, 1.0);
  return 0.078 * pow(1.0 - u, 0.8);
}

vec4 dubaiBurjHalf(float h) {
  float core = h < 0.73 ? 0.016 : (h < 0.79 ? 0.011 : 0.0);
  if (h >= 0.79) {
    // The spire: a needle that tapers to a single column.
    float s = (h - 0.79) / 0.21;
    float needle = 0.007 * (1.0 - s);
    return vec4(needle, needle, needle, needle);
  }
  float left = max(core, dubaiWing(h, 0.0));
  float right = max(core, dubaiWing(h, 0.34));
  float front = max(core, 0.42 * dubaiWing(h, 0.67));
  return vec4(left, right, front, core);
}

vec4 dubaiBurj(vec2 c, float xc) {
  float y = (c.y + 0.5) * dubaiH;
  float h = (y - DUBAI_WATER) / DUBAI_BURJ_H;
  float tipRow = dubaiTop(DUBAI_WATER + DUBAI_BURJ_H);
  if (h < 0.0 || c.y > tipRow) {
    return vec4(-1.0);
  }
  vec4 e = dubaiBurjHalf(h);
  vec2 body = dubaiCols(xc - e.x, xc + e.y);
  if (c.x < body.x || c.x > body.y) {
    return vec4(-1.0);
  }
  // The aircraft beacon on the tip: one slow pulse every 1.8 seconds.
  if (c.y == tipRow) {
    float p = fract(dubaiT / 1.8);
    float pulse = smoothstep(0.0, 0.1, p) * smoothstep(0.5, 0.15, p);
    return vec4(mix(vec3(0.7, 0.2, 0.2), vec3(1.0, 0.25, 0.2), pulse), 0.45 + 0.55 * pulse);
  }
  if (h >= 0.79) {
    return vec4(0.82, 0.88, 1.0, 0.74);
  }
  vec2 front = dubaiCols(xc - e.z, xc + e.z);
  // A setback ledge is a sample whose neighbour above is open air.
  vec4 above = dubaiBurjHalf(h + dubaiH / DUBAI_BURJ_H);
  vec2 bodyAbove = dubaiCols(xc - above.x, xc + above.y);
  vec2 frontAbove = dubaiCols(xc - above.z, xc + above.z);
  bool inFront = c.x >= front.x && c.x <= front.y;
  bool ledge = c.x < bodyAbove.x || c.x > bodyAbove.y
    || (inFront && (c.x < frontAbove.x || c.x > frontAbove.y) && c.y < tipRow - 1.0);
  if (ledge) {
    return vec4(1.0, 0.9, 0.74, 0.9);
  }
  // Vertical strips of light run up every face, one cell on, one off.
  float band = mod(floor(c.x / dubaiGrid.x), 2.0);
  if (inFront) {
    return band > 0.5 ? vec4(0.9, 0.94, 1.0, 0.84) : vec4(0.56, 0.64, 0.86, dubaiFill(0.5));
  }
  bool outline = c.x == body.x || c.x == body.y;
  if (c.x < front.x) {
    // The left wing turns away from us and sits darker.
    return band > 0.5 || outline ? vec4(0.62, 0.7, 0.9, 0.58) : vec4(0.36, 0.42, 0.62, dubaiFill(0.32));
  }
  return band > 0.5 || outline ? vec4(0.74, 0.82, 0.98, 0.68) : vec4(0.42, 0.5, 0.72, dubaiFill(0.38));
}

// The Emirates Towers: two triangular towers whose wedge crowns slope
// toward each other, the office tower a little taller with a short mast.
vec4 dubaiEmirates(vec2 c, float x0) {
  vec4 hit = dubaiTower(c, x0, 0.02, 0.27, 1.0, 301.0, 0.4);
  if (hit.a >= 0.0) return hit;
  vec2 mast = dubaiCols(x0 + 0.02 - 0.001, x0 + 0.02);
  if (c.x == mast.y && c.y > dubaiTop(DUBAI_WATER + 0.32) && c.y <= dubaiTop(DUBAI_WATER + 0.35)) {
    return vec4(0.8, 0.84, 0.95, 0.6);
  }
  return dubaiTower(c, x0 + 0.06, 0.018, 0.23, 2.0, 307.0, 0.45);
}

// Dubai Marina: a tight cluster of slim towers further down the shore.
vec4 dubaiMarina(vec2 c, float x0) {
  for (int i = 0; i < 7; i++) {
    float fi = float(i);
    float h1 = hash21(vec2(fi, 41.0));
    float h2 = hash21(vec2(fi, 43.0));
    float xc = x0 + (fi - 3.0) * 0.033 + (h2 - 0.5) * 0.008;
    float height = 0.16 + 0.12 * h1 * (1.0 - abs(fi - 3.0) * 0.12);
    float kind = mod(fi, 3.0) < 0.5 ? 3.0 : (fi == 1.0 || fi == 5.0 ? 4.0 : 0.0);
    vec4 hit = dubaiTower(c, xc, 0.011 + 0.004 * h2, height, kind, 401.0 + fi, 0.5);
    if (hit.a >= 0.0) return hit;
  }
  return vec4(-1.0);
}

// The Burj Al Arab on its island: a straight mast on the land side, a
// sail that bellies out toward the sea and meets the mast at the top, a
// helipad near the crown. Its floodlights drift slowly through colours.
vec4 dubaiSail(vec2 c, float mastX) {
  const float HEIGHT = 0.2;
  float y = (c.y + 0.5) * dubaiH;
  float s = (y - DUBAI_WATER) / HEIGHT;
  if (s < -0.06 || s > 1.16) {
    return vec4(-1.0);
  }
  float x = dubaiX(c.x);
  float hue = dubaiT * 0.05 + 0.3;
  vec3 wash = mix(vec3(0.95, 0.94, 1.0), toSrgb(oklch(0.8, 0.09, hue)), 0.4);
  // The island, a low strip at the waterline.
  if (s < 0.0) {
    vec2 isle = dubaiCols(mastX - 0.014, mastX + 0.08);
    return c.x >= isle.x && c.x <= isle.y ? vec4(0.5, 0.48, 0.6, 0.36) : vec4(-1.0);
  }
  vec2 mast = dubaiCols(mastX - 0.004, mastX + 0.004);
  bool onMast = c.x >= mast.x && c.x <= mast.y;
  if (onMast) {
    return vec4(0.96, 0.96, 1.0, s > 1.0 ? 0.7 : 0.9);
  }
  if (s > 1.0) {
    return vec4(-1.0);
  }
  // Widest at the foot, sweeping up in one curve to the top of the mast.
  float belly = 0.066 * pow(1.0 - s, 0.75) * (1.0 + 0.6 * s);
  vec2 sail = dubaiCols(mastX, mastX + belly);
  // The helipad juts out on the sea side just below the crown.
  float padRow = dubaiTop(DUBAI_WATER + HEIGHT * 0.8);
  vec2 pad = dubaiCols(mastX + belly, mastX + belly + 0.024);
  if (c.y == padRow && c.x > sail.y && c.x <= pad.y) {
    return vec4(0.96, 0.96, 1.0, 0.8);
  }
  if (c.x <= mast.y || c.x > sail.y) {
    return vec4(-1.0);
  }
  // The outer edge is bright; ribs cross the fabric every other row.
  if (c.x == sail.y) {
    return vec4(mix(vec3(1.0), wash, 0.4), 0.88);
  }
  float rib = mod(c.y - dubaiShore, 2.0);
  return rib > 0.5 ? vec4(wash, 0.6) : vec4(wash * 0.75, dubaiFill(0.42));
}

// A low strip of distant city along the far shore, with a promenade of
// lamps along the water's edge.
vec4 dubaiFar(vec2 c) {
  float lr = c.y - dubaiShore;
  if (lr == 0.0) {
    return mod(c.x, 4.0) < 0.5 ? vec4(1.0, 0.78, 0.48, 0.62) : vec4(0.4, 0.4, 0.55, 0.22);
  }
  float block = floor(c.x / 5.0);
  float tall = 1.0 + floor(hash21(vec2(block, 5.0)) * 3.0);
  if (lr <= tall) {
    float on = step(0.82, hash21(c + 9.0));
    return on > 0.5 ? vec4(1.0, 0.82, 0.55, 0.6) : vec4(0.3, 0.32, 0.48, 0.2);
  }
  return vec4(-1.0);
}

// Everything above the waterline, front layer first.
vec4 dubaiLand(vec2 c, vec4 at) {
  vec4 hit = dubaiSail(c, at.w);
  if (hit.a >= 0.0) return hit;
  hit = dubaiRow(c, at.x, at.z, 0.05, 0.06, 13.0, 0.45, 0.0);
  if (hit.a >= 0.0) return hit;
  hit = dubaiEmirates(c, at.y);
  if (hit.a >= 0.0) return hit;
  hit = dubaiMarina(c, at.z);
  if (hit.a >= 0.0) return hit;
  hit = dubaiRow(c, at.x, at.z, 0.07, 0.15, 29.0, 0.35, 1.0);
  if (hit.a >= 0.0) return hit;
  hit = dubaiBurj(c, at.x);
  if (hit.a >= 0.0) return hit;
  return dubaiFar(c);
}

// A sparse field of stars, one candidate per lattice cell in box units,
// so the count doesn't change with the charset.
vec4 dubaiSky(vec2 c) {
  vec2 q = vec2(dubaiX(c.x), (c.y + 0.5) * dubaiH);
  const float LATTICE = 0.035;
  vec2 g = floor(q / LATTICE);
  float h = hash21(g + 3.3);
  if (h > 0.9 && q.y > DUBAI_WATER + 0.22) {
    vec2 star = (g + vec2(hash21(g + 7.1), hash21(g + 1.9))) * LATTICE;
    if (abs(q.x - star.x) < dubaiW * 0.5 && abs(q.y - star.y) < dubaiH * 0.5) {
      float twinkle = 0.5 + 0.5 * sin(dubaiT * (0.4 + h) + h * 40.0);
      float bright = h > 0.985 ? 0.6 : 0.22;
      return vec4(0.86, 0.9, 1.0, bright + 0.06 * twinkle);
    }
  }
  return vec4(0.6, 0.66, 0.86, 0.0);
}

// The water mirrors the land row for row, shifted a whole sample or two
// per row as the surface moves, and broken into short dashes.
vec4 dubaiWater(vec2 c, vec4 at, float aspect) {
  float depth = dubaiShore - c.y;
  float wave = floor(sin(c.y * 1.7 + dubaiT * 0.3) * 1.4 + 0.5);
  vec2 m = vec2(c.x + wave, dubaiShore + depth - 1.0);
  vec4 land = dubaiLand(m, at);
  float dash = floor((c.x + wave * 2.0 + c.y * 3.0) / 4.0);
  // Deeper rows keep fewer dashes rather than dimmer ones, so the
  // reflection fades out without dropping under the dot threshold.
  float fade = exp(-depth * dubaiH * 3.0);
  float keep = step(0.25 + 0.6 * (1.0 - fade), hash21(vec2(dash, c.y) + floor(dubaiT * 0.15 + hash21(vec2(c.y, 2.0)) * 4.0)));
  vec4 hit = vec4(0.4, 0.5, 0.78, 0.0);
  if (land.a >= 0.0) {
    // Where only bright dots show, only the lights reflect.
    float mirror = mix(land.a * 0.6, step(0.6, land.a) * 0.6, dubaiSolid);
    hit = vec4(land.rgb * 0.8, mirror * keep);
  }
  // An abra crosses the creek every two minutes, one warm lamp aboard.
  float span = 0.5 * aspect + 0.1;
  float boatX = mix(-span, span, fract(dubaiT / 120.0 + 0.35));
  float boatRow = dubaiShore - floor(0.06 / dubaiH);
  vec2 hull = dubaiCols(boatX - 0.014, boatX + 0.014);
  if (c.y == boatRow && c.x >= hull.x && c.x <= hull.y) {
    hit = c.x == hull.y ? vec4(1.0, 0.82, 0.5, 0.86) : vec4(0.5, 0.48, 0.6, 0.4);
  }
  return hit;
}

vec2 dubaiCacheUv = vec2(-1.0);
float dubaiCacheT = -1.0;
vec4 dubaiCacheValue = vec4(0.0);

vec4 dubaiScene(vec2 uv, vec2 res, float t) {
  if (uv == dubaiCacheUv && t == dubaiCacheT) {
    return dubaiCacheValue;
  }
  float aspect = res.x / res.y;
  dubaiW = aspect / max(ascii_samples.x, 1.0);
  dubaiH = 1.0 / max(ascii_samples.y, 1.0);
  dubaiHalf = 0.5 * ascii_samples.x;
  dubaiT = t;
  dubaiShore = floor(DUBAI_WATER / dubaiH + 0.5);
  vec2 c = floor(uv * ascii_samples);
  // The Burj Khalifa holds the centre; the rest spread along the shore
  // and close in on narrow screens.
  float span = clamp(0.5 * aspect, 0.42, 1.1);
  vec4 at = vec4(0.0, -0.66 * span, 0.56 * span, min(0.86 * span - 0.03, 0.5 * aspect - 0.1));

  vec4 hit;
  if (c.y >= dubaiShore) {
    hit = dubaiLand(c, at);
    if (hit.a < 0.0) {
      hit = dubaiSky(c);
    }
  } else {
    hit = dubaiWater(c, at, aspect);
  }

  float tone = clamp(hit.a, 0.0, 1.0);
  // Near-empty tones go to paper so the open sky stays clean. Braille and
  // quadrants draw a dot or nothing, so there intensity dims colour only;
  // scaling tone would drop whole facades under the dot threshold.
  tone = tone < 0.05 ? 0.0 : tone * mix(sqrt(dubaiIntensity), 1.0, dubaiSolid);
  dubaiCacheUv = uv;
  dubaiCacheT = t;
  dubaiCacheValue = vec4(hit.rgb * dubaiIntensity, tone);
  return dubaiCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return dubaiScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return dubaiScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#04060f";
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
        "linear-gradient(to bottom, #04060f 0%, #070b1c 78%, #0b1228 80%, #04060f 100%)",
    }}
  />
);

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export interface DubaiProps extends AsciiSceneProps {
  /** Dims the whole scene so text on top stays readable, from 0 to 1. Default 1. */
  intensity?: number;
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
 * Dubai at night from the water. The Burj Khalifa holds the centre, its
 * setbacks stepping up in turn to a long spire with a slow red beacon;
 * the Emirates Towers, the Marina and the sail of the Burj Al Arab stand
 * lower along the shore, and the water carries broken reflections. Only
 * the lights move: a window now and then, the beacon, the stars, the
 * water and one boat. Decorative and full-bleed: size it with
 * `className`, usually `absolute inset-0`.
 */
export const Dubai = ({
  charset = "quadrants",
  chars,
  colorMode,
  phosphor,
  paper,
  cell = 9,
  stillTime = 2,
  intensity = 1,
  fallback = FALLBACK,
  // Accepted so galleries can pass it to every scene; this one has no
  // pointer response, so the prop does nothing.
  interactive: _interactive,
  ...props
}: DubaiProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const { kind, grid } = resolveCharset(charset, chars);
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        dubaiGrid: [grid[0], grid[1]],
        dubaiIntensity: clamp01(intensity),
        dubaiSolid: kind === "braille" || kind === "quadrants" ? 1 : 0,
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
