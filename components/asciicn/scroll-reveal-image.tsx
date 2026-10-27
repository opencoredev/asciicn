"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  AsciiMedia,
  splitLook,
  useLoadedImage,
} from "@/components/asciicn/ascii-image";
import type {
  MediaDrawContext,
  MediaFit,
} from "@/components/asciicn/ascii-image";
import { usePrefersReducedMotion } from "@/lib/ascii";
import type {
  AsciiHandle,
  AsciiLook,
  CharsetName,
  ToneField,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * Where the scroll leads.
 * - `photo`: coarse glyphs sharpen into finer ones, then the photo fades in.
 * - `glyphs`: the same sharpening, ending on the finest glyphs.
 */
export type ScrollRevealTarget = "photo" | "glyphs";

/** One stage of the sweep: a cell size and the charset drawn at it. */
export interface RevealStage {
  readonly cell: number;
  readonly charset: CharsetName;
}

export interface ScrollRevealImageProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** Image URL. Cross-origin files need CORS headers. */
  src: string;
  /** What the image shows, read by screen readers. */
  alt: string;
  /** Where the sweep ends. Default `"photo"`. */
  to?: ScrollRevealTarget;
  /**
   * Cell sizes and charsets from first to last. Default: blocks at 28px,
   * then 20px and 14px classic, then 10px and 7px Braille. `charset`, when
   * set, replaces every stage's charset.
   */
  stages?: readonly RevealStage[];
  /** How the image fills its box. Default `"cover"`. */
  fit?: MediaFit;
  /**
   * The share of the viewport the image travels through while it
   * resolves, 0 to 1. Default 0.7: it finishes when its top edge is 30%
   * down the screen.
   */
  distance?: number;
  /** The scrolling element, when it isn't the page. Default: the window. */
  scrollRoot?: RefObject<Element | null>;
  /** Called with the progress, 0 to 1, as it changes. */
  onProgressChange?: (progress: number) => void;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

export const DEFAULT_STAGES = [
  { cell: 28, charset: "blocks" },
  { cell: 20, charset: "standard" },
  { cell: 14, charset: "standard" },
  { cell: 10, charset: "braille" },
  { cell: 7, charset: "braille" },
] as const satisfies readonly RevealStage[];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// The photo fades in over the last stretch of the scroll.
const PHOTO_FROM = 0.82;

/**
 * An image that resolves as it scrolls into view: coarse blocks sharpen
 * stage by stage into fine Braille, and (by default) the original photo
 * fades in at the end. Scroll back and it coarsens again.
 */
export const ScrollRevealImage = (props: ScrollRevealImageProps) => {
  const [
    look,
    {
      src,
      alt,
      to = "photo",
      stages = DEFAULT_STAGES,
      fit = "cover",
      distance = 0.7,
      scrollRoot,
      onProgressChange,
      handle,
      className,
      ...rest
    },
  ] = splitLook(props);
  const image = useLoadedImage(src);
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  const progress = useRef(0);
  const last = Math.max(0, stages.length - 1);
  const [stage, setStage] = useState(reducedMotion ? last : 0);
  const [moving, setMoving] = useState(false);
  const onProgress = useRef(onProgressChange);
  useEffect(() => {
    onProgress.current = onProgressChange;
  });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    if (reducedMotion) {
      progress.current = 1;
      setStage(last);
      photoRef.current?.style.setProperty("opacity", "1");
      onProgress.current?.(1);
      return;
    }
    const scroller = scrollRoot?.current ?? null;
    const target: Element | Window = scroller ?? window;
    let frame = 0;
    let idle = 0;
    const update = () => {
      frame = 0;
      const box = root.getBoundingClientRect();
      const frameBox = scroller?.getBoundingClientRect();
      const viewport = frameBox ? frameBox.height : window.innerHeight || 1;
      const top = box.top - (frameBox?.top ?? 0);
      const value = clamp01(
        (viewport - top) / (viewport * Math.max(0.1, distance))
      );
      if (value !== progress.current) {
        onProgress.current?.(value);
      }
      progress.current = value;
      setStage(Math.min(last, Math.floor((value / PHOTO_FROM) * (last + 1))));
      photoRef.current?.style.setProperty(
        "opacity",
        String(clamp01((value - PHOTO_FROM) / (1 - PHOTO_FROM)))
      );
      // Draw every frame while scrolling, then rest.
      setMoving(true);
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setMoving(false), 160);
    };
    const schedule = () => {
      if (!frame) {
        frame = requestAnimationFrame(update);
      }
    };
    update();
    target.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idle);
      target.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
    // Runs again once the image loads, so the photo starts at the right opacity.
  }, [distance, last, reducedMotion, scrollRoot, image.status]);

  // Within a stage, glyphs grow from sparse to full as it nears the next.
  const densify = (field: ToneField, _context: MediaDrawContext) => {
    const span = PHOTO_FROM / (last + 1);
    const within = clamp01((progress.current - stage * span) / span);
    const gain = 0.55 + 0.45 * Math.min(1, within * 1.6);
    if (gain >= 1) {
      return;
    }
    for (let index = 0; index < field.tones.length; index += 1) {
      field.tones[index] = (field.tones[index] ?? 0) * gain;
    }
  };

  const current = stages[Math.min(stage, last)] ?? DEFAULT_STAGES[0];

  return (
    <div
      ref={rootRef}
      role="img"
      aria-label={alt}
      className={cn("relative overflow-hidden", className)}
      {...rest}
    >
      <AsciiMedia
        {...look}
        charset={look.charset ?? current.charset}
        source={image.status === "ready" ? image.source : null}
        status={image.status}
        fit={fit}
        cell={current.cell}
        animate={moving}
        shape={reducedMotion ? undefined : densify}
        handle={handle}
        className="absolute inset-0"
      />
      {to === "photo" && image.status === "ready" ? (
        // oxlint-disable-next-line nextjs/no-img-element -- the photo must be the exact file the glyphs were sampled from.
        <img
          ref={photoRef}
          src={src}
          alt=""
          crossOrigin="anonymous"
          className="absolute inset-0 size-full"
          style={{
            objectFit: fit,
            // Scrolling sets the opacity directly; this is only the start.
            opacity: reducedMotion ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  );
};
