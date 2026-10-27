"use client";

import { useState } from "react";

import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid, CHARSET_NAMES, CHARSETS } from "@/lib/ascii";
import type { CharsetName } from "@/lib/ascii";

const Tile = ({ charset }: { charset: CharsetName }) => {
  const [draw] = useState(createPlanetDraw);
  const { label, grid } = CHARSETS[charset];
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="border-border relative aspect-[4/3] overflow-hidden rounded-md border">
        <AsciiGrid
          className="absolute inset-0"
          cell={9}
          fps={20}
          draw={(context) => draw(context, { charset })}
        />
      </div>
      <figcaption className="flex flex-col font-mono text-xs leading-snug">
        <span className="text-foreground">{charset}</span>
        <span className="text-muted-foreground truncate">
          {label}
          {grid[0] * grid[1] > 1 ? ` · ${grid[0] * grid[1]} per cell` : ""}
        </span>
      </figcaption>
    </figure>
  );
};

// The same planet in every built-in charset.
export default function EngineCharsets() {
  return (
    <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] content-center gap-3 p-4">
      {CHARSET_NAMES.map((charset) => (
        <Tile key={charset} charset={charset} />
      ))}
    </div>
  );
}
