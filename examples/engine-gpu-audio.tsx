"use client";

import { useState } from "react";

import { useAudioBands } from "@/lib/ascii/audio";
import type { AudioSource } from "@/lib/ascii/audio";
import { AsciiShader } from "@/lib/ascii/shader";

// Bass swells the ring, mids bend it, treble sparks the glyphs around it.
const FIELD = `
float field(vec2 uv, vec2 res, float t) {
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0);
  float a = atan(p.y, p.x);
  float bend = sin(a * 5.0 + t) * 0.04 * (0.3 + u_audio.y * 2.0);
  float radius = 0.18 + u_audio.x * 0.16 + bend;
  float ring = smoothstep(0.07, 0.0, abs(length(p) - radius));
  // Cells are about half as wide as a res unit, so x counts double.
  vec2 cell = floor(uv * res * vec2(2.0, 1.0));
  float sparks = step(0.985 - u_audio.z * 0.08, hash21(cell + floor(t * 12.0)));
  return max(ring, sparks * 0.7);
}
`;

const SOURCES = ["off", "synth", "mic"] as const;
type Choice = (typeof SOURCES)[number];

const toSource = (choice: Choice): AudioSource =>
  choice === "off" ? null : choice;

export default function EngineGpuAudio() {
  const [choice, setChoice] = useState<Choice>("synth");
  const bands = useAudioBands(toSource(choice));
  return (
    <div className="relative size-full">
      <AsciiShader
        field={FIELD}
        audio={bands}
        charset="dense"
        palette={["--ascii-paper", "--ascii-ink"]}
        fps={60}
        stillTime={2}
        className="absolute inset-0"
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-md border bg-background/80 p-1 font-mono text-xs backdrop-blur">
        {SOURCES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={choice === option}
            onClick={() => setChoice(option)}
            className="rounded px-2 py-1 text-muted-foreground aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-2 focus-visible:outline-ring"
          >
            {option}
          </button>
        ))}
        <span className="px-2 text-muted-foreground">{bands.status}</span>
      </div>
    </div>
  );
}
