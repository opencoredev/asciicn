import {
  Cascadia_Mono as FontGlyphs,
  JetBrains_Mono as FontMono,
  Schibsted_Grotesk as FontSans,
} from "next/font/google";

import { cn } from "@/lib/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

// JetBrains Mono on Google Fonts has no Braille or block elements, so the
// glyph font falls back to Cascadia Mono for those charsets only. Its
// faces load by unicode-range, so pages without them never fetch it.
const fontGlyphs = FontGlyphs({
  preload: false,
  subsets: ["symbols2", "braille"],
  variable: "--font-glyphs",
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontGlyphs.variable
);
