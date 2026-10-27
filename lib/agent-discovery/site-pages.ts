import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { AGENT_DOCS_DIRECTIVE_MARKDOWN } from "@/lib/agent-discovery/directive";
import {
  TRUST_PAGES,
  isTrustPageSlug,
  trustPageMarkdown,
} from "@/lib/trust-pages";
import cities from "@/registry/cities.json";

/**
 * The app pages outside /docs that answer `Accept: text/markdown` (and
 * `<path>.md`): the Studio, the backgrounds gallery and the trust pages. The home
 * page has its own route (`homeContentRoute`). Agents can't run a WebGL
 * canvas, so each page says in words what it shows and how to build it.
 */
export const APP_PAGE_SLUGS = ["studio", "backgrounds"] as const;
export type AppPageSlug = (typeof APP_PAGE_SLUGS)[number];

export const isAppPageSlug = (value: string): value is AppPageSlug =>
  APP_PAGE_SLUGS.some((slug) => slug === value);

/** Every slug served by `/llms.md/pages/[slug]`. */
export const isMarkdownPageSlug = (value: string): boolean =>
  isAppPageSlug(value) || isTrustPageSlug(value);

interface CityItem {
  readonly name: string;
  readonly title?: string;
  readonly description?: string;
}

const isCityItem = (value: unknown): value is CityItem =>
  typeof value === "object" &&
  value !== null &&
  "name" in value &&
  typeof value.name === "string";

// Read through `unknown`: city agents edit this fragment while the site runs.
const CITIES: readonly CityItem[] = (cities as readonly unknown[]).filter(
  isCityItem
);

const studioMarkdown = (base: string) => `# ASCII Studio

> Pick a background or component, tune how the asciicn engine draws it, and export the frame or the code. Runs in the browser at ${base}/studio.

${AGENT_DOCS_DIRECTIVE_MARKDOWN}

The Studio is an interactive editor for the asciicn engine. Every control in it maps to a prop you can set in code, so anything you make there can be rebuilt in a project with the components and the engine from the registry.

## Sources

- **GPU fields:** \`nebula\`, \`prism\`, \`ionize\`, \`squall\` and \`satin\`, plus a 3D torus and a 3D globe.
- **The ${CITIES.length} city backgrounds** from the [backgrounds gallery](${base}${ROUTES.BACKGROUNDS}.md).
- **Media:** a sample image, a video URL, your webcam, or text you type, sampled on the CPU into glyphs. Files and camera frames stay in the browser and never enter the URL.

## What you can change

- **Charset.** \`standard\` (classic), \`dense\` (70 glyphs), \`blocks\` (ANSI shades), \`quadrants\` (2x2 sub-cells), \`braille\` (2x4 dots), \`cp437\`, \`petscii\`, \`katakana\`, \`dots\` (halftone) and \`edge\` (Sobel edge glyphs), or a custom ramp.
- **Colour mode.** \`mono\` (the site palette, a phosphor such as \`p1\` green or \`p3\` amber, or a custom colour), \`truecolor\`, \`ansi16\` (\`vga\` or \`xterm\` table), \`duotone\` (ramps such as \`mainframe\`, \`sodium\` and \`glacier\`), and the source's own palette for GPU sources.
- **Grade.** Brightness, contrast, gamma, saturation, invert, threshold, and ordered dithering between glyph levels.
- **Cell size.** Glyph cell height in CSS pixels, from 4 to 28.
- **CRT effects.** Scanlines, bloom, curvature, glitch, flicker and vignette, each from 0 to 1.
- **Motion and input.** Speed, pause, pointer interaction, and audio input from a built-in synth or the microphone.

The setup is kept in the URL, so a link reopens the same look.

## Export

- Copy the setup as TSX, or the shadcn install command for the source.
- Save the current frame as plain text (\`.txt\`), ANSI art (\`.ans\`), SVG or PNG.
- Record a WebM loop of the animation.

The same exports are available in code through \`ascii-export\` (\`toText\`, \`toAnsi\`, \`toSvg\`, \`toPng\`, \`recordCanvas\`): see [Export](${base}/docs/engine/export.md).

## Build it in code

\`\`\`bash
npx shadcn@latest add ${SITE.REGISTRY}/asciicn-skill.json
\`\`\`

That installs the engine and the agent skill. Then follow the skill at ${base}${ROUTES.AGENT_SKILL}, or start with [Write your own](${base}${ROUTES.DOCS_WRITE_YOUR_OWN}.md).
`;

const cityLine = (base: string, city: CityItem) => {
  const title = city.title ?? city.name;
  const summary = city.description ? `: ${city.description}` : "";
  return `- **${title}** (\`${city.name}\`)${summary} Docs: ${base}${ROUTES.DOCS_BACKGROUNDS}/${city.name}.md. Install: \`npx shadcn@latest add ${SITE.REGISTRY}/${city.name}.json\``;
};

const backgroundsMarkdown = (base: string) => `# ASCII backgrounds

> ${CITIES.length} animated city backgrounds drawn with real glyphs by the asciicn engine. Each one is a single React component you install with the shadcn CLI. Gallery: ${base}${ROUTES.BACKGROUNDS}.

${AGENT_DOCS_DIRECTIVE_MARKDOWN}

Every background follows the \`--ascii-*\` theme tokens, holds one still frame under \`prefers-reduced-motion\`, and pauses offscreen and in hidden tabs. Each accepts the engine's look props (\`charset\`, \`colorMode\`, \`phosphor\`, \`ramp\`, \`fx\`, \`cell\`, \`speed\`) and a \`handle\` for export. Put one behind your content with \`absolute inset-0\`.

## Cities

${CITIES.map((city) => cityLine(base, city)).join("\n")}

## Use one

\`\`\`tsx
import { Tokyo } from "@/components/asciicn/tokyo";

export const Hero = () => (
  <section className="relative h-[70vh]">
    <Tokyo className="absolute inset-0" />
    <h1 className="relative">Your headline</h1>
  </section>
);
\`\`\`

Shader fields (nebula, prism, ionize, squall, satin) and 3D scenes are in the [catalog](${base}${ROUTES.DOCS_EXAMPLES}.md). To build one that isn't here, install the agent skill (\`npx shadcn@latest add ${SITE.REGISTRY}/asciicn-skill.json\`) and read [Write your own](${base}${ROUTES.DOCS_WRITE_YOUR_OWN}.md).
`;

/** The Markdown for an app or trust page, or `null` for any other slug. */
export const pageMarkdown = (slug: string, origin: string): string | null => {
  const base = origin.replace(/\/$/, "");
  if (slug === "studio") {
    return studioMarkdown(base);
  }
  if (slug === "backgrounds") {
    return backgroundsMarkdown(base);
  }
  return isTrustPageSlug(slug)
    ? trustPageMarkdown(TRUST_PAGES[slug], base)
    : null;
};
