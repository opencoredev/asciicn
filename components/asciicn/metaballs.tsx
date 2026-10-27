"use client";

import { cssColor } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
  PhosphorName,
} from "@/lib/ascii";
import { AsciiShader } from "@/lib/ascii/shader";

export interface MetaballsProps extends AsciiSceneProps {
  /** The paper behind the glyphs. Default `"--ascii-paper"`. Ignored when `palette` is set. */
  paper?: AsciiColor;
  /**
   * Blob colours, handed out in turn. In `truecolor` mode each blob takes
   * one and merging blobs blend. Default `["ink"]`.
   */
  colors?: readonly [AsciiColor, ...AsciiColor[]];
  /** Paper first, then the blob colours. Wins over `paper` and `colors`. */
  palette?: AsciiPalette;
  /** Solid shaded blobs with a bright rim, or rings of contour lines around them. Default `"solid"`. */
  variant?: "solid" | "rings";
  /** How many blobs, 2 to 8. Default 5. */
  count?: number;
  /** Size of the blobs. Default 1. */
  size?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

const FIELD = `
// Sum of soft falloffs (x: 1.0 is the edge of a blob, more is inside) and
// the falloff-weighted colour position of the blobs that make it (y).
vec2 metaballsSum(vec2 p, float aspect, float unit, float t) {
  float sum = 0.0;
  float hue = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    if (fi >= metaballsCount) break;
    float seed = fi * 1.618;
    // Each blob rises and sinks on its own slow loop, with a little sideways drift.
    vec2 centre = vec2(
      aspect * (0.5 + 0.3 * sin(t * (0.05 + 0.017 * fi) + seed * 2.3)),
      0.5 + 0.34 * sin(t * (0.07 + 0.013 * fi) + seed * 3.1)
    );
    float radius = unit * metaballsSize * (0.14 + 0.06 * fract(seed * 7.3));
    vec2 d = p - centre;
    float w = radius * radius / max(dot(d, d), 1e-5);
    sum += w;
    hue += w * mod(fi, metaballsColors) / max(metaballsColors - 1.0, 1.0);
  }
  return vec2(sum, hue / max(sum, 1e-5));
}

float field(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  // In a tall box, size blobs by the width so they still fit.
  float unit = min(aspect, 1.0);
  float f = metaballsSum(p, aspect, unit, t).x;

  if (metaballsMode > 0.5) {
    // Contour lines of the field, evenly spaced in log space so they ring
    // each blob, about one and a half sample rows wide.
    float row = 1.0 / res.y;
    float h = log(f);
    float hx = log(metaballsSum(p + vec2(row, 0.0), aspect, unit, t).x);
    float hy = log(metaballsSum(p + vec2(0.0, row), aspect, unit, t).x);
    float count = 3.2;
    float v = h * count + t * 0.12;
    float offset = abs(fract(v + 0.5) - 0.5);
    float perSample = max(length(vec2(hx - h, hy - h)) * count, 1e-4);
    float line = 1.0 - smoothstep(0.4, 1.4, offset / perSample);
    float inside = smoothstep(0.85, 1.15, f);
    float fade = smoothstep(0.08, 0.6, f);
    return max(line * mix(0.5, 1.0, inside) * fade, inside * 0.12);
  }

  // Shaded inside, densest at the cores, with a bright rim at each edge and
  // a faint halo outside, so the outline reads in any charset.
  float inside = smoothstep(0.94, 1.06, f);
  // Never below half tone inside, so Braille and quadrants fill solid, then
  // up to full at the cores, so ramp charsets shade each blob like a sphere.
  float core = mix(0.55, 0.95, smoothstep(1.1, 4.5, f));
  float rim = smoothstep(0.94, 1.0, f) * (1.0 - smoothstep(1.05, 1.35, f));
  float halo = 0.14 * smoothstep(0.6, 1.0, f);
  return max(mix(halo, core, inside), rim);
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  return paletteColor(metaballsSum(p, aspect, min(aspect, 1.0), t).y).rgb;
}
`;

/** A phosphor brings its own ink and glass, so ours only apply without one. */
const ownColors = (
  phosphor: PhosphorName | undefined,
  ink: AsciiColor,
  paper: AsciiColor
) => (phosphor === undefined ? { ink, paper } : {});

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Soft CSS blobs, shown without WebGL. */
const fallbackImage = (palette: AsciiPalette) => {
  const ink = cssColor(palette[1]);
  const blob = (at: string) =>
    `radial-gradient(circle at ${at}, color-mix(in oklab, ${ink} 55%, transparent) 0 10%, transparent 18%)`;
  return [blob("30% 40%"), blob("62% 62%"), blob("78% 30%")].join(", ");
};

/**
 * Soft blobs drawn in glyphs that drift, merge and split like a lava lamp,
 * solid with a bright rim or ringed with contour lines. Decorative and
 * full-bleed: size it with `className`, usually `absolute inset-0`.
 */
export const Metaballs = ({
  paper = "--ascii-paper",
  colors = ["ink"],
  palette,
  variant = "solid",
  count = 5,
  size = 1,
  charset = "blocks",
  colorMode = "palette",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  stillTime = 20,
  ...props
}: MetaballsProps) => {
  const [first, ...rest] = colors;
  const ramp: AsciiPalette = palette ?? [paper, first, ...rest];
  const blobColors = Math.max(1, ramp.length - 1);

  return (
    <AsciiShader
      {...props}
      charset={charset}
      colorMode={colorMode}
      cell={cell}
      phosphor={phosphor}
      {...ownColors(phosphor, ramp[1], ramp[0])}
      interaction={interactive ? interaction : "none"}
      field={FIELD}
      colorField={COLOR_FIELD}
      palette={ramp}
      stillTime={stillTime}
      uniforms={{
        metaballsColors: blobColors,
        metaballsCount: clamp(Math.round(count), 2, 8),
        metaballsMode: variant === "rings" ? 1 : 0,
        metaballsSize: Math.max(0.1, size),
      }}
      fallback={
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: cssColor(ramp[0]),
            backgroundImage: fallbackImage(ramp),
          }}
        />
      }
    />
  );
};
