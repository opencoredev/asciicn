import { ROUTES } from "@/constants/routes";

/**
 * Release notes for the RSS feed. Newest first. Each entry links to the page
 * a reader should open to see what changed.
 */
export interface ChangelogEntry {
  /** Stable id, used as the feed item's guid. */
  readonly id: string;
  readonly title: string;
  /** One or two plain sentences on what shipped. */
  readonly description: string;
  /** ISO date, YYYY-MM-DD. */
  readonly date: string;
  /** Site path the entry links to. */
  readonly path: string;
}

export const CHANGELOG = [
  {
    date: "2026-10-27",
    description:
      "asciicn launches: a WebGL2 and Canvas2D ASCII engine with ten charsets (classic, dense, ANSI blocks, quadrants, Braille, CP437, PETSCII, katakana, halftone and Sobel edges), five colour modes, CRT effects and export to .txt, .ans, .svg, .png and .webm. It ships with about 80 shadcn registry components, 12 animated scenes, the ASCII Studio and an agent skill.",
    id: "launch",
    path: ROUTES.DOCS,
    title: "asciicn 1.0",
  },
] as const satisfies readonly ChangelogEntry[];

/** Entries sorted newest first, whatever order they were written in. */
export const getChangelogEntries = (): readonly ChangelogEntry[] =>
  [...CHANGELOG].toSorted((a, b) => b.date.localeCompare(a.date));
