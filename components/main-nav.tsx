"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  /** Path prefixes, besides `href` itself, that keep the link current. */
  match?: string[];
}

const isActive = (pathname: string, { href, match = [] }: NavItem) =>
  pathname === href || match.some((prefix) => pathname.startsWith(prefix));

/**
 * Lowercase mono tabs. The current one gets an ink rule on the header's
 * bottom edge and a `▸` marker, so position reads without colour alone.
 */
export const MainNav = ({
  items,
  className,
  ...props
}: React.ComponentProps<"nav"> & {
  items: NavItem[];
}) => {
  const pathname = usePathname();

  return (
    <nav className={cn("h-full items-stretch", className)} {...props}>
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item) ? "page" : undefined}
          className="group/nav text-muted-foreground hover:text-foreground aria-[current=page]:text-foreground relative flex items-center px-3 text-[13px] lowercase transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-px after:bg-transparent aria-[current=page]:after:bg-(--ascii-ink)"
          transitionTypes={["nav-forward"]}
        >
          <span
            aria-hidden
            className="text-ink -ml-1 w-[1ch] opacity-0 group-aria-[current=page]/nav:opacity-100"
          >
            ▸
          </span>
          <span className="ml-1">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};
