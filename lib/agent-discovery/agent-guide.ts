import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

/**
 * What an agent needs before it reads a single docs page: the components are
 * references, and the engine is how you build what the user actually asked
 * for. Leads llms.txt and llms-full.txt, which agents are often handed whole.
 */
export const agentStartHere = (base: string) => `## Start here

asciicn is an ASCII engine, not a component menu. The city skylines, 3D scenes, shader fields, media filters, text effects and terminal pieces in these docs are examples of what the engine draws. When a user asks for an ASCII effect, build the one they asked for:

1. Install the engine and the agent skill: \`npx shadcn@latest add ${SITE.REGISTRY}/asciicn-skill.json\`. Then follow the skill (${base}${ROUTES.AGENT_SKILL}).
2. For anything that moves or varies per cell, write a GLSL \`field\` for \`AsciiShader\` (\`@/lib/ascii/shader\`): [Write your own](${base}${ROUTES.DOCS_WRITE_YOUR_OWN}.md). A field returns a tone from 0 to 1 and the engine picks the glyph. For grids you compute on the CPU (3D meshes, simulations, terminal panes), draw into \`AsciiGrid\` (\`@/lib/ascii\`) and map tones with \`mapTones\`.
3. Pick a charset and a colour mode: [Charsets](${base}/docs/engine/charsets.md) (classic, dense, ANSI blocks, quadrants, Braille 2x4, CP437, PETSCII, katakana, halftone, Sobel edges) and [Colour modes](${base}/docs/engine/color-modes.md) (mono, truecolor, ansi16, duotone, palette). Default colours come from the \`--ascii-*\` tokens, so the effect follows the site theme.
4. Install an example only when it is what the user asked for. Otherwise read the closest one's source for technique and write your own.`;
