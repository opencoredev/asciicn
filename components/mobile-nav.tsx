"use client";

import type { Root as PageTreeRoot } from "fumadocs-core/page-tree";
import type { LinkProps } from "next/link";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { PaletteSwitcher } from "@/components/terminal/palette-switcher";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ROUTES } from "@/constants/routes";
import { getDocsNav } from "@/lib/docs-nav";
import { cn } from "@/lib/utils";

const MobileLink = ({
  href,
  onOpenChange,
  className,
  children,
  ...props
}: LinkProps & {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) => {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push(href.toString());
    onOpenChange?.(false);
  }, [router, href, onOpenChange]);

  return (
    <Link
      href={href}
      onClick={handleClick}
      className={cn(
        "text-foreground hover:bg-accent flex h-10 items-center gap-3 border-b px-1 text-[15px]",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
};

const MobileNavGroup = ({
  label,
  pages,
  setOpen,
}: {
  label: React.ReactNode;
  pages: { url: string; name: React.ReactNode }[];
  setOpen: (open: boolean) => void;
}) => {
  if (pages.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="label-caps text-muted-foreground">{label}</div>
      <div className="flex flex-col border-t">
        {pages.map((page) => (
          <MobileLink key={page.url} href={page.url} onOpenChange={setOpen}>
            {page.name}
          </MobileLink>
        ))}
      </div>
    </div>
  );
};

export const MobileNav = ({
  items,
  tree,
  githubLink,
  className,
}: {
  items: { href: string; label: string }[];
  tree: PageTreeRoot;
  /** The repo link, rendered on the server so its star count can stream in. */
  githubLink: React.ReactNode;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "extend-touch-target size-8 touch-manipulation items-center justify-center rounded-xs !p-0 hover:bg-transparent active:bg-transparent dark:hover:bg-transparent",
            className
          )}
        >
          <div className="relative flex h-8 w-4 items-center justify-center">
            <div className="relative size-4">
              <span
                className={cn(
                  "bg-foreground absolute left-0 block h-px w-4 transition-[top,rotate] duration-100",
                  open ? "top-[7.5px] -rotate-45" : "top-1"
                )}
              />
              <span
                className={cn(
                  "bg-foreground absolute left-0 block h-px w-4 transition-[top,rotate] duration-100",
                  open ? "top-[7.5px] rotate-45" : "top-[11px]"
                )}
              />
            </div>
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-background no-scrollbar h-(--radix-popper-available-height) w-(--radix-popper-available-width) overflow-y-auto rounded-none border-none p-0 shadow-none duration-100"
        align="start"
        side="bottom"
        alignOffset={-16}
        sideOffset={20}
      >
        <div className="flex flex-col gap-10 overflow-auto px-4 pt-4 pb-10">
          <nav aria-label="Site" className="flex flex-col border-t">
            {[{ href: ROUTES.HOME, label: "Home" }, ...items].map(
              (item, index) => (
                <MobileLink
                  key={item.href}
                  href={item.href}
                  onOpenChange={setOpen}
                  className="font-display h-12 text-lg tracking-[-0.02em] [font-stretch:87.5%]"
                >
                  <span className="tabular text-faint font-mono text-xs">
                    {String(index).padStart(2, "0")}
                  </span>
                  {item.label.toLowerCase()}
                </MobileLink>
              )
            )}
            <div className="flex h-12 items-center border-b px-1">
              {githubLink}
            </div>
          </nav>
          <PaletteSwitcher variant="inline" />
          {getDocsNav(tree).map((section) => (
            <MobileNavGroup
              key={section.id}
              label={section.label}
              pages={[
                ...section.pages,
                // Categories jump to their place in the catalog, which keeps
                // the menu short; each component page links to its neighbours.
                ...section.categories.map((category) => ({
                  name: category.name,
                  url: `${ROUTES.DOCS_EXAMPLES}#catalog-${category.id}`,
                })),
              ]}
              setOpen={setOpen}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};
