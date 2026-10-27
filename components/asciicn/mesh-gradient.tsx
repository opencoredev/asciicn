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

export interface MeshGradientProps extends AsciiSceneProps {
  /** The paper behind the glyphs. Default `"--ascii-paper"`. Ignored when `palette` is set. */
  paper?: AsciiColor;
  /**
   * The blob colours. In `truecolor` mode blob `i` takes colour `i`, and
   * where blobs meet their colours blend. Default `["ink", "purple",
   * "pink", "orange", "blue"]`.
   */
  colors?: readonly [AsciiColor, ...AsciiColor[]];
  /** Paper first, then the blob colours. Wins over `paper` and `colors`. */
  palette?: AsciiPalette;
  /** How many colour blobs drift across the box, 3 to 5. Default 4. */
  blobs?: number;
  /** Size of each blob, as a share of the box height. Default 0.6. */
  size?: number;
  /** How far slow noise bends the blobs, 0 to 1. Default 0.35. */
  warp?: number;
  /** How much the glyph density follows the blobs, 0 (an even fill) to 1 (dense cores, sparse gaps). Default 0.7. */
  contrast?: number;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

const MESH_COLORS = [
  "ink",
  "purple",
  "pink",
  "orange",
  "blue",
] as const satisfies readonly AsciiColor[];

// meshBlend returns the glyph density and the blended position on the
// palette ramp, so tone shows the blobs' shape and colour their mix.
const FIELD = `
vec2 meshBlend(vec2 uv, vec2 res, float t) {
  float aspect = res.x / res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 warp = vec2(fbm(p * 1.1 + vec2(t * 0.02, 0.0)), fbm(p * 1.1 + vec2(7.3, -t * 0.02)));
  p += (warp - 0.5) * 0.7 * meshWarp;
  float weights = 0.0;
  float strongest = 0.0;
  float hue = 0.0;
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    if (fi < meshCount) {
      float sx = 0.045 * (1.0 + fi * 0.23);
      float sy = 0.038 * (1.0 + fi * 0.19);
      vec2 c = vec2(
        (0.5 + 0.38 * cos(t * sx + fi * 2.4)) * aspect,
        0.5 + 0.36 * sin(t * sy + fi * 1.7)
      );
      float d = length(p - c) / meshSize;
      float w = exp(-d * d * 2.2);
      weights += w;
      strongest = max(strongest, w);
      hue += w * fi / max(meshCount - 1.0, 1.0);
    }
  }
  // Density follows the nearest blob, not the sum, so each core reaches
  // the densest glyph and the seams between blobs open up to light ones.
  float density = smoothstep(0.04, 0.95, strongest);
  float tone = mix(0.55, density, meshContrast) * 0.96;
  return vec2(clamp(tone, 0.0, 1.0), hue / max(weights, 1e-4));
}

float field(vec2 uv, vec2 res, float t) {
  return meshBlend(uv, res, t).x;
}
`;

const COLOR_FIELD = `
vec3 colorField(vec2 uv, vec2 res, float t) {
  return paletteColor(meshBlend(uv, res, t).y).rgb;
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

/** The blobs as blurred CSS radial gradients, shown without WebGL. */
const fallbackImage = (palette: AsciiPalette, blobs: number) => {
  const spots = [
    [20, 25],
    [78, 30],
    [65, 80],
    [25, 75],
    [50, 50],
  ] as const;
  return spots
    .slice(0, blobs)
    .map(([x, y], index) => {
      const color = palette[Math.min(index + 1, palette.length - 1)];
      return `radial-gradient(circle at ${x}% ${y}%, ${cssColor(color ?? palette[1])} 0%, transparent 55%)`;
    })
    .join(", ");
};

/**
 * Three to five colour blobs drawn in glyphs that drift and melt into each
 * other: density follows the blobs, colour blends where they meet.
 * Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`.
 */
export const MeshGradient = ({
  paper = "--ascii-paper",
  colors = MESH_COLORS,
  palette,
  blobs = 4,
  size = 0.6,
  warp = 0.35,
  contrast = 0.7,
  charset = "dots",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  phosphor,
  ...props
}: MeshGradientProps) => {
  const count = clamp(Math.round(blobs), 3, 5);
  const [first, ...rest] = colors;
  const ramp: AsciiPalette = palette ?? [
    paper,
    first,
    ...rest.slice(0, count - 1),
  ];

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
      uniforms={{
        meshContrast: clamp(contrast, 0, 1),
        meshCount: count,
        meshSize: Math.max(0.05, size),
        meshWarp: clamp(warp, 0, 1),
      }}
      fallback={
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundColor: cssColor(ramp[0]),
            backgroundImage: fallbackImage(ramp, count),
          }}
        />
      }
    />
  );
};
