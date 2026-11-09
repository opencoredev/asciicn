"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The Golden Gate Bridge at blue hour, seen at an angle across the water:
// the north tower near on the left, the south tower far on the right, the
// deck and cable receding between them. The scene is painted per sample,
// far to near: the sky and the afterglow, the far shore and its lights, the
// Marin Headlands behind the near tower and the city's hills past the far
// one, the fog bank, the bridge, and below the horizon the bay, which
// mirrors all of it through slow ripples.
//
// Units are box heights: y runs from 0 at the bottom to 1 at the top and x
// is centred. Each column maps back to a point along the bridge through a
// one-dimensional perspective (sfU), and the towers, struts, cable, hangers
// and deck are laid out on whole samples there, so they come out as clean
// lines of dots at any size. Portrait boxes face the span square on instead,
// with a tower at each edge.
//
// Each layer returns a colour and a tone. The tone picks the dot size and is
// set per layer, not from brightness alone: the bridge draws big dots, the
// sky and water small ones, so the steel reads as a solid shape.
const SCENE = `
vec2 sfN = vec2(1.0);
float sfAsp = 1.0;
float sfCw = 0.01;
float sfRh = 0.01;
float sfT = 0.0;
float sfHz = 0.3;
float sfHzRow = 0.0;
float sfGlowX = 0.0;
float sfGlowGain = 1.0;

// The perspective: a point u along the bridge (towers at -1 near and +1
// far) lands at screen x = sfCx + sfA * u / (1 + sfK * u), and one tower
// height there is sfS / (1 + sfK * u) box heights. The camera sits sfCam
// tower heights above the water, so nearer water lines sit lower.
float sfS = 0.4;
float sfK = 0.0;
float sfA = 0.4;
float sfCx = 0.0;
float sfCam = 0.0;

// The tower being drawn, set by sfTowerAt: its centre column, half width
// and leg width in columns, and its rows from the waterline up (each part
// keeps at least one row, so the struts survive in a small box).
float sfTu = -1.0;
float sfTs = 0.4;
float sfTc = 0.0;
float sfTn = 4.0;
float sfTlw = 2.0;
float sfTbase = 0.0;
float sfTpier = 0.0;
float sfTdeck = 0.0;
float sfTs1a = 0.0;
float sfTs1b = 0.0;
float sfTs2a = 0.0;
float sfTs2b = 0.0;
float sfTs3a = 0.0;
float sfTs3b = 0.0;
float sfTs4a = 0.0;
float sfTs4b = 0.0;
float sfTtop = 0.0;
float sfTcap = 0.0;

// Set by sfAbove: whether the bridge covers the sample it just drew.
float sfCovered = 0.0;

// A stable random value for whole-sample inputs; hash21 tiles on integers.
float sfHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float sfX(float col) {
  return ((col + 0.5) / sfN.x - 0.5) * sfAsp;
}

float sfY(float row) {
  return (row + 0.5) / sfN.y;
}

float sfColOf(float x) {
  return floor((x / sfAsp + 0.5) * sfN.x);
}

float sfRowOf(float y) {
  return floor(y * sfN.y + 0.5);
}

// Screen x to the point along the bridge, and back.
float sfU(float x) {
  float d = x - sfCx;
  return d / max(sfA - sfK * d, 1e-3);
}

float sfXu(float u) {
  return sfCx + sfA * u / (1.0 + sfK * u);
}

float sfScale(float u) {
  return sfS / (1.0 + sfK * u);
}

float sfWater(float u) {
  return sfHz - sfCam * sfScale(u);
}

// Screen y of a height v (tower units) at u along the bridge.
float sfYu(float u, float v) {
  return sfWater(u) + v * sfScale(u);
}

// 0 at the near tower, 1 at the far one.
float sfFar(float u) {
  return clamp((u + 1.0) * 0.5, 0.0, 1.0) * step(0.001, sfK);
}

void sfSetup(vec2 res, float t) {
  sfN = ascii_samples;
  sfAsp = res.x / res.y;
  sfCw = sfAsp / sfN.x;
  sfRh = 1.0 / sfN.y;
  sfT = t;
  float tall = 1.0 - smoothstep(0.6, 1.3, sfAsp);
  // Wide boxes see the bridge at an angle: the north tower near on the
  // left, the south tower far on the right, the deck receding between.
  // Portrait boxes face the span square on, the towers at the left and
  // right edges with their tops near half height and the deck low, so a
  // centred headline sits between them. The switch is a step: a blend
  // would cut a tower at the edge.
  float portrait = step(sfAsp, 0.85);
  float w = max(sfAsp, 0.86);
  sfS = mix(mix(0.4, 0.35, tall), 0.325, portrait);
  float hz = mix(mix(0.4, 0.44, tall), 0.27 - 0.29 * sfS, portrait);
  sfHzRow = floor(hz * sfN.y + 0.5);
  sfHz = sfHzRow / sfN.y;
  sfK = 0.22 * (1.0 - portrait);
  // Above the deck, so the roadway is seen from slightly above and rises
  // toward the horizon as it recedes.
  sfCam = 0.55 * (1.0 - portrait);
  float halfEdge = floor(0.1 * sfS / sfCw + 0.5);
  float edge = sfAsp * 0.5 - (halfEdge + 1.5) * sfCw;
  sfA = mix(0.28 * w, edge, portrait);
  sfCx = 0.03 * w * (1.0 - portrait);
  sfGlowX = mix(-0.1 * min(sfAsp, 1.4), -0.12 * sfAsp, portrait);
  // On a phone the glow and its path on the water sit right under the
  // buttons, so they are held back there.
  sfGlowGain = mix(1.0, 0.45, portrait);
}

// Lays out tower u (-1 near, 1 far) for drawing.
void sfTowerAt(float u) {
  sfTu = u;
  sfTs = sfScale(u);
  float wl = sfWater(u);
  sfTc = sfColOf(sfXu(u));
  sfTn = max(2.0, floor(0.1 * sfTs / sfCw + 0.5));
  sfTlw = max(2.0, floor(0.052 * sfTs / sfCw + 0.5));
  sfTbase = sfRowOf(wl);
  sfTpier = max(sfRowOf(wl + 0.05 * sfTs), sfTbase + 1.0);
  sfTdeck = sfRowOf(wl + 0.29 * sfTs);
  sfTs1a = sfRowOf(wl + 0.47 * sfTs);
  sfTs1b = max(sfRowOf(wl + 0.51 * sfTs), sfTs1a + 1.0);
  sfTs2a = max(sfRowOf(wl + 0.64 * sfTs), sfTs1b + 2.0);
  sfTs2b = max(sfRowOf(wl + 0.675 * sfTs), sfTs2a + 1.0);
  sfTs3a = max(sfRowOf(wl + 0.78 * sfTs), sfTs2b + 2.0);
  sfTs3b = max(sfRowOf(wl + 0.81 * sfTs), sfTs3a + 1.0);
  sfTs4a = max(sfRowOf(wl + 0.9 * sfTs), sfTs3b + 2.0);
  sfTs4b = max(sfRowOf(wl + 0.945 * sfTs), sfTs4a + 1.0);
  sfTtop = max(sfRowOf(wl + 0.985 * sfTs), sfTs4b + 1.0);
  sfTcap = max(sfRowOf(wl + sfTs), sfTtop + 1.0);
}

// Tone for the atmosphere (sky, fog, land, water) from its brightness. The
// curve is steep: deep sky, fog shadow and far water fall to the smallest
// dots or none, mid tones to small ones, and only the glow and the lit fog
// reach the large dots the bridge is drawn in.
float sfTone(vec3 c) {
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  return 0.02 + 0.9 * pow(max(l, 0.0), 1.5);
}

// The afterglow: a broad warm halo a little left of centre, its bright core
// sitting on the fog just above the water.
float sfGlow(float x, float y) {
  vec2 g = vec2((x - sfGlowX) * 0.7, (y - sfHz - 0.06 * sfS) * 1.7);
  return exp(-dot(g, g) * 6.0);
}

float sfCore(float x, float y) {
  vec2 g = vec2((x - sfGlowX) * 1.0, (y - sfHz - 0.05 * sfS) * 2.2);
  return exp(-dot(g, g) * 150.0);
}

vec3 sfSky(float x, float y) {
  float h = clamp((y - sfHz) / (1.0 - sfHz), 0.0, 1.0);
  vec3 c = mix(vec3(0.98, 0.62, 0.42), vec3(0.84, 0.44, 0.48), smoothstep(0.0, 0.12, h));
  c = mix(c, vec3(0.44, 0.33, 0.58), smoothstep(0.08, 0.28, h));
  c = mix(c, vec3(0.2, 0.24, 0.52), smoothstep(0.22, 0.48, h));
  c = mix(c, vec3(0.1, 0.14, 0.36), smoothstep(0.45, 0.8, h));
  c = mix(c, vec3(0.07, 0.08, 0.2), smoothstep(0.78, 1.0, h));
  // Thin streaks of high cloud, their undersides lit pink by the afterglow.
  float band = smoothstep(0.06, 0.2, h) * (1.0 - 0.6 * smoothstep(0.45, 0.9, h));
  float streak = smoothstep(0.5, 0.78, fbm(vec2(x * 1.3 - sfT * 0.004, y * 10.0 + 3.0)));
  vec3 cloud = mix(vec3(0.95, 0.55, 0.55), vec3(0.42, 0.38, 0.62), smoothstep(0.1, 0.4, h));
  cloud = mix(cloud, vec3(0.17, 0.2, 0.42), smoothstep(0.4, 0.85, h));
  c = mix(c, cloud, streak * band * 0.6);
  c += vec3(1.0, 0.5, 0.26) * sfGlow(x, y) * 0.45 * sfGlowGain;
  c += vec3(1.0, 0.86, 0.62) * sfCore(x, y) * 0.9 * sfGlowGain;
  return c;
}

// How far a point lies beyond the near tower, toward the Marin side, in
// tower heights. The headlands and the fog over them follow it.
float sfMarin(float x) {
  return max(0.0, (sfXu(-1.0) + 0.06 * sfS - x) / sfS);
}

// The top of the fog bank as a height above the water, in tower units: low
// off the near tower, rising toward the far one until it buries the far
// deck in places, piled up against the headlands, lower off the city.
float sfFogTop(float x, float u) {
  float marin = 1.0 - exp(-sfMarin(x) * 3.0);
  float city = smoothstep(sfXu(1.0) + 0.05, sfXu(1.0) + 0.35, x);
  float far = sfK > 0.001 ? sfFar(u) : 0.15;
  return 0.16 + 0.17 * far - 0.1 * city + 0.3 * marin;
}

float sfFog(float x, float y, float amount) {
  if (amount <= 0.0) {
    return 0.0;
  }
  float u = clamp(sfU(x), -1.8, 1.8);
  float s = sfScale(u);
  // Rounded billows along the top, slowly rolling east.
  float roll = x * 3.0 - sfT * 0.03;
  float lumps = 1.0 - abs(snoise(vec2(roll, 3.1)));
  lumps = 0.65 * lumps + 0.35 * (1.0 - abs(snoise(vec2(roll * 2.3 + 5.0, 1.7))));
  float n2 = fbm(vec2(x * 5.0 - sfT * 0.05, y * 11.0 - 4.1));
  float top = sfFogTop(x, u) + (lumps - 0.6) * 0.24 + (n2 - 0.5) * 0.06;
  float wl = sfWater(u);
  float topY = mix(wl, wl + top * s, clamp(amount * 1.6, 0.0, 1.0));
  float d = 1.0 - smoothstep(topY - 0.07 * s, topY + 0.01 * s, y);
  // Wisps: denser in the lumps, thinner between.
  d *= 0.55 + 0.6 * smoothstep(0.3, 0.72, n2);
  return clamp(d * min(1.0, amount * 1.4), 0.0, 1.0);
}

// Fog is lit from above by the afterglow: warm white on its tops, blue grey
// underneath and in the folds.
vec3 sfFogColor(float x, float y) {
  float u = clamp(sfU(x), -1.8, 1.8);
  float wl = sfWater(u);
  float lift = smoothstep(wl, wl + (sfFogTop(x, u) + 0.06) * sfScale(u), y);
  float puff = fbm(vec2(x * 8.0 - sfT * 0.06, y * 16.0 + 2.0));
  vec3 c = mix(vec3(0.22, 0.24, 0.42), vec3(0.78, 0.74, 0.88), lift * lift);
  c *= 0.75 + 0.5 * puff;
  return c + (vec3(1.0, 0.55, 0.34) * sfGlow(x, y) * 0.45 + vec3(1.0, 0.8, 0.6) * sfCore(x, y) * 0.3) * sfGlowGain;
}

// Land: the Marin Headlands rising behind the near tower on the left, the
// low hills of the Presidio past the far tower, the far shore between.
vec4 sfLand(float col, float row, float x, float y) {
  float dm = sfMarin(x);
  float hm = sfHz + sfS * (0.05 + 0.62 * (1.0 - exp(-dm * 2.6)) + 0.12 * smoothstep(0.35, 0.8, dm));
  hm += (fbm(vec2(x * 5.0, 2.3)) - 0.5) * 0.12 * sfS * min(1.0, dm * 4.0);
  float ds = max(0.0, (x - sfXu(1.0) - 0.05) / sfS);
  float hs = sfHz + sfS * (0.03 + 0.16 * (1.0 - exp(-ds * 2.5)));
  hs += (fbm(vec2(x * 7.0, 8.1)) - 0.5) * 0.04 * sfS;
  float shore = sfHz + sfS * 0.03 * (0.5 + fbm(vec2(x * 4.0, 5.2)));
  float top = max(dm > 0.0 ? hm : (ds > 0.0 ? hs : shore), shore);
  if (y > top) {
    return vec4(0.0);
  }
  // A rim catching the afterglow along the ridge, dark below it.
  float below = (top - y) / sfRh;
  vec3 c = mix(vec3(0.9, 0.5, 0.5), vec3(0.24, 0.16, 0.3), smoothstep(0.5, 1.5, below));
  // Folds in the hillside, lit a little on the side facing the glow.
  float fold = fbm(vec2(x * 9.0, y * 6.0 + 1.3));
  c *= 0.7 + 0.6 * fold;
  // Deep shadow: the smallest dots, some cells empty, except on the rim.
  // The far shore between the hills sinks into the haze of the afterglow.
  float tone = 0.02 + 0.4 * dot(c, vec3(0.3, 0.55, 0.15));
  if (dm <= 0.0 && ds <= 0.0) {
    c = mix(c, sfSky(x, sfHz + 0.02 * sfS), 0.65);
    tone = sfTone(c) * 0.85;
  }
  // City lights over the hills past the far tower and along the far shore.
  float city = ds > 0.0 ? 0.3 : (dm > 0.0 ? 0.015 : 0.14);
  float h = sfHash(vec2(col, row) + 7.1);
  if (h < city) {
    float tw = 0.75 + 0.25 * sin(sfT * 0.7 + h * 90.0);
    c = mix(vec3(1.0, 0.72, 0.4), vec3(0.95, 0.9, 0.8), step(0.6, fract(h * 37.0))) * (0.6 + 0.4 * tw);
    tone = 0.45 + 0.25 * tw;
  }
  return vec4(c, tone);
}

// One tower, laid out by sfTowerAt. Rows: the pier, the legs and X bracing
// below the deck, four portal struts above it, then the stepped tops. The
// afterglow lights the faces that turn toward it warm orange, and the far
// side of each leg falls into deep rust; struts are lit on top, dark under.
vec4 sfTower(float col, float row, out float cover) {
  cover = 0.0;
  float dx = col - sfTc;
  float jx = abs(dx);
  float n0 = sfTn;
  if (row < sfTbase || row >= sfTcap || jx > n0 + 2.0) {
    return vec4(0.0);
  }
  float v = (sfY(row) - sfWater(sfTu)) / sfTs;
  float n = row >= sfTs2a ? n0 - 1.0 : n0;
  float glow = smoothstep(0.25, 1.0, v);
  vec3 lit = mix(vec3(0.95, 0.4, 0.17), vec3(1.0, 0.6, 0.28), glow);
  vec3 rust = mix(vec3(0.36, 0.08, 0.05), vec3(0.55, 0.16, 0.08), glow);
  float lw = sfTlw;
  // Position across a leg from the glow's side, 0 on the lit face.
  float toGlow = sign(sfGlowX - sfXu(sfTu));
  float legLeft = dx > 0.0 ? n - lw + 1.0 : -n;
  float across = (dx - legLeft + 0.5) / lw;
  across = toGlow > 0.0 ? 1.0 - across : across;
  vec3 legCol = across < 0.6 ? lit : rust;
  if (row < sfTpier) {
    if (jx <= n0 + 1.0) {
      cover = 1.0;
      return vec4(mix(vec3(0.48, 0.44, 0.5), vec3(0.24, 0.22, 0.3), step(0.0, dx * toGlow)), 0.62);
    }
  } else if (row < sfTdeck - 2.0) {
    // Below the deck: wider legs and a run of X bracing between them.
    float nb = n0 + 1.0;
    float inLeg = step(nb - lw + 1.0, jx) * step(jx, nb);
    if (inLeg > 0.5) {
      float l2 = dx > 0.0 ? nb - lw + 1.0 : -nb;
      float a2 = (dx - l2 + 0.5) / lw;
      a2 = toGlow > 0.0 ? 1.0 - a2 : a2;
      cover = 1.0;
      return vec4((a2 < 0.6 ? lit : rust) * 0.8, 0.85);
    }
    float inner = nb - lw;
    float panel = max(4.0, floor((sfTdeck - 2.0 - sfTpier) / 2.0));
    float f = fract((row - sfTpier) / panel);
    if (jx <= inner && abs(jx - floor(inner * abs(1.0 - 2.0 * f) + 0.5)) < 0.5) {
      cover = 1.0;
      return vec4(rust * 0.9, 0.5);
    }
  } else if (row <= sfTdeck) {
    // The deck passes through; drawn by sfBridge.
  } else if (row < sfTs4b) {
    bool strut = (row >= sfTs1a && row < sfTs1b) || (row >= sfTs2a && row < sfTs2b)
      || (row >= sfTs3a && row < sfTs3b) || row >= sfTs4a;
    float inLeg = step(n - lw + 1.0, jx) * step(jx, n);
    if (inLeg > 0.5) {
      cover = 1.0;
      return vec4(legCol, 1.0);
    }
    if (strut && jx <= n) {
      cover = 1.0;
      bool under = row == sfTs1a || row == sfTs2a || row == sfTs3a || row == sfTs4a;
      bool over = row == sfTs1b - 1.0 || row == sfTs2b - 1.0 || row == sfTs3b - 1.0;
      vec3 sc = under ? rust * 0.7 : (over ? lit * 0.9 : mix(lit, rust, 0.55));
      return vec4(sc, 0.9);
    }
  } else {
    // The stepped tops of the legs: full width, then the outer corner cut.
    float nn = row >= sfTtop ? n - 1.0 : n;
    if (jx >= n - lw + 1.0 && jx <= nn) {
      cover = 1.0;
      return vec4(across < 0.6 ? lit * 1.08 : rust * 1.2, 1.0);
    }
  }
  return vec4(0.0);
}

// The main cable's height (tower units) at u: a parabola from saddle to
// saddle that dips to just above the deck at mid-span, and the side spans
// sagging down to the anchorages. Negative where there is no cable.
float sfCableV(float u) {
  float au = abs(u);
  if (au <= 1.0) {
    return 0.31 + (0.945 - 0.31) * au * au;
  }
  if (au <= 1.42) {
    float f = (au - 1.0) / 0.42;
    return mix(0.945, 0.29, f) - 0.14 * f * (1.0 - f);
  }
  return -1.0;
}

// The bridge at a sample: towers, cable, hangers and deck. Writes how much
// it covers to cover.
vec4 sfBridge(float col, float row, float traffic, out float cover) {
  cover = 0.0;
  float x = sfX(col);
  float y = sfY(row);
  // The near tower is drawn over the far one.
  sfTowerAt(-1.0);
  vec4 tw = sfTower(col, row, cover);
  if (cover > 0.0) {
    return tw;
  }
  float nearN = sfTn;
  float nearC = sfTc;
  sfTowerAt(1.0);
  tw = sfTower(col, row, cover);
  if (cover > 0.0) {
    return tw;
  }
  bool inTower = abs(col - nearC) <= nearN + 0.5 || abs(col - sfTc) <= sfTn + 0.5;

  float u = sfU(x);
  float s = sfScale(u);
  float far = sfFar(u);
  vec3 orange = vec3(0.86, 0.27, 0.14);
  float deckTop = sfRowOf(sfYu(u, 0.29));
  float thick = max(2.0, floor(0.055 * s * sfN.y + 0.5));

  // The main cable, tested by distance to the curve in samples so steep
  // parts stay unbroken. Nearer, it is a little thicker.
  float cv = sfCableV(u);
  if (cv > 0.0 && !inTower) {
    float yc = sfYu(u, cv);
    float ul = sfU(x - sfCw);
    float ur = sfU(x + sfCw);
    float k = (sfYu(ur, sfCableV(ur)) - sfYu(ul, sfCableV(ul))) * 0.5 / sfRh;
    float d = abs(y - yc) / sfRh / sqrt(1.0 + k * k);
    float vc = (yc - sfWater(u)) / s;
    vec3 steel = mix(vec3(0.62, 0.16, 0.09), vec3(1.0, 0.5, 0.24), smoothstep(0.3, 0.98, vc));
    if (d < mix(0.95, 0.55, far)) {
      cover = 1.0;
      return vec4(steel, mix(0.85, 0.7, far));
    }
    // Hangers: one every 0.055 of the span, fine, and fading as they
    // crowd together toward the far tower.
    float du = 0.07;
    float hl = sfU(x - sfCw * 0.5);
    float hr = sfU(x + sfCw * 0.5);
    if (floor(hl / du) != floor(hr / du) && y < yc && row > deckTop) {
      float gap = du * sfA / pow(1.0 + sfK * u, 2.0) / sfCw;
      float fade = smoothstep(2.0, 6.0, gap);
      if (fade > 0.05) {
        cover = fade * 0.75;
        return vec4(steel * 0.75, 0.32);
      }
    }
  }

  // The deck, thinner as it recedes: the roadway with its rail lamps on
  // top and the stiffening truss under it.
  if (row <= deckTop && row > deckTop - thick) {
    cover = 1.0;
    if (row == deckTop) {
      // Cars: single dots of light, white one way, red the other.
      float cars = floor(traffic * 6.0 + 0.5);
      for (int i = 0; i < 6; i++) {
        if (float(i) >= cars) {
          break;
        }
        float fi = float(i);
        float dir = mod(fi, 2.0) < 0.5 ? 1.0 : -1.0;
        float span = sfAsp + 0.2;
        float cx = mod(dir * sfT * (0.018 + 0.004 * fi) + fi * 0.37 * span, span) - span * 0.5;
        if (abs(col - sfColOf(cx)) < 0.5) {
          vec3 car = dir > 0.0 ? vec3(1.0, 0.95, 0.85) : vec3(1.0, 0.22, 0.16);
          return vec4(car, 0.9);
        }
      }
      float ll = sfU(x - sfCw * 0.5);
      float lr = sfU(x + sfCw * 0.5);
      if (floor(ll / 0.11) != floor(lr / 0.11)) {
        return vec4(vec3(1.0, 0.74, 0.42), mix(0.82, 0.55, far));
      }
      return vec4(orange * 0.95, mix(0.75, 0.55, far));
    }
    float r = deckTop - row;
    float truss = mod(col + row, 3.0) < 0.5 ? 0.6 : 0.4;
    return vec4(orange * truss * (r >= thick - 1.0 ? 0.6 : 1.0), mix(0.65, 0.45, far));
  }
  return vec4(0.0);
}

// The aircraft warning lights on the tower tops. Each tower blinks softly,
// out of step with the other.
float sfBeacon(float tower) {
  float phase = sfT * 2.6 + tower * 1.9;
  return smoothstep(-0.2, 1.0, sin(phase)) * 0.85 + 0.15;
}

// Everything above the water at a sample, and the parts of the bridge that
// stand in front of the water below the horizon.
vec4 sfAbove(float col, float row, float fogAmount, float traffic) {
  float x = sfX(col);
  float y = sfY(row);
  vec3 sky = sfSky(x, y);
  vec4 c = vec4(sky, sfTone(sky));

  // A few faint stars in the upper sky.
  float h = (y - sfHz) / (1.0 - sfHz);
  float sh = sfHash(vec2(col, row));
  if (h > 0.45 && sh < 0.008 * smoothstep(0.45, 0.9, h)) {
    float tw = 0.6 + 0.4 * sin(sfT * 0.9 + sh * 400.0);
    c = vec4(mix(c.rgb, vec3(0.86, 0.9, 1.0), 0.8 * tw), 0.3 + 0.25 * tw);
  }

  // The beacons' soft red halo in the sky around each tower top.
  for (int i = 0; i < 2; i++) {
    float tu = i == 0 ? -1.0 : 1.0;
    float ts = sfScale(tu);
    vec2 d = vec2((x - sfXu(tu)) / sfCw, (y - sfYu(tu, 1.0)) / sfRh * 2.0);
    float rad = 0.1 * ts / sfCw;
    c.rgb += vec3(0.9, 0.14, 0.1) * exp(-dot(d, d) / (rad * rad * 1.5)) * sfBeacon(tu) * 0.35;
  }

  vec4 land = sfLand(col, row, x, y);
  if (land.a > 0.0) {
    c = land;
  }

  float fog = sfFog(x, y, fogAmount);
  vec3 fogCol = sfFogColor(x, y);
  float fogTone = sfTone(fogCol);
  c = mix(c, vec4(fogCol, fogTone), fog * 0.85);

  float cover;
  vec4 b = sfBridge(col, row, traffic, cover);
  sfCovered = cover;
  if (cover > 0.0) {
    // Haze: the far parts sink toward the sky, and the fog buries the far
    // deck in places and the far tower's base.
    float far = sfFar(sfU(x));
    b.rgb = mix(b.rgb, sky * 0.8, far * 0.35);
    b.a *= 1.0 - 0.15 * far;
    float veil = fog * mix(0.3, 0.92, far);
    b.rgb = mix(b.rgb, fogCol, veil);
    b.a = mix(b.a, fogTone, veil);
    c = mix(c, b, cover);
  }

  // The aircraft warning lights: one red dot above each leg.
  for (int i = 0; i < 2; i++) {
    sfTowerAt(i == 0 ? -1.0 : 1.0);
    if (row == sfTcap) {
      float jx = abs(col - sfTc);
      float n = sfTn - 1.0;
      if (abs(jx - (n - floor(sfTlw * 0.5))) < 0.5) {
        float b2 = sfBeacon(sfTu) * mix(1.0, 0.7, sfFar(sfTu));
        c = vec4(mix(c.rgb, vec3(1.0, 0.18, 0.12), b2), mix(c.a, 0.95, b2));
      }
    }
  }
  return c;
}

vec4 sfBoat(float col, float row) {
  float boatRow = sfHzRow - floor(0.13 * sfN.y);
  float span = sfAsp + 0.3;
  float bx = mod(sfT * 0.006 + 0.62 * span, span) - span * 0.5;
  float bc = sfColOf(bx);
  float dx = col - bc;
  float dr = row - boatRow;
  // Hull, cabin lights and a white masthead light, heading right.
  if (dr == 0.0 && dx >= -4.0 && dx <= 4.0) {
    return vec4(vec3(0.36, 0.36, 0.48), 0.6);
  }
  if (dr == 1.0 && dx >= -2.0 && dx <= 1.0) {
    return vec4(vec3(1.0, 0.78, 0.46), 0.75);
  }
  if (dr == 2.0 && dx == 0.0) {
    return vec4(vec3(1.0, 0.97, 0.9), 0.8);
  }
  // A faint wake trailing behind, widening with distance.
  if (dx < -4.0 && dx > -26.0) {
    float back = -dx - 4.0;
    float w = 0.6 + back * 0.09;
    if (abs(dr) < w && mod(back + floor(sfT * 2.0), 3.0) < 1.0) {
      return vec4(vec3(0.62, 0.66, 0.8) * (1.0 - back / 24.0), 0.38 * (1.0 - back / 26.0) + 0.08);
    }
  }
  // The cabin lights' reflection, a short broken streak.
  if (dr < 0.0 && dr > -5.0 && dx >= -2.0 && dx <= 1.0
      && sfHash(vec2(col, row + floor(sfT * 3.0))) < 0.55) {
    return vec4(vec3(0.9, 0.6, 0.36) * (1.0 + dr * 0.15), 0.4);
  }
  return vec4(0.0);
}

vec4 sfScene(vec2 uv, vec2 res, float t, float fogAmount, float traffic, float boat) {
  sfSetup(res, t);
  float col = floor(uv.x * sfN.x);
  float row = floor(uv.y * sfN.y);
  if (row >= sfHzRow) {
    return sfAbove(col, row, fogAmount, traffic);
  }
  float x = sfX(col);
  float y = sfY(row);
  // The near piers stand in the water in front of the horizon. This
  // column's waterline lies where the bridge meets the water.
  float wr = min(sfHzRow, sfRowOf(sfWater(clamp(sfU(x), -1.6, 1.6))));
  if (row >= wr) {
    vec4 a = sfAbove(col, row, fogAmount, traffic);
    if (sfCovered > 0.5) {
      return a;
    }
  }
  // The bay: everything above, mirrored at the waterline and broken into
  // horizontal streaks by slow ripples that grow toward the viewer. Water
  // behind the near piers mirrors the sky at the horizon instead.
  float axis = row >= wr ? sfHzRow : wr;
  float depth = (sfHz - y) / sfHz;
  float r1 = snoise(vec2(x * 1.4 + t * 0.01, row * 0.42 - t * 0.35));
  float r2 = snoise(vec2(x * 3.5 - t * 0.02, row * 0.9 + t * 0.22));
  float shiftR = floor(r1 * (0.5 + 1.6 * depth) + 0.5);
  float shiftC = floor(r2 * (0.5 + 1.5 * depth) + 0.5);
  float mr = max(2.0 * axis - 1.0 - row + shiftR, axis);
  vec4 m = sfAbove(col + shiftC, mr, fogAmount, traffic);
  float streak = 0.8 + 0.22 * snoise(vec2(x * 1.6 - t * 0.015, row * 0.6 + t * 0.18));
  vec3 water = vec3(0.07, 0.09, 0.22);
  float k = clamp(0.75 * streak * (1.0 - 0.3 * depth), 0.0, 1.0);
  vec3 c = mix(water, m.rgb * vec3(0.8, 0.82, 0.96), k);
  float tone = mix(sfTone(water), m.a * 0.8, k);
  // The afterglow's path on the water: a warm column that widens toward the
  // viewer, broken into glints by the ripples.
  float path = exp(-pow((x - sfGlowX) * 3.2 / (0.5 + 0.9 * depth), 2.0));
  float glint = smoothstep(0.1, 0.8, snoise(vec2(x * 7.0 + t * 0.03, row * 0.8 - t * 0.45)));
  glint *= path * (1.0 - 0.75 * depth) * sfGlowGain;
  c = mix(c, vec3(1.0, 0.7, 0.45), glint * 0.85);
  tone = mix(tone, 0.8, glint);
  if (boat > 0.5) {
    vec4 b = sfBoat(col, row);
    if (b.a > 0.0) {
      c = b.rgb;
      tone = b.a;
    }
  }
  return vec4(c, tone);
}

vec2 sfCacheUv = vec2(-1.0);
float sfCacheT = -1.0;
vec4 sfCacheValue = vec4(0.0);

vec4 sfShade(vec2 uv, vec2 res, float t) {
  if (uv == sfCacheUv && t == sfCacheT) {
    return sfCacheValue;
  }
  vec4 c = sfScene(uv, res, t, sfFogAmount, sfTraffic, sfBoatOn);
  // A little per-dot variation in brightness and hue, as in a print, so
  // wide gradients don't read as flat bands.
  // Dark air stays even, so it reads as quiet rather than as texture.
  vec2 cell = floor(uv * sfN);
  float j = sfHash(cell + 31.7) - 0.5;
  float k = sfHash(cell + 77.1) - 0.5;
  float lit = smoothstep(0.15, 0.5, max(max(c.r, c.g), c.b));
  c.rgb *= 1.0 + j * 0.22 * lit;
  c.rgb += vec3(k, -k * 0.3, -k) * 0.05 * lit;
  sfCacheUv = uv;
  sfCacheT = t;
  sfCacheValue = vec4(c.rgb * sfIntensity, c.a * sqrt(sfIntensity));
  return sfCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return sfShade(uv, res, t).a;
}
`;

// Mid tones are lifted a little so small dots keep their hue. Dark air is
// left dim and greyed, a shade above the paper, so it reads as quiet.
const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  vec3 c = sfShade(uv, res, t).rgb;
  float peak = max(max(c.r, c.g), c.b);
  c = clamp(c / pow(max(peak, 0.2), 0.3), 0.0, 1.0);
  float grey = dot(c, vec3(0.3, 0.55, 0.15));
  return mix(c, vec3(grey) * vec3(0.9, 0.95, 1.2), (1.0 - smoothstep(0.12, 0.4, peak)) * 0.45);
}
`;

// Modes that paint the scene's own colours need its dusk behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const DUSK = "#05081a";
const DUSK_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0b0f2a 0%, #1c2350 45%, #5a4a78 66%, #8a5a5e 70%, #0a0e22 71%, #05081a 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface SanFranciscoProps extends AsciiSceneProps {
  /** How much the scene shows, from 0 (empty paper) to 1. Lower it under body text. Default 1. */
  intensity?: number;
  /** How thick the fog bank under the deck and over the headlands is, from 0 (none) to 1. Default 0.6. */
  fog?: number;
  /** How many cars cross the bridge, from 0 (none) to 1 (six). Default 0.2. */
  traffic?: number;
  /** The boat crossing the bay. Default `true`. */
  boat?: boolean;
  /**
   * The surface behind the glyphs. Default: the scene's dusk in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /**
   * Cells as wide as they are tall, so the dots lay an even halftone
   * lattice. Default `true` for `dots` and other ramps, `false` for Braille
   * and quadrants, which would stretch.
   */
  square?: boolean;
  /** Shown without WebGL and until the first frame. Default: a blue-hour gradient. */
  fallback?: ReactNode;
}

/**
 * San Francisco. The Golden Gate Bridge at blue hour: two Art Deco towers
 * in International Orange catching the last light, the main cable and its
 * suspenders, fog rolling under the deck and over the Marin Headlands, the
 * city's lights on the far shore, and the bay mirroring the bridge and the
 * afterglow. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const SanFrancisco = ({
  intensity = 1,
  fog = 0.6,
  traffic = 0.2,
  boat = true,
  paper,
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  ramp,
  cell = 7,
  dither,
  square,
  fps = 24,
  stillTime = 20,
  // Part of the shared scene props; nothing here follows the pointer.
  interactive: _interactive,
  fallback = FALLBACK,
  ...props
}: SanFranciscoProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  // Dithering blends dot sizes into smooth gradients on ramps; Braille and
  // quadrants would turn it into an even mesh, so they keep the threshold.
  const isRamp = resolveCharset(charset, chars).kind === "ramp";
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        sfBoatOn: boat ? 1 : 0,
        sfFogAmount: clamp(fog, 0, 1),
        sfIntensity: clamp(intensity, 0, 1),
        sfTraffic: clamp(traffic, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "ember" : undefined)}
      paper={paper ?? (DUSK_MODES.has(mode) ? DUSK : undefined)}
      cell={cell}
      dither={dither ?? (isRamp ? "bayer4" : "none")}
      square={square ?? isRamp}
      fps={fps}
      stillTime={stillTime}
      interaction="none"
      fallback={fallback}
      {...props}
    />
  );
};
