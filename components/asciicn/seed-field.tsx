"use client";

import { useMemo } from "react";

import { cssColor, luma, useAsciiColors } from "@/lib/ascii";
import type {
  AsciiColor,
  AsciiPalette,
  AsciiSceneProps,
  Interaction,
} from "@/lib/ascii";
import { seedCss, seedParams, SEED_GLSL, seedUniforms } from "@/lib/ascii/seed";
import type { SeedKind, SeedOptions, SeedStops } from "@/lib/ascii/seed";
import { AsciiShader } from "@/lib/ascii/shader";

export interface SeedFieldProps extends AsciiSceneProps {
  /** Any string. The same seed always draws the same field. Default `"asciicn"`. */
  seed?: string;
  /** `ribbons` (folded bands of light) or `nebula` (warped gas). Default `"ribbons"`. */
  kind?: SeedKind;
  /**
   * Steers the roll: a hue range, how far the palette turns, vividness,
   * narrower parameter ranges. Pass a constant: a new object re-rolls.
   */
  options?: SeedOptions;
  /** Scales the exposure the seed settled on, 0 to 1.5. Lower it to sit text on top. Default 1. */
  intensity?: number;
  /** Paper first, then inks, for `palette` mode. Default: paper, then the seed's four colours. */
  palette?: AsciiPalette;
  /** Glyph colour in `mono` mode. Default `"--ascii-ink"`. */
  ink?: AsciiColor;
  /** The surface behind the glyphs. Default `"--ascii-paper"`. */
  paper?: AsciiColor;
  /** What the pointer does to the glyphs. `interactive={false}` turns it off. Default `"none"`. */
  interaction?: Interaction;
}

/** Ink and paper for the shader, unless a phosphor brings its own. */
const glass = (
  phosphor: string | undefined,
  ink: AsciiColor,
  paper: AsciiColor
): { ink?: AsciiColor; paper?: AsciiColor } =>
  phosphor === undefined ? { ink, paper } : {};

/** Whether the paper is light, read from the theme. Dark until mounted. */
const useLightPaper = (paper: AsciiColor) => {
  const names = useMemo(() => [paper] as const, [paper]);
  const colors = useAsciiColors(undefined, names);
  const rgba = colors?.[0];
  return rgba === undefined
    ? false
    : luma(rgba[0] * 255, rgba[1] * 255, rgba[2] * 255) > 0.5;
};

/** The seed's palette as soft CSS light, shown without WebGL. */
const SeedFallback = ({
  stops,
  paper,
}: {
  stops: SeedStops;
  paper: AsciiColor;
}) => {
  const [deep, mid, bright, top] = stops.map(seedCss);
  return (
    <div
      className="absolute inset-0"
      style={{
        backgroundColor: cssColor(paper),
        backgroundImage: `radial-gradient(60% 45% at 30% 40%, color-mix(in oklab, ${bright} 30%, transparent), transparent), radial-gradient(50% 40% at 72% 62%, color-mix(in oklab, ${mid} 35%, transparent), transparent), radial-gradient(30% 20% at 55% 48%, color-mix(in oklab, ${top} 18%, transparent), transparent), linear-gradient(160deg, color-mix(in oklab, ${deep} 18%, transparent), transparent 70%)`,
      }}
    />
  );
};

/**
 * Any string drawn as a field of glyphs: folded ribbons of light or warped
 * gas, each seed with its own OKLCH palette, shape and motion. The roll is
 * checked by a small exposure critic, so no seed comes out empty or blown
 * out. Decorative and full-bleed: size it with `className`, usually
 * `absolute inset-0`. Prism, Ionize, Squall, Satin and Nebula are presets
 * of this.
 */
export const SeedField = ({
  seed = "asciicn",
  kind = "ribbons",
  options,
  intensity = 1,
  palette,
  ink = "--ascii-ink",
  paper = "--ascii-paper",
  charset = "standard",
  colorMode = "truecolor",
  cell = 12,
  interaction = "none",
  interactive = true,
  stillTime = 8,
  ...props
}: SeedFieldProps) => {
  // A roll costs a few milliseconds (the critic samples the field), so it
  // only reruns when the seed, kind or options object changes.
  const params = useMemo(
    () => seedParams(seed, kind, options),
    [seed, kind, options]
  );
  const onLight = useLightPaper(paper);
  const uniforms = useMemo(
    () => seedUniforms(params, { intensity, onLight }),
    [params, intensity, onLight]
  );
  const stops = onLight ? params.palette.light : params.palette.dark;
  const colors = palette ?? [
    paper,
    seedCss(stops[0]),
    seedCss(stops[1]),
    seedCss(stops[2]),
    seedCss(stops[3]),
  ];

  return (
    <AsciiShader
      {...props}
      cell={cell}
      charset={charset}
      colorMode={colorMode}
      {...glass(props.phosphor, ink, paper)}
      interaction={interactive ? interaction : "none"}
      field={SEED_GLSL[kind].field}
      colorField={SEED_GLSL[kind].colorField}
      palette={colors}
      stillTime={stillTime}
      uniforms={uniforms}
      fallback={<SeedFallback stops={stops} paper={paper} />}
    />
  );
};
