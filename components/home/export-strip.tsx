"use client";

import {
  CodeIcon,
  Copy01Icon,
  Download04Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useRef, useState } from "react";
import type { RefObject } from "react";

import {
  downloadFile,
  EXPORT_FORMATS,
  exportFrame,
} from "@/components/home/frame-export";
import type { ExportFormat } from "@/components/home/frame-export";
import { lookProps } from "@/components/home/looks";
import type { StageSettings } from "@/components/home/looks";
import type { StageSource } from "@/components/home/sources";
import { Icon } from "@/components/icon";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import type { AsciiHandle } from "@/lib/ascii";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/** The shadcn command that installs one source. */
export const installCommand = (origin: string, id: string) =>
  `npx shadcn@latest add ${origin}/r/${id}.json`;

const importPath = (source: StageSource) =>
  source.kind === "scene"
    ? `@/components/asciicn/scenes/${source.id}`
    : `@/components/asciicn/${source.id}`;

const jsxValue = (value: unknown): string => {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  return `{${JSON.stringify(value).replaceAll(/"(\w+)":/gu, "$1: ")}}`;
};

/** JSX that reproduces the stage: only the props that differ from defaults. */
export const stageJsx = (source: StageSource, settings: StageSettings) => {
  const props: [string, unknown][] = Object.entries(lookProps(settings));
  if (settings.cell !== 12) {
    props.push(["cell", settings.cell]);
  }
  const attributes = props
    .map(([key, value]) => ` ${key}=${jsxValue(value)}`)
    .join("");
  return `import { ${source.exportName} } from "${importPath(source)}";

<${source.exportName}${attributes} className="h-96 w-full" />`;
};

const BUTTON =
  "border-rule text-muted-foreground hover:text-foreground hover:border-foreground/40 focus-visible:outline-ring inline-flex h-8 shrink-0 items-center gap-1.5 border px-2.5 font-mono text-[11px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 data-[done=true]:text-ink data-[done=true]:border-ink";

const CopyAction = ({
  label,
  doneLabel,
  value,
  icon,
  onCopied,
}: {
  label: string;
  doneLabel: string;
  value: () => string;
  icon: typeof CodeIcon;
  onCopied?: () => void;
}) => {
  const { copyToClipboard, isCopied } = useCopyToClipboard({
    onCopy: onCopied,
    timeout: 1500,
  });
  return (
    <button
      type="button"
      className={BUTTON}
      data-done={isCopied}
      onClick={() => copyToClipboard(value())}
    >
      <Icon icon={isCopied ? Tick02Icon : icon} className="size-3.5" />
      <span className="grid *:col-start-1 *:row-start-1">
        <span className={cn(isCopied && "invisible")}>{label}</span>
        <span className={cn(!isCopied && "invisible")}>{doneLabel}</span>
      </span>
    </button>
  );
};

export interface ExportStripProps {
  source: StageSource;
  settings: StageSettings;
  handle: RefObject<AsciiHandle | null>;
  /** Include the install command button. Default true. */
  install?: boolean;
  className?: string;
}

/**
 * Take the stage with you: the install command, JSX for the current
 * switches, and the frame on screen as text, ANSI, SVG or PNG.
 */
export const ExportStrip = ({
  source,
  settings,
  handle,
  install = true,
  className,
}: ExportStripProps) => {
  const origin = useSiteOrigin();
  const [saved, setSaved] = useState<ExportFormat | null>(null);
  const [note, setNote] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = async (format: ExportFormat) => {
    const blob = await exportFrame(handle.current, format);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    if (!blob) {
      setNote("Nothing drawn yet. Try again in a moment.");
      timer.current = setTimeout(() => setNote(""), 2500);
      return;
    }
    downloadFile(blob, `${source.id}.${format}`);
    setSaved(format);
    setNote(`Saved ${source.id}.${format}`);
    timer.current = setTimeout(() => {
      setSaved(null);
      setNote("");
    }, 1500);
  };

  return (
    <div
      className={cn("flex flex-wrap items-center gap-1.5", className)}
      role="group"
      aria-label="Export"
    >
      {install ? (
        <CopyAction
          label="Copy install"
          doneLabel="Copied"
          icon={Copy01Icon}
          value={() => installCommand(origin, source.id)}
          onCopied={() =>
            trackEvent({
              name: "install_command_copied",
              properties: { component_name: source.id, section: "stage" },
            })
          }
        />
      ) : null}
      <CopyAction
        label="Copy JSX"
        doneLabel="Copied"
        icon={CodeIcon}
        value={() => stageJsx(source, settings)}
        onCopied={() =>
          trackEvent({
            name: "component_code_copied",
            properties: { component_name: source.id, section: "stage" },
          })
        }
      />
      <span aria-hidden className="bg-rule mx-1 hidden h-4 w-px sm:block" />
      {EXPORT_FORMATS.map((format) => (
        <button
          key={format}
          type="button"
          className={BUTTON}
          data-done={saved === format}
          onClick={() => save(format)}
          aria-label={`Download the current frame as .${format}`}
        >
          <Icon
            icon={saved === format ? Tick02Icon : Download04Icon}
            className="size-3.5"
          />
          .{format}
        </button>
      ))}
      <span
        aria-live="polite"
        className="text-muted-foreground px-1 font-mono text-[11px]"
      >
        {note}
      </span>
    </div>
  );
};
