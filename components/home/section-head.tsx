import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A numbered section heading, like a pane title in a terminal: index and
 * path on a rule, then the heading and one short lead.
 */
export const SectionHead = ({
  index,
  path,
  id,
  title,
  lead,
  aside,
  className,
}: {
  /** Two-digit section number. */
  index: string;
  /** Short path-like label, such as `scenes/`. */
  path: string;
  /** Id for the heading, for `aria-labelledby`. */
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Right column on wide screens: links, counts. */
  aside?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-5", className)}>
    <div className="text-faint flex items-center gap-3 font-mono text-[11px]">
      <span className="text-ink tabular">{index}</span>
      <span>{path}</span>
      <span aria-hidden className="bg-rule h-px flex-1" />
    </div>
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end lg:gap-12">
      <h2
        id={id}
        className="font-display text-[1.75rem] leading-[1.1] tracking-[-0.03em] text-balance sm:text-[2.25rem]"
      >
        {title}
      </h2>
      <div className="flex flex-col gap-3">
        {lead ? (
          <p className="text-muted-foreground max-w-xl text-[15px] text-pretty">
            {lead}
          </p>
        ) : null}
        {aside}
      </div>
    </div>
  </div>
);
