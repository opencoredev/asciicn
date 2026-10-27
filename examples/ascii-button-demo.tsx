"use client";

import { ArrowRight01Icon, Settings01Icon } from "@hugeicons/core-free-icons";

import { AsciiButton } from "@/components/asciicn/ascii-button";
import { Icon } from "@/components/icon";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-button-controls";

export default function AsciiButtonDemo() {
  const variant = usePreviewValue(knobs.variant);
  const frame = usePreviewValue(knobs.frame);
  const color = usePreviewValue(knobs.tint);
  const size = usePreviewValue(knobs.size);
  const loading = usePreviewValue(knobs.loading);
  const shared = { color, frame, size };

  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <AsciiButton {...shared} variant={variant} loading={loading}>
        {loading ? "Deploying" : "Deploy"}
        {loading ? null : <Icon icon={ArrowRight01Icon} />}
      </AsciiButton>
      <AsciiButton {...shared} variant="outline">
        View logs
      </AsciiButton>
      <AsciiButton
        {...shared}
        size="icon"
        variant="ghost"
        aria-label="Settings"
      >
        <Icon icon={Settings01Icon} />
      </AsciiButton>
    </div>
  );
}
