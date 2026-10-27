"use client";

import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
} from "react";

import { cssColor, usePrefersReducedMotion } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * The strip is a grid of glyph cells, as wide as the box-drawing advance
 * (`--tabs-cw`, measured from a probe), not the text font's `ch`: the two
 * often come from different fonts. Frame rows hold only box glyphs, never
 * spaces, and gaps are padding, so nothing drifts off the grid. Tab `i` owns a divider cell at
 * column `x[i]` and its padded label after it, so the next divider sits at
 * `x[i + 1] = x[i] + label + 3`. The active tab is the span between two
 * dividers; it slides as a pair of floats, rounded to whole cells for the
 * folder and to half cells for the underline, whose ends use the half
 * heavy lines `╾` and `╼`.
 */

/** `folder` opens the active tab into a framed panel; `underline` slides a heavy rule along a light one. */
export type AsciiTabsVariant = "folder" | "underline";

export type AsciiTabsSize = "sm" | "md" | "lg";

/** One tab and its panel. */
export interface AsciiTab {
  /** Unique id of the tab, used by `value`. */
  value: string;
  /** Text on the tab. Plain text, so it sits on the cell grid. */
  label: string;
  /** What the panel shows while the tab is active. */
  content: ReactNode;
}

export interface AsciiTabsProps extends Omit<
  ComponentProps<"div">,
  "defaultValue" | "color"
> {
  /** The tabs, left to right. */
  tabs: readonly AsciiTab[];
  /** The active tab, when you control it. */
  value?: string;
  /** The tab active at first, when the tabs control themselves. Default: the first tab. */
  defaultValue?: string;
  /** Called with the new tab's `value` when the visitor picks a tab. */
  onValueChange?: (value: string) => void;
  /** Names the tab list for screen readers. */
  label?: string;
  /** Default `"folder"`. */
  variant?: AsciiTabsVariant;
  /** Colour of the active label and the underline: a palette name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 20px. Default `"md"`. */
  size?: AsciiTabsSize;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

const CELLS = { lg: 20, md: 16, sm: 12 } as const satisfies Record<
  AsciiTabsSize,
  number
>;

/** Long enough for any width; the overflow is clipped. */
const RUN = 320;
const VERTICAL_RUN = "│\n".repeat(RUN / 4);
const SLIDE_MS = 200;

/**
 * Font size per cell height. Cascadia Mono's box lines are 1.17em tall, so
 * at this size the frame's vertical lines join across rows.
 */
const GLYPH_EM = 1.17;

const PROBE = "─".repeat(10);

/** The tab's CSS variables: cell height, active ink and the muted frame. */
type TabsVars = CSSProperties &
  Record<"--tabs-cell" | "--tabs-cw" | "--tabs-ink" | "--tabs-frame", string>;

/** `n` glyph cells as a CSS length. */
const cells = (n: number) => `calc(var(--tabs-cw) * ${n})`;

interface Span {
  readonly start: number;
  readonly end: number;
}

/** The divider column before each tab, plus the one after the last. */
const dividers = (tabs: readonly AsciiTab[]): number[] => {
  const columns = [0];
  for (const tab of tabs) {
    columns.push((columns.at(-1) ?? 0) + [...tab.label].length + 3);
  }
  return columns;
};

/**
 * `target` eased from where the span was last shown, so a new tab slides
 * in. Jumps under reduced motion.
 */
const useSlide = (target: Span): Span => {
  const reduced = usePrefersReducedMotion();
  const [shown, setShown] = useState(target);
  const shownRef = useRef(shown);
  const { start, end } = target;
  useEffect(() => {
    const from = shownRef.current;
    if (reduced || (from.start === start && from.end === end)) {
      shownRef.current = { end, start };
      setShown(shownRef.current);
      return;
    }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      // A frame's timestamp can predate `began`, so clamp below too: a
      // negative t would ease backwards past the start.
      const t = Math.min(1, Math.max(0, (now - began) / SLIDE_MS));
      const eased = 1 - (1 - t) ** 3;
      shownRef.current = {
        end: from.end + (end - from.end) * eased,
        start: from.start + (start - from.start) * eased,
      };
      setShown(shownRef.current);
      if (t < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [start, end, reduced]);
  return shown;
};

/** Width of a box glyph, from a run of them; `null` until measured. */
const useGlyphAdvance = () => {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [advance, setAdvance] = useState<number | null>(null);
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      return;
    }
    const measure = () => {
      const width = probe.getBoundingClientRect().width / PROBE.length;
      if (width > 0) {
        setAdvance(width);
      }
    };
    measure();
    // A web font that loads late or a zoom change resizes the probe.
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);
  return { advance, probeRef };
};

interface Run {
  readonly text: string;
  readonly lit: boolean;
}

/**
 * The underline: `─` everywhere, `━` under the active span, with `╾` and
 * `╼` where the span ends halfway through a cell.
 */
const underline = (span: Span, width: number): Run[] => {
  const runs: Run[] = [];
  for (let column = 0; column < width; column += 1) {
    const left = span.start <= column && span.end >= column + 0.5;
    const right = span.start <= column + 0.5 && span.end >= column + 1;
    let glyph = "─";
    if (left && right) {
      glyph = "━";
    } else if (left) {
      glyph = "╾";
    } else if (right) {
      glyph = "╼";
    }
    const lit = left || right;
    const last = runs.at(-1);
    if (last && last.lit === lit) {
      runs[runs.length - 1] = { lit, text: last.text + glyph };
    } else {
      runs.push({ lit, text: glyph });
    }
  }
  return runs;
};

/** One row of frame glyphs. */
const ROW = "h-[var(--tabs-cell)] overflow-hidden whitespace-pre select-none";

/** Top row of the folder: a lid over the active span. */
const Lid = ({ span }: { span: Span }) => (
  <div
    aria-hidden="true"
    className={ROW}
    style={{ paddingLeft: cells(span.start) }}
  >
    {`╭${"─".repeat(Math.max(0, span.end - span.start - 1))}╮`}
  </div>
);

/** The row under the tabs: the panel's top edge, open under the active tab. */
const FolderBase = ({ span }: { span: Span }) => (
  <div aria-hidden="true" className={cn(ROW, "flex")}>
    <span className="shrink-0">
      {span.start <= 0 ? "│" : `╭${"─".repeat(span.start - 1)}╯`}
    </span>
    <span
      className="shrink-0"
      style={{ width: cells(Math.max(0, span.end - span.start - 1)) }}
    />
    <span className="shrink-0">╰</span>
    <span className="min-w-0 flex-1 overflow-hidden">{"─".repeat(RUN)}</span>
    <span className="w-[var(--tabs-cw)] shrink-0">╮</span>
  </div>
);

/** The row under the tabs: a light rule with the heavy underline on it. */
const UnderlineBase = ({ span, width }: { span: Span; width: number }) => (
  <div aria-hidden="true" className={cn(ROW, "flex")}>
    <span className="shrink-0">
      {underline(span, width).map((run, index) => (
        <span
          // Runs are positional: the nth run of the rule.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          className={run.lit ? "text-[var(--tabs-ink)]" : undefined}
        >
          {run.text}
        </span>
      ))}
    </span>
    <span className="min-w-0 flex-1 overflow-hidden">{"─".repeat(RUN)}</span>
  </div>
);

/** The folder panel's sides and bottom, behind its content. */
const PanelFrame = ({ style }: { style: CSSProperties }) => (
  <div
    aria-hidden="true"
    className={cn(
      "pointer-events-none absolute inset-0 grid grid-cols-[var(--tabs-cw)_minmax(0,1fr)_var(--tabs-cw)] grid-rows-[minmax(0,1fr)_var(--tabs-cell)] whitespace-pre text-[var(--tabs-frame)] select-none"
    )}
    style={style}
  >
    <div className="overflow-hidden">{VERTICAL_RUN}</div>
    <div />
    <div className="overflow-hidden">{VERTICAL_RUN}</div>
    <span>╰</span>
    <div className="overflow-hidden">{"─".repeat(RUN)}</div>
    <span>╯</span>
  </div>
);

const NEXT_KEYS: Readonly<
  Record<string, (index: number, count: number) => number>
> = {
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  ArrowRight: (index, count) => (index + 1) % count,
  End: (_index, count) => count - 1,
  Home: () => 0,
};

/**
 * Where the active tab's span is drawn right now. The folder spans the
 * dividers in whole cells; the underline runs under the padded label in
 * half cells. `landed` once the slide has reached the active tab.
 */
const useTabSpan = (
  tabs: readonly AsciiTab[],
  activeIndex: number,
  folder: boolean
) => {
  const columns = dividers(tabs);
  const left = columns[activeIndex] ?? 0;
  const right = columns[activeIndex + 1] ?? left;
  const target: Span = { end: right, start: folder ? left : left + 1 };
  const slide = useSlide(target);
  const snap = folder ? 1 : 2;
  const span: Span = {
    end: Math.round(slide.end * snap) / snap,
    start: Math.round(slide.start * snap) / snap,
  };
  return {
    columns,
    landed: span.start === target.start && span.end === target.end,
    span,
    width: (columns.at(-1) ?? 0) + 1,
  };
};

/**
 * Tabs drawn in box-drawing glyphs. `folder` lifts the active tab out of a
 * framed panel like a file folder, its lid sliding to the tab you pick;
 * `underline` slides a heavy rule along a light one in half-cell steps.
 * Real tab buttons with a roving tab stop: arrow keys, Home and End move
 * between tabs, and the panel follows focus.
 */
export const AsciiTabs = ({
  tabs,
  value,
  defaultValue,
  onValueChange,
  label,
  variant = "folder",
  color = "ink",
  size = "md",
  cell,
  className,
  style,
  ...props
}: AsciiTabsProps) => {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [own, setOwn] = useState(defaultValue ?? tabs[0]?.value ?? "");
  const active = value ?? own;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === active)
  );
  const folder = variant === "folder";
  const height = cell ?? CELLS[size];

  const { advance, probeRef } = useGlyphAdvance();
  const { columns, landed, span, width } = useTabSpan(
    tabs,
    activeIndex,
    folder
  );

  const select = (index: number) => {
    const tab = tabs[index];
    if (!tab) {
      return;
    }
    if (value === undefined) {
      setOwn(tab.value);
    }
    if (tab.value !== active) {
      onValueChange?.(tab.value);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = NEXT_KEYS[event.key];
    if (!move || tabs.length === 0) {
      return;
    }
    event.preventDefault();
    const next = move(activeIndex, tabs.length);
    tabRefs.current[next]?.focus();
    select(next);
  };

  const vars: TabsVars = {
    "--tabs-cell": `${height}px`,
    // Before measuring: Cascadia Mono's advance, 0.586em, at this font size.
    "--tabs-cw":
      advance === null ? `${(height / GLYPH_EM) * 0.586}px` : `${advance}px`,
    // Opaque, so the edges where neighbouring glyphs overlap don't double up.
    "--tabs-frame":
      "color-mix(in oklab, var(--ascii-ink) 45%, var(--ascii-paper))",
    "--tabs-ink": cssColor(color),
    ...style,
  };
  const glyphText: CSSProperties = {
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / GLYPH_EM}px`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${height}px`,
  };

  return (
    <div
      data-slot="ascii-tabs"
      data-variant={variant}
      className={cn("flex w-full min-w-0 flex-col", className)}
      style={vars}
      {...props}
    >
      <div className="relative text-[var(--tabs-frame)]" style={glyphText}>
        <span
          ref={probeRef}
          aria-hidden="true"
          className="invisible absolute top-0 left-0 whitespace-pre"
        >
          {PROBE}
        </span>
        {folder ? <Lid span={span} /> : null}
        <div
          role="tablist"
          aria-label={label}
          aria-orientation="horizontal"
          className="flex"
          onKeyDown={onKeyDown}
        >
          {tabs.map((tab, index) => {
            const selected = index === activeIndex;
            const divider = columns[index] ?? 0;
            return (
              <Fragment key={tab.value}>
                <span
                  aria-hidden="true"
                  className={cn(ROW, "w-[var(--tabs-cw)] shrink-0")}
                >
                  {folder && landed && divider === span.start ? "│" : null}
                </span>
                <button
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${index}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  className={cn(
                    "relative h-[var(--tabs-cell)] shrink-0 cursor-pointer text-center whitespace-pre outline-hidden transition-colors duration-150",
                    // A taller hit area, over the rows above and below.
                    "before:absolute before:inset-x-0 before:-top-[var(--tabs-cell)] before:-bottom-[var(--tabs-cell)] before:content-['']",
                    "focus-visible:rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid",
                    selected
                      ? "font-medium text-[var(--tabs-ink)]"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  style={{ width: cells([...tab.label].length + 2) }}
                  onClick={() => select(index)}
                >
                  {tab.label}
                </button>
              </Fragment>
            );
          })}
          <span
            aria-hidden="true"
            className={cn(ROW, "w-[var(--tabs-cw)] shrink-0")}
          >
            {folder && landed && columns.at(-1) === span.end ? "│" : null}
          </span>
        </div>
        {folder ? (
          <FolderBase span={span} />
        ) : (
          <UnderlineBase span={span} width={width} />
        )}
      </div>
      <div
        className={cn(
          "relative",
          folder
            ? "px-[calc(var(--tabs-cell)*1.5)] pt-[calc(var(--tabs-cell)*0.75)] pb-[calc(var(--tabs-cell)*1.75)]"
            : "pt-[calc(var(--tabs-cell)*1)]"
        )}
      >
        {folder ? <PanelFrame style={glyphText} /> : null}
        {tabs.map((tab, index) => (
          <div
            key={tab.value}
            role="tabpanel"
            id={`${baseId}-panel-${index}`}
            aria-labelledby={`${baseId}-tab-${index}`}
            hidden={index !== activeIndex}
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a panel without its own controls needs a tab stop, per the ARIA tabs pattern
            tabIndex={0}
            className="relative min-w-0 rounded-[2px] outline-hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring focus-visible:outline-solid"
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};
