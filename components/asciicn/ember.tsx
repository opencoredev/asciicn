"use client";

import type { ReactNode } from "react";

import { cssColor, resolveCharset } from "@/lib/ascii";
import type { AsciiColor, AsciiSceneProps } from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

// A hearth fire along the bottom edge. Space is measured in flame heights,
// so the fire keeps its shape in a thin band and in a tall box alike.
// Each tongue's height comes from ridged noise, which peaks to a point;
// rising fbm licks through it, a finer noise frays its edges and tears
// pieces off the tip, and above the tip it carries on as a faint plume of
// smoke. Sparks are single samples, so each one is a crisp glyph or dot.
// `emScene` is cached per sample because field and colorField both ask.
const SCENE = `
vec4 emSpark(vec2 uv, float aspect, float flameH, float t) {
  vec2 here = floor(uv * ascii_samples);
  float lane = flameH * 0.32;
  float x = uv.x * aspect;
  float drift = emWind * flameH * 1.2;
  float centre = floor((x - drift * 0.5) / lane);
  vec4 best = vec4(0.0);
  for (int i = -4; i <= 4; i++) {
    for (int k = 0; k < 2; k++) {
      vec2 id = vec2(centre + float(i), float(k) * 31.0 + u_seed * 7.0);
      if (hash21(id + 0.37) > emSparks * 0.6) {
        continue;
      }
      float rate = hash21(id + 4.1);
      float cycle = t / mix(6.0, 11.0, rate) + hash21(id + 1.7);
      float age = fract(cycle);
      float born = floor(cycle);
      float roll = hash21(id + born * 0.731);
      // A spark burns for part of its cycle, then the lane stays dark.
      float span = mix(0.4, 0.8, hash21(id + born * 0.37 + 9.0));
      if (age > span) {
        continue;
      }
      float a = age / span;
      float y = flameH * (0.3 + 0.5 * roll) + flameH * mix(0.9, 1.7, rate) * a;
      float sx = (id.x + 0.15 + 0.7 * roll) * lane + drift * a + flameH * 0.06 * sin(a * 6.0 + roll * 40.0);
      vec2 head = floor(vec2(sx / aspect, y) * ascii_samples);
      vec2 d = here - head;
      if (d.x != 0.0 || d.y > 0.0 || d.y < -1.0) {
        continue;
      }
      float glow = (1.0 - a) * smoothstep(0.0, 0.06, a);
      // Quantised, so a spark blinks now and then rather than shimmering.
      float blink = hash21(id + vec2(floor(t * 5.0), born));
      glow *= blink < 0.14 ? 0.3 : 1.0;
      float tone;
      if (emPacked > 0.5) {
        tone = glow > 0.18 ? (d.y == 0.0 ? 1.0 : 0.8) : 0.0;
      } else {
        // Whole steps, so a spark is a star or a plus, then a dot as it dies.
        float star = glow > 0.55 ? 0.52 : (glow > 0.25 ? 0.47 : 0.12);
        tone = d.y == 0.0 ? star : glow * 0.2;
      }
      if (tone > best.a) {
        best = vec4(a, 0.0, 0.0, tone);
      }
    }
  }
  return best;
}

vec2 emCacheUv = vec2(-1.0);
float emCacheT = -1.0;
vec4 emCacheValue = vec4(0.0);

vec4 emScene(vec2 uv, vec2 res, float t) {
  if (uv == emCacheUv && t == emCacheT) {
    return emCacheValue;
  }
  float aspect = res.x / res.y;
  float flameH = max(emHeight, 0.02);
  vec2 q = vec2(uv.x * aspect, uv.y) / flameH;
  float offset = u_seed * 13.7;

  // Heat shimmer: just above the tongues, rows waver sideways a little.
  float above = smoothstep(0.45, 1.0, q.y) * (1.0 - smoothstep(1.4, 2.4, q.y));
  q.x += 0.03 * above * sin(q.y * 22.0 - t * 2.2 + 2.0 * snoise(vec2(q.x * 1.5, q.y * 2.0 - t * 0.4)));

  // The wind leans the upper flame; turbulence grows with height, so the
  // base holds steady while the tips lick sideways.
  float rise = t * 0.24;
  vec2 w = vec2(q.x - emWind * 0.3 * q.y * q.y + offset, q.y);
  w.x += snoise(vec2(w.x * 1.8, w.y * 1.1 - rise * 1.2)) * (0.03 + 0.12 * w.y);
  // Tongues: ridged noise peaks to a point, so each tongue tapers to a
  // tip. Every one breathes slowly on its own.
  float lobe = 1.0 - abs(snoise(vec2(w.x * 0.8, t * 0.08 + 5.0)));
  float ripple = 0.5 + 0.5 * snoise(vec2(w.x * 3.9 + 11.0, t * 0.16));
  float crest = 0.1 + 1.05 * pow(lobe, 2.6) + 0.2 * ripple * lobe;
  // Smaller tongues in between, so the fire overlaps instead of standing
  // in separate spikes.
  float minor = 1.0 - abs(snoise(vec2(w.x * 1.3 + 20.0, t * 0.12 + 2.0)));
  crest = max(crest, 0.1 + 0.55 * pow(minor, 2.5));
  // Licks rise through each tongue: noise stretched upward.
  float body = fbm(vec2(w.x * 3.0, w.y * 1.3 - rise * 1.5));
  float fine = fbm(vec2(w.x * 6.0 + 3.0, w.y * 2.6 - rise * 2.6));
  float reach = crest * (0.7 + 0.6 * body);
  float h = 1.0 - w.y / max(reach, 0.05);
  // Ragged edges: the fine noise eats into the silhouette, more so near
  // the tip, so no tongue ends on a flat row.
  float ragged = h + (fine - 0.5) * 1.6 * (1.0 - 0.7 * clamp(h, 0.0, 1.0));
  float shape = smoothstep(0.0, 0.22, ragged);
  float root = pow(clamp(h, 0.0, 1.0), 0.9);
  // Vertical streaks inside the tongue, so it reads as rising licks
  // rather than rows of one glyph.
  float streak = fbm(vec2(w.x * 11.0 + 1.7, w.y * 1.2 - rise * 2.2));
  float heat = shape * mix(0.3, 0.92, root) * mix(0.72, 1.08, body);
  heat *= 1.0 + 1.7 * (streak - 0.5);
  // Torn-off pieces that float just above the tips before they fade.
  float torn = smoothstep(0.6, 0.7, fine) * smoothstep(-0.5, -0.1, h) * (1.0 - smoothstep(-0.1, 0.05, h));
  heat = clamp(max(heat, torn * mix(0.14, 0.42, streak)), 0.0, 1.0);

  // Smoke: each tongue carries on above its tip as a faint plume about
  // as tall again, torn by slower noise and fading as it climbs.
  float plume = smoothstep(-1.3, -0.15, h) * (1.0 - smoothstep(-0.15, 0.1, h));
  float drift = fbm(vec2(w.x * 4.0 - 2.0, w.y * 1.6 - t * 0.3));
  // Gated by the vertical streaks too, so it rises in threads rather
  // than lying in rows, and kept to the lightest glyphs.
  float wisp = plume * smoothstep(0.48, 0.66, drift) * smoothstep(0.4, 0.62, streak) * 0.2;
  wisp *= 1.0 - smoothstep(1.4, 2.4, q.y);

  // Theme colours: paper, ink and flame from the palette.
  vec3 paper = paletteColor(0.0).rgb;
  vec3 ink = paletteColor(0.5).rgb;
  vec3 flame = paletteColor(1.0).rgb;
  // Hotter than the flame: toward the ink, which is pale on dark paper and
  // deep on light paper, so the core always has the most contrast.
  vec3 core = mix(flame, ink, 0.42);
  vec3 coal = flame * vec3(1.0, 0.6, 0.4);

  vec4 hit;
  if (heat >= wisp) {
    vec3 col = mix(coal, flame, smoothstep(0.3, 0.75, heat));
    col = mix(col, core, smoothstep(0.78, 1.0, heat));
    // Dots light by threshold, so lift the flame to keep the cores solid.
    hit = vec4(col, emPacked > 0.5 ? pow(heat, 0.6) : heat);
  } else {
    // Smoke fades from warm ink near the flames toward the paper.
    vec3 col = mix(paper, ink, 0.3 + 0.3 * plume);
    col = mix(col, flame, 0.25 * (1.0 - smoothstep(0.8, 1.6, q.y)));
    hit = vec4(col, wisp);
  }

  if (emSparks > 0.0) {
    vec4 spark = emSpark(uv, aspect, flameH, t);
    if (spark.a > hit.a) {
      hit = vec4(mix(mix(flame, core, 0.6), coal, spark.x), spark.a);
    }
  }

  emCacheUv = uv;
  emCacheT = t;
  emCacheValue = hit;
  return hit;
}
`;

const FIELD = `${SCENE}
float field(vec2 uv, vec2 res, float t) {
  return emScene(uv, res, t).a;
}
`;

const COLOR_FIELD = `${SCENE}
vec3 colorField(vec2 uv, vec2 res, float t) {
  return emScene(uv, res, t).rgb;
}
`;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export interface EmberProps extends Omit<AsciiSceneProps, "interactive"> {
  /** How tall the flames reach, from 0 (none) to 2. At 1 the tallest tongues reach about half the box. Default 1. */
  intensity?: number;
  /** Sideways wind, from -1 (to the left) to 1 (to the right). It leans the flames and carries sparks and smoke. Default 0.2. */
  wind?: number;
  /** How many sparks rise, from 0 (none) to 1. Default 0.5. */
  sparks?: number;
  /** The flames in `truecolor`, the hottest glyphs in `palette` and every glyph in `mono`. Default `"orange"`. */
  flame?: AsciiColor;
  /** The smoke, the cooler glyphs in `palette`, and what the flame's core mixes toward. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The surface behind the glyphs. Smoke fades toward it. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** Shown without WebGL and until the first frame. Default: a soft glow in the flame colour along the bottom. */
  fallback?: ReactNode;
  /** Ignored: the fire never reacts to the pointer. Accepted so galleries can pass it to every scene. */
  interactive?: boolean;
}

/**
 * A low, slow fire along the bottom edge. Tongues of flame rise and break
 * into glyph smoke, single sparks drift up on the wind, blink and go out,
 * and the air above the flames shimmers. The hottest glyphs take the flame
 * colour, cooler ones the ink, and smoke fades into the paper. Works as a
 * band along the bottom of a hero or filling a box. Decorative: size it
 * with `className`, usually `absolute inset-0`.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const Ember = ({
  intensity = 1,
  wind = 0.2,
  sparks = 0.5,
  flame = "orange",
  ink = "--ascii-ink",
  paper = "--ascii-paper",
  charset = "standard",
  chars,
  colorMode,
  phosphor,
  dither,
  cell = 12,
  stillTime = 12,
  fallback,
  // The fire has no pointer response; keep the flag off the DOM.
  interactive: _interactive,
  ...props
}: EmberProps) => {
  const { kind } = resolveCharset(charset, chars);
  // Dots light only above the threshold; blue-noise dithering keeps the
  // smoke and the flame tips as scattered dots instead of dropping them,
  // without the regular grid an ordered matrix leaves.
  const packed = kind === "braille" || kind === "quadrants";
  return (
    <AsciiShader
      {...props}
      field={FIELD}
      colorField={COLOR_FIELD}
      uniforms={{
        emHeight: 0.5 * clamp(intensity, 0, 2),
        emPacked: packed ? 1 : 0,
        emSparks: clamp(sparks, 0, 1),
        emWind: clamp(wind, -1, 1),
      }}
      // Paper twice, so `palette` mode runs paper, ink, flame by tone. The
      // shader's mono ink defaults to the last entry: the flame.
      palette={[paper, paper, ink, flame]}
      paper={phosphor === undefined ? paper : undefined}
      charset={charset}
      chars={chars}
      colorMode={colorMode ?? (phosphor ? "mono" : "truecolor")}
      phosphor={phosphor}
      dither={dither ?? (packed ? "blue-noise" : "none")}
      cell={cell}
      stillTime={stillTime}
      interaction="none"
      fallback={
        fallback ?? (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: cssColor(paper),
              backgroundImage: `radial-gradient(70% 45% at 50% 100%, color-mix(in oklab, ${cssColor(flame)} 28%, transparent), transparent)`,
            }}
          />
        )
      }
    />
  );
};
