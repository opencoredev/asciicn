import { AsciiOrb } from "@/components/asciicn/ascii-orb";

export default function AsciiOrbVoice() {
  return (
    <div className="bg-background flex w-full max-w-xs items-center gap-4 rounded-2xl border p-4">
      <AsciiOrb
        color="green"
        background="transparent"
        size={0.36}
        morph={1.5}
        lean={0}
        cell={1}
        className="size-16 shrink-0"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">Listening</span>
        <span className="text-muted-foreground truncate text-xs">
          “Book the usual table for Thursday”
        </span>
      </div>
    </div>
  );
}
