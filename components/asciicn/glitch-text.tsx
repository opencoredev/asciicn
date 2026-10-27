"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import {
  cssColor,
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * The text is laid out once in the flow (the base layer) and copied into
 * absolutely positioned layers on top: two coloured ghosts and a stack of
 * horizontal bands that together cover the whole block. At rest only the
 * base shows. During a burst the base goes clear, each band shifts
 * sideways on its own, the ghosts split apart, and some letters are
 * swapped for block and box glyphs painted over their slots. Transforms
 * and pseudo-elements never touch layout, so nothing around the text
 * moves, and copying it always copies the real string.
 */

/** Glyph sets that letters are swapped for during a burst. */
export const GLITCH_GLYPHS = {
  blocks: "█▓▒░▀▄▌▐■▖▗▘▝▚▞▙▟",
  box: "┼╋╬═║╳╱╲┤├┬┴╪╫━┃",
  mixed: "█▓▒░▚▞▀▄▌▐╳╬┼═║■",
  shades: "░▒▓█",
} as const;

export type GlitchGlyphs = keyof typeof GLITCH_GLYPHS;
export const GLITCH_GLYPH_NAMES = [
  "mixed",
  "blocks",
  "box",
  "shades",
] as const satisfies readonly GlitchGlyphs[];

export const GLITCH_TRIGGERS = ["auto", "hover", "inView"] as const;
/**
 * When bursts play: `auto` on a timer while the text is on screen, `hover`
 * each time the pointer enters, `inView` once each time it scrolls into view.
 */
export type GlitchTrigger = (typeof GLITCH_TRIGGERS)[number];

export type GlitchTextTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

export interface GlitchTextProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /** The text. It is what screen readers, search and copy get. */
  children: string;
  /** The element to render. Default `"span"`. */
  as?: GlitchTextTag;
  /** How hard a burst hits, 0 to 1: slice distance, swapped letters and colour split. Default 0.35. */
  intensity?: number;
  /** `auto`: average seconds between bursts, varied by a third either way. Default 3. */
  interval?: number;
  /** Seconds one burst lasts. Default 0.4. */
  duration?: number;
  /** When bursts play. Default `"auto"`. */
  trigger?: GlitchTrigger;
  /** The glyph set swapped-in letters come from. Default `"mixed"`. */
  glyphs?: GlitchGlyphs;
  /** Your own glyphs to swap in, such as `"▚▞"`. Wins over `glyphs`. */
  characters?: string;
  /** The two colour-split ghosts, as palette names, CSS variable names or CSS colours. Default `["red", "blue"]`. */
  split?: readonly [AsciiColor, AsciiColor];
}

/** Horizontal bands the text is cut into during a burst. */
const BANDS = 7;
/** Milliseconds per glitch frame: the burst steps rather than eases. */
const FRAME_MS = 55;
/** Seconds after the text first shows before an `auto` burst, so a demo glitches early. */
const FIRST_BURST = 0.5;

const STYLES = [
  ".acn-gl{position:relative;font-variant-ligatures:none}",
  ".acn-gl-layer{position:absolute;inset:0;pointer-events:none;user-select:none;visibility:hidden;will-change:transform}",
  ".acn-gl[data-active] .acn-gl-layer{visibility:visible}",
  ".acn-gl[data-active] .acn-gl-base{-webkit-text-fill-color:transparent}",
  ".acn-gl-ghost{color:var(--gl-c);opacity:.85}",
  ".acn-gl-c{position:relative}",
  ".acn-gl-c[data-g]{-webkit-text-fill-color:transparent}",
  ".acn-gl-c[data-g]::after{content:attr(data-g);position:absolute;top:50%;left:50%;translate:-50% -50%;line-height:1;-webkit-text-fill-color:currentcolor;font-family:var(--ascii-font,ui-monospace,monospace);font-weight:400}",
].join("");

type GhostVars = CSSProperties & Record<"--gl-c", string>;

const isBlank = (glyph: string) => glyph.trim() === "";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** A random number in [-1, 1). */
const signed = () => Math.random() * 2 - 1;

interface Layers {
  /** Ghost layers then band layers, bottom to top. */
  readonly layers: (HTMLSpanElement | null)[];
  /** Letter slots per layer, indexed like `layers`. */
  readonly slots: (HTMLSpanElement | null)[][];
}

/** Put every layer back at rest: no offsets, no swapped letters. */
const settle = (root: HTMLElement | null, { layers, slots }: Layers) => {
  delete root?.dataset.active;
  for (const layer of layers) {
    if (layer) {
      layer.style.transform = "";
      layer.style.clipPath = "";
    }
  }
  for (const row of slots) {
    for (const slot of row) {
      if (slot) {
        delete slot.dataset.g;
      }
    }
  }
};

interface FrameOptions {
  readonly root: HTMLElement;
  readonly refs: Layers;
  readonly intensity: number;
  readonly pool: readonly string[];
  readonly letters: readonly string[];
}

/** Draw one random glitch frame across the ghost and band layers. */
const glitchFrame = ({
  root,
  refs,
  intensity,
  pool,
  letters,
}: FrameOptions) => {
  const { layers, slots } = refs;
  // A few frames in each burst are clean, so the burst flickers.
  if (Math.random() < 0.18) {
    settle(root, refs);
    return;
  }
  root.dataset.active = "";
  const power = intensity ** 1.4;
  // Random cut lines, sorted: the bands always tile the whole block.
  const cuts = [
    0,
    ...Array.from({ length: BANDS - 1 }, () => Math.random()).toSorted(
      (a, b) => a - b
    ),
    1,
  ];
  const shiftChance = 0.3 + 0.5 * intensity;
  const maxShift = 0.03 + 0.6 * power;
  for (let band = 0; band < BANDS; band += 1) {
    const layer = layers[2 + band];
    if (!layer) {
      continue;
    }
    const top = cuts[band] ?? 0;
    const bottom = cuts[band + 1] ?? 1;
    const shift = Math.random() < shiftChance ? signed() * maxShift : 0;
    layer.style.clipPath = `inset(${(top * 100).toFixed(2)}% -2em ${((1 - bottom) * 100).toFixed(2)}% -2em)`;
    layer.style.transform =
      shift === 0 ? "" : `translateX(${shift.toFixed(3)}em)`;
  }
  // The ghosts split apart, each clipped to a random slab or the whole text.
  const spread = 0.02 + 0.1 * power;
  for (let ghost = 0; ghost < 2; ghost += 1) {
    const layer = layers[ghost];
    if (!layer) {
      continue;
    }
    const direction = ghost === 0 ? -1 : 1;
    const dx = direction * spread * (0.5 + Math.random());
    const dy = signed() * spread * 0.25;
    layer.style.transform = `translate(${dx.toFixed(3)}em, ${dy.toFixed(3)}em)`;
    if (Math.random() < 0.5) {
      const top = Math.random() * 0.7;
      layer.style.clipPath = `inset(${(top * 100).toFixed(1)}% -2em ${((1 - top - 0.15 - Math.random() * 0.5) * 100).toFixed(1)}% -2em)`;
    } else {
      layer.style.clipPath = "";
    }
  }
  // Swapped letters: the same glyph in every layer, so the slices agree.
  const swapChance = 0.03 + 0.42 * power;
  for (const [index, letter] of letters.entries()) {
    const glyph =
      !isBlank(letter) && Math.random() < swapChance
        ? pool[Math.floor(Math.random() * pool.length)]
        : undefined;
    for (const row of slots) {
      const slot = row[index];
      if (!slot) {
        continue;
      }
      if (glyph === undefined) {
        delete slot.dataset.g;
      } else {
        slot.dataset.g = glyph;
      }
    }
  }
};

/**
 * Text that glitches in short bursts: horizontal slices jump sideways,
 * letters swap for block and box glyphs, and two coloured ghosts split
 * off, then it snaps back clean. On a timer, on hover or on scroll into
 * view. Subtle by default, wild at full intensity. The layout never
 * moves and the real text stays selectable.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const GlitchText = ({
  children,
  as: Tag = "span",
  intensity = 0.35,
  interval = 3,
  duration = 0.4,
  trigger = "auto",
  glyphs = "mixed",
  characters,
  split = ["red", "blue"],
  className,
  style,
  onPointerEnter,
  ...props
}: GlitchTextProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const stageRef = useRef<HTMLSpanElement>(null);
  const refs = useRef<Layers>({
    layers: [],
    slots: Array.from({ length: BANDS + 2 }, () => []),
  });
  const frameRef = useRef(0);
  const nextRef = useRef(0);
  const reduced = usePrefersReducedMotion();
  const visible = useDocumentVisible();
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const letters = [...children];
  const pool = [...(characters || GLITCH_GLYPHS[glyphs])];
  const poolKey = pool.join("");

  const live = useRef({ duration, intensity, letters });
  useEffect(() => {
    live.current = { duration, intensity, letters };
  });

  const stop = useCallback(() => {
    window.clearTimeout(frameRef.current);
    settle(stageRef.current, refs.current);
  }, []);

  const burst = useCallback(() => {
    window.clearTimeout(frameRef.current);
    const glyphPool = [...poolKey];
    const start = performance.now();
    const step = () => {
      const root = stageRef.current;
      const {
        duration: length,
        intensity: amount,
        letters: text,
      } = live.current;
      if (!root || performance.now() - start >= length * 1000) {
        settle(root, refs.current);
        return;
      }
      glitchFrame({
        intensity: clamp01(amount),
        letters: text,
        pool: glyphPool.length > 0 ? glyphPool : [...GLITCH_GLYPHS.mixed],
        refs: refs.current,
        root,
      });
      frameRef.current = window.setTimeout(
        step,
        FRAME_MS * (0.6 + Math.random() * 0.8)
      );
    };
    step();
  }, [poolKey]);

  // `auto`: bursts on a jittered timer while on screen and the tab is visible.
  const running = !reduced && visible && inView;
  useEffect(() => {
    if (!running || trigger !== "auto") {
      return;
    }
    let first = true;
    const schedule = () => {
      const wait = first
        ? FIRST_BURST
        : Math.max(0.2, interval * (1 + signed() / 3));
      first = false;
      nextRef.current = window.setTimeout(() => {
        burst();
        schedule();
      }, wait * 1000);
    };
    schedule();
    return () => {
      window.clearTimeout(nextRef.current);
      stop();
    };
  }, [running, trigger, interval, burst, stop]);

  // `inView`: one burst each time the text scrolls into view.
  useEffect(() => {
    if (!running || trigger !== "inView") {
      return;
    }
    burst();
    return stop;
  }, [running, trigger, burst, stop]);

  // Hover bursts stop when motion turns off or the text leaves the screen.
  useEffect(() => {
    if (!running) {
      stop();
    }
  }, [running, stop]);

  const ghostVars: [GhostVars, GhostVars] = [
    { "--gl-c": cssColor(split[0]) },
    { "--gl-c": cssColor(split[1]) },
  ];

  /** The text as whole words of letter slots; `layer` -1 is the base. */
  const renderText = (layer: number): ReactNode => {
    let index = 0;
    return children.split(/(\s+)/).map((word, wordIndex) => {
      if (word === "") {
        return null;
      }
      if (/^\s+$/.test(word)) {
        index += [...word].length;
        // oxlint-disable-next-line no-array-index-key -- words are positional.
        return <span key={wordIndex}>{word}</span>;
      }
      return (
        // oxlint-disable-next-line no-array-index-key -- words are positional.
        <span key={wordIndex} className="inline-block whitespace-pre">
          {[...word].map((letter) => {
            const slot = index;
            index += 1;
            return (
              <span
                key={slot}
                ref={
                  layer < 0
                    ? undefined
                    : (node) => {
                        const row = refs.current.slots[layer];
                        if (row) {
                          row[slot] = node;
                        }
                      }
                }
                className="acn-gl-c"
              >
                {letter}
              </span>
            );
          })}
        </span>
      );
    });
  };

  return (
    <Tag
      ref={setRoot}
      data-slot="glitch-text"
      className={cn(Tag === "span" && "inline-block", className)}
      style={style}
      onPointerEnter={(event) => {
        if (trigger === "hover" && running) {
          burst();
        }
        onPointerEnter?.(event);
      }}
      {...props}
    >
      <style href="asciicn-glitch-text" precedence="asciicn">
        {STYLES}
      </style>
      <span className="sr-only select-none">{children}</span>
      {/* The layers cover this stage, not the element, so padding on the element can't change how they wrap. */}
      <span
        ref={stageRef}
        aria-hidden="true"
        className={cn("acn-gl", Tag === "span" ? "inline-block" : "block")}
      >
        <span className="acn-gl-base">{renderText(-1)}</span>
        {Array.from({ length: BANDS + 2 }, (_, layer) => (
          <span
            // oxlint-disable-next-line no-array-index-key -- layers are fixed.
            key={layer}
            ref={(node) => {
              refs.current.layers[layer] = node;
            }}
            className={cn("acn-gl-layer", layer < 2 && "acn-gl-ghost")}
            style={layer < 2 ? ghostVars[layer] : undefined}
          >
            {renderText(layer)}
          </span>
        ))}
      </span>
    </Tag>
  );
};
