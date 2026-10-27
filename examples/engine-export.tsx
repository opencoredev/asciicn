"use client";

import { useRef, useState } from "react";

import { createPlanetDraw } from "@/examples/engine-scene";
import { AsciiGrid } from "@/lib/ascii";
import type { AsciiHandle } from "@/lib/ascii";
import {
  copyText,
  createRecorder,
  downloadBlob,
  downloadText,
  toAnsi,
  toPng,
  toSvg,
  toText,
  videoExtension,
} from "@/lib/ascii/export";
import type { CanvasRecorder } from "@/lib/ascii/export";

const BUTTON =
  "border-border hover:bg-muted focus-visible:ring-ring rounded-sm border px-2.5 py-1 outline-none focus-visible:ring-2 disabled:opacity-50";

// Every export the engine has, from one handle.
export default function EngineExport() {
  const handle = useRef<AsciiHandle | null>(null);
  const recorder = useRef<CanvasRecorder | null>(null);
  const [draw] = useState(createPlanetDraw);
  const [status, setStatus] = useState("ready");
  const [recording, setRecording] = useState(false);

  const frame = () => handle.current?.capture() ?? null;

  const save = async (kind: "copy" | "txt" | "ans" | "svg" | "png") => {
    const current = frame();
    const live = handle.current;
    if (!(current && live)) {
      return;
    }
    const colors = live.colors();
    const metrics = live.metrics() ?? undefined;
    switch (kind) {
      case "copy": {
        const copied = await copyText(toText(current, { trimEnd: true }));
        setStatus(copied ? "copied text" : "copy refused");
        break;
      }
      case "txt": {
        downloadText(toText(current, { trimEnd: true }), "planet.txt");
        setStatus(`planet.txt · ${current.columns}×${current.rows}`);
        break;
      }
      case "ans": {
        downloadText(toAnsi(current, { mode: "truecolor" }), "planet.ans");
        setStatus("planet.ans · cat it in a terminal");
        break;
      }
      case "svg": {
        downloadText(
          toSvg(current, {
            ink: colors.ink,
            metrics,
            paper: colors.paper ?? "#07070b",
          }),
          "planet.svg",
          "image/svg+xml"
        );
        setStatus("planet.svg");
        break;
      }
      case "png": {
        const blob = await toPng(live, {
          paper: colors.paper ?? "#07070b",
          scale: 3,
        });
        downloadBlob(blob, "planet.png");
        setStatus(`planet.png · ${Math.round(blob.size / 1024)} KB`);
        break;
      }
      default: {
        const exhaustive: never = kind;
        return exhaustive;
      }
    }
  };

  const toggleRecording = async () => {
    const canvas = handle.current?.canvas;
    if (recording && recorder.current) {
      const video = await recorder.current.stop();
      recorder.current = null;
      setRecording(false);
      downloadBlob(video, `planet.${videoExtension(video.type)}`);
      setStatus(
        `planet.${videoExtension(video.type)} · ${Math.round(video.size / 1024)} KB`
      );
      return;
    }
    if (!canvas) {
      return;
    }
    try {
      recorder.current = createRecorder(canvas, {
        onProgress: (ms) => setStatus(`recording ${(ms / 1000).toFixed(1)}s`),
      });
      recorder.current.start();
      setRecording(true);
    } catch {
      setStatus("this browser can't record a canvas");
    }
  };

  return (
    <div className="relative size-full">
      <AsciiGrid
        className="absolute inset-0"
        cell={12}
        colored
        paper="#07070b"
        fps={60}
        handle={handle}
        draw={(context) =>
          draw(context, { charset: "standard", colorMode: "truecolor" })
        }
      />
      <div className="bg-background/90 absolute inset-x-3 bottom-3 flex flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 font-mono text-xs backdrop-blur-sm sm:inset-x-auto sm:right-4 sm:bottom-4">
        <button type="button" className={BUTTON} onClick={() => save("copy")}>
          copy
        </button>
        <button type="button" className={BUTTON} onClick={() => save("txt")}>
          .txt
        </button>
        <button type="button" className={BUTTON} onClick={() => save("ans")}>
          .ans
        </button>
        <button type="button" className={BUTTON} onClick={() => save("svg")}>
          .svg
        </button>
        <button type="button" className={BUTTON} onClick={() => save("png")}>
          .png
        </button>
        <button
          type="button"
          aria-pressed={recording}
          className={BUTTON}
          onClick={toggleRecording}
        >
          {recording ? "■ stop" : "● rec"}
        </button>
        <span
          aria-live="polite"
          className="text-muted-foreground ml-1 min-w-0 truncate"
        >
          {status}
        </span>
      </div>
    </div>
  );
}
