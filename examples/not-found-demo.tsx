"use client";

import { NotFound } from "@/components/asciicn/not-found";
import { usePreviewValue } from "@/components/preview-controls";
import { Button } from "@/components/ui/button";
import * as knobs from "@/examples/not-found-controls";

export default function NotFoundDemo() {
  const code = usePreviewValue(knobs.code);
  const glyph = usePreviewValue(knobs.glyph);
  const depth = usePreviewValue(knobs.depth);
  const color = usePreviewValue(knobs.tint);
  const animate = usePreviewValue(knobs.animate);

  return (
    <NotFound
      titleAs="h2"
      code={code}
      glyph={glyph}
      depth={depth}
      color={color}
      animate={animate}
      path="/blog/2019/launch-week"
      actions={
        <>
          <Button size="sm">Back to home</Button>
          <Button size="sm" variant="outline">
            Search the docs
          </Button>
        </>
      }
    />
  );
}
