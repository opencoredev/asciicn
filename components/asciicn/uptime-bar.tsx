"use client";

import { useId, useRef, useState } from "react";
import type { ComponentProps, CSSProperties, KeyboardEvent } from "react";

import { DEFAULT_FONT, LINE_HEIGHT, MOTION, cssColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/** `none` means no data for the day, such as before the service existed. */
export type UptimeStatus = "up" | "degraded" | "down" | "none";

export interface UptimeDay {
  /** The day, as an ISO date: `"2026-10-13"`. */
  date: string;
  /** Share of the day the service was up, 0 to 1. `null` for no data. */
  uptime: number | null;
  /** Override the status worked out from `uptime`. */
  status?: UptimeStatus;
  /** A short incident note for the tooltip. */
  note?: string;
}

export type UptimeBarProps = Omit<ComponentProps<"div">, "children"> & {
  /** The service, such as `"API"`. */
  label: string;
  /** One entry per day, oldest first. The last 30, 60 or 90 show, depending on width. */
  days: readonly UptimeDay[];
  /** Colours per status, as palette names or CSS colours. Default: green up, orange degraded, red down, grey for no data. */
  colors?: Partial<Record<UptimeStatus, AsciiColor>>;
  /**
   * Text rows the bars span. Each status has its own height, so it never
   * relies on colour alone: up days are full, degraded three quarters,
   * outages a quarter and days without data a dot. Default 2.
   */
  rows?: number;
  /**
   * Glyph cell height in CSS pixels. Default: the cells grow so the shown
   * days fill the row, up to `maxCell`.
   */
  cell?: number;
  /** Largest cell height when `cell` is unset, in CSS pixels. Default 16. */
  maxCell?: number;
  /** Locale for dates in the tooltip. Default `"en-US"`. */
  locale?: string;
};

const DEFAULT_COLORS = {
  degraded: "orange",
  down: "red",
  none: "grey",
  up: "green",
} as const satisfies Record<UptimeStatus, AsciiColor>;

/** Height of each status in quarter cells: half blocks keep a gap between days. */
const STATUS_QUARTERS = {
  degraded: 3,
  down: 1,
  none: 0,
  up: 4,
} as const satisfies Record<UptimeStatus, number>;

/**
 * The glyphs of one day's column, top row first. The bar fills from the
 * bottom in half-cell steps, using the left half of each cell so
 * neighbouring days stay apart.
 */
const columnGlyphs = (status: UptimeStatus, rows: number): string[] => {
  if (status === "none") {
    return [...Array.from({ length: rows - 1 }, () => " "), "·"];
  }
  // Halves of the whole column to fill, from the bottom.
  const halves = Math.max(
    1,
    Math.round((STATUS_QUARTERS[status] / 4) * rows * 2)
  );
  return Array.from({ length: rows }, (_, row) => {
    const fromBottom = rows - 1 - row;
    const filled = halves - fromBottom * 2;
    if (filled >= 2) {
      return "▌";
    }
    return filled === 1 ? "▖" : " ";
  });
};

/** The swatch for a status in the tooltip: a column of the bar's glyphs. */
const swatchGlyph = (status: UptimeStatus) => (status === "none" ? "·" : "▌");

const STATUS_TEXT = {
  degraded: "Degraded",
  down: "Outage",
  none: "No data",
  up: "Operational",
} as const satisfies Record<UptimeStatus, string>;

/** Up at 99.9% or more, degraded at 99% or more, else down. */
const statusOf = (day: UptimeDay): UptimeStatus => {
  if (day.status !== undefined) {
    return day.status;
  }
  if (day.uptime === null) {
    return "none";
  }
  if (day.uptime >= 0.999) {
    return "up";
  }
  return day.uptime >= 0.99 ? "degraded" : "down";
};

const formatPercent = (value: number) =>
  `${(Math.floor(value * 10_000) / 100).toFixed(2)}%`;

const TOOLTIP_WIDTH = 208;

/** The tooltip's day and position. A hidden tip keeps its place so it fades out there. */
interface Tip {
  index: number;
  left: number;
  visible: boolean;
  /** Glide from the last bar (pointer) or jump (keyboard, first show). */
  glide: boolean;
}

/** Details for one day, gliding between bars by transform. */
const DayTooltip = ({
  id,
  tip,
  day,
  dates,
  colors,
}: {
  id: string;
  tip: Tip | null;
  day: UptimeDay | undefined;
  dates: Intl.DateTimeFormat;
  colors: Record<UptimeStatus, AsciiColor>;
}) => {
  const status = day === undefined ? "none" : statusOf(day);
  return (
    <div
      id={id}
      role="tooltip"
      data-glide={String(tip?.glide ?? false)}
      className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute bottom-full left-0 z-10 mb-2 rounded-md border px-3 py-2.5 font-mono text-xs shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm transition-[transform,opacity] duration-200 ease-(--ease-out) motion-reduce:transition-none data-[glide=false]:transition-[opacity]"
      style={{
        opacity: tip?.visible === true ? 1 : 0,
        transform: `translateX(${Math.round((tip?.left ?? 0) - TOOLTIP_WIDTH / 2)}px)`,
        visibility: tip === null ? "hidden" : undefined,
        width: TOOLTIP_WIDTH,
      }}
    >
      {day === undefined ? null : (
        <>
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {dates.format(new Date(`${day.date}T00:00:00Z`))}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              aria-hidden="true"
              style={{ color: cssColor(colors[status]) }}
            >
              {swatchGlyph(status)}
            </span>
            <span className="text-foreground">{STATUS_TEXT[status]}</span>
            {day.uptime === null ? null : (
              <span className="text-muted-foreground ml-auto tabular-nums">
                {formatPercent(day.uptime)}
              </span>
            )}
          </div>
          {day.note ? (
            <p className="text-muted-foreground mt-1.5 font-sans leading-snug text-pretty">
              {day.note}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

/** Days shown at each width: 30 by default, 60 from 28rem, 90 from 42rem. */
const visibility = (fromEnd: number) => {
  if (fromEnd < 30) {
    return "inline-block";
  }
  return fromEnd < 60 ? "hidden @md:inline-block" : "hidden @2xl:inline-block";
};

/**
 * Glyph sizing. With a fixed `cell` the bars are that tall. Otherwise the
 * font grows until the days shown (`--uptime-days`, set per breakpoint)
 * fill the row: one `ch` per day, so the font size is the row width over
 * the day count and the font's advance. 0.6 em is an upper bound for
 * monospace advances, so the row never overflows.
 */
const glyphStyle = (
  cell: number | undefined,
  maxCell: number
): CSSProperties => {
  const fontSize =
    cell === undefined
      ? `min(${maxCell / LINE_HEIGHT}px, calc(100cqw / var(--uptime-days) / 0.6))`
      : `${cell / LINE_HEIGHT}px`;
  return {
    fontFamily: `var(--ascii-font, ${DEFAULT_FONT})`,
    fontSize,
    fontVariantLigatures: "none",
    lineHeight: LINE_HEIGHT,
  };
};

/**
 * A status-page row drawn in glyphs: one column of half blocks per day,
 * coloured by status and with a height per status, plus the overall
 * uptime. Hover, tap or arrow through the days for each day's details.
 */
export const UptimeBar = ({
  label,
  days,
  colors,
  rows = 2,
  cell,
  maxCell = 16,
  locale = "en-US",
  className,
  style,
  ...props
}: UptimeBarProps) => {
  const tooltipId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [tip, setTip] = useState<Tip | null>(null);
  const active = tip?.visible === true ? tip.index : null;
  const [savedFocus, setFocusIndex] = useState<number | null>(null);
  // Derived each render so the roving tab stop survives `days` changing
  // length: a saved index that no longer exists falls back to the last day.
  const focusIndex =
    savedFocus !== null && savedFocus < days.length
      ? savedFocus
      : days.length - 1;
  const lines = Math.max(1, Math.round(rows));

  const palette = { ...DEFAULT_COLORS, ...colors };
  const dates = new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
  const recorded = days.flatMap(({ uptime }) =>
    uptime === null ? [] : [uptime]
  );
  const overall =
    recorded.length === 0
      ? null
      : recorded.reduce((sum, uptime) => sum + uptime, 0) / recorded.length;
  const latest = days.at(-1);
  const current = latest ? statusOf(latest) : "none";

  const describe = (day: UptimeDay) => {
    const status = statusOf(day);
    const parts = [
      dates.format(new Date(`${day.date}T00:00:00Z`)),
      STATUS_TEXT[status],
    ];
    if (day.uptime !== null) {
      parts.push(`${formatPercent(day.uptime)} uptime`);
    }
    if (day.note) {
      parts.push(day.note);
    }
    return parts.join(", ");
  };

  /** Point the tooltip at a day, kept inside the row. */
  const show = (index: number) => {
    const button = buttons.current[index];
    const row = button?.closest("ol");
    if (!button || !row) {
      return;
    }
    const centre = button.offsetLeft + button.offsetWidth / 2;
    const half = TOOLTIP_WIDTH / 2;
    const left = Math.min(Math.max(centre, half), row.offsetWidth - half);
    setTip((previous) => ({
      glide: previous?.visible === true,
      index,
      left,
      visible: true,
    }));
  };
  const hide = () =>
    setTip((previous) =>
      previous === null ? null : { ...previous, glide: false, visible: false }
    );

  const moveFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    const shown = days
      .map((_, dayIndex) => dayIndex)
      .filter((dayIndex) => Boolean(buttons.current[dayIndex]?.offsetParent));
    const position = shown.indexOf(index);
    const targets: Record<string, number | undefined> = {
      ArrowLeft: shown[Math.max(0, position - 1)],
      ArrowRight: shown[Math.min(shown.length - 1, position + 1)],
      End: shown.at(-1),
      Home: shown[0],
    };
    const next = targets[event.key];
    if (next === undefined) {
      if (event.key === "Escape") {
        hide();
      }
      return;
    }
    event.preventDefault();
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  const spans = [30, 60, 90].map((span) => Math.min(span, days.length));
  const daysVars = {
    "--uptime-days-lg": spans[2],
    "--uptime-days-md": spans[1],
    "--uptime-days-sm": Math.max(1, spans[0] ?? 1),
  } satisfies Record<`--${string}`, number | undefined>;

  return (
    <div
      className={cn(
        "@container relative flex w-full flex-col gap-3",
        className
      )}
      style={{ ...daysVars, ...style }}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="text-foreground shrink-0 font-medium">{label}</span>
          <span
            className="min-w-0 truncate font-mono text-xs"
            style={{ color: cssColor(palette[current]) }}
          >
            {STATUS_TEXT[current]}
          </span>
        </div>
        {overall === null ? null : (
          <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
            {formatPercent(overall)} uptime
          </span>
        )}
      </div>
      <div className="relative">
        <ol
          aria-label={`${label}, daily uptime`}
          className="relative flex justify-between whitespace-pre [--uptime-days:var(--uptime-days-sm)] @md:[--uptime-days:var(--uptime-days-md)] @2xl:[--uptime-days:var(--uptime-days-lg)]"
          style={glyphStyle(cell, maxCell)}
          onPointerLeave={hide}
        >
          {days.map((day, index) => {
            const status = statusOf(day);
            const fromEnd = days.length - 1 - index;
            return (
              <li key={day.date} className={visibility(fromEnd)}>
                <button
                  ref={(node) => {
                    buttons.current[index] = node;
                  }}
                  type="button"
                  tabIndex={index === focusIndex ? 0 : -1}
                  aria-label={describe(day)}
                  aria-describedby={active === index ? tooltipId : undefined}
                  onPointerEnter={() => show(index)}
                  onFocus={() => {
                    setFocusIndex(index);
                    show(index);
                  }}
                  onBlur={hide}
                  onClick={() => show(index)}
                  onKeyDown={(event) => moveFocus(event, index)}
                  className={cn(
                    "focus-visible:outline-ring block w-[1ch] cursor-default text-left transition-opacity focus-visible:outline-1 focus-visible:outline-offset-1 motion-reduce:transition-none",
                    active !== null && active !== index && "opacity-50"
                  )}
                  style={{
                    color: cssColor(palette[status]),
                    transitionDuration: `${MOTION.fast}ms`,
                  }}
                >
                  {columnGlyphs(status, lines).map((glyph, row) => (
                    // oxlint-disable-next-line react/no-array-index-key -- a column's rows are positional.
                    <span
                      key={row}
                      aria-hidden="true"
                      className="block"
                      // Block glyphs stop a hair short of the line box; overlap
                      // the rows so a bar has no seam at any zoom.
                      style={row > 0 ? { marginTop: "-0.05em" } : undefined}
                    >
                      {glyph}
                    </span>
                  ))}
                </button>
              </li>
            );
          })}
        </ol>
        <DayTooltip
          id={tooltipId}
          tip={tip}
          day={tip === null ? undefined : days[tip.index]}
          dates={dates}
          colors={palette}
        />
      </div>
      <div
        aria-hidden
        className="text-muted-foreground flex items-center gap-3 font-mono text-[0.6875rem]"
      >
        <span className="@md:hidden">{spans[0]} days ago</span>
        <span className="hidden @md:inline @2xl:hidden">
          {spans[1]} days ago
        </span>
        <span className="hidden @2xl:inline">{spans[2]} days ago</span>
        <span
          aria-hidden
          className="min-w-0 flex-1 overflow-hidden whitespace-nowrap opacity-60"
        >
          {"·".repeat(160)}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
};
