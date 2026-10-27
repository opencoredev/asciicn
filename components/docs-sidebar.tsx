"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getDocsNav } from "@/lib/docs-nav";
import type { DocsNavCategory } from "@/lib/docs-nav";
import type { source } from "@/lib/source";
import { cn } from "@/lib/utils";

/*
 * A file tree. Sections are caps labels; catalog groups fold like
 * directories (▸ closed, ▾ open) with their page count; pages inside hang
 * off box-drawing branches (├─ and └─). The current page gets the ink
 * marker and an ink wash, so it reads without colour too.
 */

const ROW_CLS =
  "relative h-7 w-full gap-0 rounded-xs px-2 font-mono text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground data-[active=true]:bg-ink-soft data-[active=true]:text-foreground data-[active=true]:font-normal";

const PageLink = ({
  page,
  pathname,
  branch,
}: {
  page: { url: string; name: React.ReactNode };
  pathname: string;
  /** Tree glyph before the name, for pages inside a group. */
  branch?: "├─" | "└─";
}) => {
  const active = page.url === pathname;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild className={ROW_CLS} isActive={active}>
        <Link href={page.url}>
          {branch ? (
            <span aria-hidden className="text-faint mr-1.5 shrink-0">
              {branch}
            </span>
          ) : null}
          <span
            aria-hidden
            className={cn(
              "text-ink mr-1 w-[1ch] shrink-0",
              active ? "opacity-100" : "opacity-0"
            )}
          >
            ▸
          </span>
          <span className="truncate">{page.name}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

/**
 * One catalog group, folded to a single row so the sidebar stays short. It
 * opens on its own when the reader lands on one of its pages, and otherwise
 * remembers what the reader opened while they move around the docs.
 */
const CategoryGroup = ({
  category,
  pathname,
}: {
  category: DocsNavCategory;
  pathname: string;
}) => {
  const isCurrent = category.pages.some((page) => page.url === pathname);
  const [open, setOpen] = useState(isCurrent);
  const [wasCurrent, setWasCurrent] = useState(isCurrent);

  if (isCurrent !== wasCurrent) {
    setWasCurrent(isCurrent);
    if (isCurrent) {
      setOpen(true);
    }
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            className={cn(
              ROW_CLS,
              "group/category",
              isCurrent && "text-foreground"
            )}
          >
            <span aria-hidden className="text-faint mr-1.5 w-[1ch] shrink-0">
              <span className="group-data-[state=open]/category:hidden">▸</span>
              <span className="hidden group-data-[state=open]/category:inline">
                ▾
              </span>
            </span>
            <span className="truncate lowercase">{category.name}/</span>
            <span className="text-faint tabular ml-auto text-[11px]">
              {category.pages.length}
            </span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden motion-reduce:animate-none">
          <SidebarMenu className="gap-0 pl-2">
            {category.pages.map((page, index) => (
              <PageLink
                key={page.url}
                page={page}
                pathname={pathname}
                branch={index === category.pages.length - 1 ? "└─" : "├─"}
              />
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
};

export const DocsSidebar = ({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & { tree: typeof source.pageTree }) => {
  const pathname = usePathname();

  return (
    <Sidebar
      className="text-sidebar-foreground sticky top-(--header-height) z-30 hidden h-[calc(100svh-var(--header-height))] w-(--sidebar-width) flex-col overscroll-none border-r bg-transparent lg:flex"
      collapsible="none"
      {...props}
    >
      <SidebarContent className="no-scrollbar gap-0 overflow-x-hidden px-2 pt-4 pb-10">
        {getDocsNav(tree).map((section) => (
          <SidebarGroup key={section.id} className="px-0 pb-3">
            <SidebarGroupLabel className="label-caps text-muted-foreground h-7 px-2">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0">
                {section.pages.map((page) => (
                  <PageLink key={page.url} page={page} pathname={pathname} />
                ))}
                {section.categories.map((category) => (
                  <CategoryGroup
                    key={category.id}
                    category={category}
                    pathname={pathname}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
};
