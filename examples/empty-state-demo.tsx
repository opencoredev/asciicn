"use client";

import { EmptyState } from "@/components/asciicn/empty-state";
import { usePreviewValue } from "@/components/preview-controls";
import { Button } from "@/components/ui/button";
import * as knobs from "@/examples/empty-state-controls";

const COPY = {
  cable: {
    description:
      "We can't reach the event stream. Check your connection, then try again.",
    primary: "Try again",
    secondary: "Status page",
    title: "Disconnected",
  },
  folder: {
    description:
      "Drop files here or upload them. Anything you add is private until you share it.",
    primary: "Upload files",
    secondary: "New folder",
    title: "This folder is empty",
  },
  inbox: {
    description: "New messages from your team land here. You're all caught up.",
    primary: "Compose",
    secondary: "Notification settings",
    title: "Inbox zero",
  },
  search: {
    description: "Check the spelling, or try a shorter phrase.",
    primary: "Clear search",
    secondary: "Browse all",
    title: "No results",
  },
} as const;

export default function EmptyStateDemo() {
  const illustration = usePreviewValue(knobs.illustration);
  const color = usePreviewValue(knobs.tint);
  const cell = usePreviewValue(knobs.cell);
  const animate = usePreviewValue(knobs.animate);
  const copy = COPY[illustration];

  return (
    <EmptyState
      illustration={illustration}
      color={color}
      cell={cell}
      animate={animate}
      titleAs="h2"
      title={copy.title}
      description={copy.description}
      action={
        <>
          <Button size="sm">{copy.primary}</Button>
          <Button size="sm" variant="outline">
            {copy.secondary}
          </Button>
        </>
      }
    />
  );
}
