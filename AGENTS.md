# AGENTS.md

Guide for coding agents working in this repository. It covers the site at asciicn.dev, the shadcn registry it publishes, and the ASCII engine those components ship with. To build ASCII effects in another project, use the agent skill instead: `skills/asciicn/SKILL.md`, or `https://asciicn.dev/.well-known/agent-skills/asciicn/SKILL.md`.

## What lives where

| Path                                                                                                 | What it is                                                                                                                                             | Shipped to users?       |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `lib/ascii/`                                                                                         | The engine. `index.ts` is `ascii-core` (CPU); `shader.tsx`, `glsl.ts`, `gpu.ts`, `atlas.ts` are `ascii-shader` (WebGL2); `export.ts` is `ascii-export` | Yes                     |
| `components/asciicn/`                                                                                | Registry components and the ten city backgrounds, one file each                                                                                        | Yes                     |
| `registry/*.json`                                                                                    | Registry fragments, one per group. `{{REGISTRY_URL}}` is filled in at build time                                                                       | Yes (built)             |
| `skills/asciicn/`                                                                                    | The agent skill. `references/examples.md` is generated from the fragments                                                                              | Yes, as `asciicn-skill` |
| `content/docs/`                                                                                      | Docs pages (MDX, Fumadocs). Folder `meta.json` files set sidebar order                                                                                 | No                      |
| `examples/`                                                                                          | Docs demos (`<name>-demo.tsx`), preview knobs (`<name>-controls.ts`) and variants                                                                      | No                      |
| `app/`                                                                                               | Next.js App Router: home, `/studio`, `/backgrounds`, `/docs`, OG images, agent routes                                                                  | No                      |
| `app/llms.txt`, `app/llms-full.txt`, `app/llms.md`, `app/.well-known`, `app/openapi.json`, `app/api` | Agent discovery surfaces                                                                                                                               | No                      |
| `lib/agent-discovery/`                                                                               | Markdown for agents, the skill renderer and archive, OpenAPI, RFC 9457 problems                                                                        | No                      |
| `proxy.ts`                                                                                           | Markdown negotiation (`Accept: text/markdown` and `.md`), API version check, server analytics                                                          | No                      |
| `constants/`                                                                                         | Site name, URLs, routes. Site-only                                                                                                                     | No                      |

## Commands

```bash
pnpm install
pnpm dev                      # http://localhost:3000
pnpm typecheck                # tsc --noEmit
pnpm check                    # ultracite: oxlint + oxfmt
pnpm exec ultracite fix <files>  # format and lint only the files you changed
pnpm test                     # compiles every GLSL field (scripts/test-glsl.ts)
pnpm registry:build           # renders the skill, validates fragments, writes public/r/
pnpm build                    # registry, then the site
```

Run `ultracite fix` on the files you touched, not the whole repo, when other work is in progress in the same checkout. The pre-commit hook (lefthook) formats staged files.

## Conventions

- TypeScript strict, no `any`, no non-null `!`. Arrow functions. Props are an `interface` with a JSDoc line per prop that states the default. Constant tables use `as const satisfies`.
- Comments say why, in plain words. Match the comment density of the file you are in.
- Icons come from Hugeicons through `@/components/icon` on the site. Never add `lucide-react`.
- Don't add dependencies without asking; the lockfile is shared.
- Colours come from the `--ascii-*` tokens (`--ascii-ink`, `--ascii-paper`, `--ascii-cell`, `--ascii-font`, `--ascii-glow`, `--ascii-color-<name>`). Components never hard-code site colours.
- Docs prose is plain and specific: short sentences that say what a prop does. No em dashes, no "seamless", "powerful" or "effortless".

## Engine rules

- Every visual draws real glyphs: canvas text, the GPU glyph atlas, or DOM text. Never pixel dots.
- Cells snap to whole device pixels (`measureCell`). Don't scale a renderer with CSS transforms.
- `AsciiShader` and `AsciiGrid` share the look props in `lib/ascii/look.ts`. A new look option goes in `AsciiLook` and in both renderers, and `mapTones` (`frame.ts`) stays the reference for tone-to-glyph mapping.
- GLSL fields follow the `res` contract: `res.x / res.y` is the box's true aspect, `1.0 / res.y` is one sample row, and Braille and quadrants sample 2x4 and 2x2 per cell. `pnpm test` compiles every field.
- Renderers pause offscreen and in hidden tabs, draw one still frame under `prefers-reduced-motion`, and set `aria-hidden` by default.

## Adding a component

1. `components/asciicn/<name>.tsx`: one exported component and its `Props` interface. Import only from `@/lib/ascii`, `@/lib/ascii/shader`, `@/lib/utils`, `react`, other `@/components/asciicn/*` items and existing npm packages.
2. A registry entry in the right `registry/<group>.json`: `name`, `type: "registry:component"`, `title`, `description` (one sentence, same as the docs page), `registryDependencies` (`{{REGISTRY_URL}}/ascii-core.json`, plus `ascii-shader.json` if it imports `@/lib/ascii/shader`, plus every `@/components/asciicn/*` it imports), and `files`.
3. `content/docs/<group>/<name>.mdx`: frontmatter `title` and `description`, a `<ComponentPreview>` first, then `## Installation` (`<InstallBlock name="<name>" />`), `## Usage`, `## Examples`, `## Props` (`<PropsTable>`), `## Notes`.
4. `examples/<name>-demo.tsx`, `examples/<name>-controls.ts` and two or three variants. Every demo shows the effect on its first frame and has a charset knob where charsets apply.

## Registry rules

`scripts/build-registry.ts` fails the build when:

- A shipped file imports a site-only module: `@/constants`, `@/components/icon`, `@/hooks/`, `@/examples/` or `@hugeicons/`.
- A file imports `@/components/asciicn/<x>`, `@/lib/ascii` or `@/lib/ascii/shader` without the matching `registryDependencies` entry.
- `asciicn-skill` in `registry/engine.json` doesn't ship every skill file to both `.agents/skills/asciicn/` and `.claude/skills/asciicn/`. Adding a file under `skills/asciicn/references/` means adding two entries there.

Never hard-code a host in a fragment; use `{{REGISTRY_URL}}`.

## Agent surfaces

Every page has a Markdown twin: docs pages through `lib/source.ts` (`getLLMText`), the home page at `/llms.md/content.md`, and `/studio`, `/backgrounds`, `/about`, `/contact` and `/privacy` through `lib/agent-discovery/site-pages.ts`. When you add an MDX component that carries content (code, a command, a prompt), teach `lib/agent-discovery/docs-markdown.ts` to turn it into Markdown. When you add a top-level page, add its Markdown to `site-pages.ts` and its URL to `app/sitemap.ts`.

## Verifying a change

A build or a typecheck is not enough. Open the page in a real browser, at 1440x900 and 390x844, in light and dark mode, and once with reduced motion. Zoom into the screenshot and confirm you see crisp glyphs. Check the console for WebGL and hydration errors. For agent surfaces, `curl` the route, and `curl -H 'Accept: text/markdown'` the page.
