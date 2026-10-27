import {
  Cascadia_Mono as FontMono,
  Instrument_Sans as FontSans,
  Martian_Mono as FontDisplay,
} from "next/font/google";

import { cn } from "@/lib/utils";

/*
 * Three faces, mono first:
 * - Martian Mono (display): headings, the wordmark, nav and chrome labels.
 *   Wide, squared and engineered; nothing else on the ASCII web uses it.
 * - Cascadia Mono (mono + glyphs): code, status bars and every rendered
 *   glyph. It is the only Google face that ships box drawing, block
 *   elements (symbols2) and the full Braille block, so `--ascii-font`
 *   needs no fallback for the charsets the engine draws.
 * - Instrument Sans (sans): long docs prose only, where a proportional
 *   face reads faster than mono.
 */
const fontDisplay = FontDisplay({
  axes: ["wdth"],
  subsets: ["latin"],
  variable: "--font-display",
});

const fontMono = FontMono({
  subsets: ["latin", "symbols2", "braille"],
  variable: "--font-mono",
});

const fontSans = FontSans({
  axes: ["wdth"],
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontVariables = cn(
  fontDisplay.variable,
  fontMono.variable,
  fontSans.variable
);
