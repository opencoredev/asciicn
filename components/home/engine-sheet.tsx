"use client";

import { useRef } from "react";

import {
  AsciiGrid,
  CHARSET_NAMES,
  CHARSETS,
  createToneField,
  mapTones,
  useAsciiColors,
} from "@/lib/ascii";
import type {
  AsciiGridDrawContext,
  CharsetName,
  ColorMode,
  MapOptions,
  Rgb8,
  ToneField,
} from "@/lib/ascii";

/**
 * Home: "the engine in one screen". One field, a lit sphere turning under
 * a moving pattern, computed on the CPU and mapped by `mapTones` through
 * each charset and each colour mode. Canvas2D only, no WebGL, and every
 * tile pauses offscreen.
 */

const TAU = Math.PI * 2;
const LIGHT = (() => {
  const [x, y, z] = [-0.55, 0.6, 0.7];
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length] as const;
})();

const hsv = (h: number, s: number, v: number): Rgb8 => {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [
    Math.round(f(5) * 255),
    Math.round(f(3) * 255),
    Math.round(f(1) * 255),
  ];
};

/** Tone (and colour) of the sphere at a sample, `v` 0 at the top. */
const sphere = (
  u: number,
  v: number,
  time: number,
  aspect: number
): readonly [number, number, number, number] => {
  const x = (u - 0.5) * aspect * 2.3;
  const y = (0.5 - v) * 2.3;
  const r2 = x * x + y * y;
  if (r2 >= 1) {
    // A faint halo so the empty glyphs have something to say.
    const halo = Math.max(0, 1 - (Math.sqrt(r2) - 1) * 2.4);
    return [halo * halo * 0.16, 40, 40, 60];
  }
  const z = Math.sqrt(1 - r2);
  const diffuse = Math.max(0, x * LIGHT[0] + y * LIGHT[1] + z * LIGHT[2]);
  const longitude = Math.atan2(x, z) + time * 0.5;
  const latitude = Math.asin(y);
  const pattern =
    0.5 + 0.5 * Math.sin(longitude * 5) * Math.sin(latitude * 6 + time * 0.3);
  const tone = Math.min(1, 0.06 + diffuse * (0.35 + 0.75 * pattern));
  const [r, g, b] = hsv(
    (((longitude / TAU) % 1) + 1) % 1,
    0.72,
    0.3 + 0.7 * diffuse
  );
  return [tone, r, g, b];
};

const useSphereDraw = (options: MapOptions) => {
  const cache = useRef<{ key: string; field: ToneField } | null>(null);
  return ({ frame, columns, rows, time, metrics }: AsciiGridDrawContext) => {
    const charset = options.charset ?? "standard";
    const colored = (options.colorMode ?? "mono") !== "mono";
    const key = `${columns}x${rows}:${typeof charset === "string" ? charset : charset.id}:${colored}`;
    if (cache.current?.key !== key) {
      cache.current = {
        field: createToneField(columns, rows, charset, { color: colored }),
        key,
      };
    }
    const { field } = cache.current;
    const aspect =
      (columns * metrics.width) / Math.max(1, rows * metrics.height);
    const { width, height, tones, colors } = field;
    for (let y = 0; y < height; y += 1) {
      const v = (y + 0.5) / height;
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const [tone, r, g, b] = sphere((x + 0.5) / width, v, time, aspect);
        tones[index] = tone;
        if (colors) {
          colors[index * 4] = r;
          colors[index * 4 + 1] = g;
          colors[index * 4 + 2] = b;
          colors[index * 4 + 3] = 255;
        }
      }
    }
    mapTones(field, columns, rows, options, frame);
  };
};

const CHARSET_NOTES = {
  blocks: "Four shades from the IBM PC. Solid, heavy fills.",
  braille: "Eight dots per cell, the finest detail a glyph can hold.",
  cp437: "The DOS code page: suits, faces and arrows as tones.",
  dense: "Seventy levels, for smooth gradients and photos.",
  dots: "Halftone dots that grow with the tone.",
  edge: "Sobel edges draw outlines with - / | \\ and fill the rest.",
  katakana: "Half-width katakana and digits, the digital rain set.",
  petscii: "Commodore 64 shapes: diagonals, corners and solids.",
  quadrants: "Four sub-cells per glyph, so edges look twice as fine.",
  standard: "Ten levels of plain ASCII. Safe in any font.",
} as const satisfies Record<CharsetName, string>;

const COLOR_NOTES = [
  { mode: "mono", note: "One ink, from your theme or a phosphor." },
  { mode: "truecolor", note: "Each glyph takes the colour under it." },
  {
    mode: "ansi16",
    note: "Snapped to the 16 VGA colours. Pastes into a terminal.",
  },
  { mode: "duotone", note: "Tone read through a ramp, here outrun." },
  { mode: "palette", note: "Your own colours, paper to ink, by tone." },
] as const satisfies readonly { mode: ColorMode; note: string }[];

const Tile = ({
  label,
  meta,
  note,
  options,
  colored,
}: {
  label: string;
  meta: string;
  note: string;
  options: MapOptions;
  colored: boolean;
}) => {
  const draw = useSphereDraw(options);
  return (
    <figure className="border-rule flex flex-col border">
      <div className="bg-ascii-paper relative aspect-[4/3]">
        <AsciiGrid
          className="absolute inset-0"
          draw={draw}
          cell={10}
          fps={15}
          colored={colored}
        />
      </div>
      <figcaption className="border-rule flex flex-1 flex-col gap-1 border-t px-2.5 py-2">
        <span className="flex items-baseline justify-between gap-2 font-mono text-[12px]">
          <span className="text-foreground">{label}</span>
          <span className="text-faint">{meta}</span>
        </span>
        <span className="text-muted-foreground text-[12.5px] leading-snug text-pretty">
          {note}
        </span>
      </figcaption>
    </figure>
  );
};

const toRgb8 = ([r, g, b]: readonly number[]): Rgb8 => [
  Math.round((r ?? 0) * 255),
  Math.round((g ?? 0) * 255),
  Math.round((b ?? 0) * 255),
];

const PALETTE_NAMES = [
  "--ascii-paper",
  "--ascii-color-blue",
  "--ascii-color-pink",
  "--ascii-ink",
] as const;

export const EngineSheet = () => {
  const ref = useRef<HTMLDivElement>(null);
  const palette = useAsciiColors(ref, PALETTE_NAMES);
  const paletteBytes = palette?.map(toRgb8);

  return (
    <div ref={ref} className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <h3 className="label-caps text-muted-foreground">
          Charsets · {CHARSET_NAMES.length}
        </h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {CHARSET_NAMES.map((id) => CHARSETS[id]).map((charset) => (
            <Tile
              key={charset.id}
              label={charset.id}
              meta={
                charset.grid[0] * charset.grid[1] > 1
                  ? `${charset.grid[0]}×${charset.grid[1]} per cell`
                  : `${charset.glyphs.length} glyphs`
              }
              note={CHARSET_NOTES[charset.id]}
              options={{ charset: charset.id }}
              colored={false}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="label-caps text-muted-foreground">Colour modes · 5</h3>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
          {COLOR_NOTES.map(({ mode, note }) => (
            <Tile
              key={mode}
              label={mode}
              meta="dense"
              note={note}
              colored={mode !== "mono"}
              options={{
                ansi: "vga",
                charset: "dense",
                colorMode: mode,
                palette: paletteBytes,
                ramp: "outrun",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
