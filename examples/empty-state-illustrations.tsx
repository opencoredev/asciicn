import { EmptyState } from "@/components/asciicn/empty-state";
import type { EmptyStateIllustration } from "@/components/asciicn/empty-state";
import type { AsciiColorName } from "@/lib/ascii";

const SCENES: readonly {
  illustration: EmptyStateIllustration;
  color: AsciiColorName;
  title: string;
}[] = [
  { color: "blue", illustration: "inbox", title: "No messages" },
  { color: "grey", illustration: "search", title: "No matches" },
  { color: "orange", illustration: "folder", title: "This folder is empty" },
  { color: "red", illustration: "cable", title: "Connection lost" },
];

export default function EmptyStateIllustrations() {
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
      {SCENES.map(({ illustration, color, title }) => (
        <EmptyState
          key={illustration}
          illustration={illustration}
          color={color}
          title={title}
          titleAs="h4"
          cell={12}
          className="bg-background rounded-lg border px-4 py-6"
        />
      ))}
    </div>
  );
}
