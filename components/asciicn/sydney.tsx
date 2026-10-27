"use client";

import type { ReactNode } from "react";

import type {
  AsciiColor,
  AsciiSceneProps,
  ColorMode,
  Interaction,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// The scene is painted back to front: stars, fireworks, the far skyline
// with Sydney Tower, the Harbour Bridge, then the Opera House on its
// podium. Below the waterline the same picture is drawn again from its
// mirror image, stretched with depth so the fireworks reach the water, and
// broken into ripple streaks; the ferry crosses on top. Landmarks live in a
// scene frame (y 0 to 1, x centred, same units both ways) that shrinks
// about the waterline on narrow boxes so both landmarks stay in view;
// stars and fireworks use the box's own frame so they still fill the sky.
// Glyph colour carries brightness in truecolor, and tone carries presence:
// anything Braille should dot sits above 0.5, fills sit below it. Braille
// and quadrant cells average the colour of all their samples, lit or not,
// so empty samples near a light take its colour (at zero tone) to keep a
// thin spark trail from fading to grey.
const SCENE = `
const float SYDNEY_WATER = 0.27;
const float SYDNEY_DECK = 0.36;
const float SYDNEY_PODIUM = 0.3;
const float SYDNEY_BRIDGE_X = 0.4;
const float SYDNEY_SPAN = 0.36;
const float SYDNEY_OPERA_X = -0.41;
const float SYDNEY_OPERA_SCALE = 1.2;
const float SYDNEY_TOWER_X = -0.08;
const float SYDNEY_FERRY_Y = 0.13;

// Integral of a 0/1 pulse that is on from a to b in every unit period.
float sydneyPulseSum(float x, float a, float b) {
  return floor(x) * (b - a) + clamp(fract(x) - a, 0.0, b - a);
}

// How much of a footprint fw wide, centred on x, the pulse covers.
float sydneyPulse(float x, float a, float b, float fw) {
  float w = max(fw, 1e-4);
  return (sydneyPulseSum(x + w * 0.5, a, b) - sydneyPulseSum(x - w * 0.5, a, b)) / w;
}

// A stroke at distance d from its centre line, never thinner than a sample.
float sydneyStroke(float d, float w, float fw) {
  float hw = max(w, fw * 0.55);
  return 1.0 - smoothstep(hw, hw + fw * 0.6, d);
}

void sydneyPaint(inout vec4 acc, vec4 layer, float cover) {
  acc = mix(acc, layer, clamp(cover, 0.0, 1.0));
}

// Paints a layer and keeps the colour of the nearest light it passes on to
// empty samples: a layer returns its colour at zero tone where it is near
// but not drawn.
void sydneyLayer(inout vec4 acc, inout vec3 halo, vec4 layer, float cover) {
  if (cover > 0.001) {
    sydneyPaint(acc, layer, cover);
    halo = layer.rgb;
  } else if (layer.a < 0.001 && dot(layer.rgb, vec3(1.0)) > 0.0) {
    halo = layer.rgb;
  }
}

vec4 sydneyStars(vec2 p, float t, vec2 px) {
  if (p.y < 0.5) {
    return vec4(0.0);
  }
  vec2 g = p / 0.05;
  vec2 id = floor(g);
  float r = hash21(id + 7.7);
  if (r < 0.86) {
    return vec4(0.0);
  }
  vec2 at = vec2(hash21(id + 2.3), hash21(id + 9.1)) * 0.7 + 0.15;
  // One sample per star, whatever the charset.
  vec2 d = abs((fract(g) - at) * 0.05);
  float twinkle = 0.55 + 0.45 * sin(t * (0.7 + r * 2.5) + r * 40.0);
  float star = step(d.x, px.x * 0.5) * step(d.y, px.y * 0.5) * smoothstep(0.5, 0.66, p.y);
  return vec4(vec3(0.78, 0.84, 1.0) * twinkle, star * (0.45 + 0.4 * twinkle));
}

// Shell colours: bright, saturated hues, with gold for willows.
vec3 sydneyShellColor(float h, float willow) {
  vec3 hue = toSrgb(oklch(0.8, 0.19, h * 6.2831853));
  return mix(hue, vec3(1.0, 0.78, 0.36), willow);
}

// Where a spark is tau seconds after the break: it flies out along dir,
// slowed by drag, and droops as it falls.
vec2 sydneySpark(float tau, vec2 dir, float reach, float drag, float fall) {
  return dir * reach * (1.0 - exp(-drag * tau)) - vec2(0.0, fall * tau * tau);
}

// Distance from q to one spark's trail, and how long ago the spark passed
// the nearest point, through behind. The trail is six straight pieces.
float sydneyTrail(vec2 q, float j, float stepA, float seed, float ring, float age, float trail, float radius, float drag, float fall, out float behind) {
  float a = (j + (hash21(vec2(j, seed + 3.0)) - 0.5) * 0.35) * stepA;
  vec2 dir = vec2(cos(a), sin(a));
  float reach = radius * mix(0.72 + 0.32 * hash21(vec2(j, seed)), 1.0, ring);
  float t0 = max(age - trail, 0.0);
  float best = 1e3;
  behind = 0.0;
  vec2 from = sydneySpark(age, dir, reach, drag, fall);
  for (int k = 1; k <= 6; k++) {
    float tk = mix(age, t0, float(k) / 6.0);
    vec2 to = sydneySpark(tk, dir, reach, drag, fall);
    vec2 seg = to - from;
    float h = clamp(dot(q - from, seg) / max(dot(seg, seg), 1e-8), 0.0, 1.0);
    float d = length(q - from - seg * h);
    if (d < best) {
      best = d;
      behind = age - mix(mix(age, t0, float(k - 1) / 6.0), tk, h);
    }
    from = to;
  }
  return best;
}

// One burst, age seconds old. Sparks fly out from the centre, slow down,
// droop and fade, each leaving a trail; late in life they glitter as they
// fall. Each sample checks only the two sparks whose paths pass nearest,
// so the cost doesn't grow with the spark count.
vec4 sydneyBurst(vec2 q, float age, float radius, float kind, float seed, vec3 tint, vec2 px, float t) {
  float willow = step(0.7, kind);
  float ring = step(kind, 0.25);
  float life = mix(2.1, 3.1, willow);
  if (age < 0.0 || age > life) {
    return vec4(0.0);
  }
  float drag = mix(2.7, 1.6, willow);
  float fall = mix(0.22, 0.4, willow) * radius;
  float trail = mix(mix(0.55, 0.25, ring), 1.2, willow);
  float droop = fall * age * age;
  if (length(q + vec2(0.0, droop * 0.5)) > radius * 1.2 + droop) {
    return vec4(0.0);
  }
  float fade = 1.0 - smoothstep(life * 0.5, life, age);
  vec4 near = vec4(tint * fade, 0.0);
  float sparks = mix(22.0, 30.0, ring);
  float stepA = 6.2831853 / sparks;
  // Undo the droop of the trail's middle to find which sparks are nearest.
  float mid = max(age - trail * 0.4, 0.0);
  vec2 g = q + vec2(0.0, fall * mid * mid);
  float x = atan(g.y, g.x) / stepA;
  float j = floor(x);
  float b0;
  float b1;
  float d0 = sydneyTrail(q, j, stepA, seed, ring, age, trail, radius, drag, fall, b0);
  float d1 = sydneyTrail(q, j + 1.0, stepA, seed, ring, age, trail, radius, drag, fall, b1);
  float d = min(d0, d1);
  float behind = d0 < d1 ? b0 : b1;
  float spark = d0 < d1 ? j : j + 1.0;
  float head = 1.0 - smoothstep(0.0, 0.08, behind);
  float tail = pow(1.0 - clamp(behind / trail, 0.0, 1.0), 1.3);
  float line = sydneyStroke(d, px.x * (0.9 + 0.8 * head), px.x);
  float glitter = mix(1.0, step(0.4, hash21(vec2(spark * 7.0 + floor(t * 14.0), seed + floor(behind * 20.0)))), smoothstep(0.9, 1.6, age));
  float glow = line * tail * fade * glitter;
  // The flash at the centre as the shell breaks.
  float flash = (1.0 - smoothstep(0.0, 0.12, age)) * (1.0 - smoothstep(radius * 0.04, radius * 0.1, length(q)));
  glow = max(glow, flash);
  if (glow < 0.02) {
    return near;
  }
  vec3 col = mix(tint, vec3(1.0, 0.62, 0.28), smoothstep(0.3, 1.0, behind / trail) * 0.5 * (1.0 - willow));
  col = mix(col, vec3(1.0, 0.97, 0.9), max(head * 0.5, flash));
  return vec4(col * (0.55 + 0.45 * glow), 0.3 + 0.7 * glow);
}

// A rocket climbing from (x, from) to (x, to), k of the way through its rise.
vec4 sydneyRocket(vec2 p, float x, float from, float to, float k, vec2 px, float t) {
  float y = mix(from, to, 1.0 - (1.0 - k) * (1.0 - k));
  float along = y - p.y;
  float len = 0.06;
  vec4 near = vec4(1.0, 0.82, 0.55, 0.0) * step(abs(p.x - x), px.x * 4.0);
  if (along < -px.y || along > len) {
    return near;
  }
  float lateral = abs(p.x - x - 0.0025 * sin(p.y * 140.0 + x * 30.0) * along / len);
  float line = sydneyStroke(lateral, px.x * 0.6, px.x);
  float sparkle = 0.75 + 0.25 * step(0.5, hash21(vec2(floor(p.y / px.y), floor(t * 20.0))));
  float glow = line * pow(1.0 - clamp(along / len, 0.0, 1.0), 1.5) * sparkle;
  if (glow < 0.02) {
    return near;
  }
  return vec4(vec3(1.0, 0.82, 0.55) * (0.4 + 0.6 * glow), 0.3 + 0.7 * glow);
}

// Five shells on their own clocks, plus one wherever the pointer clicks.
// flash returns the colour and strength of the newest break, which lights
// the steel and the sails.
vec4 sydneyShow(vec2 p, float t, vec2 px, float aspect, float bridgeX, float deckY, out vec4 flash) {
  vec4 acc = vec4(0.0);
  flash = vec4(0.0);
  float spread = min(aspect * 0.4, 0.5);
  float scale = clamp(aspect, 0.65, 1.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    if (fi + 0.5 > sydneyFireworks * 5.0) {
      break;
    }
    float period = 3.9 + fi * 0.83;
    // Offsets put every shell in bloom at the default stillTime of 4 s.
    float clock = t + fi + 1.3;
    float cycle = floor(clock / period);
    float age = clock - cycle * period;
    vec2 seed = vec2(cycle * 1.31, fi * 13.1);
    vec2 at = vec2(bridgeX + (hash21(seed + 0.3) - 0.5) * 2.0 * spread, 0.6 + 0.23 * hash21(seed + 1.7));
    float radius = (0.09 + 0.07 * hash21(seed + 2.9)) * scale;
    at.x = clamp(at.x, radius - aspect * 0.5, aspect * 0.5 - radius);
    float rise = 0.7 + 0.25 * hash21(seed + 4.1);
    float kind = hash21(seed + 5.5);
    vec3 tint = sydneyShellColor(hash21(seed + 6.7), step(0.7, kind));
    vec4 shell;
    if (age < rise) {
      shell = sydneyRocket(p, at.x, deckY, at.y, age / rise, px, t);
    } else {
      shell = sydneyBurst(p - at, age - rise, radius, kind, seed.x + fi, tint, px, t);
      float lit = 1.0 - smoothstep(0.0, 0.9, age - rise);
      if (lit > flash.a) {
        flash = vec4(tint, lit);
      }
    }
    if (shell.a > acc.a || (acc.a < 0.001 && shell.rgb != vec3(0.0))) {
      acc = shell;
    }
  }
  // A click launches a shell from the deck below it.
  float since = u_click.z;
  if (sydneyPointer > 0.5 && since < 4.0) {
    vec2 at = vec2((u_click.x - 0.5) * aspect, max(u_click.y, deckY + 0.08));
    float rise = 0.45;
    vec4 shell;
    vec3 tint = sydneyShellColor(fract(u_click.x * 3.7 + u_click.y * 1.3), 0.0);
    if (since < rise) {
      shell = sydneyRocket(p, at.x, deckY, at.y, since / rise, px, t);
    } else {
      shell = sydneyBurst(p - at, since - rise, 0.11 * scale, 0.5, 91.0, tint, px, t);
      float lit = 1.0 - smoothstep(0.0, 0.9, since - rise);
      if (lit > flash.a) {
        flash = vec4(tint, lit);
      }
    }
    if (shell.a > acc.a || (acc.a < 0.001 && shell.rgb != vec3(0.0))) {
      acc = shell;
    }
  }
  return acc;
}

// The far skyline: the CBD's towers to the left of the bridge, North
// Sydney's to the right, and Sydney Tower's golden turret above them.
vec4 sydneyCity(vec2 p, float t, vec2 px, out float cover) {
  cover = 0.0;
  if (p.y < SYDNEY_WATER || p.y > 0.7) {
    return vec4(0.0);
  }
  float tx = abs(p.x - SYDNEY_TOWER_X);
  if (tx < 0.02) {
    float lo = 0.555;
    float hi = 0.595;
    if (p.y < lo && tx < max(0.0032, px.x * 0.6)) {
      cover = 1.0;
      return vec4(vec3(0.62, 0.6, 0.56), 0.56);
    }
    if (p.y >= lo && p.y < hi) {
      // The turret flares out from the shaft, with a band of gold glass.
      float s = (p.y - lo) / (hi - lo);
      float hw = 0.004 + 0.0115 * smoothstep(0.0, 0.3, s) - 0.003 * smoothstep(0.82, 1.0, s);
      if (tx < hw) {
        cover = 1.0;
        float glass = step(0.36, s) * step(s, 0.74);
        float rim = step(tx, hw - px.x * 1.1);
        return glass > 0.5
          ? vec4(vec3(1.0, 0.76, 0.3), 0.92)
          : vec4(vec3(0.82, 0.74, 0.58) * mix(0.6, 1.0, rim), 0.62);
      }
    }
    if (p.y >= hi && p.y < 0.66 && tx < max(0.0012, px.x * 0.5)) {
      cover = 1.0;
      float beacon = step(0.66 - px.y * 2.0, p.y) * step(0.5, fract(t * 0.5));
      return mix(vec4(vec3(0.6, 0.6, 0.62), 0.55), vec4(1.0, 0.15, 0.1, 0.95), beacon);
    }
  }
  float w = 0.026;
  float xs = p.x / w;
  float id = floor(xs);
  float f = fract(xs);
  float r1 = hash21(vec2(id, 3.1));
  float r2 = hash21(vec2(id, 8.4));
  float r3 = hash21(vec2(id, 12.9));
  float left = 0.04 + r2 * 0.14;
  float right = 0.96 - r3 * 0.14;
  if (f < left || f > right) {
    return vec4(0.0);
  }
  float cx = (id + 0.5) * w;
  float cbd = exp(-pow((cx + 0.04) / 0.22, 2.0));
  float north = exp(-pow((cx - 0.9) / 0.16, 2.0));
  float top = 0.31 + 0.22 * cbd + 0.08 * north;
  float h = 0.285 + (top - 0.285) * (0.45 + 0.55 * pow(r1, 1.2));
  // Setback crowns on the tall ones.
  float mid = abs(f - (left + right) * 0.5) / (right - left);
  if (r2 > 0.6 && mid < 0.3 && h > 0.34) {
    h += 0.012 + 0.016 * r3;
  }
  if (p.y > h) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 size = vec2(0.0065, 0.0095);
  vec2 g = vec2(p.x - (id + left) * w, p.y) / size;
  float on = sydneyPulse(g.x, 0.25, 0.75, px.x / size.x) * sydneyPulse(g.y, 0.3, 0.75, px.y / size.y);
  vec2 cell = floor(g);
  float epoch = floor(t * 0.05 + hash21(cell + id) * 9.0);
  float lit = step(0.5, hash21(cell * 1.3 + vec2(id, epoch)));
  float glass = on * lit;
  float roof = 1.0 - smoothstep(px.y * 0.6, px.y * 1.6, h - p.y);
  vec3 warm = r3 < 0.55 ? vec3(1.0, 0.84, 0.58) : vec3(0.7, 0.84, 1.0);
  if (glass > 0.3) {
    return vec4(warm, 0.52 + 0.3 * glass);
  }
  // The facade takes its windows' colour at low tone, so lit windows keep
  // their colour where a cell averages them with the wall.
  return vec4(mix(warm, vec3(0.5, 0.6, 0.95), max(roof, 0.5)), max(roof * 0.56, 0.12));
}

// The Harbour Bridge: two granite pylons at each end, the steel arch with
// its top and bottom chords and the truss between them, hangers down to
// the deck, and a row of lamps along the deck.
vec4 sydneyBridge(vec2 p, float t, vec2 px, vec4 flash, out float cover) {
  cover = 0.0;
  float u = (p.x - SYDNEY_BRIDGE_X) / SYDNEY_SPAN;
  float au = abs(u);
  if (p.y < SYDNEY_WATER || p.y > 0.62 || u < -1.6) {
    return vec4(0.0);
  }
  vec3 steel = mix(vec3(0.56, 0.64, 0.82), flash.rgb, flash.a * 0.35);
  float bright = 1.0 + flash.a * 0.35;
  vec2 fu = px / SYDNEY_SPAN;
  // The deck, with its lamps along the top edge.
  float deck = SYDNEY_DECK - 0.01 * smoothstep(1.15, 1.6, au);
  if (p.y < deck && p.y > deck - 0.011) {
    cover = 1.0;
    float lip = step(deck - px.y * 1.3, p.y);
    float lamp = sydneyPulse(p.x / 0.016, 0.0, 0.3, px.x / 0.016) * lip;
    if (lamp > 0.4) {
      float glint = 0.85 + 0.15 * sin(t * 2.0 + floor(p.x / 0.016) * 1.7);
      return vec4(vec3(1.0, 0.86, 0.55) * glint, 0.95);
    }
    return vec4(steel * 0.85, mix(0.36, 0.6, lip));
  }
  // Pylons: granite towers at each end of the arch.
  if (au > 1.0 && au < 1.13) {
    float s = (au - 1.0) / 0.13;
    float top = 0.465 - 0.012 * step(0.25, abs(s - 0.5) * 2.0);
    if (p.y < top) {
      cover = 1.0;
      // An arched opening where the deck runs through.
      if (abs(s - 0.5) < 0.24 && p.y > deck - 0.035 && p.y < deck + 0.025 + 0.012 * (1.0 - pow(abs(s - 0.5) / 0.24, 2.0))) {
        return vec4(vec3(0.2, 0.18, 0.2), 0.0);
      }
      float course = sydneyPulse(p.y / 0.012, 0.0, 0.14, px.y / 0.012);
      float edge = step(min(s, 1.0 - s) * 0.13 * SYDNEY_SPAN, px.x * 1.1);
      vec3 stone = vec3(0.95, 0.82, 0.64) * mix(0.75, 1.0, 1.0 - smoothstep(SYDNEY_WATER, top, p.y)) * bright;
      return vec4(stone, max(0.62 - course * 0.3, edge * 0.7));
    }
    return vec4(0.0);
  }
  // Approach spans: piers from the water up to the deck.
  if (au >= 1.13) {
    if (p.y < deck - 0.011 && sydneyPulse(p.x / 0.05, 0.0, 0.12, px.x / 0.05) > 0.3) {
      cover = 1.0;
      return vec4(steel * 0.45, 0.4);
    }
    return vec4(0.0);
  }
  float k = 1.0 - u * u;
  float yb = 0.293 + 0.252 * k;
  float yt = 0.425 + 0.16 * pow(k, 0.72);
  // Distances to the chords, measured across their slope.
  float sb = 0.504 * au / SYDNEY_SPAN;
  float st = 0.16 * 0.72 * pow(max(k, 1e-3), -0.28) * 2.0 * au / SYDNEY_SPAN;
  float db = abs(p.y - yb) / sqrt(1.0 + sb * sb);
  float dt = abs(p.y - yt) / sqrt(1.0 + st * st);
  float chord = max(sydneyStroke(db, 0.0026, px.y), sydneyStroke(dt, 0.0022, px.y));
  // Lamps along the top chord, and a red light on each flagpole at the crown.
  float lamp = step(dt, px.y * 1.2) * sydneyPulse(u * 20.0, 0.0, 0.18, fu.x * 20.0);
  float pole = step(abs(au - 0.06), fu.x * 0.5) * step(yt, p.y) * step(p.y, yt + 0.022);
  if (pole > 0.5) {
    cover = 1.0;
    float beacon = step(yt + 0.022 - px.y * 1.5, p.y) * step(0.45, fract(t * 0.55 + step(0.0, u) * 0.5));
    return mix(vec4(steel * 0.8, 0.55), vec4(1.0, 0.14, 0.1, 0.95), beacon);
  }
  if (lamp > 0.4) {
    cover = 1.0;
    return vec4(vec3(0.96, 0.95, 1.0), 0.95);
  }
  if (chord > 0.35) {
    cover = 1.0;
    return vec4(steel * bright, 0.52 + 0.3 * chord);
  }
  // The truss between the chords: verticals and alternating diagonals.
  float panels = (u + 1.0) * 14.0;
  float pw = fu.x * 14.0;
  // Coarse charsets can't resolve the truss: drop it there and keep the
  // chords, which still read as the arch.
  float detail = smoothstep(2.5, 4.0, 1.0 / max(pw, 1e-4));
  if (p.y > yb && p.y < yt) {
    float v = (p.y - yb) / (yt - yb);
    float n = floor(panels);
    float fp = fract(panels);
    float target = mod(n, 2.0) < 0.5 ? v : 1.0 - v;
    float slope = (yt - yb) / (SYDNEY_SPAN / 14.0);
    float diag = sydneyStroke(abs(fp - target) / sqrt(1.0 + 1.0 / max(slope * slope, 1e-3)), 0.0, pw);
    float vert = sydneyPulse(panels + 0.06, 0.0, 0.12, pw);
    float member = max(diag, vert) * detail;
    cover = step(0.3, member);
    return vec4(steel * bright, 0.56 * member * cover);
  }
  // Hangers from the arch down to the deck.
  if (p.y < yb && p.y > deck) {
    float hanger = sydneyPulse(panels + 0.04, 0.0, 0.08, pw) * detail;
    cover = step(0.3, hanger);
    return vec4(steel * 0.9 * bright, 0.54 * hanger * cover);
  }
  return vec4(0.0);
}

// One of the Opera House's shells, tip leaning right: its back edge rises
// on an arc from b0 and meets the tip at an angle, so the tip stays sharp;
// its front edge sweeps out from b1. Under the front edge, the glass wall fills the mouth. Mirror q.x to
// lean it left.
vec4 sydneyShell(vec2 q, float b0, float b1, vec2 tip, vec2 px, vec4 flash, out float cover) {
  cover = 0.0;
  float s = (q.y - SYDNEY_PODIUM) / (tip.y - SYDNEY_PODIUM);
  if (s < 0.0 || s > 1.0) {
    return vec4(0.0);
  }
  float xb = b0 + (tip.x - b0) * (1.0 - sqrt(1.0 - 0.6724 * s * s)) / 0.4279;
  float xf = b1 + (tip.x - b1) * pow(s, 1.5);
  float xg = b1 + (tip.x - b1) * s;
  if (q.x < xb || q.x > max(xf, xg)) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (q.x > xf) {
    // The mouth: amber glass with mullions fanning up from the base.
    float m = sydneyPulse((q.x - b1) / max(tip.x - b1, 1e-3) / max(s, 0.05) * 5.0, 0.0, 0.2, px.x * 5.0 / max((tip.x - b1) * max(s, 0.05), 1e-3));
    return vec4(vec3(1.0, 0.72, 0.34) * mix(1.0, 0.6, m), mix(0.62, 0.36, m));
  }
  vec3 sail = mix(vec3(1.0, 0.96, 0.88), flash.rgb, flash.a * 0.3);
  // The back edge is a gap, so a shell reads against the one behind it.
  if (q.x - xb < px.x * 0.9 + 0.0015) {
    return vec4(sail * 0.5, 0.2);
  }
  // Tiles run in ribs that follow the shell's curve.
  float w = (q.x - xb) / max(xf - xb, 1e-4);
  float ribW = max(xf - xb, 1e-4) / 4.0;
  float rib = sydneyPulse(w * 4.0, 0.0, 0.16, px.x / ribW) * step(0.12, s) * step(w, 0.9) * smoothstep(3.0, 6.0, ribW / px.x);
  float lit = mix(1.0, 0.8, s) + flash.a * 0.2;
  float rim = step(xf - q.x, px.x * 1.3);
  return vec4(sail * lit, max(0.8 * lit - rib * 0.45, rim));
}

// The Opera House on Bennelong Point: two rows of nested shells leaning
// toward the harbour, the restaurant's small pair leaning back, all on
// the broad podium.
vec4 sydneyOpera(vec2 p, vec2 px, vec4 flash, out float cover) {
  cover = 0.0;
  float k = SYDNEY_OPERA_SCALE;
  vec2 q = vec2((p.x - SYDNEY_OPERA_X) / k, SYDNEY_PODIUM + (p.y - SYDNEY_PODIUM) / k);
  if (q.x < -0.26 || q.x > 0.25 || q.y > 0.51 || p.y < SYDNEY_WATER) {
    return vec4(0.0);
  }
  px /= k;
  vec4 acc = vec4(0.0);
  float c;
  if (p.y < SYDNEY_PODIUM) {
    // The podium, banded and floodlit, its edge a bright line.
    if (abs(q.x + 0.005) > 0.235) {
      return vec4(0.0);
    }
    cover = 1.0;
    float ledge = step(SYDNEY_PODIUM - px.y * k * 1.3, p.y);
    float band = sydneyPulse(p.y / 0.009, 0.0, 0.28, px.y * k / 0.009);
    return vec4(vec3(0.95, 0.78, 0.62) * mix(1.0, 0.6, band), max(ledge * 0.9, 0.6 - band * 0.3));
  }
  // The restaurant: two small shells leaning left.
  vec2 r = vec2(-q.x, q.y);
  sydneyPaint(acc, sydneyShell(r, 0.13, 0.18, vec2(0.228, 0.368), px, flash, c), c);
  cover = max(cover, c);
  sydneyPaint(acc, sydneyShell(r, 0.095, 0.15, vec2(0.192, 0.346), px, flash, c), c);
  cover = max(cover, c);
  // The concert hall, behind.
  sydneyPaint(acc, sydneyShell(q, -0.15, -0.065, vec2(-0.03, 0.412), px, flash, c), c);
  cover = max(cover, c);
  sydneyPaint(acc, sydneyShell(q, -0.09, 0.005, vec2(0.05, 0.46), px, flash, c), c);
  cover = max(cover, c);
  sydneyPaint(acc, sydneyShell(q, -0.025, 0.08, vec2(0.135, 0.508), px, flash, c), c);
  cover = max(cover, c);
  // The opera theatre, in front and lower.
  sydneyPaint(acc, sydneyShell(q, -0.05, 0.02, vec2(0.065, 0.378), px, flash, c), c);
  cover = max(cover, c);
  sydneyPaint(acc, sydneyShell(q, 0.015, 0.095, vec2(0.145, 0.414), px, flash, c), c);
  cover = max(cover, c);
  sydneyPaint(acc, sydneyShell(q, 0.085, 0.165, vec2(0.22, 0.448), px, flash, c), c);
  cover = max(cover, c);
  return acc;
}

// A green and gold harbour ferry heading right, with lit cabins.
vec4 sydneyFerry(vec2 p, float x0, vec2 px, out float cover) {
  cover = 0.0;
  float len = 0.15;
  float k = 1.45;
  vec2 q = vec2(p.x - x0, p.y - SYDNEY_FERRY_Y) / k;
  px /= k;
  if (q.x < 0.0 || q.x > len || q.y < 0.0 || q.y > 0.062) {
    return vec4(0.0);
  }
  float a = q.x / len;
  if (q.y < 0.016) {
    // The hull rises at the bow and stern.
    float rake = 0.016 * (1.0 - smoothstep(0.0, 0.08, a) * (1.0 - smoothstep(0.86, 1.0, a)));
    if (q.y < rake) {
      return vec4(0.0);
    }
    cover = 1.0;
    float stripe = step(0.011, q.y);
    return vec4(mix(vec3(0.1, 0.5, 0.3), vec3(1.0, 0.85, 0.42), stripe), mix(0.5, 0.7, stripe));
  }
  float cabin = step(0.07, a) * step(a, 0.93) * step(q.y, 0.033);
  float upper = step(0.2, a) * step(a, 0.8) * step(0.033, q.y) * step(q.y, 0.046);
  float wheel = step(0.42, a) * step(a, 0.58) * step(0.046, q.y) * step(q.y, 0.055);
  float mast = step(abs(q.x - len * 0.5), max(0.0012, px.x * 0.5)) * step(0.055, q.y);
  if (cabin + upper + wheel + mast < 0.5) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (mast > 0.5) {
    float light = step(0.062 - px.y * 1.5, q.y);
    return mix(vec4(vec3(0.7), 0.5), vec4(1.0, 1.0, 0.95, 0.95), light);
  }
  float rowY = cabin > 0.5 ? 0.0245 : 0.0395;
  float pane = sydneyPulse(q.x / 0.008, 0.2, 0.8, px.x / 0.008) * step(abs(q.y - rowY), 0.0035);
  if (pane > 0.4) {
    return vec4(vec3(1.0, 0.88, 0.6), 0.9);
  }
  return vec4(vec3(0.96, 0.9, 0.72) * 0.75, 0.55);
}

// Everything above the waterline at p (the box's frame) and s (the scene
// frame), each layer shifted by its own share of the pointer. Empty
// samples carry the colour of the nearest light at zero tone.
vec4 sydneyAbove(vec2 p, float t, vec2 px, float aspect, float sc, float shift, vec2 ptr) {
  vec2 spx = px / sc;
  vec4 acc = vec4(0.0);
  vec3 halo = vec3(0.0);
  float cover;
  vec4 star = sydneyStars(p + ptr * 0.004, t, px);
  sydneyLayer(acc, halo, star, step(0.001, star.a));
  vec4 flash;
  float bridgeX = (SYDNEY_BRIDGE_X - shift) * sc;
  float deckY = SYDNEY_WATER + (SYDNEY_DECK - SYDNEY_WATER) * sc;
  vec4 fire = sydneyShow(p + ptr * 0.008, t, px, aspect, bridgeX, deckY, flash);
  sydneyLayer(acc, halo, fire, step(0.001, fire.a));
  flash.a *= sydneyFireworks;
  vec2 pc = p + ptr * 0.016;
  vec4 city = sydneyCity(vec2(pc.x / sc + shift, SYDNEY_WATER + (pc.y - SYDNEY_WATER) / sc), t, spx, cover);
  sydneyLayer(acc, halo, vec4(mix(city.rgb, vec3(0.45, 0.55, 0.95), 0.25), city.a), cover);
  vec2 pb = p + ptr * 0.026;
  vec4 bridge = sydneyBridge(vec2(pb.x / sc + shift, SYDNEY_WATER + (pb.y - SYDNEY_WATER) / sc), t, spx, flash, cover);
  sydneyLayer(acc, halo, bridge, cover);
  vec2 po = p + ptr * 0.04;
  vec4 opera = sydneyOpera(vec2(po.x / sc + shift, SYDNEY_WATER + (po.y - SYDNEY_WATER) / sc), spx, flash, cover);
  sydneyLayer(acc, halo, opera, cover);
  return vec4(acc.a < 0.08 ? halo : acc.rgb, acc.a);
}

vec2 sydneyCacheUv = vec2(-1.0);
float sydneyCacheT = -1.0;
vec4 sydneyCacheValue = vec4(0.0);

vec4 sydneyScene(vec2 uv, vec2 res, float t) {
  if (uv == sydneyCacheUv && t == sydneyCacheT) {
    return sydneyCacheValue;
  }
  float aspect = res.x / res.y;
  float pixel = 1.0 / res.y;
  // One sample's footprint. Glyph cells run about 0.6 wide to 1 tall and
  // charsets sample them 1x1 to 2x4, so 0.9 rows wide is a fair middle.
  vec2 px = vec2(pixel * 0.9, pixel);
  vec2 ptr = (u_pointer.xy - 0.5) * u_pointer.z * sydneyPointer;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  // Narrow boxes shrink the landmarks about the waterline and slide the
  // view toward the bridge, so the Opera House and the arch both fit.
  float sc = clamp(aspect / 1.6, 0.44, 1.0);
  float shift = 0.12 * (1.0 - sc);

  vec4 acc;
  if (p.y >= SYDNEY_WATER) {
    acc = sydneyAbove(p, t, px, aspect, sc, shift, ptr);
  } else {
    float depth = SYDNEY_WATER - p.y;
    // The mirror stretches with depth so bursts high in the sky still land
    // in the water, and ripples bend it more the nearer the water is.
    float wob = snoise(vec2(p.x * 3.0 + t * 0.12, p.y * 90.0 - t * 0.5));
    vec2 m = vec2(p.x + wob * (0.002 + depth * 0.035), SYDNEY_WATER + depth * (1.0 + 2.0 * pow(depth / SYDNEY_WATER, 2.0)));
    vec4 mirror = sydneyAbove(m, t, px, aspect, sc, shift, ptr);
    float band = max(pixel * 2.2, 0.0045);
    float streak = snoise(vec2(p.x * 7.0 - t * 0.1, floor(p.y / band) * 1.7 + t * 0.35));
    float keep = step(-0.35 + depth * 1.6, streak);
    acc = vec4(mirror.rgb * vec3(0.62, 0.7, 0.85), mirror.a * keep * (1.0 - depth * 1.4));
    // Faint swell on the open water.
    float swell = step(0.62, snoise(vec2(p.x * 14.0 + t * 0.2, floor(p.y / band) * 3.1)));
    if (acc.a < 0.2 && swell > 0.5) {
      acc = vec4(vec3(0.24, 0.32, 0.55), 0.22);
    }
    if (sydneyFerryOn > 0.5) {
      float span = aspect / sc + 0.5;
      vec2 pf = p + ptr * 0.06;
      vec2 s = vec2(pf.x / sc + shift, SYDNEY_WATER + (pf.y - SYDNEY_WATER) / sc);
      float x0 = mod(t * 0.022 + span * 0.62, span) - span * 0.5 + shift - 0.11;
      float cover;
      vec4 ferry = sydneyFerry(s, x0, px / sc, cover);
      // Its reflection hangs just below it, and a wake trails behind.
      if (cover < 0.5) {
        vec4 below = sydneyFerry(vec2(s.x, 2.0 * SYDNEY_FERRY_Y - s.y), x0, px / sc, cover);
        sydneyPaint(acc, vec4(below.rgb * 0.5, below.a * keep * 0.85), cover);
        float behind = x0 - s.x;
        float wake = step(0.0, behind) * step(behind, 0.16) * step(abs(s.y - SYDNEY_FERRY_Y - 0.002 + behind * 0.02 * sin(s.x * 90.0)), 0.003 + behind * 0.02);
        float foam = wake * step(0.35, hash21(vec2(floor(s.x * sc / px.x), floor(t * 6.0)))) * (1.0 - behind / 0.16);
        if (foam > 0.1) {
          acc = vec4(vec3(0.75, 0.85, 1.0) * (0.5 + 0.5 * foam), 0.3 + 0.4 * foam);
        }
      } else {
        acc = ferry;
      }
    }
  }

  // Near-black stays clean paper, so the sky and water don't fill with noise.
  // Intensity dims colour in step and tone more gently: Braille drops any
  // sample under half tone, so scaling tone alone would erase the bridge
  // long before the colours had faded.
  float tone = acc.a < 0.08 ? 0.0 : acc.a;
  sydneyCacheUv = uv;
  sydneyCacheT = t;
  sydneyCacheValue = vec4(acc.rgb * sydneyIntensity, tone * sqrt(sydneyIntensity));
  return sydneyCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return sydneyScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return sydneyScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night behind them in
// both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#040818";
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
        "linear-gradient(to top, #040818 0%, #0a1634 26%, #040818 27%, #071028 45%, #040818 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface SydneyProps extends AsciiSceneProps {
  /** How bright the scene is, from 0 (blank) to 1, so text on top stays readable. Default 1. */
  intensity?: number;
  /** How many fireworks shells are in the air, from 0 (none) to 1 (five at once). Default 1. */
  fireworks?: number;
  /** The ferry crossing the harbour. Default `true`. */
  ferry?: boolean;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
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
 * Sydney Harbour at night. The Opera House's shells glow white on their
 * podium, the Harbour Bridge's arch spans behind with lamps along its
 * deck, and the city stands beyond. Fireworks burst over the bridge on
 * their own clocks, and a click launches one more. Everything is mirrored
 * in the rippling harbour, where a ferry crosses. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Sydney = ({
  charset = "braille",
  colorMode,
  phosphor,
  paper,
  cell = 10,
  stillTime = 4,
  interactive = true,
  interaction = "none",
  intensity = 1,
  fireworks = 1,
  ferry = true,
  fallback = FALLBACK,
  ...props
}: SydneyProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        sydneyFerryOn: ferry ? 1 : 0,
        sydneyFireworks: clamp(fireworks, 0, 1),
        sydneyIntensity: clamp(intensity, 0, 1),
        sydneyPointer: interactive ? 1 : 0,
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
