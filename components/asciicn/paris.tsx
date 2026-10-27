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
// far bank of the Seine at PARIS_BANK. Layers are tested near to far and
// the first one that covers a sample wins: rooftops, then the boat, the
// bridge and the water below the bank, then the tower, the far skyline and
// the sky above it. Sizes that must survive coarse charsets are measured
// against `px`, one sample row, so thin lines never vanish between samples.
// `parisScene` returns colour and tone, cached per sample so the field and
// colour passes share one evaluation.
const SCENE = `
const float PARIS_BANK = 0.3;
const float PARIS_TOWER = 0.62;
const float PARIS_BRIDGE = 0.225;

// Right of centre on wide boxes, so a headline can sit beside it; centred on tall ones.
float parisTowerX(float aspect) {
  return aspect * mix(0.5, 0.66, smoothstep(0.9, 1.5, aspect));
}

// Half the tower's width at height v (0 at the ground, 1 at the tip), in
// tower heights: the legs flare out in one long exponential curve.
float parisHalfWidth(float v) {
  return 0.007 + 0.18 * exp(-3.6 * v);
}

// The tower in its own units: x across from the axis, y up from 0 to 1,
// both in tower heights. Returns the tone; cover is 1 on the structure and
// lit marks its edges and platforms, which burn brighter.
float parisTower(vec2 tp, float px, out float cover, out float lit) {
  cover = 0.0;
  lit = 0.0;
  float q = abs(tp.x);
  float v = tp.y;
  if (v < 0.0 || v > 1.0) {
    return 0.0;
  }
  // Half a glyph wide at least, so the mast and edges stay one glyph thick.
  float line = max(px * 0.34, 0.0035);
  if (v > 0.9) {
    if (q < line) {
      cover = 1.0;
      lit = 1.0;
      return 0.85;
    }
    return 0.0;
  }
  float w = parisHalfWidth(v);
  float plat1 = step(0.165, v) * step(v, 0.19);
  float plat2 = step(0.345, v) * step(v, 0.367);
  float plat3 = step(0.835, v) * step(v, 0.855);
  float outer = v > 0.855 ? mix(0.014, 0.006, (v - 0.855) / 0.045) : w;
  outer += plat1 * 0.022 + plat2 * 0.013 + plat3 * 0.007;
  outer = max(outer, line);
  if (q > outer) {
    return 0.0;
  }
  // The openings: the great arch between the legs, a tall gap up to the
  // second platform and a narrow slot above it where the legs still part.
  float inner = -1.0;
  if (v < 0.15) {
    inner = 0.12 * sqrt(max(0.0, 1.0 - (v / 0.15) * (v / 0.15)));
  } else if (v > 0.19 && v < 0.345) {
    float s = (v - 0.19) / 0.155;
    inner = w * 0.5 * smoothstep(0.0, 0.12, s) * smoothstep(1.0, 0.55, s);
  } else if (v > 0.367 && v < 0.62) {
    inner = w * 0.3 * smoothstep(0.367, 0.41, v) * smoothstep(0.62, 0.45, v);
  }
  if (q < inner) {
    return 0.0;
  }
  cover = 1.0;
  float edge = min(outer - q, inner < 0.0 ? 1.0 : q - inner);
  float rim = 1.0 - smoothstep(line * 0.6, line * 2.2, edge);
  // Cross-bracing: diagonals that scale with the width at each height, about
  // four samples apart, so the lattice reads at any size.
  float rows = clamp(floor(0.25 / px), 6.0, 30.0);
  float s = q / max(w, 1e-3);
  float d1 = abs(fract(v * rows + s * 1.6) - 0.5);
  float d2 = abs(fract(v * rows - s * 1.6) - 0.5);
  float lattice = smoothstep(0.3, 0.46, max(d1, d2));
  float deck = max(plat1, max(plat2, plat3));
  lit = max(rim, deck);
  return max(0.4 + 0.26 * lattice, lit * 0.78);
}

vec3 parisTowerColor(float v, float lit) {
  vec3 gold = mix(vec3(1.0, 0.66, 0.26), vec3(1.0, 0.8, 0.42), smoothstep(0.0, 0.9, v));
  return mix(gold, vec3(1.0, 0.88, 0.58), lit * 0.7);
}

vec4 parisSky(vec2 p, float px, float t) {
  float h = p.y - PARIS_BANK;
  // What is left of the sunset along the horizon, under the deep blue.
  // Only a low band glows, so the open sky above stays empty paper.
  float glow = exp(-max(h, 0.0) * 16.0);
  float tone = glow * 0.22;
  vec3 col = mix(vec3(0.5, 0.52, 0.98), vec3(1.0, 0.55, 0.64), smoothstep(0.2, 0.7, glow));
  col = mix(col, vec3(1.0, 0.74, 0.55), smoothstep(0.75, 1.0, glow));
  // Soft clouds drifting east, lit rose underneath and lavender above.
  vec2 cq = vec2(p.x * 2.2 + t * 0.02, p.y * 5.0);
  float n = fbm(cq + vec2(fbm(cq * 0.7 + 3.0) * 0.8, 0.0));
  float band = smoothstep(0.08, 0.2, h) * (1.0 - smoothstep(0.48, 0.62, h));
  float bar = 0.72 - parisClouds * 0.2;
  float cloud = smoothstep(bar, bar + 0.1, n) * band * step(0.01, parisClouds);
  vec3 cloudCol = mix(vec3(1.0, 0.6, 0.62), vec3(0.62, 0.6, 0.98), smoothstep(0.12, 0.45, h));
  tone = mix(tone, 0.12 + 0.4 * smoothstep(bar, bar + 0.3, n), cloud);
  col = mix(col, cloudCol, cloud);
  // A few stars where the sky is darkest, never through a cloud.
  vec2 g = p / (px * vec2(0.62, 1.0));
  vec2 id = floor(g);
  float star = hash21(id + 11.3);
  if (star > 0.994 && cloud < 0.1) {
    float twinkle = 0.55 + 0.45 * sin(t * (1.2 + star * 3.0) + star * 40.0);
    float high = smoothstep(0.32, 0.55, h);
    float s = 0.6 * twinkle * high;
    if (s > tone) {
      tone = s;
      col = vec3(0.85, 0.88, 1.0);
    }
  }
  return vec4(col, tone);
}

// Low roofs on the far bank, a few lit windows, and a gilded dome.
vec4 parisFar(vec2 p, float px, float cx, out float cover) {
  cover = 0.0;
  float h = p.y - PARIS_BANK;
  if (h < 0.0 || h > 0.11) {
    return vec4(0.0);
  }
  vec2 d = vec2(p.x - (cx - 0.42), h);
  float dome = 0.0;
  if (abs(d.x) < 0.075 && d.y < 0.018) {
    dome = 0.35;
  }
  if (abs(d.x) < 0.024 && d.y < 0.046) {
    dome = 0.45;
  }
  vec2 e = vec2(d.x / 0.024, (d.y - 0.046) / 0.028);
  if (d.y >= 0.046 && dot(e, e) < 1.0) {
    // Gilded ribs down the dome.
    dome = 0.62 + 0.25 * step(0.5, fract(d.x / (px * 1.2)));
  }
  if (abs(d.x) < max(0.004, px * 0.5) && d.y >= 0.074 && d.y < 0.1) {
    dome = 0.8;
  }
  if (dome > 0.0) {
    cover = 1.0;
    return vec4(vec3(1.0, 0.76, 0.36), dome);
  }
  float id = floor(p.x * 30.0);
  float top = 0.012 + 0.034 * hash21(vec2(id, 3.1)) * hash21(vec2(id, 7.7));
  if (h > top) {
    return vec4(0.0);
  }
  cover = 1.0;
  vec2 win = floor(p / (px * vec2(1.6, 2.0)));
  float on = step(0.82, hash21(win + 5.0)) * step(px * 1.5, top - h);
  return mix(vec4(0.4, 0.44, 0.75, 0.07), vec4(1.0, 0.74, 0.4, 0.55), on);
}

// A stone bridge of five arches in front of the tower, its deck along the
// water line and lamps standing on the parapet. The arches open wide, so the
// river and the tower's reflection show through them.
const float PARIS_SPAN = 0.2;

vec4 parisBridge(vec2 p, float px, float cx, out float cover) {
  cover = 0.0;
  float x = p.x - (cx - PARIS_SPAN * 2.5);
  if (x < 0.0 || x > PARIS_SPAN * 5.0 || p.y < PARIS_BRIDGE || p.y > PARIS_BANK + 0.024) {
    return vec4(0.0);
  }
  float local = mod(x, PARIS_SPAN) - PARIS_SPAN * 0.5;
  float pier = mod(x + PARIS_SPAN * 0.5, PARIS_SPAN) - PARIS_SPAN * 0.5;
  float stem = max(0.003, px * 0.32);
  // Lamp posts over each pier, a bright head on a thin stem.
  if (p.y > PARIS_BANK) {
    if (abs(pier) < stem && p.y < PARIS_BANK + 0.012) {
      cover = 1.0;
      return vec4(0.7, 0.62, 0.55, 0.4);
    }
    if (abs(pier) < max(0.005, px * 0.34) && p.y >= PARIS_BANK + 0.012) {
      cover = 1.0;
      return vec4(1.0, 0.86, 0.55, 1.0);
    }
    return vec4(0.0);
  }
  float deck = PARIS_BANK - max(0.016, px * 1.1);
  if (p.y > deck) {
    cover = 1.0;
    return vec4(0.96, 0.8, 0.6, 0.46);
  }
  float halfSpan = PARIS_SPAN * 0.5 - 0.018;
  float a = local / halfSpan;
  float crown = PARIS_BRIDGE + (deck - PARIS_BRIDGE - 0.008) * sqrt(max(0.0, 1.0 - a * a));
  if (abs(local) < halfSpan && p.y < crown) {
    return vec4(0.0);
  }
  cover = 1.0;
  // The arch rings catch the light; the stone between them stays dim.
  float ring = abs(local) < halfSpan ? 1.0 - smoothstep(px * 0.5, px * 1.6, p.y - crown) : 0.0;
  return vec4(vec3(0.9, 0.72, 0.56), 0.2 + 0.36 * ring);
}

// A bateau-mouche gliding downstream: white hull, a long lit glass cabin
// and a string of deck lights, with its wake behind.
vec4 parisBoat(vec2 p, float px, float aspect, float t, out float cover) {
  cover = 0.0;
  // Measured in rows, so the boat keeps a hull, a cabin and its lights at any size.
  float r = max(px, 0.011);
  float len = max(0.24, r * 14.0);
  float travel = aspect + len + 0.3;
  float x0 = mod(t * 0.03 + aspect * 0.3 + 0.25, travel) - len - 0.15;
  float lx = p.x - x0;
  float y = p.y - 0.13;
  if (lx < -0.16 || lx > len || y < -r * 0.6 || y > r * 3.2) {
    return vec4(0.0);
  }
  // The hull, its bow raked forward.
  if (y >= 0.0 && y < r * 1.1 && lx > y * 0.3 && lx < len - r * 0.9 + y * 0.8) {
    cover = 1.0;
    return vec4(0.86, 0.9, 1.0, 0.58);
  }
  // The long glass cabin, lit warm between its mullions.
  if (y >= r * 1.1 && y < r * 2.2 && lx > r * 0.8 && lx < len - r * 2.4) {
    cover = 1.0;
    float mullion = step(fract(lx / (px * 2.2)), 0.3);
    return vec4(mix(vec3(1.0, 0.8, 0.5), vec3(0.72, 0.78, 0.96), mullion), mix(0.88, 0.4, mullion));
  }
  // A string of deck lights along the roof.
  if (y >= r * 2.2 && y < r * 3.0 && lx > r * 0.8 && lx < len - r * 2.4) {
    if (fract(lx / (px * 1.9)) < 0.5) {
      cover = 1.0;
      return vec4(1.0, 0.92, 0.66, 0.95);
    }
    return vec4(0.0);
  }
  // The wake trailing behind.
  if (lx < 0.0 && abs(y - r * 0.2) < r * 0.5) {
    float foam = exp(lx * 14.0) * (0.5 + 0.5 * snoise(vec2(lx * 60.0 - t * 2.0, 1.0)));
    if (foam > 0.12) {
      cover = 1.0;
      return vec4(vec3(0.8, 0.86, 1.0), 0.45 * foam);
    }
  }
  return vec4(0.0);
}

vec4 parisWater(vec2 p, float px, float cx, float t) {
  float depth = PARIS_BANK - p.y;
  // Ripples: short horizontal streaks that drift and shimmer.
  float wave = snoise(vec2(p.x * 7.0 + t * 0.05, p.y * 90.0 + t * 0.6 + sin(p.x * 11.0) * 2.0));
  float rip = smoothstep(0.05, 0.75, wave);
  // The tower mirrored in the river, broken up by the ripples.
  vec2 rp = vec2(p.x + 0.008 * snoise(vec2(p.y * 70.0, t * 0.7)), PARIS_BANK + depth * 1.05);
  float rc;
  float rl;
  float rt = parisTower(vec2(rp.x - cx, rp.y - PARIS_BANK) / PARIS_TOWER, px / PARIS_TOWER, rc, rl);
  float tower = rc * rt * (0.25 + 0.75 * rip) * exp(-depth * 2.6);
  // Lamps on the bridge drop warm streaks straight down.
  float bx = p.x - (cx - PARIS_SPAN * 2.5);
  float pier = mod(bx + PARIS_SPAN * 0.5, PARIS_SPAN) - PARIS_SPAN * 0.5;
  float lamp = step(abs(pier), max(0.005, px * 0.34)) * step(0.0, bx) * step(bx, PARIS_SPAN * 5.0);
  lamp *= rip * step(p.y, PARIS_BRIDGE) * exp(-(PARIS_BRIDGE - p.y) * 9.0);
  float sky = exp(-depth * 10.0) * rip * 0.3;
  float tone = max(max(tower * 0.85, lamp * 0.7), max(sky, rip * 0.14));
  vec3 col = vec3(0.36, 0.48, 0.92);
  col = mix(col, vec3(1.0, 0.56, 0.62), step(rip * 0.14, sky) * step(0.05, sky));
  col = mix(col, vec3(1.0, 0.74, 0.34), step(0.05, max(tower, lamp)));
  return vec4(col, tone);
}

// Haussmann blocks along the bottom: dark facades with lit windows, a pale
// cornice, a zinc mansard with dormers, and party-wall chimney stacks lined
// with pots. They dip low under the tower so the river shows above them.
float parisRoofTop(float id, float cx, float width) {
  float mid = (id + 0.5) * width - 0.05;
  float rise = smoothstep(0.1, 0.75, abs(mid - cx));
  return 0.03 + 0.1 * rise + 0.025 * hash21(vec2(id, 1.7));
}

float parisMansard(float id) {
  return 0.034 + 0.01 * hash21(vec2(id, 9.2));
}

vec4 parisRoofs(vec2 p, float px, float cx, float t, out float cover) {
  cover = 0.0;
  float width = 0.15;
  float bx = (p.x + 0.05) / width;
  float id = floor(bx);
  float u = fract(bx) * width;
  float base = parisRoofTop(id, cx, width);
  float top = base + parisMansard(id);
  float leftTop = parisRoofTop(id - 1.0, cx, width) + parisMansard(id - 1.0);
  float glyph = px * 0.62;
  float stackHalf = max(0.012, glyph * 1.1);
  float stackTop = max(top, leftTop) + 0.018 + 0.012 * hash21(vec2(id, 4.4));
  if (p.y > stackTop + 0.04) {
    return vec4(0.0);
  }
  float wall = min(u, width - u);
  // The stack sits on this building's left wall and straddles it.
  float su = u < width * 0.5 ? u : u - width;
  bool onStack = abs(su) < stackHalf && p.y > base;
  if (onStack && p.y < stackTop) {
    cover = 1.0;
    return vec4(0.78, 0.52, 0.44, 0.36);
  }
  float potGap = max(0.008, glyph * 1.6);
  if (onStack && p.y < stackTop + max(0.008, px * 0.9)) {
    if (fract((su + stackHalf) / potGap) < 0.55) {
      cover = 1.0;
      return vec4(0.95, 0.58, 0.4, 0.55);
    }
    return vec4(0.0);
  }
  // A thin plume from some stacks, drifting off downwind.
  if (p.y > top) {
    if (hash21(vec2(id, 2.2)) > 0.55 && p.y > stackTop) {
      float rise = p.y - stackTop;
      float sway = su - rise * 0.8 - 0.004 * sin(t * 0.7 + id);
      float plume = exp(-sway * sway / (0.00003 + rise * 0.0012));
      float smoke = plume * smoothstep(0.04, 0.0, rise) * (0.5 + 0.5 * snoise(vec2(su * 80.0, rise * 60.0 - t * 1.2)));
      if (smoke > 0.2) {
        return vec4(0.62, 0.64, 0.86, 0.3 * smoke);
      }
    }
    return vec4(0.0);
  }
  // The mansard leans back at the ends of each block.
  float y = p.y - base;
  if (y > 0.0 && wall < y * 1.1) {
    return vec4(0.0);
  }
  cover = 1.0;
  float bay = max(0.032, glyph * 2.2);
  float bu = u - 0.03;
  float bi = floor(bu / bay);
  float bf = bu - bi * bay;
  float pane = max(0.012, glyph * 0.9);
  bool inBay = bu > 0.0 && bu < width - 0.06 && bf < pane;
  if (y > 0.0) {
    // Dormers: a window, lit or dark, set in the zinc.
    float mansard = top - base;
    float on = step(0.5, hash21(vec2(id * 7.0 + bi, floor(t / 13.0 + hash21(vec2(id, bi)) * 3.0))));
    if (inBay && y > mansard * 0.18 && y < mansard * 0.72) {
      return mix(vec4(0.3, 0.34, 0.55, 0.0), vec4(1.0, 0.78, 0.44, 0.92), on);
    }
    // Zinc, catching the sky along its ridge.
    float ridge = 1.0 - smoothstep(px * 0.4, px * 1.2, mansard - y);
    vec3 zinc = mix(vec3(0.58, 0.66, 0.86), vec3(0.82, 0.76, 0.95), ridge);
    return vec4(zinc, 0.2 + 0.2 * ridge);
  }
  // The facade: a pale cornice, then floors of tall windows on dim stone.
  float down = -y;
  if (down < max(0.006, px * 0.8)) {
    return vec4(0.96, 0.88, 0.74, 0.5);
  }
  float floorH = max(0.04, px * 1.8);
  float fy = mod(down - 0.008, floorH);
  float fi = floor((down - 0.008) / floorH);
  float lit = step(0.64, hash21(vec2(id * 13.0 + bi, fi + floor(t / 17.0 + hash21(vec2(bi, fi)) * 4.0))));
  if (inBay && fy > floorH * 0.3) {
    return mix(vec4(0.3, 0.34, 0.55, 0.0), vec4(1.0, 0.76, 0.42, 0.8), lit);
  }
  return vec4(0.62, 0.6, 0.78, 0.1);
}

// The searchlight on top: two beams turn about the mast, swinging across
// the view and flaring when one points toward you.
float parisBeacon(vec2 p, vec2 apex, float t) {
  vec2 d = p - apex;
  float sum = 0.0;
  for (int i = 0; i < 2; i++) {
    float angle = t * 0.55 + float(i) * 3.14159;
    float across = cos(angle);
    float toward = sin(angle);
    float side = across >= 0.0 ? 1.0 : -1.0;
    float along = d.x * side;
    if (along > 0.0) {
      float reach = along / max(abs(across), 0.06);
      float spread = 0.006 + along * 0.1;
      float beam = exp(-(d.y * d.y) / (spread * spread)) * exp(-reach * 2.6);
      sum += beam * (0.45 + 0.55 * max(toward, 0.0));
    }
    sum += exp(-length(d * vec2(1.0, 2.0)) / 0.02) * pow(max(toward, 0.0), 6.0);
  }
  return sum;
}

vec2 parisCacheUv = vec2(-1.0);
float parisCacheT = -1.0;
vec4 parisCacheValue = vec4(0.0);

vec4 parisScene(vec2 uv, vec2 res, float t) {
  if (uv == parisCacheUv && t == parisCacheT) {
    return parisCacheValue;
  }
  float aspect = res.x / res.y;
  float px = 1.0 / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float cx = parisTowerX(aspect);
  // Nearer layers slide further with the pointer.
  float ptr = (u_pointer.x - 0.5) * u_pointer.z * parisParallax;
  float cover;
  vec4 hit = vec4(0.0);
  bool done = false;

  hit = parisRoofs(p + vec2(ptr * 0.06, 0.0), px, cx, t, cover);
  done = cover > 0.5;
  if (!done && p.y < PARIS_BANK + 0.024) {
    vec2 q = p + vec2(ptr * 0.035, 0.0);
    hit = parisBoat(q, px, aspect, t, cover);
    done = cover > 0.5;
    if (!done) {
      hit = parisBridge(q, px, cx, cover);
      done = cover > 0.5;
    }
    if (!done && p.y < PARIS_BANK) {
      hit = parisWater(q, px, cx, t);
      done = true;
    }
  }
  if (!done) {
    vec2 q = p + vec2(ptr * 0.025, 0.0);
    vec2 tp = vec2(q.x - cx, q.y - PARIS_BANK) / PARIS_TOWER;
    float lit;
    float tone = parisTower(tp, px / PARIS_TOWER, cover, lit);
    if (cover > 0.5) {
      vec3 col = parisTowerColor(tp.y, lit);
      // The sparkle: for a share of every 18 s, white flashes run over the
      // lattice, a fresh scatter ten times a second.
      if (fract(t / 18.0) < parisSparkle) {
        vec2 cellId = floor(vec2(q.x / (px * 0.62), q.y / px));
        float flash = hash21(cellId * 0.37 + floor(t * 10.0) * 1.31);
        if (flash > 0.86) {
          tone = 1.0;
          col = vec3(1.0);
        }
      }
      // The lamp at the top always burns.
      if (abs(tp.y - 0.875) < 0.02 && abs(tp.x) < 0.012) {
        tone = 1.0;
        col = vec3(1.0, 0.95, 0.8);
      }
      hit = vec4(col, tone);
      done = true;
    }
  }
  if (!done) {
    hit = parisFar(p + vec2(ptr * 0.015, 0.0), px, cx, cover);
    if (cover < 0.5) {
      hit = parisSky(p + vec2(ptr * 0.005, 0.0), px, t);
    }
    if (parisBeam > 0.5) {
      vec2 apex = vec2(cx - ptr * 0.025, PARIS_BANK + PARIS_TOWER * 0.875);
      float beam = parisBeacon(p, apex, t);
      if (beam > 0.03) {
        hit.rgb = mix(hit.rgb, vec3(1.0, 0.93, 0.72), clamp(beam * 1.4, 0.0, 1.0));
        hit.a = max(hit.a, min(beam * 0.75, 1.0));
      }
    }
  }
  // Near-black becomes paper, so the sky keeps clean gaps between glyphs.
  float tone = hit.a < 0.05 ? 0.0 : clamp(hit.a, 0.0, 1.0) * parisIntensity;
  parisCacheUv = uv;
  parisCacheT = t;
  parisCacheValue = vec4(hit.rgb, tone);
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

// Modes that paint the scene's own colours need its blue hour behind them
// in both themes; mono and palette keep the theme's paper, or the phosphor's.
const BLUE_HOUR = "#070b20";
const BLUE_HOUR_MODES: ReadonlySet<ColorMode> = new Set<ColorMode>([
  "truecolor",
  "ansi16",
  "duotone",
]);

const FALLBACK = (
  <div
    className="absolute inset-0"
    style={{
      background:
        "linear-gradient(to bottom, #070b20 0%, #1c2560 40%, #b9637f 65%, #0a1230 66%, #070b20 100%)",
    }}
  />
);

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface ParisProps extends AsciiSceneProps {
  /** How strongly it draws, from 0 (faint, for text on top) to 1. Default 1. */
  intensity?: number;
  /** Share of the time the tower sparkles with white flashes, from 0 (never) to 1 (always). Default 0.3. */
  sparkle?: number;
  /** The searchlight sweeping from the top of the tower. Default `true`. */
  beacon?: boolean;
  /** How much of the sky the clouds cover, from 0 (clear) to 1. Default 0.5. */
  clouds?: number;
  /** An engine pointer effect on top of the parallax. Default `"none"`. */
  interaction?: Interaction;
  /**
   * Paper behind the glyphs. Default: the scene's blue hour in `truecolor`,
   * `ansi16` and `duotone`; the theme's paper, or the phosphor's, otherwise.
   */
  paper?: AsciiColor;
  /** In `duotone`, the colour ramp from dark to light. Default `"sodium"`, gold on the blue hour. */
  ramp?: AsciiSceneProps["ramp"];
  /** Shown without WebGL and until the first frame. Default: a gradient in the scene's colours. */
  fallback?: ReactNode;
}

/**
 * Paris at blue hour. The Eiffel Tower glows gold over the Seine, sparkles
 * every so often and sweeps its beacon across the sky, while a
 * bateau-mouche glides under the bridge below zinc rooftops. Decorative
 * and full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Paris = ({
  charset = "standard",
  colorMode,
  phosphor,
  paper,
  ramp,
  cell = 12,
  stillTime = 2,
  interactive = true,
  interaction = "none",
  intensity = 1,
  sparkle = 0.3,
  beacon = true,
  clouds = 0.5,
  fallback = FALLBACK,
  ...props
}: ParisProps) => {
  const mode = colorMode ?? (phosphor ? "mono" : "truecolor");
  return (
    <AsciiShader
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        parisBeam: beacon ? 1 : 0,
        parisClouds: clamp(clouds, 0, 1),
        parisIntensity: clamp(intensity, 0, 1),
        parisParallax: interactive ? 1 : 0,
        parisSparkle: clamp(sparkle, 0, 1),
      }}
      charset={charset}
      colorMode={mode}
      phosphor={phosphor}
      ramp={ramp ?? (mode === "duotone" ? "sodium" : undefined)}
      paper={paper ?? (BLUE_HOUR_MODES.has(mode) ? BLUE_HOUR : undefined)}
      cell={cell}
      stillTime={stillTime}
      interaction={interactive ? interaction : "none"}
      fallback={fallback}
      {...props}
    />
  );
};
