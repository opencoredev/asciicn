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

- A hero over animated ASCII city and landscape backgrounds painted in halftone dots, with links to the docs and a quick-start prompt to paste into a coding agent.
- A wall of live examples from the [catalog](${base}${ROUTES.DOCS_EXAMPLES}.md): 3D scenes, terminal and UI pieces, text effects, media filters and shader fields.
- Requests you might give your agent, each shown over the ASCII effect it asks for.
- What's inside: the engine (\`lib/ascii\`: a WebGL2 glyph shader and Canvas2D grids), the agent skill, and every example group.
- The one command that installs the skill, and the files it adds.
- A row of painted backgrounds (cities and landscapes) that play on hover; all of them are in the [backgrounds gallery](${base}${ROUTES.BACKGROUNDS}.md).

## Quick links

- [asciicn agent skill](${base}${ROUTES.AGENT_SKILL}): build any ASCII effect on the engine
- [Introduction](${base}${ROUTES.DOCS}.md)
- [Installation](${base}${ROUTES.DOCS_INSTALLATION}.md)
- [Theming](${base}${ROUTES.DOCS_THEMING}.md)
- [Write your own](${base}${ROUTES.DOCS_WRITE_YOUR_OWN}.md)
- [Catalog of components](${base}${ROUTES.DOCS_EXAMPLES}.md)
- [Backgrounds gallery](${base}${ROUTES.BACKGROUNDS}.md)
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
