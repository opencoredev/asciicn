"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

import {
  brailleChar,
  cssColor,
  QUADRANT_GLYPHS,
  resolveCharset,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor, CharsetName } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * Each character steps through a density ramp: in from empty, up through
 * the ramp to its densest glyph, then the letter itself; out the same way
 * in reverse. The letters keep their slots the whole time (invisible while
 * a ramp glyph is painted over them), so the layout never moves.
 */

export const DISSOLVE_ORDERS = ["start", "end", "center", "random"] as const;
/** Which characters go first. */
export type DissolveOrder = (typeof DISSOLVE_ORDERS)[number];

export type DissolveTrigger = "mount" | "view";

export type DissolveTextTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

export interface DissolveTextProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /** The text. It is what screen readers, search and copy get while shown. */
  children: string;
  /** The element to render. Default `"span"`. */
  as?: DissolveTextTag;
  /** `true` assembles the text out of the ramp, `false` dissolves it into the ramp and away. Default `true`. */
  show?: boolean;
  /** When the first assembly plays. Default `"view"`. */
  trigger?: DissolveTrigger;
  /** The density ramp. `blocks` steps `·░▒▓█`; braille and quadrants fill dot by dot. Default `"blocks"`. */
  charset?: CharsetName;
  /** A custom ramp from empty to dense, such as `" .:+#"`. Wins over `charset`. */
  chars?: string;
  /** Which characters go first. Default `"start"`. */
  order?: DissolveOrder;
  /** Stagger by `char` or by whole `word`. Default `"char"`. */
  by?: "char" | "word";
  /** Seconds each character takes to cross the ramp. Default 0.45. */
  duration?: number;
  /** Seconds between one character (or word) starting and the next. Default 0.03. */
  stagger?: number;
  /** Seconds to wait before starting. Default 0. */
  delay?: number;
  /** Colour of the ramp glyphs. Default `"ink"`. */
  color?: AsciiColor;
  /** Called when an assembly or a dissolve has finished. */
  onComplete?: () => void;
}

const STYLES = [
  ".acn-dis-c{position:relative}",
  ".acn-dis-c[data-g]{color:transparent}",
  ".acn-dis-c[data-g]::after{content:attr(data-g);position:absolute;top:0;left:50%;translate:-50% 0;color:var(--dis-ink);font-family:var(--ascii-font,ui-monospace,monospace);font-weight:400;pointer-events:none;user-select:none}",
].join("");

type DissolveVars = CSSProperties & Record<"--dis-ink", string>;

/** Braille masks filling a cell dot by dot, from the bottom left up. */
const BRAILLE_RAMP = [0, 64, 68, 100, 228, 230, 246, 254, 255].map((mask) =>
  brailleChar(mask)
);
const QUADRANT_RAMP = [0, 4, 6, 7, 15].map(
  (mask) => QUADRANT_GLYPHS[mask] ?? " "
);
const DEFAULT_RAMP = [" ", "·", "░", "▒", "▓", "█"];

/** The ramp from empty (index 0) to densest, for any charset. */
const rampFor = (charset: CharsetName, chars?: string): readonly string[] => {
  const set = resolveCharset(charset, chars);
  if (chars === undefined && charset === "blocks") {
    return DEFAULT_RAMP;
  }
  switch (set.kind) {
    case "braille": {
      return BRAILLE_RAMP;
    }
    case "quadrants": {
      return QUADRANT_RAMP;
    }
    case "ramp":
    case "edge": {
      return set.glyphs;
    }
    default: {
      const exhaustive: never = set.kind;
      return exhaustive;
    }
  }
};

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number): number => {
  const value = Math.sin(a * 127.1 + 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

/** Where in the sequence each slot starts, in stagger steps. */
const startSteps = (
  slots: readonly { word: number }[],
  order: DissolveOrder,
  by: "char" | "word"
): number[] => {
  const keys = slots.map((slot, index) => (by === "word" ? slot.word : index));
  const count = Math.max(0, ...keys) + 1;
  return keys.map((key) => {
    switch (order) {
      case "start": {
        return key;
      }
      case "end": {
        return count - 1 - key;
      }
      case "center": {
        return Math.abs(key - (count - 1) / 2);
      }
      case "random": {
        return hash(key + 1) * count;
      }
      default: {
        const exhaustive: never = order;
        return exhaustive;
      }
    }
  });
};

/**
 * Text that assembles out of a glyph density ramp (empty, `·░▒▓█`, then
 * the letter) and dissolves back into it, one character or word at a
 * time in the order you pick. Set `show` to play it either way.
 */
export const DissolveText = ({
  children,
  as: Tag = "span",
  show = true,
  trigger = "view",
  charset = "blocks",
  chars,
  order = "start",
  by = "char",
  duration = 0.45,
  stagger = 0.03,
  delay = 0,
  color = "ink",
  onComplete,
  className,
  style,
  ...props
}: DissolveTextProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const slotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const frameRef = useRef(0);
  // What was last played, so a re-render plays nothing but new text or a new `show` does.
  const playedRef = useRef<{ show: boolean; text: string } | null>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const ramp = rampFor(charset, chars);
  const rampKey = ramp.join("");

  const live = useRef({ by, delay, duration, onComplete, order, stagger });
  useEffect(() => {
    live.current = { by, delay, duration, onComplete, order, stagger };
  });

  // Words for the layout and a word index per letter slot.
  const words = children.split(/(\s+)/);
  const slotWords: { word: number }[] = [];
  let wordCount = 0;
  for (const word of words) {
    if (word === "" || /^\s+$/.test(word)) {
      continue;
    }
    for (const _letter of word) {
      slotWords.push({ word: wordCount });
    }
    wordCount += 1;
  }
  const layoutKey = slotWords.map((slot) => slot.word).join(",");

  const settle = useCallback((visible: boolean) => {
    for (const slot of slotsRef.current) {
      if (!slot) {
        continue;
      }
      if (visible) {
        delete slot.dataset.g;
      } else {
        slot.dataset.g = "";
      }
    }
  }, []);

  const run = useCallback(
    (assemble: boolean) => {
      cancelAnimationFrame(frameRef.current);
      const glyphs = [...rampKey];
      const levels = glyphs.length;
      const slots = slotsRef.current;
      const { by: unit, order: sequence } = live.current;
      const steps = startSteps(
        layoutKey.split(",").map((word) => ({ word: Number(word) })),
        sequence,
        unit
      );
      const start = performance.now();
      const step = (now: number) => {
        const { delay: wait, duration: span, stagger: gap } = live.current;
        const elapsed = (now - start) / 1000 - wait;
        let running = false;
        for (const [index, slot] of slots.entries()) {
          if (!slot) {
            continue;
          }
          const progress = Math.min(
            1,
            Math.max(0, (elapsed - (steps[index] ?? 0) * gap) / span)
          );
          if (progress < 1) {
            running = true;
          }
          // Assemble climbs the ramp to the letter; dissolve climbs down from it.
          const level = assemble ? progress : 1 - progress;
          if (level >= 1) {
            delete slot.dataset.g;
            continue;
          }
          const glyph =
            glyphs[Math.min(levels - 1, Math.floor(level * levels))] ?? "";
          const value = glyph === " " ? "" : glyph;
          if (slot.dataset.g !== value) {
            slot.dataset.g = value;
          }
        }
        if (running) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          live.current.onComplete?.();
        }
      };
      step(start);
    },
    [rampKey, layoutKey]
  );

  // The first assembly waits for the trigger; after that `show` drives it.
  const armed = trigger === "mount" || inView;
  useEffect(() => {
    if (reduced) {
      cancelAnimationFrame(frameRef.current);
      settle(show);
      playedRef.current = { show, text: children };
      return;
    }
    const played = playedRef.current;
    if (played === null && !armed) {
      return;
    }
    if (played?.show === show && played.text === children) {
      return;
    }
    playedRef.current = { show, text: children };
    run(show);
    // An interrupted transition is replayed in full by the next run.
    return () => {
      cancelAnimationFrame(frameRef.current);
      playedRef.current = null;
    };
  }, [armed, reduced, show, run, settle, children]);

  const vars: DissolveVars = { "--dis-ink": cssColor(color) };
  let slotIndex = 0;

  return (
    <Tag
      ref={setRoot}
      data-slot="dissolve-text"
      data-state={show ? "shown" : "hidden"}
      className={cn("[font-variant-ligatures:none]", className)}
      style={{ ...vars, ...style }}
      {...props}
    >
      <style href="asciicn-dissolve-text" precedence="asciicn">
        {STYLES}
      </style>
      {show ? <span className="sr-only select-none">{children}</span> : null}
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
          if (word === "") {
            return null;
          }
          if (/^\s+$/.test(word)) {
            // oxlint-disable-next-line no-array-index-key -- words are positional.
            return <span key={wordIndex}>{word}</span>;
          }
          return (
            // oxlint-disable-next-line no-array-index-key -- words are positional.
            <span key={wordIndex} className="inline-block whitespace-pre">
              {[...word].map((letter) => {
                const slot = slotIndex;
                slotIndex += 1;
                return (
                  <span
                    key={slot}
                    ref={(node) => {
                      slotsRef.current[slot] = node;
                    }}
                    className="acn-dis-c"
                    // Hidden until the first assembly, so text never flashes in first.
                    data-g=""
                  >
                    {letter}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </Tag>
  );
};
