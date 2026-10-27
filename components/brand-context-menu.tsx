"use client";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useCallback } from "react";
import { toast } from "sonner";

import { Icon } from "@/components/icon";
import { LogoMark, Wordmark, getLogoMarkSVG } from "@/components/logo";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { ROUTES } from "@/constants/routes";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

/**
 * The home link with the wordmark, plus a right-click menu to copy or
 * download the mark as SVG. The link is built here, in a client component:
 * Radix's `asChild` Slot can't clone a child element that a Server
 * Component passed down (it arrives as a lazy reference and renders nothing).
 */
export const BrandContextMenu = ({ className }: { className?: string }) => {
  const { resolvedTheme } = useTheme();
  const { copyToClipboard } = useCopyToClipboard();

  const logoMarkSvgString = getLogoMarkSVG(
    resolvedTheme === "light" ? "#000" : "#fff"
  );

  const handleCopy = useCallback(() => {
    copyToClipboard(logoMarkSvgString);
    toast.success("Icon as SVG copied");
  }, [logoMarkSvgString, copyToClipboard]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([logoMarkSvgString], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "asciicn-mark.svg";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Icon as SVG downloaded");
  }, [logoMarkSvgString]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Link
          href={ROUTES.HOME}
          transitionTypes={["nav-back"]}
          className={className}
        >
          <Wordmark />
        </Link>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy}>
          <LogoMark />
          Copy as SVG
        </ContextMenuItem>

        <ContextMenuItem onClick={handleDownload}>
          <Icon icon={Download04Icon} /> Download as SVG
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
