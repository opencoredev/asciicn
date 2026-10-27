"use client";

import { DissolveText } from "@/components/asciicn/dissolve-text";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/dissolve-text-controls";

export default function DissolveTextDemo() {
  const charset = usePreviewValue(knobs.charset);
  const order = usePreviewValue(knobs.order);
  const by = usePreviewValue(knobs.by);
  const duration = usePreviewValue(knobs.duration);
  const show = usePreviewValue(knobs.show);

  return (
    <DissolveText
      as="h3"
      show={show}
      trigger="mount"
      charset={charset}
      order={order}
      by={by}
      duration={duration / 1000}
      className="max-w-xl text-center font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl"
    >
      Signal resolves out of the noise floor
    </DissolveText>
  );
}
