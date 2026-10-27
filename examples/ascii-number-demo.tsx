"use client";

import { useEffect, useState } from "react";

import { AsciiNumber } from "@/components/asciicn/ascii-number";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-number-controls";

const VALUES = [48_213, 51_904, 49_377, 57_012] as const;

export default function AsciiNumberDemo() {
  const font = usePreviewValue(knobs.font);
  const color = usePreviewValue(knobs.tint);
  const cell = usePreviewValue(knobs.cell);
  const ghost = usePreviewValue(knobs.ghost);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setStep((value) => (value + 1) % VALUES.length),
      3200
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <figure className="flex flex-col items-center gap-3">
      <AsciiNumber
        value={VALUES[step] ?? VALUES[0]}
        font={font}
        color={color}
        cell={cell}
        ghost={ghost}
        trigger="mount"
      />
      <figcaption className="font-mono text-xs text-muted-foreground">
        requests / min
      </figcaption>
    </figure>
  );
}
