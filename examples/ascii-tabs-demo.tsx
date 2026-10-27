"use client";

import { AsciiTabs } from "@/components/asciicn/ascii-tabs";
import type { AsciiTab } from "@/components/asciicn/ascii-tabs";
import { usePreviewValue } from "@/components/preview-controls";
import * as knobs from "@/examples/ascii-tabs-controls";

const FILES = [
  "components/asciicn/",
  "├─ ascii-tabs.tsx",
  "├─ ascii-box.tsx",
  "└─ loader.tsx",
  "lib/ascii/",
  "└─ index.ts",
] as const;

const DEPLOYS = [
  ["4f2a1c9", "Fix badge contrast", "2m"],
  ["8e52937", "Add Braille loader", "1h"],
  ["1c07b4e", "Bump engine to 0.9", "1d"],
] as const;

const TABS: readonly AsciiTab[] = [
  {
    content: (
      <pre className="font-mono text-sm leading-6">
        {FILES.map((line) => (
          <span
            key={line}
            className={
              line.endsWith("/") ? "text-muted-foreground block" : "block"
            }
          >
            {line}
          </span>
        ))}
      </pre>
    ),
    label: "Files",
    value: "files",
  },
  {
    content: (
      <ul className="flex flex-col gap-2 text-sm">
        {DEPLOYS.map(([sha, message, age]) => (
          <li key={sha} className="flex items-baseline gap-3">
            <span className="text-muted-foreground font-mono text-xs">
              {sha}
            </span>
            <span className="truncate">{message}</span>
            <span className="text-muted-foreground ml-auto font-mono text-xs">
              {age}
            </span>
          </li>
        ))}
      </ul>
    ),
    label: "Commits",
    value: "commits",
  },
  {
    content: (
      <p className="text-muted-foreground text-sm">
        Production deploys from <span className="text-foreground">main</span>.
        Preview deploys run for every pull request and expire after 7 days.
      </p>
    ),
    label: "Notes",
    value: "notes",
  },
];

export default function AsciiTabsDemo() {
  const variant = usePreviewValue(knobs.variant);
  const color = usePreviewValue(knobs.tint);
  const size = usePreviewValue(knobs.size);

  return (
    <AsciiTabs
      tabs={TABS}
      label="Project"
      variant={variant}
      color={color}
      size={size}
      className="max-w-md"
    />
  );
}
