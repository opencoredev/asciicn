import { requestOrigin } from "@/lib/agent-discovery/request-origin";
import { APP_PAGE_SLUGS, pageMarkdown } from "@/lib/agent-discovery/site-pages";
import { markdownResponse } from "@/lib/api";
import { TRUST_PAGE_SLUGS } from "@/lib/trust-pages";

export const dynamicParams = false;

export const generateStaticParams = () =>
  [...APP_PAGE_SLUGS, ...TRUST_PAGE_SLUGS].map((slug) => ({ slug }));

const respond = async (
  request: Request,
  { params }: RouteContext<"/llms.md/pages/[slug]">,
  includeBody: boolean
) => {
  const { slug } = await params;
  const markdown = pageMarkdown(slug, requestOrigin(request));
  if (markdown === null) {
    return new Response(null, { status: 404 });
  }
  return markdownResponse(markdown, includeBody);
};

export const GET = (
  request: Request,
  context: RouteContext<"/llms.md/pages/[slug]">
) => respond(request, context, true);

export const HEAD = (
  request: Request,
  context: RouteContext<"/llms.md/pages/[slug]">
) => respond(request, context, false);
