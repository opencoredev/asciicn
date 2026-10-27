"use client";

import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";

import { CTA_SECONDARY } from "@/components/home/cta";
import { Icon } from "@/components/icon";
import { Prompt } from "@/components/terminal/prompt";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useSiteOrigin } from "@/hooks/use-site-origin";
import { quickStartPrompt } from "@/lib/agent-prompts";
import type { EventProperties } from "@/lib/events";
import { trackEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/** A shell command whose URL points at the site the reader is on. */
export const OriginPrompt = ({
  before,
  path,
  section,
  className,
}: {
  /** Command text before the URL, such as `npx skills add`. */
  before: string;
  /** Path after the origin. */
  path: string;
  /** Analytics section name. */
  section: string;
  className?: string;
}) => {
  const origin = useSiteOrigin();
  const properties: EventProperties = { section };
  return (
    <Prompt
      className={className}
      command={`${before} ${origin}${path}`}
      event="install_command_copied"
      eventProperties={properties}
    />
  );
};

/** Copies the quick start prompt: setup plus a first effect, for any agent. */
export const CopyAgentPrompt = ({ className }: { className?: string }) => {
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const origin = useSiteOrigin();
  const copy = async () => {
    const prompt = quickStartPrompt(origin);
    if (await copyToClipboard(prompt)) {
      trackEvent({
        name: "agent_prompt_copied",
        properties: { location: "home", prompt_name: "quick-start" },
      });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(CTA_SECONDARY, "data-[copied=true]:text-ink", className)}
      data-copied={isCopied}
    >
      <Icon icon={isCopied ? Tick02Icon : Copy01Icon} className="size-4" />
      <span className="grid *:col-start-1 *:row-start-1">
        <span className={cn(isCopied && "invisible")}>Copy agent prompt</span>
        <span className={cn(!isCopied && "invisible")}>Prompt copied</span>
      </span>
      <span aria-live="polite" className="sr-only">
        {isCopied ? "Quick start prompt copied" : ""}
      </span>
    </button>
  );
};
