"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The whole view is one function of p = (x in box heights, y up), with the
// Thames embankment at LONDON_BANK. Layers are tested near to far and the
// first one that covers a sample wins: the green bridge with its lamps and
// the bus, then the river, the Elizabeth Tower, the Houses of Parliament,
// Tower Bridge downstream and the low city behind it, then the sky. Fog is
// laid over every layer afterwards, thicker the further away it is, and the
// lamps burn through it with amber halos. Sizes that must survive coarse
// charsets are measured against `px`, one sample row, so thin lines never
// vanish between samples. `londonScene` returns colour and tone, cached per
// sample so the field and colour passes share one evaluation.
const SCENE = `
const float LONDON_BANK = 0.34;
const float LONDON_WATER = 0.328;
const float LONDON_TOWER = 0.56;
const float LONDON_DECK = 0.2;
const float LONDON_SPAN = 0.34;
const float LONDON_LAMPS = 0.07;
const vec3 LONDON_AMBER = vec3(1.0, 0.68, 0.3);
const vec3 LONDON_FOG = vec3(0.6, 0.67, 0.8);

// Right of centre on wide boxes, so a headline can sit beside it; centred on tall ones.
float londonTowerX(float aspect) {
  return aspect * mix(0.5, 0.6, smoothstep(0.9, 1.5, aspect));
}

// Downstream, where Tower Bridge stands in the fog: left of the tower.
float londonBridgeX(float aspect, float cx) {
  return cx - mix(0.62, 0.78, smoothstep(1.2, 2.0, aspect));
}

// The clock hands as angles from twelve, clockwise. The minute hand turns
// once every two minutes, so the motion is plain to see.
vec2 londonHands(float t) {
  float minute = 6.28318 * (t / 120.0 + 0.17);
  float hour = 6.28318 * (t / 1440.0 + 10.17 / 12.0);
  return vec2(minute, hour);
}

float londonHand(vec2 rel, float angle, float len, float thick) {
  vec2 dir = vec2(sin(angle), cos(angle));
  float along = dot(rel, dir);
  float across = abs(rel.x * dir.y - rel.y * dir.x);
  return step(-0.006, along) * step(along, len) * step(across, thick);
}

// The Elizabeth Tower in its own units: x across from the axis, y up from 0
// to 1, both in tower heights. Returns the tone; cover is 1 on the tower and
// kind tells the stone (0) from the clock face (1), a light (2) and the
// hands (3).
float londonTower(vec2 tp, float px, float t, out float cover, out float kind) {
  cover = 0.0;
  kind = 0.0;
  float q = abs(tp.x);
  float v = tp.y;
  if (v < 0.0 || v > 1.0) {
    return 0.0;
  }
  float line = max(px * 0.55, 0.004);
  // The finial: a thin rod with a cross bar.
  if (v > 0.955) {
    if (q < line || (abs(v - 0.975) < line * 0.6 && q < line * 2.4)) {
      cover = 1.0;
      return 0.6;
    }
    return 0.0;
  }
  // The iron spire curves in as it rises; the Ayrton light burns in it.
  if (v > 0.83) {
    float s = (v - 0.83) / 0.125;
    float w = max(mix(0.084, 0.012, pow(s, 0.7)), line);
    if (q > w) {
      return 0.0;
    }
    cover = 1.0;
    if (abs(v - 0.89) < max(0.012, px * 0.6) && q < max(w * 0.75, line)) {
      kind = 2.0;
      return 1.0;
    }
    float rib = step(0.5, fract(tp.x / max(px * 1.3, 0.014)));
    float rim = 1.0 - smoothstep(line * 0.6, line * 2.0, w - q);
    return 0.34 + 0.1 * rib + 0.3 * rim;
  }
  // The belfry, with a pinnacle on each corner and its arches dimly lit.
  if (v > 0.78) {
    float pin = abs(q - 0.09);
    float pinHalf = max(0.009 * (1.0 - (v - 0.78) / 0.055), line * 0.5);
    if (pin < pinHalf && v < 0.835) {
      cover = 1.0;
      return 0.62;
    }
    if (q > 0.08) {
      return 0.0;
    }
    cover = 1.0;
    float bay = abs(mod(tp.x + 0.027, 0.054) - 0.027);
    float point = 0.825 - bay * 1.2;
    if (bay < 0.014 && v > 0.788 && v < point) {
      kind = 2.0;
      return 0.55;
    }
    return 0.4 + 0.25 * (1.0 - smoothstep(line * 0.6, line * 2.0, 0.08 - q));
  }
  // The clock stage, a little wider than the shaft.
  if (v > 0.6) {
    if (q > 0.098) {
      return 0.0;
    }
    cover = 1.0;
    vec2 rel = tp - vec2(0.0, 0.69);
    float d = length(rel);
    float r = 0.08;
    if (d < r) {
      float thick = max(px * 0.3, 0.005);
      vec2 hands = londonHands(t);
      float on = max(londonHand(rel, hands.x, r * 0.86, thick), londonHand(rel, hands.y, r * 0.56, thick * 1.5));
      if (on > 0.5 || d < 0.008) {
        kind = 3.0;
        return 0.1;
      }
      // The gilt frame around the opal glass.
      if (d > r - max(line * 1.1, 0.008)) {
        return 0.62;
      }
      kind = 1.0;
      return 0.86 + 0.1 * (1.0 - d / r);
    }
    float cornice = max(1.0 - smoothstep(line * 0.6, line * 2.0, abs(v - 0.6)), 1.0 - smoothstep(line * 0.6, line * 2.0, abs(v - 0.78)));
    float rim = 1.0 - smoothstep(line * 0.6, line * 2.0, 0.098 - q);
    return 0.36 + 0.3 * max(cornice, rim);
  }
  // The shaft: three tall panels a side, string courses, and a few lit slits.
  float w = mix(0.088, 0.078, smoothstep(0.0, 0.06, v));
  if (q > w) {
    return 0.0;
  }
  cover = 1.0;
  float panel = fract((tp.x + w) / (w * 2.0 / 3.0));
  float mullion = 1.0 - smoothstep(0.08, 0.16, min(panel, 1.0 - panel));
  float course = 1.0 - smoothstep(line * 0.5, line * 1.6, abs(fract(v / 0.1 + 0.5) - 0.5) * 0.1);
  float rim = 1.0 - smoothstep(line * 0.6, line * 2.0, w - q);
  float storey = floor(v / 0.1);
  if (q < 0.01 && fract(v / 0.1) > 0.35 && fract(v / 0.1) < 0.75 && hash21(vec2(storey, 2.7)) > 0.45) {
    kind = 2.0;
    return 0.7;
  }
  return 0.3 + 0.16 * max(mullion, course) + 0.3 * rim;
}

vec3 londonTowerColor(float kind, float v) {
  vec3 stone = mix(vec3(0.86, 0.66, 0.4), vec3(0.95, 0.8, 0.52), smoothstep(0.0, 0.8, v));
  if (kind > 2.5) {
    return vec3(0.32, 0.24, 0.16);
  }
  if (kind > 1.5) {
    return vec3(1.0, 0.86, 0.56);
  }
  if (kind > 0.5) {
    return vec3(1.0, 0.92, 0.7);
  }
  return stone;
}

// The Houses of Parliament, running upstream from the tower: a long gothic
// front of buttresses and lit windows under a roofline of pinnacles, the
// Central Tower's spire halfway and the square Victoria Tower at the end.
// x is measured from the clock tower's axis.
vec4 londonParliament(vec2 p, float px, float cx, float t, out float cover) {
  cover = 0.0;
  float x = p.x - cx;
  float h = p.y - LONDON_BANK;
  if (x < 0.02 || x > 0.68 || h < -0.001 || h > 0.36) {
    return vec4(0.0);
  }
  float line = max(px * 0.55, 0.003);
  vec3 stone = vec3(0.88, 0.7, 0.46);
  vec3 slate = vec3(0.5, 0.52, 0.62);

  // Victoria Tower: a square block with corner turrets and a flagpole.
  float vx = x - 0.6;
  float aq = abs(vx);
  if (aq < 0.046) {
    float turret = abs(aq - 0.036);
    if (h > 0.29 && h < 0.318 && turret < max(0.006 * (1.0 - (h - 0.29) / 0.028), line * 0.5)) {
      cover = 1.0;
      return vec4(stone, 0.55);
    }
    if (h > 0.29 && h < 0.345 && aq < line * 0.5) {
      cover = 1.0;
      return vec4(stone, 0.45);
    }
    if (aq < 0.04 && h < 0.29) {
      cover = 1.0;
      float rim = 1.0 - smoothstep(line * 0.6, line * 2.0, 0.04 - aq);
      float crown = 1.0 - smoothstep(line * 0.6, line * 2.0, abs(h - 0.285));
      float col = fract((vx + 0.04) / 0.02);
      float slit = step(0.38, col) * step(col, 0.62) * step(0.1, h) * step(h, 0.26) * step(0.25, fract(h / 0.05));
      if (slit > 0.5) {
        float on = step(0.55, hash21(vec2(floor((vx + 0.04) / 0.02), floor(h / 0.05))));
        return mix(vec4(stone, 0.18), vec4(LONDON_AMBER, 0.75), on);
      }
      return vec4(stone, 0.32 + 0.3 * max(rim, crown));
    }
  }

  // The Central Tower: an octagonal lantern under a short spire.
  float ox = x - 0.31;
  float oq = abs(ox);
  if (h > 0.08 && h < 0.24) {
    float spireHalf = 0.02 * (1.0 - (h - 0.16) / 0.07);
    if (h < 0.16 && oq < 0.02) {
      cover = 1.0;
      float lancet = step(abs(mod(ox + 0.005, 0.01) - 0.005), 0.0022) * step(0.1, h) * step(h, 0.145);
      return lancet > 0.5 ? vec4(LONDON_AMBER, 0.6) : vec4(stone, 0.38 + 0.25 * (1.0 - smoothstep(line * 0.6, line * 2.0, 0.02 - oq)));
    }
    if (h >= 0.16 && oq < max(spireHalf, line * 0.5) && h < 0.23) {
      cover = 1.0;
      return vec4(stone, 0.46);
    }
    float corner = abs(oq - 0.022);
    if (h >= 0.14 && h < 0.18 && corner < max(0.004 * (1.0 - (h - 0.14) / 0.04), line * 0.5)) {
      cover = 1.0;
      return vec4(stone, 0.55);
    }
  }

  // The long front. Blocks step up and down a little; every buttress ends in
  // a pinnacle, every fourth one taller.
  if (x > 0.555) {
    return vec4(0.0);
  }
  float block = floor(x / 0.09);
  float top = 0.072 + 0.014 * step(0.5, hash21(vec2(block, 6.1)));
  float bayW = 0.02;
  float bay = mod(x, bayW) - bayW * 0.5;
  float bi = floor(x / bayW);
  float tall = step(3.0, mod(bi, 4.0));
  float pinH = mix(0.03, 0.05, tall);
  float roof = top + 0.01;
  if (h > top) {
    float pinHalf = max(0.0048 * (1.0 - (h - top) / pinH), line * 0.5);
    if (abs(bay) < pinHalf && h < top + pinH) {
      cover = 1.0;
      return vec4(stone, 0.5 + 0.15 * tall);
    }
    if (h < roof) {
      // Steep slate roofs between the pinnacles, with a ridge of iron cresting.
      cover = 1.0;
      float crest = 1.0 - smoothstep(line * 0.5, line * 1.5, roof - h);
      return vec4(slate, 0.2 + 0.18 * crest);
    }
    return vec4(0.0);
  }
  cover = 1.0;
  float buttress = 1.0 - smoothstep(line * 0.5, line * 1.5, abs(bay));
  float parapet = 1.0 - smoothstep(line * 0.5, line * 1.6, top - h);
  float floorH = 0.022;
  float fi = floor(h / floorH);
  float fy = fract(h / floorH);
  if (abs(bay) > bayW * 0.2 && abs(bay) < bayW * 0.38 && fy > 0.25 && fy < 0.8 && h > 0.008 && h < top - 0.01) {
    float on = step(0.5, hash21(vec2(bi * 3.0 + sign(bay), fi + floor(t / 19.0 + hash21(vec2(bi, fi)) * 4.0))));
    return mix(vec4(stone, 0.16), vec4(LONDON_AMBER, 0.78), on);
  }
  return vec4(stone, 0.32 + 0.18 * max(buttress, parapet));
}

// Tower Bridge downstream, smaller and paler: two towers with steep roofs
// and corner turrets, the high walkways between them, the road deck and the
// suspension chains swinging down to either shore.
vec4 londonTowerBridge(vec2 p, float px, float bx, out float cover) {
  cover = 0.0;
  float x = p.x - bx;
  float h = p.y - LONDON_BANK;
  float ox = abs(x);
  if (ox > 0.34 || h < -0.001 || h > 0.215) {
    return vec4(0.0);
  }
  float line = max(px * 0.5, 0.0025);
  vec3 stone = vec3(0.72, 0.76, 0.86);
  float tq = abs(ox - 0.1);
  if (tq < 0.024) {
    if (h < 0.15 && tq < 0.019) {
      cover = 1.0;
      // The arch the road runs through, then lancet windows above it.
      if (tq < 0.011 && h > 0.03 && h < 0.05 + 0.01 * (1.0 - tq / 0.011)) {
        return vec4(stone, 0.12);
      }
      float slit = step(tq, 0.005) * step(0.08, h) * step(h, 0.12);
      if (slit > 0.5 && fract(h / 0.02) < 0.6) {
        return vec4(LONDON_AMBER, 0.62);
      }
      float rim = 1.0 - smoothstep(line * 0.6, line * 2.0, 0.019 - tq);
      return vec4(stone, 0.3 + 0.25 * rim);
    }
    if (h >= 0.15) {
      float s = (h - 0.15) / 0.045;
      if (tq < max(0.019 * (1.0 - s), line * 0.5) && h < 0.198) {
        cover = 1.0;
        return vec4(stone, 0.42);
      }
      float turret = abs(tq - 0.018);
      if (turret < max(0.004 * (1.0 - (h - 0.15) / 0.026), line * 0.5) && h < 0.176) {
        cover = 1.0;
        return vec4(stone, 0.5);
      }
      if (tq < line * 0.5 && h < 0.21) {
        cover = 1.0;
        return vec4(stone, 0.45);
      }
    }
  }
  // The high walkways: two girders with lattice between.
  if (ox < 0.082 && h > 0.122 && h < 0.142) {
    cover = 1.0;
    float chord = max(1.0 - smoothstep(line * 0.5, line * 1.5, abs(h - 0.123)), 1.0 - smoothstep(line * 0.5, line * 1.5, abs(h - 0.141)));
    float lattice = step(0.5, fract((x + h) / max(px * 1.6, 0.012)));
    return vec4(stone, 0.18 + 0.12 * lattice + 0.24 * chord);
  }
  // The road deck, lamps along it.
  if (h > 0.028 && h < 0.036 + line) {
    cover = 1.0;
    float lamp = step(abs(mod(x, 0.04) - 0.02), max(0.003, px * 0.4));
    return mix(vec4(stone, 0.32), vec4(LONDON_AMBER, 0.9), lamp);
  }
  // The chains over the side spans, with hangers down to the deck.
  if (ox > 0.12 && ox < 0.32) {
    float s = (ox - 0.12) / 0.2;
    float chain = 0.034 + 0.1 * (1.0 - s) * (1.0 - s);
    if (abs(h - chain) < line) {
      cover = 1.0;
      return vec4(stone, 0.4);
    }
    if (h > 0.036 && h < chain && abs(mod(x, 0.02) - 0.01) < line * 0.4) {
      cover = 1.0;
      return vec4(stone, 0.18);
    }
  }
  return vec4(0.0);
}

// Low roofs on the far shore, a few windows lit.
vec4 londonCity(vec2 p, float px, out float cover) {
  cover = 0.0;
  float h = p.y - LONDON_BANK;
  if (h < 0.0 || h > 0.07) {
    return vec4(0.0);
  }
  float id = floor(p.x * 26.0);
  float top = 0.012 + 0.05 * hash21(vec2(id, 3.1)) * hash21(vec2(id, 8.3));
  if (h > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 win = floor(p / (px * vec2(1.6, 2.0)));
  float on = step(0.85, hash21(win + 5.0)) * step(px * 1.5, top - h);
  return mix(vec4(0.5, 0.56, 0.72, 0.1), vec4(LONDON_AMBER, 0.55), on);
}

// The near bridge, painted green like Westminster Bridge: low arches, a
// balustrade and lamp standards over each pier.
vec4 londonBridge(vec2 q, float px, out float cover, out float light) {
  cover = 0.0;
  light = 0.0;
  if (q.y < 0.04 || q.y > 0.34) {
    return vec4(0.0);
  }
  float line = max(px * 0.5, 0.0025);
  vec3 green = vec3(0.46, 0.66, 0.52);
  float pier = mod(q.x + LONDON_SPAN * 0.5, LONDON_SPAN) - LONDON_SPAN * 0.5;
  if (q.y > LONDON_DECK) {
    // A standard with three lanterns: one on top, two on short arms.
    float post = max(0.0026, px * 0.42);
    if (abs(pier) < post && q.y < 0.286) {
      cover = 1.0;
      return vec4(green, 0.36);
    }
    // Each lantern is at least one sample row tall, so it never falls between rows.
    float head = max(0.0055, px * 0.65);
    float lantern = max(0.016, px * 1.02);
    float side = abs(abs(pier) - 0.018);
    if ((abs(pier) < head && q.y > 0.286 && q.y < 0.286 + lantern) || (side < head && q.y > 0.262 && q.y < 0.262 + lantern)) {
      cover = 1.0;
      light = 1.0;
      return vec4(LONDON_AMBER, 1.0);
    }
    if (abs(pier) < 0.018 && abs(q.y - 0.262) < line * 0.6) {
      cover = 1.0;
      return vec4(green, 0.36);
    }
    return vec4(0.0);
  }
  if (q.y > 0.17) {
    cover = 1.0;
    float coping = 1.0 - smoothstep(line * 0.5, line * 1.5, LONDON_DECK - q.y);
    if (q.y > 0.184) {
      float baluster = step(0.5, fract(q.x / max(px * 1.4, 0.012)));
      return vec4(green, max(0.16 + 0.12 * baluster, 0.42 * coping));
    }
    float fascia = 1.0 - smoothstep(line * 0.5, line * 1.5, abs(q.y - 0.177));
    return vec4(green, 0.34 + 0.16 * fascia);
  }
  float a = mod(q.x, LONDON_SPAN) - LONDON_SPAN * 0.5;
  float halfSpan = LONDON_SPAN * 0.5 - 0.024;
  float s = a / halfSpan;
  float crown = 0.06 + 0.104 * sqrt(max(0.0, 1.0 - s * s));
  if (abs(a) < halfSpan && q.y < crown) {
    return vec4(0.0);
  }
  cover = 1.0;
  // The arch rings catch the lamplight; the spandrels stay dark.
  float ring = abs(a) < halfSpan ? 1.0 - smoothstep(line * 0.8, line * 2.2, q.y - crown) : 0.0;
  float cutwater = 1.0 - smoothstep(line * 0.6, line * 1.8, abs(pier));
  return vec4(green * 0.9, 0.2 + 0.26 * max(ring, cutwater * step(q.y, 0.08)));
}

// A red double-decker crossing the bridge, both decks lit, its headlamp
// throwing a short beam into the fog.
vec4 londonBus(vec2 q, float px, float aspect, float t, out float cover) {
  cover = 0.0;
  // Measured in u, never less than half a sample row, so each band of
  // windows is at least one row tall and always lands on samples.
  float u = max(0.011, px * 0.5);
  float len = u * 13.0;
  float tall = u * 8.0;
  float travel = aspect + 0.6;
  float x0 = mod(t * 0.04 + aspect * 0.4, travel) - 0.3;
  float lx = q.x - x0;
  float y = q.y - LONDON_DECK;
  if (lx < 0.0 || lx > len + 0.12 || y < 0.0 || y > tall) {
    return vec4(0.0);
  }
  vec3 red = vec3(0.92, 0.14, 0.1);
  vec3 glass = vec3(1.0, 0.8, 0.5);
  if (lx > len) {
    float dist = lx - len;
    float spread = u * 0.6 + dist * 0.22;
    float by = (y - u * 1.4) / spread;
    float beam = exp(-by * by) * exp(-dist * 18.0);
    if (beam > 0.08) {
      cover = 1.0;
      return vec4(1.0, 0.92, 0.72, 0.55 * beam);
    }
    return vec4(0.0);
  }
  // A rounded roof at the front.
  float rr = u * 1.4;
  vec2 corner = vec2(lx - (len - rr), y - (tall - rr));
  if (corner.x > 0.0 && corner.y > 0.0 && length(corner) > rr) {
    return vec4(0.0);
  }
  float wheel = min(length(vec2(lx - u * 2.6, y - u)), length(vec2(lx - (len - u * 2.8), y - u)));
  if (wheel < u) {
    cover = 1.0;
    return vec4(0.3, 0.3, 0.34, wheel < u * 0.35 ? 0.4 : 0.12);
  }
  if (y < u * 0.6) {
    return vec4(0.0);
  }
  cover = 1.0;
  float pillar = max(0.002, px * 0.18);
  float bayW = u * 3.0;
  bool between = abs(mod(lx - u, bayW) - bayW * 0.5) > pillar;
  // Headlamp and tail lamp.
  if (lx > len - u * 0.5 && y > u && y < u * 2.0) {
    return vec4(1.0, 0.96, 0.84, 1.0);
  }
  if (lx < u * 0.5 && y > u && y < u * 2.0) {
    return vec4(1.0, 0.2, 0.12, 0.85);
  }
  // The windscreen, the destination blind, then two bands of windows.
  if (lx > len - u * 1.3 && y > u * 2.2 && y < u * 4.4) {
    return vec4(glass, 0.8);
  }
  if (lx > len - u * 1.3 && y > u * 5.2 && y < u * 7.2) {
    return vec4(1.0, 0.94, 0.7, 0.9);
  }
  if (lx > u && lx < len - u * 1.8 && between && ((y > u * 2.2 && y < u * 4.2) || (y > u * 5.2 && y < u * 7.2))) {
    return vec4(glass, 0.82);
  }
  return vec4(red, 0.56);
}

vec4 londonWater(vec2 p, float px, float cx, float t) {
  float depth = LONDON_WATER - p.y;
  // Ripples: short streaks that drift and shimmer.
  float wave = snoise(vec2(p.x * 6.0 + t * 0.04, p.y * 80.0 + t * 0.5 + sin(p.x * 9.0) * 2.0));
  float rip = smoothstep(0.0, 0.8, wave);
  // The clock tower and Parliament in the river, broken up by the ripples.
  vec2 rp = vec2(p.x + 0.009 * snoise(vec2(p.y * 60.0, t * 0.6)), LONDON_WATER + depth * 1.08);
  float rc;
  float kind;
  float rt = londonTower(vec2(rp.x - cx, rp.y - LONDON_BANK) / LONDON_TOWER, px / LONDON_TOWER, t, rc, kind);
  float fade = exp(-depth * 3.0);
  float tower = rc * rt * (0.2 + 0.8 * rip) * fade;
  float pc;
  vec4 front = londonParliament(rp, px, cx, t, pc);
  float hall = pc * front.a * (0.2 + 0.8 * rip) * fade * 0.55;
  // Each lamp on the embankment drops a long amber streak.
  float wobble = 0.004 * snoise(vec2(p.y * 50.0, t * 0.8 + p.x));
  float lane = abs(mod(p.x + wobble, LONDON_LAMPS) - LONDON_LAMPS * 0.5);
  float streak = step(lane, max(0.004, px * 0.55)) * rip * exp(-depth * 7.0);
  // The bridge lamps reflect in the strip of river in front of it.
  float pier = abs(mod(p.x + wobble + LONDON_SPAN * 0.5, LONDON_SPAN) - LONDON_SPAN * 0.5);
  float near = step(p.y, 0.04) * step(pier, max(0.007, px * 0.8)) * rip * exp(-(0.04 - p.y) * 14.0);
  float glow = max(streak * 0.75, near * 0.85);
  float tone = max(max(tower * 0.85, hall), max(glow, rip * 0.085));
  vec3 col = vec3(0.44, 0.54, 0.72);
  col = mix(col, LONDON_AMBER, step(0.05, max(max(tower, hall), glow)));
  return vec4(col, tone);
}

vec4 londonSky(vec2 p) {
  // The fog over the city glows faintly from the streetlights below.
  float glow = exp(-max(p.y - LONDON_BANK, 0.0) * 6.0);
  vec3 col = mix(LONDON_FOG, vec3(0.95, 0.7, 0.46), glow * 0.7);
  return vec4(col, glow * 0.07);
}

// Fog in banks: two warped noise layers drifting at different speeds, one
// lying low on the river and one across the towers.
float londonFogDensity(vec2 p, float t) {
  vec2 q = vec2(p.x * 1.3 - t * 0.022, p.y * 5.0);
  float n = fbm(q + vec2(fbm(q * 0.5 + vec2(3.1, t * 0.01)) * 1.4, 0.0));
  float ly = (p.y - 0.37) / 0.1;
  float hy = (p.y - 0.64) / 0.12;
  float low = exp(-ly * ly);
  float high = 0.75 * exp(-hy * hy);
  float bank = smoothstep(0.7 - londonFog * 0.24, 0.9 - londonFog * 0.16, n);
  return bank * max(low, high) * smoothstep(0.0, 0.08, londonFog);
}

vec2 londonCacheUv = vec2(-1.0);
float londonCacheT = -1.0;
vec4 londonCacheValue = vec4(0.0);

vec4 londonScene(vec2 uv, vec2 res, float t) {
  if (uv == londonCacheUv && t == londonCacheT) {
    return londonCacheValue;
  }
  float aspect = res.x / res.y;
  float px = 1.0 / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float cx = londonTowerX(aspect);
  float bx = londonBridgeX(aspect, cx);
  // Nearer layers slide further with the pointer.
  float ptr = (u_pointer.x - 0.5) * u_pointer.z * londonParallax;
  float cover;
  float light = 0.0;
  // How much fog sits between the eye and the layer that won.
  float depth = 1.0;
  vec4 hit = vec4(0.0);
  bool done = false;

  vec2 nq = p + vec2(ptr * 0.05, 0.0);
  hit = londonBridge(nq, px, cover, light);
  done = cover > 0.5;
  depth = 0.18;
  if (!done && londonBusOn > 0.5) {
    hit = londonBus(nq, px, aspect, t, cover);
    done = cover > 0.5;
    depth = 0.12;
  }
  if (!done && p.y < LONDON_WATER) {
    hit = londonWater(p + vec2(ptr * (p.y < 0.17 ? 0.05 : 0.03), 0.0), px, cx, t);
    done = true;
    depth = p.y < 0.17 ? 0.25 : 0.5;
  }
  vec2 mq = p + vec2(ptr * 0.03, 0.0);
  if (!done && p.y < LONDON_BANK) {
    // The embankment wall, with its string of lamps along the top.
    float lane = mod(mq.x, LONDON_LAMPS) - LONDON_LAMPS * 0.5;
    bool lamp = abs(lane) < max(0.0045, px * 0.6) && p.y > LONDON_BANK - 0.007;
    hit = lamp ? vec4(LONDON_AMBER, 1.0) : vec4(0.62, 0.6, 0.62, 0.22);
    light = lamp ? 1.0 : 0.0;
    done = true;
    depth = 0.5;
  }
  if (!done) {
    vec2 tp = vec2(mq.x - cx, mq.y - LONDON_BANK) / LONDON_TOWER;
    float kind;
    float tone = londonTower(tp, px / LONDON_TOWER, t, cover, kind);
    if (cover > 0.5) {
      hit = vec4(londonTowerColor(kind, tp.y), tone);
      light = (kind > 0.5 && kind < 2.5) ? 1.0 : 0.0;
      done = true;
      depth = 0.42;
    }
  }
  if (!done) {
    hit = londonParliament(mq, px, cx, t, cover);
    done = cover > 0.5;
    light = hit.a > 0.7 ? 1.0 : 0.0;
    depth = 0.5;
  }
  vec2 fq = p + vec2(ptr * 0.015, 0.0);
  if (!done) {
    hit = londonTowerBridge(fq, px, bx, cover);
    done = cover > 0.5;
    light = hit.a > 0.6 ? 1.0 : 0.0;
    depth = 0.85;
  }
  if (!done) {
    hit = londonCity(fq, px, cover);
    done = cover > 0.5;
    light = hit.a > 0.5 ? 1.0 : 0.0;
    depth = 0.95;
  }
  if (!done) {
    hit = londonSky(p);
    depth = 1.0;
  }

  // Fog over everything, thicker with distance. Lights dim less than stone.
  float fog = londonFogDensity(p + vec2(ptr * 0.02, 0.0), t);
  float veil = fog * depth;
  float fogTone = 0.3 + 0.12 * fog;
  float tone = light > 0.5 ? hit.a * (1.0 - 0.4 * veil) : mix(hit.a, fogTone, veil);
  vec3 col = mix(hit.rgb, LONDON_FOG, veil * (light > 0.5 ? 0.3 : 0.85));

  // Amber halos around the lamps and the clock face, wider in thick fog.
  float pier = mod(nq.x + LONDON_SPAN * 0.5, LONDON_SPAN) - LONDON_SPAN * 0.5;
  float halo = exp(-length(vec2(pier, nq.y - 0.288)) / 0.024);
  float lane = mod(mq.x, LONDON_LAMPS) - LONDON_LAMPS * 0.5;
  halo = max(halo, 0.7 * exp(-length(vec2(lane, mq.y - LONDON_BANK + 0.004)) / 0.012));
  vec2 face = vec2(cx, LONDON_BANK + LONDON_TOWER * 0.69);
  halo = max(halo, 0.8 * exp(-max(length(mq - face) - LONDON_TOWER * 0.08, 0.0) / 0.03));
  halo *= 0.35 + 0.65 * fog;
  if (light < 0.5 && halo > 0.04) {
    tone = max(tone, halo * 0.6);
    col = mix(col, LONDON_AMBER, clamp(halo * 1.3, 0.0, 0.9));
  }

  // Near-black becomes paper, so the sky keeps clean gaps between glyphs.
  tone = tone < 0.05 ? 0.0 : clamp(tone, 0.0, 1.0) * londonIntensity;
  londonCacheUv = uv;
  londonCacheT = t;
  londonCacheValue = vec4(col, tone);
  return londonCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return londonScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return londonScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its foggy night behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const FOG_NIGHT = "#0a0f17";
const FOG_NIGHT_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #0a0f17 0%, #1a2230 45%, #4a4038 64%, #0c121c 66%, #0a0f17 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface LondonProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** How thick the fog banks are, from 0 (clear night) to 1. Default 0.6. */
  fog?: number;
  /** The red double-decker crossing the bridge. Default `true`. */
  bus?: boolean;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's foggy night in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * London on a foggy evening. The Elizabeth Tower keeps time over the
 * Thames beside the Houses of Parliament, Tower Bridge stands downstream,
 * fog banks drift through and a red bus crosses the bridge under amber
 * lamps. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const London = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  cell = 12,
  // Low, so the stone and the green bridge still light Braille and quadrant dots.
  threshold = 0.3,
  stillTime = 8,
  interactive = true,
  interaction = "none",
  intensity = 1,
  fog = 0.6,
  bus = true,
  fallback = FALLBACK,
  ...props
}: LondonProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        londonBusOn: bus ? 1 : 0,
        londonFog: clamp(fog, 0, 1),
        londonIntensity: clamp(intensity, 0, 1),
        londonParallax: interactive ? 1 : 0,
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (FOG_NIGHT_MODES.has(mode) ? FOG_NIGHT : undefined)}
      cell={cell}
      threshold={threshold}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
