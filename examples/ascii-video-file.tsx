"use client";

import { useState } from "react";

import { AsciiVideo } from "@/components/asciicn/ascii-video";

export default function AsciiVideoFile() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="flex w-full max-w-xl flex-col gap-3">
      <label className="flex items-center gap-3 font-mono text-xs">
        <span className="text-muted-foreground">open a video</span>
        <input
          type="file"
          accept="video/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="text-xs file:mr-3 file:border file:bg-background file:px-2 file:py-1 file:font-mono file:text-foreground"
        />
      </label>
      <AsciiVideo
        src={file ?? "/examples/video/liftoff.mp4"}
        alt={
          file ? `Your video, ${file.name}, in glyphs` : "Apollo 11 lifting off"
        }
        charset="blocks"
        colorMode="ansi16"
        ansi="xterm"
        cell={10}
        className="aspect-video w-full"
      />
    </div>
  );
}
