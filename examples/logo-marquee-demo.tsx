"use client";

import { LogoMarquee } from "@/components/asciicn/logo-marquee";
import { usePreviewValue } from "@/components/preview-controls";
import { LOGOS } from "@/examples/ascii-logo-data";
import * as knobs from "@/examples/logo-marquee-controls";

export default function LogoMarqueeDemo() {
  const speed = usePreviewValue(knobs.speed);
  const charset = usePreviewValue(knobs.charset);
  const rows = usePreviewValue(knobs.rows);
  const direction = usePreviewValue(knobs.direction);
  const fade = usePreviewValue(knobs.fade);
  const color = usePreviewValue(knobs.ink);

  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="text-muted-foreground font-mono text-xs">
        Teams that ship with asciicn
      </p>
      <LogoMarquee
        logos={LOGOS}
        label="Customers"
        speed={speed}
        charset={charset}
        rows={rows}
        direction={direction}
        fade={fade}
        color={color}
      />
    </div>
  );
}
