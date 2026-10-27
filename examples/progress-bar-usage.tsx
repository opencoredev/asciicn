import { ProgressBar } from "@/components/asciicn/progress-bar";

const STORAGE = [
  { color: "blue", label: "Images", value: 4.1 },
  { color: "purple", label: "Video", value: 2.3 },
  { color: "green", label: "Backups", value: 0.8 },
] as const;

export default function ProgressBarUsage() {
  return (
    <div className="bg-background border-border flex w-full max-w-md flex-col gap-6 rounded-lg border p-5 sm:p-6">
      <div className="flex flex-col gap-1">
        <span className="font-medium">Usage this cycle</span>
        <span className="text-muted-foreground text-sm">
          Resets on November 1
        </span>
      </div>
      <ProgressBar
        label="Storage"
        parts={STORAGE}
        max={10}
        unit=" GB"
        valueText="7.2 of 10 GB"
      />
      <ProgressBar
        label="Bandwidth"
        value={312}
        max={1000}
        valueText="312 of 1,000 GB"
        size="sm"
        track="dots"
      />
      <ProgressBar
        label="Build minutes"
        value={5770}
        max={6000}
        valueText="5,770 of 6,000 min"
        size="sm"
        track="dots"
        color="red"
      />
    </div>
  );
}
