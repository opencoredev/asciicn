"use client";

/**
 * The Export bar: copy the setup as TSX or as an install command, save the
 * current frame as .txt, .ans, .svg or .png, or record a WebM loop.
 * On small screens it folds into one menu, which `e` also opens.
 */

import {
  ArrowDown01Icon,
  CodeIcon,
  CommandLineIcon,
  Download04Icon,
  RecordIcon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import type { RefObject } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { PanelButton } from "@/components/studio/fields";
import { cssToRgb } from "@/components/studio/frame-colors";
import { installCommand, jsxSnippet } from "@/components/studio/snippet";
import type { StudioSource } from "@/components/studio/sources";
import type { Look, MediaSettings } from "@/components/studio/state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { AsciiHandle } from "@/lib/ascii/frame";
import { cn } from "@/lib/utils";

export const FILE_KINDS = ["txt", "ans", "svg", "png"] as const;
export type FileKind = (typeof FILE_KINDS)[number];

const DURATIONS = [3, 6, 10] as const;
type Duration = (typeof DURATIONS)[number];

type RecordState =
  | { readonly kind: "idle" }
  | { readonly kind: "recording"; readonly progress: number };

/** One recording in flight. `cancelled` throws the video away on stop. */
interface Session {
  readonly recorder: CanvasRecorder;
  cancelled: boolean;
  stopping: boolean;
}

export interface ExportBarProps {
  handle: RefObject<AsciiHandle | null>;
  source: StudioSource;
  look: Look;
  media: MediaSettings;
  uploaded: boolean;
  menuOpen: boolean;
  onMenuOpen: (open: boolean) => void;
  className?: string;
}

const failed = (what: string, error: unknown) => {
  toast.error(`${what} failed`, {
    description: error instanceof Error ? error.message : undefined,
  });
};

export const ExportBar = ({
  handle,
  source,
  look,
  media,
  uploaded,
  menuOpen,
  onMenuOpen,
  className,
}: ExportBarProps) => {
  const [duration, setDuration] = useState<Duration>(6);
  const [record, setRecord] = useState<RecordState>({ kind: "idle" });
  const fileName = (extension: string) =>
    `asciicn-${source.id}-${look.charset}.${extension}`;

  const sessionRef = useRef<Session | null>(null);

  const copy = async (text: string, what: string) => {
    if (await copyText(text)) {
      toast.success(`${what} copied`);
    } else {
      toast.error(`Couldn't copy the ${what.toLowerCase()}`, {
        description: "The browser refused clipboard access.",
      });
    }
  };

  const save = async (kind: FileKind) => {
    const { current } = handle;
    const frame = current?.capture() ?? null;
    if (!(current && frame)) {
      toast.error("Nothing to export yet", {
        description: "Wait for the first frame, then try again.",
      });
      return;
    }
    const { ink, paper } = current.colors();
    const metrics = current.metrics() ?? undefined;
    try {
      switch (kind) {
        case "txt": {
          downloadText(toText(frame, { trimEnd: true }), fileName("txt"));
          break;
        }
        case "ans": {
          const text = toAnsi(frame, {
            ansi: look.ansi,
            ink: cssToRgb(ink),
            mode: look.colorMode === "ansi16" ? "ansi16" : "truecolor",
            trimEnd: true,
          });
          downloadText(text, fileName("ans"));
          break;
        }
        case "svg": {
          downloadText(
            toSvg(frame, { font: metrics?.font, ink, metrics, paper }),
            fileName("svg"),
            "image/svg+xml"
          );
          break;
        }
        case "png": {
          downloadBlob(await toPng(current), fileName("png"));
          break;
        }
        default: {
          const exhaustive: never = kind;
          return exhaustive;
        }
      }
      toast.success(`Saved ${fileName(kind)}`);
    } catch (error) {
      failed(`The .${kind} export`, error);
    }
  };

  const finish = async (session: Session) => {
    if (session.stopping) {
      return;
    }
    session.stopping = true;
    const blob = await session.recorder.stop();
    sessionRef.current = null;
    setRecord({ kind: "idle" });
    if (!session.cancelled) {
      const name = fileName(videoExtension(blob.type));
      downloadBlob(blob, name);
      toast.success(`Saved ${name}`);
    }
  };

  const startRecording = () => {
    const canvas = handle.current?.canvas ?? null;
    if (!canvas) {
      toast.error("Nothing to record yet");
      return;
    }
    const total = duration * 1000;
    let session: Session | null = null;
    try {
      const recorder = createRecorder(canvas, {
        fps: 30,
        onProgress: (elapsed) => {
          setRecord({
            kind: "recording",
            progress: Math.min(1, elapsed / total),
          });
          if (elapsed >= total && session) {
            void finish(session);
          }
        },
      });
      session = { cancelled: false, recorder, stopping: false };
    } catch (error) {
      failed("Recording", error);
      return;
    }
    sessionRef.current = session;
    session.recorder.start();
    setRecord({ kind: "recording", progress: 0 });
  };

  const cancelRecording = () => {
    const session = sessionRef.current;
    if (session) {
      session.cancelled = true;
      void finish(session);
    }
  };

  const snippet = () => jsxSnippet(source, look, media, { uploaded });
  const recording = record.kind === "recording";

  const menu = (
    <DropdownMenu open={menuOpen} onOpenChange={onMenuOpen}>
      <DropdownMenuTrigger asChild>
        <PanelButton aria-keyshortcuts="e" className="h-8 gap-1">
          Export
          <Icon icon={ArrowDown01Icon} />
        </PanelButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="w-56 font-mono [&_[data-slot=dropdown-menu-item]]:py-1 [&_[data-slot=dropdown-menu-item]]:text-xs"
      >
        <DropdownMenuLabel className="label-caps text-muted-foreground">
          Copy
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void copy(snippet(), "TSX")}>
          <Icon icon={CodeIcon} />
          TSX snippet
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void copy(installCommand(source), "Install command")}
        >
          <Icon icon={CommandLineIcon} />
          Install command
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="label-caps text-muted-foreground">
          Save this frame
        </DropdownMenuLabel>
        {FILE_KINDS.map((kind) => (
          <DropdownMenuItem key={kind} onSelect={() => void save(kind)}>
            <Icon icon={Download04Icon} />.{kind}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={recording} onSelect={startRecording}>
          <Icon icon={RecordIcon} />
          Record {duration}s video
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div
      className={cn(
        "bg-background border-rule flex min-w-0 items-center gap-2 border-t px-3 py-2",
        className
      )}
    >
      <div className="hidden min-w-0 flex-1 items-center gap-2 lg:flex">
        <code
          className="text-muted-foreground hidden min-w-0 flex-1 truncate text-[11px] 2xl:block"
          title={installCommand(source)}
        >
          <span className="text-faint me-1.5 select-none">$</span>
          {installCommand(source)}
        </code>
        <PanelButton
          onClick={() => void copy(installCommand(source), "Install command")}
          className="h-8"
        >
          <Icon icon={CommandLineIcon} />
          Copy install
        </PanelButton>
        <PanelButton
          onClick={() => void copy(snippet(), "TSX")}
          className="h-8"
        >
          <Icon icon={CodeIcon} />
          Copy TSX
        </PanelButton>
        <span aria-hidden="true" className="bg-rule mx-1 h-5 w-px" />
        <div role="group" aria-label="Save this frame" className="flex gap-1">
          {FILE_KINDS.map((kind) => (
            <PanelButton
              key={kind}
              onClick={() => void save(kind)}
              className="h-8 px-2"
            >
              .{kind}
            </PanelButton>
          ))}
        </div>
        <span aria-hidden="true" className="bg-rule mx-1 h-5 w-px" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1 lg:flex-none">
        {recording ? (
          <div
            role="status"
            className="border-rule flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[3px] border px-2 text-[11px] lg:w-56 lg:flex-none"
          >
            <span
              aria-hidden="true"
              className="bg-destructive size-1.5 shrink-0 motion-safe:animate-pulse"
            />
            <span className="tabular shrink-0">
              REC {Math.round(record.progress * duration)}/{duration}s
            </span>
            <span
              aria-hidden="true"
              className="bg-muted relative h-1 min-w-8 flex-1 overflow-hidden"
            >
              <span
                className="bg-ink absolute inset-y-0 left-0 w-full origin-left"
                style={{ transform: `scaleX(${record.progress})` }}
              />
            </span>
            <button
              type="button"
              onClick={cancelRecording}
              className="text-foreground hover:text-destructive shrink-0 underline-offset-2 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <label className="sr-only" htmlFor="studio-record-duration">
              Recording length
            </label>
            <select
              id="studio-record-duration"
              value={duration}
              onChange={(event) => {
                const next = DURATIONS.find(
                  (value) => String(value) === event.currentTarget.value
                );
                if (next) {
                  setDuration(next);
                }
              }}
              className="border-rule bg-background focus-visible:outline-ring h-8 rounded-[3px] border px-1.5 text-[11px] outline-none focus-visible:outline-2"
            >
              {DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
            <PanelButton onClick={startRecording} className="h-8">
              <Icon icon={RecordIcon} className="text-destructive" />
              Record .webm
            </PanelButton>
          </>
        )}
        <div className="ms-auto lg:ms-1">{menu}</div>
      </div>
    </div>
  );
};
