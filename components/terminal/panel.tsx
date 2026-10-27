/**
 * Panel: a titled terminal pane. The frame is either crisp 1px rules or
 * box-drawing glyphs (`┌─ title ──┐`), with optional ruler and status slots.
 *
 *   <Panel title="silk.tsx" meta="96×32" status={<StatusBar … />}>
 *     …
 *   </Panel>
 *
 * Props
 * - `title`: label in the title bar (set in the display face, caps).
 * - `meta`: right side of the title bar (dim; readouts, actions).
 * - `frame`: "rule" (1px borders, default) or "glyph" (box-drawing frame
 *   drawn with the mono font's `┌ ─ ┐ │ └ ┘`). "none" drops the frame.
 * - `ruler`: a node placed directly under the title bar (usually `<Ruler />`).
 * - `status`: a node placed at the bottom edge (usually `<StatusBar />`).
 * - `bodyClassName`: classes for the content box.
 * - all other `section` props; `title` is announced as the section label.
 */

import { useId } from "react";

import { cn } from "@/lib/utils";

export interface PanelProps extends Omit<
  React.ComponentProps<"section">,
  "title"
> {
  /** Title bar label. */
  title?: React.ReactNode;
  /** Right side of the title bar. */
  meta?: React.ReactNode;
  /** "rule" (1px), "glyph" (box drawing) or "none". Default "rule". */
  frame?: "rule" | "glyph" | "none";
  /** Slot under the title bar, usually a `Ruler`. */
  ruler?: React.ReactNode;
  /** Slot on the bottom edge, usually a `StatusBar`. */
  status?: React.ReactNode;
  /** Classes for the content box. */
  bodyClassName?: string;
}

// Long enough to cross any pane; the row clips it.
const HORIZONTAL = "─".repeat(320);

const GlyphRow = ({
  left,
  right,
  children,
  meta,
}: {
  left: string;
  right: string;
  children?: React.ReactNode;
  meta?: React.ReactNode;
}) => (
  <div className="text-rule flex h-[1.2em] items-center overflow-hidden leading-[1.2] whitespace-pre select-none">
    <span aria-hidden>{left}─</span>
    {children ? (
      <span className="label-caps text-foreground shrink-0 px-[1ch]">
        {children}
      </span>
    ) : null}
    <span aria-hidden className="min-w-0 flex-1 overflow-hidden">
      {HORIZONTAL}
    </span>
    {meta ? (
      <span className="text-muted-foreground shrink-0 px-[1ch] text-[11px]">
        {meta}
      </span>
    ) : null}
    <span aria-hidden>─{right}</span>
  </div>
);

export const Panel = ({
  title,
  meta,
  frame = "rule",
  ruler,
  status,
  bodyClassName,
  className,
  children,
  ...props
}: PanelProps) => {
  const titleId = useId();
  const labelled = title ? { "aria-labelledby": titleId } : {};

  if (frame === "glyph") {
    return (
      <section
        data-slot="panel"
        data-frame="glyph"
        className={cn("relative font-mono text-xs", className)}
        {...labelled}
        {...props}
      >
        <GlyphRow left="┌" right="┐" meta={meta}>
          {title ? <span id={titleId}>{title}</span> : null}
        </GlyphRow>
        <div className="relative px-[1ch]">
          {/* Side rules sit on the centre of the first and last cell, where
              the corner glyphs draw their vertical stroke. */}
          <span
            aria-hidden
            className="bg-rule absolute inset-y-0 left-[calc(0.5ch-0.5px)] w-px"
          />
          <span
            aria-hidden
            className="bg-rule absolute inset-y-0 right-[calc(0.5ch-0.5px)] w-px"
          />
          {ruler}
          <div className={cn("relative px-[1ch] py-2", bodyClassName)}>
            {children}
          </div>
          {status}
        </div>
        <GlyphRow left="└" right="┘" />
      </section>
    );
  }

  return (
    <section
      data-slot="panel"
      data-frame={frame}
      className={cn(
        "bg-card text-card-foreground relative flex flex-col overflow-hidden",
        frame === "rule" && "rounded-sm border",
        className
      )}
      {...labelled}
      {...props}
    >
      {title || meta ? (
        <header className="flex h-8 shrink-0 items-center gap-3 border-b px-3">
          {title ? (
            <span id={titleId} className="label-caps text-foreground truncate">
              {title}
            </span>
          ) : null}
          {meta ? (
            <span className="text-muted-foreground ml-auto flex items-center gap-2 font-mono text-[11px]">
              {meta}
            </span>
          ) : null}
        </header>
      ) : null}
      {ruler ? <div className="shrink-0 border-b">{ruler}</div> : null}
      <div className={cn("relative min-h-0 flex-1", bodyClassName)}>
        {children}
      </div>
      {status}
    </section>
  );
};
