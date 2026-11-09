"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Westminster at dusk from across the Thames, painted in dots: every sample
// returns a colour and a tone, and the tone only sets how big the dot is.
// Layers are tested near to far: Westminster Bridge, the embankment wall,
// the Elizabeth Tower, the Palace of Westminster with the Central and
// Victoria Towers, the trees on the far bank, a hazy far skyline, then the
// sky. Rows below `ldWaterRow` are the river, which reads the same layers
// mirrored. `s` is a whole sample (column, row from the bottom) and `p` the
// same point in box heights, so the tower keeps its exact shape on the
// sample grid while the light around it is painted in smooth gradients.
const SCENE = `
const float LD_WATER = 0.22;
const float LD_BANK = 0.022;
const vec3 LD_MIST = vec3(0.74, 0.64, 0.64);
// Westminster Bridge: arch spans widen towards you, from LD_SPAN0 box heights
// at the tower's foot, growing by LD_SPANK of the distance.
const float LD_SPAN0 = 0.07;
const float LD_SPANK = 0.14;

// Set once per sample by ldScene and read by every layer.
float ldHeight;
float ldSw;
float ldSh;
float ldT;
float ldAspect;
float ldAxis;
float ldAxisX;
float ldWaterRow;
float ldWaterY;
float ldGroundRow;
float ldGroundY;
float ldDialRow;
float ldDialY;
float ldDialX;
float ldSunX;
float ldBridgeX;
float ldCentralX;
float ldVictoriaX;
float ldPalaceL;
float ldBoatRow;

// A height in tower units (0 at the ground, 1 at the finial) as whole rows above the ground.
float ldRows(float v) {
  return floor(v * ldHeight / ldSh + 0.5);
}

// A half width in tower units as whole columns either side of the axis, so
// every part is an odd number of columns wide and exactly symmetric.
float ldCols(float w) {
  return floor(w * ldHeight / ldSw + 0.5);
}

// A stable random value for whole-sample inputs. The engine's hash21
// repeats every 50 samples on integers, which shows up as tiled stars.
float ldHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// Floodlit limestone: deep amber in shadow, pale gold where the light is full.
vec3 ldStone(float lit) {
  return mix(vec3(0.62, 0.38, 0.2), vec3(1.0, 0.8, 0.5), clamp(lit, 0.0, 1.0));
}

// Most windows keep their state. One in four turns on or off every few
// minutes, fading over three seconds, so the palace changes slowly.
float ldLit(vec2 id, float chance) {
  if (ldHash(id) > 0.25) {
    return step(1.0 - chance, ldHash(id + 7.1));
  }
  float period = 90.0 + 120.0 * ldHash(id + 3.3);
  float phase = ldT / period + ldHash(id + 5.5);
  float k = floor(phase);
  float now = step(1.0 - chance, ldHash(id + k * 1.37));
  float before = step(1.0 - chance, ldHash(id + (k - 1.0) * 1.37));
  return mix(before, now, smoothstep(0.0, 3.0 / period, fract(phase)));
}

// The tower is seen a little off square, so two faces show. The face
// towards the afterglow fills the left of each section and the corner
// stands ldCorner(n) columns right of the axis, for a section n columns
// either side of it. The narrow right face is in shadow.
float ldCorner(float n) {
  return floor(n * 0.42 + 0.5);
}

// 1 on the lit face, 0 on the shadow face, 2 on the corner between them.
float ldFace(vec2 s, float n) {
  float c = ldCorner(n);
  float x = s.x - ldAxis;
  if (abs(x - c) < 0.5) {
    return 2.0;
  }
  return x < c ? 1.0 : 0.0;
}

// Stone on each face, with lit from 0 to 1: floodlit gold on the lit face,
// cool violet slate on the shadow face, and a pale gold arris on the corner.
vec3 ldFaceCol(float face, float lit) {
  if (face > 1.5) {
    return vec3(1.0, 0.88, 0.62);
  }
  if (face > 0.5) {
    return ldStone(lit);
  }
  return mix(vec3(0.3, 0.3, 0.46), vec3(0.62, 0.58, 0.74), clamp(lit, 0.0, 1.0));
}

// A clock dial as an ellipse, foreshortened on the narrow face, centred at
// column cx with half sizes rx columns and ry rows: a dark bronze rim, an
// opal face glowing brightest at the centre, and two hands keeping slow
// time from ten to nine. Alpha 0 outside.
vec4 ldDial(vec2 s, float cx, float rx, float ry, float bright) {
  vec2 q = vec2((s.x - cx) / (rx + 0.5), (s.y - ldDialRow) / (ry + 0.5));
  float k = length(q);
  if (k > 1.0) {
    return vec4(0.0);
  }
  if (k > 0.84) {
    return vec4(vec3(0.3, 0.19, 0.12) * mix(0.75, 1.0, bright), 0.46);
  }
  float minutes = 50.0 + ldT / 60.0;
  float am = minutes / 60.0 * 6.28318;
  float ah = (8.0 + minutes / 60.0) / 12.0 * 6.28318;
  float alongM = dot(q, vec2(sin(am), cos(am)));
  float acrossM = abs(dot(q, vec2(cos(am), -sin(am))));
  float alongH = dot(q, vec2(sin(ah), cos(ah)));
  float acrossH = abs(dot(q, vec2(cos(ah), -sin(ah))));
  float hand = 0.5 / (max(rx, ry) + 0.5);
  if ((alongM > -0.05 && alongM < 0.7 && acrossM < hand) || (alongH > -0.05 && alongH < 0.46 && acrossH < hand)) {
    return vec4(0.3, 0.18, 0.1, 0.42);
  }
  vec3 opal = mix(vec3(1.0, 0.88, 0.64), vec3(1.0, 0.98, 0.9), 1.0 - k);
  return vec4(opal * mix(0.72, 1.0, bright), mix(0.78, 1.0, bright));
}

// A horizontal band (cornice, gallery) across both faces.
vec4 ldBand(vec2 s, float n, float tone) {
  float face = ldFace(s, n);
  return vec4(ldFaceCol(face, face > 0.5 ? 1.0 : 0.6), face > 0.5 ? tone : tone * 0.92);
}

// The Elizabeth Tower: the panelled shaft with its recessed windows, the
// clock stage with a dial on each face, the open belfry lit from inside,
// the gallery with corner pinnacles, the slate spire and the finial.
vec4 ldTower(vec2 s, out float cover) {
  cover = 0.0;
  float jx = abs(s.x - ldAxis);
  float x = s.x - ldAxis;
  float ry = s.y - ldGroundRow;
  float v = (ry + 0.5) * ldSh / ldHeight;
  if (ry < 0.0 || v > 1.0 || jx > ldCols(0.1)) {
    return vec4(0.0);
  }
  float c1 = ldRows(0.5);
  float c2 = max(ldRows(0.52), c1 + 1.0);
  float c3 = max(ldRows(0.715), c2 + 5.0);
  float c4 = max(ldRows(0.735), c3 + 1.0);
  float c5 = max(ldRows(0.805), c4 + 3.0);
  float c6 = max(ldRows(0.83), c5 + 1.0);
  float c7 = max(ldRows(0.975), c6 + 4.0);
  if (ry >= c7) {
    if (jx > 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(1.0, 0.84, 0.5, 0.75);
  }
  if (ry >= c6) {
    // The spire: slate banded in gold, its lit face catching the afterglow.
    float k = (ry - c6) / (c7 - c6);
    float n = floor(ldCols(0.064) * pow(1.0 - k, 1.2) + 0.5);
    float pin = ldCols(0.076);
    if (jx > pin - 0.5 && ry < c6 + max(2.0, ldRows(0.05))) {
      cover = 1.0;
      bool litPin = x < 0.0;
      return vec4(litPin ? vec3(1.0, 0.8, 0.46) : vec3(0.56, 0.48, 0.58), litPin ? (ry < c6 + 1.0 ? 0.9 : 0.72) : 0.5);
    }
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    float face = ldFace(s, n);
    if (face > 1.5) {
      return vec4(1.0, 0.84, 0.56, 0.8);
    }
    bool lit = face > 0.5;
    if (jx > n - 0.5) {
      return lit ? vec4(1.0, 0.8, 0.46, 0.82) : vec4(0.5, 0.48, 0.66, 0.8);
    }
    if (mod(ry - c6, 3.0) < 0.5) {
      return lit ? vec4(0.9, 0.64, 0.36, 0.6) : vec4(0.44, 0.36, 0.42, 0.36);
    }
    return lit ? vec4(0.46, 0.42, 0.54, 0.5) : vec4(0.28, 0.29, 0.44, 0.6);
  }
  if (ry >= c5) {
    float n = ldCols(0.078);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    return ldBand(s, n, 0.9);
  }
  if (ry >= c4) {
    // The belfry: an arcade of tall openings, warm inside, between piers.
    float n = ldCols(0.07);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    float face = ldFace(s, n);
    bool open = face < 1.5 && jx < n - 0.5 && mod(s.x - ldAxis + n, 2.0) > 0.5 && ry > c4 && ry < c5 - 1.0;
    if (open) {
      return face > 0.5 ? vec4(1.0, 0.7, 0.38, 0.62) : vec4(0.66, 0.42, 0.3, 0.5);
    }
    return vec4(ldFaceCol(face, face > 0.5 ? 0.8 : 0.45), face > 0.5 ? 0.84 : 0.8);
  }
  if (ry >= c3) {
    float n = ldCols(0.092);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    return ldBand(s, n, 0.95);
  }
  if (ry >= c2) {
    // The clock stage: the big dial in the middle of the lit face and a
    // narrow, dimmer one on the shadow face, each in a frame of tracery.
    float n = ldCols(0.088);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    float c = ldCorner(n);
    float face = ldFace(s, n);
    float halfRows = max((c3 - c2) * 0.5 - 1.0, 1.0);
    float rx = (n + c) * 0.5 - 0.8;
    float ry2 = min(rx * ldSw / ldSh, halfRows);
    if (face > 0.5 && face < 1.5) {
      vec4 dial = ldDial(s, ldAxis + (c - 1.0 - n) * 0.5, rx, ry2, 1.0);
      if (dial.a > 0.0) {
        return dial;
      }
    }
    if (face < 0.5) {
      float rs = max((n - c - 1.0) * 0.5 - 0.5, 0.5);
      vec4 dial = ldDial(s, ldAxis + (c + 1.0 + n) * 0.5, rs, ry2, 0.0);
      if (dial.a > 0.0) {
        return dial;
      }
    }
    if (face > 1.5) {
      return vec4(ldFaceCol(face, 1.0), 0.92);
    }
    if (jx > n - 0.5) {
      return face > 0.5 ? vec4(ldStone(1.0), 0.88) : vec4(ldFaceCol(0.0, 0.7), 0.86);
    }
    // Tracery in the corners around the dial: a fine chequer of stone.
    float trace = mod(s.x + s.y, 2.0) < 0.5 ? 1.0 : 0.0;
    if (face > 0.5) {
      // Set back in shade, so the dial is the brightest thing on the stage.
      return vec4(ldStone(mix(0.15, 0.45, trace)) * 0.85, mix(0.5, 0.66, trace));
    }
    return vec4(ldFaceCol(0.0, mix(0.2, 0.5, trace)), mix(0.62, 0.8, trace));
  }
  if (ry >= c1) {
    float n = ldCols(0.084);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    return ldBand(s, n, 0.9);
  }
  // The shaft: a plinth, then long ribs of panelling with recessed windows
  // between them. Floodlit from below, so it is warmest and fullest at the
  // foot and dims up the shaft towards the afterglow's rose.
  float n = ldCols(ry < ldRows(0.035) ? 0.08 : 0.072);
  if (jx > n) {
    return vec4(0.0);
  }
  cover = 1.0;
  float face = ldFace(s, n);
  float lit = 0.95 - 0.4 * v;
  if (face > 1.5) {
    return vec4(ldFaceCol(face, 1.0), 0.94);
  }
  bool rib = mod(s.x - ldAxis + n, 2.0) < 0.5;
  bool edge = jx > n - 0.5;
  // Windows two rows tall in the recesses, a band every few metres.
  float period = max(5.0, ldRows(0.075));
  bool window = !rib && !edge && mod(ry - ldRows(0.04), period) < 2.0 && ry > ldRows(0.04);
  if (face > 0.5) {
    if (edge) {
      return vec4(ldStone(lit + 0.15), 0.92);
    }
    if (window) {
      float on = ldLit(vec2(s.x, floor(ry / period)) + 61.0, 0.18);
      return vec4(mix(vec3(0.24, 0.14, 0.1), vec3(1.0, 0.84, 0.54), on), mix(0.28, 0.7, on));
    }
    if (rib) {
      return vec4(ldStone(lit), 0.92 - 0.24 * v);
    }
    return vec4(ldStone(lit - 0.35) * 0.86, 0.62 - 0.16 * v);
  }
  // The shadow face keeps full dots in cool slate, so the tower stays one
  // solid mass and the light, not the outline, tells the faces apart.
  if (edge) {
    return vec4(ldFaceCol(0.0, 0.7), 0.86);
  }
  if (window) {
    return vec4(0.14, 0.14, 0.24, 0.3);
  }
  if (rib) {
    return vec4(ldFaceCol(0.0, 0.25 + 0.4 * lit), 0.84);
  }
  return vec4(ldFaceCol(0.0, 0.1 + 0.2 * lit), 0.62);
}

// Heights of the palace shrink towards its far end, which stands further off.
float ldFall(float x) {
  return 1.0 - 0.24 * clamp((ldAxisX - x) / 1.0, 0.0, 1.0);
}

// The Victoria Tower at the far end: a square tower in panels with
// pinnacled corners and a flagpole.
vec4 ldVictoria(vec2 s, float y, out float cover) {
  cover = 0.0;
  float col = floor(ldVictoriaX / ldSw);
  float jx = abs(s.x - col);
  float n = floor(0.046 / ldSw + 0.5);
  float ry = s.y - ldGroundRow;
  float top = floor(0.4 / ldSh + 0.5);
  float pin = floor(0.024 / ldSh + 0.5);
  if (ry < 0.0 || jx > n) {
    return vec4(0.0);
  }
  if (ry >= top) {
    if (jx < 0.5 && ry < top + pin * 2.0) {
      cover = 1.0;
      return vec4(0.6, 0.52, 0.5, 0.36);
    }
    if (jx > n - 0.5 && ry < top + pin) {
      cover = 1.0;
      return vec4(1.0, 0.8, 0.5, 0.72);
    }
    return vec4(0.0);
  }
  cover = 1.0;
  float lit = 0.5 + 0.35 * y / 0.4;
  if (ry > top - 1.5 || jx > n - 0.5) {
    return vec4(ldStone(lit + 0.25), 0.74);
  }
  if (mod(jx, 2.0) < 0.5) {
    return vec4(ldStone(lit), 0.58);
  }
  return vec4(ldStone(lit - 0.2) * 0.92, 0.48);
}

// The Central Tower over the middle of the palace: an octagonal lantern of
// lit lancets under a slender spire.
vec4 ldCentral(vec2 s, float y, float roof, out float cover) {
  cover = 0.0;
  float col = floor(ldCentralX / ldSw);
  float jx = abs(s.x - col);
  float ry = s.y - ldGroundRow;
  float base = floor(roof / ldSh);
  float lantern = floor(0.17 / ldSh + 0.5);
  float tip = floor(0.24 / ldSh + 0.5);
  float n = floor(0.024 / ldSw + 0.5);
  if (ry < base || ry > tip || jx > n) {
    return vec4(0.0);
  }
  if (ry < lantern) {
    cover = 1.0;
    if (jx > n - 0.5 || ry > lantern - 1.5) {
      return vec4(ldStone(0.8), 0.66);
    }
    if (mod(jx, 2.0) > 0.5 && ry > base + 1.0) {
      return vec4(1.0, 0.84, 0.6, 0.58);
    }
    return vec4(ldStone(0.45), 0.46);
  }
  float k = (ry - lantern) / max(tip - lantern, 1.0);
  float w = floor(n * 0.8 * (1.0 - k) + 0.5);
  if (jx > w) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (jx > w - 0.5) {
    return vec4(0.96, 0.76, 0.46, 0.6);
  }
  return vec4(0.34, 0.32, 0.44, 0.36);
}

// The river front of the palace: a terrace on the water, floors of tall
// windows between lit buttresses, a pinnacle on every buttress, a turret
// every fifth bay, and the long dark roof with gold cresting on its ridge.
vec4 ldRange(vec2 s, float y, out float cover) {
  cover = 0.0;
  float f = ldFall((s.x + 0.5) * ldSw);
  float parapet = floor(0.104 * f / ldSh + 0.5);
  float ridge = parapet + max(3.0, floor(0.044 * f / ldSh + 0.5));
  float ry = s.y - ldGroundRow;
  float d = ldAxis - s.x;
  float bay = 3.0;
  float cx = mod(d, bay);
  float group = floor(d / bay);
  // Turrets stand at uneven intervals, never two bays running.
  bool turret = ldHash(vec2(group, 4.7)) > 0.8 && ldHash(vec2(group - 1.0, 4.7)) <= 0.8;
  float spike = ldHash(vec2(group, 6.1));
  // Not every buttress carries a pinnacle, so the roofline never reads as a comb.
  bool pinnacle = cx < 0.5 && spike > 0.3;
  if (ry < 0.0) {
    return vec4(0.0);
  }
  if (turret) {
    // A turret whole bay wide, rising past the ridge to a point.
    float tt = ridge + max(3.0, floor((0.03 + 0.025 * spike) * f / ldSh + 0.5));
    if (ry >= parapet && ry < tt) {
      bool point = ry > tt - 2.5;
      if (point && abs(cx - 1.0) > 0.5) {
        return vec4(0.0);
      }
      cover = 1.0;
      if (point || abs(cx - 1.0) > 0.5) {
        return vec4(1.0, 0.82, 0.5, 0.8);
      }
      return vec4(0.9, 0.62, 0.36, 0.5);
    }
  }
  if (ry >= ridge) {
    // Pinnacle tips poke above the ridge, some taller than others.
    if (pinnacle && ry < ridge + (spike > 0.65 ? 2.0 : 1.0)) {
      cover = 1.0;
      return vec4(1.0, 0.84, 0.54, 0.7);
    }
    return vec4(0.0);
  }
  cover = 1.0;
  if (ry >= parapet) {
    if (pinnacle) {
      return vec4(1.0, 0.78, 0.46, 0.72);
    }
    if (ry > ridge - 1.5) {
      return ldHash(vec2(s.x, 8.8)) > 0.45 ? vec4(1.0, 0.76, 0.44, 0.6) : vec4(0.3, 0.3, 0.44, 0.24);
    }
    return vec4(0.13, 0.14, 0.24, 0.2);
  }
  // Floodlights on the terrace throw uneven pools up the front: brightest
  // low down and where a light stands, softer up high and between them.
  float x = (s.x + 0.5) * ldSw;
  float pool = 0.5 + 0.5 * sin(x * 23.0 + 1.3) * (0.6 + 0.4 * snoise(vec2(x * 9.0, 2.7)));
  if (ry > parapet - 1.5) {
    return vec4(ldStone(0.75 + 0.25 * pool), 0.6 + 0.26 * pool);
  }
  float terrace = max(2.0, floor(0.018 / ldSh + 0.5));
  float lit = 0.62 + 0.36 * pool - 0.3 * ry / max(parapet, 1.0);
  if (ry < terrace) {
    return vec4(ldStone(0.35), 0.4);
  }
  if (cx < 0.5) {
    return vec4(ldStone(lit + 0.12), 0.56 + 0.16 * pool);
  }
  if (mod(ry - terrace, 3.0) > 1.5) {
    float on = ldLit(vec2(s.x, ry), 0.22);
    return vec4(mix(vec3(0.36, 0.22, 0.16), vec3(1.0, 0.9, 0.66), on), mix(0.22, 0.8, on));
  }
  // Big dots only where a pool of light is strongest, low on the front.
  float rise = ry / max(parapet, 1.0);
  return vec4(ldStone(lit), 0.4 + 0.42 * pool * (1.0 - 0.7 * rise));
}

vec4 ldPalace(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - ldGroundY;
  if (y < 0.0 || p.x > ldAxisX - 0.025 || p.x < ldPalaceL) {
    return vec4(0.0);
  }
  vec4 hit = ldVictoria(s, y, cover);
  if (cover < 0.5) {
    hit = ldCentral(s, y, 0.104 * ldFall(ldCentralX) + 0.03, cover);
  }
  if (cover < 0.5) {
    hit = ldRange(s, y, cover);
  }
  // A little evening haze over all of it, so it stands back from the
  // tower, and more towards the far end.
  float haze = 0.16 + 0.4 * clamp((ldAxisX - p.x) / 1.1, 0.0, 1.0);
  hit.rgb = mix(hit.rgb, LD_MIST, haze);
  hit.a = mix(hit.a, 0.36, haze * 0.6);
  return hit;
}

// The afterglow: strongest low in the sky behind the palace, where the sun
// went down, and fading along the horizon away from it.
float ldAfter(vec2 p) {
  float d = (p.x - ldSunX) / 1.0;
  return exp(-d * d);
}

// The sky from the horizon up: pale gold, peach, dusty mauve, slate blue.
vec3 ldSkyRamp(float h) {
  vec3 c = mix(vec3(1.0, 0.84, 0.6), vec3(0.96, 0.7, 0.56), smoothstep(0.03, 0.15, h));
  c = mix(c, vec3(0.72, 0.58, 0.64), smoothstep(0.12, 0.32, h));
  c = mix(c, vec3(0.44, 0.48, 0.66), smoothstep(0.28, 0.52, h));
  c = mix(c, vec3(0.26, 0.32, 0.52), smoothstep(0.48, 0.78, h));
  return mix(c, vec3(0.12, 0.15, 0.27), smoothstep(0.7, 1.0, h));
}

// The sky, with long soft bands of mist lit from below and a few faint stars.
vec4 ldSky(vec2 s, vec2 p) {
  float h = max(p.y - ldGroundY, 0.0) / (1.0 - ldGroundY);
  float glow = ldAfter(p);
  float hc = h + 0.1 * (1.0 - glow);
  vec3 col = ldSkyRamp(hc);
  // The pale gold lies just above the roofline, where the sun has gone down.
  float low = exp(-max(h - 0.16, 0.0) * 7.0);
  // Broken by irregular mist, so it never lies as one even band.
  low *= 0.45 + 0.75 * fbm(vec2(p.x * 2.4 - ldT * 0.003, h * 9.0 + 1.7));
  col = mix(col, vec3(1.0, 0.86, 0.6), 0.65 * glow * low);
  // Dots shrink fast up the sky, so the deep slate reads as quiet air.
  float tone = 0.13 + 0.2 * exp(-max(hc - 0.04, 0.0) * 4.0) + 0.12 * glow * low * low;
  vec2 cp = vec2(p.x * 1.1 - ldT * 0.004, p.y * 6.0);
  float c = fbm(cp + vec2(5.3, 2.1));
  float band = smoothstep(0.12, 0.22, h) * (1.0 - smoothstep(0.5, 0.7, h));
  float cloud = smoothstep(0.46, 0.76, c) * band * clamp(ldFog * 2.0, 0.0, 1.4);
  // Dark sky dots dim towards the paper, so the deep slate reads as quiet air.
  col *= mix(1.0, 0.7, smoothstep(0.5, 1.0, h));
  vec3 cloudCol = mix(vec3(1.0, 0.76, 0.62), vec3(0.6, 0.56, 0.72), smoothstep(0.12, 0.5, h));
  col = mix(col, cloudCol, min(cloud * 0.6, 0.8));
  tone += cloud * 0.12;
  float star = ldHash(s + 23.0);
  float density = 0.003 * smoothstep(0.5, 0.8, h);
  if (star > 1.0 - density) {
    float twinkle = 0.5 + 0.5 * sin(ldT * (0.4 + star * 0.5) + ldHash(s + 3.0) * 40.0);
    col = mix(vec3(0.64, 0.7, 0.92), vec3(0.95, 0.96, 1.0), twinkle);
    tone = mix(0.32, 0.56, twinkle);
  }
  return vec4(col, tone);
}

// The far city: Whitehall's roofs and turrets beyond the bridge and lower
// roofs past the palace's far end, hazy and cooler than anything nearer.
vec4 ldFar(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - ldGroundY;
  float bw = 0.05;
  float id = floor(p.x / bw);
  float u = (p.x - id * bw) / bw;
  float right = step(ldAxisX, p.x);
  float hgt = mix(0.035, 0.05, right) + mix(0.025, 0.04, right) * ldHash(vec2(id, 2.3));
  hgt -= 0.01 * max(0.0, abs(u - 0.5) * 2.0 - 0.6) / 0.4;
  float turret = ldHash(vec2(id, 9.1)) > 0.8 ? 0.05 * max(0.0, 1.0 - abs(u - 0.5) * 8.0) : 0.0;
  if (y < 0.0 || y > hgt + turret) {
    return vec4(0.0);
  }
  cover = 1.0;
  float glow = ldAfter(p);
  vec3 haze = mix(vec3(0.5, 0.46, 0.6), vec3(0.82, 0.64, 0.6), glow * 0.55);
  vec3 col = mix(haze * 0.78, haze, smoothstep(0.0, hgt, y));
  float tone = 0.24 + 0.04 * smoothstep(0.0, hgt, y);
  if (ldHash(s + 51.0) > 0.975 && y < hgt - 0.008) {
    col = vec3(0.96, 0.78, 0.56);
    tone = 0.5;
  }
  return vec4(col, tone);
}

// Plane trees along the embankments either side of the palace: dark
// blue-green crowns, the tops rimmed by the sky.
vec4 ldTrees(vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - ldGroundY;
  bool beyond = p.x > ldAxisX + 0.04 || p.x < ldPalaceL + 0.02;
  if (y < 0.0 || !beyond) {
    return vec4(0.0);
  }
  float crown = 0.026 + 0.01 * abs(sin(p.x * 55.0)) + 0.006 * snoise(vec2(p.x * 30.0, 4.1));
  if (y > crown) {
    return vec4(0.0);
  }
  cover = 1.0;
  float k = y / max(crown, 1e-4);
  vec3 col = mix(vec3(0.09, 0.12, 0.2), vec3(0.18, 0.22, 0.32), k);
  col = mix(col, vec3(0.62, 0.5, 0.52), 0.3 * smoothstep(0.75, 1.0, k));
  return vec4(col, 0.16 + 0.12 * k);
}

// The embankment wall along the far bank: lit warm under the palace, blue
// stone elsewhere, with a pale coping.
vec4 ldBank(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  if (s.y < ldWaterRow || s.y >= ldGroundRow) {
    return vec4(0.0);
  }
  cover = 1.0;
  float front = step(ldPalaceL, p.x) * step(p.x, ldAxisX + 0.04);
  if (s.y > ldGroundRow - 1.5) {
    return vec4(mix(vec3(0.4, 0.4, 0.52), vec3(0.96, 0.74, 0.48), front), mix(0.3, 0.62, front));
  }
  return vec4(mix(vec3(0.16, 0.18, 0.3), vec3(0.56, 0.38, 0.28), front), mix(0.16, 0.38, front));
}

// Westminster Bridge, running from the tower's foot towards you on the right.
float ldBridgeQ(float u) {
  return log(1.0 + LD_SPANK * u / LD_SPAN0) / LD_SPANK;
}

float ldBridgeU(float q) {
  return LD_SPAN0 * (exp(LD_SPANK * q) - 1.0) / LD_SPANK;
}

float ldBridgeTop(float u) {
  return ldGroundY + 0.012 + 0.05 * u;
}

float ldBridgeBase(float u) {
  return ldWaterY - 0.08 * u;
}

float ldPostH(float u) {
  return 0.02 + 0.03 * u;
}

// The lamp nearest along the bridge: x, the row of its head, and how far along.
vec3 ldLamp(float u) {
  float i = max(floor(ldBridgeQ(u) - 0.08 + 0.5), 0.0);
  float lu = ldBridgeU(i + 0.08);
  float col = floor((ldBridgeX + lu) / ldSw);
  float head = floor(ldBridgeTop(lu) / ldSh + 0.5) + floor(ldPostH(lu) / ldSh + 0.5);
  return vec3(col, head, lu);
}

// Green iron arches on stone piers, a pale parapet, and lamp standards
// with warm lanterns, three to a post on the nearer ones.
vec4 ldBridge(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float u = p.x - ldBridgeX;
  if (u < 0.0) {
    return vec4(0.0);
  }
  float topRow = floor(ldBridgeTop(u) / ldSh + 0.5);
  float baseRow = floor(ldBridgeBase(u) / ldSh + 0.5);
  vec3 lamp = ldLamp(u);
  float dc = abs(s.x - lamp.x);
  float postTop = floor(ldBridgeTop(lamp.z) / ldSh + 0.5);
  if (s.y >= postTop - 1.0 && s.y <= lamp.y) {
    bool head = s.y > lamp.y - 1.5;
    bool three = lamp.z > 0.2 && head && dc < 1.5;
    if (dc < 0.5 || three) {
      cover = 1.0;
      if (head) {
        return vec4(1.0, 0.88, 0.6, 1.0);
      }
      return vec4(0.24, 0.36, 0.34, 0.38);
    }
  }
  if (s.y >= topRow || s.y < baseRow) {
    return vec4(0.0);
  }
  float deck = max(2.0, floor((0.012 + 0.02 * u) / ldSh + 0.5));
  float fr = fract(ldBridgeQ(u));
  bool pier = fr < 0.16;
  if (!pier) {
    float ax = (fr - 0.58) / 0.42;
    float spring = baseRow + (topRow - deck - baseRow) * 0.2;
    float crown = topRow - deck;
    float arch = spring + (crown - spring) * sqrt(max(0.0, 1.0 - ax * ax));
    if (s.y < arch - 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (s.y < arch + 0.5) {
      return vec4(0.46, 0.66, 0.54, 0.52);
    }
  }
  cover = 1.0;
  if (s.y > topRow - 1.5) {
    return vec4(0.96, 0.82, 0.58, 0.66);
  }
  if (s.y > topRow - deck - 0.5) {
    return vec4(0.26, 0.5, 0.42, 0.42);
  }
  if (pier) {
    return vec4(0.36, 0.34, 0.42, 0.34);
  }
  return vec4(0.1, 0.18, 0.2, 0.16);
}

// The glow of the clock dial, the focal light: a tight bright core and a
// wide soft warmth that breathes very slowly.
float ldHalo(vec2 p) {
  vec2 d = (p - vec2(ldDialX, ldDialY)) * vec2(1.0, 0.85);
  float r = length(d);
  float pulse = 0.92 + 0.08 * sin(ldT * 0.5);
  float wide = min(0.2, ldAspect * 0.24);
  return (0.8 * exp(-r / 0.035) + 0.4 * exp(-r * r / (wide * wide))) * pulse;
}

// The soft pools of light around the bridge lamps, each breathing on its own.
float ldLampGlow(vec2 p) {
  float u = p.x - ldBridgeX;
  if (u < -0.03) {
    return 0.0;
  }
  vec3 lamp = ldLamp(max(u, 0.0));
  vec2 c = vec2((lamp.x + 0.5) * ldSw, (lamp.y + 0.5) * ldSh);
  vec2 d = (p - c) * vec2(1.0, 1.3);
  float pulse = 0.85 + 0.15 * sin(ldT * 0.6 + lamp.z * 40.0);
  return exp(-length(d) / (0.01 + 0.014 * lamp.z)) * pulse;
}

// The air in front of a layer: the dial's glow, the lamps, low mist, and a
// per-sample dither on the sky and the haze so gradients blend between dot
// sizes instead of stepping in bands.
vec4 ldAir(vec2 s, vec2 p, vec4 hit, float depth) {
  float y = p.y - ldGroundY;
  if (depth > -0.5) {
    float halo = ldHalo(p) * (depth > 0.75 ? 1.0 : 0.5);
    hit.rgb = mix(hit.rgb, vec3(1.0, 0.74, 0.42), clamp(halo * 1.5, 0.0, 0.85));
    hit.a = max(hit.a, min(hit.a + halo * 0.4, 0.5));
  }
  if (depth > 1.5) {
    hit.a += (ldHash(s + 0.37) - 0.5) * 0.16;
  }
  if (depth > 0.75) {
    float low = 1.0 - smoothstep(0.0, 0.07, y);
    float mist = low * smoothstep(0.32, 0.72, fbm(vec2(p.x * 2.6 + ldT * 0.01, y * 26.0)));
    mist *= clamp(ldFog * 2.0, 0.0, 1.6);
    hit.rgb = mix(hit.rgb, LD_MIST, min(mist * 0.5, 0.8));
    hit.a = mix(hit.a, 0.36, min(mist * 0.4, 0.7));
  }
  float lamp = ldLampGlow(p);
  hit.rgb = mix(hit.rgb, vec3(1.0, 0.8, 0.5), clamp(lamp * 0.7, 0.0, 0.8));
  hit.a += lamp * 0.3;
  return hit;
}

// Everything above the water at sample s, without the bridge.
vec4 ldAbove(vec2 s) {
  vec2 p = (s + 0.5) * vec2(ldSw, ldSh);
  float cover;
  // How far back the hit is: -1 the tower, 0 near, 0.5 the palace, 1 trees, 2 far city, 3 sky.
  float depth = 0.0;
  vec4 hit = ldBank(s, p, cover);
  if (cover < 0.5) {
    hit = ldTower(s, cover);
    depth = -1.0;
  }
  if (cover < 0.5) {
    hit = ldPalace(s, p, cover);
    depth = 0.5;
  }
  if (cover < 0.5) {
    hit = ldTrees(p, cover);
    depth = 1.0;
  }
  if (cover < 0.5) {
    hit = ldFar(s, p, cover);
    depth = 2.0;
  }
  if (cover < 0.5) {
    hit = ldSky(s, p);
    depth = 3.0;
  }
  return ldAir(s, p, hit, depth);
}

// A river cruiser heading downstream: a pale hull, a long glass cabin lit
// warm between its mullions, and an open top deck. It moves in whole columns.
vec4 ldBoat(vec2 s, out float cover) {
  cover = 0.0;
  if (ldBoatOn < 0.5) {
    return vec4(0.0);
  }
  float len = max(12.0, floor(0.16 / ldSw + 0.5));
  float travel = ldAspect + 0.5;
  float x0 = floor((mod(ldT * 0.01 + ldAspect * 0.1 + 0.25, travel) - 0.25) / ldSw);
  float u = s.x - x0;
  float r = s.y - ldBoatRow;
  float hull = max(1.0, floor(0.008 / ldSh + 0.5));
  float cabin = max(1.0, floor(0.01 / ldSh + 0.5));
  if (u < 0.0 || u > len - 0.5 || r < 0.0 || r > hull + cabin) {
    return vec4(0.0);
  }
  if (r < hull) {
    float cut = hull - 1.0 - r;
    if (u < cut || u > len - 1.0 - cut * 2.0) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.7, 0.7, 0.82, r < 0.5 ? 0.32 : 0.52);
  }
  float c0 = floor(len * 0.1);
  float c1 = floor(len * 0.78);
  if (u < c0 || u > c1) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (r > hull + cabin - 0.5) {
    return vec4(0.62, 0.62, 0.8, 0.42);
  }
  return vec4(1.0, 0.8, 0.5, mod(u - c0, 3.0) < 0.5 ? 0.42 : 0.9);
}

// The Thames: the boat, then the bridge mirrored about its own footing, then
// everything above mirrored, darkened and cooled, broken into long ripples
// that widen towards you. Under the tower and each lamp runs a streak of
// light broken into dashes that drift down the river.
vec4 ldWater(vec2 s) {
  vec2 p = (s + 0.5) * vec2(ldSw, ldSh);
  float cover;
  vec4 boat = ldBoat(s, cover);
  if (cover > 0.5) {
    return boat;
  }
  float k = ldWaterY - p.y;
  float dn = clamp(k / ldWaterY, 0.0, 1.0);
  float rip = snoise(vec2(p.x * mix(6.0, 2.2, dn) + ldT * 0.015, k * mix(120.0, 34.0, dn) - ldT * 0.42));
  float rip2 = snoise(vec2(p.x * 2.6 - ldT * 0.01, k * mix(64.0, 20.0, dn) + ldT * 0.3 + 7.0));
  float sway = rip2 * (0.002 + 0.014 * dn);
  // Each row of the reflection also slips sideways a little on its own, so
  // vertical edges above break into short horizontal dashes.
  float slip = snoise(vec2(p.x * 1.2 + ldT * 0.01, k * 180.0 - ldT * 0.25));
  float off = floor(sway / ldSw + slip * (1.0 + 2.0 * dn) + 0.5);
  vec4 hit = vec4(0.0);
  cover = 0.0;
  float u = p.x - ldBridgeX;
  float baseRow = floor(ldBridgeBase(max(u, 0.0)) / ldSh + 0.5);
  if (u > 0.0 && s.y < baseRow) {
    vec2 mb = vec2(s.x + off, 2.0 * baseRow - 1.0 - s.y);
    hit = ldBridge(mb, (mb + 0.5) * vec2(ldSw, ldSh), cover);
    if (cover > 0.5) {
      hit = ldAir(mb, (mb + 0.5) * vec2(ldSw, ldSh), hit, 0.0);
    }
  }
  vec2 m = vec2(s.x + off, 2.0 * ldWaterRow - 1.0 - s.y);
  if (cover < 0.5) {
    hit = ldBoat(m, cover);
  }
  if (cover < 0.5) {
    hit = ldAbove(m);
  }
  float keep = mix(0.85, 0.55, dn);
  vec3 col = hit.rgb * keep + vec3(0.02, 0.03, 0.08);
  col = mix(col, col * vec3(0.8, 0.88, 1.12), 0.45);
  // Long broken reflections: bright parts break into long horizontal
  // dashes that drift slowly downstream.
  float dash = smoothstep(-0.1, 0.25, snoise(vec2(p.x * 2.2 + ldT * 0.02, k * mix(90.0, 30.0, dn) - ldT * 0.3)));
  float tone = hit.a * mix(1.0, 0.8, dn) * mix(0.5, 1.05, dash);
  // The tower's floodlit gold lies on the water in a long streak.
  float dx = abs(p.x - ldAxisX);
  float sw = 0.07 * ldHeight * mix(0.6, 1.1, dn);
  float gold = exp(-dx * dx / (sw * sw)) * mix(1.0, 0.6, dn) * dash;
  // And each bridge lamp drops a thin streak below the bridge.
  vec3 lamp = ldLamp(max(u, 0.0));
  float lx = abs(p.x - (lamp.x + 0.5) * ldSw);
  float lw = 0.003 + 0.008 * dn;
  float below = ldBridgeBase(lamp.z) - p.y;
  float lampStreak = u > -0.02 && below > 0.0 ? exp(-lx * lx / (lw * lw)) * exp(-below / 0.14) * dash : 0.0;
  gold = max(gold, lampStreak * 0.9);
  col = mix(col, vec3(1.0, 0.7, 0.36) * mix(1.0, 0.82, dn), clamp(gold * 1.1, 0.0, 1.0));
  tone = max(tone, gold * 0.92);
  // Mist lying on the water near the far bank.
  float mist = (1.0 - smoothstep(0.0, 0.06, k)) * smoothstep(0.35, 0.75, fbm(vec2(p.x * 2.4 - ldT * 0.008, k * 24.0 + 3.0)));
  mist *= clamp(ldFog * 2.0, 0.0, 1.6);
  col = mix(col, LD_MIST * 0.8, min(mist * 0.45, 0.7));
  // The water is never empty: a faint ripple texture all over, in dots
  // barely lighter than the paper.
  tone = max(tone, 0.13 + 0.05 * rip);
  tone += (ldHash(s + 0.53) - 0.5) * 0.14 * (1.0 - gold);
  return vec4(col, tone);
}

vec2 ldCacheUv = vec2(-1.0);
float ldCacheT = -1.0;
vec4 ldCacheValue = vec4(0.0);

vec4 ldScene(vec2 uv, vec2 res, float t) {
  if (uv == ldCacheUv && t == ldCacheT) {
    return ldCacheValue;
  }
  ldAspect = res.x / res.y;
  ldSh = 1.0 / res.y;
  ldSw = ldAspect / max(ascii_samples.x, 1.0);
  ldT = t;
  // The tower is taller on tall boxes, so its dial clears a centred headline.
  ldHeight = mix(0.68, 0.6, smoothstep(0.6, 1.3, ldAspect));
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  // Towards the right in every box, so the middle stays calm for a
  // headline and the tower stands beside it, with the palace running left.
  float axis = ldAspect * mix(0.79, 0.76, smoothstep(0.95, 1.4, ldAspect));
  ldAxis = floor(axis / ldSw);
  ldAxisX = (ldAxis + 0.5) * ldSw;
  // The waterline and the ground sit on cell boundaries, so the bank and
  // its mirror image line up with whole glyphs.
  float rows = ldSh * ldGrid.y;
  ldWaterRow = floor(LD_WATER / rows + 0.5) * ldGrid.y;
  ldWaterY = ldWaterRow * ldSh;
  ldGroundRow = ldWaterRow + max(1.0, floor(LD_BANK / rows + 0.5)) * ldGrid.y;
  ldGroundY = ldGroundRow * ldSh;
  float c2 = max(ldRows(0.52), ldRows(0.5) + 1.0);
  float c3 = max(ldRows(0.715), c2 + 5.0);
  ldDialRow = ldGroundRow + floor((c2 + c3) * 0.5);
  ldDialY = (ldDialRow + 0.5) * ldSh;
  float stage = ldCols(0.088);
  ldDialX = (ldAxis + (ldCorner(stage) - 1.0 - stage) * 0.5 + 0.5) * ldSw;
  ldCentralX = ldAxisX - 0.56;
  ldVictoriaX = ldAxisX - 1.0;
  ldPalaceL = ldVictoriaX - 0.07;
  ldSunX = ldAxisX - 0.7;
  ldBridgeX = ldAxisX + ldCols(0.08) * ldSw + ldSw;
  ldBoatRow = floor(0.085 / rows + 0.5) * ldGrid.y;

  float cover;
  vec4 hit = ldBridge(s, (s + 0.5) * vec2(ldSw, ldSh), cover);
  if (cover > 0.5) {
    hit = ldAir(s, (s + 0.5) * vec2(ldSw, ldSh), hit, 0.0);
  } else {
    hit = s.y < ldWaterRow ? ldWater(s) : ldAbove(s);
  }
  // Intensity dims colour in step and shrinks the dots more gently, so the
  // shapes keep their place behind text.
  float tone = clamp(hit.a, 0.0, 1.0) * sqrt(ldIntensity);
  ldCacheUv = uv;
  ldCacheT = t;
  ldCacheValue = vec4(clamp(hit.rgb, 0.0, 1.0) * ldIntensity, tone);
  return ldCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return ldScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return ldScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its dusk paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#0a1020";
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
        "linear-gradient(to bottom, #111a33 0%, #2a3352 35%, #5a4a58 58%, #7a5e4c 68%, #2a2630 73%, #0f1424 76%, #0a1020 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface LondonProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** How much mist drifts in the sky and over the river, from 0 (none) to 1. Default 0.5. */
  fog?: number;
  /** The river cruiser heading downstream. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: the scene's dusk blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /**
   * Cells as wide as they are tall, so the dots lie in an even lattice.
   * Default `true` for one-glyph charsets such as `dots`; `false` for
   * Braille and quadrants, which would stretch.
   */
  square?: boolean;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the dusk as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Westminster at dusk across the Thames, painted in dots. The Elizabeth
 * Tower's clock face glows warm beside the gold-lit gothic roofline of the
 * Palace of Westminster, Westminster Bridge carries its lamps across the
 * river, and the Thames breaks the lit palace into long reflections under a
 * misty sky from pale gold to slate blue. Decorative and full-bleed: size
 * it with `className`, usually `absolute inset-0`.
 */
export const London = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square,
  stillTime = 30,
  intensity = 1,
  fog = 0.5,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: LondonProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gridX, gridY] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        ldBoatOn: boat ? 1 : 0,
        ldFog: clamp(fog, 0, 1),
        // The samples per glyph, so the waterline and the ground land on
        // whole cells in every charset.
        ldGrid: [gridX, gridY],
        ldIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      square={square ?? gridX * gridY === 1}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
