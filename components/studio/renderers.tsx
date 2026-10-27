"use client";

/**
 * What draws on the Studio stage. Component sources (backgrounds, 3D
 * objects, cities) load on demand and take the look as props, so changing
 * a control re-renders without remounting. Media sources are sampled on
 * the CPU with the engine's `sampleToField` and drawn by an `AsciiGrid`.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import { mapOptions, monoColors, renderProps } from "@/components/studio/look";
import {
  applyInteraction,
  createInteractionState,
  drawBanner,
  studioCharset,
} from "@/components/studio/media";
import type {
  FieldSource,
  MediaSource,
  SceneSource,
  StudioComponent,
} from "@/components/studio/sources";
import { IMAGE_PRESETS } from "@/components/studio/state";
import type { Look, MediaSettings } from "@/components/studio/state";
import type { AudioBands } from "@/lib/ascii/audio";
import { CrtOverlay } from "@/lib/ascii/crt";
import { mapTones } from "@/lib/ascii/frame";
import type { AsciiHandle, ToneField } from "@/lib/ascii/frame";
import { AsciiGrid } from "@/lib/ascii/grid";
import type { AsciiGridDrawContext } from "@/lib/ascii/grid";
import { autoLevels, sampleToField, sourceSize } from "@/lib/ascii/sample";

/** A message the stage shows over the canvas. */
export type StageNotice =
  | { readonly kind: "none" }
  | { readonly kind: "loading"; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

const NONE: StageNotice = { kind: "none" };

type LoadState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly Component: StudioComponent }
  | { readonly kind: "error"; readonly message: string };

/** Load a component source, reporting progress to the stage. */
const useSourceComponent = (
  source: FieldSource | SceneSource,
  onNotice: (notice: StageNotice) => void
): LoadState => {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const { load, label } = source;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!load) {
        setState({
          kind: "error",
          message: `${label} is still being built. Pick another source for now.`,
        });
        return;
      }
      setState({ kind: "loading" });
      try {
        const Component = await load();
        if (!cancelled) {
          setState({ Component, kind: "ready" });
        }
      } catch {
        if (!cancelled) {
          setState({ kind: "error", message: `${label} failed to load.` });
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [load, label]);

  useEffect(() => {
    if (state.kind === "loading") {
      onNotice({ kind: "loading", message: `Loading ${label}` });
    } else if (state.kind === "error") {
      onNotice({ kind: "error", message: state.message });
    } else {
      onNotice(NONE);
    }
  }, [state, label, onNotice]);

  return state;
};

export const ComponentRenderer = ({
  source,
  look,
  seed,
  paused,
  audio,
  handle,
  onNotice,
}: {
  source: FieldSource | SceneSource;
  look: Look;
  /** Seeded backgrounds: the seed, or empty for the component's own. */
  seed: string;
  paused: boolean;
  audio: AudioBands | null;
  handle: RefObject<AsciiHandle | null>;
  onNotice: (notice: StageNotice) => void;
}) => {
  const state = useSourceComponent(source, onNotice);

  // Stable objects, so moving one slider doesn't hand the renderer a new
  // grade every render.
  const { brightness, contrast, gamma, saturation } = look;
  const grade = useMemo(
    () => ({ brightness, contrast, gamma, saturation }),
    [brightness, contrast, gamma, saturation]
  );

  if (state.kind !== "ready") {
    return null;
  }
  const { Component } = state;
  const seeded =
    source.kind === "field" && source.seeded && seed !== "" ? { seed } : {};
  return (
    <Component
      {...renderProps(look)}
      {...seeded}
      grade={grade}
      fx={look.fx}
      audio={audio}
      animate={!paused}
      fps={60}
      handle={handle}
      className="absolute inset-0"
    />
  );
};

/** Where the media renderer reads from. */
export type MediaInput =
  | { readonly kind: "image"; readonly src: string }
  | { readonly kind: "video"; readonly src: string }
  | { readonly kind: "webcam" }
  | { readonly kind: "text" };

/** The input for a media source, given any uploaded file. */
export const mediaInput = (
  source: MediaSource,
  media: MediaSettings,
  upload: { readonly kind: "image" | "video"; readonly url: string } | null
): MediaInput | null => {
  switch (source.id) {
    case "image": {
      if (upload?.kind === "image") {
        return { kind: "image", src: upload.url };
      }
      const preset =
        IMAGE_PRESETS.find((item) => item.id === media.image) ??
        IMAGE_PRESETS[0];
      return { kind: "image", src: preset.src };
    }
    case "video": {
      if (upload?.kind === "video") {
        return { kind: "video", src: upload.url };
      }
      return media.video === "" ? null : { kind: "video", src: media.video };
    }
    case "webcam": {
      return { kind: "webcam" };
    }
    case "text": {
      return { kind: "text" };
    }
    default: {
      const exhaustive: never = source.id;
      return exhaustive;
    }
  }
};

const inputKey = (input: MediaInput | null) => {
  if (input === null) {
    return "none";
  }
  if (input.kind === "image" || input.kind === "video") {
    return `${input.kind}:${input.src}`;
  }
  return input.kind;
};

const SECURE_CAMERA =
  "The camera needs a secure page (https or localhost). This preview is plain http, so the browser blocks it. Open the Studio on asciicn.dev to use your webcam.";

const cameraMessage = (error: unknown) => {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Camera access was blocked. Allow it in the address bar, then start the camera again.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "No camera found on this device.";
  }
  return "The camera could not start.";
};

const playQuietly = async (video: HTMLVideoElement) => {
  try {
    await video.play();
  } catch {
    // Autoplay can be refused until the user interacts; the next play wins.
  }
};

/** An element the sampler can read, and whether to mirror it. */
interface Pixels {
  readonly element: CanvasImageSource;
  readonly mirror: boolean;
}

const loadImage = async (src: string): Promise<HTMLImageElement> => {
  const image = new Image();
  image.decoding = "async";
  image.src = src;
  await image.decode();
  return image;
};

/** Reads `input` into an element the sampler can use, reporting progress. */
const usePixels = (
  input: MediaInput | null,
  idleMessage: string,
  { paused, speed }: { paused: boolean; speed: number },
  onNotice: (notice: StageNotice) => void
) => {
  const pixelsRef = useRef<Pixels | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const key = inputKey(input);

  useEffect(() => {
    pixelsRef.current = null;
    videoRef.current = null;
    if (input === null) {
      onNotice({ kind: "error", message: idleMessage });
      return;
    }
    if (input.kind === "text") {
      onNotice(NONE);
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    const video = document.createElement("video");

    const start = async () => {
      if (input.kind === "image") {
        onNotice({ kind: "loading", message: "Loading image" });
        try {
          const image = await loadImage(input.src);
          if (!cancelled) {
            pixelsRef.current = { element: image, mirror: false };
            onNotice(NONE);
          }
        } catch {
          if (!cancelled) {
            onNotice({
              kind: "error",
              message: "That image could not be read.",
            });
          }
        }
        return;
      }

      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      videoRef.current = video;
      video.addEventListener("loadeddata", () => {
        if (!cancelled) {
          pixelsRef.current = {
            element: video,
            mirror: input.kind === "webcam",
          };
          onNotice(NONE);
        }
      });

      if (input.kind === "video") {
        onNotice({ kind: "loading", message: "Loading video" });
        video.addEventListener("error", () => {
          if (!cancelled) {
            onNotice({
              kind: "error",
              message:
                "That video could not be played. Check the URL, or that its server allows cross-origin use.",
            });
          }
        });
        video.src = input.src;
        await playQuietly(video);
        return;
      }

      if (!(window.isSecureContext && navigator.mediaDevices)) {
        onNotice({ kind: "error", message: SECURE_CAMERA });
        return;
      }
      onNotice({ kind: "loading", message: "Waiting for the camera" });
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user" },
        });
      } catch (error) {
        if (!cancelled) {
          onNotice({ kind: "error", message: cameraMessage(error) });
        }
        return;
      }
      if (cancelled) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }
      video.srcObject = stream;
      await playQuietly(video);
    };
    void start();

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute("src");
      video.srcObject = null;
      for (const track of stream?.getTracks() ?? []) {
        track.stop();
      }
    };
    // `key` stands in for `input`, which is a new object every render.
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- see above.
  }, [key, idleMessage, onNotice]);

  // Pause and speed apply to video; the camera only pauses.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (paused || speed === 0) {
      video.pause();
      return;
    }
    if (!video.srcObject) {
      video.playbackRate = Math.min(4, Math.max(0.25, speed));
    }
    void playQuietly(video);
  }, [paused, speed, key]);

  return pixelsRef;
};

const CORS_MESSAGE =
  "That video's server doesn't let its pixels be read (no CORS headers). Download it and choose the file instead.";

/** Ink and paper for the media grid, from the look. */
const gridColors = (look: Look) => {
  const mono = look.colorMode === "mono" ? monoColors(look.ink) : null;
  return {
    ink: mono?.ink ?? "--ascii-ink",
    paper:
      look.background === "transparent"
        ? "transparent"
        : (mono?.paper ?? "--ascii-paper"),
  };
};

export const MediaRenderer = ({
  source,
  input,
  idleMessage,
  look,
  media,
  paused,
  audio,
  handle,
  onNotice,
}: {
  source: MediaSource;
  input: MediaInput | null;
  /** Shown while there is no input yet. */
  idleMessage: string;
  look: Look;
  media: MediaSettings;
  paused: boolean;
  audio: AudioBands | null;
  handle: RefObject<AsciiHandle | null>;
  onNotice: (notice: StageNotice) => void;
}) => {
  const pixelsRef = usePixels(
    input,
    idleMessage,
    { paused, speed: look.speed },
    onNotice
  );
  const fieldRef = useRef<ToneField | null>(null);
  const interactionRef = useRef(createInteractionState());
  const bannerRef = useRef<{ canvas: HTMLCanvasElement; key: string } | null>(
    null
  );
  const failedRef = useRef(false);

  useEffect(() => {
    failedRef.current = false;
  }, [input]);

  /** The banner canvas for the text source, redrawn when its inputs change. */
  const banner = (aspect: number): Pixels => {
    bannerRef.current ??= {
      canvas: document.createElement("canvas"),
      key: "",
    };
    const { current } = bannerRef;
    const key = `${media.text}|${media.font}|${media.weight}|${aspect.toFixed(3)}`;
    if (current.key !== key) {
      drawBanner(current.canvas, {
        aspect,
        font: media.font,
        text: media.text,
        weight: media.weight,
      });
      current.key = key;
    }
    return { element: current.canvas, mirror: false };
  };

  const sample = (
    pixels: Pixels,
    columns: number,
    rows: number,
    aspect: number
  ): ToneField | null => {
    const { width } = sourceSize(pixels.element);
    if (width === 0) {
      return null;
    }
    try {
      return sampleToField(pixels.element, {
        aspect,
        charset: studioCharset(look.charset, look.chars),
        columns,
        into: fieldRef.current ?? undefined,
        mirror: pixels.mirror,
        rows,
      });
    } catch {
      // A cross-origin video without CORS headers taints the canvas.
      if (!failedRef.current) {
        failedRef.current = true;
        onNotice({ kind: "error", message: CORS_MESSAGE });
      }
      return null;
    }
  };

  const draw = ({
    frame,
    columns,
    rows,
    metrics,
    pointer,
    time,
    delta,
  }: AsciiGridDrawContext) => {
    const aspect = (columns * metrics.width) / (rows * metrics.height);
    const pixels = source.id === "text" ? banner(aspect) : pixelsRef.current;
    const field = pixels ? sample(pixels, columns, rows, aspect) : null;
    if (!field) {
      return;
    }
    fieldRef.current = field;
    if (media.levels && source.id !== "text") {
      autoLevels(field);
    }
    if (look.interaction !== "none") {
      applyInteraction(field, interactionRef.current, {
        cellAspect: metrics.width / metrics.height,
        delta,
        grid: studioCharset(look.charset, look.chars).grid,
        interaction: look.interaction,
        pointer,
        time,
      });
    }
    const options = mapOptions(look);
    if (audio && audio.level > 0) {
      const grade = options.grade ?? {};
      options.grade = {
        ...grade,
        brightness: (grade.brightness ?? 0) + audio.level * 0.25,
        contrast: (grade.contrast ?? 1) * (1 + audio.bass * 0.8),
      };
    }
    mapTones(field, columns, rows, options, frame);
  };

  const { ink, paper } = gridColors(look);
  return (
    <>
      <AsciiGrid
        draw={draw}
        cell={look.cell}
        ink={ink}
        paper={paper}
        colored={look.colorMode !== "mono" && look.colorMode !== "native"}
        speed={look.speed}
        animate={!paused}
        fps={30}
        interactive={look.interaction !== "none"}
        handle={handle}
        className="absolute inset-0"
      />
      <CrtOverlay fx={look.fx} />
    </>
  );
};
