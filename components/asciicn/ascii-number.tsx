"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

import {
  BRAILLE_DOT_BITS,
  brailleChar,
  cssColor,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * Digits are drawn from two small fonts. `box` is a seven-segment face in
 * box-drawing glyphs, three cells by three rows. The bitmap face is three
 * pixels by five, shown three ways: `blocks` (each pixel two full cells
 * wide, so pixels come out square), `half` (half blocks pack two pixel
 * rows per cell) and `braille` (each pixel a 2x2 patch of dots). Every
 * glyph of a font is the same width, so digits stay in tabular columns.
 */

export const ASCII_NUMBER_FONTS = ["blocks", "half", "box", "braille"] as const;
export type AsciiNumberFont = (typeof ASCII_NUMBER_FONTS)[number];

/** Seven-segment digits and signs in box-drawing glyphs: three rows each. */
const BOX_GLYPHS: Record<string, readonly [string, string, string]> = {
  "%": ["o ╱", " ╱ ", "╱ o"],
  "+": ["   ", "╶┼╴", "   "],
  ",": [" ", " ", "╯"],
  "-": ["   ", "╶─╴", "   "],
  ".": [" ", " ", "▪"],
  "/": ["  ╱", " ╱ ", "╱  "],
  "0": ["┌─┐", "│ │", "└─┘"],
  "1": [" ╷ ", " │ ", " ╵ "],
  "2": ["╶─┐", "┌─┘", "└─╴"],
  "3": ["╶─┐", " ─┤", "╶─┘"],
  "4": ["╷ ╷", "└─┤", "  ╵"],
  "5": ["┌─╴", "└─┐", "╶─┘"],
  "6": ["┌─╴", "├─┐", "└─┘"],
  "7": ["╶─┐", "  │", "  ╵"],
  "8": ["┌─┐", "├─┤", "└─┘"],
  "9": ["┌─┐", "└─┤", "╶─┘"],
  ":": [" ", "∙", "∙"],
};

/** The 3x5 bitmap face: `#` is a lit pixel. Narrow signs are one pixel wide. */
const BITMAP: Record<string, readonly string[]> = {
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  ",": ["..", "..", "..", ".#", "#."],
  "-": ["...", "...", "###", "...", "..."],
  ".": [".", ".", ".", ".", "#"],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": [".#.", "##.", ".#.", ".#.", "###"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", ".##", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", ".#.", ".#."],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
  ":": [".", "#", ".", "#", "."],
};

const HALF = [" ", "▀", "▄", "█"] as const;

type Bitmap = readonly string[];

const isLit = (bitmap: Bitmap, x: number, y: number) => bitmap[y]?.[x] === "#";

/** Each pixel two full cells wide, so pixels come out square. */
const blocksRows = (bitmap: Bitmap): string[] =>
  bitmap.map((row) => [...row].map((p) => (p === "#" ? "██" : "  ")).join(""));

/** Two pixel rows per cell in half blocks; the sixth row is empty. */
const halfRows = (bitmap: Bitmap): string[] => {
  const width = bitmap[0]?.length ?? 0;
  const rows: string[] = [];
  for (let y = 0; y < 6; y += 2) {
    let line = "";
    for (let x = 0; x < width; x += 1) {
      line +=
        HALF[(isLit(bitmap, x, y) ? 1 : 0) + (isLit(bitmap, x, y + 1) ? 2 : 0)];
    }
    rows.push(line);
  }
  return rows;
};

/**
 * Each pixel a 2x2 patch of dots: 5 pixel rows make 10 dot rows over 3
 * cells, with one empty dot row above and below to centre the digit.
 */
const brailleRows = (bitmap: Bitmap): string[] => {
  const width = bitmap[0]?.length ?? 0;
  const rows: string[] = [];
  for (let cellRow = 0; cellRow < 3; cellRow += 1) {
    let line = "";
    for (let x = 0; x < width; x += 1) {
      let mask = 0;
      for (let dotRow = 0; dotRow < 4; dotRow += 1) {
        const pixelY = Math.floor((cellRow * 4 + dotRow - 1) / 2);
        if (isLit(bitmap, x, pixelY)) {
          // Both dots of the row: the bits are distinct, so adding sets them.
          mask +=
            (BRAILLE_DOT_BITS[dotRow]?.[0] ?? 0) +
            (BRAILLE_DOT_BITS[dotRow]?.[1] ?? 0);
        }
      }
      line += brailleChar(mask);
    }
    rows.push(line);
  }
  return rows;
};

/** Rows of text for one character in a font, or `null` when the font lacks it. */
const drawChar = (
  char: string,
  font: AsciiNumberFont
): readonly string[] | null => {
  if (font === "box") {
    return BOX_GLYPHS[char] ?? null;
  }
  const bitmap = BITMAP[char];
  if (!bitmap) {
    return null;
  }
  switch (font) {
    case "blocks": {
      return blocksRows(bitmap);
    }
    case "half": {
      return halfRows(bitmap);
    }
    case "braille": {
      return brailleRows(bitmap);
    }
    default: {
      const exhaustive: never = font;
      return exhaustive;
    }
  }
};

const ROWS = {
  blocks: 5,
  box: 3,
  braille: 3,
  half: 3,
} as const satisfies Record<AsciiNumberFont, number>;

/** Cells between glyphs. */
const GAP = {
  blocks: 2,
  box: 1,
  braille: 1,
  half: 1,
} as const satisfies Record<AsciiNumberFont, number>;

interface Rendered {
  readonly lines: readonly string[];
  readonly ghost: readonly string[];
}

/**
 * Lay out a string in a font. Characters the font lacks (letters from
 * compact notation, currency signs) are set as one plain glyph on the
 * bottom row, like a unit. `ghost` is every digit position drawn as an
 * `8`, for the unlit-segment look.
 */
const render = (text: string, font: AsciiNumberFont): Rendered => {
  const rows = ROWS[font];
  const lines = Array.from({ length: rows }, () => "");
  const ghost = Array.from({ length: rows }, () => "");
  const gap = " ".repeat(GAP[font]);
  const eight = drawChar("8", font);
  for (const [index, char] of [...text].entries()) {
    const glyph = drawChar(char, font);
    const isDigit = char >= "0" && char <= "9";
    const cells =
      glyph ??
      Array.from({ length: rows }, (_, row) =>
        row === rows - 1 ? char.trim() || " " : " "
      );
    const width = Math.max(...cells.map((row) => [...row].length));
    for (let row = 0; row < rows; row += 1) {
      const cell = (cells[row] ?? "").padEnd(width, " ");
      const prefix = index === 0 ? "" : gap;
      lines[row] += prefix + cell;
      ghost[row] +=
        prefix + (isDigit && eight ? (eight[row] ?? "") : " ".repeat(width));
    }
  }
  return { ghost, lines };
};

/**
 * Decimals to count in: the format's own maximum when it sets one,
 * otherwise as many as the value has (at most 3, as Intl shows).
 */
const decimalsOf = (
  value: number,
  format: Intl.NumberFormatOptions | undefined
): number => {
  if (format?.maximumFractionDigits !== undefined) {
    return format.maximumFractionDigits;
  }
  const [, fraction = ""] = String(value).split(".");
  return Math.min(3, fraction.length);
};

/** Pad every line on the left to `width` cells, so numbers align right. */
const padStart = (lines: readonly string[], width: number) =>
  lines.map((line) => line.padStart(width, " "));

export interface AsciiNumberProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "children" | "color" | "prefix"
> {
  /** The number to show. Changing it counts from the shown value to the new one. */
  value: number;
  /** Where the first count starts. Default 0. */
  from?: number;
  /** The digit face. Default `"blocks"`. */
  font?: AsciiNumberFont;
  /** Text before the number, drawn in the font where it can be. Default none. */
  prefix?: string;
  /** Text after the number, such as `"%"` or `" ms"`. Default none. */
  suffix?: string;
  /** A BCP 47 locale for grouping and decimals, such as `"de-DE"`. Fixed by default so server and browser agree. Default `"en-US"`. */
  locale?: string;
  /** `Intl.NumberFormat` options: decimals, compact notation, units. Default `{}`. */
  format?: Intl.NumberFormatOptions;
  /** Count on change and on the first view. Default `true`. */
  animate?: boolean;
  /** Seconds a count takes. Default 1.4. */
  duration?: number;
  /** When the first count plays. Default `"view"`. */
  trigger?: "mount" | "view";
  /** Draw unlit segments of every digit faintly, as on an LCD. Default `false`. */
  ghost?: boolean;
  /** Glyph colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
  /** Which side digits line up on as the width changes. Default `"end"`. */
  align?: "start" | "end";
}

type NumberVars = CSSProperties & Record<"--num-cell", string>;

// Ease-out expo: fast at first, settling softly on the final value.
const easeOut = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/**
 * A big number drawn in glyphs: block, half-block, braille or
 * seven-segment box-drawing digits that count to their value with
 * tabular alignment, locale formatting, a prefix and a suffix. The real
 * number is in the element for screen readers and copy.
 */
export const AsciiNumber = ({
  value,
  from = 0,
  font = "blocks",
  prefix = "",
  suffix = "",
  locale = "en-US",
  format,
  animate = true,
  duration = 1.4,
  trigger = "view",
  ghost = false,
  color = "ink",
  cell,
  align = "end",
  className,
  style,
  ...props
}: AsciiNumberProps) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const motion = animate && !reduced;
  const [shown, setShown] = useState(motion ? from : value);
  const shownRef = useRef(shown);
  const startedRef = useRef(false);
  const formatter = new Intl.NumberFormat(locale, format);
  const formatValue = (input: number) => formatter.format(input);
  const decimals = decimalsOf(value, format);

  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  const armed = trigger === "mount" || inView || startedRef.current;
  useEffect(() => {
    if (!motion) {
      setShown(value);
      return;
    }
    if (!armed) {
      return;
    }
    startedRef.current = true;
    const start = performance.now();
    const origin = shownRef.current;
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // Count in steps of the final value's precision, so no extra decimals appear mid-count.
      const unit = 10 ** -decimals;
      const next = origin + (value - origin) * easeOut(t);
      setShown(t >= 1 ? value : Math.round(next / unit) * unit);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, motion, armed, duration, decimals]);

  // Reserve the widest of the start and end values, so the count never resizes the box.
  const target = render(`${prefix}${formatValue(value)}${suffix}`, font);
  const origin = render(`${prefix}${formatValue(from)}${suffix}`, font);
  const current = render(`${prefix}${formatValue(shown)}${suffix}`, font);
  const width = Math.max(
    ...[target, origin, current].map((art) => [...(art.lines[0] ?? "")].length)
  );
  const fit = (lines: readonly string[]) =>
    align === "end"
      ? padStart(lines, width)
      : lines.map((line) => line.padEnd(width, " "));

  const vars: NumberVars = {
    "--num-cell": cell === undefined ? "var(--ascii-cell, 12px)" : `${cell}px`,
  };
  const art =
    "m-0 whitespace-pre font-[family-name:var(--ascii-font,ui-monospace,monospace)] leading-[var(--num-cell)] font-normal tracking-normal [font-size:calc(var(--num-cell)/1.2)] [font-variant-ligatures:none]";

  return (
    <div
      ref={rootRef}
      data-slot="ascii-number"
      data-font={font}
      className={cn("relative inline-block", className)}
      style={{ ...vars, color: cssColor(color), ...style }}
      {...props}
    >
      <span className="sr-only">{`${prefix}${formatValue(value)}${suffix}`}</span>
      {ghost ? (
        <pre
          aria-hidden="true"
          className={cn(art, "absolute inset-0 opacity-[0.14]")}
        >
          {fit(current.ghost).join("\n")}
        </pre>
      ) : null}
      <pre aria-hidden="true" className={cn(art, "relative")}>
        {fit(current.lines).join("\n")}
      </pre>
    </div>
  );
};
