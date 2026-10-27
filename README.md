<p align="center">
  <img alt="asciicn: an ASCII art engine and components for React. The asciicn wordmark in green box-drawing glyphs over a field of ASCII characters, with an amber Braille wave and the ten charsets listed above it." src=".github/assets/readme-banner.png" width="100%" />
</p>

```text
 █████╗ ███████╗ ██████╗██╗██╗ ██████╗███╗   ██╗
██╔══██╗██╔════╝██╔════╝██║██║██╔════╝████╗  ██║
███████║███████╗██║     ██║██║██║     ██╔██╗ ██║
██╔══██║╚════██║██║     ██║██║██║     ██║╚██╗██║
██║  ██║███████║╚██████╗██║██║╚██████╗██║ ╚████║
╚═╝  ╚═╝╚══════╝ ╚═════╝╚═╝╚═╝ ╚═════╝╚═╝  ╚═══╝
```

asciicn draws pictures with real glyphs in React. It is a WebGL2 and Canvas2D ASCII engine, about 80 shadcn registry components and ten animated city backgrounds built on it, an ASCII Studio for tuning a look, and an agent skill that teaches Claude Code, Codex, Cursor and other agents to build new effects on the same engine.

Everything installs with the shadcn CLI as plain source you own.

- **Ten charsets:** classic, dense (70 glyphs), ANSI blocks, quadrants (2x2), Braille (2x4 dots), CP437, PETSCII, katakana, halftone and Sobel edge glyphs, plus custom ramps.
- **Five colour modes:** mono (theme ink or a CRT phosphor), truecolor, ANSI 16 (VGA or xterm), duotone ramps and theme palettes.
- **CRT effects:** scanlines, bloom, curvature, glitch, flicker and vignette.
- **Export:** `.txt`, `.ans`, `.svg`, `.png` and `.webm`.
- **Crisp at any zoom:** glyph cells snap to whole device pixels.
- **Handled for you:** theme changes, resizing, pausing offscreen and in hidden tabs, and one still frame under reduced motion.

## Install

From a project that uses shadcn/ui, Tailwind CSS v4 and React 19:

```bash
npx shadcn@latest add https://asciicn.dev/r/asciicn-skill.json
```

This adds the engine in `lib/ascii/`, the skill in `.agents/skills/asciicn/` and `.claude/skills/asciicn/`, and the `--ascii-*` CSS variables. Any component or background installs the same way, by URL or through the `@asciicn` namespace:

```bash
npx shadcn@latest add https://asciicn.dev/r/tokyo.json
npx shadcn@latest add @asciicn/plasma
```

## Usage

Ask your agent for the effect you want, in plain words:

```text
Behind the hero headline, add slow Braille contour lines in our accent colour,
and keep the headline readable.
```

To write one by hand, an effect is a GLSL field that returns a tone from 0 (empty) to 1 (the densest glyph). The engine picks the glyph:

```tsx
"use client";

import { AsciiShader } from "@/lib/ascii/shader";

const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  vec2 p = vec2(uv.x * res.x / res.y, uv.y);
  return fbm(p * 2.5 + vec2(t * 0.03, 0.0)) * smoothstep(0.0, 0.6, uv.y);
}
`;

export const Clouds = () => (
  <AsciiShader
    field={FIELD}
    charset="braille"
    className="absolute inset-0"
    stillTime={4}
  />
);
```

For grids you compute in JavaScript (3D, simulations, charts, terminal panes), draw into `AsciiGrid` from `@/lib/ascii` and turn tones into glyphs with `mapTones`.

## What's in the registry

| Group            | Items                                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine           | `ascii-core` (CPU engine), `ascii-shader` (WebGL2 renderer), `ascii-export`, `ascii-tokens`, `asciicn-skill`                                                                                                     |
| Cities           | miami, tokyo, new-york, paris, london, dubai, san-francisco, hong-kong, rio, sydney                                                                                                                              |
| Backgrounds      | aurora, beams, contours, eclipse, halftone, horizon, mesh gradient, metaballs, noise field, plasma, retro grid, ridgelines, ripples, silk, smoke, starfield, tunnel, waves, nebula, prism, ionize, squall, satin |
| Images and video | ascii-image, ascii-video, image-compare, scroll-reveal-image, ascii-logo, ascii-globe, world-land, ascii-donut, ascii-orb                                                                                        |
| Charts           | cartesian-chart, area-chart, bar-chart, line-chart, sparkline, heatmap, donut-chart, radar-chart, gauge, uptime-bar, dot-map                                                                                     |
| Text             | ascii-text, scramble-text, dissolve-text, ascii-number                                                                                                                                                           |
| Interface        | ascii-button, ascii-card, ascii-box, ascii-fade, ascii-glow, avatar, divider, empty-state, loader, logo-marquee, not-found, progress-bar, skeleton, stat-card                                                    |

The full, current list is at [`/r/registry.json`](https://asciicn.dev/r/registry.json) and in the [catalog](https://asciicn.dev/docs/examples).

## Studio and backgrounds

[asciicn.dev/studio](https://asciicn.dev/studio) lets you pick a background or component, change its charset, colour mode, grade, cell size and CRT effects, and export the frame or the JSX. [asciicn.dev/backgrounds](https://asciicn.dev/backgrounds) shows all ten city backgrounds running.

## For agents

The skill is the main surface: `/.well-known/agent-skills/index.json` lists it with its digest, and `/.well-known/agent-skills/asciicn/SKILL.md` serves it. The site also serves `/llms.txt`, `/llms-full.txt`, Markdown for every page (append `.md` or send `Accept: text/markdown`), an API catalog at `/.well-known/api-catalog` and an OpenAPI description at `/openapi.json`. [AGENTS.md](AGENTS.md) is the guide for agents working in this repo.

## Develop

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000. Other scripts:

- `pnpm build` builds the registry, then the site.
- `pnpm registry:build` renders the skill into `.generated/`, merges `registry/*.json` into `registry.json` (both generated, gitignored), checks imports and dependencies, and writes the items to `public/r/`.
- `pnpm check` runs formatting and lint checks (ultracite). `pnpm fix` fixes what it can.
- `pnpm typecheck` runs TypeScript.
- `pnpm test` compiles every GLSL field.

Set `SITE_URL` to the public origin when deploying. Without it, a Vercel production build uses the project's production URL (or `https://asciicn.dev`), a Vercel preview uses its deployment URL, and local builds use `http://localhost:3000`. Analytics stay off unless `NEXT_PUBLIC_POSTHOG_KEY` is set.

## Project structure

```text
├── app/                  # Next.js app: home, /studio, /backgrounds, docs, OG images, agent routes
├── components/asciicn/   # Shipped components and city backgrounds, one file each
├── components/           # Site components (ui/ holds the shadcn primitives)
├── content/docs/         # Docs (MDX): (root) is Get started, engine/ the engine guides, the rest component groups
├── examples/             # Docs demos and their preview controls (site only)
├── lib/ascii/            # The shipped engine: ascii-core, ascii-shader, ascii-export
├── lib/                  # Docs source, catalog, agent discovery, analytics
├── registry/             # Registry items: one JSON fragment per group
├── skills/asciicn/       # The agent skill (SKILL.md and references), shipped as asciicn-skill
├── scripts/              # build-registry.ts, test-glsl.ts, capture-catalog.ts
└── public/r/             # Built registry items (generated)
```

Docs run on [Fumadocs](https://fumadocs.dev), and icons come from [Hugeicons](https://hugeicons.com).

## License

[MIT](./LICENSE)
