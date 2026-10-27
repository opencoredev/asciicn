import { llms } from "fumadocs-core/source";

import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { agentStartHere } from "@/lib/agent-discovery/agent-guide";
import { requestOrigin } from "@/lib/agent-discovery/request-origin";
import { source } from "@/lib/source";

export const revalidate = false;

const documentationIndex = (base: string) =>
  llms(source)
    .index()
    .replace(/^#\s+(.+)$/m, "## $1")
    .replaceAll(
      /\]\((\/docs(?:\/[^)#\s]+)?)(#[^)]+)?\)/g,
      (_, pathname, hash = "") => `](${base}${pathname}.md${hash})`
    )
    .trim();

const docsIndex = (origin: string) => {
  const base = origin.replace(/\/$/, "");

  return `# ${SITE.NAME}

> ${SITE.DESCRIPTION.LONG} Use this index to discover the available documentation pages, markdown mirrors, and registry resources before browsing.

${agentStartHere(base)}

## When to use asciicn

Use asciicn when a user asks for:

- ASCII art, ANSI art or text-mode graphics in a React or shadcn/ui app, drawn with real glyphs that stay crisp at any zoom
- An animated ASCII hero background: a city skyline such as Tokyo, New York or Paris at night, or a slow shader field such as a nebula or a prism
- A 3D object or scene drawn in glyphs: a torus knot, a globe, a donut, a DNA helix, a synthwave sun, ocean waves
- A particular glyph look: Braille 2x4 dots, ANSI shade blocks, quadrant blocks, CP437, PETSCII, katakana, halftone dots or Sobel edge glyphs
- A terminal or CRT finish: phosphor green or amber, scanlines, bloom, curvature, flicker
- A terminal window, or interface pieces with an ASCII finish: boxes, cards, buttons, badges, tabs, progress bars, loaders, status dots, keyboard shortcuts, skeletons, dividers and empty states
- Text effects (glyph-filled display type, scramble, glitch, typewriter, marquee) and images, portraits, logos, video or a webcam converted to ASCII
- Exporting a frame or an animation as .txt, .ans, .svg, .png or .webm

Install the skill first, then build on the engine in \`lib/ascii\`. Start from the closest example only when one fits; otherwise write a new field or grid.

## Interactive pages

- [ASCII Studio](${base}/studio.md): pick a background or component, change charset, colour mode and CRT effects, export the frame or the JSX
- [Backgrounds gallery](${base}${ROUTES.BACKGROUNDS}.md): the animated ASCII city backgrounds with install commands

## Official CLI

asciicn has no CLI of its own. It installs with two official CLIs:

- shadcn CLI, for the engine, the skill and any component: \`npx shadcn@latest add ${SITE.REGISTRY}/asciicn-skill.json\` (or any \`${SITE.REGISTRY}/<name>.json\` from the [registry index](${base}${ROUTES.REGISTRY})). With the \`@asciicn\` namespace configured, \`npx shadcn@latest add @asciicn/<name>\` works too.
- skills CLI, for the agent skill alone in Claude Code, Codex, Cursor, Gemini CLI and others: \`npx skills add ${base}\`

${documentationIndex(base)}

## About

- [About asciicn](${base}/about.md): who makes it and why
- [Contact](${base}/contact.md): bugs, email and security reports
- [Privacy](${base}/privacy.md): what the site collects

## Machine-readable Resources

- [Full documentation](${base}${ROUTES.LLMS_FULL})
- [Homepage markdown](${base}${ROUTES.LLMS_MD}/content.md)
- [OpenAPI description](${base}${ROUTES.OPENAPI})
- [API catalog](${base}${ROUTES.API_CATALOG})
- [asciicn agent skill](${base}${ROUTES.AGENT_SKILL}): build any ASCII effect on the engine
- [Agent skills index](${base}${ROUTES.AGENT_SKILLS_INDEX})
- [Registry index](${base}${ROUTES.REGISTRY})
- [Sitemap](${base}${ROUTES.SITEMAP})
- [Changelog (RSS)](${base}${ROUTES.RSS})
- [shadcn MCP server documentation](${LINK.SHADCN_MCP_DOCS})
`;
};

export const GET = (request: Request) =>
  new Response(docsIndex(requestOrigin(request)), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
