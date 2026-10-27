import { TerminalWindow } from "@/components/asciicn/terminal-window";

export default function TerminalWindowHero() {
  return (
    // Side by side only when the container is wide enough for both.
    <div className="@container w-full max-w-4xl">
      <div className="grid items-center gap-8 @[760px]:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground font-mono text-xs">
            asciicn · registry
          </p>
          <p className="text-2xl font-semibold tracking-tight text-balance">
            One command. Real glyphs on the first frame.
          </p>
          <p className="text-muted-foreground text-sm text-pretty">
            Add a component with the shadcn CLI, build, and the engine prints
            the same frame your page will draw.
          </p>
        </div>
        <TerminalWindow speed={1.25} rows={16} title="~/acme — zsh" />
      </div>
    </div>
  );
}
