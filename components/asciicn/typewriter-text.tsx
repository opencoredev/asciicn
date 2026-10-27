"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, HTMLAttributes } from "react";

import {
  cssColor,
  useDocumentVisible,
  useInView,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * Every phrase is laid out invisibly in the same grid cell as the live
 * line, so the element is always as big as its longest phrase (plus the
 * prompt and the cursor) and typing never moves anything around it. The
 * cursor is a real glyph from the glyph font, solid while keys are
 * landing and blinking in steps while it waits.
 */

/** Cursor glyphs, from the glyph font. */
export const TYPEWRITER_CURSORS = {
  bar: "▏",
  block: "█",
  underscore: "_",
} as const;

export type TypewriterCursor = keyof typeof TYPEWRITER_CURSORS;
export const TYPEWRITER_CURSOR_NAMES = [
  "block",
  "underscore",
  "bar",
] as const satisfies readonly TypewriterCursor[];

export const TYPEWRITER_CURSOR_VISIBILITY = [
  "always",
  "started",
  "typing",
] as const;
export type TypewriterCursorVisibility =
  (typeof TYPEWRITER_CURSOR_VISIBILITY)[number];

export type TypewriterTextTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "p"
  | "span"
  | "div";

export interface TypewriterTextProps extends Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "color"
> {
  /** The lines to type, in order. Screen readers get all of them. */
  phrases: readonly string[];
  /** The element to render. Default `"span"`. */
  as?: TypewriterTextTag;
  /** Characters typed per second, on average. Default 16. */
  speed?: number;
  /** Characters erased per second when backspacing. Default 40. */
  backspaceSpeed?: number;
  /** How uneven the typing is, 0 (a metronome) to 1 (a person). Default 0.6. */
  jitter?: number;
  /** Seconds to hold a typed phrase before the next one. Default 1.8. */
  pause?: number;
  /** Seconds to wait before the first key. Default 0.2. */
  delay?: number;
  /** Erase phrases one character at a time. `false` clears the line at once. Default `true`. */
  backspace?: boolean;
  /** Start over after the last phrase. `false` stops on the last phrase. Default `true`. */
  loop?: boolean;
  /** Cursor shape. Default `"block"`. */
  cursor?: TypewriterCursor;
  /** Text before the typed line that is never erased, such as `"$ "`. Default none. */
  prompt?: string;
  /** When the cursor shows: `always`, `started` (from the first key on) or `typing` (only while keys land, as in a log of many lines). Default `"always"`. */
  showCursor?: TypewriterCursorVisibility;
  /** Cursor colour: a palette name, CSS variable name or any CSS colour. Default `"ink"`. */
  cursorColor?: AsciiColor;
  /** Prompt colour. Default `"grey"`. */
  promptColor?: AsciiColor;
}

type TypewriterPhase = "typing" | "holding" | "erasing" | "done";

interface TypewriterState {
  readonly phrase: number;
  readonly typed: number;
  readonly phase: TypewriterPhase;
}

const STYLES = [
  "@keyframes acn-tw-blink{50%{opacity:0}}",
  ".acn-tw-cursor{font-family:var(--ascii-font,ui-monospace,monospace);font-weight:400;color:var(--tw-cursor)}",
  ".acn-tw-cursor[data-blink]{animation:acn-tw-blink 1.06s steps(1,end) infinite}",
  "@media (prefers-reduced-motion:reduce){.acn-tw-cursor[data-blink]{animation:none}}",
].join("");

type TypewriterVars = CSSProperties & Record<"--tw-cursor", string>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Seconds before the next key: uneven, with longer gaps after words and stops. */
const keyDelay = (speed: number, jitter: number, previous: string) => {
  const base = 1 / Math.max(0.5, speed);
  let factor = 1 + jitter * (Math.random() * 2 - 1) * 0.75;
  if (previous === " ") {
    factor += jitter * 0.8;
  } else if (/[.,:;!?]/.test(previous)) {
    factor += jitter * 3;
  }
  // Now and then a short hesitation, as if reading ahead.
  if (Math.random() < 0.04 * jitter) {
    factor += 3;
  }
  return base * factor;
};

/** The next state and how long to wait for it, or `null` when typing is over. */
const advance = (
  state: TypewriterState,
  phrases: readonly string[],
  options: {
    speed: number;
    backspaceSpeed: number;
    jitter: number;
    pause: number;
    backspace: boolean;
    loop: boolean;
  }
): { next: TypewriterState; wait: number } | null => {
  const text = [...(phrases[state.phrase] ?? "")];
  const last = state.phrase >= phrases.length - 1;
  switch (state.phase) {
    case "typing": {
      if (state.typed < text.length) {
        return {
          next: { ...state, typed: state.typed + 1 },
          wait: keyDelay(
            options.speed,
            options.jitter,
            text[state.typed - 1] ?? ""
          ),
        };
      }
      if (last && !options.loop) {
        return { next: { ...state, phase: "done" }, wait: 0 };
      }
      return { next: { ...state, phase: "holding" }, wait: 0 };
    }
    case "holding": {
      return {
        next: { ...state, phase: "erasing" },
        wait: options.pause,
      };
    }
    case "erasing": {
      if (state.typed > 0 && options.backspace) {
        return {
          next: { ...state, typed: state.typed - 1 },
          wait:
            (1 / Math.max(1, options.backspaceSpeed)) *
            (1 + (Math.random() - 0.5) * 0.3 * options.jitter),
        };
      }
      return {
        next: {
          phase: "typing",
          phrase: last ? 0 : state.phrase + 1,
          typed: 0,
        },
        wait: 0.35,
      };
    }
    case "done": {
      return null;
    }
    default: {
      const exhaustive: never = state.phase;
      return exhaustive;
    }
  }
};

const START: TypewriterState = { phase: "typing", phrase: 0, typed: 0 };

/**
 * Terminal typing: phrases appear one stepped keystroke at a time with
 * uneven timing, a block, underscore or bar cursor, an optional prompt
 * such as `$ `, and optional backspacing through a list of phrases.
 * The element is sized to the longest phrase, so the layout never moves.
 */
// oxlint-disable-next-line complexity -- each prop default counts as a branch.
export const TypewriterText = ({
  phrases,
  as: Tag = "span",
  speed = 16,
  backspaceSpeed = 40,
  jitter = 0.6,
  pause = 1.8,
  delay = 0.2,
  backspace = true,
  loop = true,
  cursor = "block",
  showCursor = "always",
  prompt,
  cursorColor = "ink",
  promptColor = "grey",
  className,
  style,
  ...props
}: TypewriterTextProps) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);
  const reduced = usePrefersReducedMotion();
  const visible = useDocumentVisible();
  const inView = useInView(rootRef);
  const [state, setState] = useState<TypewriterState>(START);
  const [started, setStarted] = useState(false);
  const phrasesKey = phrases.join("\u0000");

  // New phrases start over from the first one.
  useEffect(() => {
    setState(START);
    setStarted(false);
  }, [phrasesKey]);

  const live = useRef({
    backspace,
    backspaceSpeed,
    jitter,
    loop,
    pause,
    speed,
  });
  useEffect(() => {
    live.current = { backspace, backspaceSpeed, jitter, loop, pause, speed };
  });

  // One timer at a time; leaving the screen or hiding the tab freezes the
  // line where it is, and coming back carries on from there.
  const running = !reduced && visible && inView;
  useEffect(() => {
    if (!running) {
      return;
    }
    const step = advance(state, phrasesKey.split("\u0000"), {
      ...live.current,
      jitter: clamp01(live.current.jitter),
    });
    if (!step) {
      return;
    }
    const wait = started ? step.wait : delay;
    const timer = window.setTimeout(() => {
      setStarted(true);
      setState(started ? step.next : state);
    }, wait * 1000);
    return () => window.clearTimeout(timer);
  }, [running, state, started, delay, phrasesKey]);

  // Reduced motion shows the phrase the typing would rest on, in full.
  const resting = loop ? 0 : phrases.length - 1;
  const shown: TypewriterState = reduced
    ? {
        phase: "done",
        phrase: resting,
        typed: [...(phrases[resting] ?? "")].length,
      }
    : state;
  const line = [...(phrases[shown.phrase] ?? "")]
    .slice(0, shown.typed)
    .join("");
  const glyph = TYPEWRITER_CURSORS[cursor];
  const done = shown.phase === "done";
  const blink = done || !started || shown.phase === "holding";
  const cursorHidden =
    (showCursor !== "always" && !started && !reduced) ||
    (showCursor === "typing" && done);

  const vars: TypewriterVars = { "--tw-cursor": cssColor(cursorColor) };
  const promptNode = prompt ? (
    <span style={{ color: cssColor(promptColor) }}>{prompt}</span>
  ) : null;

  return (
    <Tag
      ref={setRoot}
      data-slot="typewriter-text"
      data-phase={shown.phase}
      className={cn(
        Tag === "span" ? "inline-grid" : "grid",
        "[font-variant-ligatures:none]",
        className
      )}
      style={{ ...vars, ...style }}
      {...props}
    >
      <style href="asciicn-typewriter-text" precedence="asciicn">
        {STYLES}
      </style>
      <span className="sr-only">
        {prompt}
        {phrases.join(" ")}
      </span>
      {/* Reserve the size of every phrase in the cell the live line uses. */}
      {phrases.map((phrase, index) => (
        <span
          // oxlint-disable-next-line no-array-index-key -- phrases may repeat.
          key={index}
          aria-hidden="true"
          className="invisible [grid-area:1/1] whitespace-pre-wrap select-none"
        >
          {prompt}
          {phrase}
          <span className="acn-tw-cursor">{glyph}</span>
        </span>
      ))}
      <span aria-hidden="true" className="[grid-area:1/1] whitespace-pre-wrap">
        {promptNode}
        {line}
        <span
          className={cn("acn-tw-cursor", cursorHidden && "invisible")}
          data-blink={blink ? "" : undefined}
        >
          {glyph}
        </span>
      </span>
    </Tag>
  );
};
