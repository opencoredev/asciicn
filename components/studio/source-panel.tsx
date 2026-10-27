"use client";

/**
 * The Source panel: what's on the stage, the media inputs for the chosen
 * source, and the audio that drives it.
 */

import { useEffect, useId, useRef, useState } from "react";

import {
  GlyphSlider,
  PanelButton,
  Section,
  Segmented,
  Toggle,
} from "@/components/studio/fields";
import type { SourceId } from "@/components/studio/source-ids";
import { SOURCE_GROUPS, SOURCES } from "@/components/studio/sources";
import type { StudioSource } from "@/components/studio/sources";
import { IMAGE_PRESETS, TEXT_FONTS } from "@/components/studio/state";
import type { MediaSettings } from "@/components/studio/state";
import type { AudioBands } from "@/lib/ascii/audio";
import { eighthsBar } from "@/lib/ascii/charsets";
import { cn } from "@/lib/utils";

/** Where the audio input comes from. */
export type AudioMode = "off" | "synth" | "mic";

const audioProblem = (mode: AudioMode, status: AudioBands["status"]) => {
  if (status === "denied") {
    return "Microphone access was blocked. Allow it in the address bar, then pick mic again.";
  }
  if (status === "unavailable" && mode === "mic") {
    return "The microphone needs a secure page (https or localhost). This preview is plain http, so the browser hides it.";
  }
  if (status === "unavailable") {
    return "This browser has no Web Audio.";
  }
  return null;
};

const SourceList = ({
  value,
  onChange,
}: {
  value: SourceId;
  onChange: (id: SourceId) => void;
}) => {
  const name = useId();
  return (
    <div className="flex flex-col">
      {SOURCE_GROUPS.map((group) => (
        <fieldset key={group.id} className="px-3 py-2.5">
          <legend className="label-caps text-muted-foreground mb-2 pt-1">
            {group.label}
          </legend>
          <div className="grid grid-cols-2 gap-1">
            {SOURCES.filter((source) => source.group === group.id).map(
              (source) => {
                const pending = source.kind === "field" && source.load === null;
                return (
                  <label
                    key={source.id}
                    title={source.hint}
                    className={cn(
                      "border-rule text-foreground/80 hover:text-foreground hover:bg-muted/50 relative flex h-8 cursor-pointer items-center gap-1.5 rounded-[3px] border px-2 text-[11px] transition-colors duration-100 select-none",
                      "has-[:checked]:bg-foreground has-[:checked]:text-background has-[:checked]:border-foreground",
                      "has-[:focus-visible]:outline-ring has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1"
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      checked={value === source.id}
                      onChange={() => onChange(source.id)}
                      className="sr-only"
                    />
                    <span className="truncate">{source.label}</span>
                    {pending ? (
                      <span className="ms-auto text-[9px] opacity-60">
                        soon
                      </span>
                    ) : null}
                  </label>
                );
              }
            )}
          </div>
        </fieldset>
      ))}
    </div>
  );
};

/** A file picker drawn as a panel button. */
const FileButton = ({
  accept,
  label,
  onFile,
}: {
  accept: string;
  label: string;
  onFile: (file: File) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <PanelButton onClick={() => inputRef.current?.click()} className="w-full">
        {label}
      </PanelButton>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            onFile(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </>
  );
};

const VideoUrl = ({
  value,
  onCommit,
}: {
  value: string;
  onCommit: (url: string) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const valid = draft === "" || /^https?:\/\/\S+$/iu.test(draft);
  return (
    <form
      className="grid gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) {
          onCommit(draft.trim());
        }
      }}
    >
      <label htmlFor={id} className="text-foreground/80 text-xs">
        Video URL
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://…/clip.mp4"
          value={draft}
          aria-invalid={!valid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => setDraft(event.currentTarget.value)}
          className="border-rule bg-background focus-visible:outline-ring aria-invalid:border-destructive h-8 min-w-0 flex-1 rounded-[3px] border px-2 text-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
        />
        <PanelButton type="submit" className="h-8" disabled={!valid}>
          Load
        </PanelButton>
      </div>
      <p
        id={`${id}-hint`}
        className={cn(
          "text-[11px] text-pretty",
          valid ? "text-muted-foreground" : "text-destructive"
        )}
      >
        {valid
          ? "The server must allow cross-origin use, or the pixels can't be read."
          : "Use an http or https address."}
      </p>
    </form>
  );
};

/** Any string reshapes a seeded background. */
const SeedInput = ({
  value,
  fallback,
  onCommit,
}: {
  value: string;
  /** The component's own seed, shown as the placeholder. */
  fallback: string;
  onCommit: (seed: string) => void;
}) => {
  const id = useId();
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-foreground/80 text-xs">
        Seed text
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          value={value}
          maxLength={48}
          placeholder={fallback}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => onCommit(event.currentTarget.value)}
          className="border-rule bg-background focus-visible:outline-ring h-8 min-w-0 flex-1 rounded-[3px] border px-2 text-xs outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
        />
        <PanelButton
          className="h-8"
          onClick={() => onCommit(Math.random().toString(36).slice(2, 8))}
        >
          Shuffle
        </PanelButton>
      </div>
      <p className="text-muted-foreground text-[11px] text-pretty">
        Any word gives its own palette, shapes and motion.
      </p>
    </div>
  );
};

const insecureMessage =
  "This page is plain http, so the browser blocks the camera. It works on https and localhost, such as asciicn.dev/studio.";

const WebcamControls = ({
  on,
  onToggle,
}: {
  on: boolean;
  onToggle: (on: boolean) => void;
}) => {
  const [secure, setSecure] = useState(true);
  useEffect(() => {
    setSecure(window.isSecureContext && Boolean(navigator.mediaDevices));
  }, []);
  return (
    <div className="grid gap-2">
      <PanelButton
        active={on}
        disabled={!secure}
        onClick={() => onToggle(!on)}
        className="w-full"
      >
        {on ? "Stop camera" : "Start camera"}
      </PanelButton>
      <p
        className={cn(
          "text-[11px] text-pretty",
          secure ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {secure
          ? "Frames stay in this tab. Nothing is uploaded or saved."
          : insecureMessage}
      </p>
    </div>
  );
};

const TextControls = ({
  media,
  onChange,
}: {
  media: MediaSettings;
  onChange: (patch: Partial<MediaSettings>) => void;
}) => {
  const id = useId();
  return (
    <div className="grid gap-2.5">
      <div className="grid gap-1">
        <label htmlFor={id} className="text-foreground/80 text-xs">
          Banner text
        </label>
        <textarea
          id={id}
          rows={2}
          maxLength={64}
          value={media.text}
          onChange={(event) => onChange({ text: event.currentTarget.value })}
          className="border-rule bg-background focus-visible:outline-ring resize-none rounded-[3px] border px-2 py-1.5 text-[13px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1"
        />
        <p className="text-muted-foreground text-[11px]">
          A new line starts a second row.
        </p>
      </div>
      <Segmented
        label="Typeface"
        value={media.font}
        options={TEXT_FONTS.map((value) => ({ label: value, value }))}
        onChange={(font) => onChange({ font })}
      />
      <GlyphSlider
        label="Weight"
        value={media.weight}
        min={100}
        max={900}
        step={100}
        onChange={(weight) => onChange({ weight })}
      />
    </div>
  );
};

/** Four live bars for the audio bands, redrawn every frame without React. */
const AudioMeter = ({ bands }: { bands: AudioBands }) => {
  const ref = useRef<HTMLPreElement>(null);
  useEffect(() => {
    let frame = 0;
    const draw = () => {
      if (ref.current) {
        ref.current.textContent = (
          [
            ["bass", bands.bass],
            ["mid ", bands.mid],
            ["treb", bands.treble],
            ["lvl ", bands.level],
          ] as const
        )
          .map(([label, value]) => `${label} ${eighthsBar(value, 22)}`)
          .join("\n");
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bands]);
  return (
    <pre
      ref={ref}
      aria-hidden="true"
      className="text-ink border-rule bg-muted/30 overflow-hidden rounded-[3px] border px-2 py-1.5 text-[10px] leading-[1.3]"
    />
  );
};

export interface SourcePanelProps {
  source: StudioSource;
  media: MediaSettings;
  /** The name of an uploaded file on the stage, if any. */
  uploadName: string | null;
  webcamOn: boolean;
  audioMode: AudioMode;
  bands: AudioBands;
  onSource: (id: SourceId) => void;
  onMedia: (patch: Partial<MediaSettings>) => void;
  onFile: (file: File) => void;
  onClearUpload: () => void;
  onWebcam: (on: boolean) => void;
  onAudio: (mode: AudioMode) => void;
}

export const SourcePanel = ({
  source,
  media,
  uploadName,
  webcamOn,
  audioMode,
  bands,
  onSource,
  onMedia,
  onFile,
  onClearUpload,
  onWebcam,
  onAudio,
}: SourcePanelProps) => (
  <div className="divide-rule flex flex-col divide-y">
    <SourceList value={source.id} onChange={onSource} />

    {source.kind === "field" && source.seeded ? (
      <Section title="Seed">
        <SeedInput
          key={source.id}
          value={media.seed}
          fallback={source.id}
          onCommit={(seed) => onMedia({ seed })}
        />
      </Section>
    ) : null}

    {source.id === "image" ? (
      <Section title="Image">
        <Segmented
          label="Preset"
          value={uploadName ? "upload" : media.image}
          options={[
            ...IMAGE_PRESETS.map((preset) => ({
              label: preset.label,
              value: preset.id,
            })),
            ...(uploadName
              ? [{ label: "Upload", value: "upload" as const }]
              : []),
          ]}
          columns={2}
          onChange={(image) => {
            if (image !== "upload") {
              onClearUpload();
              onMedia({ image });
            }
          }}
        />
        <FileButton accept="image/*" label="Choose an image…" onFile={onFile} />
        <Toggle
          label="Auto levels"
          checked={media.levels}
          onChange={(levels) => onMedia({ levels })}
        />
        <p className="text-muted-foreground text-[11px] text-pretty">
          {uploadName
            ? `Showing ${uploadName}. It stays on this device.`
            : "Or drop one on the stage. Files never leave this tab."}
        </p>
      </Section>
    ) : null}

    {source.id === "video" ? (
      <Section title="Video">
        <FileButton accept="video/*" label="Choose a video…" onFile={onFile} />
        <Toggle
          label="Auto levels"
          checked={media.levels}
          onChange={(levels) => onMedia({ levels })}
        />
        {uploadName ? (
          <p className="text-muted-foreground text-[11px]">
            Showing {uploadName}.{" "}
            <button
              type="button"
              onClick={onClearUpload}
              className="text-foreground underline underline-offset-2"
            >
              Clear
            </button>
          </p>
        ) : null}
        <VideoUrl
          value={media.video}
          onCommit={(video) => {
            onClearUpload();
            onMedia({ video });
          }}
        />
      </Section>
    ) : null}

    {source.id === "webcam" ? (
      <Section title="Webcam">
        <WebcamControls on={webcamOn} onToggle={onWebcam} />
      </Section>
    ) : null}

    {source.id === "text" ? (
      <Section title="Banner">
        <TextControls media={media} onChange={onMedia} />
      </Section>
    ) : null}

    <Section title="Audio">
      <Segmented
        label="Drive the source with sound"
        value={audioMode}
        options={[
          { label: "off", value: "off" },
          { label: "synth", value: "synth" },
          { label: "mic", value: "mic" },
        ]}
        onChange={onAudio}
      />
      {audioProblem(audioMode, bands.status) ? (
        <p role="alert" className="text-foreground text-[11px] text-pretty">
          {audioProblem(audioMode, bands.status)}
        </p>
      ) : null}
      {audioMode === "off" ? (
        <p className="text-muted-foreground text-[11px] text-pretty">
          Bass, mids and treble feed the source&apos;s audio input. The synth is
          silent: it only drives the analyser.
        </p>
      ) : (
        <AudioMeter bands={bands} />
      )}
    </Section>
  </div>
);
