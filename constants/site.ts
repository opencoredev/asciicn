// Set SITE_URL (or deploy on Vercel) to get real canonical URLs.
export const FALLBACK_SITE_ORIGIN = "http://localhost:3000" as const;

/** The canonical production origin, used when a production build has no other. */
export const PRODUCTION_SITE_ORIGIN = "https://asciicn.dev" as const;

const getBaseUrl = () => {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL;
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  return PRODUCTION_SITE_ORIGIN;
};

const baseUrl = getBaseUrl();

/**
 * The origin install commands and registry items point at. Unlike the
 * canonical URL, a Vercel preview uses its own deployment, so a command
 * copied from a preview installs that preview's code. scripts/build-registry.ts
 * uses the same rule. Each variable is read literally so Next inlines it into
 * client components (next.config.mjs passes them through).
 */
export const getRegistryOrigin = (): string => {
  if (process.env.SITE_URL) {
    return process.env.SITE_URL.replace(/\/$/u, "");
  }
  if (process.env.VERCEL_ENV === "production") {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return host ? `https://${host}` : PRODUCTION_SITE_ORIGIN;
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return FALLBACK_SITE_ORIGIN;
};

export const SITE = {
  AUTHOR: {
    NAME: "Leo",
    URL: "https://github.com/leoisadev1",
  },
  DESCRIPTION: {
    LONG: "ASCII art for React apps, drawn with real glyphs. asciicn is a WebGL2 and Canvas2D engine with ten charsets (classic, dense, ANSI blocks, quadrants, Braille, CP437, PETSCII, katakana, halftone and Sobel edges), five colour modes and CRT effects, plus a skill that teaches your coding agent to build on it. Around 80 shadcn components, 12 animated scenes and an ASCII Studio show what it draws. Export any frame as text, ANSI, SVG, PNG or WebM.",
    SHORT: "ASCII art engine and components for React",
  },
  KEYWORDS: [
    "ascii art",
    "ascii shader",
    "webgl2 ascii",
    "ascii renderer",
    "ascii animation",
    "braille art",
    "ansi art",
    "cp437",
    "petscii",
    "text mode graphics",
    "ascii studio",
    "image to ascii",
    "crt effect",
    "react ascii components",
    "shadcn registry",
    "agent skill",
    "npx shadcn add",
  ] as const,
  NAME: "asciicn",
  OG_IMAGE: `${baseUrl}/og`,
  REGISTRY: `${getRegistryOrigin()}/r`,
  URL: baseUrl,
};

export const META_THEME_COLORS = {
  dark: "#000000",
  light: "#fafafa",
};

export const UTM_PARAMS = {
  utm_source: new URL(baseUrl).hostname,
};
