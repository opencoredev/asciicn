"use client";

import { Skeleton } from "@/components/asciicn/skeleton";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/skeleton-controls";

export default function SkeletonDemo() {
  const look = {
    cell: usePreviewValue(knobs.cell),
    chars: usePreviewValue(knobs.chars),
    color: usePreviewValue(knobs.tint),
    motion: usePreviewValue(knobs.motion),
  };

  return (
    <div
      aria-busy="true"
      className="bg-background flex w-full max-w-sm flex-col gap-5 rounded-lg border p-5"
    >
      <span className="sr-only">Loading post</span>
      <div className="flex items-center gap-3">
        <Skeleton {...look} shape="circle" size={3} />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton {...look} rows={1} className="w-32" />
          <Skeleton {...look} rows={1} className="w-20" />
        </div>
      </div>
      <Skeleton {...look} rows={8} />
      <Skeleton {...look} shape="text" lines={3} />
    </div>
  );
}
