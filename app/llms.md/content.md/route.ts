import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { agentStartHere } from "@/lib/agent-discovery/agent-guide";
import { AGENT_DOCS_DIRECTIVE_MARKDOWN } from "@/lib/agent-discovery/directive";
import { requestOrigin } from "@/lib/agent-discovery/request-origin";
import { markdownResponse } from "@/lib/api";

export const revalidate = false;

const homepageMarkdown = (origin: string): string => {
  const base = origin.replace(/\/$/, "");

  return `# ${SITE.NAME}

${SITE.DESCRIPTION.LONG}

${AGENT_DOCS_DIRECTIVE_MARKDOWN}

${agentStartHere(base)}

## What's on the home page

- A live ASCII hero drawn by the engine, with a charset and palette switcher.
- The three parts of asciicn: the engine (\`lib/ascii\`: a WebGL2 glyph shader and Canvas2D grids), about 80 shadcn registry components, and the agent skill.
- The 12 animated scenes, linked to the [scenes gallery](${base}/scenes.md).
- The [ASCII Studio](${base}/studio.md), for tuning a look and exporting it.
- The quick-start prompt to paste into a coding agent.

## Quick links

- [asciicn agent skill](${base}${ROUTES.AGENT_SKILL}): build any ASCII effect on the engine
- [Introduction](${base}${ROUTES.DOCS}.md)
- [Installation](${base}${ROUTES.DOCS_INSTALLATION}.md)
- [Theming](${base}${ROUTES.DOCS_THEMING}.md)
- [Write your own](${base}${ROUTES.DOCS_WRITE_YOUR_OWN}.md)
- [Catalog of components](${base}${ROUTES.DOCS_EXAMPLES}.md)
- [Scenes gallery](${base}/scenes.md)
- [ASCII Studio](${base}/studio.md)
- [Registry index](${base}${ROUTES.REGISTRY})
- [LLM index (llms.txt)](${base}${ROUTES.LLMS})
- [Full docs (llms-full.txt)](${base}${ROUTES.LLMS_FULL})
- [API catalog](${base}${ROUTES.API_CATALOG})
- [OpenAPI description](${base}${ROUTES.OPENAPI})
- [Agent skills index](${base}${ROUTES.AGENT_SKILLS_INDEX})
`;
};

export const GET = (request: Request) => {
  const body = homepageMarkdown(requestOrigin(request));

  return markdownResponse(body, true);
};

export const HEAD = (request: Request) => {
  const body = homepageMarkdown(requestOrigin(request));

  return markdownResponse(body, false);
};
