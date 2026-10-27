import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { CopyAgentPrompt, OriginPrompt } from "@/components/home/agent-actions";
import { ComponentIndex } from "@/components/home/component-index";
import { CTA_PRIMARY, CTA_SECONDARY, TEXT_LINK } from "@/components/home/cta";
import { EngineSheet } from "@/components/home/engine-sheet";
import { SceneSwitcher } from "@/components/home/scene-switcher";
import { SectionHead } from "@/components/home/section-head";
import { HeroInstall, StudioHero } from "@/components/home/studio-hero";
import { Icon } from "@/components/icon";
import { SiteFooter } from "@/components/site-footer";
import { ROUTES } from "@/constants/routes";
import { CHARSET_NAMES, COLOR_MODES } from "@/lib/ascii";
import { countPieces, getCatalog } from "@/lib/catalog";
import { SCENES } from "@/lib/scenes";
import { BreadcrumbJsonLd } from "@/seo/json-ld";

export const dynamic = "force-static";
export const revalidate = false;

const STUDIO = "/studio";
const SCENES_ROUTE = "/scenes";

/** What an agent can read here, each a real route on this site. */
const AGENT_ROUTES = [
  [
    ROUTES.AGENT_SKILL,
    "The skill: engine, charsets, GLSL contract, components.",
  ],
  [ROUTES.LLMS, "Every docs page, listed for a model to read."],
  [ROUTES.LLMS_FULL, "All of the docs in one Markdown file."],
  [ROUTES.REGISTRY, "The shadcn registry, every item and its files."],
  [ROUTES.OPENAPI, "OpenAPI for the docs and registry endpoints."],
] as const;

const Arrow = () => <Icon icon={ArrowRight01Icon} className="size-3.5" />;

export default function IndexPage() {
  const catalog = getCatalog();
  const pieceCount = countPieces(catalog);

  return (
    <>
      <BreadcrumbJsonLd items={[{ name: "Home", path: ROUTES.HOME }]} />

      <section
        aria-labelledby="hero-heading"
        className="container-wrapper pt-3 pb-12 md:pb-16"
      >
        <StudioHero
          headline={
            <div className="lg:bg-background/95 lg:border-rule pointer-events-auto flex max-w-[32rem] flex-col gap-4 pt-4 lg:border lg:p-6 lg:pt-5 lg:backdrop-blur-sm">
              <p className="label-caps text-muted-foreground">
                asciicn · ASCII engine for React
              </p>
              <h1
                id="hero-heading"
                className="font-display text-[1.9rem] leading-[1.06] tracking-[-0.035em] text-balance sm:text-[2.25rem]"
              >
                Real glyphs, drawn live in your app.
              </h1>
              <p className="text-muted-foreground text-[14px] text-pretty sm:text-[15px]">
                A WebGL2 and Canvas engine with {CHARSET_NAMES.length} charsets
                and {COLOR_MODES.length} colour modes, {SCENES.length} scenes
                and {pieceCount} shadcn components. Install one, or open the
                Studio and export what you see.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href={STUDIO} className={CTA_PRIMARY}>
                  Open the Studio
                  <Arrow />
                </Link>
                <Link
                  href={ROUTES.DOCS}
                  transitionTypes={["nav-forward"]}
                  className={CTA_SECONDARY}
                >
                  Browse components
                </Link>
              </div>
              <HeroInstall />
            </div>
          }
        />
      </section>

      <section
        aria-labelledby="scenes-heading"
        className="container-wrapper py-12 md:py-20"
      >
        <div className="container flex flex-col gap-8">
          <SectionHead
            index="01"
            path="components/asciicn/scenes/"
            id="scenes-heading"
            title={`${SCENES.length} scenes, ready to install.`}
            lead="Procedural worlds drawn in glyphs. Each one is a single component that reacts to the pointer and takes every charset and colour mode."
            aside={
              <Link href={SCENES_ROUTE} className={TEXT_LINK}>
                All scenes, with effects and export
                <Arrow />
              </Link>
            }
          />
          <SceneSwitcher />
        </div>
      </section>

      <section
        aria-labelledby="engine-heading"
        className="container-wrapper py-12 md:py-20"
      >
        <div className="container flex flex-col gap-8">
          <SectionHead
            index="02"
            path="lib/ascii/"
            id="engine-heading"
            title="One field, every way to draw it."
            lead="Every component writes tones; the engine picks the glyphs and colours. Here is one sphere, mapped through each charset and colour mode on the CPU."
            aside={
              <Link
                href={ROUTES.DOCS_ENGINE}
                transitionTypes={["nav-forward"]}
                className={TEXT_LINK}
              >
                How the engine works
                <Arrow />
              </Link>
            }
          />
          <EngineSheet />
        </div>
      </section>

      <section
        aria-labelledby="components-heading"
        className="container-wrapper py-12 md:py-20"
      >
        <div className="container flex flex-col gap-8">
          <SectionHead
            index="03"
            path="components/asciicn/"
            id="components-heading"
            title={`${pieceCount} components, in ${catalog.filter((category) => category.pieces.length > 0).length} groups.`}
            lead="Backgrounds, images, charts, text and interface pieces. Each one is a file you own, installed with the shadcn CLI."
            aside={
              <Link
                href={ROUTES.DOCS_EXAMPLES}
                transitionTypes={["nav-forward"]}
                className={TEXT_LINK}
              >
                Browse the catalog
                <Arrow />
              </Link>
            }
          />
          <ComponentIndex catalog={catalog} />
        </div>
      </section>

      <section
        aria-labelledby="agents-heading"
        className="container-wrapper py-12 md:py-20"
      >
        <div className="container flex flex-col gap-8">
          <SectionHead
            index="04"
            path=".agents/skills/asciicn/"
            id="agents-heading"
            title="Your agent can build the next one."
            lead="The skill teaches a coding agent the engine: charsets, the GLSL field contract and every component. Describe a scene in one sentence and it writes it on the engine, in your theme."
          />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
            <div className="flex flex-col gap-4">
              <OriginPrompt
                before="npx skills add"
                path=""
                section="home_skill"
              />
              <OriginPrompt
                before="npx shadcn@latest add"
                path="/r/asciicn-skill.json"
                section="home_skill_shadcn"
              />
              <p className="text-muted-foreground text-[13px] text-pretty">
                The first adds the skill for Claude Code, Codex, Cursor and
                other agents. The second also installs the engine. Or copy a
                prompt that does both and builds a first effect.
              </p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <CopyAgentPrompt />
                <Link
                  href={ROUTES.DOCS_INSTALLATION}
                  transitionTypes={["nav-forward"]}
                  className={TEXT_LINK}
                >
                  Installation
                  <Arrow />
                </Link>
              </div>
            </div>
            <div className="border-rule border">
              <p className="label-caps text-muted-foreground border-rule border-b px-4 py-2">
                For agents
              </p>
              <ul className="divide-rule divide-y font-mono text-[12.5px]">
                {AGENT_ROUTES.map(([path, what]) => (
                  <li key={path} className="flex flex-col gap-0.5 px-4 py-2.5">
                    <a
                      href={path}
                      className="text-foreground hover:text-ink focus-visible:outline-ring w-fit break-all transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <span className="text-faint">GET </span>
                      {path}
                    </a>
                    <span className="text-muted-foreground font-sans text-[13px]">
                      {what}
                    </span>
                  </li>
                ))}
                <li className="flex flex-col gap-0.5 px-4 py-2.5">
                  <span className="text-foreground">WebMCP</span>
                  <span className="text-muted-foreground font-sans text-[13px]">
                    Every page registers tools to open docs, read the registry
                    and fetch the index.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="start-heading"
        className="container-wrapper pt-8 pb-20 md:pb-28"
      >
        <div className="container">
          <div className="border-rule flex flex-col gap-6 border p-6 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-xl flex-col gap-3">
              <h2
                id="start-heading"
                className="font-display text-[1.75rem] leading-[1.1] tracking-[-0.03em] sm:text-[2.25rem]"
              >
                Start with the engine.
              </h2>
              <p className="text-muted-foreground text-[15px] text-pretty">
                One command adds lib/ascii and the --ascii-* tokens. Every
                component installs on top of it.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 lg:max-w-lg">
              <OriginPrompt
                before="npx shadcn@latest add"
                path="/r/ascii-core.json"
                section="home_footer"
              />
              <div className="flex flex-wrap gap-2">
                <Link href={STUDIO} className={CTA_PRIMARY}>
                  Open the Studio
                  <Arrow />
                </Link>
                <Link
                  href={ROUTES.DOCS_INSTALLATION}
                  transitionTypes={["nav-forward"]}
                  className={CTA_SECONDARY}
                >
                  Installation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
