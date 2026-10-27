"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, PointerEvent, ReactNode, RefObject } from "react";

import { readGlyph } from "@/components/home/glyph-info";
import type { GlyphInfo } from "@/components/home/glyph-info";
import { usePointer, usePointerStore } from "@/components/home/pointer-store";
import type { PointerStore } from "@/components/home/pointer-store";
import { findSource, loadSource } from "@/components/home/sources";
import type { StageSource } from "@/components/home/sources";
import {
  STAGE_FPS,
  useFrameSampler,
  useStageProbe,
} from "@/components/home/use-stage-probe";
import type { StageProbe, StageState } from "@/components/home/use-stage-probe";
import { Ruler } from "@/components/terminal/ruler";
import { StatusBar, StatusItem } from "@/components/terminal/status-bar";
import { CHARSETS, eighthsBar, useDocumentVisible } from "@/lib/ascii";
import type {
  AsciiFrame,
  AsciiHandle,
  AsciiLook,
  CharsetName,
} from "@/lib/ascii";
import type { AsciiSceneProps } from "@/lib/ascii/scene";
import { cn } from "@/lib/utils";

/**
 * A live ASCII stage: one city or shader drawn by the engine, framed like
 * an instrument. Cell rulers run along the top and left, a status line
 * reports the charset, grid, frame rate and glyph count as they change,
 * and the inspector reads back the glyph under the pointer. Overlays
 * (headline, controls) go in `children`.
 */

type Loaded =
  | {
      readonly kind: "ready";
      readonly id: string;
      readonly Component: ComponentType<AsciiSceneProps>;
    }
  | { readonly kind: "failed"; readonly id: string };

const useLoadedSource = (source: StageSource): Loaded | null => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const Component = await loadSource(source);
        if (live) {
          setLoaded({ Component, id: source.id, kind: "ready" });
        }
      } catch {
        if (live) {
          setLoaded({ id: source.id, kind: "failed" });
        }
      }
    };
    load();
    return () => {
      live = false;
    };
  }, [source]);
  return loaded;
};

const STATE_LABEL = {
  loading: "loading",
  paused: "paused",
  running: "live",
  static: "still",
} as const satisfies Record<StageState, string>;

const formatCount = (value: number) => value.toLocaleString("en-US");

const StageNote = ({ children }: { children: ReactNode }) => (
  <p className="text-muted-foreground absolute top-3 left-3 z-10 font-mono text-[11px]">
    <span className="text-ink" aria-hidden>
      ▌
    </span>{" "}
    {children}
  </p>
);

const PointerRuler = ({
  store,
  probe,
  orientation,
}: {
  store: PointerStore;
  probe: StageProbe;
  orientation: "horizontal" | "vertical";
}) => {
  const at = usePointer(store);
  const horizontal = orientation === "horizontal";
  const index = horizontal ? at?.column : at?.row;
  const size = horizontal ? probe.cellWidth : probe.cellHeight;
  return (
    <div className="relative min-h-0 min-w-0">
      <Ruler
        orientation={orientation}
        variant="ticks"
        cell={size}
        highlight={index === undefined ? undefined : index + 1}
        className={cn(
          "border-rule",
          horizontal ? "border-b" : "w-4 border-r [&>span]:hidden"
        )}
      />
      {index === undefined ? null : (
        <span
          aria-hidden
          className={cn(
            "bg-ink pointer-events-none absolute",
            horizontal ? "bottom-0 h-1" : "right-0 w-1"
          )}
          style={
            horizontal
              ? { left: index * size, width: size }
              : { height: size, top: index * size }
          }
        />
      )}
    </div>
  );
};

/** A 1px box around the cell under the pointer. */
const CellCursor = ({
  store,
  probe,
}: {
  store: PointerStore;
  probe: StageProbe;
}) => {
  const at = usePointer(store);
  if (!at) {
    return null;
  }
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute top-0 left-0 z-10 outline outline-1 outline-white mix-blend-difference"
      style={{
        height: probe.cellHeight,
        transform: `translate(${at.column * probe.cellWidth}px, ${at.row * probe.cellHeight}px)`,
        width: probe.cellWidth,
      }}
    />
  );
};

const INSPECT_MS = 250;

// With no pointer, the inspector wanders: every few reads it jumps to a
// random inked cell, so it shows something worth reading.
const IDLE_READS = 6;

const randomInkedCell = (frame: AsciiFrame) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const column = Math.floor(Math.random() * frame.columns);
    const row = Math.floor(Math.random() * frame.rows);
    const glyph = frame.glyphs[row * frame.columns + column];
    if (glyph && glyph !== " " && glyph !== "\u2800") {
      return { column, row };
    }
  }
  return {
    column: Math.floor(frame.columns / 2),
    row: Math.floor(frame.rows / 2),
  };
};

interface InspectorView {
  readonly glyph: string;
  readonly code: string;
  readonly cell: string;
  /** No pointer: the inspector picked the cell itself. */
  readonly auto: boolean;
  readonly color: string;
  readonly colorLabel: string;
  /** A bar and a percentage, or a word when the glyph has no tone. */
  readonly density: { readonly bar: string; readonly percent: string } | string;
}

const inspectorView = (
  info: GlyphInfo | null,
  auto: boolean
): InspectorView => {
  if (!info) {
    return {
      auto,
      cell: "–:–",
      code: "U+----",
      color: "var(--ascii-ink)",
      colorLabel: "ink",
      density: "–",
      glyph: "·",
    };
  }
  const blank = info.glyph === " ";
  return {
    auto,
    cell: `${info.column + 1}:${info.row + 1}`,
    code: info.codePoint,
    color: info.color ?? "var(--ascii-ink)",
    // An empty cell's colour is never drawn.
    colorLabel: blank ? "–" : (info.color ?? "ink"),
    density:
      info.density === null
        ? "edge"
        : {
            bar: eighthsBar(info.density, 5),
            percent: `${Math.round(info.density * 100)}%`,
          },
    // A space draws nothing; the box stays empty.
    glyph: blank ? "" : info.glyph,
  };
};

const useInspectedGlyph = (
  store: PointerStore,
  sample: (maxAge: number) => AsciiFrame | null,
  charset: CharsetName
): { info: GlyphInfo | null; auto: boolean } => {
  const at = usePointer(store);
  const visible = useDocumentVisible();
  const [info, setInfo] = useState<GlyphInfo | null>(null);
  const sampleRef = useRef(sample);
  sampleRef.current = sample;
  const idle = useRef<{
    cell: { column: number; row: number };
    reads: number;
  } | null>(null);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const read = () => {
      const frame = sampleRef.current(INSPECT_MS / 2);
      if (!frame) {
        setInfo(null);
        return;
      }
      let cell = at;
      if (!cell) {
        if (!idle.current || idle.current.reads >= IDLE_READS) {
          idle.current = { cell: randomInkedCell(frame), reads: 0 };
        }
        idle.current.reads += 1;
        ({ cell } = idle.current);
      }
      setInfo(readGlyph(frame, cell.column, cell.row, charset));
    };
    read();
    const timer = setInterval(read, INSPECT_MS);
    return () => clearInterval(timer);
  }, [at, charset, visible]);

  return { auto: at === null, info };
};

const InspectorChip = ({
  view,
  className,
}: {
  view: InspectorView;
  className?: string;
}) => (
  <div
    aria-hidden
    className={cn(
      "bg-background/90 border-rule pointer-events-none absolute top-2 right-2 z-20 flex items-center gap-2 border py-1 pr-2 pl-1 font-mono text-[11px] backdrop-blur-sm",
      className
    )}
  >
    <span
      className="bg-ascii-paper border-rule grid size-7 place-items-center border text-lg leading-none"
      style={{ color: view.color }}
    >
      {view.glyph}
    </span>
    <span className="text-foreground tabular">{view.code}</span>
    <span className="text-muted-foreground tabular">
      {typeof view.density === "string" ? "" : view.density.percent}
    </span>
  </div>
);

const InspectorPanel = ({
  view,
  className,
}: {
  view: InspectorView;
  className?: string;
}) => (
  <section
    aria-label="Glyph inspector"
    className={cn(
      "bg-background/92 border-rule pointer-events-none absolute top-3 right-3 z-20 w-60 border font-mono text-[11px] backdrop-blur-sm",
      className
    )}
  >
    <header className="border-rule flex h-6 items-center justify-between border-b px-2.5">
      <span className="label-caps text-muted-foreground">Inspect</span>
      <span className="text-muted-foreground tabular">
        {view.auto ? <span className="text-faint">auto </span> : null}
        {view.cell}
      </span>
    </header>
    <div className="flex gap-3 p-2.5">
      <span
        aria-hidden
        className="bg-ascii-paper border-rule grid size-16 shrink-0 place-items-center border text-[40px] leading-none"
        style={{ color: view.color }}
      >
        {view.glyph}
      </span>
      <dl className="tabular grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] content-center gap-x-2.5 gap-y-1.5">
        <dt className="text-muted-foreground">code</dt>
        <dd className="text-foreground">{view.code}</dd>
        <dt className="text-muted-foreground">density</dt>
        <dd className="text-foreground truncate">
          {typeof view.density === "string" ? (
            view.density
          ) : (
            <>
              <span className="text-ink">{view.density.bar}</span>{" "}
              {view.density.percent}
            </>
          )}
        </dd>
        <dt className="text-muted-foreground">colour</dt>
        <dd className="text-foreground flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block size-2 shrink-0"
            style={{ background: view.color }}
          />
          <span className="truncate">{view.colorLabel}</span>
        </dd>
      </dl>
    </div>
  </section>
);

/**
 * The glyph under the pointer, its code point and the density it stands
 * for. With no pointer it reads the centre cell, so it is never empty.
 */
const GlyphInspector = ({
  store,
  sample,
  charset,
  variant,
}: {
  store: PointerStore;
  sample: (maxAge: number) => AsciiFrame | null;
  charset: CharsetName;
  variant: "panel" | "chip";
}) => {
  const { info, auto } = useInspectedGlyph(store, sample, charset);
  const view = inspectorView(info, auto);
  if (variant === "chip") {
    return <InspectorChip view={view} />;
  }
  // The full panel needs room; phones get the chip.
  return (
    <>
      <InspectorPanel view={view} className="hidden lg:block" />
      <InspectorChip view={view} className="lg:hidden" />
    </>
  );
};

const StageStatus = ({
  probe,
  store,
  sourceId,
  charset,
  cell,
  className,
}: {
  probe: StageProbe;
  store: PointerStore;
  sourceId: string;
  charset: CharsetName;
  cell: number;
  className?: string;
}) => {
  const at = usePointer(store);
  return (
    <StatusBar
      size="md"
      className={cn("bg-background", className)}
      left={
        <>
          <StatusItem
            live={probe.state === "running"}
            value={STATE_LABEL[probe.state]}
            tone={probe.state === "running" ? "ink" : "muted"}
          />
          <StatusItem
            className="hidden md:inline-flex"
            label="src"
            value={sourceId}
          />
          <StatusItem label="charset" value={CHARSETS[charset].id} />
          <StatusItem
            value={probe.columns > 0 ? `${probe.columns}×${probe.rows}` : "–×–"}
          />
          <StatusItem
            className="hidden sm:inline-flex"
            label="fps"
            value={probe.fps}
          />
          <StatusItem
            className="hidden sm:inline-flex"
            label="glyphs"
            value={probe.glyphs === null ? "–" : formatCount(probe.glyphs)}
          />
        </>
      }
      right={
        <>
          <StatusItem
            className="hidden lg:inline-flex"
            label="cell"
            value={`${cell}px`}
          />
          <StatusItem
            className="hidden md:inline-flex"
            label="at"
            value={at ? `${at.column + 1}:${at.row + 1}` : "–:–"}
          />
        </>
      }
    />
  );
};

export interface StageProps {
  /** What to draw. */
  source: StageSource;
  /** Look props passed straight to the component. */
  look: AsciiLook;
  /** The charset actually drawn (the look's, or the source's default). */
  charset: CharsetName;
  /** Glyph cell height in CSS px. */
  cell: number;
  /** Filled by the renderer; the export strip reads it too. */
  handle: RefObject<AsciiHandle | null>;
  /** Pointer steering and repulsion in the background. Default true. */
  interactive?: boolean;
  /** Inspector: a full panel, a compact chip, or none. Default "panel". */
  inspector?: "panel" | "chip" | "none";
  /** Classes for the drawing area; set its height here. */
  areaClassName?: string;
  className?: string;
  /** Overlays inside the drawing area. */
  children?: ReactNode;
}

export const Stage = ({
  source,
  look,
  charset,
  cell,
  handle,
  interactive = true,
  inspector = "panel",
  areaClassName,
  className,
  children,
}: StageProps) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const pointer = usePointerStore();
  const sample = useFrameSampler(handle);
  const probe = useStageProbe({ cell, handle, root: areaRef, sample });
  const loaded = useLoadedSource(source);
  const current =
    loaded?.kind === "ready" ? (findSource(loaded.id) ?? source) : source;

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const area = areaRef.current;
    if (!area) {
      return;
    }
    const rect = area.getBoundingClientRect();
    const column = Math.floor((event.clientX - rect.left) / probe.cellWidth);
    const row = Math.floor((event.clientY - rect.top) / probe.cellHeight);
    pointer.set(
      column >= 0 && row >= 0 && column < probe.columns && row < probe.rows
        ? { column, row }
        : null
    );
  };

  return (
    <div
      className={cn(
        "border-rule bg-background grid min-w-0 grid-cols-[auto_minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] border",
        className
      )}
    >
      <div aria-hidden className="border-rule size-4 border-r border-b" />
      <PointerRuler store={pointer} probe={probe} orientation="horizontal" />
      <PointerRuler store={pointer} probe={probe} orientation="vertical" />
      <div
        ref={areaRef}
        className={cn("bg-ascii-paper relative overflow-hidden", areaClassName)}
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={(event) => {
          // Touch keeps the last tapped cell so the inspector stays readable.
          if (event.pointerType === "mouse") {
            pointer.set(null);
          }
        }}
      >
        {loaded?.kind === "ready" ? (
          <loaded.Component
            key={loaded.id}
            className="absolute inset-0"
            cell={cell}
            fps={STAGE_FPS}
            handle={handle}
            interactive={interactive}
            {...look}
          />
        ) : null}
        {loaded === null || loaded.id !== source.id ? (
          <StageNote>
            {loaded?.kind === "failed"
              ? `couldn't load ${source.id}. reload to try again.`
              : `loading ${source.id}`}
          </StageNote>
        ) : null}
        <CellCursor store={pointer} probe={probe} />
        {inspector === "none" ? null : (
          <GlyphInspector
            store={pointer}
            sample={sample}
            charset={charset}
            variant={inspector}
          />
        )}
        {children}
      </div>
      <StageStatus
        className="col-span-2"
        probe={probe}
        store={pointer}
        sourceId={current.id}
        charset={charset}
        cell={cell}
      />
    </div>
  );
};
