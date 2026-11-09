import { LINK } from "@/constants/links";
import { SITE } from "@/constants/site";

// The About, Contact and Privacy pages. One source renders both the HTML page
// and the Markdown an agent gets with `Accept: text/markdown`, so the two never
// drift. Paragraphs use Markdown links; the HTML page renders them as anchors.

export const CONTACT_EMAIL = "leo@asciicn.dev";

export const TRUST_PAGE_SLUGS = ["about", "contact", "privacy"] as const;
export type TrustPageSlug = (typeof TRUST_PAGE_SLUGS)[number];

export interface TrustSection {
  heading: string;
  paragraphs: readonly string[];
}

export interface TrustPage {
  slug: TrustPageSlug;
  title: string;
  description: string;
  lead: string;
  sections: readonly TrustSection[];
  updated: string;
}

const ISSUES = `${LINK.GITHUB_REPO}/issues`;

export const TRUST_PAGES: Record<TrustPageSlug, TrustPage> = {
  about: {
    description:
      "Who makes asciicn, why it exists, and how the ASCII engine, components and agent skill are built and licensed.",
    lead: `${SITE.NAME} is an open-source ASCII art engine for React and shadcn/ui, with components, animated scenes and an agent skill that teaches your coding agent to use it. Leo builds and maintains it, and it's published by OpenCore, the GitHub organization behind Social SDK, Email SDK and other open-source TypeScript tools.`,
    sections: [
      {
        heading: "What asciicn is",
        paragraphs: [
          "An engine and what it draws. `ascii-core` installs into `lib/ascii` as plain source: charsets, palettes, cell metrics, a Canvas2D glyph grid and the tone-to-glyph mapping. `ascii-shader` adds a WebGL2 renderer that turns a GLSL field into real glyphs from a glyph atlas, with colour modes, pointer interaction and CRT effects. `ascii-export` writes any frame as text, ANSI, SVG or PNG, and records WebM.",
          "On top of the engine sit about 80 shadcn registry components (backgrounds, charts, interface pieces, text effects, image and video converters), 12 animated scenes, and the [ASCII Studio](/studio) for tuning a look and exporting it. The agent skill is a SKILL.md with references that teaches Claude Code, Codex, Cursor and other agents how to build new effects on the same engine.",
          "Nothing runs on our servers once it's installed. Every file lands in your repo, so you can read it, change it and ship it like the rest of your code.",
        ],
      },
      {
        heading: "Why it exists",
        paragraphs: [
          "ASCII art draws an image with characters: a dense glyph where the picture is dark, a sparse one where it is light. Terminals, BBS screens and home computers made it a craft, with its own character sets such as CP437 and PETSCII. Most ASCII effects on the web today are one-off canvases that blur on high-density screens, ignore reduced motion and can't be themed.",
          "asciicn puts one engine under every effect, so a scene, a chart and a loading state share the same glyph cells, colours and motion rules, and every glyph snaps to whole device pixels. Because the skill teaches the engine rather than a fixed list of components, your agent can build an effect nobody has made yet instead of copying the closest example.",
        ],
      },
      {
        heading: "License",
        paragraphs: [
          `asciicn is free and MIT licensed. The source lives at [github.com/opencoredev/asciicn](${LINK.GITHUB_REPO}).`,
        ],
      },
    ],
    slug: "about",
    title: "About asciicn",
    updated: "2026-10-27",
  },
  contact: {
    description:
      "How to reach the asciicn maintainer about bugs, feature requests, security reports and anything else.",
    lead: "asciicn is maintained by one person, Leo. Where to write depends on what you need, and public questions help the next person too, so start on GitHub when you can.",
    sections: [
      {
        heading: "Bugs and feature requests",
        paragraphs: [
          `Open an issue at [github.com/opencoredev/asciicn/issues](${ISSUES}). For a bug, name the component or engine function, your browser and framework versions, and what you expected to see. A screenshot or a short recording helps most with visual problems, since glyphs that render wrong are easier to show than to describe. The Studio's text export of the frame helps too.`,
          "For a new example or engine feature, describe the page you're building and the effect you want. Requests tied to a real use get built first.",
        ],
      },
      {
        heading: "Email",
        paragraphs: [
          `For anything that shouldn't be public, such as partnerships, press or a private question about your project, email [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}). There's no support contract or guaranteed reply time, but every message is read.`,
        ],
      },
      {
        heading: "Security reports",
        paragraphs: [
          `If you find a security problem in the engine, the registry files or this site, email [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) instead of opening a public issue. Include the steps to reproduce it, and you'll get a reply before anything is published.`,
        ],
      },
      {
        heading: "Elsewhere",
        paragraphs: [
          `Leo is [@leoisadev1](${SITE.AUTHOR.URL}) on GitHub. Agents can read this page as Markdown, and the [llms.txt](/llms.txt) index lists every docs page.`,
        ],
      },
    ],
    slug: "contact",
    title: "Contact",
    updated: "2026-10-27",
  },
  privacy: {
    description:
      "What asciicn.dev collects, what it stores in your browser, and who hosts it. No accounts and no ads.",
    lead: "asciicn.dev is a documentation site. It has no accounts, no ads and no newsletter. It measures how the docs are used so we can tell which pages and components help, and nothing it collects is sold or used for advertising.",
    sections: [
      {
        heading: "Analytics",
        paragraphs: [
          "The site uses [Capless](https://analytics.capless.sh/docs/security), [PostHog](https://posthog.com/privacy) and Vercel Web Analytics. They record page views, clicks, page-load performance and a few named actions, such as copying an install command or the agent prompt, searching the docs, changing a preview's controls or switching the theme. Each runs only when the deployment is configured with a project for it. Capless keeps a random ID in local storage and PostHog keeps one in a cookie and local storage, so repeat visits count as one visitor. Both estimate your country and city from your IP address; Capless stores only a keyed hash of it. Vercel Web Analytics counts page views without cookies.",
          "Capless also records sessions: how the page changed and where you scrolled and clicked, so we can see where the docs or the Studio confuse people. Anything you type into a field is masked before it leaves your browser, and password fields are never recorded. PostHog events go through asciicn.dev itself on their way to PostHog's US servers. We don't sell or share this data or use it for advertising. Blocking analytics scripts in your browser stops all of it, and the site works the same.",
        ],
      },
      {
        heading: "What's stored in your browser",
        paragraphs: [
          "Local storage remembers your theme and palette, your preferred package manager for install commands, and a few docs and Studio display settings. A cookie named `sidebar_state` remembers whether the docs sidebar is open. These stay in your browser, aren't used for tracking and aren't shared with anyone. Clearing your site data removes them.",
        ],
      },
      {
        heading: "Images, video and your camera",
        paragraphs: [
          "When you open an image or video file, or allow camera access, in the Studio or a component demo, the frames are converted to glyphs in your browser. Nothing is uploaded: the site has no upload endpoint, and the camera stops when you leave the page or turn it off.",
        ],
      },
      {
        heading: "Hosting and server logs",
        paragraphs: [
          "Vercel hosts the site. Like any web host, it processes your IP address and request details to serve pages and protect the site from abuse, under the [Vercel privacy policy](https://vercel.com/legal/privacy-policy). The GitHub star count in the header is fetched by our server, so your browser doesn't contact GitHub until you follow the link.",
          "When the shadcn CLI, the skills CLI or a coding agent downloads a registry item, the agent skill or llms.txt, the site records which file was fetched, the tool's user agent and the referring page, so we can count installs. That record has no IP address and no ID that links it to you or your other requests, and nothing about your project is sent.",
        ],
      },
      {
        heading: "Questions",
        paragraphs: [
          `Email [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}) with any privacy question or request. If this policy changes, the date below changes with it.`,
        ],
      },
    ],
    slug: "privacy",
    title: "Privacy",
    updated: "2026-11-09",
  },
};

export const isTrustPageSlug = (value: string): value is TrustPageSlug =>
  TRUST_PAGE_SLUGS.some((slug) => slug === value);

export const trustPageMarkdown = (page: TrustPage, origin: string): string => {
  const base = origin.replace(/\/$/, "");
  const absolute = (markdown: string) =>
    markdown.replaceAll(/\]\((\/[^)]*)\)/g, `](${base}$1)`);
  const sections = page.sections
    .map(
      (section) =>
        `## ${section.heading}\n\n${section.paragraphs.map(absolute).join("\n\n")}`
    )
    .join("\n\n");

  return `# ${page.title}

> ${page.description}

${absolute(page.lead)}

${sections}

Last updated ${page.updated}. Canonical page: ${base}/${page.slug}
`;
};
