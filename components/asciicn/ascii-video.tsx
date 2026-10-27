"use client";

import { useEffect, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import { AsciiMedia, splitLook } from "@/components/asciicn/ascii-image";
import type {
  MediaDrawContext,
  MediaFit,
  MediaInput,
} from "@/components/asciicn/ascii-image";
import { useMediaElement, usePrefersReducedMotion } from "@/lib/ascii";
import type {
  AsciiHandle,
  AsciiLook,
  MutableFrame,
  ToneField,
} from "@/lib/ascii";
import { useAudioBands } from "@/lib/ascii/audio";
import type { AudioSource } from "@/lib/ascii/audio";
import { cn } from "@/lib/utils";

/**
 * Where the audio that drives `audioReactive` comes from.
 * - `track`: the video's own soundtrack (unmuted when you turn audio on).
 * - `mic`: the microphone.
 */
export type VideoAudio = "track" | "mic";

export interface AsciiVideoProps
  extends AsciiLook, Omit<ComponentProps<"div">, "children"> {
  /** A video URL, or a `File` or `Blob` the visitor picked. */
  src?: string | Blob;
  /** What the video shows, read by screen readers. */
  alt: string;
  /** Use the camera instead of `src`. Default `false`. */
  webcam?: boolean;
  /** Flip left to right. Default: on for the camera, off for files. */
  mirror?: boolean;
  /** Play on load, muted. Default `true`. */
  autoPlay?: boolean;
  /** Show play, camera and audio buttons. Default `true`. */
  controls?: boolean;
  /**
   * Let sound move the glyphs: bass lifts contrast, the overall level
   * lifts brightness and treble jitters rows. Starts off; the visitor
   * turns it on with the audio button. Default `false`.
   */
  audioReactive?: boolean;
  /** Sound source for `audioReactive`. Default `"track"`, or `"mic"` with the camera. */
  audio?: VideoAudio;
  /** How strongly sound moves the glyphs, 0 to 1. Default 0.6. */
  reactivity?: number;
  /** How the video fills its box. Default `"cover"`. */
  fit?: MediaFit;
  /** Stretch each frame's tones to use the whole ramp. Default `false`. */
  autoLevels?: boolean;
  /** Cell height in CSS pixels. Default 10. */
  cell?: number;
  /** Frames sampled per second, 12 to 60. Default 30. */
  fps?: number;
  /** Filled with a handle for export. */
  handle?: RefObject<AsciiHandle | null>;
}

type CameraState =
  | { readonly kind: "off" }
  | { readonly kind: "starting" }
  | { readonly kind: "on"; readonly stream: MediaStream }
  | { readonly kind: "failed"; readonly message: string };

const INSECURE = "the camera needs https or localhost; this page is plain http";

/** Ask for the camera, with a message a visitor can act on when it can't start. */
const openCamera = async (): Promise<CameraState> => {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return { kind: "failed", message: INSECURE };
  }
  const devices =
    typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
  if (!devices?.getUserMedia) {
    return { kind: "failed", message: "this browser has no camera access" };
  }
  try {
    const stream = await devices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        height: { ideal: 480 },
        width: { ideal: 640 },
      },
    });
    return { kind: "on", stream };
  } catch (error: unknown) {
    const denied =
      error instanceof DOMException && error.name === "NotAllowedError";
    return {
      kind: "failed",
      message: denied ? "camera permission was denied" : "no camera found",
    };
  }
};

/** Play, and resync the button if the browser refuses (autoplay rules). */
const playVideo = async (video: HTMLVideoElement, onRefused: () => void) => {
  try {
    await video.play();
  } catch {
    onRefused();
  }
};

const stopStream = (stream: MediaStream) => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const hash = (x: number, y: number) => {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43_758.5453;
  return value - Math.floor(value);
};

const BUTTON =
  "pointer-events-auto border border-foreground/25 bg-background/85 px-2 py-1 font-mono text-[11px] text-foreground leading-none outline-none transition-colors hover:bg-background focus-visible:ring-2 focus-visible:ring-ring aria-pressed:border-foreground/70";

/**
 * Video, a file or the camera, sampled into glyphs 30 times a second.
 * Plays muted and inline, so browsers allow autoplay. With
 * `audioReactive`, sound from the soundtrack or the microphone drives
 * contrast, brightness and row jitter.
 */
// oxlint-disable-next-line complexity -- prop defaults and the camera, audio and status states each add a branch.
export const AsciiVideo = (props: AsciiVideoProps) => {
  const [
    look,
    {
      src,
      alt,
      webcam = false,
      mirror,
      autoPlay = true,
      controls = true,
      audioReactive = false,
      audio,
      reactivity = 0.6,
      fit = "cover",
      autoLevels = false,
      cell = 10,
      fps = 30,
      handle,
      className,
      ...rest
    },
  ] = splitLook(props);
  const reducedMotion = usePrefersReducedMotion();
  const [cameraWanted, setCameraWanted] = useState(webcam);
  useEffect(() => setCameraWanted(webcam), [webcam]);
  const [camera, setCamera] = useState<CameraState>({ kind: "off" });

  useEffect(() => {
    if (!cameraWanted) {
      setCamera({ kind: "off" });
      return;
    }
    let cancelled = false;
    let opened: MediaStream | null = null;
    setCamera({ kind: "starting" });
    const start = async () => {
      const state = await openCamera();
      if (state.kind === "on") {
        opened = state.stream;
        if (cancelled) {
          stopStream(state.stream);
          return;
        }
      }
      if (!cancelled) {
        setCamera(state);
      }
    };
    start();
    return () => {
      cancelled = true;
      if (opened) {
        stopStream(opened);
      }
    };
  }, [cameraWanted]);

  const usingCamera = cameraWanted;
  const cameraStream = camera.kind === "on" ? camera.stream : null;
  const media = useMediaElement(usingCamera ? cameraStream : (src ?? null), {
    kind: "video",
  });
  const video =
    media.element instanceof HTMLVideoElement ? media.element : null;

  // Play state follows the element, so pausing elsewhere stays in sync.
  const [playing, setPlaying] = useState(false);
  const wantsPlay = autoPlay && !reducedMotion;
  useEffect(() => {
    if (!video) {
      setPlaying(false);
      return;
    }
    const sync = () => setPlaying(!video.paused);
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    if (wantsPlay || usingCamera) {
      playVideo(video, sync);
    } else {
      video.pause();
    }
    sync();
    return () => {
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
    };
  }, [video, wantsPlay, usingCamera]);

  const [audioOn, setAudioOn] = useState(false);
  const soundFrom: VideoAudio = audio ?? (usingCamera ? "mic" : "track");
  let audioSource: AudioSource = null;
  if (audioReactive && audioOn) {
    audioSource = soundFrom === "mic" ? "mic" : video;
  }
  const bands = useAudioBands(audioSource, { gain: 1.6, smoothing: 0.7 });
  useEffect(() => {
    if (video && !usingCamera) {
      // The soundtrack is heard only while it drives the glyphs.
      video.muted = !(audioOn && soundFrom === "track");
    }
  }, [video, audioOn, soundFrom, usingCamera]);

  let sourceKey = "camera";
  if (!usingCamera) {
    sourceKey = typeof src === "string" ? src : "blob";
  }
  const input: MediaInput | null =
    video && video.videoWidth > 0
      ? {
          element: video,
          height: video.videoHeight,
          key: sourceKey,
          width: video.videoWidth,
        }
      : null;

  const reacting = audioReactive && audioOn && bands.status === "running";
  const strength = Math.min(1, Math.max(0, reactivity));
  const pulse = (field: ToneField, _context: MediaDrawContext) => {
    const contrast = 1 + bands.bass * 1.1 * strength;
    const lift = bands.level * 0.3 * strength;
    const { tones } = field;
    for (let index = 0; index < tones.length; index += 1) {
      const tone = tones[index] ?? 0;
      if (tone > 0) {
        tones[index] = Math.min(
          1,
          Math.max(0, (tone - 0.5) * contrast + 0.5 + lift)
        );
      }
    }
  };
  const jitter = (frame: MutableFrame, context: MediaDrawContext) => {
    const { columns, rows, glyphs } = frame;
    const chance = bands.treble * 0.5 * strength;
    const tick = Math.floor(context.time * 24);
    for (let row = 0; row < rows; row += 1) {
      if (hash(row, tick) > chance) {
        continue;
      }
      const shift = hash(tick, row) > 0.5 ? 1 : -1;
      const start = row * columns;
      const line = glyphs.slice(start, start + columns);
      for (let column = 0; column < columns; column += 1) {
        glyphs[start + column] =
          line[(column - shift + columns) % columns] ?? " ";
      }
    }
  };

  let status: "loading" | "ready" | "error" = "loading";
  let message = "video unavailable";
  if (usingCamera && camera.kind === "failed") {
    status = "error";
    ({ message } = camera);
  } else if (!(usingCamera || src)) {
    status = "error";
    message = "turn on the camera to start";
  } else if (media.error) {
    status = "error";
  } else if (input) {
    status = "ready";
  }

  const togglePlay = () => {
    if (!video) {
      return;
    }
    if (video.paused) {
      playVideo(video, () => setPlaying(!video.paused));
    } else {
      video.pause();
    }
  };

  let audioLabel = "audio off";
  if (audioOn) {
    audioLabel =
      bands.status === "unavailable" || bands.status === "denied"
        ? `audio ${bands.status}`
        : `audio ${soundFrom}`;
  }

  return (
    <div
      data-state={playing ? "playing" : "paused"}
      className={cn("group/video relative overflow-hidden", className)}
      {...rest}
    >
      {/* The canvas is the picture; the buttons sit beside it, not inside the image role. */}
      <div role="img" aria-label={alt} className="absolute inset-0" />
      <AsciiMedia
        {...look}
        source={input}
        status={status}
        message={message}
        fit={fit}
        mirror={mirror ?? usingCamera}
        autoLevels={autoLevels}
        live={playing}
        animate={playing || reacting}
        fps={Math.min(60, Math.max(12, fps))}
        cell={cell}
        shape={reacting ? pulse : undefined}
        finish={reacting ? jitter : undefined}
        handle={handle}
        className="absolute inset-0"
      />
      {controls ? (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={togglePlay}
            disabled={!video}
            aria-label={playing ? "Pause video" : "Play video"}
            className={BUTTON}
          >
            {playing ? "❚❚ pause" : "▶ play"}
          </button>
          <button
            type="button"
            aria-pressed={cameraWanted}
            onClick={() => setCameraWanted((value) => !value)}
            className={BUTTON}
          >
            {cameraWanted ? "◉ camera" : "○ camera"}
          </button>
          {audioReactive ? (
            <button
              type="button"
              aria-pressed={audioOn}
              onClick={() => setAudioOn((value) => !value)}
              className={BUTTON}
            >
              ♪ {audioLabel}
            </button>
          ) : null}
        </div>
      ) : null}
      <p className="sr-only" role="status">
        {status === "error" ? message : ""}
      </p>
    </div>
  );
};
