"use client";

import { useMemo, useRef, useState } from "react";
import type { ComponentProps, PointerEvent } from "react";

import {
  GlyphRows,
  PLOT_SUBCELLS,
  createRaster,
  plotDot,
  plotLine,
  putGlyph,
  rasterCells,
  useCellBox,
} from "@/components/asciicn/glyph-plot";
import type { DotRaster, GlyphCells } from "@/components/asciicn/glyph-plot";
import { landCoverage } from "@/components/asciicn/world-land";
import type { LatLon } from "@/components/asciicn/world-land";
import { cssColor, MOTION, useFrameLoop } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export type { LatLon } from "@/components/asciicn/world-land";

/** A pulsing location on the map. */
export interface DotMapMarker {
  /** Where it is: `[lat, lon]` in degrees. */
  at: LatLon;
  /** Short text shown beside the marker, in the tooltip and to screen readers. */
  label?: string;
  /** A line of detail for the tooltip, such as `"12 ms"`. */
  detail?: string;
  /** Colour of the marker, its rings and its halo. Default: the map's `accent`. */
  color?: AsciiColor;
}

/** A dotted arc between two places, lifted into a curve. */
export interface DotMapArc {
  from: LatLon;
  to: LatLon;
  /** Default: the map's `accent`. */
  color?: AsciiColor;
}

/** The part of the world to draw, in degrees. */
export interface DotMapBounds {
  north: number;
  south: number;
  west: number;
  east: number;
}

/** Land inside `bounds` drawn in `color`, such as a sales region. */
export interface DotMapRegion {
  bounds: DotMapBounds;
  color: AsciiColor;
  /** Read by screen readers with the map's name. */
  label?: string;
}

export type DotMapProps = Omit<ComponentProps<"div">, "children" | "title"> & {
  /** Locations to mark. */
  markers?: readonly DotMapMarker[];
  /** Connections between locations. */
  arcs?: readonly DotMapArc[];
  /** Areas of land to highlight. */
  regions?: readonly DotMapRegion[];
  /** `braille`: land as a fine field of 2x4 dots. `halftone`: one dot glyph per cell, sized by how much land it covers. Default `braille`. */
  glyphs?: "braille" | "halftone";
  /** Colour of the land. Default `"grey"`. */
  color?: AsciiColor;
  /** Colour of markers, halos and arcs unless they set their own. Default `"ink"`. */
  accent?: AsciiColor;
  /** Radius in degrees of land tinted around each marker. 0 turns it off. Default 8. */
  halo?: number;
  /** Share of sea dots drawn faintly, 0 to 1. Default 0. */
  ocean?: number;
  /** Show marker labels beside the markers. Default true. */
  labels?: boolean;
  /** The region to draw. Default the inhabited world: 78°N to 56°S, all longitudes. */
  bounds?: DotMapBounds;
  /** Pulse rings out of the markers and run light along the arcs. Still under reduced motion. Default true. */
  animate?: boolean;
  /** Glyph cell height in CSS pixels. Default `--ascii-cell`, or 12. */
  cell?: number;
  /** Accessible name. Marker labels are appended. Default `"World map"`. */
  title?: string;
};

const WORLD: DotMapBounds = { east: 180, north: 78, south: -56, west: -180 };
const NO_MARKERS: readonly DotMapMarker[] = [];
const NO_ARCS: readonly DotMapArc[] = [];
const NO_REGIONS: readonly DotMapRegion[] = [];

// Owners on the land layer.
const LAND = 1;
const SEA = 2;
const REGION = 3;
/** Halo of marker `i` is `HALO + i`. */
const HALO = 40;
const MAX_REGIONS = HALO - REGION;
const MAX_MARKERS = 255 - HALO;

// Owners on the overlay layer: marker `i` is `1 + i`, arc `j` is `ARC + j`.
const ARC = 128;

/** Seconds for a ring to travel out and fade. */
const PULSE_SECONDS = 2.4;
/** Seconds for light to run the length of an arc. */
const RUN_SECONDS = 2.8;
const HALFTONE = [" ", "·", "•", "●"] as const;

/** Map geometry: whole cells, and degrees per dot. */
interface Grid {
  columns: number;
  rows: number;
  bounds: DotMapBounds;
  /** Degrees of longitude and latitude per dot. */
  lonStep: number;
  latStep: number;
}

const makeGrid = ({
  width,
  cell,
  aspect,
  bounds,
}: {
  width: number;
  cell: number;
  aspect: number;
  bounds: DotMapBounds;
}): Grid => {
  const [gx, gy] = PLOT_SUBCELLS.braille;
  const cellWidth = cell * aspect;
  const columns = Math.max(16, Math.floor(width / cellWidth));
  const lonStep = (bounds.east - bounds.west) / (columns * gx);
  // Dots are almost square; keep the map's proportions on screen.
  const latStep = lonStep * (cell / gy / (cellWidth / gx));
  const rows = Math.max(
    2,
    Math.round((bounds.north - bounds.south) / latStep / gy)
  );
  return {
    bounds,
    columns,
    latStep: (bounds.north - bounds.south) / (rows * gy),
    lonStep,
    rows,
  };
};

/** A place in dot units. */
const project = (grid: Grid, [lat, lon]: LatLon): [number, number] => [
  (lon - grid.bounds.west) / grid.lonStep - 0.5,
  (grid.bounds.north - lat) / grid.latStep - 0.5,
];

/** A cheap, stable hash of a dot to [0, 1), for the sea scatter. */
const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43_758.545;
  return value - Math.floor(value);
};

const within = (bounds: DotMapBounds, lat: number, lon: number) =>
  lat <= bounds.north &&
  lat >= bounds.south &&
  lon >= bounds.west &&
  lon <= bounds.east;

/** Great-circle-ish distance in degrees, good enough for halos. */
const degreesApart = ([lat1, lon1]: LatLon, lat2: number, lon2: number) => {
  const dLon =
    (((lon2 - lon1 + 540) % 360) - 180) * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(lat2 - lat1, dLon);
};

/** The land layer: who owns each dot. Recomputed only when the map changes. */
const drawLand = ({
  grid,
  regions,
  markers,
  halo,
  ocean,
}: {
  grid: Grid;
  regions: readonly DotMapRegion[];
  markers: readonly DotMapMarker[];
  halo: number;
  ocean: number;
}): DotRaster => {
  const raster = createRaster({
    columns: grid.columns,
    glyphs: "braille",
    rows: grid.rows,
  });
  const shownRegions = regions.slice(0, MAX_REGIONS);
  const shownMarkers = markers.slice(0, MAX_MARKERS);
  for (let y = 0; y < raster.height; y += 1) {
    const lat = grid.bounds.north - (y + 0.5) * grid.latStep;
    for (let x = 0; x < raster.width; x += 1) {
      const lon = grid.bounds.west + (x + 0.5) * grid.lonStep;
      const index = y * raster.width + x;
      if (landCoverage(lat, lon) < 0.5) {
        if (ocean > 0 && hash(x, y) < ocean) {
          raster.owners[index] = SEA;
        }
        continue;
      }
      let owner = LAND;
      for (const [region, entry] of shownRegions.entries()) {
        if (within(entry.bounds, lat, lon)) {
          owner = REGION + region;
        }
      }
      if (halo > 0) {
        for (const [marker, entry] of shownMarkers.entries()) {
          if (degreesApart(entry.at, lat, lon) < halo) {
            owner = HALO + marker;
          }
        }
      }
      raster.owners[index] = owner;
    }
  }
  return raster;
};

/** Land as halftone glyphs: one dot per cell, sized by its share of land. */
const halftoneCells = (raster: DotRaster): GlyphCells => {
  const braille = rasterCells(raster);
  const [gx, gy] = PLOT_SUBCELLS.braille;
  for (let row = 0; row < raster.rows; row += 1) {
    for (let column = 0; column < raster.columns; column += 1) {
      let filled = 0;
      for (let dy = 0; dy < gy; dy += 1) {
        for (let dx = 0; dx < gx; dx += 1) {
          const owner =
            raster.owners[(row * gy + dy) * raster.width + column * gx + dx] ??
            0;
          if (owner !== 0 && owner !== SEA) {
            filled += 1;
          }
        }
      }
      const index = row * raster.columns + column;
      const owner = braille.owners[index] ?? 0;
      const level = Math.round((filled / (gx * gy)) * (HALFTONE.length - 1));
      const glyph = owner === SEA ? "·" : (HALFTONE[level] ?? " ");
      putGlyph(braille, column, row, glyph, glyph === " " ? 0 : owner);
    }
  }
  return braille;
};

/**
 * The fractional part, always in [0, 1). The frame clock can start a hair
 * below zero, and `%` keeps the sign.
 */
const cycle = (value: number) => {
  const fraction = value % 1;
  return fraction < 0 ? fraction + 1 : fraction;
};

/** A point on the arc's curve at `t`, in dot units: lifted toward the pole side. */
const arcPoint = (
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] => {
  const lift = Math.hypot(to[0] - from[0], to[1] - from[1]) * 0.28;
  const cx = (from[0] + to[0]) / 2;
  const cy = (from[1] + to[1]) / 2 - lift;
  const u = 1 - t;
  return [
    u * u * from[0] + 2 * u * t * cx + t * t * to[0],
    u * u * from[1] + 2 * u * t * cy + t * t * to[1],
  ];
};

/** Markers, their pulse rings and the arcs, drawn over the land each frame. */
const drawOverlay = ({
  grid,
  markers,
  arcs,
  time,
  moving,
}: {
  grid: Grid;
  markers: readonly DotMapMarker[];
  arcs: readonly DotMapArc[];
  time: number;
  moving: boolean;
}) => {
  const raster = createRaster({
    columns: grid.columns,
    glyphs: "braille",
    rows: grid.rows,
  });
  for (const [index, arc] of arcs.slice(0, 255 - ARC).entries()) {
    const from = project(grid, arc.from);
    const to = project(grid, arc.to);
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]) * 1.15;
    const steps = Math.max(8, Math.ceil(length));
    // Every third dot along the curve, so the arc reads as a dotted line.
    for (let step = 0; step <= steps; step += 3) {
      const [x, y] = arcPoint(from, to, step / steps);
      plotDot(raster, x, y, ARC + index);
    }
    if (moving) {
      const head = cycle(time / RUN_SECONDS + index * 0.37) * 1.2;
      let previous = arcPoint(from, to, Math.max(0, head - 0.12));
      for (let part = 1; part <= 4; part += 1) {
        const t = Math.min(1, Math.max(0, head - 0.12 + (part * 0.12) / 4));
        const next = arcPoint(from, to, t);
        plotLine(raster, previous, next, ARC + index);
        previous = next;
      }
    }
  }
  for (const [index, marker] of markers.slice(0, ARC - 1).entries()) {
    const [x, y] = project(grid, marker.at);
    const owner = 1 + index;
    // The marker: a solid block of dots two wide and three tall.
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = 0; dx <= 1; dx += 1) {
        plotDot(raster, x + dx - 0.5, y + dy, owner);
      }
    }
    // A ring that travels out and thins as it goes, so it fades without opacity.
    const phase = moving ? cycle(time / PULSE_SECONDS + index * 0.21) : 0.55;
    const radius = 2.5 + phase * 7;
    const steps = Math.ceil(Math.PI * 2 * radius);
    const every = 1 + Math.min(2, Math.floor(phase * 3));
    for (let step = 0; step < steps; step += every) {
      const angle = (step / steps) * Math.PI * 2;
      plotDot(
        raster,
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        owner
      );
    }
  }
  return rasterCells(raster);
};

/** The accessible name: the title, then marker and region labels. */
const mapName = (
  title: string,
  markers: readonly DotMapMarker[],
  regions: readonly DotMapRegion[]
) => {
  const named = markers.flatMap((marker) => marker.label ?? []);
  const regionNames = regions.flatMap((region) => region.label ?? []);
  return [
    title,
    named.length > 0 ? `markers: ${named.join(", ")}` : "",
    regionNames.length > 0 ? `highlighted: ${regionNames.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("; ");
};

type Pixels = (at: LatLon) => { x: number; y: number };

/**
 * Focusable buttons over the markers, their labels snapped to the cell
 * grid, and the tooltip of the active one.
 */
const MarkerLayer = ({
  markers,
  toPixels,
  cellWidth,
  cell,
  mapWidth,
  labels,
  active,
  onActive,
  tint,
}: {
  markers: readonly DotMapMarker[];
  toPixels: Pixels;
  cellWidth: number;
  cell: number;
  mapWidth: number;
  labels: boolean;
  active: number | null;
  onActive: (index: number | null) => void;
  tint: (index: number) => string;
}) => {
  const current = active === null ? undefined : markers[active];
  const tip = current ? toPixels(current.at) : null;
  return (
    <>
      {markers.map((marker, index) => {
        const { x, y } = toPixels(marker.at);
        const label = marker.label ?? `${marker.at[0]}, ${marker.at[1]}`;
        return (
          <button
            // oxlint-disable-next-line react/no-array-index-key -- markers may share a place and have no id.
            key={index}
            type="button"
            aria-label={marker.detail ? `${label}, ${marker.detail}` : label}
            onFocus={() => onActive(index)}
            onBlur={() => onActive(null)}
            className="focus-visible:outline-ring absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full outline-offset-2 focus-visible:outline-2"
            style={{ left: x, top: y }}
          />
        );
      })}
      {markers.map((marker, index) => {
        if (!(labels && marker.label)) {
          return null;
        }
        const { x, y } = toPixels(marker.at);
        return (
          <span
            // oxlint-disable-next-line react/no-array-index-key -- see the marker buttons.
            key={index}
            aria-hidden="true"
            className="text-foreground pointer-events-none absolute font-mono text-[0.625rem] whitespace-nowrap"
            style={{
              // Snapped to the cell grid, one cell right of the marker.
              left: (Math.round(x / cellWidth) + 1) * cellWidth,
              lineHeight: `${cell}px`,
              opacity: active !== null && active !== index ? 0.4 : 1,
              top: Math.floor(y / cell) * cell,
            }}
          >
            {marker.label}
          </span>
        );
      })}
      {tip && current && (current.label || current.detail) ? (
        <div
          aria-hidden="true"
          className="bg-popover/95 text-popover-foreground border-border pointer-events-none absolute z-10 flex -translate-x-1/2 flex-col gap-0.5 rounded-md border px-2.5 py-1.5 font-mono text-xs whitespace-nowrap shadow-[0_8px_24px_-12px_rgb(0_0_0/0.6)] backdrop-blur-sm"
          style={{
            left: Math.min(Math.max(tip.x, 64), mapWidth - 64),
            top: tip.y + cell * 1.25,
          }}
        >
          <span className="flex items-center gap-2">
            <span style={{ color: tint(active ?? 0) }}>⣿</span>
            <span className="text-foreground">{current.label}</span>
          </span>
          {current.detail ? (
            <span className="text-muted-foreground">{current.detail}</span>
          ) : null}
        </div>
      ) : null}
    </>
  );
};

/**
 * A flat world map in Braille dots (or halftone dot glyphs), with markers
 * that pulse rings outward, dotted arcs with light running along them,
 * tinted halos and highlighted regions. Hover or focus a marker for its
 * tooltip. Land comes from the `world-land` mask, so nothing is fetched.
 */
export const DotMap = ({
  markers = NO_MARKERS,
  arcs = NO_ARCS,
  regions = NO_REGIONS,
  glyphs = "braille",
  color = "grey",
  accent = "ink",
  halo = 8,
  ocean = 0,
  labels = true,
  bounds = WORLD,
  animate = true,
  cell,
  title = "World map",
  className,
  ...props
}: DotMapProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const box = useCellBox(ref, cell);
  const [time, setTime] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const loop = useFrameLoop((now) => setTime(now), {
    enabled: animate && (markers.length > 0 || arcs.length > 0),
    fps: 20,
    target: ref,
  });
  const width = box.width > 0 ? box.width : 720;
  const grid = makeGrid({ aspect: box.aspect, bounds, cell: box.cell, width });
  const { north, south, east, west } = bounds;
  const land = useMemo(
    () =>
      drawLand({
        grid: makeGrid({
          aspect: box.aspect,
          bounds: { east, north, south, west },
          cell: box.cell,
          width,
        }),
        halo,
        markers,
        ocean,
        regions,
      }),
    [
      box.aspect,
      box.cell,
      width,
      north,
      south,
      east,
      west,
      halo,
      markers,
      ocean,
      regions,
    ]
  );
  // The land is the heavy layer: it re-renders only when the map changes,
  // not on every animation frame.
  const landLayer = useMemo(() => {
    const cells =
      glyphs === "halftone" ? halftoneCells(land) : rasterCells(land);
    const tint = (index: number) => cssColor(markers[index]?.color ?? accent);
    const paint = (owner: number) => {
      if (owner === LAND) {
        return { color: cssColor(color), opacity: 0.75 };
      }
      if (owner === SEA) {
        return { color: cssColor(color), opacity: 0.3 };
      }
      if (owner >= HALO) {
        return { color: tint(owner - HALO), opacity: 0.85 };
      }
      return { color: cssColor(regions[owner - REGION]?.color ?? accent) };
    };
    return <GlyphRows cells={cells} cell={box.cell} paint={paint} />;
  }, [land, glyphs, markers, accent, color, regions, box.cell]);
  const overlay = drawOverlay({
    arcs,
    grid,
    markers,
    moving: loop === "running",
    time,
  });

  const cellWidth = box.cell * box.aspect;
  const toPixels = (at: LatLon) => {
    const [x, y] = project(grid, at);
    const [gx, gy] = PLOT_SUBCELLS.braille;
    return {
      x: ((x + 0.5) / gx) * cellWidth,
      y: ((y + 0.5) / gy) * box.cell,
    };
  };
  const markerColor = (index: number) =>
    cssColor(markers[index]?.color ?? accent);

  const paintOverlay = (owner: number) => {
    if (owner >= ARC) {
      return { color: cssColor(arcs[owner - ARC]?.color ?? accent) };
    }
    const index = owner - 1;
    return {
      color: markerColor(index),
      opacity: active !== null && active !== index ? 0.35 : 1,
      transition: `opacity ${MOTION.fast}ms`,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    let best: number | null = null;
    let nearest = box.cell * 1.5;
    for (const [index, marker] of markers.entries()) {
      const { x, y } = toPixels(marker.at);
      const distance = Math.hypot(px - x, py - y);
      if (distance < nearest) {
        nearest = distance;
        best = index;
      }
    }
    setActive(best);
  };

  const mapWidth = grid.columns * cellWidth;

  return (
    <div
      ref={ref}
      role="group"
      aria-label={mapName(title, markers, regions)}
      className={cn("relative w-full", className)}
      {...props}
    >
      <div
        className="relative mx-auto"
        style={{ height: grid.rows * box.cell, width: mapWidth }}
        onPointerMove={markers.length > 0 ? onPointerMove : undefined}
        onPointerLeave={() => setActive(null)}
      >
        {landLayer}
        <GlyphRows
          cells={overlay}
          cell={box.cell}
          paint={paintOverlay}
          className="pointer-events-none absolute inset-0"
        />
        <MarkerLayer
          markers={markers}
          toPixels={toPixels}
          cellWidth={cellWidth}
          cell={box.cell}
          mapWidth={mapWidth}
          labels={labels}
          active={active}
          onActive={setActive}
          tint={markerColor}
        />
      </div>
    </div>
  );
};
