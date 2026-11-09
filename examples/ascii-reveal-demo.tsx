"use client";

import { useEffect, useState } from "react";

import { AsciiReveal } from "@/components/asciicn/ascii-reveal";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-reveal-controls";
import { usePrefersReducedMotion } from "@/lib/ascii";

// How long each end of the loop holds before the sweep turns around.
const HOLD_GLYPHS_MS = 1400;
const HOLD_PHOTO_MS = 2600;

export default function AsciiRevealDemo() {
  const photo = knobs.PHOTOS[usePreviewValue(knobs.photo)];
  const trigger = usePreviewValue(knobs.trigger);
  const direction = usePreviewValue(knobs.direction);
  const charset = usePreviewValue(knobs.charset);
  const colorMode = usePreviewValue(knobs.colorMode);
  const duration = usePreviewValue(knobs.duration);
  const cell = usePreviewValue(knobs.cell);
  const reducedMotion = usePrefersReducedMotion();
  const loop = trigger === "loop";
  // Odd steps show the photo. Step 0 is the first, glyphs-only hold.
  const [step, setStep] = useState(0);
  const revealed = step % 2 === 1;

  // Play the reveal forward and back, holding at each end. With reduced
  // motion the demo stays on its glyphs.
  useEffect(() => {
    if (!loop || reducedMotion) {
      setStep(0);
      return;
    }
    const hold = revealed ? HOLD_PHOTO_MS : HOLD_GLYPHS_MS;
    const wait = step === 0 ? HOLD_GLYPHS_MS : duration + hold;
    const timer = window.setTimeout(() => setStep((value) => value + 1), wait);
    return () => window.clearTimeout(timer);
  }, [loop, reducedMotion, step, revealed, duration]);

  return (
    <div
      className="flex w-full flex-col items-center gap-3"
      // Fit the photo's own shape inside a stage about 480px tall.
      style={{ maxWidth: 480 * photo.ratio }}
    >
      <AsciiReveal
        key={`${photo.src}-${trigger}`}
        src={photo.src}
        alt={photo.alt}
        trigger={loop ? "manual" : trigger}
        revealed={revealed}
        direction={direction}
        charset={charset}
        colorMode={colorMode}
        ramp="sodium"
        duration={duration}
        cell={cell}
        ratio={photo.ratio}
        className="w-full"
      />
      {loop ? (
        // Which end of the loop the sweep is heading for.
        <p
          aria-hidden
          className="text-muted-foreground flex gap-2 font-mono text-[11px] select-none"
        >
          <span className={revealed ? undefined : "text-foreground"}>
            glyphs
          </span>
          <span>→</span>
          <span className={revealed ? "text-foreground" : undefined}>
            photo
          </span>
        </p>
      ) : null}
    </div>
  );
}
