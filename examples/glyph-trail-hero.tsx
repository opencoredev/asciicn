"use client";

import { useState } from "react";

import { GlyphTrail } from "@/components/asciicn/glyph-trail";
import { Button } from "@/components/ui/button";

export default function GlyphTrailHero() {
  const [count, setCount] = useState(0);
  return (
    <GlyphTrail
      decay={2.2}
      className="flex h-[420px] w-full flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <p className="text-muted-foreground font-mono text-xs tracking-[0.3em] uppercase">
        Move the pointer
      </p>
      <h3 className="max-w-md text-3xl font-semibold tracking-tight text-balance">
        Every move leaves a mark
      </h3>
      <Button className="mt-2" onClick={() => setCount((value) => value + 1)}>
        {count === 0 ? "Click through the trail" : `Clicked ${count}×`}
      </Button>
    </GlyphTrail>
  );
}
