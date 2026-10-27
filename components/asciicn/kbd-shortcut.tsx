"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ComponentProps, CSSProperties } from "react";

import { cssColor } from "@/lib/ascii";
import type { AsciiColor } from "@/lib/ascii";
import { cn } from "@/lib/utils";

/**
 * `cap` draws each key as a three-row box-drawing keycap with a heavy
 * bottom edge for depth. `inline` sets each key in brackets on one row, to
 * sit in running text.
 */
export type KbdShortcutVariant = "cap" | "inline";

/** Which keyboard to label for. `auto` reads the visitor's platform. */
export type KbdPlatform = "auto" | "mac" | "pc";

export type KbdShortcutSize = "sm" | "md" | "lg";

export interface KbdShortcutProps extends Omit<
  ComponentProps<"kbd">,
  "children" | "color"
> {
  /** The shortcut: keys joined by `+` make a chord, spaces separate steps, as in `"mod+shift+p"` or `"g i"`. `mod` is ⌘ on a Mac and Ctrl elsewhere. */
  keys: string;
  /** Keycap style. Default `"cap"`. */
  variant?: KbdShortcutVariant;
  /** Label for a Mac (`⌘ ⌥ ⇧ ⌃` symbols) or a PC (`Ctrl Alt Shift` words). Default `"auto"`. */
  platform?: KbdPlatform;
  /** Press the caps down while the visitor holds those keys. Default `false`. */
  listen?: boolean;
  /** With `listen`, called once each time the whole chord goes down. */
  onTrigger?: () => void;
  /** Frame colour: a palette name or any CSS colour. Default `"ink"`. */
  color?: AsciiColor;
  /** Glyph cell height: `sm` 12px, `md` 16px, `lg` 20px. Default `"md"`. */
  size?: KbdShortcutSize;
  /** Glyph cell height in CSS pixels. Overrides `size`. */
  cell?: number;
}

const CELLS = { lg: 20, md: 16, sm: 12 } as const satisfies Record<
  KbdShortcutSize,
  number
>;

/**
 * Font size per cell height. Cascadia Mono's box lines are 1.17em tall, so
 * at this size a cap's sides join its top and bottom edges.
 */
const GLYPH_EM = 1.17;

const PROBE = "─".repeat(10);

/** A label that is one symbol, such as ⌘ or ←, rather than a letter or a word. */
const SYMBOL = /^[^\p{L}\p{N}]$/u;

interface KeyLabel {
  /** What the cap shows on a Mac and on a PC. */
  readonly mac: string;
  readonly pc: string;
  /** What screen readers hear, when the cap shows a symbol. */
  readonly name: string;
}

/** Named keys, keyed by the canonical id a pressed key maps to. */
const NAMED = {
  alt: { mac: "⌥", name: "Option", pc: "Alt" },
  backspace: { mac: "⌫", name: "Backspace", pc: "Backspace" },
  ctrl: { mac: "⌃", name: "Control", pc: "Ctrl" },
  delete: { mac: "⌦", name: "Delete", pc: "Del" },
  down: { mac: "↓", name: "Down arrow", pc: "↓" },
  enter: { mac: "⏎", name: "Return", pc: "Enter" },
  esc: { mac: "⎋", name: "Escape", pc: "Esc" },
  left: { mac: "←", name: "Left arrow", pc: "←" },
  meta: { mac: "⌘", name: "Command", pc: "Win" },
  plus: { mac: "+", name: "Plus", pc: "+" },
  right: { mac: "→", name: "Right arrow", pc: "→" },
  shift: { mac: "⇧", name: "Shift", pc: "Shift" },
  space: { mac: "Space", name: "Space", pc: "Space" },
  tab: { mac: "⇥", name: "Tab", pc: "Tab" },
  up: { mac: "↑", name: "Up arrow", pc: "↑" },
} as const satisfies Record<string, KeyLabel>;

type NamedKey = keyof typeof NAMED;

/** Spellings people write in `keys`, mapped to a canonical id. */
const ALIASES: Readonly<Record<string, NamedKey>> = {
  arrowdown: "down",
  arrowleft: "left",
  arrowright: "right",
  arrowup: "up",
  cmd: "meta",
  command: "meta",
  control: "ctrl",
  del: "delete",
  escape: "esc",
  opt: "alt",
  option: "alt",
  return: "enter",
  super: "meta",
  win: "meta",
};

const isNamed = (id: string): id is NamedKey => Object.hasOwn(NAMED, id);

/** A key's canonical id: `"mod"` resolves per platform, letters lowercase. */
const canonical = (raw: string, mac: boolean): string => {
  const id = raw.trim().toLowerCase();
  if (id === "mod") {
    return mac ? "meta" : "ctrl";
  }
  return ALIASES[id] ?? id;
};

interface Cap {
  readonly id: string;
  readonly label: string;
  /** Spoken name, when it differs from the label. */
  readonly name: string | null;
}

const capFor = (id: string, mac: boolean): Cap => {
  if (isNamed(id)) {
    const key: KeyLabel = NAMED[id];
    const label = mac ? key.mac : key.pc;
    return { id, label, name: label === key.name ? null : key.name };
  }
  // Letters show uppercase, as printed on a keyboard; F-keys keep theirs.
  return { id, label: id.length === 1 ? id.toUpperCase() : id, name: null };
};

/** `"mod+shift+p g"` to steps of caps. `++` or a lone `+` is the plus key. */
const parseKeys = (keys: string, mac: boolean): Cap[][] =>
  keys
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((step) =>
      (step === "+" ? "plus" : step.replaceAll("++", "+plus"))
        .split("+")
        .filter(Boolean)
        .map((raw) => capFor(canonical(raw, mac), mac))
    );

/** The canonical id of a keyboard event's key, as `parseKeys` writes it. */
const eventKey = (event: KeyboardEvent): string => {
  // Letters and digits by position, so Option and Shift don't change them.
  if (event.code.startsWith("Key")) {
    return event.code.slice(3).toLowerCase();
  }
  if (event.code.startsWith("Digit")) {
    return event.code.slice(5);
  }
  const named: Readonly<Record<string, string>> = {
    " ": "space",
    Alt: "alt",
    Control: "ctrl",
    Meta: "meta",
    Shift: "shift",
  };
  return named[event.key] ?? canonical(event.key, false);
};

const MAC_PATTERN = /Mac|iPhone|iPad|iPod/;

const subscribeToNothing = () => () => {
  // The platform never changes while the page is open: nothing to undo.
};

/** Whether the visitor is on a Mac or an iOS device. `false` on the server. */
const useIsMac = (platform: KbdPlatform): boolean => {
  const detected = useSyncExternalStore(
    subscribeToNothing,
    () => MAC_PATTERN.test(navigator.userAgent),
    () => false
  );
  return platform === "auto" ? detected : platform === "mac";
};

/** The ids of the keys held down right now, while `enabled`. */
const useHeldKeys = (enabled: boolean): ReadonlySet<string> => {
  const [held, setHeld] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const update = (event: KeyboardEvent, down: boolean) => {
      const id = eventKey(event);
      setHeld((current) => {
        if (current.has(id) === down) {
          return current;
        }
        const next = new Set(current);
        if (down) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    };
    const onDown = (event: KeyboardEvent) => update(event, true);
    const onUp = (event: KeyboardEvent) => {
      // A Mac sends no keyup for other keys while ⌘ is held, so letting go
      // of ⌘ releases everything.
      if (event.key === "Meta") {
        setHeld(new Set());
        return;
      }
      update(event, false);
    };
    // Keys released in another window never send keyup here.
    const clear = () => setHeld(new Set());
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      setHeld(new Set());
    };
  }, [enabled]);
  return held;
};

/**
 * Width of a box glyph, from a run of them; `null` until measured. Box
 * glyphs often come from a different font than the labels, so cap widths
 * use this rather than `ch`.
 */
const useGlyphAdvance = () => {
  const probeRef = useRef<HTMLSpanElement>(null);
  const [advance, setAdvance] = useState<number | null>(null);
  useLayoutEffect(() => {
    const probe = probeRef.current;
    if (!probe) {
      return;
    }
    const measure = () => {
      const width = probe.getBoundingClientRect().width / PROBE.length;
      if (width > 0) {
        setAdvance(width);
      }
    };
    measure();
    // A web font that loads late or a zoom change resizes the probe.
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);
  return { advance, probeRef };
};

/** Frame glyphs in the muted frame colour, hidden from screen readers. */
const edge = (glyph: string) => (
  <span aria-hidden="true" className="text-[var(--kbd-frame)] select-none">
    {glyph}
  </span>
);

const KeyCap = ({
  cap,
  variant,
  pressed,
}: {
  cap: Cap;
  variant: KbdShortcutVariant;
  pressed: boolean;
}) => {
  // One cell of padding each side of the label, so the edges match it.
  const run = [...cap.label].length + 2;
  const inline = variant === "inline";
  const label = (
    <span
      className={cn("inline-block text-center", inline && "px-[0.25ch]")}
      style={{
        ...(pressed
          ? { backgroundColor: "var(--kbd-ink)", color: "var(--ascii-paper)" }
          : undefined),
        width: inline ? undefined : `calc(var(--kbd-cw) * ${run})`,
      }}
    >
      <span
        aria-hidden={cap.name ? true : undefined}
        // Fallback fonts draw ⌘ ⇧ ⌥ and arrows small; lift them to cap height.
        className={SYMBOL.test(cap.label) ? "text-[1.3em]" : undefined}
      >
        {cap.label}
      </span>
      {cap.name ? <span className="sr-only">{cap.name}</span> : null}
    </span>
  );
  if (inline) {
    return (
      <kbd
        data-pressed={pressed ? "" : undefined}
        className="inline-flex font-[inherit]"
      >
        {edge("[")}
        {label}
        {edge("]")}
      </kbd>
    );
  }

  return (
    <kbd
      data-pressed={pressed ? "" : undefined}
      // Browsers set kbd in their own monospace; keep the glyph font.
      className="inline-flex flex-col font-[inherit]"
    >
      {edge(`┌${"─".repeat(run)}┐`)}
      <span className="inline-flex">
        {edge("│")}
        {label}
        {edge("│")}
      </span>
      {/* The heavy bottom edge is the key's depth; pressed, it goes flat. */}
      {edge(pressed ? `└${"─".repeat(run)}┘` : `┕${"━".repeat(run)}┙`)}
    </kbd>
  );
};

/** The shortcut's CSS variables: the label ink and the muted frame. */
type KbdVars = CSSProperties &
  Record<"--kbd-ink" | "--kbd-frame" | "--kbd-cw", string>;

/**
 * A keyboard shortcut drawn as box-drawing keycaps, with a heavy bottom
 * edge for depth. Chords like `mod+shift+p` read `⌘ ⇧ P` on a Mac and
 * `Ctrl + Shift + P` elsewhere, and with `listen` the caps press down
 * while the visitor holds the keys. Real `<kbd>` text, so it copies and
 * reads aloud as the key names.
 */
export const KbdShortcut = ({
  keys,
  variant = "cap",
  platform = "auto",
  listen = false,
  onTrigger,
  color = "ink",
  size = "md",
  cell,
  className,
  style,
  ...props
}: KbdShortcutProps) => {
  const mac = useIsMac(platform);
  const steps = parseKeys(keys, mac);
  const held = useHeldKeys(listen);
  const height = cell ?? CELLS[size];
  const ink = cssColor(color);
  const { advance, probeRef } = useGlyphAdvance();

  // Fire once as the last key of a one-step chord goes down.
  const chord = steps.length === 1 ? (steps[0] ?? []) : [];
  const complete = chord.length > 0 && chord.every((cap) => held.has(cap.id));
  useEffect(() => {
    if (complete) {
      onTrigger?.();
    }
  }, [complete, onTrigger]);

  const vars: KbdVars = {
    // Before measuring: Cascadia Mono's advance, 0.586em, at this font size.
    "--kbd-cw":
      advance === null ? `${(height / GLYPH_EM) * 0.586}px` : `${advance}px`,
    // Opaque, so the edges where neighbouring glyphs overlap don't double up.
    "--kbd-frame": `color-mix(in oklab, ${ink} 55%, var(--ascii-paper))`,
    "--kbd-ink": ink,
    color: ink,
    fontFamily: "var(--ascii-font, monospace)",
    fontSize: `${height / GLYPH_EM}px`,
    fontVariantLigatures: "none",
    letterSpacing: 0,
    lineHeight: `${height}px`,
    ...style,
  };

  return (
    <kbd
      data-slot="kbd-shortcut"
      className={cn(
        "relative inline-flex flex-wrap items-center gap-x-[1ch] gap-y-[0.5em] align-middle font-normal whitespace-pre",
        className
      )}
      style={vars}
      {...props}
    >
      <span
        ref={probeRef}
        aria-hidden="true"
        className="invisible absolute top-0 left-0"
      >
        {PROBE}
      </span>
      {steps.map((step, stepIndex) => (
        // Steps are positional: the same key may appear twice, as in "g g".
        // oxlint-disable-next-line react/no-array-index-key
        <Fragment key={stepIndex}>
          {stepIndex > 0 ? (
            <span className="text-[var(--kbd-frame)]">then</span>
          ) : null}
          {step.map((cap, capIndex) => (
            // oxlint-disable-next-line react/no-array-index-key
            <Fragment key={capIndex}>
              {capIndex > 0 && !mac ? (
                <span className="text-[var(--kbd-frame)]">+</span>
              ) : null}
              <KeyCap cap={cap} variant={variant} pressed={held.has(cap.id)} />
            </Fragment>
          ))}
        </Fragment>
      ))}
    </kbd>
  );
};
