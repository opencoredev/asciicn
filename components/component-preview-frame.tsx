"use client";

import {
  ArrowShrink02Icon,
  FullScreenIcon,
  RefreshIcon,
  SlidersHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, UIEvent } from "react";

import { CopyButton } from "@/components/copy-button";
import { Icon } from "@/components/icon";
import {
  PreviewControlsPanel,
  PreviewControlsProvider,
} from "@/components/preview-controls";
import type { PreviewControlsLayout } from "@/components/preview-controls";
import { Ruler } from "@/components/terminal/ruler";
import { StatusBar, StatusItem } from "@/components/terminal/status-bar";
import { useFrameRate } from "@/components/terminal/use-frame-rate";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNearViewport } from "@/hooks/use-near-viewport";
import { measureCell, readCell, readFont } from "@/lib/ascii/measure";
import { pageContext, trackEvent } from "@/lib/events";
import type { PreviewControlSet, PreviewValue } from "@/lib/preview-controls";
import { cn } from "@/lib/utils";

/*
 * Direction: a terminal pane. One 1px-ruled frame holds a title row (mono
 * tabs with an ink underline, the demo's file name, tools), a column ruler
 * measured to the default glyph cell, the stage, and a status line with
 * the grid the stage holds (columns x rows at --ascii-cell) and the page
 * frame rate. The demo is the only thing with colour besides the ink.
 * Expand lifts the same pane to fill the window, knobs alongside.
 */

export type PreviewSize = "sm" | "md" | "lg" | "full";
export type PreviewAlign = "center" | "stretch";

const SIZE_CLASS = {
  full: "h-[420px] sm:h-[520px]",
  lg: "min-h-[440px] sm:min-h-[480px]",
  md: "min-h-[300px] sm:min-h-[360px]",
  sm: "min-h-[220px] sm:min-h-[260px]",
} as const satisfies Record<PreviewSize, string>;

// Safe centring keeps an over-wide demo's left edge in view, and
// `max-w-full` asks it to shrink to the stage before it overflows at all.
const ALIGN_CLASS = {
  center:
    "flex items-center-safe justify-center-safe p-6 sm:p-10 *:max-w-full *:min-w-0",
  stretch: "grid *:min-h-0 *:min-w-0",
} as const satisfies Record<PreviewAlign, string>;

/*
 * `overflow: clip` rather than `hidden`: a hidden box is still a scroll
 * container, so focus, find-in-page, a screen reader's cursor or a chart's
 * sr-only data table scrolled into view could slide the demo sideways and
 * leave it stuck there. A clipped box cannot scroll at all. Browsers
 * without `clip` keep `hidden`, and `pinScroll` undoes any scroll there.
 */
const STAGE_CLASS =
  "relative isolate w-full min-w-0 overflow-hidden supports-[overflow:clip]:overflow-clip supports-[overflow:clip]:[overflow-clip-margin:6px]";

const pinScroll = (event: UIEvent<HTMLDivElement>) => {
  const el = event.currentTarget;
  if (el.scrollLeft !== 0 || el.scrollTop !== 0) {
    el.scrollTo(0, 0);
  }
};

const TRIGGER_CLASS =
  "text-muted-foreground hover:text-foreground data-[state=active]:text-foreground relative h-full flex-none rounded-none border-0 border-r px-3 font-mono text-xs lowercase transition-colors duration-150 after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-(--ascii-ink) dark:data-[state=active]:border-0 dark:data-[state=active]:border-r dark:data-[state=active]:bg-transparent";

const TOOL_BUTTON =
  "text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-xs px-2 font-mono text-[11px] lowercase transition-[color,background-color,scale] duration-150 active:scale-[0.96]";

/**
 * Glyph cell width and height at the page's --ascii-cell and --ascii-font,
 * plus the columns and rows that fill `box`: what a component left on its
 * defaults draws, so the ruler ticks sit over its columns.
 */
const useStageGrid = (box: React.RefObject<HTMLDivElement | null>) => {
  const [grid, setGrid] = useState<{
    cellWidth: number;
    cellHeight: number;
    columns: number;
    rows: number;
  } | null>(null);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) {
      return;
    }
    const measure = () => {
      const metrics = measureCell({ cell: readCell(el), font: readFont(el) });
      setGrid({
        cellHeight: metrics.height,
        cellWidth: metrics.width,
        columns: Math.floor(el.clientWidth / metrics.width),
        rows: Math.floor(el.clientHeight / metrics.height),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [box]);

  return grid;
};

/** Visible from `sm` up; below that the button shows its icon only. */
const TOOL_LABEL = "max-sm:sr-only";

const ControlsButton = ({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    aria-expanded={open}
    onClick={onToggle}
    className={cn(TOOL_BUTTON, open && "text-foreground")}
  >
    <Icon icon={SlidersHorizontalIcon} className="size-3.5 sm:-ml-0.5" />
    <span className={TOOL_LABEL}>Controls</span>
  </button>
);

const ReplayButton = ({ onReplay }: { onReplay: () => void }) => (
  <button
    type="button"
    onClick={onReplay}
    className={cn("group/replay", TOOL_BUTTON)}
  >
    <Icon
      icon={RefreshIcon}
      className="size-3.5 transition-transform duration-300 ease-(--ease-out) group-active/replay:-rotate-90 motion-reduce:transition-none"
    />
    <span className={TOOL_LABEL}>Replay</span>
  </button>
);

// A slider sends one event when it settles, not one per frame of the drag.
const TWEAK_SETTLE_MS = 600;

const useDebouncedTweak = () => {
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) {
        clearTimeout(timer);
      }
    };
  }, []);
  return (controlName: string, value: PreviewValue) => {
    clearTimeout(timers.current.get(controlName));
    timers.current.set(
      controlName,
      setTimeout(() => {
        timers.current.delete(controlName);
        trackEvent({
          name: "shader_control_tweaked",
          properties: { ...pageContext(), control_name: controlName, value },
        });
      }, TWEAK_SETTLE_MS)
    );
  };
};

/** The charset knob's value, when the demo has one, for the status line. */
const charsetReadout = (
  controls: PreviewControlSet,
  values: Record<string, PreviewValue>
): string | null => {
  const control = controls.find((item) => item.id === "charset");
  return control ? String(values[control.id] ?? control.default) : null;
};

/** The pane's status line: live state, the cell grid, charset and fps. */
const StageStatus = ({
  live,
  grid,
  charset,
  fps,
}: {
  live: boolean;
  grid: ReturnType<typeof useStageGrid>;
  charset: string | null;
  fps: number | null;
}) => (
  <StatusBar
    left={
      <>
        <StatusItem
          live={live}
          value={live ? "live" : "idle"}
          tone={live ? "ink" : "muted"}
        />
        {grid ? (
          <StatusItem value={`${grid.columns}×${grid.rows}`} label="grid" />
        ) : null}
        {grid ? (
          <StatusItem
            label="cell"
            value={`${Math.round(grid.cellHeight)}px`}
            className="max-sm:hidden"
          />
        ) : null}
        {charset ? <StatusItem label="charset" value={charset} /> : null}
      </>
    }
    right={
      fps === null ? null : (
        <StatusItem label="fps" value={fps} className="max-sm:hidden" />
      )
    }
  />
);

export const ComponentPreviewFrame = ({
  children,
  code,
  codeHtml,
  file,
  size,
  align,
  controls,
  className,
}: {
  children: ReactNode;
  code: string | null;
  codeHtml: string | null;
  /** Demo file name shown in the title row. */
  file?: string;
  size: PreviewSize;
  align: PreviewAlign;
  controls?: PreviewControlSet;
  className?: string;
}) => {
  const [tab, setTab] = useState("preview");
  const [run, setRun] = useState(0);
  const [values, setValues] = useState<Record<string, PreviewValue>>({});
  const [panelOpen, setPanelOpen] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const { isNear, ref } = useNearViewport();
  const controlList = controls ?? [];
  const hasControls = controlList.length > 0;
  const showPanel = hasControls && panelOpen;
  const stageBox = useRef<HTMLDivElement>(null);
  const grid = useStageGrid(stageBox);
  const fps = useFrameRate({ enabled: isNear && tab === "preview" });
  const charset = charsetReadout(controlList, values);

  const trackTweak = useDebouncedTweak();
  const replay = () => setRun((count) => count + 1);
  const togglePanel = () => setPanelOpen((open) => !open);

  // One copy of the demo at a time: the inline stage empties while the
  // full-screen one is open, so a shader holds one WebGL context, not two.
  const demo = (
    <PreviewControlsProvider values={values}>
      <div key={run} className="contents">
        {children}
      </div>
    </PreviewControlsProvider>
  );

  const panel = (layout: PreviewControlsLayout) =>
    showPanel ? (
      <PreviewControlsPanel
        controls={controlList}
        values={values}
        onChange={(id, value) => {
          setValues((current) => ({ ...current, [id]: value }));
          trackTweak(id, value);
        }}
        onReset={() => setValues({})}
        layout={layout}
      />
    ) : null;

  return (
    <DialogPrimitive.Root open={expanded} onOpenChange={setExpanded}>
      <Tabs
        value={tab}
        onValueChange={setTab}
        className={cn(
          "bg-card text-card-foreground not-first:mt-6 gap-0 overflow-clip rounded-sm border [--ascii-paper:var(--card)]",
          className
        )}
      >
        <div className="flex h-9 items-stretch justify-between gap-3 border-b pr-1">
          <TabsList className="h-full gap-0 rounded-none bg-transparent p-0">
            <TabsTrigger value="preview" className={TRIGGER_CLASS}>
              Preview
            </TabsTrigger>
            {code ? (
              <TabsTrigger value="code" className={TRIGGER_CLASS}>
                Code
              </TabsTrigger>
            ) : null}
          </TabsList>
          {file ? (
            <span className="text-muted-foreground hidden min-w-0 items-center truncate font-mono text-[11px] md:flex">
              {file}
            </span>
          ) : null}
          {tab === "preview" ? (
            <div className="flex items-center gap-0.5">
              {hasControls ? (
                <ControlsButton open={panelOpen} onToggle={togglePanel} />
              ) : null}
              <ReplayButton onReplay={replay} />
              <DialogPrimitive.Trigger
                aria-label="Expand preview"
                title="Expand"
                className={TOOL_BUTTON}
              >
                <Icon icon={FullScreenIcon} className="size-3.5" />
                <span className={TOOL_LABEL} aria-hidden>
                  Expand
                </span>
              </DialogPrimitive.Trigger>
            </div>
          ) : (
            <span />
          )}
        </div>
        <TabsContent
          value="preview"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <Ruler
            cell={grid?.cellWidth ?? 7}
            className="border-b"
            cells={grid?.columns}
          />
          <div ref={stageBox} className="relative">
            <div
              ref={ref}
              onScroll={pinScroll}
              className={cn(STAGE_CLASS, SIZE_CLASS[size], ALIGN_CLASS[align])}
            >
              {isNear && !expanded ? demo : null}
            </div>
          </div>
          <StageStatus
            live={isNear && !expanded}
            grid={grid}
            charset={charset}
            fps={fps}
          />
          {expanded ? null : panel("tray")}
        </TabsContent>
        {code && codeHtml ? (
          <TabsContent value="code">
            <figure
              data-rehype-pretty-code-figure=""
              className="mx-0! mt-0! rounded-none! border-0! [&_pre]:max-h-[480px] [&_pre]:overflow-auto"
            >
              <CopyButton
                value={code}
                event="component_code_copied"
                eventProperties={{ section: "preview_code" }}
                className="top-2 right-2"
              />
              <div dangerouslySetInnerHTML={{ __html: codeHtml }} />
            </figure>
          </TabsContent>
        ) : null}
      </Tabs>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="bg-background/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 duration-200 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:zoom-out-[0.98] fixed inset-0 z-50 flex flex-col gap-3 overscroll-contain p-3 duration-200 ease-(--ease-out) outline-none motion-reduce:animate-none sm:p-4"
        >
          <div className="flex h-8 shrink-0 items-center justify-between gap-3 pl-2">
            <DialogPrimitive.Title className="label-caps text-muted-foreground">
              {file ?? "Preview"}
            </DialogPrimitive.Title>
            <div className="flex items-center">
              {hasControls ? (
                <ControlsButton open={panelOpen} onToggle={togglePanel} />
              ) : null}
              <ReplayButton onReplay={replay} />
              <DialogPrimitive.Close
                aria-label="Exit full screen"
                title="Exit full screen (Esc)"
                className={TOOL_BUTTON}
              >
                <Icon icon={ArrowShrink02Icon} className="size-3.5" />
                <span className={TOOL_LABEL} aria-hidden>
                  Close
                </span>
              </DialogPrimitive.Close>
            </div>
          </div>
          <div className="bg-card text-card-foreground flex min-h-0 flex-1 flex-col overflow-clip rounded-sm border [--ascii-paper:var(--card)] lg:flex-row">
            <div
              onScroll={pinScroll}
              className={cn(STAGE_CLASS, "min-h-0 flex-1", ALIGN_CLASS[align])}
            >
              {demo}
            </div>
            {showPanel ? (
              <div className="max-h-[42dvh] shrink-0 overflow-y-auto overscroll-contain border-t lg:max-h-none lg:w-80 lg:border-t-0 lg:border-l">
                {panel("sidebar")}
              </div>
            ) : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
