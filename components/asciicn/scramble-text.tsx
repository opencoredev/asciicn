"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

import {
  brailleChar,
  cssColor,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * Every character keeps its own slot: the final text is always laid out
 * (invisible while it scrambles), and the cycling glyph is painted over
 * the slot by a pseudo-element centred on it. Nothing the animation does
 * can move the layout, and copying the text copies the final string.
 */

/** Glyph sets the characters cycle through before they settle. */
export const SCRAMBLE_GLYPHS = {
  binary: "01",
  blocks: "░▒▓█▀▄▌▐▖▗▘▝▙▛▜▟",
  // Generated: every braille pattern but the empty one.
  braille: "",
  cp437: "░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤÷≈°∙√ⁿ²■",
  hex: "0123456789abcdef",
  katakana: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
  petscii: "▁▂▃▄▅▆▇█▌▐╱╲╳○●◆♠♣♥♦─│┼╭╮╰╯▖▗▘▝▚▞",
  symbols: "!<>-_\\/[]{}=+*^?#%&@$~",
} as const;

export type ScrambleGlyphs = keyof typeof SCRAMBLE_GLYPHS;
export const SCRAMBLE_GLYPH_NAMES = [
  "katakana",
  "braille",
  "cp437",
  "petscii",
  "blocks",
  "symbols",
  "hex",
  "binary",
] as const satisfies readonly ScrambleGlyphs[];

export const SCRAMBLE_TRIGGERS = ["mount", "view", "hover", "loop"] as const;
/** When the scramble plays. Changing the text always plays it again. */
export type ScrambleTrigger = (typeof SCRAMBLE_TRIGGERS)[number];

export type ScrambleTextTag = "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";

export interface ScrambleTextProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /** The final text. It is what screen readers, search and copy get. */
  children: string;
  /** The element to render. Default `"span"`. */
  as?: ScrambleTextTag;
  /** The glyph set characters cycle through. Default `"katakana"`. */
  glyphs?: ScrambleGlyphs;
  /** Your own glyphs to cycle through, such as `"▚▞"`. Wins over `glyphs`. */
  characters?: string;
  /** When it plays. Default `"view"`. */
  trigger?: ScrambleTrigger;
  /** Seconds every character scrambles before the first one settles. Default 0.5. */
  duration?: number;
  /** Seconds between neighbours settling, left to right. Default 0.035. */
  stagger?: number;
  /** Seconds to wait before starting. Default 0. */
  delay?: number;
  /** New glyphs per second while scrambling. Default 20. */
  rate?: number;
  /** `loop`: seconds to hold the settled text before playing again. Default 2.5. */
  pause?: number;
  /** Colour of the scrambling glyphs. Default `"ink"`. */
  color?: AsciiColor;
  /** Called each time the text has fully settled. */
  onComplete?: () => void;
}

const STYLES = [
  ".acn-scr-c{position:relative}",
  ".acn-scr-c[data-g]{color:transparent}",
  ".acn-scr-c[data-g]::after{content:attr(data-g);position:absolute;top:0;left:50%;translate:-50% 0;color:var(--scr-ink);font-family:var(--ascii-font,ui-monospace,monospace);font-weight:400;pointer-events:none;user-select:none}",
].join("");

type ScrambleVars = CSSProperties & Record<"--scr-ink", string>;

const BRAILLE = Array.from({ length: 255 }, (_, index) =>
  brailleChar(index + 1)
).join("");

// A float hash in [0, 1): cheap, stable for integer inputs, no bitwise maths.
const hash = (a: number, b: number): number => {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43_758.5453;
  return value - Math.floor(value);
};

const isBlank = (glyph: string) => glyph.trim() === "";

/**
 * Text whose characters cycle through glyph sets (katakana, braille,
 * CP437, PETSCII, symbols and more) and settle left to right: on mount,
 * when scrolled into view, on hover, or on a loop. The layout never
 * moves, because every character keeps its final slot throughout.
 */
export const ScrambleText = ({
  children,
  as: Tag = "span",
  glyphs = "katakana",
  characters,
  trigger = "view",
  duration = 0.5,
  stagger = 0.035,
  delay = 0,
  rate = 20,
  pause = 2.5,
  color = "ink",
  onComplete,
  className,
  style,
  onPointerEnter,
  ...props
}: ScrambleTextProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const slotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const frameRef = useRef(0);
  const timerRef = useRef(0);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(rootRef, { rootMargin: "0px" });
  const pool = [
    ...(characters ??
      (glyphs === "braille" ? BRAILLE : SCRAMBLE_GLYPHS[glyphs])),
  ];
  const poolKey = pool.join("");

  const live = useRef({
    delay,
    duration,
    onComplete,
    pause,
    rate,
    stagger,
    trigger,
  });
  useEffect(() => {
    live.current = {
      delay,
      duration,
      onComplete,
      pause,
      rate,
      stagger,
      trigger,
    };
  });

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timerRef.current);
    for (const slot of slotsRef.current) {
      if (slot) {
        delete slot.dataset.g;
      }
    }
  }, []);

  const play = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    window.clearTimeout(timerRef.current);
    const slots = slotsRef.current;
    const glyphPool = [...poolKey];
    if (glyphPool.length === 0) {
      return;
    }
    const start = performance.now();
    const seed = Math.floor(Math.random() * 1_000_000);
    const step = (now: number) => {
      const {
        delay: wait,
        duration: hold,
        stagger: gap,
        rate: speed,
      } = live.current;
      const elapsed = (now - start) / 1000 - wait;
      const tick = Math.floor(Math.max(0, elapsed) * speed);
      let running = false;
      let order = 0;
      for (const [index, slot] of slots.entries()) {
        if (!slot || isBlank(slot.textContent ?? "")) {
          continue;
        }
        const settle = hold + order * gap;
        order += 1;
        if (elapsed >= settle) {
          delete slot.dataset.g;
          continue;
        }
        running = true;
        const pick = Math.floor(hash(index + seed, tick) * glyphPool.length);
        const glyph = glyphPool[pick] ?? "";
        if (slot.dataset.g !== glyph) {
          slot.dataset.g = glyph;
        }
      }
      if (running) {
        frameRef.current = requestAnimationFrame(step);
        return;
      }
      live.current.onComplete?.();
      if (live.current.trigger === "loop") {
        timerRef.current = window.setTimeout(play, live.current.pause * 1000);
      }
    };
    step(start);
  }, [poolKey]);

  // Plays on its trigger and whenever the text changes.
  const armed = trigger === "mount" || (trigger !== "hover" && inView);
  useEffect(() => {
    if (reduced) {
      stop();
      return;
    }
    if (armed) {
      play();
    }
    // Leaving the screen mid-scramble settles every character at once.
    return stop;
  }, [armed, reduced, play, stop, children]);

  const vars: ScrambleVars = { "--scr-ink": cssColor(color) };

  // Words stay whole when the line wraps; the spaces between them can break.
  let index = 0;
  const words = children.split(/(\s+)/);

  return (
    <Tag
      ref={setRoot}
      data-slot="scramble-text"
      className={cn("[font-variant-ligatures:none]", className)}
      style={{ ...vars, ...style }}
      onPointerEnter={(event) => {
        if (trigger === "hover" && !reduced) {
          play();
        }
        onPointerEnter?.(event);
      }}
      {...props}
    >
      <style href="asciicn-scramble-text" precedence="asciicn">
        {STYLES}
      </style>
      <span className="sr-only select-none">{children}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => {
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
                    ref={(node) => {
                      slotsRef.current[slot] = node;
                    }}
                    className="acn-scr-c"
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
