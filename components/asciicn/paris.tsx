"use client";

import type { ReactNode } from "react";

import type { AsciiColor, AsciiSceneProps, ColorMode } from "@/lib/ascii";
import { resolveCharset } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// Paris at blue hour, painted in dots: every sample returns a colour and a
// tone, and the tone only sets how big the dot is. Layers are tested near to
// far: the quay and its lamps, the tower, the trees of the Champ de Mars, the
// Haussmann blocks, the dome of Les Invalides, a far hazy skyline, then the
// sky. Rows below `parisWaterRow` are the Seine, which reads the same layers
// mirrored. `s` is a whole sample (column, row from the bottom) and `p` the
// same point in box heights, so the tower keeps its exact shape on the
// sample grid while the light around it is painted in smooth gradients.
const SCENE = `
const float PARIS_WATER = 0.24;
const float PARIS_QUAY = 0.026;
const float PARIS_HEIGHT = 0.64;

// Set once per sample by parisScene and read by every layer.
float parisSw;
float parisSh;
float parisT;
float parisAspect;
float parisAxis;
float parisAxisX;
float parisWaterRow;
float parisWaterY;
float parisGroundRow;
float parisGroundY;
float parisMesh;
float parisDomeX;
float parisSunX;
float parisGap;

// A height in tower units (0 at the ground, 1 at the antenna tip) as whole rows above the ground.
float parisRows(float v) {
  return floor(v * PARIS_HEIGHT / parisSh + 0.5);
}

// A half width in tower units as whole columns either side of the axis, so
// every part is an odd number of columns wide and exactly symmetric.
float parisCols(float w) {
  return floor(w * PARIS_HEIGHT / parisSw + 0.5);
}

// Half the tower's width at height v, in tower units, fitted to the real
// thing: 62 m at the feet, 35 m at the first floor, 20 m at the second and
// 8 m under the top, on 330 m.
float parisOuter(float v) {
  return 0.015 + 0.175 * exp(-3.78 * v);
}

// A stable random value for whole-sample inputs. The engine's hash21
// repeats every 50 samples on integers, which shows up as tiled stars.
float parisHash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// The great arch between the legs: a half ellipse 0.105 tower units wide
// each side, springing from the legs low down and touching the first floor.
const float PARIS_ARCH_W = 0.105;
const float PARIS_SPRING = 0.045;

// Rows above the ground to the underside of the arch at column jx.
float parisArch(float jx) {
  float x = jx * parisSw / PARIS_HEIGHT / PARIS_ARCH_W;
  return parisRows(PARIS_SPRING + (0.153 - PARIS_SPRING) * sqrt(max(0.0, 1.0 - x * x)));
}

// A floor of the tower: bright rims top, bottom and at the ends, and a row
// of lit bays between them.
float parisDeck(float jx, float ry, float r0, float r1, float n) {
  if (jx > n - 0.5 || ry < r0 + 0.5 || ry > r1 - 1.5) {
    return 1.0;
  }
  return mod(jx, 2.0) < 0.5 ? 0.9 : 0.5;
}

// The cross-bracing: two families of diagonals a few samples apart, mirrored
// about the axis. Bars draw the biggest dot, the gaps a middle one, so the
// iron reads as a lit lattice rather than a solid shape.
float parisLattice(float jx, float ry, float bar, float gap) {
  float d = min(mod(jx + ry, parisMesh), mod(jx - ry, parisMesh));
  return d < 0.5 ? bar : gap;
}

// The tower's gold: a warm sodium amber at the feet, paler towards the top.
vec3 parisGold(float v, float bright) {
  vec3 low = mix(vec3(0.86, 0.46, 0.16), vec3(1.0, 0.66, 0.28), bright);
  vec3 high = mix(vec3(0.96, 0.66, 0.3), vec3(1.0, 0.86, 0.56), bright);
  return mix(low, high, clamp(v * 1.3, 0.0, 1.0));
}

vec4 parisTower(vec2 s, out float cover) {
  cover = 0.0;
  float jx = abs(s.x - parisAxis);
  float ry = s.y - parisGroundRow;
  float v = (ry + 0.5) * parisSh / PARIS_HEIGHT;
  if (ry < 0.0 || v > 1.0 || jx > parisCols(0.2)) {
    return vec4(0.0);
  }
  vec3 gold = parisGold(v, 0.2);
  vec3 bright = parisGold(v, 1.0);
  // Floors and the top, in rows, each kept at least a row apart.
  float a0 = parisRows(0.157);
  float a1 = max(parisRows(0.19), a0 + 1.0);
  float b0 = max(parisRows(0.345), a1 + 2.0);
  float b1 = max(parisRows(0.366), b0 + 1.0);
  float c0 = max(parisRows(0.828), b1 + 2.0);
  float c1 = max(parisRows(0.846), c0 + 1.0);
  float d1 = max(parisRows(0.884), c1 + 1.0);
  float e1 = max(parisRows(0.905), d1 + 1.0);
  float tone = 0.0;
  if (ry >= e1) {
    // The antenna, a single column.
    if (jx > 0.5) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(bright, 0.6);
  }
  if (ry >= d1) {
    // The lantern that houses the beacon.
    if (jx > parisCols(0.008)) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(1.0, 0.95, 0.82, 1.0);
  }
  if (ry >= c1) {
    // The top: a small lit cabin over the third floor.
    float n = parisCols(0.017);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, c1 - 1.0, d1, n);
    return vec4(tone > 0.95 ? bright : gold, tone);
  }
  if (ry >= c0) {
    float n = parisCols(0.032);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, c0, c1, n);
    return vec4(tone > 0.95 ? bright : gold, tone);
  }
  if (ry >= b0 && ry < b1) {
    float n = parisCols(parisOuter(0.345) + 0.005);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, b0, b1, n);
    return vec4(tone > 0.95 ? bright : gold, tone);
  }
  if (ry >= a0 && ry < a1) {
    float n = parisCols(parisOuter(0.157) + 0.006);
    if (jx > n) {
      return vec4(0.0);
    }
    cover = 1.0;
    tone = parisDeck(jx, ry, a0, a1, n);
    return vec4(tone > 0.95 ? bright : gold, tone);
  }
  // The legs and the shaft, with the openings between the legs.
  float n = parisCols(parisOuter(v));
  if (jx > n) {
    return vec4(0.0);
  }
  float m = 0.0;
  if (ry < a0) {
    float acol = parisCols(PARIS_ARCH_W);
    float spring = parisRows(PARIS_SPRING);
    // Below the spring the legs stand apart with straight inner faces.
    if (jx < acol && ry < parisArch(jx)) {
      return vec4(0.0);
    }
    cover = 1.0;
    if (ry < spring + 1.0 && jx < acol + 0.5) {
      return vec4(bright, 1.0);
    }
    if (jx < acol) {
      float ra = parisArch(jx);
      // The arch is a line two rows thick in fine charsets, and it stays
      // unbroken where it runs steeply by reaching up to its neighbours' rows.
      float thick = parisSh < 0.008 ? 2.0 : 1.0;
      float reach = max(parisArch(jx + 1.0), parisArch(abs(jx - 1.0)));
      if (ry < max(ra + thick, reach)) {
        return vec4(bright, 1.0);
      }
    }
    // Above the arch the legs lean in towards the first floor; between
    // their inner faces and the arch runs a lighter web.
    float k = clamp((v - PARIS_SPRING) / (0.157 - PARIS_SPRING), 0.0, 1.0);
    m = parisCols(parisOuter(v) - mix(0.058, 0.047, k));
    if (jx < m - 0.5) {
      return vec4(gold * 0.85, parisLattice(jx, ry, 0.8, 0.34));
    }
    if (ry < spring) {
      m = acol;
    }
  } else if (ry < b0) {
    float k = clamp((v - 0.19) / 0.155, 0.0, 1.0);
    m = parisCols(parisOuter(v) - mix(0.042, 0.027, k));
    if (jx < m) {
      return vec4(0.0);
    }
  } else {
    // Above the second floor the legs close up in a long narrow slot.
    float k = clamp((v - 0.366) / 0.23, 0.0, 1.0);
    m = parisCols(0.024 * (1.0 - k));
    if (jx < m) {
      return vec4(0.0);
    }
  }
  cover = 1.0;
  if (jx > n - 0.5 || (m > 0.5 && jx < m + 0.5)) {
    return vec4(bright, 1.0);
  }
  return vec4(gold, parisLattice(jx, ry, 0.9, 0.46));
}

// Most windows keep their state. One in four turns on or off every few
// minutes, fading over three seconds, so the city changes slowly.
float parisLit(vec2 id, float chance) {
  if (parisHash(id) > 0.25) {
    return step(1.0 - chance, parisHash(id + 7.1));
  }
  float period = 90.0 + 120.0 * parisHash(id + 3.3);
  float phase = parisT / period + parisHash(id + 5.5);
  float k = floor(phase);
  float now = step(1.0 - chance, parisHash(id + k * 1.37));
  float before = step(1.0 - chance, parisHash(id + (k - 1.0) * 1.37));
  return mix(before, now, smoothstep(0.0, 3.0 / period, fract(phase)));
}

// The afterglow: strongest low in the sky behind the dome, where the sun
// went down, and fading along the horizon away from it.
float parisAfter(vec2 p) {
  float d = (p.x - parisSunX) / 0.9;
  return exp(-d * d);
}

// The sky from the horizon up: rose gold, mauve, violet, then deep blue.
vec3 parisSkyRamp(float h) {
  vec3 c = mix(vec3(1.0, 0.76, 0.52), vec3(0.98, 0.6, 0.52), smoothstep(0.04, 0.16, h));
  c = mix(c, vec3(0.78, 0.5, 0.64), smoothstep(0.12, 0.3, h));
  c = mix(c, vec3(0.46, 0.4, 0.72), smoothstep(0.26, 0.48, h));
  c = mix(c, vec3(0.2, 0.25, 0.58), smoothstep(0.42, 0.72, h));
  return mix(c, vec3(0.1, 0.14, 0.4), smoothstep(0.68, 1.0, h));
}

// The sky, with thin clouds lit pink from below and a few faint stars high up.
vec4 parisSky(vec2 s, vec2 p) {
  float h = max(p.y - parisGroundY, 0.0) / (1.0 - parisGroundY);
  float glow = parisAfter(p);
  // Away from the afterglow the colours run cooler, as if a little higher.
  float hc = h + 0.1 * (1.0 - glow);
  vec3 col = parisSkyRamp(hc);
  col = mix(col, vec3(1.0, 0.8, 0.55), 0.4 * glow * exp(-h * 10.0));
  // Dot size follows the light: big rose dots low down, small blue ones high up.
  float tone = 0.16 + 0.6 * exp(-max(hc - 0.1, 0.0) * 3.0) + 0.12 * glow * exp(-h * 4.0);
  // Long thin clouds drifting slowly to the right, brightest near the horizon.
  vec2 cp = vec2(p.x * 1.3 - parisT * 0.004, p.y * 7.0);
  float c = fbm(cp + vec2(3.1, 1.7));
  float band = smoothstep(0.16, 0.26, h) * (1.0 - smoothstep(0.44, 0.6, h));
  float cloud = smoothstep(0.5, 0.72, c) * band;
  vec3 cloudCol = mix(vec3(1.0, 0.66, 0.6), vec3(0.58, 0.5, 0.8), smoothstep(0.1, 0.42, h));
  col = mix(col, cloudCol, cloud * 0.75);
  tone += cloud * 0.18;
  // Stars only where the sky is dark, and only a few.
  float star = parisHash(s + 17.0);
  float density = 0.0035 * smoothstep(0.42, 0.75, h);
  if (star > 1.0 - density) {
    float twinkle = 0.5 + 0.5 * sin(parisT * (0.4 + star * 0.5) + parisHash(s + 3.0) * 40.0);
    col = mix(vec3(0.62, 0.7, 0.95), vec3(0.95, 0.96, 1.0), twinkle);
    tone = mix(0.34, 0.6, twinkle);
  }
  return vec4(col, tone);
}

// The far city: a low, hazy skyline of roofs and the odd spire, lighter and
// cooler than anything nearer, with a few faint windows.
vec4 parisFar(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - parisGroundY;
  float bw = 0.045;
  float id = floor(p.x / bw);
  float u = (p.x - id * bw) / bw;
  float hgt = 0.045 + 0.035 * parisHash(vec2(id, 2.3)) + 0.012 * sin(id * 0.7);
  // A short mansard at each end of a roof.
  hgt -= 0.012 * max(0.0, abs(u - 0.5) * 2.0 - 0.6) / 0.4;
  float spire = parisHash(vec2(id, 9.1)) > 0.9 ? 0.07 * max(0.0, 1.0 - abs(u - 0.5) * 7.0) : 0.0;
  if (y < 0.0 || y > max(hgt, hgt + spire)) {
    return vec4(0.0);
  }
  cover = 1.0;
  float glow = parisAfter(p);
  vec3 haze = mix(vec3(0.46, 0.4, 0.66), vec3(0.78, 0.52, 0.62), glow * 0.6);
  vec3 col = mix(haze * 0.82, haze, smoothstep(0.0, hgt, y));
  float tone = 0.46 + 0.08 * smoothstep(0.0, hgt, y);
  if (parisHash(s + 51.0) > 0.975 && y < hgt - 0.006) {
    col = vec3(0.95, 0.7, 0.5);
    tone = 0.7;
  }
  return vec4(col, tone);
}

// The dome of Les Invalides, mid-distance: a pavilion, a drum ringed with
// columns, the gilded dome with its ribs, the lantern and the spire. The
// side facing the afterglow catches the last light.
vec4 parisDome(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float d = 0.32;
  float dx = p.x - parisDomeX;
  float u = abs(dx) / d;
  float v = (p.y - parisGroundY) / d;
  if (v < 0.0 || v > 1.0 || u > 0.34) {
    return vec4(0.0);
  }
  float side = sign(parisSunX - parisDomeX);
  float w = 0.0;
  vec3 col = vec3(0.0);
  float tone = 0.0;
  // The sun side, 0 facing away to 1 facing it.
  float facing = 0.0;
  vec3 stoneDark = vec3(0.3, 0.28, 0.54);
  vec3 stoneLit = vec3(1.0, 0.72, 0.56);
  if (v < 0.36) {
    w = 0.3;
    facing = 0.5 + 0.5 * side * dx / (w * d);
    col = mix(stoneDark, stoneLit, 0.2 * facing);
    tone = 0.36;
    vec2 cs = s - vec2(floor(parisDomeX / parisSw), parisGroundRow);
    if (mod(cs.x, 2.0) > 0.5 && mod(cs.y, 2.0) > 0.5 && v < 0.32 && parisLit(cs + 300.0, 0.3) > 0.5) {
      col = vec3(1.0, 0.72, 0.42);
      tone = 0.5;
    }
  } else if (v < 0.42) {
    // A shallow pediment over the pavilion.
    w = 0.24 - (v - 0.36) * 1.6;
    facing = 0.5 + 0.5 * side * dx / (w * d);
    col = mix(stoneDark, stoneLit, 0.5 * facing);
    tone = mix(0.26, 0.6, facing);
  } else if (v < 0.6) {
    // The drum: columns every other sample, lit on the sun side.
    w = 0.165;
    facing = clamp(0.62 + 0.5 * side * dx / (w * d), 0.0, 1.0);
    col = mix(stoneDark, stoneLit, facing * facing);
    tone = mix(0.4, mod(s.x, 2.0) < 0.5 ? 0.95 : 0.6, facing * facing);
  } else if (v < 0.63) {
    w = 0.185;
    facing = clamp(0.5 + 0.6 * side * dx / (w * d), 0.0, 1.0);
    col = mix(stoneDark, stoneLit, facing) * 1.1;
    tone = mix(0.4, 0.9, facing);
  } else if (v < 0.84) {
    // The gilded dome, shaded as a sphere lit low from the sun side.
    float e = (v - 0.63) / 0.21;
    w = 0.175 * sqrt(max(0.0, 1.0 - e * e));
    float nx = clamp(dx / max(w * d, 1e-4), -1.0, 1.0);
    float lit = clamp(0.55 + 0.5 * side * nx + 0.25 * e, 0.0, 1.0);
    col = mix(vec3(0.52, 0.38, 0.46), vec3(1.0, 0.8, 0.44), lit);
    // Gilded ribs down the dome.
    float rib = abs(fract(asin(nx) * 2.6 + 0.5) - 0.5);
    tone = rib < 0.14 ? mix(0.6, 1.0, lit) : mix(0.42, 0.66, lit);
    // A bright rim where the dome meets the sky.
    if (abs(dx) > w * d - parisSw * 1.5 || v > 0.84 - parisSh / d * 1.5) {
      tone = 0.95;
      col = mix(col, vec3(1.0, 0.86, 0.58), 0.5);
    }
  } else if (v < 0.92) {
    w = 0.034;
    col = mix(vec3(0.5, 0.4, 0.42), vec3(1.0, 0.8, 0.46), clamp(0.5 + side * dx / (w * d), 0.0, 1.0));
    tone = 0.62;
  } else {
    w = 0.014 * (1.0 - v) / 0.08;
    col = vec3(1.0, 0.8, 0.48);
    tone = 0.55;
  }
  if (abs(dx) > max(w * d, parisSw * 0.5)) {
    return vec4(0.0);
  }
  cover = 1.0;
  // A little haze: it stands further off than the blocks.
  return vec4(mix(col, vec3(0.5, 0.44, 0.66), 0.12), tone);
}

// Facade and mansard heights of block id, in box heights. None where the
// Champ de Mars opens around the tower, and lower blocks nearest it.
vec2 parisBlock(float id, float bw) {
  float gap = abs((id + 0.5) * bw - parisAxisX);
  if (gap < parisGap) {
    return vec2(0.0);
  }
  float low = mix(0.72, 1.0, smoothstep(parisGap, parisGap + 0.3, gap));
  float facade = (0.052 + 0.03 * parisHash(vec2(id, 3.7))) * low;
  float roof = 0.024 + 0.012 * parisHash(vec2(id, 8.1));
  return vec2(facade, roof);
}

// Haussmann blocks on the far bank in blue shadow: floors of tall windows
// under a pale cornice, a zinc mansard with dormers and a ridge that
// catches the sky, and chimney stacks with their pots on the party walls.
vec4 parisBlocks(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - parisGroundY;
  if (y < 0.0) {
    return vec4(0.0);
  }
  float bw = 0.15;
  float id = floor(p.x / bw);
  float u = p.x - id * bw;
  vec2 b = parisBlock(id, bw);
  vec2 left = parisBlock(id - 1.0, bw);
  float top = b.x + b.y;
  float glow = parisAfter(p);
  // A chimney stack on the party wall, above the taller of the two roofs.
  float cw = max(0.014, parisSw * 2.5);
  if (u < cw && b.x > 0.0 && left.x > 0.0 && parisHash(vec2(id, 5.3)) > 0.25) {
    float stackTop = max(top, left.x + left.y) + 0.018;
    if (y < stackTop && y > min(b.x, left.x)) {
      cover = 1.0;
      if (y > stackTop - parisSh * 1.5) {
        // The pots: every other sample along the top.
        if (mod(s.x, 2.0) > 0.5) {
          return vec4(0.0);
        }
        return vec4(0.62, 0.42, 0.5, 0.4);
      }
      vec3 brick = mix(vec3(0.17, 0.19, 0.4), vec3(0.62, 0.42, 0.52), 0.35 * glow);
      return vec4(u < parisSw * 1.2 ? brick * 1.5 : brick, 0.3);
    }
  }
  if (b.x <= 0.0 || y >= top) {
    return vec4(0.0);
  }
  vec3 lamp = vec3(1.0, 0.72, 0.38);
  float sy = y - b.x;
  float col0 = floor(id * bw / parisSw);
  float cx = s.x - col0;
  float ncols = floor((id + 1.0) * bw / parisSw) - col0;
  if (sy >= 0.0) {
    // The mansard: steep at both ends, about 70 degrees.
    float inset = sy * 0.4 + 0.004;
    if (u < inset || u > bw - inset) {
      return vec4(0.0);
    }
    cover = 1.0;
    float k = sy / b.y;
    vec3 zinc = mix(vec3(0.2, 0.25, 0.5), vec3(0.36, 0.4, 0.7), k);
    zinc = mix(zinc, vec3(0.7, 0.52, 0.66), 0.25 * glow);
    // The ridge catches the sky; the cornice under it is pale stone.
    if (sy > b.y - parisSh * 1.5) {
      return vec4(mix(vec3(0.56, 0.58, 0.84), vec3(0.95, 0.7, 0.66), 0.4 * glow), 0.6);
    }
    if (sy < parisSh) {
      return vec4(0.46, 0.46, 0.7, 0.5);
    }
    // Dormers in one row halfway up, every third column.
    float dr = floor((b.x + b.y * 0.4) / parisSh);
    if (s.y - parisGroundRow == dr && mod(cx, 3.0) > 1.5 && cx > 2.0 && cx < ncols - 3.0) {
      float on = parisLit(vec2(s.x, id + 101.0), 0.32);
      return vec4(mix(vec3(0.1, 0.12, 0.3), lamp, on), mix(0.16, 0.85, on));
    }
    return vec4(zinc, 0.4);
  }
  cover = 1.0;
  float fr = s.y - parisGroundRow;
  float nrows = floor(b.x / parisSh);
  // The facade: lit a touch by the sky from above, darker at street level.
  vec3 wall = mix(vec3(0.1, 0.13, 0.32), vec3(0.2, 0.23, 0.46), smoothstep(0.0, b.x, y));
  wall = mix(wall, vec3(0.4, 0.3, 0.46), 0.25 * glow);
  if (fr > nrows - 1.5) {
    // The cornice.
    return vec4(0.4, 0.4, 0.64, 0.5);
  }
  bool bay = cx > 1.5 && cx < ncols - 2.5 && mod(cx, 2.0) > 0.5;
  if (bay && mod(fr, 2.0) > 0.5) {
    vec3 tint = parisHash(vec2(s.x, fr) + 41.0) > 0.86 ? vec3(0.78, 0.84, 1.0) : lamp;
    float on = parisLit(vec2(s.x, fr + id * 13.0), fr < 1.5 ? 0.55 : 0.3);
    return vec4(mix(vec3(0.08, 0.1, 0.26), tint, on), mix(0.14, 0.9, on));
  }
  return vec4(wall, 0.24);
}

// Plane trees on the Champ de Mars either side of the tower's feet, dark
// blue-green, their crowns rimmed gold on the side facing the tower.
vec4 parisTrees(vec2 p, out float cover) {
  cover = 0.0;
  float y = p.y - parisGroundY;
  float dx = abs(p.x - parisAxisX);
  float base = parisOuter(0.0) * PARIS_HEIGHT;
  if (y < 0.0 || dx < base + 0.006 || dx > parisGap + 0.06) {
    return vec4(0.0);
  }
  float crown = 0.024 + 0.008 * abs(sin(p.x * 70.0)) + 0.004 * snoise(vec2(p.x * 40.0, 1.3));
  crown *= smoothstep(base, base + 0.03, dx);
  if (y > crown) {
    return vec4(0.0);
  }
  cover = 1.0;
  float near = exp(-(dx - base) / 0.05);
  vec3 col = mix(vec3(0.1, 0.17, 0.28), vec3(0.17, 0.25, 0.38), y / max(crown, 1e-4));
  col = mix(col, vec3(0.95, 0.62, 0.3), near * smoothstep(crown * 0.4, crown, y) * 0.7);
  return vec4(col, 0.22 + 0.2 * near);
}

// The stone quay along the water: courses of blue stone under a pale
// coping, with warm lamps standing along the top.
vec4 parisQuay(vec2 s, vec2 p, out float cover) {
  cover = 0.0;
  if (s.y < parisWaterRow) {
    return vec4(0.0);
  }
  float spacing = 0.26;
  float k = floor(p.x / spacing);
  float lampX = (k + 0.5) * spacing;
  float lampCol = floor(lampX / parisSw);
  bool hasLamp = abs(lampX - parisAxisX) > parisGap + 0.04;
  float ry = s.y - parisGroundRow;
  if (hasLamp && s.x == lampCol && ry >= 0.0 && ry < 3.5) {
    cover = 1.0;
    if (ry > 2.5) {
      return vec4(1.0, 0.86, 0.58, 1.0);
    }
    return vec4(0.3, 0.3, 0.5, 0.28);
  }
  if (s.y >= parisGroundRow) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (s.y > parisGroundRow - 1.5) {
    return vec4(0.5, 0.48, 0.7, 0.42);
  }
  float course = mod(s.y - parisWaterRow, 2.0) < 0.5 ? 0.85 : 1.0;
  return vec4(vec3(0.17, 0.19, 0.38) * course, 0.24);
}

// The warm pools of light around the quay lamps.
float parisLampGlow(vec2 p) {
  float spacing = 0.26;
  float lampX = (floor(p.x / spacing) + 0.5) * spacing;
  if (abs(lampX - parisAxisX) < parisGap + 0.04) {
    return 0.0;
  }
  vec2 c = vec2((floor(lampX / parisSw) + 0.5) * parisSw, parisGroundY + 3.5 * parisSh);
  vec2 d = (p - c) * vec2(1.0, 1.4);
  return exp(-length(d) / 0.014);
}

// The tower's glow in the air around it, and the beacon on top, which turns
// slowly and swells as it faces you, about every eleven seconds.
float parisHalo(vec2 p) {
  // Centred high on the tower, where the sky behind is dark enough to show it.
  float v = (p.y - parisGroundY) / PARIS_HEIGHT;
  float reach = parisOuter(clamp(v, 0.0, 1.0)) * PARIS_HEIGHT;
  // Narrower on tall boxes, so it never fills a phone's width, and faded
  // near the feet, where the afterglow is already bright.
  float dx = max(abs(p.x - parisAxisX) - reach, 0.0) / min(0.105, parisAspect * 0.11);
  float dy = (v - 0.5) / 0.62;
  return 0.6 * exp(-dx * dx - dy * dy * 1.4) * smoothstep(0.08, 0.35, v);
}

float parisBeacon(vec2 p) {
  vec2 c = vec2(parisAxisX, parisGroundY + PARIS_HEIGHT * 0.895);
  vec2 d = (p - c) * vec2(0.8, 1.1);
  float turn = 0.5 + 0.5 * cos(parisT * 0.55);
  return (0.45 + 0.55 * turn * turn) * exp(-length(d) / 0.03) * parisBeaconOn;
}

// Everything above the water at sample s.
vec4 parisAbove(vec2 s) {
  vec2 p = (s + 0.5) * vec2(parisSw, parisSh);
  float cover;
  // How far back the hit is: 0 near, 1 the dome, 2 far city, 3 sky.
  float depth = 0.0;
  vec4 hit = parisQuay(s, p, cover);
  if (cover < 0.5) {
    hit = parisTower(s, cover);
    if (cover > 0.5) {
      depth = -1.0;
    }
  }
  if (cover < 0.5) {
    hit = parisTrees(p, cover);
  }
  if (cover < 0.5) {
    hit = parisBlocks(s, p, cover);
  }
  if (cover < 0.5) {
    hit = parisDome(s, p, cover);
    depth = 1.0;
  }
  if (cover < 0.5) {
    hit = parisFar(s, p, cover);
    depth = 2.0;
  }
  if (cover < 0.5) {
    hit = parisSky(s, p);
    depth = 3.0;
  }
  float y = p.y - parisGroundY;
  // The tower's halo warms the air in front of everything behind it. Its
  // dots are a dimmer amber than the tower's own and stop short of full
  // size, so the iron still stands clear of its glow.
  if (depth > -0.5) {
    float halo = parisHalo(p) * (depth > 0.5 ? 1.0 : 0.45);
    hit.rgb = mix(hit.rgb, vec3(0.94, 0.6, 0.3), clamp(halo * 1.4, 0.0, 0.8));
    hit.a = max(hit.a, min(hit.a + halo * 0.7, 0.64));
  }
  // The sky and the haze are dithered per sample, so their gradients blend
  // between dot sizes instead of stepping in bands; the tower stays crisp.
  if (depth > 1.5) {
    hit.a += (parisHash(s + 0.37) - 0.5) * 0.26;
  }
  // Mist lying low over the far bank, drifting slowly.
  if (depth > 0.5) {
    float mist = (1.0 - smoothstep(0.0, 0.05, y)) * smoothstep(0.35, 0.75, fbm(vec2(p.x * 3.0 + parisT * 0.01, y * 30.0)));
    hit.rgb = mix(hit.rgb, vec3(0.66, 0.54, 0.7), mist * 0.5);
    hit.a = mix(hit.a, 0.3, mist * 0.4);
  }
  float lampGlow = parisLampGlow(p);
  hit.rgb = mix(hit.rgb, vec3(1.0, 0.78, 0.48), lampGlow * 0.6);
  hit.a += lampGlow * 0.25;
  float beacon = parisBeacon(p);
  hit.rgb = mix(hit.rgb, vec3(1.0, 0.94, 0.8), clamp(beacon, 0.0, 0.9));
  hit.a += beacon * 0.6;
  return hit;
}

// A bateau-mouche heading downstream: a pale hull, a long glass cabin lit
// warm between its mullions, and a flat roof. It moves in whole columns.
float parisBoatRow;

vec4 parisBoat(vec2 s, out float cover) {
  cover = 0.0;
  if (parisBoatOn < 0.5) {
    return vec4(0.0);
  }
  float len = max(12.0, floor(0.17 / parisSw + 0.5));
  float travel = parisAspect + 0.5;
  float x0 = floor((mod(parisT * 0.011 + parisAspect * 0.12 + 0.25, travel) - 0.25) / parisSw);
  float u = s.x - x0;
  float r = s.y - parisBoatRow;
  float hull = max(1.0, floor(0.008 / parisSh + 0.5));
  float cabin = max(1.0, floor(0.01 / parisSh + 0.5));
  if (u < 0.0 || u > len - 0.5 || r < 0.0 || r > hull + cabin) {
    return vec4(0.0);
  }
  if (r < hull) {
    // The bow rakes forward and the stern tucks in at the waterline.
    float cut = hull - 1.0 - r;
    if (u < cut || u > len - 1.0 - cut * 2.0) {
      return vec4(0.0);
    }
    cover = 1.0;
    return vec4(0.66, 0.68, 0.86, r < 0.5 ? 0.3 : 0.5);
  }
  float c0 = floor(len * 0.12);
  float c1 = floor(len * 0.8);
  if (u < c0 || u > c1) {
    return vec4(0.0);
  }
  cover = 1.0;
  if (r > hull + cabin - 0.5) {
    return vec4(0.6, 0.62, 0.84, 0.4);
  }
  return vec4(1.0, 0.78, 0.46, mod(u - c0, 3.0) < 0.5 ? 0.4 : 0.9);
}

// The Seine: the boat, then everything above mirrored, darkened and cooled,
// broken into ripples that widen towards you. Under the tower runs a long
// golden streak where its light lies on the moving water.
vec4 parisWater(vec2 s) {
  vec2 p = (s + 0.5) * vec2(parisSw, parisSh);
  float cover;
  vec4 boat = parisBoat(s, cover);
  if (cover > 0.5) {
    return boat;
  }
  float k = parisWaterY - p.y;
  float dn = clamp(k / parisWaterY, 0.0, 1.0);
  // Ripples: long and thin far off, wider and taller near the bottom.
  float rip = snoise(vec2(p.x * mix(7.0, 2.6, dn) + parisT * 0.015, k * mix(110.0, 34.0, dn) - parisT * 0.42));
  float rip2 = snoise(vec2(p.x * 3.0 - parisT * 0.01, k * mix(60.0, 20.0, dn) + parisT * 0.3 + 7.0));
  float sway = rip2 * (0.002 + 0.012 * dn);
  float off = floor(sway / parisSw + 0.5);
  vec2 m = vec2(s.x + off, 2.0 * parisWaterRow - 1.0 - s.y);
  vec4 hit = parisBoat(m, cover);
  if (cover < 0.5) {
    hit = parisAbove(m);
  }
  float keep = mix(0.9, 0.6, dn);
  vec3 col = hit.rgb * keep + vec3(0.02, 0.03, 0.09);
  col = mix(col, col * vec3(0.78, 0.86, 1.15), 0.45);
  float tone = hit.a * mix(1.0, 0.8, dn) * (0.85 + 0.3 * rip);
  // The golden streak, broken into dashes that drift down the river.
  float dx = abs(p.x - parisAxisX);
  float sw = parisOuter(0.0) * PARIS_HEIGHT * mix(0.45, 0.85, dn);
  float streak = exp(-dx * dx / (sw * sw)) * mix(1.0, 0.55, dn);
  float dash = smoothstep(-0.15, 0.55, rip);
  float gold = streak * dash;
  col = mix(col, vec3(1.0, 0.68, 0.32) * mix(1.0, 0.8, dn), clamp(gold * 1.1, 0.0, 1.0));
  tone = max(tone, gold * 0.92);
  // The water is never empty: a faint ripple texture all over.
  tone = max(tone, 0.26 + 0.1 * rip);
  tone += (parisHash(s + 0.53) - 0.5) * 0.2 * (1.0 - gold);
  return vec4(col, tone);
}

vec2 parisCacheUv = vec2(-1.0);
float parisCacheT = -1.0;
vec4 parisCacheValue = vec4(0.0);

vec4 parisScene(vec2 uv, vec2 res, float t) {
  if (uv == parisCacheUv && t == parisCacheT) {
    return parisCacheValue;
  }
  parisAspect = res.x / res.y;
  parisSh = 1.0 / res.y;
  parisSw = parisAspect / max(ascii_samples.x, 1.0);
  parisT = t;
  vec2 s = floor(vec2(uv.x * ascii_samples.x, uv.y * res.y));
  // Right of centre on wide boxes, so the middle stays calm for a headline;
  // centred on tall ones.
  float axis = parisAspect * mix(0.5, 0.68, smoothstep(0.95, 1.4, parisAspect));
  parisAxis = floor(axis / parisSw);
  parisAxisX = (parisAxis + 0.5) * parisSw;
  // The waterline and the ground sit on cell boundaries, so the quay, the
  // blocks and their mirror images line up with whole glyphs.
  float rows = parisSh * parisGrid.y;
  parisWaterRow = floor(PARIS_WATER / rows + 0.5) * parisGrid.y;
  parisWaterY = parisWaterRow * parisSh;
  parisGroundRow = parisWaterRow + max(1.0, floor(PARIS_QUAY / rows + 0.5)) * parisGrid.y;
  parisGroundY = parisGroundRow * parisSh;
  parisMesh = clamp(floor(PARIS_HEIGHT / parisSh / 40.0 + 0.5), 3.0, 6.0);
  parisGap = parisOuter(0.0) * PARIS_HEIGHT + 0.07;
  parisDomeX = max(parisAxisX - 0.64, 0.075);
  parisSunX = parisDomeX - 0.14;
  parisBoatRow = floor(0.09 / rows + 0.5) * parisGrid.y;

  vec4 hit = s.y < parisWaterRow ? parisWater(s) : parisAbove(s);
  // Intensity dims colour in step and shrinks the dots more gently, so the
  // shapes keep their place behind text.
  float tone = clamp(hit.a, 0.0, 1.0) * sqrt(parisIntensity);
  parisCacheUv = uv;
  parisCacheT = t;
  parisCacheValue = vec4(clamp(hit.rgb, 0.0, 1.0) * parisIntensity, tone);
  return parisCacheValue;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return parisScene(uv, res, t).rgb;
}
`;

// Modes that paint the scene's own colours need its night paper behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const NIGHT = "#060a1f";
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
        "linear-gradient(to bottom, #070c26 0%, #0c1238 40%, #2a1e3c 68%, #3a2434 74%, #0a0e26 76%, #060a1f 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface ParisProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** The slow glow of the beacon on top of the tower. Default `true`. */
  beacon?: boolean;
  /** The bateau-mouche crossing the river. Default `true`. */
  boat?: boolean;
  /**
   * Paper behind the glyphs. Default: a deep night blue in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** Cells as wide as they are tall, so the dots lie in an even lattice. Default `true`. */
  square?: boolean;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the night blue. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: the blue hour as a flat gradient. */
  fallback?: ReactNode;
  /** Ignored: the city never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * Paris at blue hour, painted in dots. The Eiffel Tower stands lit gold in a
 * soft halo over the Seine, which carries its long golden reflection, between
 * Haussmann rooftops in blue shadow and the dome of Les Invalides catching
 * the last light, under a sky running from rose gold to deep blue.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const Paris = ({
  charset = "dots",
  chars,
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 7,
  square = true,
  stillTime = 0,
  intensity = 1,
  beacon = true,
  boat = true,
  fallback = FALLBACK,
  // The city has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: ParisProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  const [gx, gy] = resolveCharset(charset, chars).grid;
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        parisBeaconOn: beacon ? 1 : 0,
        parisBoatOn: boat ? 1 : 0,
        // The samples per glyph, so the waterline and the ground land on
        // whole cells in every charset.
        parisGrid: [gx, gy],
        parisIntensity: clamp(intensity, 0, 1),
      }}
      charset={charset}
      chars={chars}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (NIGHT_MODES.has(mode) ? NIGHT : undefined)}
      cell={cell}
      square={square}
      stillTime={stillTime}
      fallback={fallback}
      {...props}
    />
  );
};
