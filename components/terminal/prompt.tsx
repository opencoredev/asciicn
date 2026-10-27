"use client";

/**
 * Prompt: one shell command on a prompt line, with a copy action.
 *
 *   <Prompt command="npx shadcn@latest add @asciicn/silk" />
 *
 * Props
 * - `command`: the text that is shown and copied.
 * - `prefix`: prompt sigil before the command. Default "$". Not copied.
 * - `cursor`: draw a blinking block cursor after the command. Default false.
 * - `event`: analytics event fired on copy (see `@/lib/events`).
 * - `eventProperties`: extra properties for that event.
 * - `size`: "sm" (32px) or "md" (40px, default).
 * - all other `div` props.
 */

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { Icon } from "@/components/icon";
import { Cursor } from "@/components/terminal/cursor";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { EventName, EventProperties } from "@/lib/events";
import { pageContext, trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

export interface PromptProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** The command shown and copied. */
  command: string;
  /** Prompt sigil, not copied. Default "$". */
  prefix?: string;
  /** Blinking block cursor after the command. Default false. */
  cursor?: boolean;
  /** Analytics event fired after a copy. */
  event?: EventName;
  /** Extra properties for `event`. */
  eventProperties?: EventProperties;
  /** Row height: "sm" is 32px, "md" is 40px. Default "md". */
  size?: "sm" | "md";
}

export const Prompt = ({
  command,
  prefix = "$",
  cursor = false,
  event,
  eventProperties,
  size = "md",
  className,
  ...props
}: PromptProps) => {
  const { copyToClipboard, isCopied } = useCopyToClipboard({ timeout: 1500 });

  const copy = async () => {
    const copied = await copyToClipboard(command);
    if (copied && event) {
      trackEvent({
        name: event,
        properties: { ...pageContext(), ...eventProperties, command },
      });
    }
  };

  return (
    <div
      data-slot="prompt"
      className={cn(
        "bg-code text-code-foreground group/prompt flex w-full min-w-0 items-center rounded-sm border font-mono text-[13px]",
        size === "sm" ? "h-8" : "h-10",
        className
      )}
      {...props}
    >
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-[1ch] overflow-x-auto px-3 whitespace-pre">
        <span aria-hidden className="text-ink select-none">
          {prefix}
        </span>
        <code className="bg-transparent">{command}</code>
        {cursor ? <Cursor /> : null}
      </div>
      <button
        type="button"
        onClick={copy}
        className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:text-foreground flex h-full shrink-0 items-center gap-1.5 border-l px-3 text-[11px] transition-colors duration-150"
        aria-label={isCopied ? "Copied" : `Copy command: ${command}`}
      >
        <Icon
          icon={isCopied ? Tick02Icon : Copy01Icon}
          className={cn("size-3.5", isCopied && "text-ink")}
        />
        <span aria-live="polite" className="hidden w-[6ch] text-left sm:inline">
          {isCopied ? "copied" : "copy"}
        </span>
      </button>
    </div>
  );
};
