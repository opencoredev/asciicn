import { createMDX } from "fumadocs-mdx/next";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const { LINK } = await jiti.import("./constants/links");
const { ROUTES } = await jiti.import("./constants/routes");

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  // constants/site.ts reads these in client components too. Next only
  // inlines NEXT_PUBLIC_ variables by default, so pass them through, or the
  // browser falls back to localhost and hydration fails on a real domain.
  env: {
    SITE_URL: process.env.SITE_URL ?? "",
    VERCEL_ENV: process.env.VERCEL_ENV ?? "",
    VERCEL_PROJECT_PRODUCTION_URL:
      process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "",
    VERCEL_URL: process.env.VERCEL_URL ?? "",
  },
  experimental: {
    viewTransition: true,
  },
  headers() {
    const link = [
      `<${ROUTES.API_CATALOG}>; rel="api-catalog"`,
      `<${ROUTES.OPENAPI}>; rel="service-desc"`,
      `<${ROUTES.DOCS}>; rel="service-doc"`,
      `<${LINK.SHADCN_MCP_DOCS}>; rel="service-doc"; title="shadcn MCP server"`,
      `<${ROUTES.AGENT_SKILLS_INDEX}>; rel="describedby"`,
      `<${ROUTES.LLMS}>; rel="describedby"; type="text/plain"`,
      `<${ROUTES.LLMS_MD}/content.md>; rel="alternate"; type="text/markdown"`,
    ].join(", ");

    return [
      { headers: [{ key: "Link", value: link }], source: ROUTES.HOME },
      // Pages answer in HTML or Markdown depending on Accept (see proxy.ts),
      // so caches must key on it. Next appends its own RSC Vary after this.
      {
        headers: [{ key: "Vary", value: "Accept" }],
        source: "/((?!_next/|api/|r/|og|\\.well-known/).*)",
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatars.githubusercontent.com",
        protocol: "https",
      },
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/*": ["./registry/**/*", "./skills/**/*", "./content/docs/**/*.mdx"],
  },
  redirects() {
    return [
      {
        destination: `${ROUTES.DOCS}.md`,
        permanent: true,
        source: `${ROUTES.DOCS}.mdx`,
      },
      {
        destination: `${ROUTES.DOCS}/:path*.md`,
        permanent: true,
        source: `${ROUTES.DOCS}/:path*.mdx`,
      },
      // The nav calls the catalog "Components"; people type that URL.
      {
        destination: ROUTES.DOCS_EXAMPLES,
        permanent: false,
        source: `${ROUTES.DOCS}/components`,
      },
    ];
  },
  // PostHog through a first-party path, so ad blockers that block its domain
  // don't drop events. Its API paths end in slashes, so Next must not
  // redirect them.
  rewrites() {
    return [
      {
        destination: "https://us-assets.i.posthog.com/static/:path*",
        source: "/ingest/static/:path*",
      },
      {
        destination: "https://us.i.posthog.com/:path*",
        source: "/ingest/:path*",
      },
    ];
  },
  skipTrailingSlashRedirect: true,
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
