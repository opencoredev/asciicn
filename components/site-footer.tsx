import Link from "next/link";

import { GithubLink } from "@/components/github-link";
import { LogoMark } from "@/components/logo";
import { StatusBar, StatusItem } from "@/components/terminal/status-bar";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { getCatalog } from "@/lib/catalog";
import { otherOpenCoreSites } from "@/lib/opencore-sites";

interface FooterLink {
  href: string;
  label: string;
}

const START: readonly FooterLink[] = [
  { href: ROUTES.DOCS, label: "Introduction" },
  { href: ROUTES.DOCS_INSTALLATION, label: "Installation" },
  { href: ROUTES.DOCS_THEMING, label: "Theming" },
  { href: ROUTES.DOCS_ENGINE, label: "The engine" },
  { href: ROUTES.STUDIO, label: "Studio" },
];

const FOR_AGENTS: readonly FooterLink[] = [
  { href: ROUTES.AGENT_SKILL, label: "SKILL.md" },
  { href: ROUTES.LLMS, label: "llms.txt" },
  { href: ROUTES.LLMS_FULL, label: "llms-full.txt" },
  { href: ROUTES.REGISTRY, label: "Registry index" },
];

const SITE_LINKS: readonly FooterLink[] = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/privacy", label: "Privacy" },
];

const LINK_CLASS =
  "text-muted-foreground hover:text-foreground rounded-xs text-[13px] transition-colors duration-150";

// Plain followed links on purpose: they share authority between our sites.
const OPENCORE_SITES = otherOpenCoreSites("https://asciicn.dev");

/*
 * The closing wordmark is real text: "asciicn" set in a 4x6 pixel face and
 * packed two pixel rows per line into half blocks (▀ ▄ █). Each letter is
 * six rows, top to bottom; the first row only carries the dots of the i's.
 */
const PIXEL_FACE: Record<string, readonly string[]> = {
  a: ["....", "###.", "...#", "####", "#..#", "####"],
  c: ["....", "####", "#...", "#...", "#...", "####"],
  i: ["#", ".", "#", "#", "#", "#"],
  n: ["....", "###.", "#..#", "#..#", "#..#", "#..#"],
  s: ["....", "####", "#...", "####", "...#", "####"],
};

// Top pixel then bottom pixel, to the glyph that draws both.
const HALF_BLOCK = new Map([
  ["..", " "],
  [".#", "▄"],
  ["#.", "▀"],
  ["##", "█"],
]);

const toHalfBlocks = (word: string): string => {
  const rows = Array.from({ length: 6 }, (_, row) =>
    [...word].map((letter) => PIXEL_FACE[letter]?.[row] ?? "").join(".")
  );
  const lines: string[] = [];
  for (let line = 0; line < rows.length; line += 2) {
    const top = rows[line] ?? "";
    const bottom = rows[line + 1] ?? "";
    lines.push(
      [...top]
        .map((pixel, x) => HALF_BLOCK.get(`${pixel}${bottom[x] ?? "."}`) ?? " ")
        .join("")
    );
  }
  return lines.join("\n");
};

const WORDMARK = toHalfBlocks("asciicn");

const LinkColumn = ({
  title,
  links,
}: {
  title: string;
  links: readonly FooterLink[];
}) => (
  <nav aria-label={title} className="flex flex-col gap-3">
    <h2 className="label-caps text-foreground">{title}</h2>
    <ul className="flex flex-col gap-1.5">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className={LINK_CLASS}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
);

export const SiteFooter = () => {
  const examples = getCatalog().map((category) => ({
    href: `${ROUTES.DOCS_EXAMPLES}#catalog-${category.id}`,
    label: category.name,
  }));

  return (
    <footer
      className="overflow-hidden border-t"
      style={{ viewTransitionName: "site-footer" }}
    >
      <div className="container-wrapper">
        <div className="container grid grid-cols-2 gap-x-6 gap-y-10 pt-12 pb-10 md:pt-16 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="col-span-2 flex max-w-xs flex-col gap-3 lg:col-span-1">
            <p className="font-display flex items-center gap-2 text-sm font-medium [font-stretch:87.5%]">
              <LogoMark className="text-foreground h-4" />
              {SITE.NAME}
            </p>
            <p className="text-muted-foreground font-sans text-sm text-pretty">
              An ASCII engine and copy-paste components for shadcn projects. MIT
              licensed.
            </p>
            <GithubLink
              label="GitHub"
              location="footer"
              className="w-fit gap-2 rounded-xs text-[13px]"
            />
          </div>
          <LinkColumn title="Start" links={START} />
          <LinkColumn title="Components" links={examples} />
          <LinkColumn title="For agents" links={FOR_AGENTS} />
          <LinkColumn title="asciicn" links={SITE_LINKS} />
          <nav
            aria-labelledby="footer-opencore"
            className="col-span-2 flex flex-col gap-3 border-t pt-8 lg:col-span-5"
          >
            <h2 id="footer-opencore" className="label-caps text-foreground">
              More from OpenCore
            </h2>
            <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
              {OPENCORE_SITES.map((site) => (
                <li key={site.url}>
                  <a href={site.url} className={LINK_CLASS}>
                    <span className="text-foreground">{site.name}</span>{" "}
                    {site.description}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="container pb-8">
          {/* 28 columns wide: the font size makes the art span the column. */}
          <pre
            aria-hidden="true"
            className="text-ink overflow-hidden font-mono text-[clamp(1rem,5.6vw,5.25rem)] leading-[1.2] tracking-normal select-none [font-variant-ligatures:none]"
          >
            {WORDMARK}
          </pre>
        </div>
      </div>
      <StatusBar
        size="md"
        className="px-4 lg:px-8"
        left={
          <>
            <span className="bg-ink text-primary-foreground px-1.5 py-0.5 font-medium">
              asciicn.dev
            </span>
            <StatusItem value="MIT" tone="muted" />
            <StatusItem value="utf-8" tone="muted" className="max-sm:hidden" />
          </>
        }
        right={
          <>
            <StatusItem
              value={
                <Link href={ROUTES.LLMS} className="hover:text-foreground">
                  llms.txt
                </Link>
              }
              tone="muted"
            />
            <StatusItem
              value={
                <Link href={ROUTES.REGISTRY} className="hover:text-foreground">
                  registry
                </Link>
              }
              tone="muted"
            />
          </>
        }
      />
    </footer>
  );
};
