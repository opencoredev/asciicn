"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, CSSProperties } from "react";

import {
  cssColor,
  frameLines,
  mapTones,
  resolveCharset,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor, CharsetName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Font size per cell height for DOM glyphs. Cascadia Mono's full block and
 * box lines are 1.17em tall, so at this size blocks and lines in
 * neighbouring rows touch instead of leaving a hairline between them.
 */
const GLYPH_EM = 1.17;

export interface MarqueeLogo {
  /** The image: an SVG or PNG whose shape is drawn in its alpha. */
  src: string;
  /** The brand name, read out by screen readers. */
  alt: string;
  /** Width over height. Set it to reserve the logo's space before it loads. Default 4. */
  ratio?: number;
  /** Makes the logo a link. */
  href?: string;
  /** This logo's glyph colour, overriding `color`. */
  color?: AsciiColor;
}

export interface LogoMarqueeProps extends Omit<
  ComponentProps<"div">,
  "children" | "color"
> {
  /** The logos, in order. */
  logos: readonly MarqueeLogo[];
  /** What the logos are, such as `"Customers"`, for screen readers. */
  label: string;
  /** `marquee` scrolls one row on a loop; `wall` shows them still, wrapped and centred. Default `"marquee"`. */
  variant?: "marquee" | "wall";
  /** Which way the row moves. Default `"left"`. */
  direction?: "left" | "right";
  /** Scroll speed in glyph cells per second. Default 8. */
  speed?: number;
  /** Height of each logo in rows of cells. Default 6. */
  rows?: number;
  /** Blank cells between logos. Default 8. */
  gap?: number;
  /** Glyphs to draw with. Default `"quadrants"`: solid 2x2 sub-cells that keep small type legible. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense. Wins over `charset`. */
  chars?: string;
  /** Glyph colour: a palette name or any CSS colour. Logos turn `--foreground` on hover. Default `"--muted-foreground"`. */
  color?: AsciiColor;
  /** Fade the row out at both ends. Default true. */
  fade?: boolean;
  /** Glyph cell height in CSS pixels. Default 10. */
  cell?: number;
}

const DEFAULT_RATIO = 4;
/** Canvas pixels per sample when rasterising a logo, for an area average. */
const SUPERSAMPLE = 4;

const loadImage = async (src: string): Promise<HTMLImageElement> => {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
};

/** Columns for a logo `rows` tall: cells are about half as wide as tall. */
const columnsFor = (ratio: number | undefined, rows: number): number =>
  Math.max(1, Math.round(rows * 2 * (ratio ?? DEFAULT_RATIO)));

/** Glyph art per logo and look, shared by every marquee on the page. */
const artCache = new Map<string, Promise<string[]>>();

/**
 * Draw the logo's alpha into a sample grid, area-averaged, and map it to
 * glyphs. The logo is fitted inside the grid with its aspect kept.
 */
const logoArt = ({
  src,
  columns,
  rows,
  charset,
  chars,
}: {
  src: string;
  columns: number;
  rows: number;
  charset: CharsetName;
  chars: string | undefined;
}): Promise<string[]> => {
  const key = [src, columns, rows, charset, chars ?? ""].join("|");
  const cached = artCache.get(key);
  if (cached) {
    return cached;
  }
  const rasterise = async (): Promise<string[]> => {
    const img = await loadImage(src);
    const [gx, gy] = resolveCharset(charset, chars).grid;
    const width = columns * gx;
    const height = rows * gy;
    const canvas = document.createElement("canvas");
    canvas.width = width * SUPERSAMPLE;
    canvas.height = height * SUPERSAMPLE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return [];
    }
    // Contain, keeping the logo's aspect. A cell is about twice as tall
    // as wide, so a canvas pixel is 2 * gx / gy times taller than wide.
    const ratio = img.naturalWidth / Math.max(1, img.naturalHeight);
    const pixelAspect = (2 * gx) / gy;
    let drawWidth = canvas.width;
    let drawHeight = drawWidth / ratio / pixelAspect;
    if (drawHeight > canvas.height) {
      drawWidth *= canvas.height / drawHeight;
      drawHeight = canvas.height;
    }
    context.drawImage(
      img,
      (canvas.width - drawWidth) / 2,
      (canvas.height - drawHeight) / 2,
      drawWidth,
      drawHeight
    );
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const tones = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let alpha = 0;
        for (let dy = 0; dy < SUPERSAMPLE; dy += 1) {
          for (let dx = 0; dx < SUPERSAMPLE; dx += 1) {
            const px = x * SUPERSAMPLE + dx;
            const py = y * SUPERSAMPLE + dy;
            alpha += data[(py * canvas.width + px) * 4 + 3] ?? 0;
          }
        }
        tones[y * width + x] = alpha / (SUPERSAMPLE * SUPERSAMPLE * 255);
      }
    }
    const frame = mapTones(
      { colors: null, height, tones, width },
      columns,
      rows,
      { chars, charset, threshold: 0.38 }
    );
    return frameLines(frame);
  };
  const job = (async () => {
    try {
      return await rasterise();
    } catch (error) {
      // A failed load can be retried by the next marquee that asks.
      artCache.delete(key);
      throw error;
    }
  })();
  artCache.set(key, job);
  return job;
};

const LogoArt = ({
  logo,
  rows,
  charset,
  chars,
  color,
}: {
  logo: MarqueeLogo;
  rows: number;
  charset: CharsetName;
  chars: string | undefined;
  color: AsciiColor;
}) => {
  const columns = columnsFor(logo.ratio, rows);
  const [lines, setLines] = useState<string[] | null>(null);
  useEffect(() => {
    let live = true;
    const draw = async () => {
      try {
        const art = await logoArt({
          chars,
          charset,
          columns,
          rows,
          src: logo.src,
        });
        if (live) {
          setLines(art);
        }
      } catch {
        // The logo keeps its reserved space, blank, if the image fails.
        if (live) {
          setLines(null);
        }
      }
    };
    void draw();
    return () => {
      live = false;
    };
  }, [chars, charset, columns, logo.src, rows]);

  return (
    <span
      className="block transition-colors duration-150 ease-out [@media(hover:hover)]:group-hover/logo:text-[var(--foreground)]"
      style={{
        color: cssColor(logo.color ?? color),
        height: `${rows}lh`,
        width: `${columns}ch`,
      }}
    >
      {lines ? lines.join("\n") : null}
    </span>
  );
};

/** One copy of the row. The second copy, which closes the loop, is hidden and inert. */
const LogoRow = ({
  logos,
  label,
  copy,
  gap,
  ...look
}: {
  logos: readonly MarqueeLogo[];
  label: string;
  copy: boolean;
  gap: number;
  rows: number;
  charset: CharsetName;
  chars: string | undefined;
  color: AsciiColor;
}) => (
  <ul
    aria-label={copy ? undefined : label}
    aria-hidden={copy ? true : undefined}
    inert={copy}
    className="m-0 flex shrink-0 list-none p-0"
  >
    {logos.map((logo) => {
      const art = <LogoArt logo={logo} {...look} />;
      return (
        <li
          key={`${logo.src}-${logo.alt}`}
          className="group/logo shrink-0"
          style={{ paddingRight: `${gap}ch` }}
        >
          {logo.href ? (
            <a
              href={logo.href}
              aria-label={logo.alt}
              className="focus-visible:outline-ring block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {art}
            </a>
          ) : (
            <span role="img" aria-label={logo.alt} className="block">
              {art}
            </span>
          )}
        </li>
      );
    })}
  </ul>
);

/**
 * Logos drawn as glyph art (quadrant blocks by default) in a row that scrolls on
 * a loop. Each logo is sampled from its image into a grid of cells and set
 * as text. The row pauses while hovered or focused, and stands still,
 * wrapped and centred, under reduced motion or with `variant="wall"`.
 */
export const LogoMarquee = ({
  logos,
  label,
  variant = "marquee",
  direction = "left",
  speed = 8,
  rows = 6,
  gap = 8,
  charset = "quadrants",
  chars,
  color = "--muted-foreground",
  fade = true,
  cell = 10,
  className,
  style,
  ...props
}: LogoMarqueeProps) => {
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const moving = variant === "marquee" && !reduced && speed > 0;
  const look = { chars, charset, color, rows };
  // One copy's width in cells: every logo plus the gap after it.
  const copyCells = logos.reduce(
    (sum, logo) => sum + columnsFor(logo.ratio, rows) + gap,
    0
  );

  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track || !moving) {
      return;
    }
    const frames =
      direction === "left"
        ? [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }]
        : [{ transform: "translateX(-50%)" }, { transform: "translateX(0)" }];
    const animation = track.animate(frames, {
      duration: (copyCells / speed) * 1000,
      easing: "linear",
      iterations: Number.POSITIVE_INFINITY,
    });
    const pause = () => animation.pause();
    const play = () => {
      if (!view.matches(":hover, :focus-within")) {
        animation.play();
      }
    };
    view.addEventListener("pointerenter", pause);
    view.addEventListener("pointerleave", play);
    view.addEventListener("focusin", pause);
    view.addEventListener("focusout", play);
    return () => {
      animation.cancel();
      view.removeEventListener("pointerenter", pause);
      view.removeEventListener("pointerleave", play);
      view.removeEventListener("focusin", pause);
      view.removeEventListener("focusout", play);
    };
  }, [copyCells, direction, moving, speed]);

  const text: CSSProperties = {
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${cell / GLYPH_EM}px`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${cell}px`,
    whiteSpace: "pre",
  };
  const mask =
    fade && moving
      ? "linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)"
      : undefined;

  if (!moving) {
    return (
      <div
        className={cn("w-full select-none", className)}
        style={{ ...text, ...style }}
        {...props}
      >
        <ul
          aria-label={label}
          className="m-0 flex list-none flex-wrap items-center justify-center p-0"
          style={{ columnGap: `${gap}ch`, rowGap: "2lh" }}
        >
          {logos.map((logo) => (
            <li key={`${logo.src}-${logo.alt}`} className="group/logo shrink-0">
              {logo.href ? (
                <a
                  href={logo.href}
                  aria-label={logo.alt}
                  className="focus-visible:outline-ring block rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  <LogoArt logo={logo} {...look} />
                </a>
              ) : (
                <span role="img" aria-label={logo.alt} className="block">
                  <LogoArt logo={logo} {...look} />
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      ref={viewRef}
      className={cn("w-full overflow-hidden select-none", className)}
      style={{ ...text, WebkitMaskImage: mask, maskImage: mask, ...style }}
      {...props}
    >
      <div ref={trackRef} className="flex w-max will-change-transform">
        <LogoRow logos={logos} label={label} copy={false} gap={gap} {...look} />
        <LogoRow logos={logos} label={label} copy gap={gap} {...look} />
      </div>
    </div>
  );
};
