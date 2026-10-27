"use client";

import { useCallback, useState } from "react";

import { KbdShortcut } from "@/components/asciicn/kbd-shortcut";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/kbd-shortcut-controls";

export default function KbdShortcutDemo() {
  const keys = usePreviewValue(knobs.keys);
  const variant = usePreviewValue(knobs.variant);
  const platform = usePreviewValue(knobs.platform);
  const size = usePreviewValue(knobs.size);
  const listen = usePreviewValue(knobs.listen);
  const [count, setCount] = useState(0);
  const onTrigger = useCallback(() => setCount((value) => value + 1), []);

  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <KbdShortcut
        keys={keys}
        variant={variant}
        platform={platform}
        size={size}
        listen={listen}
        onTrigger={onTrigger}
      />
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {listen
          ? "Hold the keys to press the caps."
          : "Open the command palette."}
        {count > 0 ? (
          <span className="text-foreground font-mono">{` · ${count}×`}</span>
        ) : null}
      </p>
    </div>
  );
}
