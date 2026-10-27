"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { AsciiBox } from "@/components/asciicn/ascii-box";
import type {
  AsciiBoxFrame,
  AsciiBoxProps,
} from "@/components/asciicn/ascii-box";
import { Loader } from "@/components/asciicn/loader";
import { ProgressBar } from "@/components/asciicn/progress-bar";
import {
  CHARSETS,
  cssColor,
  rampChar,
  useFrameLoop,
  usePrefersReducedMotion,
} from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/*
 * The script compiles to a timeline: every step gets a start and an end in
 * seconds. What the window shows is a pure function of one clock, so
 * pausing stops the clock, speed scales it and a loop resets it. The clock
 * only advances while the window is on screen, so a session starts when
 * the visitor scrolls to it.
 */

/** How an output line is coloured, and the mark before it. */
export type TerminalTone = "plain" | "muted" | "ok" | "info" | "warn" | "error";

/** How a task ends: the mark that replaces its spinner. */
export type TerminalResult = "ok" | "warn" | "error";

/** One step of a scripted session. */
export type TerminalStep =
  | {
      /** Typed at the prompt one key at a time, then entered. */
      kind: "command";
      text: string;
    }
  | {
      /** Printed a line at a time. `\n` starts a new line. */
      kind: "output";
      text: string;
      /** Default `"plain"`. */
      tone?: TerminalTone;
      /** Clip long lines instead of wrapping them, for ASCII art. Default `true`. */
      wrap?: boolean;
      /** Read to screen readers instead of `text`, for art. */
      alt?: string;
    }
  | {
      /** A spinner while it runs, then a result mark. */
      kind: "task";
      text: string;
      /** Seconds the spinner runs. Default 1.2. */
      duration?: number;
      /** Default `"ok"`. */
      result?: TerminalResult;
      /** Text once it ends. Default: `text`. */
      done?: string;
    }
  | {
      /** A block progress bar that fills from 0 to 100%. */
      kind: "progress";
      label: string;
      /** Seconds to fill. Default 2. */
      duration?: number;
      /** Width of the bar in cells. Default 20. */
      width?: number;
    }
  | {
      /** A pause with nothing printed. */
      kind: "wait";
      duration: number;
    };

export type TerminalWindowSize = "sm" | "md" | "lg";

export interface TerminalWindowProps extends Omit<
  AsciiBoxProps,
  "title" | "footer" | "children" | "frame"
> {
  /** The session to play. Default: installing a component with the shadcn CLI, building, and printing a frame. */
  script?: readonly TerminalStep[];
  /** Text in the title bar, such as a path or a command. Default `"~/acme — zsh"`. */
  title?: string;
  /** Playback speed multiplier. Default 1. */
  speed?: number;
  /** Start over after a pause at the end. Default `true`. */
  loop?: boolean;
  /** Height of the screen in lines; older lines scroll off the top. Default 18. */
  rows?: number;
  /** The prompt before each command. Default `"$"`. */
  prompt?: string;
  /** Box-drawing set for the window frame. Default `"rounded"`. */
  frame?: AsciiBoxFrame;
  /** Glyph cell height: `sm` 12px, `md` 14px, `lg` 16px. Default `"lg"`. */
  size?: TerminalWindowSize;
}

const CELLS = { lg: 16, md: 14, sm: 12 } as const satisfies Record<
  TerminalWindowSize,
  number
>;

/** Seconds at speed 1. */
const TIMING = {
  /** Before the first key of a command. */
  beforeTyping: 0.45,
  /** After the last key, before the command runs. */
  enter: 0.3,
  /** Holding the finished session before a loop starts over. */
  hold: 3.5,
  /** Between keys, before jitter. */
  key: 0.042,
  /** Between streamed output lines. */
  line: 0.05,
} as const;

const TONE_COLORS = {
  error: "red",
  info: "blue",
  muted: "grey",
  ok: "green",
  plain: "ink",
  warn: "orange",
} as const satisfies Record<TerminalTone, AsciiColor>;

const MARKS = {
  error: "✖",
  info: "›",
  muted: "",
  ok: "✔",
  plain: "",
  warn: "!",
} as const satisfies Record<TerminalTone, string>;

/** A torus at a fixed angle, shaded with the `standard` ramp, for the default script to print. */
const torusFrame = (columns: number, rows: number): string => {
  const tones = new Float32Array(columns * rows);
  const depth = new Float32Array(columns * rows);
  // Tipped about one radian towards the viewer, so the hole shows.
  const [ct, st] = [Math.cos(1), Math.sin(1)];
  // Light from above and in front.
  const [ly, lz] = [Math.SQRT1_2, -Math.SQRT1_2];
  // Projected size in cells; cells are about twice as tall as wide.
  const scale = columns * 0.8;
  for (let a = 0; a < Math.PI * 2; a += 0.04) {
    const [ca, sa] = [Math.cos(a), Math.sin(a)];
    for (let b = 0; b < Math.PI * 2; b += 0.015) {
      const [cb, sb] = [Math.cos(b), Math.sin(b)];
      // A point on the tube (radius 0.7) around the ring (radius 2), and its normal.
      const ring = 2 + 0.7 * ca;
      const [x, y0, z0] = [ring * cb, 0.7 * sa, ring * sb];
      const [ny0, nz0] = [sa, ca * sb];
      const [y, z] = [y0 * ct - z0 * st, y0 * st + z0 * ct];
      const [ny, nz] = [ny0 * ct - nz0 * st, ny0 * st + nz0 * ct];
      const inverse = 1 / (z + 7);
      const column = Math.round(columns / 2 - 0.5 + scale * x * inverse);
      const row = Math.round(rows / 2 - 0.5 - scale * 0.5 * y * inverse);
      const index = row * columns + column;
      const inside = column >= 0 && column < columns && row >= 0 && row < rows;
      if (inside && inverse > (depth[index] ?? 0)) {
        depth[index] = inverse;
        tones[index] = Math.max(0.1, ny * ly + nz * lz);
      }
    }
  }
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    let line = "";
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      line +=
        (depth[index] ?? 0) > 0
          ? rampChar(CHARSETS.standard, tones[index] ?? 0)
          : " ";
    }
    lines.push(line.trimEnd());
  }
  return lines.filter((line) => line !== "").join("\n");
};

/** Installs a component, builds, and prints a frame with the engine. */
export const DEFAULT_TERMINAL_SCRIPT: readonly TerminalStep[] = [
  {
    kind: "command",
    text: "npx shadcn@latest add https://asciicn.dev/r/ascii-donut.json",
  },
  {
    done: "Registry timed out, retrying (1/3)",
    duration: 1.1,
    kind: "task",
    result: "error",
    text: "Checking registry.",
  },
  { duration: 0.8, kind: "task", text: "Checking registry." },
  { duration: 1.9, kind: "progress", label: "Installing dependencies" },
  { kind: "output", text: "Created 3 files:", tone: "ok" },
  {
    kind: "output",
    text: "  - components/asciicn/ascii-donut.tsx\n  - lib/ascii/index.ts\n  - lib/ascii/shader.tsx",
    tone: "muted",
  },
  {
    kind: "output",
    text: "Kept styles/globals.css: --ascii-* tokens already set",
    tone: "warn",
  },
  { kind: "command", text: "pnpm build" },
  {
    done: "Compiled in 3.8s",
    duration: 1.6,
    kind: "task",
    text: "Compiling",
  },
  {
    done: "Prerendered 14 pages",
    duration: 0.9,
    kind: "task",
    text: "Prerendering pages",
  },
  { kind: "command", text: "npx tsx scripts/frame.ts --charset standard" },
  { duration: 0.35, kind: "wait" },
  {
    alt: "A torus drawn in ASCII characters.",
    kind: "output",
    text: `\n${torusFrame(32, 12)}\n`,
    wrap: false,
  },
  {
    kind: "output",
    text: "frame 1 · 32×12 cells · standard · 2.4 ms",
    tone: "muted",
  },
];

/** A stable 0..1 jitter per key, so typing has a human rhythm that repeats exactly. */
const jitter = (index: number) => {
  const x = Math.sin(index * 12.9898 + 78.233) * 43_758.5453;
  return x - Math.floor(x);
};

/** Seconds from the first key to each key of `text`, at speed 1. */
const keyTimes = (text: string): number[] => {
  const times: number[] = [];
  let at = 0;
  for (const [index, char] of [...text].entries()) {
    at += TIMING.key * (0.55 + jitter(index) * 0.9);
    // A beat after a space or a slash, as fingers find the next word.
    if (char === " " || char === "/") {
      at += TIMING.key * 1.2;
    }
    times.push(at);
  }
  return times;
};

interface Timed {
  readonly step: TerminalStep;
  readonly start: number;
  readonly end: number;
  /** For commands: when each key lands, from the step's start. */
  readonly keys: readonly number[];
}

interface Timeline {
  readonly steps: readonly Timed[];
  readonly total: number;
}

const stepLength = (step: TerminalStep, keys: readonly number[]): number => {
  switch (step.kind) {
    case "command": {
      return TIMING.beforeTyping + (keys.at(-1) ?? 0) + TIMING.enter;
    }
    case "output": {
      return (step.text.split("\n").length + 1) * TIMING.line;
    }
    case "task": {
      return step.duration ?? 1.2;
    }
    case "progress": {
      return step.duration ?? 2;
    }
    case "wait": {
      return step.duration;
    }
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};

const compile = (script: readonly TerminalStep[]): Timeline => {
  let at = 0;
  const steps = script.map((step) => {
    const keys = step.kind === "command" ? keyTimes(step.text) : [];
    const start = at;
    at += Math.max(0, stepLength(step, keys));
    return { end: at, keys, start, step };
  });
  return { steps, total: at };
};

/** One line on the screen. */
type Line =
  | { kind: "command"; text: string; typing: boolean }
  | { kind: "output"; text: string; tone: TerminalTone; wrap: boolean }
  | { kind: "task"; text: string; state: "running" | TerminalResult }
  | { kind: "progress"; label: string; value: number; width: number };

interface Screen {
  readonly lines: readonly Line[];
  /** The session is over: an idle prompt waits at the bottom. */
  readonly idle: boolean;
}

/** Progress that stalls and spurts like a real install, still always rising. */
const progressAt = (t: number) =>
  Math.min(1, Math.max(0, t - 0.035 * Math.sin(t * Math.PI * 3)));

const linesOf = (timed: Timed, time: number): Line[] => {
  const { step, start, end } = timed;
  const local = time - start;
  switch (step.kind) {
    case "command": {
      const typed = timed.keys.filter(
        (at) => at <= local - TIMING.beforeTyping
      ).length;
      return [
        {
          kind: "command",
          text: [...step.text].slice(0, typed).join(""),
          typing: time < end,
        },
      ];
    }
    case "output": {
      const shown = Math.floor(local / TIMING.line) + 1;
      return step.text
        .split("\n")
        .slice(0, shown)
        .map((text) => ({
          kind: "output",
          text,
          tone: step.tone ?? "plain",
          wrap: step.wrap ?? true,
        }));
    }
    case "task": {
      const over = time >= end;
      return [
        {
          kind: "task",
          state: over ? (step.result ?? "ok") : "running",
          text: over ? (step.done ?? step.text) : step.text,
        },
      ];
    }
    case "progress": {
      const length = end - start;
      return [
        {
          kind: "progress",
          label: step.label,
          value: length > 0 ? progressAt(local / length) * 100 : 100,
          width: step.width ?? 20,
        },
      ];
    }
    case "wait": {
      return [];
    }
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
};

/** The screen at `time` seconds into the session. */
const screenAt = (timeline: Timeline, time: number): Screen => ({
  idle: time >= timeline.total,
  lines: timeline.steps
    .filter((timed) => timed.start <= time)
    .flatMap((timed) => linesOf(timed, time)),
});

/** Changes exactly when what the screen draws changes, so the clock can skip renders. */
const screenKey = (screen: Screen): string =>
  `${screen.idle ? 1 : 0}|${screen.lines
    .map((line) => {
      switch (line.kind) {
        case "command": {
          return `${line.text.length}${line.typing ? "t" : ""}`;
        }
        case "task": {
          return line.state;
        }
        case "progress": {
          // An eighth of a cell is the smallest step the bar can draw.
          return String(Math.round((line.value / 100) * line.width * 8));
        }
        case "output": {
          return "o";
        }
        default: {
          const exhaustive: never = line;
          return exhaustive;
        }
      }
    })
    .join(",")}`;

/** The whole session as plain lines, for screen readers. */
const transcript = (
  script: readonly TerminalStep[],
  prompt: string
): string[] =>
  script.flatMap((step) => {
    switch (step.kind) {
      case "command": {
        return [`${prompt} ${step.text}`];
      }
      case "output": {
        // Art reads as noise, so `alt` can say what it is instead.
        return step.alt === undefined
          ? step.text.split("\n").map((line) => line.trim())
          : [step.alt];
      }
      case "task": {
        return [step.done ?? step.text];
      }
      case "progress": {
        return [`${step.label}: done`];
      }
      case "wait": {
        return [];
      }
      default: {
        const exhaustive: never = step;
        return exhaustive;
      }
    }
  });

/** A block cursor; it holds solid while keys land and blinks at rest. */
const Cursor = ({ blink }: { blink: boolean }) => (
  <span
    aria-hidden="true"
    className={cn(
      "inline-block w-[1ch] bg-[var(--term-ink)] align-top",
      blink && "motion-safe:animate-[term-blink_1.06s_steps(1,end)_infinite]"
    )}
    style={{ height: "var(--term-cell)" }}
  />
);

const Mark = ({ tone }: { tone: TerminalTone }) =>
  MARKS[tone] ? (
    <span
      className="inline-block w-[2ch] shrink-0"
      style={{ color: cssColor(TONE_COLORS[tone]) }}
    >
      {MARKS[tone]}
    </span>
  ) : null;

const ScreenLine = ({
  line,
  prompt,
  cell,
}: {
  line: Line;
  prompt: string;
  cell: number;
}) => {
  switch (line.kind) {
    case "command": {
      return (
        <div className="break-words whitespace-pre-wrap">
          <span style={{ color: cssColor("green") }}>{prompt} </span>
          <span className="text-[var(--term-ink)]">{line.text}</span>
          {line.typing ? <Cursor blink={false} /> : null}
        </div>
      );
    }
    case "output": {
      const color =
        line.tone === "warn" || line.tone === "error" || line.tone === "muted"
          ? cssColor(TONE_COLORS[line.tone])
          : "var(--term-ink)";
      return (
        <div
          className={cn(
            "flex",
            line.wrap
              ? "break-words whitespace-pre-wrap"
              : "overflow-hidden whitespace-pre"
          )}
        >
          <Mark tone={line.tone} />
          <span className="min-w-0" style={{ color }}>
            {line.text || " "}
          </span>
        </div>
      );
    }
    case "task": {
      return (
        <div className="flex whitespace-pre-wrap">
          <span className="inline-flex w-[2ch] shrink-0">
            {line.state === "running" ? (
              <Loader
                label={line.text}
                spinner="orbit"
                color="blue"
                cell={cell}
              />
            ) : (
              <Mark tone={line.state} />
            )}
          </span>
          <span
            className="min-w-0 break-words"
            style={{
              color:
                line.state === "error" || line.state === "warn"
                  ? cssColor(TONE_COLORS[line.state])
                  : undefined,
            }}
          >
            {line.text}
          </span>
        </div>
      );
    }
    case "progress": {
      const percent = Math.floor(line.value);
      return (
        <div className="flex flex-wrap items-center gap-x-[1ch]">
          <span className="inline-flex items-center">
            <span>[</span>
            <span className="inline-grid">
              <ProgressBar
                label={line.label}
                hideLabel
                value={line.value}
                columns={line.width}
                // ProgressBar sets its glyphs at cell / 1.17; this lands them
                // at the terminal's cell / 1.2, so the bar sits on its grid.
                cell={(cell * 1.17) / 1.2}
                color="ink"
                animate={false}
              />
            </span>
            <span>]</span>
          </span>
          <span className="w-[4ch] text-right tabular-nums">{`${percent}%`}</span>
          <span style={{ color: cssColor("grey") }}>{line.label}</span>
        </div>
      );
    }
    default: {
      const exhaustive: never = line;
      return exhaustive;
    }
  }
};

type PlayState = "playing" | "paused" | "done";

const PLAY_LABELS = {
  done: { glyph: "↻", text: "Replay" },
  paused: { glyph: "▶", text: "Play" },
  playing: { glyph: "‖", text: "Pause" },
} as const satisfies Record<PlayState, { glyph: string; text: string }>;

/** The terminal's CSS variables: cell height and text ink. */
type TerminalVars = CSSProperties &
  Record<"--term-cell" | "--term-ink", string>;

/**
 * A terminal window framed in box-drawing glyphs that plays a scripted
 * session: commands typed key by key, output streamed line by line,
 * spinners from `Loader`, block bars from `ProgressBar`, coloured ok, warn
 * and error lines, and a blinking cursor at the final prompt. It starts
 * when scrolled into view, has a pause button in its bottom border, and
 * shows the finished session as one still frame under reduced motion.
 */
export const TerminalWindow = ({
  script = DEFAULT_TERMINAL_SCRIPT,
  title = "~/acme — zsh",
  speed = 1,
  loop = true,
  rows = 18,
  prompt = "$",
  frame = "rounded",
  size = "lg",
  cell,
  color = "grey",
  className,
  style,
  ...props
}: TerminalWindowProps) => {
  const screenRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const height = cell ?? CELLS[size];
  const timeline = compile(script);
  const [play, setPlay] = useState<PlayState>("playing");
  const [time, setTime] = useState(0);
  const clock = useRef(0);
  const shownKey = useRef("");

  useFrameLoop(
    (_time, delta) => {
      const next = clock.current + delta * Math.max(0, speed);
      if (next >= timeline.total + TIMING.hold && timeline.total > 0) {
        if (loop) {
          clock.current = 0;
          shownKey.current = "";
          setTime(0);
        } else {
          clock.current = timeline.total;
          setTime(timeline.total);
          setPlay("done");
        }
        return;
      }
      clock.current = next;
      // Render only when the screen would change, not on every tick.
      const key = screenKey(screenAt(timeline, next));
      if (key !== shownKey.current) {
        shownKey.current = key;
        setTime(next);
      }
    },
    { enabled: play === "playing", fps: 30, target: screenRef }
  );

  // Under reduced motion the session is one still frame: the end.
  const shown = reduced ? timeline.total : time;
  const screen = screenAt(timeline, shown);

  // New lines push old ones off the top, as in a real terminal.
  const lineCount = screen.lines.length;
  useLayoutEffect(() => {
    const el = screenRef.current;
    if (el && lineCount >= 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lineCount, shown]);

  const toggle = () => {
    if (play === "done") {
      clock.current = 0;
      shownKey.current = "";
      setTime(0);
      setPlay("playing");
      return;
    }
    setPlay(play === "playing" ? "paused" : "playing");
  };

  const vars: TerminalVars = {
    "--term-cell": `${height}px`,
    "--term-ink": "var(--ascii-ink)",
    ...style,
  };
  const textStyle: CSSProperties = {
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / 1.2}px`,
    fontVariantLigatures: "none",
    height: `${rows * height}px`,
    letterSpacing: 0,
    lineHeight: `${height}px`,
  };
  const control = PLAY_LABELS[play];

  const titleBar: ReactNode = (
    <span className="inline-flex items-baseline gap-[1ch]">
      <span aria-hidden="true" className="tracking-[0.1em]">
        <span style={{ color: cssColor("red") }}>●</span>
        <span style={{ color: cssColor("orange") }}>●</span>
        <span style={{ color: cssColor("green") }}>●</span>
      </span>
      <span>{title}</span>
    </span>
  );

  const footer: ReactNode = reduced ? null : (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${control.text} the terminal session`}
      className="pointer-events-auto cursor-pointer px-[1ch] text-muted-foreground outline-hidden select-none hover:text-foreground focus-visible:bg-[var(--ascii-ink)] focus-visible:text-[var(--ascii-paper)]"
    >
      {`${control.glyph} ${control.text.toLowerCase()}`}
    </button>
  );

  return (
    <AsciiBox
      data-slot="terminal-window"
      frame={frame}
      title={titleBar}
      footer={footer}
      color={color}
      cell={height}
      className={cn("w-full", className)}
      style={vars}
      {...props}
    >
      <style>{"@keyframes term-blink{0%{opacity:1}50%{opacity:0}}"}</style>
      <div
        ref={screenRef}
        aria-hidden="true"
        className="overflow-hidden text-[var(--term-ink)]"
        style={textStyle}
      >
        {screen.lines.map((line, index) => (
          // Lines are positional: the nth line of the session.
          // oxlint-disable-next-line react/no-array-index-key
          <ScreenLine key={index} line={line} prompt={prompt} cell={height} />
        ))}
        {screen.idle ? (
          <div>
            <span style={{ color: cssColor("green") }}>{prompt} </span>
            <Cursor blink />
          </div>
        ) : null}
      </div>
      <div className="sr-only">
        {transcript(script, prompt).map((line, index) => (
          // oxlint-disable-next-line react/no-array-index-key
          <p key={index}>{line}</p>
        ))}
      </div>
    </AsciiBox>
  );
};
