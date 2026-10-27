"use client";

import { useEffect, useRef } from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";

import {
  AsciiMedia,
  splitLook,
  useLoadedImage,
} from "@/components/asciicn/ascii-image";
import type { MediaFit } from "@/components/asciicn/ascii-image";
import type { AsciiHandle, AsciiLook } from "@/lib/ascii";
import { cn } from "@/lib/utils";

export interface ImageCompareProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children" | "defaultValue"> {
  /** Image URL. Cross-origin files need CORS headers. */
  src: string;
  /** What the image shows, read by screen readers. */
  alt: string;
  /**
   * The right-hand side: `"photo"` for the original file, or a second look
   * to compare against the first. Default `"photo"`.
   */
  against?: "photo" | AsciiLook;
  /** Captions for the left and right sides. Default `["ascii", "photo"]`. */
  labels?: readonly [string, string];
  /** Where the divider starts, 0 (left) to 1 (right). Default 0.5. */
  defaultPosition?: number;
  /** Called as the divider moves, with its position from 0 to 1. */
  onPositionChange?: (position: number) => void;
  /** How the image fills its box. Default `"cover"`. */
  fit?: MediaFit;
  /** Stretch the image's tones to use the whole ramp. Default `true`. */
  autoLevels?: boolean;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** Filled with a handle for the left-hand glyphs, for export. */
  handle?: RefObject<AsciiHandle | null>;
}

const DEFAULT_LABELS = ["ascii", "photo"] as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const KEY_STEPS: Partial<Record<string, (position: number) => number>> = {
  ArrowDown: (position) => position - 0.02,
  ArrowLeft: (position) => position - 0.02,
  ArrowRight: (position) => position + 0.02,
  ArrowUp: (position) => position + 0.02,
  End: () => 1,
  Home: () => 0,
  PageDown: (position) => position - 0.1,
  PageUp: (position) => position + 0.1,
};

/**
 * A before and after slider: glyphs on the left, the photo (or a second
 * look) on the right. Drag anywhere, or focus the handle and use the
 * arrow keys. The divider moves without re-rendering, so both sides stay
 * at full frame rate while you drag.
 */
export const ImageCompare = (props: ImageCompareProps) => {
  const [
    look,
    {
      src,
      alt,
      against = "photo",
      labels = DEFAULT_LABELS,
      defaultPosition = 0.5,
      onPositionChange,
      fit = "cover",
      autoLevels = true,
      cell = 10,
      handle,
      className,
      style,
      ...rest
    },
  ] = splitLook(props);
  const image = useLoadedImage(src);
  const rootRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const position = useRef(clamp01(defaultPosition));
  const onChange = useRef(onPositionChange);
  useEffect(() => {
    onChange.current = onPositionChange;
  });

  const place = (next: number) => {
    const value = clamp01(next);
    position.current = value;
    rootRef.current?.style.setProperty("--compare", `${value * 100}%`);
    thumbRef.current?.setAttribute(
      "aria-valuenow",
      String(Math.round(value * 100))
    );
    thumbRef.current?.setAttribute(
      "aria-valuetext",
      `${Math.round(value * 100)}% ${labels[0]}`
    );
    onChange.current?.(value);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }
    let dragging = false;
    const at = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      place((event.clientX - box.left) / box.width);
    };
    const down = (event: PointerEvent) => {
      dragging = true;
      root.setPointerCapture(event.pointerId);
      at(event);
    };
    const move = (event: PointerEvent) => {
      if (dragging) {
        at(event);
      }
    };
    const up = () => {
      dragging = false;
    };
    root.addEventListener("pointerdown", down);
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerup", up);
    root.addEventListener("pointercancel", up);
    return () => {
      root.removeEventListener("pointerdown", down);
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerup", up);
      root.removeEventListener("pointercancel", up);
    };
    // `place` only reads refs and the labels.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (step) {
      event.preventDefault();
      place(step(position.current));
    }
  };

  const source = image.status === "ready" ? image.source : null;
  const shared = {
    autoLevels,
    cell,
    fit,
    source,
    status: image.status,
  } as const;
  const start = Math.round(position.current * 100);

  let right: ReactNode = null;
  if (against !== "photo") {
    right = (
      <AsciiMedia {...shared} {...against} className="absolute inset-0" />
    );
  } else if (image.status === "ready") {
    right = (
      // oxlint-disable-next-line nextjs/no-img-element -- the photo must be the exact file the glyphs were sampled from.
      <img
        src={src}
        alt=""
        crossOrigin="anonymous"
        draggable={false}
        className="absolute inset-0 size-full"
        style={{ objectFit: fit }}
      />
    );
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={alt}
      aria-roledescription="image comparison"
      className={cn(
        "group/compare relative cursor-ew-resize touch-pan-y overflow-hidden select-none",
        className
      )}
      style={{ "--compare": `${start}%`, ...style } as CSSProperties}
      {...rest}
    >
      {right}
      <AsciiMedia
        {...shared}
        {...look}
        handle={handle}
        className="absolute inset-0"
        style={{ clipPath: "inset(0 calc(100% - var(--compare)) 0 0)" }}
      />

      <span className="pointer-events-none absolute top-2 left-2 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-foreground uppercase tracking-wider">
        {labels[0]}
      </span>
      <span className="pointer-events-none absolute top-2 right-2 bg-background/80 px-1.5 py-0.5 font-mono text-[11px] text-foreground uppercase tracking-wider">
        {labels[1]}
      </span>

      <div
        className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/80"
        style={{ left: "var(--compare)" }}
      />
      <div
        ref={thumbRef}
        role="slider"
        tabIndex={0}
        aria-label={`Divider between ${labels[0]} and ${labels[1]}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={start}
        aria-valuetext={`${start}% ${labels[0]}`}
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 border border-foreground/80 bg-background px-1.5 py-0.5 font-mono text-foreground text-xs leading-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        style={{ left: "var(--compare)" }}
      >
        <span aria-hidden="true">◂▸</span>
      </div>
    </div>
  );
};
