"use client";

/*
 * ASCII Studio. Direction:
 * - Reference: a bench oscilloscope (a readout line under the trace) and
 *   Ableton's device panels (dense, labelled, every knob live).
 * - Palette: the site's black or white paper and 1px rules; the glyphs are
 *   the only colour.
 * - Type: the site mono for everything, display caps for section labels,
 *   tabular figures in every readout.
 * - Layout: source rack | stage framed by rulers | control rack, with the
 *   export strip under the stage like a transport bar.
 * - Signature: the glyph loupe, which reads back the cell under the pointer
 *   (glyph, code point, ink density, colour) and lights its ruler ticks.
 * - Avoiding: card grids, pill badges, soft drop shadows, gradient chrome.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { Controls } from "@/components/studio/controls";
import { ExportBar } from "@/components/studio/export-bar";
import { Segmented } from "@/components/studio/fields";
import { HelpDialog } from "@/components/studio/help-dialog";
import { resolveLook, sourceDefaults } from "@/components/studio/look";
import {
  ComponentRenderer,
  MediaRenderer,
  mediaInput,
} from "@/components/studio/renderers";
import type { StageNotice } from "@/components/studio/renderers";
import type { SourceId } from "@/components/studio/source-ids";
import { SourcePanel } from "@/components/studio/source-panel";
import type { AudioMode } from "@/components/studio/source-panel";
import { getSource } from "@/components/studio/sources";
import { StageFrame } from "@/components/studio/stage";
import { studioQuery } from "@/components/studio/state";
import type {
  LookOverrides,
  MediaSettings,
  StudioState,
} from "@/components/studio/state";
import { Kbd } from "@/components/ui/kbd";
import { useAudioBands } from "@/lib/ascii/audio";
import { CHARSET_NAMES } from "@/lib/ascii/charsets";
import type { AsciiHandle } from "@/lib/ascii/frame";
import { cn } from "@/lib/utils";

interface Upload {
  readonly kind: "image" | "video";
  readonly url: string;
  readonly name: string;
}

type Panel = "source" | "controls";

/** Inputs where a key press is typing, not a shortcut. */
const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable || target instanceof HTMLTextAreaElement) {
    return true;
  }
  if (target instanceof HTMLSelectElement) {
    return true;
  }
  return (
    target instanceof HTMLInputElement &&
    !["radio", "checkbox", "range", "button", "file"].includes(target.type)
  );
};

/** Space activates buttons and checkboxes; leave it to them. */
const ownsSpace = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  target.closest("button, input, select, textarea, a, [role=menuitem]") !==
    null;

const NO_NOTICE: StageNotice = { kind: "none" };

const idleMessageFor = (id: SourceId, cameraAllowed: boolean) => {
  if (id !== "webcam") {
    return "Choose a video file, drop one on the stage, or paste a URL.";
  }
  return cameraAllowed
    ? "Start the camera in the Source panel."
    : "The camera needs a secure page (https or localhost), and this preview is plain http. It works on asciicn.dev/studio.";
};

const fileKind = (file: File): Upload["kind"] | null => {
  if (file.type.startsWith("video/")) {
    return "video";
  }
  return file.type.startsWith("image/") ? "image" : null;
};

export const Studio = ({ initial }: { initial: StudioState }) => {
  const [state, setState] = useState(initial);
  const [paused, setPaused] = useState(false);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [webcamOn, setWebcamOn] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>("off");
  const [notice, setNotice] = useState<StageNotice>(NO_NOTICE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("controls");
  const handle = useRef<AsciiHandle | null>(null);
  // Known only in the browser; assume yes for the server render.
  const [cameraAllowed, setCameraAllowed] = useState(true);
  useEffect(() => {
    setCameraAllowed(window.isSecureContext && Boolean(navigator.mediaDevices));
  }, []);
  const bands = useAudioBands(audioMode === "off" ? null : audioMode);

  const source = getSource(state.source);
  const defaults = sourceDefaults(source);
  const look = resolveLook(source, state.overrides);
  const query = studioQuery(state, defaults);
  const dirty = query !== studioQuery({ ...state, overrides: {} }, defaults);

  // Keep the URL shareable without adding a history entry per slider step.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = `${window.location.pathname}?${query}`;
      if (`${window.location.pathname}${window.location.search}` !== next) {
        window.history.replaceState(window.history.state, "", next);
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  // Object URLs hold the whole file in memory until revoked.
  useEffect(
    () => () => {
      if (upload) {
        URL.revokeObjectURL(upload.url);
      }
    },
    [upload]
  );

  const setOverrides = useCallback((patch: LookOverrides) => {
    setState((current) => ({
      ...current,
      overrides: { ...current.overrides, ...patch },
    }));
  }, []);

  const setMedia = useCallback((patch: Partial<MediaSettings>) => {
    setState((current) => ({
      ...current,
      media: { ...current.media, ...patch },
    }));
  }, []);

  const setSource = useCallback((id: SourceId) => {
    setNotice(NO_NOTICE);
    setState((current) => ({ ...current, source: id }));
    if (id !== "webcam") {
      setWebcamOn(false);
    }
    setUpload((current) =>
      current &&
      current.kind === (id === "video" ? "video" : "image") &&
      (id === "image" || id === "video")
        ? current
        : null
    );
  }, []);

  const openFile = useCallback(
    (file: File) => {
      const kind = fileKind(file);
      if (!kind) {
        setNotice({
          kind: "error",
          message: "That file isn't an image or a video.",
        });
        return;
      }
      setSource(kind);
      setUpload({ kind, name: file.name, url: URL.createObjectURL(file) });
    },
    [setSource]
  );

  // Shortcuts: 1-9 and 0 pick a charset, space pauses, e exports, ? helps.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isTyping(event.target)
      ) {
        return;
      }
      if (/^\d$/u.test(event.key)) {
        const index = event.key === "0" ? 9 : Number(event.key) - 1;
        const charset = CHARSET_NAMES[index];
        if (charset) {
          event.preventDefault();
          setOverrides({ charset });
        }
        return;
      }
      if (event.key === " " && !ownsSpace(event.target)) {
        event.preventDefault();
        setPaused((value) => !value);
        return;
      }
      if (event.key === "e" || event.key === "E") {
        event.preventDefault();
        setMenuOpen(true);
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOverrides]);

  const media = source.kind === "media";
  const waiting = source.id === "webcam" && !webcamOn;
  const input =
    source.kind === "media" && !waiting
      ? mediaInput(source, state.media, upload)
      : null;
  const idleMessage = idleMessageFor(source.id, cameraAllowed);

  const sourcePanel = (
    <SourcePanel
      source={source}
      media={state.media}
      uploadName={upload?.name ?? null}
      webcamOn={webcamOn}
      audioMode={audioMode}
      bands={bands}
      onSource={setSource}
      onMedia={setMedia}
      onFile={openFile}
      onClearUpload={() => setUpload(null)}
      onWebcam={setWebcamOn}
      onAudio={setAudioMode}
    />
  );

  const controls = (
    <Controls
      source={source}
      look={look}
      defaults={defaults}
      paused={paused}
      dirty={dirty}
      onChange={setOverrides}
      onPause={setPaused}
      onReset={() => setState((current) => ({ ...current, overrides: {} }))}
    />
  );

  return (
    <div
      className={cn(
        "grid font-mono",
        "grid-cols-1 grid-rows-[auto_auto_auto_1fr]",
        "lg:h-[calc(100svh-var(--header-height))] lg:grid-cols-[17.5rem_minmax(0,1fr)_19rem] lg:grid-rows-[minmax(0,1fr)_auto]"
      )}
    >
      <h1 className="sr-only">ASCII Studio</h1>

      <StageFrame
        source={source}
        look={look}
        paused={paused}
        handle={handle}
        notice={notice}
        fpsCap={media ? 30 : 60}
        onDropFile={openFile}
        className="h-[54svh] min-h-80 lg:col-start-2 lg:row-start-1 lg:h-auto"
      >
        {source.kind === "media" ? (
          <MediaRenderer
            key={source.id}
            source={source}
            input={input}
            idleMessage={idleMessage}
            look={look}
            media={state.media}
            paused={paused}
            audio={audioMode === "off" ? null : bands}
            handle={handle}
            onNotice={setNotice}
          />
        ) : (
          <ComponentRenderer
            key={source.id}
            source={source}
            look={look}
            seed={state.media.seed}
            paused={paused}
            audio={audioMode === "off" ? null : bands}
            handle={handle}
            onNotice={setNotice}
          />
        )}
      </StageFrame>

      <ExportBar
        handle={handle}
        source={source}
        look={look}
        media={state.media}
        uploaded={upload !== null}
        menuOpen={menuOpen}
        onMenuOpen={setMenuOpen}
        className="lg:col-start-2 lg:row-start-2"
      />

      <div className="border-rule bg-background sticky top-(--header-height) z-10 border-y px-3 py-2 lg:hidden">
        <Segmented
          label="Panel"
          hideLabel
          value={panel}
          options={[
            { label: "Source", value: "source" },
            { label: "Controls", value: "controls" },
          ]}
          onChange={setPanel}
        />
      </div>

      <aside
        aria-label="Source"
        className={cn(
          "border-rule min-h-0 overflow-y-auto overscroll-contain lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:block lg:border-r",
          panel === "source" ? "block" : "hidden"
        )}
      >
        {sourcePanel}
        <p className="text-muted-foreground hidden px-3 pt-1 pb-4 text-[11px] lg:block">
          <Kbd>?</Kbd> for shortcuts
        </p>
      </aside>

      <aside
        aria-label="Controls"
        className={cn(
          "border-rule min-h-0 overflow-y-auto overscroll-contain lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:block lg:border-l",
          panel === "controls" ? "block" : "hidden"
        )}
      >
        {controls}
      </aside>

      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};
