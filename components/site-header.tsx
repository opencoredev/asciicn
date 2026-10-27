import { BrandContextMenu } from "@/components/brand-context-menu";
import { CommandMenu } from "@/components/command-menu";
import { GithubLink } from "@/components/github-link";
import { MainNav } from "@/components/main-nav";
import { MobileNav } from "@/components/mobile-nav";
import { ModeSwitcher } from "@/components/mode-switcher";
import { PaletteSwitcher } from "@/components/terminal/palette-switcher";
import { Ruler } from "@/components/terminal/ruler";
import { ROUTES } from "@/constants/routes";
import { getSearchGroups } from "@/lib/search-index";
import { source } from "@/lib/source";

// `match` lists the path prefixes each link stays current for.
const navItems = [
  {
    href: ROUTES.DOCS,
    label: "Docs",
    match: ["/docs/installation", "/docs/theming", "/docs/engine"],
  },
  {
    href: ROUTES.DOCS_EXAMPLES,
    label: "Components",
    match: [
      "/docs/backgrounds",
      "/docs/charts",
      "/docs/interface",
      "/docs/text",
      "/docs/images",
    ],
  },
  { href: ROUTES.SCENES, label: "Scenes", match: ["/docs/scenes"] },
  { href: ROUTES.STUDIO, label: "Studio" },
];

/**
 * A full-width instrument bar: wordmark, nav and tools on one 44px row,
 * then a 12px column ruler that runs the width of the page. The ruler is
 * the site's signature; the page reads as a canvas measured in cells.
 * Total height is --header-height (56px) so sticky sidebars clear it.
 */
export const SiteHeader = () => (
  <header
    className="bg-background/92 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50 flex h-(--header-height) w-full flex-col border-b backdrop-blur-md"
    style={{ viewTransitionName: "site-header" }}
  >
    <div className="flex h-11 w-full items-center gap-1 px-2 sm:px-4">
      <MobileNav
        items={navItems}
        tree={source.pageTree}
        githubLink={
          <GithubLink
            label="GitHub"
            location="mobile_menu"
            className="text-foreground gap-3 text-base [&_svg]:size-4"
          />
        }
        className="flex lg:hidden"
      />
      <BrandContextMenu className="group/brand flex h-8 items-center rounded-xs px-1.5 lg:mr-4" />
      <MainNav items={navItems} className="hidden lg:flex" />
      <div className="ml-auto flex items-center gap-1">
        <CommandMenu groups={getSearchGroups()} />
        <span
          aria-hidden
          className="bg-border mx-1.5 hidden h-4 w-px sm:block"
        />
        <PaletteSwitcher />
        <GithubLink
          location="navbar"
          className="extend-touch-target hidden h-8 rounded-xs px-2 text-xs sm:inline-flex"
        />
        <ModeSwitcher />
      </div>
    </div>
    <Ruler cell={8} className="border-t opacity-80" />
  </header>
);
