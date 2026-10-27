"use client";

import { useRef, useState } from "react";

import { ScrollRevealImage } from "@/components/asciicn/scroll-reveal-image";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/scroll-reveal-image-controls";

const Lines = ({ widths }: { widths: readonly string[] }) => (
  <div aria-hidden className="flex flex-col gap-2">
    {widths.map((width) => (
      <div key={width} className="h-2 bg-muted" style={{ width }} />
    ))}
  </div>
);

export default function ScrollRevealImageDemo() {
  const to = usePreviewValue(knobs.to);
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  return (
    <div className="relative w-full max-w-lg">
      <div
        ref={scrollRef}
        // Browsers make scroll containers keyboard-focusable on their own.
        role="region"
        aria-label="Sample article. Scroll to resolve the photo."
        className="h-[420px] overflow-y-auto overscroll-contain border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-col gap-6 px-6 pt-8 pb-48">
          <span className="font-mono text-muted-foreground text-xs">
            scroll this article ↓
          </span>
          <h3 className="text-balance font-medium text-2xl tracking-tight">
            The range Ansel Adams came back to
          </h3>
          <Lines widths={["100%", "94%", "97%", "62%"]} />
          <Lines widths={["98%", "100%", "88%", "92%", "40%"]} />
          <div className="h-40" />
          <ScrollRevealImage
            src="/examples/tetons.jpg"
            alt="The Grand Teton range above a bend in the Snake River"
            to={to}
            charset={charset === "sweep" ? undefined : charset}
            colorMode={colorMode}
            scrollRoot={scrollRef}
            onProgressChange={setProgress}
            className="aspect-[5/4] w-full"
          />
          <Lines widths={["96%", "100%", "71%"]} />
        </div>
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-2 border bg-background/85 px-2 py-1 font-mono text-[11px] tabular-nums"
      >
        <span className="text-muted-foreground">resolve</span>
        <span>{String(Math.round(progress * 100)).padStart(3, " ")}%</span>
      </div>
    </div>
  );
}
