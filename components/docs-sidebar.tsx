"use client";

import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
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

const MENU_BUTTON_CLS =
  "relative h-[30px] w-fit overflow-visible border border-transparent text-[0.8rem] font-medium text-muted-foreground hover:text-foreground after:absolute after:inset-x-0 after:-inset-y-1 after:z-0 after:rounded-md data-[active=true]:bg-accent data-[active=true]:text-accent-foreground 3xl:fixed:w-full 3xl:fixed:max-w-48";

const PageLink = ({
  page,
  pathname,
}: {
  page: { url: string; name: React.ReactNode };
  pathname: string;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      className={MENU_BUTTON_CLS}
      isActive={page.url === pathname}
    >
      <Link href={page.url}>
        <span className="absolute inset-0 flex w-(--sidebar-menu-width) bg-transparent" />
        {page.name}
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
);

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
              MENU_BUTTON_CLS,
              "group/category 3xl:fixed:max-w-none w-full gap-1.5 pr-1.5 pl-1",
              isCurrent && "text-foreground"
            )}
          >
            <Icon
              icon={ArrowRight01Icon}
              className="text-muted-foreground size-3.5 shrink-0 transition-transform duration-150 ease-out group-data-[state=open]/category:rotate-90 motion-reduce:transition-none"
            />
            <span className="truncate">{category.name}</span>
            <span className="text-muted-foreground/85 ml-auto text-xs font-normal tabular-nums">
              {category.pages.length}
            </span>
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden motion-reduce:animate-none">
          <SidebarMenu className="border-sidebar-border ml-[11px] border-l py-0.5 pl-2">
            {category.pages.map((page) => (
              <PageLink key={page.url} page={page} pathname={pathname} />
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
  const contentRef = useRef<HTMLDivElement>(null);

  // Bring the current page into the clear middle of the list, out from
  // under the fades at the top and bottom. Its group opens with a short
  // animation first, so measure once that has settled. If the reader
  // scrolls or reaches for the sidebar before then, leave it where they put it.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const events = [
      "scroll",
      "wheel",
      "touchstart",
      "pointerdown",
      "keydown",
    ] as const;
    let timer = 0;
    const cancel = () => {
      window.clearTimeout(timer);
      for (const event of events) {
        content.removeEventListener(event, cancel);
      }
    };
    timer = window.setTimeout(() => {
      cancel();
      const active = content.querySelector<HTMLElement>('[data-active="true"]');
      if (!active) {
        return;
      }
      const box = content.getBoundingClientRect();
      const row = active.getBoundingClientRect();
      const clearTop = box.top + 64;
      const clearBottom = box.bottom - 96;
      if (row.top < clearTop || row.bottom > clearBottom) {
        content.scrollTop += row.top - box.top - content.clientHeight / 2;
      }
    }, 260);
    for (const event of events) {
      content.addEventListener(event, cancel, { passive: true });
    }
    return cancel;
  }, [pathname]);

  return (
    <Sidebar
      className="text-sidebar-foreground sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] flex-col overscroll-none bg-transparent [--sidebar-menu-width:--spacing(48)] lg:flex"
      collapsible="none"
      {...props}
    >
      <div className="h-9" />
      <div className="absolute top-8 z-10 h-8 w-(--sidebar-menu-width) shrink-0 bg-linear-to-b from-background via-background/80 to-background/50 blur-xs" />
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-linear-to-b from-transparent via-border to-transparent lg:flex" />
      <SidebarContent
        ref={contentRef}
        className="mx-auto no-scrollbar w-(--sidebar-menu-width) overflow-x-hidden px-2 pt-4"
      >
        {getDocsNav(tree).map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel className="text-foreground font-semibold">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
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
        <div className="from-background via-background/80 to-background/50 sticky -bottom-1 z-10 h-16 shrink-0 bg-linear-to-t blur-xs" />
      </SidebarContent>
    </Sidebar>
  );
};
