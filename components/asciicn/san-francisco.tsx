"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The Golden Gate Bridge at blue hour, seen side on across the water. The
// scene is painted per sample, far to near: the sky and the afterglow, the
// far shore and its lights, the Marin Headlands on the left and the city's
// hills on the right, the fog bank, the bridge, and below the horizon the
// bay, which mirrors all of it through slow ripples.
//
// Units are box heights: y runs from 0 at the bottom to 1 at the top and x
// is centred. The bridge is laid out on whole samples (`sfN`), so the tower
// legs, portal struts, cable and suspenders land on exact columns and rows
// and come out as clean lines of dots at any size. Towers keep their height
// and move apart as the box widens, so a phone still shows the whole span.
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
float sfS = 0.4;
float sfTowerX = 0.4;
float sfShift = 0.0;
float sfGlowGain = 1.0;
float sfSideX = 0.6;
float sfDeckRow = 0.0;
float sfGlowX = 0.0;
float sfColL = 0.0;
float sfColR = 0.0;
float sfHalfW = 4.0;
float sfLegW = 2.0;

// Tower rows: the pier top, the four portal struts (from, to), the stepped
// tops of the legs and the first row above the tower. Each part keeps at
// least one row, so the struts survive in a small box.
float sfPier = 0.0;
float sfS1a = 0.0;
float sfS1b = 0.0;
float sfS2a = 0.0;
float sfS2b = 0.0;
float sfS3a = 0.0;
float sfS3b = 0.0;
float sfS4a = 0.0;
float sfS4b = 0.0;
float sfTopRow = 0.0;
float sfCapRow = 0.0;

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

// The row whose lower edge is nearest a height given in tower units, where
// 0 is the water and 1 the top of a tower.
float sfVRow(float v) {
  return floor((sfHz + v * sfS) * sfN.y + 0.5);
}

void sfSetup(vec2 res, float t) {
  sfN = ascii_samples;
  sfAsp = res.x / res.y;
  sfCw = sfAsp / sfN.x;
  sfRh = 1.0 / sfN.y;
  sfT = t;
  float tall = 1.0 - smoothstep(0.6, 1.3, sfAsp);
  // Portrait boxes frame the span between slim towers at the left and right
  // edges, the deck low at about 73% down and the tower tops near half
  // height, so a centred headline sits between the towers, not over them.
  // Wider boxes show the whole span with the towers moving apart. The
  // switch is a step: a blend between the framings would cut a tower.
  float portrait = step(sfAsp, 0.85);
  sfS = mix(mix(0.5, 0.34, tall), 0.325, portrait);
  float hz = mix(mix(0.27, 0.33, tall), 0.27 - 0.29 * sfS, portrait);
  sfHzRow = floor(hz * sfN.y + 0.5);
  sfHz = sfHzRow / sfN.y;
  sfHalfW = max(3.0, floor(mix(mix(0.1, 0.085, tall), 0.1, portrait) * sfS / sfCw + 0.5));
  float edge = sfAsp * 0.5 - (sfHalfW + 1.5) * sfCw;
  sfTowerX = mix(clamp(sfAsp * 0.29, 0.155, 0.6), edge, portrait);
  sfShift = 0.0;
  sfSideX = sfTowerX * 1.36;
  sfDeckRow = sfVRow(0.29);
  sfGlowX = -0.12 * min(sfAsp, 1.4);
  // On a phone the glow and its path on the water sit right under the
  // buttons, so they are held back there.
  sfGlowGain = mix(1.0, 0.45, portrait);
  sfColR = sfColOf(sfTowerX + sfShift);
  sfColL = sfColR - floor(2.0 * sfTowerX / sfCw + 0.5);
  sfLegW = max(2.0, floor(0.052 * sfS / sfCw + 0.5));
  sfPier = sfVRow(0.05);
  sfS1a = sfVRow(0.47);
  sfS1b = max(sfVRow(0.51), sfS1a + 1.0);
  sfS2a = max(sfVRow(0.64), sfS1b + 2.0);
  sfS2b = max(sfVRow(0.675), sfS2a + 1.0);
  sfS3a = max(sfVRow(0.78), sfS2b + 2.0);
  sfS3b = max(sfVRow(0.81), sfS3a + 1.0);
  sfS4a = max(sfVRow(0.9), sfS3b + 2.0);
  sfS4b = max(sfVRow(0.945), sfS4a + 1.0);
  sfTopRow = max(sfVRow(0.985), sfS4b + 1.0);
  sfCapRow = max(sfVRow(1.0), sfTopRow + 1.0);
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
  vec2 g = vec2((x - sfGlowX) * 0.7, (y - sfHz - 0.2 * sfS) * 1.7);
  return exp(-dot(g, g) * 6.0);
}

float sfCore(float x, float y) {
  vec2 g = vec2((x - sfGlowX) * 1.0, (y - sfHz - 0.21 * sfS) * 1.6);
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

// How far a point lies beyond the north tower, toward the Marin side, in
// tower heights. The headlands and the fog over them follow it.
float sfMarin(float x) {
  return max(0.0, (-x - sfTowerX * 1.02) / sfS);
}

// The top of the fog bank: under the deck along the span, piled up against
// the headlands on the left and lower off the city shore on the right.
float sfFogTop(float x) {
  float marin = 1.0 - exp(-sfMarin(x) * 3.0);
  float city = smoothstep(sfTowerX * 1.05, sfSideX * 1.2, x);
  return sfHz + sfS * (0.19 - 0.1 * city + 0.14 * marin);
}

float sfFog(float x, float y, float amount) {
  if (amount <= 0.0) {
    return 0.0;
  }
  // Rounded billows along the top, slowly rolling east.
  float roll = x * 3.0 - sfT * 0.03;
  float lumps = 1.0 - abs(snoise(vec2(roll, 3.1)));
  lumps = 0.65 * lumps + 0.35 * (1.0 - abs(snoise(vec2(roll * 2.3 + 5.0, 1.7))));
  float n2 = fbm(vec2(x * 5.0 - sfT * 0.05, y * 11.0 - 4.1));
  float top = sfFogTop(x) + (lumps - 0.6) * 0.2 * sfS + (n2 - 0.5) * 0.05 * sfS;
  top = mix(sfHz, top, clamp(amount * 1.6, 0.0, 1.0));
  float d = 1.0 - smoothstep(top - 0.07 * sfS, top + 0.01 * sfS, y);
  // Wisps: denser in the lumps, thinner between.
  d *= 0.55 + 0.6 * smoothstep(0.3, 0.72, n2);
  return clamp(d * min(1.0, amount * 1.4), 0.0, 1.0);
}

// Fog is lit from above by the afterglow: warm white on its tops, blue grey
// underneath and in the folds.
vec3 sfFogColor(float x, float bx, float y) {
  float lift = smoothstep(sfHz, sfFogTop(bx) + 0.06 * sfS, y);
  float puff = fbm(vec2(bx * 8.0 - sfT * 0.06, y * 16.0 + 2.0));
  vec3 c = mix(vec3(0.22, 0.24, 0.42), vec3(0.78, 0.74, 0.88), lift * lift);
  c *= 0.75 + 0.5 * puff;
  return c + (vec3(1.0, 0.55, 0.34) * sfGlow(x, y) * 0.45 + vec3(1.0, 0.8, 0.6) * sfCore(x, y) * 0.3) * sfGlowGain;
}

// Land: the Marin Headlands rising from the north tower on the left, the
// low hills of the Presidio on the right, and the far shore in between.
vec4 sfLand(float col, float row, float x, float y) {
  float dm = sfMarin(x);
  float hm = sfHz + sfS * (0.05 + 0.52 * (1.0 - exp(-dm * 2.6)) + 0.12 * smoothstep(0.35, 0.8, dm));
  hm += (fbm(vec2(x * 5.0, 2.3)) - 0.5) * 0.12 * sfS * min(1.0, dm * 4.0);
  float ds = max(0.0, (x - sfTowerX * 1.15) / sfS);
  float hs = sfHz + sfS * (0.04 + 0.22 * (1.0 - exp(-ds * 2.5)));
  hs += (fbm(vec2(x * 7.0, 8.1)) - 0.5) * 0.04 * sfS;
  float shore = sfHz + sfS * 0.03 * (0.5 + fbm(vec2(x * 4.0, 5.2)));
  float top = max(x < 0.0 ? hm : hs, shore);
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
  float tone = 0.02 + 0.4 * dot(c, vec3(0.3, 0.55, 0.15));
  // City lights over the hills on the right and along the far shore.
  float city = x > sfTowerX * 1.1 ? 0.3 : (x < -sfTowerX ? 0.015 : 0.14);
  float h = sfHash(vec2(col, row) + 7.1);
  if (h < city) {
    float tw = 0.75 + 0.25 * sin(sfT * 0.7 + h * 90.0);
    c = mix(vec3(1.0, 0.72, 0.4), vec3(0.95, 0.9, 0.8), step(0.6, fract(h * 37.0))) * (0.6 + 0.4 * tw);
    tone = 0.45 + 0.25 * tw;
  }
  return vec4(c, tone);
}

// The bridge at a sample. Writes how much it covers to cover.
vec4 sfBridge(float col, float row, float traffic, out float cover) {
  cover = 0.0;
  float x = sfX(col) - sfShift;
  float y = sfY(row);
  float ax = abs(x);
  float right = step(0.0, x);
  float tc = right > 0.5 ? sfColR : sfColL;
  float jx = abs(col - tc);
  float v = (y - sfHz) / sfS;
  vec3 orange = vec3(0.86, 0.27, 0.14);

  // The towers. Rows: the pier, the legs and X bracing below the deck,
  // four portal struts above it, then the stepped tops of the legs.
  float n0 = sfHalfW;
  float pier = sfPier;
  if (row >= sfHzRow && row < sfCapRow && jx <= n0 + 2.0) {
    float n = row >= sfS2a ? n0 - 1.0 : n0;
    // Floodlit from below and catching the last light at the top.
    float lit = 0.45 + 0.55 * smoothstep(0.3, 0.98, v);
    vec3 base = mix(vec3(0.4, 0.09, 0.08), vec3(1.0, 0.52, 0.22), lit);
    // Light from the glow's side catches one edge of each leg.
    float side = sign(col - tc) * sign(sfGlowX - sfShift - (right > 0.5 ? sfTowerX : -sfTowerX));
    float inLeg = step(n - sfLegW + 1.0, jx) * step(jx, n);
    float edge = step(n - 0.5, jx);
    vec3 legCol = base * (edge > 0.5 ? (side > 0.0 ? 1.18 : 0.82) : 1.0);
    if (row < pier) {
      if (jx <= n0 + 1.0) {
        cover = 1.0;
        return vec4(vec3(0.42, 0.38, 0.44) * (0.8 + 0.3 * step(row, pier - 1.0)), 0.62);
      }
    } else if (row < sfDeckRow - 2.0) {
      // Below the deck: wider legs and a run of X bracing between them.
      float nb = n0 + (row < sfVRow(0.16) ? 1.0 : 0.0);
      if (jx <= nb && jx >= nb - sfLegW + 1.0) {
        cover = 1.0;
        return vec4(base * 0.85, 0.82);
      }
      float inner = nb - sfLegW;
      float panel = max(4.0, floor((sfDeckRow - 2.0 - pier) / 2.0));
      float f = fract((row - pier) / panel);
      if (jx <= inner && abs(jx - floor(inner * abs(1.0 - 2.0 * f) + 0.5)) < 0.5) {
        cover = 1.0;
        return vec4(base * 0.6, 0.55);
      }
    } else if (row >= sfDeckRow - 2.0 && row <= sfDeckRow) {
      // The deck passes through; drawn below.
    } else if (row < sfS4b) {
      bool strut = (row >= sfS1a && row < sfS1b) || (row >= sfS2a && row < sfS2b)
        || (row >= sfS3a && row < sfS3b) || row >= sfS4a;
      if (inLeg > 0.5 || (strut && jx <= n)) {
        cover = 1.0;
        float shade = inLeg > 0.5 ? 1.0 : 0.8;
        // The underside of each strut sits in its own shadow.
        if (inLeg < 0.5 && (row == sfS1a || row == sfS2a || row == sfS3a || row == sfS4a)) {
          shade = 0.62;
        }
        return vec4(legCol * shade, inLeg > 0.5 ? 1.0 : 0.9);
      }
    } else {
      // The stepped tops of the legs: full width, then the outer corner cut.
      float nn = n;
      float lo = n - sfLegW + 1.0;
      if (row >= sfTopRow) {
        nn = n - 1.0;
      }
      if (jx >= lo && jx <= nn) {
        cover = 1.0;
        return vec4(legCol * 1.08, 1.0);
      }
    }
  }

  // The main cable: a parabola from saddle to saddle that dips to just above
  // the deck at mid-span, and the side spans down to the anchorages. The
  // test is the distance to the curve in samples, so steep parts stay unbroken.
  float yTop = (sfS4b + 0.5) * sfRh;
  float yLow = (sfDeckRow + 2.5) * sfRh;
  float yDeck = (sfDeckRow + 0.5) * sfRh;
  float yc = -1.0;
  float slope = 0.0;
  if (ax <= sfTowerX) {
    float u = ax / sfTowerX;
    yc = yLow + (yTop - yLow) * u * u;
    slope = 2.0 * (yTop - yLow) * u / sfTowerX;
  } else if (ax <= sfSideX) {
    float u = (ax - sfTowerX) / (sfSideX - sfTowerX);
    float sag = 0.035 * sfS;
    yc = mix(yTop, yDeck, u) - sag * 4.0 * u * (1.0 - u);
    slope = ((yDeck - yTop) - sag * 4.0 * (1.0 - 2.0 * u)) / (sfSideX - sfTowerX);
  }
  float lit = smoothstep(0.3, 0.98, v);
  vec3 steel = mix(vec3(0.85, 0.24, 0.12), vec3(1.0, 0.52, 0.24), lit);
  if (yc > 0.0 && jx > n0 + 0.5) {
    float k = slope * sfCw / sfRh;
    float d = abs(y - yc) / sfRh / sqrt(1.0 + k * k);
    if (d < 0.62) {
      cover = 1.0;
      return vec4(steel * 1.05, 0.8);
    }
    // Suspenders: every third column, from the cable down to the deck.
    float m = 3.0;
    float off = right > 0.5 ? mod(sfColR - col, m) : mod(col - sfColL, m);
    if (off < 0.5 && y < yc && row > sfDeckRow) {
      cover = 1.0;
      return vec4(steel * 0.55, 0.2);
    }
  }

  // The deck: the roadway with its rail lamps, and the stiffening truss.
  if (row <= sfDeckRow && row >= sfDeckRow - 2.0) {
    cover = 1.0;
    if (row == sfDeckRow) {
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
      if (mod(col - sfColL, 6.0) < 0.5) {
        return vec4(vec3(1.0, 0.74, 0.42), 0.82);
      }
      return vec4(orange * 0.9, 0.7);
    }
    float truss = mod(col + row, 3.0) < 0.5 ? 0.62 : 0.45;
    return vec4(orange * truss * (row == sfDeckRow - 2.0 ? 0.75 : 1.0), 0.62);
  }
  return vec4(0.0);
}

// The aircraft warning lights on the tower tops, as a level from 0 to 1 and
// the sample it sits on. Each tower blinks softly, out of step with the other.
float sfBeacon(float tower) {
  float phase = sfT * 2.6 + tower * 1.9;
  return smoothstep(-0.2, 1.0, sin(phase)) * 0.85 + 0.15;
}

// Everything above the water at a sample, without the bay.
vec4 sfAbove(float col, float row, float fogAmount, float traffic) {
  float x = sfX(col);
  // The same point in the bridge's own frame, which portrait boxes shift.
  float bx = x - sfShift;
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
  float topY = (sfCapRow + 0.5) * sfRh;
  for (int i = 0; i < 2; i++) {
    float tx = (i == 0 ? -sfTowerX : sfTowerX) + sfShift;
    vec2 d = vec2((x - tx) / sfCw, (y - topY) / sfRh * 2.0);
    float b = sfBeacon(float(i));
    c.rgb += vec3(0.9, 0.14, 0.1) * exp(-dot(d, d) / (sfHalfW * sfHalfW * 1.5)) * b * 0.35;
  }

  vec4 land = sfLand(col, row, bx, y);
  if (land.a > 0.0) {
    c = land;
  }

  float fog = sfFog(bx, y, fogAmount);
  vec3 fogCol = sfFogColor(x, bx, y);
  float fogTone = sfTone(fogCol);
  c = mix(c, vec4(fogCol, fogTone), fog * 0.85);

  float cover;
  vec4 b = sfBridge(col, row, traffic, cover);
  if (cover > 0.0) {
    // Fog rolls under the deck and veils the lower towers.
    float veil = row < sfDeckRow - 2.0 ? 0.4 : 0.1;
    b.rgb = mix(b.rgb, fogCol, fog * veil);
    b.a = mix(b.a, fogTone, fog * veil * 0.6);
    c = b;
  }

  // The aircraft warning lights: one red dot above each leg.
  if (row == sfCapRow) {
    float tc = bx > 0.0 ? sfColR : sfColL;
    float jx = abs(col - tc);
    float n = sfHalfW - 1.0;
    if (abs(jx - (n - floor(sfLegW * 0.5))) < 0.5) {
      float b2 = sfBeacon(bx > 0.0 ? 1.0 : 0.0);
      c = vec4(mix(c.rgb, vec3(1.0, 0.18, 0.12), b2), mix(c.a, 0.95, b2));
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
    if (abs(dr + 0.0) < w && mod(back + floor(sfT * 2.0), 3.0) < 1.0) {
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
  // The bay: everything above, mirrored at the horizon and broken into
  // horizontal streaks by slow ripples that grow toward the viewer.
  float x = sfX(col);
  float y = sfY(row);
  float depth = (sfHz - y) / sfHz;
  float r1 = snoise(vec2(x * 1.4 + t * 0.01, row * 0.42 - t * 0.35));
  float r2 = snoise(vec2(x * 3.5 - t * 0.02, row * 0.9 + t * 0.22));
  float shiftR = floor(r1 * (0.5 + 1.6 * depth) + 0.5);
  float shiftC = floor(r2 * (0.5 + 1.5 * depth) + 0.5);
  float mr = 2.0 * sfHzRow - 1.0 - row + shiftR;
  mr = max(mr, sfHzRow);
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
