"use client";

/**
 * The stage: the live canvas framed like an instrument, with cell rulers
 * on two edges, a telemetry line under it and the glyph inspector, a loupe
 * that reads back whatever cell the pointer is over.
 */

import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode, RefObject } from "react";

import { StatusBar, StatusItem } from "@/components/stage-status";
import { cellRgb, cssToRgb } from "@/components/studio/frame-colors";
import { codePoint, glyphDensity } from "@/components/studio/inspector";
import type { Density } from "@/components/studio/inspector";
import { studioCharset } from "@/components/studio/media";
import type { StageNotice } from "@/components/studio/renderers";
import type { StudioSource } from "@/components/studio/sources";
import type { Look } from "@/components/studio/state";
import { useFrameRate } from "@/hooks/use-frame-rate";
import { CHARSETS } from "@/lib/ascii/charsets";
import type { AsciiFrame, AsciiHandle } from "@/lib/ascii/frame";
import { gridSize, measureCell, readFont } from "@/lib/ascii/measure";
import type { CellMetrics } from "@/lib/ascii/measure";
import { cn } from "@/lib/utils";

const COLOR_MODE_LABELS: Readonly<Record<Look["colorMode"], string>> = {
  ansi16: "ansi16",
  duotone: "duotone",
  mono: "mono",
  native: "native",
  truecolor: "truecolor",
};

export const charsetLabel = (look: Look): string =>
  look.charset === "custom"
    ? `custom (${[...look.chars].length})`
    : CHARSETS[look.charset].id;

interface Telemetry {
  readonly columns: number;
  readonly rows: number;
  /** Non-space glyphs in the latest frame, or `null` before one exists. */
  readonly glyphs: number | null;
  readonly metrics: CellMetrics;
}

const countGlyphs = (frame: AsciiFrame) => {
  let count = 0;
  for (const glyph of frame.glyphs) {
    if (glyph !== " " && glyph !== "") {
      count += 1;
    }
  }
  return count;
};

/** The renderer's metrics, or the ones it will use, measured here. */
const currentMetrics = (
  handle: AsciiHandle | null,
  viewport: HTMLElement,
  cell: number
): CellMetrics =>
  handle?.metrics() ?? measureCell({ cell, font: readFont(viewport) });

/** Grid size, glyph count and metrics, sampled twice a second. */
const useTelemetry = (
  viewportRef: RefObject<HTMLDivElement | null>,
  handle: RefObject<AsciiHandle | null>,
  cell: number
): Telemetry | null => {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  useEffect(() => {
    const sample = () => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const metrics = currentMetrics(handle.current, viewport, cell);
      const frame = handle.current?.capture() ?? null;
      const size = frame
        ? { columns: frame.columns, rows: frame.rows }
        : gridSize(metrics, viewport.clientWidth, viewport.clientHeight);
      setTelemetry((previous) => {
        const glyphs = frame ? countGlyphs(frame) : null;
        if (
          previous &&
          previous.columns === size.columns &&
          previous.rows === size.rows &&
          previous.glyphs === glyphs &&
          previous.metrics.width === metrics.width &&
          previous.metrics.height === metrics.height
        ) {
          return previous;
        }
        return { ...size, glyphs, metrics };
      });
    };
    sample();
    const timer = window.setInterval(sample, 500);
    return () => window.clearInterval(timer);
  }, [viewportRef, handle, cell]);
  return telemetry;
};

interface Inspection {
  readonly column: number;
  readonly row: number;
  readonly glyph: string;
  readonly color: string;
  /** Pointer position in the viewport, CSS px. */
  readonly x: number;
  readonly y: number;
}

const hex = ([r, g, b]: readonly [number, number, number]) =>
  `#${[r, g, b].map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`;

/** The cell under the pointer, read from the renderer's latest frame. */
const useInspector = (
  viewportRef: RefObject<HTMLDivElement | null>,
  handle: RefObject<AsciiHandle | null>,
  cell: number
): Inspection | null => {
  const [inspection, setInspection] = useState<Inspection | null>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    let frame: AsciiFrame | null = null;
    let capturedAt = 0;
    let raf = 0;
    let last: PointerEvent | null = null;

    const read = () => {
      raf = 0;
      const event = last;
      if (!event) {
        return;
      }
      const box = viewport.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const metrics = currentMetrics(handle.current, viewport, cell);
      const column = Math.floor(x / metrics.width);
      const row = Math.floor(y / metrics.height);
      // Capturing copies the frame (and may read the GPU back), so reuse
      // one capture for a tenth of a second.
      const now = performance.now();
      if (!frame || now - capturedAt > 100) {
        frame = handle.current?.capture() ?? null;
        capturedAt = now;
      }
      if (!frame || column >= frame.columns || row >= frame.rows) {
        setInspection(null);
        return;
      }
      const index = row * frame.columns + column;
      const glyph = frame.glyphs[index] ?? " ";
      const rgb = cellRgb(frame, index);
      const ink = handle.current?.colors().ink ?? "#ffffff";
      setInspection({
        color: hex(rgb ?? cssToRgb(ink)),
        column,
        glyph,
        row,
        x,
        y,
      });
    };
    const move = (event: PointerEvent) => {
      last = event;
      if (!raf) {
        raf = requestAnimationFrame(read);
      }
    };
    const leave = (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        last = null;
        setInspection(null);
      }
    };
    // The picture moves under a still pointer, so read the cell again
    // a few times a second.
    const timer = window.setInterval(() => {
      if (last && !raf) {
        raf = requestAnimationFrame(read);
      }
    }, 250);
    viewport.addEventListener("pointermove", move);
    viewport.addEventListener("pointerdown", move);
    viewport.addEventListener("pointerleave", leave);
    return () => {
      window.clearInterval(timer);
      cancelAnimationFrame(raf);
      viewport.removeEventListener("pointermove", move);
      viewport.removeEventListener("pointerdown", move);
      viewport.removeEventListener("pointerleave", leave);
    };
  }, [viewportRef, handle, cell]);
  return inspection;
};

const DENSITY_CELLS = 10;

const densityBar = (value: number) => {
  const eighths = Math.round(value * DENSITY_CELLS * 8);
  const full = Math.floor(eighths / 8);
  const parts = " ▏▎▍▌▋▊▉";
  return `${"█".repeat(full)}${full < DENSITY_CELLS ? (parts[eighths % 8] ?? " ") : ""}`.padEnd(
    DENSITY_CELLS,
    " "
  );
};

const densityLabel = (density: Density) => {
  if (density.kind === "level") {
    return `${Math.round(density.value * 100)}%`;
  }
  return density.kind === "edge" ? "edge" : "—";
};

const LOUPE_WIDTH = 176;
const LOUPE_HEIGHT = 112;

const GlyphLoupe = ({
  inspection,
  look,
  metrics,
  bounds,
}: {
  inspection: Inspection;
  look: Look;
  metrics: CellMetrics;
  bounds: { width: number; height: number };
}) => {
  const { column, row, glyph, color, x, y } = inspection;
  const density = glyphDensity(glyph, studioCharset(look.charset, look.chars));
  const flipX = x + 20 + LOUPE_WIDTH > bounds.width;
  const flipY = y + 20 + LOUPE_HEIGHT > bounds.height;
  const empty = glyph === " ";
  return (
    <>
      <div
        aria-hidden="true"
        className="outline-ink pointer-events-none absolute outline-1"
        style={{
          height: metrics.height,
          left: column * metrics.width,
          top: row * metrics.height,
          width: metrics.width,
        }}
      />
      <div
        aria-hidden="true"
        className="bg-popover/95 text-popover-foreground border-rule pointer-events-none absolute z-10 flex gap-3 rounded-[3px] border p-2 font-mono text-[11px] leading-[1.35] shadow-[0_8px_24px_-12px_oklch(0_0_0/0.5)] backdrop-blur-sm"
        style={{
          left: flipX ? x - 16 - LOUPE_WIDTH : x + 16,
          top: flipY ? y - 16 - LOUPE_HEIGHT : y + 16,
          width: LOUPE_WIDTH,
        }}
      >
        <div
          className="border-rule bg-background flex size-14 shrink-0 items-center justify-center rounded-[2px] border text-[34px] leading-none"
          style={{ color: empty ? undefined : color }}
        >
          {empty ? <span className="text-faint text-xs">space</span> : glyph}
        </div>
        <dl className="tabular grid min-w-0 grid-cols-[auto_1fr] gap-x-2">
          <dt className="text-faint">code</dt>
          <dd>{codePoint(glyph)}</dd>
          <dt className="text-faint">cell</dt>
          <dd>
            {column + 1},{row + 1}
          </dd>
          <dt className="text-faint">ink</dt>
          <dd className="truncate">{densityLabel(density)}</dd>
          <dt className="text-faint">rgb</dt>
          <dd className="flex items-center gap-1">
            <span
              className="inline-block size-2 shadow-[inset_0_0_0_1px_oklch(0_0_0/0.2)]"
              style={{ backgroundColor: color }}
            />
            {color}
          </dd>
        </dl>
        {density.kind === "level" ? (
          <div className="text-ink absolute right-2 bottom-1 left-2 overflow-hidden text-[9px] leading-none whitespace-pre">
            {densityBar(density.value)}
          </div>
        ) : null}
      </div>
    </>
  );
};

/** Drag-and-drop of one file onto the stage. Off when `onDropFile` is unset. */
const useFileDrop = (onDropFile: ((file: File) => void) | undefined) => {
  const [dragging, setDragging] = useState(false);
  if (!onDropFile) {
    return { dragging: false, handlers: {} };
  }
  return {
    dragging,
    handlers: {
      onDragLeave: () => setDragging(false),
      onDragOver: (event: DragEvent<HTMLDivElement>) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          setDragging(true);
        }
      },
      onDrop: (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        setDragging(false);
        const [file] = event.dataTransfer.files;
        if (file) {
          onDropFile(file);
        }
      },
    },
  };
};

/** The viewport's size in CSS pixels, for placing the loupe. */
const useBounds = (viewportRef: RefObject<HTMLDivElement | null>) => {
  const [bounds, setBounds] = useState({ height: 0, width: 0 });
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setBounds({ height: viewport.clientHeight, width: viewport.clientWidth })
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [viewportRef]);
  return bounds;
};

const NoticeOverlay = ({ notice }: { notice: StageNotice }) => {
  if (notice.kind === "none") {
    return null;
  }
  const error = notice.kind === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className="absolute inset-0 flex items-center justify-center p-6"
    >
      <p
        className={cn(
          "bg-background/90 border-rule max-w-sm rounded-[3px] border px-3 py-2 text-center text-xs text-pretty",
          error ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {error ? null : (
          <span aria-hidden="true" className="text-ink me-2">
            ⣾
          </span>
        )}
        {notice.message}
      </p>
    </div>
  );
};

const StageStatus = ({
  source,
  look,
  paused,
  telemetry,
  fps,
}: {
  source: StudioSource;
  look: Look;
  paused: boolean;
  telemetry: Telemetry | null;
  fps: number | null;
}) => (
  <StatusBar
    left={
      <>
        <StatusItem live={!paused} value={source.label.toLowerCase()} />
        {paused ? <StatusItem value="paused" tone="warn" /> : null}
      </>
    }
    right={
      <>
        <StatusItem label="charset" value={charsetLabel(look)} />
        <StatusItem
          value={telemetry ? `${telemetry.columns}×${telemetry.rows}` : "—"}
        />
        <StatusItem
          className="max-sm:hidden"
          label="fps"
          value={paused || fps === null ? "—" : fps}
          tone="ink"
        />
        <StatusItem
          className="max-sm:hidden"
          label="glyphs"
          value={telemetry?.glyphs?.toLocaleString("en-US") ?? "—"}
        />
        <StatusItem
          className="max-md:hidden"
          value={COLOR_MODE_LABELS[look.colorMode]}
        />
      </>
    }
  />
);

export const StageFrame = ({
  source,
  look,
  paused,
  handle,
  notice,
  fpsCap,
  onDropFile,
  children,
  className,
}: {
  source: StudioSource;
  look: Look;
  paused: boolean;
  handle: RefObject<AsciiHandle | null>;
  notice: StageNotice;
  /** The frame rate the renderer is capped at. */
  fpsCap: number;
  /** Set to accept dropped image and video files. */
  onDropFile?: (file: File) => void;
  children: ReactNode;
  className?: string;
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const telemetry = useTelemetry(viewportRef, handle, look.cell);
  const inspection = useInspector(viewportRef, handle, look.cell);
  const fps = useFrameRate({ enabled: !paused });
  const bounds = useBounds(viewportRef);
  const drop = useFileDrop(onDropFile);
  const metrics = telemetry?.metrics;

  return (
    <div
      className={cn(
        "bg-background grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]",
        className
      )}
    >
      <div
        ref={viewportRef}
        role="img"
        aria-label={`${source.label} drawn in ASCII`}
        className={cn(
          "relative min-h-0 cursor-crosshair overflow-hidden",
          look.background === "transparent" &&
            "bg-[conic-gradient(var(--muted)_25%,transparent_0_50%,var(--muted)_0_75%,transparent_0)] bg-[length:16px_16px]"
        )}
        {...drop.handlers}
      >
        {children}
        <NoticeOverlay notice={notice} />
        {drop.dragging ? (
          <div className="border-ink bg-background/70 absolute inset-2 flex items-center justify-center rounded-[3px] border border-dashed text-xs">
            Drop an image or video
          </div>
        ) : null}
        {inspection && metrics && notice.kind === "none" ? (
          <GlyphLoupe
            inspection={inspection}
            look={look}
            metrics={metrics}
            bounds={bounds}
          />
        ) : null}
      </div>
      <StageStatus
        source={source}
        look={look}
        paused={paused}
        telemetry={telemetry}
        fps={fps === null ? null : Math.min(fps, fpsCap)}
      />
    </div>
  );
};
