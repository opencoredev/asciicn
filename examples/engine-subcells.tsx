"use client";

// Braille and quadrant masks are bit fields.
// oxlint-disable no-bitwise

import { useState } from "react";

import {
  BRAILLE_DOT_BITS,
  brailleChar,
  QUADRANT_BITS,
  quadrantChar,
} from "@/lib/ascii";
import { cn } from "@/lib/utils";

interface CellEditorProps {
  title: string;
  bits: readonly (readonly number[])[];
  glyph: (mask: number) => string;
  base: number;
  initial: number;
}

// A grid of sub-samples you can switch on and off, and the one glyph they pack into.
const CellEditor = ({ title, bits, glyph, base, initial }: CellEditorProps) => {
  const [mask, setMask] = useState(initial);
  const char = glyph(mask);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-5">
        <div
          className="grid gap-1.5"
          style={{
            gridTemplateColumns: `repeat(${bits[0]?.length ?? 2}, 2.25rem)`,
          }}
        >
          {bits.flatMap((row, y) =>
            row.map((bit, x) => {
              const on = (mask & bit) !== 0;
              return (
                <button
                  key={`${x}:${y}`}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Sample row ${y + 1}, column ${x + 1}`}
                  onClick={() => setMask(mask ^ bit)}
                  className={cn(
                    "border-border focus-visible:ring-ring size-9 rounded-sm border font-mono text-[10px] transition-colors outline-none focus-visible:ring-2",
                    on
                      ? "bg-ascii-ink text-background"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {bit.toString(16)}
                </button>
              );
            })
          )}
        </div>
        <span aria-hidden="true" className="text-muted-foreground font-mono">
          →
        </span>
        <span
          className="text-ascii-ink w-16 text-center font-mono text-6xl leading-none"
          aria-label={`Glyph ${char}`}
        >
          {char === " " ? " " : char}
        </span>
      </div>
      <p className="text-muted-foreground font-mono text-xs">
        {title} · mask 0x{mask.toString(16).padStart(2, "0")} · U+
        {(char.codePointAt(0) ?? base)
          .toString(16)
          .toUpperCase()
          .padStart(4, "0")}
      </p>
    </div>
  );
};

// Click samples to light them: Braille packs 2x4 into one glyph, quadrants 2x2.
export default function EngineSubcells() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-8 p-6">
      <CellEditor
        title="braille"
        bits={BRAILLE_DOT_BITS}
        glyph={brailleChar}
        base={0x28_00}
        initial={0x01 | 0x10 | 0x04 | 0x80}
      />
      <CellEditor
        title="quadrants"
        bits={QUADRANT_BITS}
        glyph={quadrantChar}
        base={0x20}
        initial={1 | 8}
      />
    </div>
  );
}
