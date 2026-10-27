"use client";

import { useEffect, useState } from "react";

import { AsciiNumber } from "@/components/asciicn/ascii-number";
import { fillStyle } from "@/lib/ascii";

export default function AsciiNumberLanding() {
  const [frames, setFrames] = useState(418_906);

  // Ticks up like a live counter once it has rolled in.
  useEffect(() => {
    const timer = setInterval(
      () => setFrames((value) => value + 120 + Math.round(Math.random() * 900)),
      3200
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative flex size-full min-h-80 flex-col items-center justify-center gap-6 overflow-hidden px-6 py-12 text-center">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-25"
        style={fillStyle("gradient", { edge: "bottom", length: 44, to: 0 })}
      />
      <span className="text-muted-foreground relative font-mono text-xs tracking-[0.16em] uppercase">
        This week
      </span>
      <AsciiNumber
        value={frames}
        locales="en-US"
        size="display"
        stagger={60}
        duration={1200}
        className="relative"
      />
      <p className="text-muted-foreground relative max-w-sm text-sm text-pretty sm:text-base">
        frames dithered by teams shipping with asciicn, counted live.
      </p>
    </section>
  );
}
