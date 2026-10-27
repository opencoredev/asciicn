"use client";

import { Add01Icon } from "@hugeicons/core-free-icons";

import { AsciiButton } from "@/components/asciicn/ascii-button";
import { EmptyState } from "@/components/asciicn/empty-state";
import { Icon } from "@/components/icon";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/empty-state-controls";

export default function EmptyStateDemo() {
  const illustration = usePreviewValue(knobs.illustration);
  const matrix = usePreviewValue(knobs.matrix);
  const color = usePreviewValue(knobs.tint);
  const animate = usePreviewValue(knobs.animate);

  return (
    <EmptyState
      illustration={illustration}
      matrix={matrix}
      color={color}
      animate={animate}
      title="No projects yet"
      description="Create a project to deploy your first site. It takes about a minute."
      action={
        <>
          <AsciiButton color={color}>
            <Icon icon={Add01Icon} className="-ml-[3px]" />
            New project
          </AsciiButton>
          <AsciiButton variant="outline" color="grey">
            Import from Git
          </AsciiButton>
        </>
      }
    />
  );
}
